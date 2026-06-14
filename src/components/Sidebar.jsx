import React from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Map,
  RefreshCw,
  Settings,
  Tractor,
  Users,
} from 'lucide-react';

export default function Sidebar({ activePage, setActivePage, collapsed, setCollapsed, width }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard CQO', icon: LayoutDashboard },
    { id: 'coletas', label: 'Coletas recebidas', icon: Tractor },
    { id: 'inventario', label: 'Inventário parcelas', icon: FileSpreadsheet },
    { id: 'formularios', label: 'Modelos de formulários', icon: ClipboardList },
    { id: 'mapa', label: 'Mapa GPS', icon: Map },
    { id: 'bi', label: 'Indicadores', icon: BarChart3 },
    { id: 'sync', label: 'Sincronizações', icon: RefreshCw },
    { id: 'colaboradores', label: 'Colaboradores', icon: Users },
    { id: 'config', label: 'Configurações', icon: Settings },
  ];

  const handleItemClick = (item) => {
    setActivePage(item.id);
  };

  return (
    <aside
      className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}
      style={{ width }}
    >
      <div className="sidebar-brand">
        <div className="sidebar-logo-container">
          <img src={collapsed ? "/favicon.svg" : "/logo.png"} alt="Vila Nova Agroindustrial" className="sidebar-logo" />
        </div>
        <div className="sidebar-brand-info">
          <h1 className="sidebar-brand-name">Vila Nova</h1>
          <p className="sidebar-brand-sub">Qualidade Agrícola</p>
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-avatar">CQ</div>
        <div className="sidebar-footer-info">
          <span className="sidebar-footer-name">Central CQO</span>
          <span className="sidebar-footer-role">Corte / Carreamento</span>
        </div>
      </div>
    </aside>
  );
}
