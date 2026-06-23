import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CalendarDays, Maximize2, MonitorPlay, RefreshCw, X } from 'lucide-react';
import StatusBanner from '../components/ui/StatusBanner';
import { filterRecords, useCqoData } from '../utils/cqoData';
import { buildQualidadeOperacional, QUALITY_LOSS_LIMITS } from '../utils/qualidadeOperacionalData';

function fmt(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function pct(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/D';
  return `${fmt(value, digits)}%`;
}

function formatDateBr(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR').format(date);
}

function periodLabel(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return 'Todos os tempos';
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
    const fullMonth = from.getDate() === 1
      && to.getDate() === new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate()
      && from.getMonth() === to.getMonth()
      && from.getFullYear() === to.getFullYear();
    if (fullMonth) {
      const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(from);
      return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${from.getFullYear()}`;
    }
  }
  return `${formatDateBr(dateFrom) || 'Início'} a ${formatDateBr(dateTo) || 'Fim'}`;
}

function updateLabel(lastSyncTime) {
  const today = new Intl.DateTimeFormat('pt-BR').format(new Date());
  return lastSyncTime ? `${today} ${lastSyncTime}` : new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
}

function LossMetric({ label, value, meta, tone = 'neutral', loading = false }) {
  return (
    <div className={`losses-bi-metric losses-bi-metric-${tone}`}>
      <span>{label}</span>
      <strong className={loading ? 'skeleton-text' : ''}>{loading ? '\u00A0' : value}</strong>
      {meta ? <small>{meta}</small> : null}
    </div>
  );
}

function LossesMetricRail({ model, loading }) {
  const perdasYtd = model.charts.perdasPctMensal.at(-1)?.perdasYtd || model.totals.perdasT;
  const pesoYtd = model.charts.perdasPctMensal.at(-1)?.pesoYtd || model.totals.producedTon;
  const perdasPctYtd = pesoYtd > 0 ? (perdasYtd / pesoYtd) * 100 : null;
  const hasBase = model.hasProductionBase;

  return (
    <aside className="losses-bi-rail">
      <LossMetric loading={loading} label="Peso t YTD" value={fmt(pesoYtd, 1)} />
      <LossMetric loading={loading} label="Perdas % YTD" value={pesoYtd ? pct(perdasPctYtd, 2) : 'N/D'} />
      <LossMetric loading={loading} label="Perdas t YTD" value={fmt(perdasYtd, 2)} />
      <LossMetric
        loading={loading}
        label="Perdas %"
        value={hasBase ? pct(model.lossRates.totalPct, 2) : 'N/D'}
        meta={`Meta: ${pct(QUALITY_LOSS_LIMITS.totalPct, 2)}`}
        tone={hasBase && model.lossRates.totalPct > QUALITY_LOSS_LIMITS.totalPct ? 'danger' : 'success'}
      />
      <LossMetric
        loading={loading}
        label="Perdas % Corte"
        value={hasBase ? pct(model.lossRates.cortePct, 2) : 'N/D'}
        meta={`Meta: ${pct(QUALITY_LOSS_LIMITS.cortePct, 2)}`}
        tone={hasBase && model.lossRates.cortePct > QUALITY_LOSS_LIMITS.cortePct ? 'danger' : 'success'}
      />
      <LossMetric
        loading={loading}
        label="Perdas % Carreamento"
        value={hasBase ? pct(model.lossRates.carreamentoPct, 2) : 'N/D'}
        meta={`Meta: ${pct(QUALITY_LOSS_LIMITS.carreamentoPct, 2)}`}
        tone={hasBase && model.lossRates.carreamentoPct > QUALITY_LOSS_LIMITS.carreamentoPct ? 'danger' : 'success'}
      />
      <LossMetric loading={loading} label="Perdas Corte (t)" value={fmt(model.totals.corteT, 2)} tone="danger" />
      <LossMetric loading={loading} label="Perdas Carreamento (t)" value={fmt(model.totals.carreamentoT, 2)} tone="success" />
    </aside>
  );
}

function FarmPercentChart({ rows, loading }) {
  const visible = rows.slice(0, 8);
  const max = Math.max(QUALITY_LOSS_LIMITS.totalPct, ...visible.map((row) => row.totalPct || 0), 0.1);

  return (
    <section className="losses-bi-panel">
      <h3>Perdas por Fazenda (%)</h3>
      {loading ? <div className="skeleton-chart" style={{ height: 190 }} /> : (
        <div className="losses-bi-horizontal">
          {visible.map((row, index) => {
            const hasBase = row.producedTon > 0;
            const value = hasBase ? row.totalPct : 0;
            return (
              <div className="losses-bi-h-row" key={row.label}>
                <strong>{row.label}</strong>
                <div>
                  <span
                    style={{
                      width: `${Math.min((value / max) * 100, 100)}%`,
                      background: index % 2 === 0 ? 'var(--green-institutional)' : 'var(--orange-soft)',
                    }}
                  />
                  <small>{hasBase ? pct(value, 2) : 'N/D'}</small>
                </div>
              </div>
            );
          })}
          {!visible.length ? <div className="empty-panel">Sem perdas por fazenda no filtro atual.</div> : null}
        </div>
      )}
    </section>
  );
}

function FarmTonChart({ rows, loading }) {
  const visible = rows.slice(0, 8);
  const max = Math.max(...visible.map((row) => row.perdasT || 0), 1);

  return (
    <section className="losses-bi-panel">
      <h3>Perdas Por Fazenda (t)</h3>
      {loading ? <div className="skeleton-chart" style={{ height: 190 }} /> : (
        <div className="losses-bi-columns">
          {visible.map((row, index) => {
            const height = Math.max(((row.perdasT || 0) / max) * 100, row.perdasT > 0 ? 4 : 0);
            return (
              <div className="losses-bi-column" key={row.label}>
                <strong>{fmt(row.perdasT, 1)}</strong>
                <div>
                  <span
                    style={{
                      height: `${height}%`,
                      background: index % 2 === 0 ? 'var(--orange-soft)' : 'var(--green-institutional)',
                    }}
                  />
                </div>
                <small>{row.label}</small>
              </div>
            );
          })}
          {!visible.length ? <div className="empty-panel">Sem dados de toneladas no filtro atual.</div> : null}
        </div>
      )}
    </section>
  );
}

function WeeklyLossChart({ rows, fiscalRows, loading }) {
  const visible = rows.slice(-10);
  const width = Math.max(720, visible.length * 92 + 90);
  const height = 250;
  const pad = { top: 34, right: 28, bottom: 42, left: 52 };
  const gw = width - pad.left - pad.right;
  const gh = height - pad.top - pad.bottom;
  const maxValue = Math.max(
    QUALITY_LOSS_LIMITS.cortePct,
    QUALITY_LOSS_LIMITS.carreamentoPct,
    ...visible.map((row) => row.cortePct || 0),
    ...visible.map((row) => row.carreamentoPct || 0),
    0.5
  ) * 1.18;
  const step = visible.length > 1 ? gw / (visible.length - 1) : gw;
  const point = (row, index, key) => {
    const x = pad.left + index * step;
    const y = pad.top + gh - ((row[key] || 0) / maxValue) * gh;
    return `${x},${y}`;
  };
  const cortePoints = visible.map((row, index) => point(row, index, 'cortePct')).join(' ');
  const carrPoints = visible.map((row, index) => point(row, index, 'carreamentoPct')).join(' ');
  const yLimitCorte = pad.top + gh - (QUALITY_LOSS_LIMITS.cortePct / maxValue) * gh;
  const yLimitCarr = pad.top + gh - (QUALITY_LOSS_LIMITS.carreamentoPct / maxValue) * gh;

  return (
    <section className="losses-bi-panel losses-bi-weekly">
      <div className="losses-bi-panel-head">
        <h3>Perdas por Semana/mês</h3>
        <div className="losses-bi-fiscal-strip">
          {fiscalRows.slice(0, 5).map((row) => <span key={row.label}>{row.label}</span>)}
        </div>
      </div>
      {loading ? <div className="skeleton-chart" style={{ height: 250 }} /> : (
        <div className="losses-bi-line-scroll">
          {visible.length ? (
            <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="losses-bi-line-chart">
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = pad.top + gh * (1 - ratio);
                return (
                  <g key={ratio}>
                    <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="chart-grid-line" />
                    <text x={pad.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">{pct(maxValue * ratio, 1)}</text>
                  </g>
                );
              })}
              <line x1={pad.left} x2={width - pad.right} y1={yLimitCorte} y2={yLimitCorte} className="losses-bi-limit-line losses-bi-limit-corte" />
              <line x1={pad.left} x2={width - pad.right} y1={yLimitCarr} y2={yLimitCarr} className="losses-bi-limit-line losses-bi-limit-carreamento" />
              <polyline points={cortePoints} className="losses-bi-polyline losses-bi-polyline-corte" />
              <polyline points={carrPoints} className="losses-bi-polyline losses-bi-polyline-carreamento" />
              {visible.map((row, index) => {
                const x = pad.left + index * step;
                const yCorte = pad.top + gh - ((row.cortePct || 0) / maxValue) * gh;
                const yCarr = pad.top + gh - ((row.carreamentoPct || 0) / maxValue) * gh;
                return (
                  <g key={row.label}>
                    <circle cx={x} cy={yCorte} r="4" className="losses-bi-dot-corte" />
                    <text x={x} y={yCorte - 10} textAnchor="middle" className="losses-bi-value-label">{pct(row.cortePct || 0, 2)}</text>
                    <circle cx={x} cy={yCarr} r="4" className="losses-bi-dot-carreamento" />
                    <text x={x} y={yCarr + 16} textAnchor="middle" className="losses-bi-value-label">{pct(row.carreamentoPct || 0, 2)}</text>
                    <text x={x} y={height - 15} textAnchor="middle" className="chart-axis-text">{String(row.label).replace('S', '')}</text>
                  </g>
                );
              })}
            </svg>
          ) : <div className="empty-panel">Sem semanas no filtro atual.</div>}
        </div>
      )}
      <div className="losses-bi-legend">
        <span><i className="losses-bi-corte" />Perda corte %</span>
        <span><i className="losses-bi-carreamento" />Perda carreamento %</span>
        <span><i className="losses-bi-limit-corte-dot" />Limite Corte</span>
        <span><i className="losses-bi-limit-carr-dot" />Limite Carreamento</span>
      </div>
    </section>
  );
}

function LossesBoard({ loading, model, periodText, updateText, onPresent, presentationMode = false }) {
  return (
    <div className={`losses-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="losses-bi-header">
        <div className="losses-bi-title">
          <img src="/logo.png" alt="Vila Nova Agroindustrial" />
          <div>
            <h2>Perdas Agrícola</h2>
            <div className="losses-bi-meta">
              <span><CalendarDays size={14} />{periodText}</span>
              <span><RefreshCw size={14} />Atualizado: {updateText}</span>
            </div>
          </div>
        </div>
        {!presentationMode ? (
          <button type="button" className="losses-bi-present-btn" onClick={onPresent}>
            <MonitorPlay size={18} />
            Apresentar
            <Maximize2 size={15} />
          </button>
        ) : null}
      </div>

      <div className="losses-bi-content">
        <LossesMetricRail model={model} loading={loading} />
        <div className="losses-bi-main">
          <div className="losses-bi-top-grid">
            <FarmPercentChart rows={model.farmRows} loading={loading} />
            <FarmTonChart rows={model.farmRows} loading={loading} />
          </div>
          <WeeklyLossChart rows={model.weekRows} fiscalRows={model.evaluatorRows} loading={loading} />
        </div>
      </div>
    </div>
  );
}

function LossesPresentationOverlay(props) {
  return createPortal(
    <div className="presentation-overlay losses-presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentação de perdas agrícolas">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={props.onClose} title="Fechar apresentação" aria-label="Fechar apresentação">
        <X size={22} />
      </button>
      <div className="presentation-scroll">
        <LossesBoard {...props} presentationMode />
      </div>
    </div>,
    document.body
  );
}

export default function LossesAgricola({
  farmFilter,
  areaFilter,
  periodFilter,
  cycleFilter,
  evaluatorFilter,
  sourceFilter = 'all',
  dateFrom,
  dateTo,
  searchTerm,
  lastSyncTime,
}) {
  const [presentationOpen, setPresentationOpen] = useState(false);
  const { loading, error, records: allRecords } = useCqoData();
  const filtered = useMemo(() => filterRecords(allRecords, {
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    searchTerm,
  }), [allRecords, farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter, dateFrom, dateTo, searchTerm]);
  const model = useMemo(() => buildQualidadeOperacional(filtered), [filtered]);
  const periodText = periodLabel(dateFrom, dateTo);
  const updateText = updateLabel(lastSyncTime);

  useEffect(() => {
    if (!presentationOpen) return undefined;
    document.body.classList.add('presentation-active');

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setPresentationOpen(false);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.body.classList.remove('presentation-active');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [presentationOpen]);

  const openPresentation = () => {
    setPresentationOpen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const closePresentation = () => {
    setPresentationOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fade-in page-shell losses-bi-page">
      {presentationOpen ? (
        <LossesPresentationOverlay
          loading={loading}
          model={model}
          periodText={periodText}
          updateText={updateText}
          onClose={closePresentation}
        />
      ) : null}

      {error ? (
        <StatusBanner tone="danger" icon={AlertTriangle}>
          Falha ao carregar dados: {error}
        </StatusBanner>
      ) : null}

      {!model.hasProductionBase && !loading && filtered.length > 0 ? (
        <StatusBanner icon={AlertTriangle}>
          Percentuais dependem da base de produção/balança. As toneladas seguem estimadas pelas amostras CQO.
        </StatusBanner>
      ) : null}

      <LossesBoard
        loading={loading}
        model={model}
        periodText={periodText}
        updateText={updateText}
        onPresent={openPresentation}
      />
    </div>
  );
}
