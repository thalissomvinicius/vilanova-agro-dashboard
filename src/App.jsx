import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MonitorPlay, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import {
  DEFAULT_PAGE_ID,
  PAGE_ROUTES,
  ROUTE_DEFINITIONS,
  ROUTE_PAGES,
  getRouteFilterIds,
} from './config/routeConfig';
import Login from './pages/Login';
import { devError, devWarn } from './utils/devLog';
import {
  canUseDashboardAction,
  DASHBOARD_SESSION_EXPIRED_EVENT,
  isDashboardSessionExpiredError,
  logoutDashboardSession,
  refreshCqoData,
  refreshDashboardSession,
  setCqoSessionToken,
} from './utils/cqoData';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const CqoRampa = lazy(() => import('./pages/CqoRampa'));
const LossesAgricola = lazy(() => import('./pages/LossesAgricola'));
const Collections = lazy(() => import('./pages/Collections'));
const SyncCenter = lazy(() => import('./pages/SyncCenter'));
const Collaborators = lazy(() => import('./pages/Collaborators'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Settings = lazy(() => import('./pages/Settings'));
const Development = lazy(() => import('./pages/Development'));
const LeafletMap = lazy(() => import('./components/LeafletMap'));

const FILTER_STORAGE_KEY = 'vilanova_dashboard_filters';
const FILTER_STORAGE_VERSION = 3;
const AUTH_STORAGE_KEY = 'vilanova_dashboard_session';
const LEGACY_AUTH_STORAGE_KEY = 'vilanova_dashboard_user';
const AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const VALID_MONTHS = new Set(['all', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
const VALID_SOURCE_FILTERS = new Set(['all', 'app', 'excel', 'sql']);
const ENABLE_DEVELOPMENT_PAGE = import.meta.env.DEV
  || String(import.meta.env.VITE_ENABLE_DEVELOPMENT_PAGE || '').toLowerCase() === 'true';

function accessiblePagesForUser(user) {
  return new Set(
    ROUTE_DEFINITIONS
      .filter((route) => {
        if (route.developmentOnly && !ENABLE_DEVELOPMENT_PAGE) return false;
        if (route.adminOnly && user?.role !== 'admin') return false;
        if (route.permission && !canUseDashboardAction(user, route.permission)) return false;
        return true;
      })
      .map((route) => route.id)
  );
}

function monthDateRange(yearValue, monthValue) {
  if (yearValue === 'all') {
    return { from: '', to: '' };
  }

  const year = Number(yearValue) || new Date().getFullYear();

  if (monthValue === 'all') {
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    };
  }

  const month = Number(monthValue) || new Date().getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function isDateInputValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function pageFromPath(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return ROUTE_PAGES[normalized] || DEFAULT_PAGE_ID;
}

function pathFromPage(page) {
  return PAGE_ROUTES[page] || PAGE_ROUTES[DEFAULT_PAGE_ID];
}

function readStoredFilters() {
  try {
    const storedFilters = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || '{}');
    if (storedFilters?.__version !== FILTER_STORAGE_VERSION) return {};
    const filters = { ...storedFilters };
    delete filters.__version;
    return filters;
  } catch {
    return {};
  }
}

function searchFilters() {
  const params = new URLSearchParams(window.location.search);
  if (params.size > 0 && params.get('vf') !== String(FILTER_STORAGE_VERSION)) {
    return {};
  }

  return {
    farmFilter: params.get('fazenda') || undefined,
    yearFilter: params.get('ano') || undefined,
    monthFilter: params.get('mes') || undefined,
    cycleFilter: params.get('ciclo') || undefined,
    evaluatorFilter: params.get('fiscal') || params.get('avaliador') || undefined,
    sourceFilter: params.get('fonte') || undefined,
    searchTerm: params.get('busca') || undefined,
    dateFrom: params.get('dataInicio') || params.get('de') || undefined,
    dateTo: params.get('dataFim') || params.get('ate') || undefined,
  };
}

function compactFilters(filters) {
  const rawYearFilter = String(filters.yearFilter || '');
  const yearFilter = rawYearFilter === 'all' || /^\d{4}$/.test(rawYearFilter) ? rawYearFilter : 'all';
  const monthFilter = VALID_MONTHS.has(String(filters.monthFilter || '')) ? String(filters.monthFilter) : 'all';
  const defaultRange = monthDateRange(yearFilter, monthFilter);
  let dateFrom = isDateInputValue(filters.dateFrom) ? String(filters.dateFrom) : defaultRange.from;
  let dateTo = isDateInputValue(filters.dateTo) ? String(filters.dateTo) : defaultRange.to;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    [dateFrom, dateTo] = [dateTo, dateFrom];
  }

  return {
    farmFilter: filters.farmFilter || 'all',
    yearFilter,
    monthFilter,
    cycleFilter: filters.cycleFilter || 'all',
    evaluatorFilter: filters.evaluatorFilter || 'all',
    sourceFilter: VALID_SOURCE_FILTERS.has(String(filters.sourceFilter || '')) ? String(filters.sourceFilter) : 'all',
    searchTerm: filters.searchTerm || '',
    dateFrom,
    dateTo,
  };
}

function initialFilters() {
  return compactFilters({
    ...readStoredFilters(),
    ...searchFilters(),
  });
}

function readStoredUserSession() {
  try {
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    const session = JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    if (!session?.profile || Number(session.expiresAt || 0) <= Date.now()) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return session.profile;
  } catch {
    return null;
  }
}

function writeUserSession(profile) {
  const serverExpiresAt = Date.parse(profile?.sessionExpiresAt || '');
  const session = {
    profile,
    expiresAt: Number.isFinite(serverExpiresAt) ? serverExpiresAt : Date.now() + AUTH_SESSION_TTL_MS,
  };
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

function clearUserSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

function getStoredSessionExpiresAt() {
  try {
    const session = JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    return Number(session?.expiresAt || 0);
  } catch {
    return 0;
  }
}

function buildSearch(filters) {
  const params = new URLSearchParams();
  if (filters.farmFilter !== 'all') params.set('fazenda', filters.farmFilter);
  if (filters.yearFilter && filters.yearFilter !== 'all') params.set('ano', filters.yearFilter);
  if (filters.monthFilter && filters.monthFilter !== 'all') params.set('mes', filters.monthFilter);
  if (filters.cycleFilter !== 'all') params.set('ciclo', filters.cycleFilter);
  if (filters.evaluatorFilter !== 'all') params.set('fiscal', filters.evaluatorFilter);
  if (filters.sourceFilter !== 'all') params.set('fonte', filters.sourceFilter);
  if (filters.searchTerm) params.set('busca', filters.searchTerm);
  if (filters.dateFrom) params.set('dataInicio', filters.dateFrom);
  if (filters.dateTo) params.set('dataFim', filters.dateTo);
  if (params.size === 0) return '';
  params.set('vf', String(FILTER_STORAGE_VERSION));
  return `?${params.toString()}`;
}

function filtersForRoute(filters, routeId) {
  const visibleFilters = new Set(getRouteFilterIds(routeId));
  const routeFilters = {
    farmFilter: visibleFilters.has('farm') ? filters.farmFilter : 'all',
    yearFilter: visibleFilters.has('year') ? filters.yearFilter : '',
    monthFilter: visibleFilters.has('month') ? filters.monthFilter : 'all',
    cycleFilter: visibleFilters.has('cycle') ? filters.cycleFilter : 'all',
    evaluatorFilter: visibleFilters.has('evaluator') ? filters.evaluatorFilter : 'all',
    sourceFilter: visibleFilters.has('source') ? filters.sourceFilter : 'all',
    searchTerm: visibleFilters.has('search') ? filters.searchTerm : '',
    dateFrom: visibleFilters.has('dateRange') ? filters.dateFrom : '',
    dateTo: visibleFilters.has('dateRange') ? filters.dateTo : '',
  };

  if (routeId !== 'cqo-rampa' && routeFilters.sourceFilter === 'sql') {
    routeFilters.sourceFilter = 'all';
  }

  return routeFilters;
}

function PageFallback() {
  return (
    <div className="empty-state page-loading-state">
      <div className="spinner-modern"></div>
      <p>Carregando modulo...</p>
    </div>
  );
}

function TvModeOverlay({
  activeTvPage,
  setActiveTvPage,
  closeTvMode,
  commonProps,
}) {
  const currentLabel = activeTvPage === 'campo' ? 'CQO Campo' : 'CQO Rampa';

  return createPortal(
    <div className="tv-mode-overlay" role="dialog" aria-modal="true" aria-label="Modo TV do dashboard">
      <div className="tv-mode-toolbar">
        <div>
          <span>Modo TV automático</span>
          <strong>{currentLabel}</strong>
        </div>
        <div className="tv-mode-tabs">
          <button type="button" className={activeTvPage === 'campo' ? 'active' : ''} onClick={() => setActiveTvPage('campo')}>Campo</button>
          <button type="button" className={activeTvPage === 'rampa' ? 'active' : ''} onClick={() => setActiveTvPage('rampa')}>Rampa</button>
        </div>
        <button type="button" className="presentation-close-btn" onClick={closeTvMode} title="Fechar modo TV" aria-label="Fechar modo TV">
          <X size={21} />
        </button>
      </div>

      <Suspense fallback={<PageFallback />}>
        <div className="tv-mode-content">
          {activeTvPage === 'campo' ? (
            <Dashboard
              {...commonProps}
              areaFilter="corte"
            />
          ) : (
            <CqoRampa
              farmFilter={commonProps.farmFilter}
              periodFilter={commonProps.periodFilter}
              dateFrom={commonProps.dateFrom}
              dateTo={commonProps.dateTo}
              sourceFilter={commonProps.sourceFilter === 'app' ? 'all' : commonProps.sourceFilter}
            />
          )}
        </div>
      </Suspense>
    </div>,
    document.body
  );
}

function MapPresentationOverlay({ closeMapPresentation, commonProps }) {
  return createPortal(
    <div className="presentation-overlay map-presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentação do mapa operacional">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={closeMapPresentation} title="Fechar apresentação" aria-label="Fechar apresentação">
        <X size={21} />
      </button>
      <div className="map-presentation-shell">
        <div className="map-presentation-header">
          <img src="/logo.png" alt="Vila Nova Agroindustrial" />
          <div>
            <span>Georreferenciamento CQO</span>
            <h2>Mapa Operacional Integrado</h2>
            <p>Parcelas, risco por amostragem, GPS do app e fonte Excel/App dentro dos filtros atuais.</p>
          </div>
        </div>
        <div className="map-presentation-frame">
          <Suspense fallback={<PageFallback />}>
            <LeafletMap {...commonProps} presentationMode />
          </Suspense>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function App() {
  const bootFilters = useMemo(() => initialFilters(), []);
  const [activePage, setActivePage] = useState(() => pageFromPath(window.location.pathname));
  const [theme, setTheme] = useState(() => localStorage.getItem('vilanova_dashboard_theme') || 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('vilanova_sidebar_collapsed') === 'true');
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem('vilanova_sidebar_width') || 280);
    return Number.isFinite(savedWidth) ? Math.min(340, Math.max(220, savedWidth)) : 280;
  });
  const [user, setUser] = useState(() => {
    const storedUser = readStoredUserSession();
    setCqoSessionToken(storedUser?.sessionToken);
    return storedUser;
  });
  const accessiblePages = useMemo(() => accessiblePagesForUser(user), [user]);
  const effectiveActivePage = accessiblePages.has(activePage) ? activePage : DEFAULT_PAGE_ID;
  const visibleHeaderFilters = useMemo(() => getRouteFilterIds(effectiveActivePage), [effectiveActivePage]);

  const [farmFilter, setFarmFilter] = useState(bootFilters.farmFilter);
  const [areaFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(bootFilters.yearFilter);
  const [monthFilter, setMonthFilter] = useState(bootFilters.monthFilter);
  const [dateFrom, setDateFrom] = useState(bootFilters.dateFrom);
  const [dateTo, setDateTo] = useState(bootFilters.dateTo);
  const [cycleFilter, setCycleFilter] = useState(bootFilters.cycleFilter);
  const [evaluatorFilter, setEvaluatorFilter] = useState(bootFilters.evaluatorFilter);
  const [sourceFilter, setSourceFilter] = useState(bootFilters.sourceFilter);
  const [searchTerm, setSearchTerm] = useState(bootFilters.searchTerm);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tvModeOpen, setTvModeOpen] = useState(false);
  const [mapPresentationOpen, setMapPresentationOpen] = useState(false);
  const [activeTvPage, setActiveTvPage] = useState('campo');
  const [lastSyncTime, setLastSyncTime] = useState(() => (
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  ));
  const periodFilter = 'custom';

  const resetFieldFilters = () => {
    setFarmFilter('all');
    setYearFilter('all');
    setMonthFilter('all');
    setDateFrom('');
    setDateTo('');
    setCycleFilter('all');
    setEvaluatorFilter('all');
    setSourceFilter('all');
    setSearchTerm('');
  };

  const activeFilters = useMemo(() => compactFilters({
    farmFilter,
    yearFilter,
    monthFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    searchTerm,
    dateFrom,
    dateTo,
  }), [farmFilter, yearFilter, monthFilter, cycleFilter, evaluatorFilter, sourceFilter, searchTerm, dateFrom, dateTo]);
  const fieldSourceFilter = sourceFilter === 'sql' ? 'all' : sourceFilter;
  const commonDashboardProps = {
    theme,
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter: fieldSourceFilter,
    dateFrom: activeFilters.dateFrom,
    dateTo: activeFilters.dateTo,
    searchTerm,
    onResetFilters: resetFieldFilters,
    lastSyncTime,
  };

  const applyYearFilter = (nextYear) => {
    setYearFilter(nextYear);
    const nextMonth = nextYear === 'all' ? 'all' : monthFilter;
    setMonthFilter(nextMonth);
    const range = monthDateRange(nextYear, nextMonth);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const applyMonthFilter = (nextMonth) => {
    const effectiveMonth = yearFilter === 'all' ? 'all' : nextMonth;
    setMonthFilter(effectiveMonth);
    const range = monthDateRange(yearFilter, effectiveMonth);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const applyDateFrom = (nextDate) => {
    setDateFrom(nextDate);
    if (nextDate && dateTo && nextDate > dateTo) {
      setDateTo(nextDate);
    }
  };

  const applyDateTo = (nextDate) => {
    setDateTo(nextDate);
    if (nextDate && dateFrom && nextDate < dateFrom) {
      setDateFrom(nextDate);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vilanova_dashboard_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('vilanova_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('vilanova_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      ...activeFilters,
      __version: FILTER_STORAGE_VERSION,
    }));
    const routeFilters = filtersForRoute(activeFilters, effectiveActivePage);
    const nextPath = `${pathFromPage(effectiveActivePage)}${buildSearch(routeFilters)}`;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== nextPath) {
      const method = window.location.pathname !== pathFromPage(effectiveActivePage) ? 'pushState' : 'replaceState';
      window.history[method]({ activePage: effectiveActivePage, filters: activeFilters }, '', nextPath);
    }
  }, [effectiveActivePage, activeFilters]);

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(pageFromPath(window.location.pathname));
      const nextFilters = compactFilters({
        ...readStoredFilters(),
        ...searchFilters(),
      });
      setFarmFilter(nextFilters.farmFilter);
      setYearFilter(nextFilters.yearFilter);
      setMonthFilter(nextFilters.monthFilter);
      setDateFrom(nextFilters.dateFrom);
      setDateTo(nextFilters.dateTo);
      setCycleFilter(nextFilters.cycleFilter);
      setEvaluatorFilter(nextFilters.evaluatorFilter);
      setSourceFilter(nextFilters.sourceFilter);
      setSearchTerm(nextFilters.searchTerm);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const startSidebarResize = (event) => {
    if (sidebarCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handleMove = (moveEvent) => {
      const nextWidth = Math.min(340, Math.max(220, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(nextWidth);
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.classList.remove('sidebar-resizing');
    };

    document.body.classList.add('sidebar-resizing');
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleLogin = (profile) => {
    setCqoSessionToken(profile?.sessionToken);
    writeUserSession(profile);
    setUser(profile);
  };

  const expireLocalSession = useCallback(() => {
    setCqoSessionToken('');
    clearUserSession();
    setUser(null);
    setActivePage(DEFAULT_PAGE_ID);
    window.history.replaceState({ activePage: DEFAULT_PAGE_ID }, '', pathFromPage(DEFAULT_PAGE_ID));
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => expireLocalSession();
    window.addEventListener(DASHBOARD_SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(DASHBOARD_SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, [expireLocalSession]);

  const handleLogout = () => {
    const sessionToken = user?.sessionToken;
    expireLocalSession();
    logoutDashboardSession(sessionToken).catch((error) => {
      devWarn('Nao foi possivel revogar a sessao no Supabase:', error.message);
    });
  };

  const sessionToken = user?.sessionToken;

  useEffect(() => {
    if (!user) return undefined;
    const expiresAt = getStoredSessionExpiresAt();
    const delay = Math.max(0, expiresAt - Date.now());

    const timer = window.setTimeout(() => {
      expireLocalSession();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [expireLocalSession, user]);

  useEffect(() => {
    if (!sessionToken) return undefined;
    let cancelled = false;

    const validateSession = async () => {
      try {
        const refreshedProfile = await refreshDashboardSession(sessionToken);
        if (cancelled) return;
        if (!refreshedProfile) {
          expireLocalSession();
          return;
        }
        const nextUser = { ...refreshedProfile, sessionToken };
        setCqoSessionToken(sessionToken);
        writeUserSession(nextUser);
        setUser((current) => (
          current?.sessionToken === sessionToken ? nextUser : current
        ));
      } catch (error) {
        if (isDashboardSessionExpiredError(error)) {
          expireLocalSession();
          return;
        }
        devWarn('Nao foi possivel validar a sessao no Supabase:', error.message);
      }
    };

    validateSession();
    const interval = window.setInterval(validateSession, 5 * 60 * 1000);
    const validateOnFocus = () => validateSession();
    const validateOnVisible = () => {
      if (document.visibilityState === 'visible') validateSession();
    };

    window.addEventListener('focus', validateOnFocus);
    document.addEventListener('visibilitychange', validateOnVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', validateOnFocus);
      document.removeEventListener('visibilitychange', validateOnVisible);
    };
  }, [expireLocalSession, sessionToken]);

  const triggerManualSync = () => {
    setIsSyncing(true);
    refreshCqoData()
      .catch((err) => devError('Manual sync failed:', err))
      .finally(() => {
        setIsSyncing(false);
        setLastSyncTime(new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }));
      });
  };

  useEffect(() => {
    if (!tvModeOpen) return undefined;
    document.body.classList.add('presentation-active');
    const timer = setInterval(() => {
      setActiveTvPage((current) => current === 'campo' ? 'rampa' : 'campo');
    }, 30000);
    return () => {
      clearInterval(timer);
      document.body.classList.remove('presentation-active');
    };
  }, [tvModeOpen]);

  const openTvMode = () => {
    setTvModeOpen(true);
    setActiveTvPage(activePage === 'cqo-rampa' ? 'rampa' : 'campo');
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const closeTvMode = () => {
    setTvModeOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    if (!mapPresentationOpen) return undefined;
    document.body.classList.add('presentation-active');
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMapPresentationOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('presentation-active');
    };
  }, [mapPresentationOpen]);

  const openMapPresentation = () => {
    setMapPresentationOpen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const closeMapPresentation = () => {
    setMapPresentationOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const renderActivePage = () => {
    switch (effectiveActivePage) {
      case 'dashboard':
        return (
          <Dashboard
            {...commonDashboardProps}
            areaFilter="corte"
            setDateFrom={applyDateFrom}
            setDateTo={applyDateTo}
          />
        );
      case 'cqo-carreamento':
        return (
          <Analytics
            farmFilter={farmFilter}
            areaFilter="carreamento"
            periodFilter={periodFilter}
            cycleFilter={cycleFilter}
            evaluatorFilter={evaluatorFilter}
            sourceFilter={fieldSourceFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        );
      case 'perdas-agricola':
        return (
          <LossesAgricola
            {...commonDashboardProps}
            areaFilter={areaFilter}
          />
        );
      case 'cqo-rampa':
        return (
          <CqoRampa
            farmFilter={farmFilter}
            periodFilter={periodFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            sourceFilter={sourceFilter === 'app' ? 'all' : sourceFilter}
          />
        );
      case 'coletas':
        return (
          <Collections
            farmFilter={farmFilter}
            areaFilter={areaFilter}
            periodFilter={periodFilter}
            cycleFilter={cycleFilter}
            evaluatorFilter={evaluatorFilter}
            sourceFilter={fieldSourceFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            searchTerm={searchTerm}
            user={user}
          />
        );
      case 'inventario':
        return (
          <Inventory
            farmFilter={farmFilter}
            searchTerm={searchTerm}
          />
        );
      case 'sync':
        return (
          <SyncCenter
            lastSyncTime={lastSyncTime}
            isSyncing={isSyncing}
            triggerManualSync={triggerManualSync}
          />
        );
      case 'colaboradores':
        return <Collaborators user={user} />;
      case 'desenvolvimento':
        return <Development />;
      case 'config':
        return (
          <Settings
            theme={theme}
            setTheme={setTheme}
            user={user}
            onLogout={handleLogout}
            triggerManualSync={triggerManualSync}
            isSyncing={isSyncing}
          />
        );
      case 'mapa':
        return (
          <div className="fade-in page-shell map-page-shell gps-page">
            <div className="page-header gps-map-commandbar">
              <div className="page-title-block">
                <span className="page-eyebrow">Georreferenciamento</span>
                <h2>Mapa Operacional Integrado</h2>
                <p>Parcelas, semáforo, risco por amostragem e GPS do app nos filtros atuais.</p>
              </div>
              <button type="button" className="gps-present-btn" onClick={openMapPresentation}>
                <MonitorPlay size={17} />
                Apresentar
              </button>
            </div>
            <div className="map-frame">
              <LeafletMap
                {...commonDashboardProps}
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="empty-state">
            <h2>Em Desenvolvimento</h2>
            <p>Este modulo esta em fase final de homologacao tecnica.</p>
          </div>
        );
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        activePage={effectiveActivePage}
        setActivePage={setActivePage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        width={sidebarCollapsed ? 76 : sidebarWidth}
        visiblePageIds={accessiblePages}
      />
      <button
        type="button"
        className="sidebar-resize-handle"
        onMouseDown={startSidebarResize}
        onDoubleClick={() => setSidebarCollapsed((current) => !current)}
        title={sidebarCollapsed ? 'Expandir menu' : 'Arrastar para ajustar largura'}
        aria-label="Ajustar largura do menu"
      />
      <div className="app-main">
        <Header
          farmFilter={farmFilter}
          setFarmFilter={setFarmFilter}
          yearFilter={yearFilter}
          setYearFilter={applyYearFilter}
          monthFilter={monthFilter}
          setMonthFilter={applyMonthFilter}
          dateFrom={dateFrom}
          setDateFrom={applyDateFrom}
          dateTo={dateTo}
          setDateTo={applyDateTo}
          cycleFilter={cycleFilter}
          setCycleFilter={setCycleFilter}
          evaluatorFilter={evaluatorFilter}
          setEvaluatorFilter={setEvaluatorFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          activePage={effectiveActivePage}
          visibleFilters={visibleHeaderFilters}
          theme={theme}
          setTheme={setTheme}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          lastSyncTime={lastSyncTime}
          isSyncing={isSyncing}
          triggerManualSync={triggerManualSync}
          user={user}
          onLogout={handleLogout}
          onOpenTvMode={openTvMode}
          onResetFilters={resetFieldFilters}
        />
        <main className="app-content">
          <Suspense fallback={<PageFallback />}>
            {renderActivePage()}
          </Suspense>
        </main>
        {tvModeOpen && (
          <TvModeOverlay
            activeTvPage={activeTvPage}
            setActiveTvPage={setActiveTvPage}
            closeTvMode={closeTvMode}
            commonProps={commonDashboardProps}
          />
        )}
        {mapPresentationOpen && (
          <MapPresentationOverlay
            closeMapPresentation={closeMapPresentation}
            commonProps={commonDashboardProps}
          />
        )}
        <footer className="app-developer-footer">
          <span>Vila Nova Agroindustrial - Dashboard CQO</span>
        </footer>
      </div>
    </div>
  );
}
