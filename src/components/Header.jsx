import React, { useState } from 'react';
import { Bell, LogOut, MonitorPlay, Moon, RefreshCw, Search, Sun } from 'lucide-react';
import { ACTIVE_CQO_FARM_IDS, CQO_FARMS } from '../utils/cqoData';

import { useCqoData } from '../utils/cqoData';
import { useBonificacaoData } from '../utils/bonificacaoData';

function addYearFromValue(years, value) {
  if (!value) return;

  if (typeof value === 'string') {
    const isoYear = value.match(/^(\d{4})(?:-\d{2})?(?:-\d{2})?/);
    if (isoYear) {
      years.add(isoYear[1]);
      return;
    }

    const brDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brDate) {
      years.add(brDate[3]);
      return;
    }
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    years.add(String(date.getFullYear()));
  }
}

export default function Header({
  farmFilter,
  setFarmFilter,
  yearFilter,
  setYearFilter,
  monthFilter,
  setMonthFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  cycleFilter,
  setCycleFilter,
  evaluatorFilter,
  setEvaluatorFilter,
  sourceFilter,
  setSourceFilter,
  theme,
  setTheme,
  searchTerm,
  setSearchTerm,
  lastSyncTime,
  isSyncing,
  triggerManualSync,
  user,
  onLogout,
  onOpenTvMode,
  activePage,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { records } = useCqoData();
  const bonificacaoData = useBonificacaoData();

  const monthOptions = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  const yearOptions = React.useMemo(() => {
    const years = new Set([String(new Date().getFullYear()), String(yearFilter)]);
    records.forEach((record) => {
      [
        record.raw?.data_avaliacao,
        record.raw?.data,
        record.raw?.Data,
        record.sentAt,
        record.createdAt,
        record.date,
      ].forEach((candidate) => addYearFromValue(years, candidate));
    });

    (bonificacaoData?.cqoRampa?.byProducerDay || []).forEach((row) => addYearFromValue(years, row.dayKey));
    (bonificacaoData?.cqoRampa?.byDay || []).forEach((row) => addYearFromValue(years, row.dayKey));
    (bonificacaoData?.cqoRampa?.byMonth || []).forEach((row) => addYearFromValue(years, row.monthKey));
    (bonificacaoData?.entradaDeCff?.byMonth || []).forEach((row) => addYearFromValue(years, row.monthKey));
    (bonificacaoData?.faturamento?.byMonth || []).forEach((row) => addYearFromValue(years, row.monthKey));

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [records, bonificacaoData, yearFilter]);

  const fiscalResponsibles = React.useMemo(() => {
    const fiscals = new Set();
    records.forEach(r => {
      if (ACTIVE_CQO_FARM_IDS.includes(r.farmId) && r.fiscal && r.fiscal !== '--') {
        fiscals.add(r.fiscal);
      }
    });
    return Array.from(fiscals).sort();
  }, [records]);
  const isRampaPage = activePage === 'cqo-rampa';
  const sourceOptions = isRampaPage
    ? [
        { value: 'all', label: 'Excel + SQL' },
        { value: 'excel', label: 'Só Excel' },
        { value: 'sql', label: 'Só SQL' },
      ]
    : [
        { value: 'all', label: 'App + Excel' },
        { value: 'app', label: 'Só App' },
        { value: 'excel', label: 'Só Excel' },
      ];
  const visibleSourceFilter = isRampaPage && sourceFilter === 'app' ? 'all' : sourceFilter === 'sql' && !isRampaPage ? 'all' : sourceFilter;

  const notifications = [
    { id: 1, text: 'Dashboard preparado para ler coletas CQO do Supabase.', time: 'Agora' },
    { id: 2, text: 'Filtros alinhados aos formulários Corte e Carreamento.', time: 'Hoje' },
    { id: 3, text: 'GPS e acompanhamento serão exibidos por registro.', time: 'Hoje' },
  ];

  return (
    <header className="app-header">
      <div className="header-left">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="header-brand-logo" />

        <div className="header-search">
          <Search />
          <input
            type="text"
            placeholder="Buscar por fazenda, matrícula, parcela ou fiscal"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

      </div>

      <div className="header-filters" aria-label="Filtros globais">
        <label className="header-filter-control">
          <span>Fazenda</span>
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
        </label>

        <label className="header-filter-control">
          <span>Ciclo</span>
          <select
            className="header-filter-select"
            value={cycleFilter}
            onChange={(event) => setCycleFilter(event.target.value)}
            title="Selecionar ciclo"
          >
            <option value="all">Todos os ciclos</option>
            <option value="1">Ciclo 1</option>
            <option value="2">Ciclo 2</option>
            <option value="3">Ciclo 3</option>
            <option value="4">Ciclo 4</option>
            <option value="5">Ciclo 5</option>
            <option value="6">Ciclo 6</option>
          </select>
        </label>

        <label className="header-filter-control header-filter-control-wide">
          <span>Fiscal Resp.</span>
          <select
            className="header-filter-select"
            value={evaluatorFilter}
            onChange={(event) => setEvaluatorFilter(event.target.value)}
            title="Selecionar fiscal responsável da equipe"
          >
            <option value="all">Todos os fiscais</option>
            {fiscalResponsibles.map((fiscal) => (
              <option key={fiscal} value={fiscal}>{fiscal}</option>
            ))}
          </select>
        </label>

        <label className="header-filter-control header-filter-control-source">
          <span>Fonte</span>
          <select
            className="header-filter-select"
            value={visibleSourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            title={isRampaPage ? 'Selecionar fonte dos dados da Rampa' : 'Selecionar fonte dos dados de campo'}
          >
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="header-filter-control header-filter-control-short">
          <span>Ano</span>
          <select
            className="header-filter-select"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            title="Selecionar ano"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <label className="header-filter-control header-filter-control-short">
          <span>Mês</span>
          <select
            className="header-filter-select"
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            title="Selecionar mês"
          >
            <option value="all">Todos os meses</option>
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </label>

        <label className="header-filter-control header-filter-control-date">
          <span>Data inicial</span>
          <input
            className="header-date-input"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            title="Data inicial"
          />
        </label>

        <label className="header-filter-control header-filter-control-date">
          <span>Data final</span>
          <input
            className="header-date-input"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            title="Data final"
          />
        </label>
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

          <button
            onClick={onOpenTvMode}
            className="header-btn header-tv-btn"
            title="Abrir modo TV"
          >
            <MonitorPlay size={18} />
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
            <span style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-primary)' }}>{user?.nome || 'Qualidade Agrícola'}</span>
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
