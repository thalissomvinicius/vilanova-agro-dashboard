import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import CqoRampa from './pages/CqoRampa';
import Bonificacao from './pages/Bonificacao';
import Collections from './pages/Collections';
import SyncCenter from './pages/SyncCenter';
import Collaborators from './pages/Collaborators';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Login from './pages/Login';
import LeafletMap from './components/LeafletMap';
import { refreshCqoData } from './utils/cqoData';

const PAGE_ROUTES = {
  dashboard: '/campo',
  'cqo-rampa': '/rampa',
  bonificacao: '/bonificacao',
  coletas: '/coletas',
  inventario: '/inventario',
  mapa: '/mapa',
  sync: '/sincronizacoes',
  colaboradores: '/colaboradores',
  config: '/configuracoes',
};

const ROUTE_PAGES = Object.fromEntries(
  Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page])
);

function pageFromPath(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return ROUTE_PAGES[normalized] || 'dashboard';
}

function pathFromPage(page) {
  return PAGE_ROUTES[page] || PAGE_ROUTES.dashboard;
}

export default function App() {
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

  const [farmFilter, setFarmFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('month');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() => (
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  ));

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
    const nextPath = pathFromPage(activePage);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ activePage }, '', nextPath);
    }
  }, [activePage]);

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(pageFromPath(window.location.pathname));
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

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard
            theme={theme}
            farmFilter={farmFilter}
            areaFilter={areaFilter}
            periodFilter={periodFilter}
            cycleFilter={cycleFilter}
            evaluatorFilter={evaluatorFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            searchTerm={searchTerm}
          />
        );
      case 'cqo-rampa':
        return (
          <CqoRampa
            farmFilter={farmFilter}
            periodFilter={periodFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        );
      case 'bonificacao':
        return <Bonificacao />;
      case 'coletas':
        return (
          <Collections
            farmFilter={farmFilter}
            areaFilter={areaFilter}
            periodFilter={periodFilter}
            cycleFilter={cycleFilter}
            evaluatorFilter={evaluatorFilter}
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
          <div className="fade-in page-shell map-page-shell">
            <div className="page-header">
              <div className="page-title-block">
                <span className="page-eyebrow">Georreferenciamento</span>
                <h2>Mapa Operacional Integrado</h2>
                <p>Visualizacao geoespacial das areas produtivas de palma, rotas e ocorrencias recebidas do app.</p>
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
          areaFilter={areaFilter}
          setAreaFilter={setAreaFilter}
          periodFilter={periodFilter}
          setPeriodFilter={setPeriodFilter}
          cycleFilter={cycleFilter}
          setCycleFilter={setCycleFilter}
          evaluatorFilter={evaluatorFilter}
          setEvaluatorFilter={setEvaluatorFilter}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          theme={theme}
          setTheme={setTheme}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          lastSyncTime={lastSyncTime}
          isSyncing={isSyncing}
          triggerManualSync={triggerManualSync}
          user={user}
          onLogout={handleLogout}
        />
        <main className="app-content">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}
