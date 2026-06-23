import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SIDEBAR_GROUPS, getRouteById } from '../config/routeConfig';

export default function Sidebar({ activePage, setActivePage, collapsed, setCollapsed, width, visiblePageIds }) {
  const isVisible = (pageId) => !visiblePageIds || visiblePageIds.has(pageId);
  const visibleGroups = SIDEBAR_GROUPS
    .map((group) => ({
      ...group,
      items: group.itemIds.map(getRouteById).filter((item) => isVisible(item.id)),
    }))
    .filter((group) => group.items.length > 0);

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
        {visibleGroups.map((group) => {
          if (!group.label) {
            return group.items.map((item) => {
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
            });
          }

          const GroupIcon = group.icon;
          const isGroupActive = group.items.some((item) => item.id === activePage);

          return (
            <div className={`sidebar-module-group ${isGroupActive ? 'active' : ''}`} key={group.id}>
              <div className="sidebar-module-heading" title={group.label} aria-label={group.label}>
                <GroupIcon />
                <span>{group.label}</span>
              </div>
              <div className="sidebar-submenu">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`sidebar-submenu-item ${isActive ? 'active' : ''}`}
                      title={item.label}
                      aria-label={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
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
