import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers3, MapPinned, Route, Satellite, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import CqoRampa from './pages/CqoRampa';
import LossesAgricola from './pages/LossesAgricola';
import Collections from './pages/Collections';
import SyncCenter from './pages/SyncCenter';
import Collaborators from './pages/Collaborators';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Development from './pages/Development';
import LeafletMap from './components/LeafletMap';
import { refreshCqoData } from './utils/cqoData';

const PAGE_ROUTES = {
  dashboard: '/campo',
  'cqo-carreamento': '/carreamento',
  'perdas-agricola': '/perdas',
  'cqo-rampa': '/rampa',
  coletas: '/coletas',
  inventario: '/inventario',
  mapa: '/mapa',
  desenvolvimento: '/desenvolvimento',
  sync: '/sincronizacoes',
  colaboradores: '/colaboradores',
  config: '/configuracoes',
};

const ROUTE_PAGES = Object.fromEntries(
  Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page])
);

const FILTER_STORAGE_KEY = 'vilanova_dashboard_filters';
const VALID_MONTHS = new Set(['all', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
const VALID_SOURCE_FILTERS = new Set(['all', 'app', 'excel', 'sql']);

function currentMonthValue() {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

function monthDateRange(yearValue, monthValue) {
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
  return ROUTE_PAGES[normalized] || 'dashboard';
}

function pathFromPage(page) {
  return PAGE_ROUTES[page] || PAGE_ROUTES.dashboard;
}

function readStoredFilters() {
  try {
    return JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function searchFilters() {
  const params = new URLSearchParams(window.location.search);
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
  const currentYear = String(new Date().getFullYear());
  const currentMonth = currentMonthValue();
  const yearFilter = /^\d{4}$/.test(String(filters.yearFilter || '')) ? String(filters.yearFilter) : currentYear;
  const monthFilter = VALID_MONTHS.has(String(filters.monthFilter || '')) ? String(filters.monthFilter) : currentMonth;
  const defaultRange = monthDateRange(yearFilter, monthFilter);
  let dateFrom = isDateInputValue(filters.dateFrom) ? String(filters.dateFrom) : defaultRange.from;
  let dateTo = isDateInputValue(filters.dateTo) ? String(filters.dateTo) : defaultRange.to;

  if (dateFrom > dateTo) {
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

function buildSearch(filters) {
  const params = new URLSearchParams();
  if (filters.farmFilter !== 'all') params.set('fazenda', filters.farmFilter);
  if (filters.yearFilter) params.set('ano', filters.yearFilter);
  if (filters.monthFilter) params.set('mes', filters.monthFilter);
  if (filters.cycleFilter !== 'all') params.set('ciclo', filters.cycleFilter);
  if (filters.evaluatorFilter !== 'all') params.set('fiscal', filters.evaluatorFilter);
  if (filters.sourceFilter !== 'all') params.set('fonte', filters.sourceFilter);
  if (filters.searchTerm) params.set('busca', filters.searchTerm);
  if (filters.dateFrom) params.set('dataInicio', filters.dateFrom);
  if (filters.dateTo) params.set('dataFim', filters.dateTo);
  const query = params.toString();
  return query ? `?${query}` : '';
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
      <div className="developer-signature tv-mode-signature">Desenvolvedor: Vinicius Dev.</div>
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
    try {
      return JSON.parse(localStorage.getItem('vilanova_dashboard_user') || 'null');
    } catch {
      return null;
    }
  });
  
  const [isAppLoading, setIsAppLoading] = useState(() => {
    return !!localStorage.getItem('vilanova_dashboard_user');
  });

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
  const [activeTvPage, setActiveTvPage] = useState('campo');
  const [lastSyncTime, setLastSyncTime] = useState(() => (
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  ));
  const periodFilter = 'custom';
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
    lastSyncTime,
  };

  const applyYearFilter = (nextYear) => {
    setYearFilter(nextYear);
    const range = monthDateRange(nextYear, monthFilter);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const applyMonthFilter = (nextMonth) => {
    setMonthFilter(nextMonth);
    const range = monthDateRange(yearFilter, nextMonth);
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
    if (isAppLoading) {
      const timer = setTimeout(() => setIsAppLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isAppLoading]);

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
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(activeFilters));
    const routeFilters = activePage === 'cqo-rampa'
      ? activeFilters
      : { ...activeFilters, sourceFilter: activeFilters.sourceFilter === 'sql' ? 'all' : activeFilters.sourceFilter };
    const nextPath = `${pathFromPage(activePage)}${buildSearch(routeFilters)}`;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== nextPath) {
      const method = window.location.pathname !== pathFromPage(activePage) ? 'pushState' : 'replaceState';
      window.history[method]({ activePage, filters: activeFilters }, '', nextPath);
    }
  }, [activePage, activeFilters]);

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
    localStorage.setItem('vilanova_dashboard_user', JSON.stringify(profile));
    setIsAppLoading(true);
    setUser(profile);
  };

  const handleLogout = () => {
    localStorage.removeItem('vilanova_dashboard_user');
    setUser(null);
    setActivePage('dashboard');
    window.history.replaceState({ activePage: 'dashboard' }, '', pathFromPage('dashboard'));
  };

  const triggerManualSync = () => {
    setIsSyncing(true);
    refreshCqoData()
      .catch((err) => console.error("Manual sync failed:", err))
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

  const renderActivePage = () => {
    switch (activePage) {
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
        return <Collaborators />;
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
            <div className="page-header operational-hero gps-hero">
              <div className="page-title-block">
                <span className="page-eyebrow">Georreferenciamento</span>
                <h2>Mapa Operacional Integrado</h2>
                <p>Visualizacao geoespacial das areas produtivas de palma, rotas e ocorrencias recebidas do app.</p>
              </div>
              <div className="gps-hero-grid">
                <div><MapPinned size={18} /><span>Parcelas</span><strong>Mapa CQO</strong></div>
                <div><Layers3 size={18} /><span>Camadas</span><strong>Semáforo</strong></div>
                <div><Route size={18} /><span>Rotas</span><strong>GPS app</strong></div>
                <div><Satellite size={18} /><span>Base</span><strong>OSM/CARTO</strong></div>
              </div>
            </div>
            <div className="map-frame">
              <LeafletMap
                theme={theme}
                farmFilter={farmFilter}
                areaFilter={areaFilter}
                periodFilter={periodFilter}
                cycleFilter={cycleFilter}
                evaluatorFilter={evaluatorFilter}
                sourceFilter={fieldSourceFilter}
                dateFrom={dateFrom}
                dateTo={dateTo}
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

  if (isAppLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-content fade-in">
          <img src="/logo.png" alt="Vila Nova" className="app-loading-logo pulse-animation" />
          <div className="spinner-modern"></div>
          <h2>Autenticação confirmada</h2>
          <p>Carregando base de dados do Supabase e sincronizando tabelas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        width={sidebarCollapsed ? 76 : sidebarWidth}
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
          activePage={activePage}
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
        />
        <main className="app-content">
          {renderActivePage()}
        </main>
        {tvModeOpen && (
          <TvModeOverlay
            activeTvPage={activeTvPage}
            setActiveTvPage={setActiveTvPage}
            closeTvMode={closeTvMode}
            commonProps={commonDashboardProps}
          />
        )}
        <footer className="app-developer-footer">
          <span>Vila Nova Agroindustrial - Dashboard CQO</span>
          <span className="app-developer-signature">Desenvolvedor: <strong>Vinicius Dev.</strong></span>
        </footer>
      </div>
    </div>
  );
}
