import React, { useState } from 'react';
import { Bell, LogOut, Moon, RefreshCw, Search, Sun } from 'lucide-react';
import { CQO_AREAS, CQO_FARMS } from '../utils/cqoData';

export default function Header({
  farmFilter,
  setFarmFilter,
  areaFilter,
  setAreaFilter,
  periodFilter,
  setPeriodFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  theme,
  setTheme,
  searchTerm,
  setSearchTerm,
  lastSyncTime,
  isSyncing,
  triggerManualSync,
  user,
  onLogout,
}) {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, text: 'Dashboard preparado para ler coletas CQO do Supabase.', time: 'Agora' },
    { id: 2, text: 'Filtros alinhados aos formularios Corte e Carreamento.', time: 'Hoje' },
    { id: 3, text: 'GPS e acompanhamento serao exibidos por registro.', time: 'Hoje' },
  ];

  return (
    <header className="app-header">
      <div className="header-left">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="header-brand-logo" />

        <div className="header-search">
          <Search />
          <input
            type="text"
            placeholder="Buscar por fazenda, matricula, parcela ou fiscal"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

      </div>

      <div className="header-filters">
        <select
          className="header-filter-select"
          value={farmFilter}
          onChange={(event) => setFarmFilter(event.target.value)}
          title="Selecionar fazenda"
        >
          {CQO_FARMS.map((farm) => (
            <option key={farm.id} value={farm.id}>{farm.name}</option>
          ))}
        </select>

        <select
          className="header-filter-select"
          value={areaFilter}
          onChange={(event) => setAreaFilter(event.target.value)}
          title="Selecionar formulario"
        >
          {CQO_AREAS.map((area) => (
            <option key={area.id} value={area.id}>{area.name}</option>
          ))}
        </select>

        <select
          className="header-filter-select"
          value={periodFilter}
          onChange={(event) => {
            setPeriodFilter(event.target.value);
            if (event.target.value !== 'custom') {
              setDateFrom('');
              setDateTo('');
            }
          }}
          title="Periodo"
        >
          <option value="today">Hoje</option>
          <option value="week">Ultimos 7 dias</option>
          <option value="month">Este mes</option>
          <option value="custom">De data ate data</option>
          <option value="season">Safra / historico</option>
        </select>

        <input
          className="header-date-input"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPeriodFilter('custom');
          }}
          title="Data inicial"
        />

        <input
          className="header-date-input"
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPeriodFilter('custom');
          }}
          title="Data final"
        />
      </div>

      <div className="header-right">
        <div className="header-sync-status">
          <div className={`sync-dot ${isSyncing ? 'pulse' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : `Atualizado: ${lastSyncTime}`}</span>
          <button
            onClick={triggerManualSync}
            className="header-btn"
            style={{ width: '28px', height: '28px', border: 'none', marginLeft: '6px' }}
            title="Atualizar dados"
            disabled={isSyncing}
          >
            <RefreshCw className={isSyncing ? 'spin' : ''} style={{ width: '14px', height: '14px' }} />
          </button>
        </div>

        <div className="header-actions">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="header-btn"
            title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="header-btn"
              title="Avisos"
            >
              <Bell size={18} />
              <span className="header-badge" />
            </button>

            {showNotifications && (
              <div
                className="card fade-in header-notifications"
                style={{
                  position: 'absolute',
                  top: '48px',
                  right: '0',
                  zIndex: '500',
                  padding: '16px',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.875rem' }}>Avisos do painel</span>
                  <button className="link-button" onClick={() => setShowNotifications(false)}>Fechar</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notifications.map((notification) => (
                    <div key={notification.id} style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{notification.text}</p>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{notification.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="header-user">
          <div className="header-user-info">
            <span style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-primary)' }}>{user?.nome || 'Qualidade Agricola'}</span>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{user?.matricula ? `Mat. ${user.matricula}` : 'CQO Corte e Carreamento'}</span>
          </div>
          <button className="header-btn" onClick={onLogout} title="Sair">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
