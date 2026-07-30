import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SIDEBAR_GROUPS, getRouteById } from '../config/routeConfig';

function userInitials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'VN';
  return `${parts[0]?.[0] || ''}${parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''}`.toUpperCase();
}

export default function Sidebar({
  activePage,
  setActivePage,
  collapsed,
  setCollapsed,
  width,
  visiblePageIds,
  user,
  mobileOpen = false,
  onMobileClose,
}) {
  const isVisible = (pageId) => !visiblePageIds || visiblePageIds.has(pageId);
  const visibleGroups = SIDEBAR_GROUPS
    .map((group) => ({
      ...group,
      items: group.itemIds.map(getRouteById).filter((item) => isVisible(item.id)),
    }))
    .filter((group) => group.items.length > 0);

  const handleItemClick = (item) => {
    setActivePage(item.id);
    onMobileClose?.();
  };
  const userName = user?.nome || 'Usuário CQO';
  const userMeta = user?.matricula ? `Mat. ${user.matricula}` : 'Sessão ativa';
  const userRole = user?.cargo || user?.departamento || user?.role || 'Qualidade agrícola';

  return (
    <>
      <button
        type="button"
        className={`sidebar-mobile-backdrop ${mobileOpen ? 'is-visible' : ''}`}
        onClick={onMobileClose}
        aria-label="Fechar navegação"
        tabIndex={mobileOpen ? 0 : -1}
      />
    <aside
      id="app-sidebar"
      className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      style={{ width }}
    >
      <div className="sidebar-brand">
        <div className="sidebar-logo-container">
          <img src="/logo.png" alt="Vila Nova Agroindustrial" className="sidebar-logo" />
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
        <button
          type="button"
          className="sidebar-mobile-close-btn"
          onClick={onMobileClose}
          title="Fechar navegação"
          aria-label="Fechar navegação"
        >
          <X />
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
                  aria-current={isActive ? 'page' : undefined}
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
                      aria-current={isActive ? 'page' : undefined}
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

      <div className="sidebar-footer" title={`${userName} - ${userMeta}`}>
        <div className="sidebar-footer-avatar">{userInitials(userName)}</div>
        <div className="sidebar-footer-info">
          <span className="sidebar-footer-name">{userName}</span>
          <span className="sidebar-footer-role">{userMeta}</span>
          <span className="sidebar-footer-role sidebar-footer-role-secondary">{userRole}</span>
        </div>
      </div>
    </aside>
    </>
  );
}
