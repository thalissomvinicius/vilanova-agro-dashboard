import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CalendarDays,
  Database,
  Maximize2,
  MonitorPlay,
  RefreshCw,
  Scale,
  Sprout,
  X,
} from 'lucide-react';
import ActiveFilterSummary from '../components/ui/ActiveFilterSummary';
import PresentationDataFilters from '../components/ui/PresentationDataFilters';
import StatusBanner from '../components/ui/StatusBanner';
import { filterRecords, useCqoData } from '../utils/cqoData';
import { useBalancaData } from '../utils/balancaData';
import {
  buildFieldBunchWeightSummary,
  buildRampBunchWeightSummary,
} from '../utils/bunchWeightData';
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

function formatMonthKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return value || '--';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${match[1]}`;
}

function readinessExplanation(readiness) {
  if (!readiness) return '';
  const reasons = Array.isArray(readiness.reasons) ? readiness.reasons.filter(Boolean) : [];
  return reasons[0] || readiness.reason || '';
}

function BunchWeightComparisonPanel({
  fieldSummary,
  rampSummary,
  loading = false,
}) {
  const comparable = fieldSummary.available && rampSummary.available;
  const differenceKg = comparable ? fieldSummary.averageKg - rampSummary.averageKg : 0;
  const differencePct = comparable && rampSummary.averageKg > 0
    ? (differenceKg / rampSummary.averageKg) * 100
    : 0;
  const visibleCollections = fieldSummary.collections.slice(0, 6);

  return (
    <section className="bunch-weight-panel" aria-label="Comparativo do peso médio do cacho maduro">
      <div className="bunch-weight-heading">
        <div>
          <span className="bunch-weight-eyebrow">BASE PARA ESTIMATIVA DE PERDAS</span>
          <h3>Peso médio do cacho maduro</h3>
          <p>Campo e rampa em frentes separadas, com origem e período rastreáveis.</p>
        </div>
        <span className="bunch-weight-rule">Somente cacho maduro</span>
      </div>

      <div className="bunch-weight-sources">
        <article className="bunch-weight-source bunch-weight-source-field">
          <div className="bunch-weight-source-title">
            <span><Sprout size={18} /></span>
            <div>
              <strong>Peso médio do campo</strong>
              <small>CQO Corte aprovado no filtro atual</small>
            </div>
          </div>
          <div className="bunch-weight-primary">
            <strong className={loading ? 'skeleton-text' : ''}>
              {loading ? '\u00A0' : fieldSummary.available ? `${fmt(fieldSummary.averageKg, 2)} kg` : 'N/D'}
            </strong>
            <span>{fieldSummary.weightCount} cacho(s) pesado(s)</span>
          </div>
          <dl className="bunch-weight-facts">
            <div><dt>Coletas</dt><dd>{fieldSummary.collectionCount}</dd></div>
            <div><dt>Peso somado</dt><dd>{fmt(fieldSummary.totalWeightKg, 1)} kg</dd></div>
            <div><dt>Mediana</dt><dd>{fieldSummary.available ? `${fmt(fieldSummary.medianKg, 2)} kg` : '--'}</dd></div>
            <div><dt>Faixa</dt><dd>{fieldSummary.available ? `${fmt(fieldSummary.minKg, 1)}–${fmt(fieldSummary.maxKg, 1)} kg` : '--'}</dd></div>
          </dl>
          <p className="bunch-weight-formula">
            Soma dos pesos individuais de cachos maduros ÷ quantidade de pesos válidos.
          </p>
        </article>

        <div className={`bunch-weight-comparison ${comparable ? '' : 'is-pending'}`}>
          <Scale size={20} />
          <strong>
            {comparable
              ? `${differenceKg >= 0 ? '+' : ''}${fmt(differenceKg, 2)} kg`
              : 'Comparação pendente'}
          </strong>
          <span>
            {comparable
              ? `${differencePct >= 0 ? '+' : ''}${fmt(differencePct, 1)}% campo vs. rampa`
              : 'Uma das bases ainda não está disponível'}
          </span>
        </div>

        <article className="bunch-weight-source bunch-weight-source-ramp">
          <div className="bunch-weight-source-title">
            <span><Database size={18} /></span>
            <div>
              <strong>Peso médio da rampa</strong>
              <small>API AGRO · mês anterior completo</small>
            </div>
          </div>
          <div className="bunch-weight-primary">
            <strong className={loading ? 'skeleton-text' : ''}>
              {loading ? '\u00A0' : rampSummary.available ? `${fmt(rampSummary.averageKg, 2)} kg` : 'N/D'}
            </strong>
            <span>Competência {formatMonthKey(rampSummary.monthKey)}</span>
          </div>
          <dl className="bunch-weight-facts">
            <div><dt>Cachos oficiais</dt><dd>{rampSummary.bunchCount ? fmt(rampSummary.bunchCount, 0) : '--'}</dd></div>
            <div><dt>Peso líquido</dt><dd>{rampSummary.totalWeightKg ? `${fmt(rampSummary.totalWeightKg / 1000, 1)} t` : '--'}</dd></div>
            <div><dt>Situação</dt><dd>{rampSummary.available ? 'Homologado' : 'Indisponível'}</dd></div>
            <div><dt>Fonte</dt><dd>SQL / balança</dd></div>
          </dl>
          <p className="bunch-weight-formula">
            {rampSummary.available
              ? 'Peso líquido oficial ÷ quantidade oficial de cachos maduros.'
              : rampSummary.reason}
          </p>
        </article>
      </div>

      <div className="bunch-weight-collections">
        <div className="bunch-weight-collections-title">
          <div>
            <strong>Coletas que formam a média de campo</strong>
            <span>Somente fichas de Corte aprovadas com pesagem de cacho maduro.</span>
          </div>
          <span>{fieldSummary.collectionCount} coleta(s)</span>
        </div>
        {visibleCollections.length ? (
          <div className="bunch-weight-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Fazenda / parcela</th>
                  <th>Avaliador</th>
                  <th>Pesos</th>
                  <th>Total</th>
                  <th>Média</th>
                </tr>
              </thead>
              <tbody>
                {visibleCollections.map((collection) => (
                  <tr key={collection.id}>
                    <td>{formatDateBr(collection.date) || '--'}</td>
                    <td><strong>{collection.farm}</strong><span>{collection.parcel}</span></td>
                    <td><strong>{collection.evaluator}</strong><span>{collection.evaluatorMatricula ? `Mat. ${collection.evaluatorMatricula}` : ''}</span></td>
                    <td>{collection.weightCount}</td>
                    <td>{fmt(collection.totalWeightKg, 1)} kg</td>
                    <td><strong>{fmt(collection.averageKg, 2)} kg</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bunch-weight-empty">
            Nenhuma coleta aprovada com pesagem de cacho maduro no filtro atual.
          </div>
        )}
        {fieldSummary.collections.length > visibleCollections.length ? (
          <div className="bunch-weight-more">
            Mais {fieldSummary.collections.length - visibleCollections.length} coleta(s) consideradas no cálculo.
          </div>
        ) : null}
      </div>
    </section>
  );
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

function formatTicketDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function LiveScaleTicketsPanel({ tickets = [], loading = false, generatedAt = null }) {
  const visibleTickets = tickets.slice(0, 10);

  return (
    <section className="card" aria-label="Tickets recentes da balança">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Scale size={20} className="panel-icon-brand" />
            Tickets recentes da balança
          </div>
          <div className="card-subtitle">
            Dados consultados em tempo real no SIAGRO/SIECA
            {generatedAt ? ` · atualizado em ${formatTicketDate(generatedAt)}` : ''}
          </div>
        </div>
        <strong>{loading ? 'Carregando…' : `${tickets.length} ticket(s)`}</strong>
      </div>

      {!loading && visibleTickets.length ? (
        <div className="table-wrapper">
          <table className="custom-table dense-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Entrada</th>
                <th>Origem / cliente</th>
                <th>Produto</th>
                <th>Placa</th>
                <th>Peso líquido</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleTickets.map((ticket) => {
                const firstItem = ticket.items?.[0] || {};
                return (
                  <tr key={ticket.sourceTicketId || ticket.ticketCode}>
                    <td><strong>{ticket.ticketCode || '--'}</strong></td>
                    <td>{formatTicketDate(ticket.enteredAt)}</td>
                    <td>{firstItem.origin || ticket.clientName || '--'}</td>
                    <td>{firstItem.product || '--'}</td>
                    <td>{ticket.vehiclePlate || '--'}</td>
                    <td>{ticket.netWeightKg == null ? '--' : `${fmt(ticket.netWeightKg, 0)} kg`}</td>
                    <td>{ticket.status === 'open' ? 'Aberto' : 'Fechado'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && !visibleTickets.length ? (
        <div className="empty-panel smart-empty-panel">
          <strong>Nenhum ticket recente</strong>
          <span>A consulta considera, por padrão, os últimos sete dias da balança.</span>
        </div>
      ) : null}
    </section>
  );
}

function LossesMetricRail({ model, loading }) {
  const perdasYtd = model.charts.perdasPctMensal.at(-1)?.perdasYtd || model.totals.perdasT;
  const pesoYtd = model.charts.perdasPctMensal.at(-1)?.pesoYtd || model.totals.producedTon;
  const potentialYtd = pesoYtd + perdasYtd;
  const perdasPctYtd = potentialYtd > 0 ? (perdasYtd / potentialYtd) * 100 : null;
  const hasBase = model.hasProductionBase;
  return (
    <aside className="losses-bi-rail">
      <LossMetric
        loading={loading}
        label="Peso t YTD"
        value={fmt(pesoYtd, 1)}
        meta={model.balance?.hasProductionBase ? 'base de balança' : ''}
      />
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

function LossesBoard({
  loading,
  model,
  periodText,
  filterState,
  updateText,
  onPresent,
  onClearFilter,
  presentationMode = false,
  sourceFilter = 'all',
  setSourceFilter,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  fieldWeightSummary,
  rampWeightSummary,
}) {
  return (
    <div className={`losses-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="losses-bi-header">
        <div className="losses-bi-title">
          <img src="/logo.png" alt="Vila Nova Agroindustrial" />
          <div>
            <h2>Perdas Agrícola</h2>
            <div className="losses-bi-meta">
              <span title={`Período filtrado: ${periodText}`}><CalendarDays size={14} />Período: {periodText}</span>
              <ActiveFilterSummary filters={filterState} onClearFilter={onClearFilter} />
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

      {presentationMode ? (
        <PresentationDataFilters
          ariaLabel="Filtros da apresentação de Perdas Agrícola"
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
        />
      ) : null}

      <BunchWeightComparisonPanel
        fieldSummary={fieldWeightSummary}
        rampSummary={rampWeightSummary}
        loading={loading}
      />

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
  setSourceFilter,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  searchTerm,
  lastSyncTime,
  onClearFilter,
}) {
  const [presentationOpen, setPresentationOpen] = useState(false);
  const { loading: cqoLoading, error, records: allRecords } = useCqoData();
  const {
    data: balanceData,
    loading: balanceLoading,
    error: balanceError,
    liveTickets,
    liveTicketsError,
    liveTicketsMeta,
    agroIntegrationError,
    usingLegacyFallback,
  } = useBalancaData({ dateFrom, dateTo });
  const loading = cqoLoading || balanceLoading;
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
    approvedOnly: true,
  }), [allRecords, farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter, dateFrom, dateTo, searchTerm]);
  const model = useMemo(() => buildQualidadeOperacional(filtered, balanceData), [filtered, balanceData]);
  const fieldWeightSummary = useMemo(
    () => buildFieldBunchWeightSummary(filtered),
    [filtered]
  );
  const rampWeightSummary = useMemo(
    () => buildRampBunchWeightSummary(balanceData, { dateFrom, dateTo }),
    [balanceData, dateFrom, dateTo]
  );
  const readinessDetail = readinessExplanation(model.balance?.readiness);
  const periodText = periodLabel(dateFrom, dateTo);
  const filterState = useMemo(() => ({
    farmFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    searchTerm,
  }), [farmFilter, cycleFilter, evaluatorFilter, sourceFilter, searchTerm]);
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
          filterState={filterState}
          updateText={updateText}
          onClearFilter={onClearFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          fieldWeightSummary={fieldWeightSummary}
          rampWeightSummary={rampWeightSummary}
          onClose={closePresentation}
        />
      ) : null}

      {error ? (
        <StatusBanner tone="danger" icon={AlertTriangle}>
          Falha ao carregar dados: {error}
        </StatusBanner>
      ) : null}

      {balanceError && usingLegacyFallback && !loading ? (
        <StatusBanner icon={AlertTriangle}>
          A base nova da balança ainda não está publicada. O painel está usando a fonte anterior enquanto a integração é concluída.
        </StatusBanner>
      ) : null}

      {liveTicketsError && !loading ? (
        <StatusBanner icon={AlertTriangle}>
          {liveTicketsError} A base histórica do Supabase continua disponível.
        </StatusBanner>
      ) : null}

      {agroIntegrationError && !loading ? (
        <StatusBanner icon={AlertTriangle}>
          Integração SQL parcial: {agroIntegrationError}
        </StatusBanner>
      ) : null}

      {!model.hasProductionBase && !loading && filtered.length > 0 ? (
        <StatusBanner icon={AlertTriangle}>
          A API AGRO não liberou uma base oficial de produção para o recorte.
          {readinessDetail ? ` ${readinessDetail}` : ''}
          {' '}Percentuais permanecem N/D; nenhum valor padrão foi aplicado.
        </StatusBanner>
      ) : null}

      {model.hasProductionBase && !model.balance?.usesPreviousMonthWeight && !loading && filtered.length > 0 ? (
        <StatusBanner icon={AlertTriangle}>
          Base oficial de produção carregada, mas o peso médio do mês anterior está indisponível ou não homologado.
          {readinessDetail ? ` ${readinessDetail}` : ''}
          {' '}As estimativas por cacho permanecem N/D; nenhum peso padrão foi aplicado.
        </StatusBanner>
      ) : null}

      <LiveScaleTicketsPanel
        tickets={liveTickets}
        loading={balanceLoading}
        generatedAt={liveTicketsMeta?.generatedAt}
      />

      <LossesBoard
        loading={loading}
        model={model}
        periodText={periodText}
        filterState={filterState}
        updateText={updateText}
        onClearFilter={onClearFilter}
        onPresent={openPresentation}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        fieldWeightSummary={fieldWeightSummary}
        rampWeightSummary={rampWeightSummary}
      />
    </div>
  );
}
