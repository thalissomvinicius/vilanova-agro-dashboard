import React, { useState } from 'react';
import { Bell, LogOut, MonitorPlay, Moon, RefreshCw, Search, Sun } from 'lucide-react';
import { ACTIVE_CQO_FARM_IDS, CQO_FARMS, parseRecordDateValue, useCqoData } from '../utils/cqoData';
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

  const date = parseRecordDateValue(value);
  if (date && !Number.isNaN(date.getTime())) {
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
  visibleFilters = [],
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { records } = useCqoData();
  const bonificacaoData = useBonificacaoData();
  const visibleFilterSet = React.useMemo(() => new Set(visibleFilters), [visibleFilters]);
  const showSearch = visibleFilterSet.has('search');
  const hasFieldFilters = ['farm', 'cycle', 'evaluator', 'source', 'year', 'month', 'dateRange']
    .some((filterId) => visibleFilterSet.has(filterId));

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
    const years = new Set([String(new Date().getFullYear())]);
    if (/^\d{4}$/.test(String(yearFilter || ''))) {
      years.add(String(yearFilter));
    }

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

    return ['all', ...Array.from(years).sort((a, b) => Number(b) - Number(a))];
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

        {showSearch ? (
          <div className="header-search">
            <Search />
            <input
              type="text"
              placeholder="Buscar por fazenda, matrícula, parcela ou fiscal"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        ) : null}

      </div>

      {hasFieldFilters ? (
        <div className="header-filters" aria-label="Filtros da página">
          {visibleFilterSet.has('farm') ? (
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
          ) : null}

          {visibleFilterSet.has('cycle') ? (
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
          ) : null}

          {visibleFilterSet.has('evaluator') ? (
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
          ) : null}

          {visibleFilterSet.has('source') ? (
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
          ) : null}

          {visibleFilterSet.has('year') ? (
            <label className="header-filter-control header-filter-control-short">
              <span>Ano</span>
              <select
                className="header-filter-select"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                title="Selecionar ano"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year === 'all' ? 'Todos os anos' : year}</option>
                ))}
              </select>
            </label>
          ) : null}

          {visibleFilterSet.has('month') ? (
            <label className="header-filter-control header-filter-control-short">
              <span>Mês</span>
              <select
                className="header-filter-select"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                disabled={yearFilter === 'all'}
                title={yearFilter === 'all' ? 'Selecione um ano para filtrar por mês' : 'Selecionar mês'}
              >
                <option value="all">Todos os meses</option>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          {visibleFilterSet.has('dateRange') ? (
            <>
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
            </>
          ) : null}
        </div>
      ) : null}

      <div className="header-right">
        <div className="header-sync-status">
          <div className={`sync-dot ${isSyncing ? 'pulse' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : `Atualizado: ${lastSyncTime}`}</span>
          <button
            onClick={triggerManualSync}
            className="header-btn header-sync-refresh-btn"
            title="Atualizar dados"
            disabled={isSyncing}
          >
            <RefreshCw className={isSyncing ? 'spin' : ''} />
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

          <div className="header-notification-anchor">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="header-btn"
              title="Avisos"
            >
              <Bell size={18} />
              <span className="header-badge" />
            </button>

            {showNotifications && (
              <div className="card fade-in header-notifications">
                <div className="header-notifications-head">
                  <span className="header-notifications-title">Avisos do painel</span>
                  <button className="link-button" onClick={() => setShowNotifications(false)}>Fechar</button>
                </div>
                <div className="header-notifications-list">
                  {notifications.map((notification) => (
                    <div key={notification.id} className="header-notification-row">
                      <p>{notification.text}</p>
                      <span className="header-notification-time">{notification.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="header-user">
          <div className="header-user-info">
            <span className="header-user-name">{user?.nome || 'Qualidade Agrícola'}</span>
            <span className="header-user-meta">{user?.matricula ? `Mat. ${user.matricula}` : 'CQO Corte e Carreamento'}</span>
          </div>
          <button className="header-btn" onClick={onLogout} title="Sair">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
