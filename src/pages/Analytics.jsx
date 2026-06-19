import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Leaf,
  Maximize2,
  MonitorPlay,
  Rows3,
  Scissors,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Weight,
  X,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { aggregateRecords, buildCharts, filterRecords, useCqoData } from '../utils/cqoData';

function fmt(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function pct(num, den) {
  if (!den || den === 0) return '0,0%';
  return `${((num / den) * 100).toFixed(1).replace('.', ',')}%`;
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, tone = 'green', loading = false, trend = null }) {
  const toneMap = {
    green: 'kpi-icon-green',
    orange: 'kpi-icon-orange',
    info: 'kpi-icon-info',
    danger: 'kpi-icon-danger',
    warning: 'kpi-icon-orange',
  };
  return (
    <div className="card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper ${toneMap[tone] || 'kpi-icon-green'}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-body">
        <span className={`kpi-value ${loading ? 'skeleton-text' : ''}`}>
          {loading ? '\u00A0' : value}
        </span>
        {trend !== null && !loading && (
          <span style={{ fontSize: '0.72rem', color: trend >= 0 ? 'var(--status-success)' : 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: 2 }}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <span className={`kpi-footer ${loading ? 'skeleton-text skeleton-sm' : ''}`}>
        {loading ? '\u00A0' : subtitle}
      </span>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title, color = 'var(--green-institutional)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 14px' }}>
      <div style={{ width: 4, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{eyebrow}</span>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
      </div>
    </div>
  );
}

// ─── QualityBar ───────────────────────────────────────────────────────────────
function QualityBar({ label, value, max, color, loading = false }) {
  const pctVal = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="quality-line">
      <div className="quality-line-top">
        <span>{label}</span>
        <strong className={loading ? 'skeleton-text' : ''}>{loading ? '\u00A0' : fmt(value)}</strong>
      </div>
      <div className={`quality-track ${loading ? 'skeleton-chart' : ''}`} style={{ height: 8, minHeight: 8 }}>
        {!loading && (
          <div className="quality-bar" style={{ width: `${Math.max(pctVal, value > 0 ? 3 : 0)}%`, background: color }} />
        )}
      </div>
    </div>
  );
}

// ─── StatusBadgeRow ───────────────────────────────────────────────────────────
function StatusBadgeRow({ label, value, total, color, loading }) {
  const p = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className={`${loading ? 'skeleton-text skeleton-sm' : ''}`} style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {loading ? '\u00A0' : `${p}%`}
        </span>
        <strong className={`${loading ? 'skeleton-text skeleton-sm' : ''}`} style={{ fontSize: '0.9rem', color, minWidth: 28, textAlign: 'right' }}>
          {loading ? '\u00A0' : fmt(value)}
        </strong>
      </div>
    </div>
  );
}

// ─── AlertFarol ───────────────────────────────────────────────────────────────
function AlertFarol({ label, meta, value, danger, warning = false }) {
  const numVal = Number(value);
  const isAlert = numVal > danger;
  const isWarn = !isAlert && warning !== false && numVal > warning;
  const color = isAlert ? 'var(--status-danger)' : isWarn ? 'var(--status-warning)' : 'var(--status-success)';
  const borderColor = isAlert ? 'var(--status-danger)' : isWarn ? 'var(--status-warning)' : 'var(--status-success)';
  const label2 = isAlert ? 'Fora da Meta 🔴' : isWarn ? 'Atenção 🟡' : 'Conforme 🟢';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', borderLeft: `5px solid ${borderColor}` }}>
      <div>
        <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>{label}</strong>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{meta}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <strong style={{ fontSize: '1rem', color }}>{String(value).replace('.', ',')}%</strong>
        <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)' }}>{label2}</span>
      </div>
    </div>
  );
}

// ─── RankingAvaliadores ────────────────────────────────────────────────────────
function RankingAvaliadores({ records, loading }) {
  const ranking = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const key = r.evaluator || r.evaluatorMatricula || 'Desconhecido';
      if (!map.has(key)) {
        map.set(key, { nome: key, total: 0, aprovados: 0, comGps: 0 });
      }
      const entry = map.get(key);
      entry.total += 1;
      if (r.status === 'Aprovado') entry.aprovados += 1;
      if (r.gps) entry.comGps += 1;
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [records]);

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Ranking de Avaliadores</h3>
          <span className="card-subtitle">Performance individual de campo</span>
        </div>
        <div className="skeleton-chart" style={{ height: 160 }} />
      </div>
    );
  }

  if (ranking.length === 0) {
    return null;
  }

  const maxTotal = ranking[0]?.total || 1;

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} color="var(--green-institutional)" />
          <div>
            <h3 className="card-title">Ranking de Avaliadores</h3>
            <span className="card-subtitle">Performance individual de campo no período selecionado</span>
          </div>
        </div>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: 8, backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Avaliador</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Coletas</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Aprovação</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>GPS</span>
      </div>

      {ranking.map((item, idx) => {
        const barPct = (item.total / maxTotal) * 100;
        const aprPct = item.total > 0 ? ((item.aprovados / item.total) * 100).toFixed(0) : 0;
        const gpsPct = item.total > 0 ? ((item.comGps / item.total) * 100).toFixed(0) : 0;
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span style={{display: 'inline-block', width: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600}}>{idx + 1}º</span>;
        
        return (
          <div key={item.nome} className="ranking-row" style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', gap: 12, padding: '10px 12px', alignItems: 'center', borderBottom: '1px dashed var(--border-color)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>{medal}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.nome}</span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', width: 'calc(100% - 28px)', marginLeft: '28px' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: idx < 3 ? 'var(--orange-institutional)' : 'var(--status-neutral)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
              </div>
            </div>
            <span style={{ textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.total}</span>
            <span style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: Number(aprPct) >= 80 ? 'var(--status-success)' : Number(aprPct) >= 50 ? 'var(--status-warning)' : 'var(--status-danger)' }}>{aprPct}%</span>
            <span style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: Number(gpsPct) >= 80 ? 'var(--status-info)' : 'var(--text-muted)' }}>{gpsPct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ areaFilter }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16, color: 'var(--text-muted)' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ClipboardCheck size={32} color="var(--text-muted)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Nenhuma coleta no período</h3>
        <p style={{ margin: '6px 0 0', fontSize: '0.87rem' }}>
          {areaFilter !== 'all'
            ? 'Tente ampliar o período ou trocar o filtro de formulário.'
            : 'Nenhuma ficha foi sincronizada no intervalo selecionado.'}
        </p>
      </div>
    </div>
  );
}

function formatPercentValue(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits).replace('.', ',')}%`;
}

function formatMonthYear(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 'Período filtrado';
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 'Período filtrado';
  const isFullYear = from.getMonth() === 0 && from.getDate() === 1 && to.getMonth() === 11 && to.getDate() === 31;
  if (isFullYear) return String(from.getFullYear());
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(from);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${from.getFullYear()}`;
}

function CarreamentoBiKpi({ label, value, meta, tone = 'green', icon: Icon }) {
  return (
    <div className={`carreamento-bi-kpi carreamento-bi-kpi-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>
      <Icon size={20} />
    </div>
  );
}

function CarreamentoMiniBars({ title, subtitle, rows, color = 'var(--orange-institutional)' }) {
  const visibleRows = rows.slice(0, 8);
  const max = Math.max(...visibleRows.map((row) => Number(row.value || 0)), 1);

  return (
    <section className="carreamento-bi-panel">
      <div className="carreamento-bi-panel-title">
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>
      <div className="carreamento-bi-bars">
        {visibleRows.map((row) => (
          <div className="carreamento-bi-bar-row" key={row.label}>
            <strong>{row.label}</strong>
            <div>
              <span style={{ width: `${Math.max((Number(row.value || 0) / max) * 100, row.value > 0 ? 3 : 0)}%`, background: color }} />
            </div>
            <small>{fmt(row.value, 1)}</small>
          </div>
        ))}
        {!visibleRows.length && (
          <div className="empty-panel smart-empty-panel">
            <strong>Sem dados no filtro</strong>
            <span>O gráfico será exibido quando houver coletas de carreamento no período.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function buildCarreamentoDayRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.date || 'Sem data';
    const current = buckets.get(key) || {
      label: key,
      plantas: 0,
      malPosicionado: 0,
      naoCarreado: 0,
    };
    current.plantas += Number(record.totals?.plantasObservadas || 0);
    current.malPosicionado += Number(record.totals?.cachoMalPosicionado || 0);
    current.naoCarreado += Number(record.totals?.cachoNaoCarreado || 0);
    buckets.set(key, current);
  });

  return Array.from(buckets.values())
    .map((row) => ({
      ...row,
      malPosicionadoPct: row.plantas ? (row.malPosicionado / row.plantas) * 100 : 0,
      naoCarreadoPct: row.plantas ? (row.naoCarreado / row.plantas) * 100 : 0,
    }))
    .slice(-10);
}

function CarreamentoDailyChart({ rows }) {
  const chartHeight = 220;
  const padding = { top: 18, right: 18, bottom: 32, left: 42 };
  const dayWidth = 82;
  const width = Math.max(760, padding.left + padding.right + rows.length * dayWidth);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = 24;

  return (
    <section className="carreamento-bi-panel carreamento-bi-daily">
      <div className="carreamento-bi-panel-title">
        <h3>Falhas por Dia</h3>
        <span>Cachos não carreados e mal posicionados sobre plantas observadas.</span>
      </div>
      <div className="carreamento-bi-legend">
        <span><i style={{ background: 'var(--status-danger)' }} />Não carreado %</span>
        <span><i style={{ background: 'var(--orange-institutional)' }} />Mal posicionado %</span>
      </div>
      <div className="carreamento-bi-chart-scroll">
        {rows.length ? (
          <svg className="carreamento-bi-svg" viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight}>
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + graphHeight * (1 - ratio);
              return (
                <g key={ratio}>
                  <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />
                  <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">{Math.round(ratio * 10)}%</text>
                </g>
              );
            })}
            {rows.map((row, index) => {
              const x = padding.left + index * dayWidth + 18;
              const naoHeight = Math.min((row.naoCarreadoPct / 10) * graphHeight, graphHeight);
              const malHeight = Math.min((row.malPosicionadoPct / 10) * graphHeight, graphHeight);
              return (
                <g key={row.label}>
                  <rect x={x} y={padding.top + graphHeight - naoHeight} width={barWidth} height={Math.max(naoHeight, row.naoCarreadoPct > 0 ? 2 : 0)} fill="var(--status-danger)" rx="3">
                    <title>{`${row.label} - Não carreado: ${formatPercentValue(row.naoCarreadoPct)}`}</title>
                  </rect>
                  <rect x={x + barWidth + 6} y={padding.top + graphHeight - malHeight} width={barWidth} height={Math.max(malHeight, row.malPosicionadoPct > 0 ? 2 : 0)} fill="var(--orange-institutional)" rx="3">
                    <title>{`${row.label} - Mal posicionado: ${formatPercentValue(row.malPosicionadoPct)}`}</title>
                  </rect>
                  <text x={x + barWidth + 3} y={chartHeight - 10} textAnchor="middle" className="chart-axis-text">{row.label}</text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="empty-panel smart-empty-panel">
            <strong>Sem dias no período</strong>
            <span>Selecione outro mês ou aguarde novas coletas sincronizadas.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function buildCarreamentoFarmRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.farm || 'Sem fazenda';
    const current = buckets.get(key) || { label: key, plantas: 0, naoCarreado: 0, malPosicionado: 0, total: 0 };
    current.plantas += Number(record.totals?.plantasObservadas || 0);
    current.naoCarreado += Number(record.totals?.cachoNaoCarreado || 0);
    current.malPosicionado += Number(record.totals?.cachoMalPosicionado || 0);
    current.total += 1;
    buckets.set(key, current);
  });
  return Array.from(buckets.values())
    .map((row) => ({
      ...row,
      value: row.plantas ? ((row.naoCarreado + row.malPosicionado) / row.plantas) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildCarreamentoEvaluatorRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.evaluator || 'Sem avaliador';
    const current = buckets.get(key) || { label: key, total: 0, aprovados: 0, gps: 0 };
    current.total += 1;
    if (record.status === 'Aprovado') current.aprovados += 1;
    if (record.gps) current.gps += 1;
    buckets.set(key, current);
  });
  return Array.from(buckets.values())
    .map((row) => ({
      ...row,
      value: row.total,
      aprovacaoPct: row.total ? (row.aprovados / row.total) * 100 : 0,
      gpsPct: row.total ? (row.gps / row.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function CarreamentoBiBoard({
  loading,
  source,
  totals,
  records,
  periodText,
  onPresent,
  presentationMode = false,
}) {
  const taxaMalPos = totals.plantasObservadas ? (totals.cachoMalPosicionado / totals.plantasObservadas) * 100 : 0;
  const taxaNaoCarreado = totals.plantasObservadas ? (totals.cachoNaoCarreado / totals.plantasObservadas) * 100 : 0;
  const acompanhamentoPct = records.length ? (records.filter((r) => r.acompanhamento?.teve === 'sim').length / records.length) * 100 : 0;
  const aprovacaoPct = records.length ? (records.filter((r) => r.status === 'Aprovado').length / records.length) * 100 : 0;
  const gpsPct = records.length ? (records.filter((r) => r.gps).length / records.length) * 100 : 0;
  const perdaTon = (totals.cachoNaoCarreado * 20) / 1000;
  const dailyRows = buildCarreamentoDayRows(records);
  const farmRows = buildCarreamentoFarmRows(records);
  const evaluatorRows = buildCarreamentoEvaluatorRows(records);
  const farol = taxaNaoCarreado > 2 || taxaMalPos > 5
    ? 'Atenção logística: indicador fora da tolerância.'
    : records.length
      ? 'Carreamento dentro das tolerâncias principais.'
      : 'Sem coletas de carreamento no período.';

  return (
    <div className={`carreamento-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="carreamento-bi-header">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" />
        <div>
          <span>Qualidade Agrícola</span>
          <h2>CQO Carreamento</h2>
          <p>Apresentação operacional de transporte, rastreio e perdas logísticas.</p>
        </div>
        {!presentationMode && (
          <button type="button" className="carreamento-bi-present-btn" onClick={onPresent}>
            <MonitorPlay size={18} />
            Apresentar
            <Maximize2 size={15} />
          </button>
        )}
      </div>

      <div className="carreamento-bi-filter-strip">
        <span>{periodText}</span>
        <span>{loading ? 'Carregando base' : source}</span>
        <span>{fmt(records.length)} coletas</span>
        <span>{fmt(totals.linhas)} linhas</span>
        <span>{farol}</span>
      </div>

      <div className="carreamento-bi-kpi-grid">
        <CarreamentoBiKpi label="Nota CQO" value={loading ? '--' : fmt(totals.carreamentoScore)} meta="Score do carreamento" tone="green" icon={Gauge} />
        <CarreamentoBiKpi label="Não carreado" value={loading ? '--' : formatPercentValue(taxaNaoCarreado)} meta="Meta máx. 2,00%" tone={taxaNaoCarreado > 2 ? 'danger' : 'green'} icon={ThumbsDown} />
        <CarreamentoBiKpi label="Mal posicionado" value={loading ? '--' : formatPercentValue(taxaMalPos)} meta="Meta máx. 5,00%" tone={taxaMalPos > 5 ? 'danger' : 'orange'} icon={AlertTriangle} />
        <CarreamentoBiKpi label="Perda estimada" value={loading ? '--' : `${fmt(perdaTon, 2)} t`} meta={`${fmt(totals.cachoNaoCarreado)} cachos`} tone={perdaTon > 0 ? 'danger' : 'green'} icon={Weight} />
        <CarreamentoBiKpi label="Acompanhamento" value={loading ? '--' : formatPercentValue(acompanhamentoPct)} meta="Fichas supervisionadas" tone="info" icon={CheckCircle2} />
        <CarreamentoBiKpi label="GPS" value={loading ? '--' : formatPercentValue(gpsPct)} meta="Rastreabilidade" tone="green" icon={BarChart3} />
      </div>

      <div className="carreamento-bi-main-grid">
        <CarreamentoMiniBars
          title="Risco por Fazenda"
          subtitle="Soma de não carreado e mal posicionado."
          rows={farmRows}
          color="var(--status-danger)"
        />
        <CarreamentoDailyChart rows={dailyRows} />
        <section className="carreamento-bi-panel carreamento-bi-status-panel">
          <div className="carreamento-bi-panel-title">
            <h3>Rastreabilidade</h3>
            <span>Status e acompanhamento das fichas.</span>
          </div>
          <div className="carreamento-bi-status-list">
            <div><span>Aprovação</span><strong>{formatPercentValue(aprovacaoPct)}</strong></div>
            <div><span>GPS</span><strong>{formatPercentValue(gpsPct)}</strong></div>
            <div><span>Acompanhamento</span><strong>{formatPercentValue(acompanhamentoPct)}</strong></div>
            <div><span>Pendências</span><strong>{fmt(records.filter((r) => r.status === 'Pendente validação').length)}</strong></div>
          </div>
        </section>
      </div>

      <div className="carreamento-bi-bottom-grid">
        <CarreamentoMiniBars
          title="Ranking de Avaliadores"
          subtitle="Volume de fichas no período."
          rows={evaluatorRows}
          color="var(--green-institutional)"
        />
        <section className="carreamento-bi-panel">
          <div className="carreamento-bi-panel-title">
            <h3>Resumo Logístico</h3>
            <span>Base calculada pela coleta sincronizada no app.</span>
          </div>
          <div className="carreamento-bi-summary">
            <div><span>Plantas observadas</span><strong>{fmt(totals.plantasObservadas)}</strong></div>
            <div><span>Cachos não carreados</span><strong>{fmt(totals.cachoNaoCarreado)}</strong></div>
            <div><span>Cachos mal posicionados</span><strong>{fmt(totals.cachoMalPosicionado)}</strong></div>
            <div><span>Peso acumulado</span><strong>{fmt(totals.pesoMedio, 1)} kg</strong></div>
          </div>
        </section>
      </div>

      <div className="developer-signature">Desenvolvedor: Vinicius Dev.</div>
    </div>
  );
}

function CarreamentoPresentationOverlay(props) {
  return createPortal(
    <div className="presentation-overlay carreamento-presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentação CQO Carreamento">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={props.onClose} title="Fechar apresentação" aria-label="Fechar apresentação">
        <X size={22} />
      </button>
      <div className="presentation-scroll">
        <CarreamentoBiBoard {...props} presentationMode />
      </div>
    </div>,
    document.body
  );
}

// ─── Analytics Page ────────────────────────────────────────────────────────────
export default function Analytics({ farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter = 'all', dateFrom, dateTo }) {
  const { loading, error, records: allRecords, source } = useCqoData();
  const [activeTab, setActiveTab] = useState('geral');
  const [carreamentoPresentationOpen, setCarreamentoPresentationOpen] = useState(false);

  const filtered = filterRecords(allRecords, { farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter, dateFrom, dateTo });
  const corteRecords = filtered.filter((r) => r.type === 'corte');
  const carreamentoRecords = filtered.filter((r) => r.type === 'carreamento');

  const totalsGeral = aggregateRecords(filtered);
  const totalsCorte = aggregateRecords(corteRecords);
  const totalsCarreamento = aggregateRecords(carreamentoRecords);

  const chartsGeral = buildCharts(filtered);
  const chartsCorte = buildCharts(corteRecords);
  const chartsCarreamento = buildCharts(carreamentoRecords);

  // Corte computed
  const taxaPerda = totalsCorte.cachosObservados > 0
    ? ((totalsCorte.cachoEsquecido / totalsCorte.cachosObservados) * 100).toFixed(1)
    : '0.0';
  const taxaMaturacao = totalsCorte.cachosObservados > 0
    ? ((totalsCorte.cachoMaduro / totalsCorte.cachosObservados) * 100).toFixed(1)
    : '0.0';
  const mediaLinhasCorte = corteRecords.length > 0
    ? (totalsCorte.linhas / corteRecords.length).toFixed(1)
    : '0';
  const mediaPlantasPorLinha = totalsCorte.linhas > 0
    ? (totalsCorte.plantasObservadas / totalsCorte.linhas).toFixed(1)
    : '0';

  // Carreamento computed
  const taxaMalPos = totalsCarreamento.plantasObservadas > 0
    ? ((totalsCarreamento.cachoMalPosicionado / totalsCarreamento.plantasObservadas) * 100).toFixed(1)
    : '0.0';
  const taxaNaoCarreado = totalsCarreamento.plantasObservadas > 0
    ? ((totalsCarreamento.cachoNaoCarreado / totalsCarreamento.plantasObservadas) * 100).toFixed(1)
    : '0.0';
  const mediaPesoFicha = carreamentoRecords.length > 0
    ? (totalsCarreamento.pesoMedio / carreamentoRecords.length).toFixed(1)
    : '0';

  const availableTabs = [
    { id: 'geral', label: 'Visão Geral' },
    ...(areaFilter !== 'carreamento' ? [{ id: 'corte', label: 'CQO Corte' }] : []),
    ...(areaFilter !== 'corte' ? [{ id: 'carreamento', label: 'CQO Carreamento' }] : []),
  ];

  const currentTab = availableTabs.some((t) => t.id === activeTab) ? activeTab : 'geral';
  const periodText = formatMonthYear(dateFrom, dateTo);

  useEffect(() => {
    if (!carreamentoPresentationOpen) return undefined;

    document.body.classList.add('presentation-active');

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setCarreamentoPresentationOpen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.body.classList.remove('presentation-active');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [carreamentoPresentationOpen]);

  const openCarreamentoPresentation = () => {
    setCarreamentoPresentationOpen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const closeCarreamentoPresentation = () => {
    setCarreamentoPresentationOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (areaFilter === 'carreamento') {
    return (
      <div className="fade-in page-shell carreamento-bi-page">
        {carreamentoPresentationOpen && (
          <CarreamentoPresentationOverlay
            loading={loading}
            source={source}
            totals={totalsCarreamento}
            records={carreamentoRecords}
            periodText={periodText}
            onClose={closeCarreamentoPresentation}
          />
        )}

        {error && (
          <div className="warning-strip">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <CarreamentoBiBoard
          loading={loading}
          source={source}
          totals={totalsCarreamento}
          records={carreamentoRecords}
          periodText={periodText}
          onPresent={openCarreamentoPresentation}
        />
      </div>
    );
  }

  return (
    <div className="fade-in page-shell">
      {carreamentoPresentationOpen && (
        <CarreamentoPresentationOverlay
          loading={loading}
          source={source}
          totals={totalsCarreamento}
          records={carreamentoRecords}
          periodText={periodText}
          onClose={closeCarreamentoPresentation}
        />
      )}

      <div className="page-header">
        <div className="page-title-block">
          <span className="page-eyebrow">{areaFilter === 'carreamento' ? 'CQO Carreamento' : 'CQO Campo'}</span>
          <h2>{areaFilter === 'carreamento' ? 'Painel de Indicadores de Carreamento' : 'Painel de Indicadores de Campo'}</h2>
          <p>{areaFilter === 'carreamento' ? 'Modulo dedicado ao acompanhamento das respostas de carreamento sincronizadas pelo aplicativo.' : 'Dados calculados em tempo real a partir das respostas sincronizadas pelo aplicativo Android. A rampa é tratada em uma visão separada.'}</p>
        </div>
        <div className="page-actions field-presentation-actions">
          {areaFilter === 'carreamento' && (
            <button type="button" className="btn btn-primary" onClick={openCarreamentoPresentation}>
              <MonitorPlay size={18} />
              Apresentar
              <Maximize2 size={15} />
            </button>
          )}
          <div className="source-card compact">
            <span>Fonte</span>
            <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : source}</strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="warning-strip">
          <AlertTriangle size={16} />
          <span>Falha ao carregar indicadores: {error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border-color)', paddingBottom: 0 }}>
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: currentTab === tab.id ? 700 : 500,
              color: currentTab === tab.id ? 'var(--green-institutional)' : 'var(--text-secondary)',
              borderBottom: currentTab === tab.id ? '2px solid var(--green-institutional)' : '2px solid transparent',
              marginBottom: -2,
              fontSize: '0.9rem',
              transition: 'all 0.18s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!loading && filtered.length === 0 && <EmptyState areaFilter={areaFilter} />}

      {/* ============ VISÃO GERAL ============ */}
      {currentTab === 'geral' && (loading || filtered.length > 0) && (
        <>
          <SectionHeader eyebrow="Indicadores de Conformidade" title="Avaliação Geral da Qualidade Operacional de Campo" color="var(--green-institutional)" />

          {/* Gauge scores */}
          <div className={`grid-container ${areaFilter === 'all' ? 'grid-cols-3' : 'grid-cols-2'}`} style={{ marginBottom: 4 }}>
            <CustomChart
              type="gauge"
              title="Nota Geral CQO"
              data={[{ label: 'Média consolidada de qualidade', value: totalsGeral.generalScore }]}
              loading={loading}
            />
            {areaFilter !== 'carreamento' && (
              <CustomChart
                type="gauge"
                title="Nota CQO Corte"
                data={[{ label: `${fmt(totalsGeral.corte)} coletas de colheita`, value: totalsGeral.corteScore }]}
                loading={loading}
              />
            )}
            {areaFilter !== 'corte' && (
              <CustomChart
                type="gauge"
                title="Nota CQO Carreamento"
                data={[{ label: `${fmt(totalsGeral.carreamento)} coletas de transporte`, value: totalsGeral.carreamentoScore }]}
                loading={loading}
              />
            )}
          </div>

          <SectionHeader eyebrow="Volumes e Amostragem" title="Escopo do Monitoramento de Campo" color="var(--orange-institutional)" />
          <div className={`grid-container ${areaFilter === 'carreamento' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <KpiCard title="Coletas Recebidas" value={fmt(totalsGeral.total)} subtitle="Total de fichas no banco de dados" icon={ClipboardCheck} tone="green" loading={loading} />
            {areaFilter !== 'carreamento' && (
              <KpiCard title="Cachos Observados" value={fmt(totalsGeral.cachosObservados)} subtitle="Cachos auditados nas linhas" icon={CheckCircle2} tone="info" loading={loading} />
            )}
            <KpiCard title="Linhas Avaliadas" value={fmt(totalsGeral.linhas)} subtitle={`${fmt(totalsGeral.gpsPoints)} pontos GPS no trajeto`} icon={Rows3} tone="orange" loading={loading} />
            <KpiCard title="Plantas Observadas" value={fmt(totalsGeral.plantasObservadas)} subtitle="Base para cálculo de perdas" icon={Sprout} tone="green" loading={loading} />
          </div>

          <SectionHeader eyebrow="Desperdício de Matéria-Prima" title="Estimativa Física de Perdas no Campo" color="var(--status-danger)" />
          <div className="grid-container grid-cols-3" style={{ marginBottom: '24px' }}>
            <KpiCard
              title={areaFilter === 'corte' ? "Cachos Perdidos (Corte)" : areaFilter === 'carreamento' ? "Cachos Perdidos (Logística)" : "Cachos Perdidos (Corte/Logística)"}
              value={`${fmt(totalsGeral.lostCachosQty)} cachos`}
              subtitle={areaFilter === 'corte' ? 'Apenas cachos esquecidos' : areaFilter === 'carreamento' ? 'Apenas cachos não carreados' : 'Esquecidos ou não carreados'}
              icon={AlertTriangle}
              tone="danger"
              loading={loading}
            />
            <KpiCard
              title="Massa de Frutos Perdida"
              value={`${fmt(totalsGeral.lostFrutosTon, 2)} Toneladas`}
              subtitle="Estimativa física acumulada (20kg/cacho)"
              icon={Weight}
              tone="danger"
              loading={loading}
            />
            <KpiCard
              title="Óleo de Palma (CPO) Perdido"
              value={`${fmt(totalsGeral.lostOilTon, 2)} Ton. de Óleo`}
              subtitle="Rendimento médio estimado de 20%"
              icon={Leaf}
              tone="danger"
              loading={loading}
            />
          </div>

          {/* Charts */}
          {/* Charts */}
          <div className="grid-container grid-cols-3" style={{ marginBottom: '16px' }}>
            <CustomChart loading={loading} type="line" data={chartsGeral.byWeekOfMonth} title="Evolução por semana do mês" />
            <CustomChart loading={loading} type="line" data={chartsGeral.byDayOfMonth} title="Evolução por dia do mês" />
            <CustomChart loading={loading} type="line" data={chartsGeral.ytdLoss} title="Evolução Acumulada de Perdas (YTD Toneladas)" />
          </div>

          <div className="grid-container grid-cols-3">
            <CustomChart loading={loading} type="bar" data={chartsGeral.byCycle} title="Comparativo por Ciclo (Nota CQO)" />
            <CustomChart loading={loading} type="bar" data={chartsGeral.byFarm} title="Nota CQO por Fazenda" />
            <CustomChart loading={loading} type="bar" data={chartsGeral.byEvaluator} title="Nota CQO por Avaliador" />
          </div>

          {/* Ranking avaliadores */}
          <SectionHeader eyebrow="Performance Individual" title="Ranking de Avaliadores de Campo" color="var(--green-institutional)" />
          <RankingAvaliadores records={filtered} loading={loading} />
        </>
      )}

      {/* ============ CQO CORTE ============ */}
      {currentTab === 'corte' && (loading || corteRecords.length > 0) && (
        <>
          <SectionHeader eyebrow="Formulário CQO Corte" title="Indicadores de qualidade no corte" color="var(--green-institutional)" />

          {/* Gauge da Nota */}
          <div className="grid-container grid-cols-3">
            <CustomChart
              type="gauge"
              title="Nota CQO Corte"
              data={[{ label: 'Score geral de qualidade no corte', value: totalsCorte.corteScore }]}
              loading={loading}
            />
            <KpiCard title="Fichas de corte" value={fmt(corteRecords.length)} subtitle={`${mediaLinhasCorte} linhas por ficha (média)`} icon={Scissors} tone="green" loading={loading} />
            <KpiCard title="Plantas observadas" value={fmt(totalsCorte.plantasObservadas)} subtitle={`${mediaPlantasPorLinha} plantas/linha (média)`} icon={Sprout} tone="green" loading={loading} />
          </div>

          <SectionHeader eyebrow="Qualidade dos cachos" title="Maturação e perdas no corte" color="var(--orange-institutional)" />
          <div className="grid-container grid-cols-4" style={{ marginBottom: '18px' }}>
            <KpiCard
              title="Taxa de maturação"
              value={`${taxaMaturacao.replace('.', ',')}%`}
              subtitle={`${fmt(totalsCorte.cachoMaduro)} cachos maduros`}
              icon={ThumbsUp}
              tone="green"
              loading={loading}
            />
            <KpiCard
              title="Perda no corte"
              value={`${taxaPerda.replace('.', ',')}%`}
              subtitle={`${fmt(totalsCorte.cachoEsquecido)} cachos esquecidos`}
              icon={AlertTriangle}
              tone={Number(taxaPerda) > 1.5 ? 'danger' : 'green'}
              loading={loading}
            />
            <KpiCard
              title="Cachos verdes"
              value={`${totalsCorte.cachoVerdeRate.toFixed(2).replace('.', ',')}%`}
              subtitle={`${fmt(totalsCorte.cachoVerde)} unidades colhidas`}
              icon={Leaf}
              tone={totalsCorte.cachoVerdeRate > 3.0 ? 'danger' : 'warning'}
              loading={loading}
            />
            <KpiCard
              title="Cachos passados"
              value={`${totalsCorte.cachoPassadoRate.toFixed(2).replace('.', ',')}%`}
              subtitle={`${fmt(totalsCorte.cachoPassado)} unidades colhidas`}
              icon={TrendingDown}
              tone={totalsCorte.cachoPassadoRate > 5.0 ? 'danger' : 'warning'}
              loading={loading}
            />
          </div>

          {/* Farol e Fitossanitário */}
          <div className="grid-container grid-cols-2" style={{ marginBottom: '24px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h3 className="card-title">Farol de Alertas e Tolerâncias</h3>
                  <span className="card-subtitle">Limites estabelecidos pelo controle de qualidade</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AlertFarol
                  label="Perda no Corte (Cachos Esquecidos)"
                  meta="Meta: < 1,5% de perda"
                  value={taxaPerda}
                  danger={1.5}
                />
                <AlertFarol
                  label="Colheita de Cachos Verdes"
                  meta="Meta: < 3,0% de verdes"
                  value={totalsCorte.cachoVerdeRate.toFixed(2).replace('.', ',')}
                  danger={3.0}
                />
                <AlertFarol
                  label="Incidência de Talo Comprido"
                  meta="Meta: < 5,0% das plantas"
                  value={totalsCorte.taloCompridoRate.toFixed(2).replace('.', ',')}
                  danger={5.0}
                  warning={3.0}
                />
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="card-header" style={{ marginBottom: 10 }}>
                <div>
                  <h3 className="card-title">Monitoramento Fitossanitário (Pragas)</h3>
                  <span className="card-subtitle">Incidência de ataque de broca na colheita (cachos brocados)</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: 'auto' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Taxa de Infestação por Broca</span>
                <strong style={{ fontSize: '2.2rem', color: totalsCorte.pragasRate > 1.0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                  {totalsCorte.pragasRate.toFixed(2).replace('.', ',')}%
                </strong>
                <span className={`badge ${totalsCorte.pragasRate > 1.0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '4px' }}>
                  {totalsCorte.pragasRate > 1.0 ? 'Risco Fitossanitário Alto ⚠️' : 'Sob Controle 🟢'}
                </span>
              </div>
              <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Quantidade afetada:</span>
                <strong>{fmt(totalsCorte.cachoBrocado)} cachos brocados</strong>
              </div>
            </div>
          </div>

          {/* Qualitative detail */}
          <div className="grid-container grid-cols-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Distribuição dos cachos no corte</h3>
                  <span className="card-subtitle">Proporção de cada categoria sobre o total observado</span>
                </div>
              </div>
              <div className="quality-stack">
                <QualityBar label="Cachos maduros" value={totalsCorte.cachoMaduro} max={Math.max(totalsCorte.cachosObservados, 1)} color="var(--green-institutional)" loading={loading} />
                <QualityBar label="Cachos verdes" value={totalsCorte.cachoVerde} max={Math.max(totalsCorte.cachosObservados, 1)} color="#F59E0B" loading={loading} />
                <QualityBar label="Cachos passados" value={totalsCorte.cachoPassado} max={Math.max(totalsCorte.cachosObservados, 1)} color="#EF4444" loading={loading} />
                <QualityBar label="Cachos esquecidos" value={totalsCorte.cachoEsquecido} max={Math.max(totalsCorte.cachosObservados, 1)} color="var(--orange-institutional)" loading={loading} />
                <QualityBar label="Cachos infermos" value={totalsCorte.cachoInfermo || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#EF4444" loading={loading} />
                <QualityBar label="Bucha" value={totalsCorte.bucha || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#64748B" loading={loading} />
                <QualityBar label="Cachos estrela" value={totalsCorte.cachoEstrela || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#8B5CF6" loading={loading} />
                <QualityBar label="Cachos brocados" value={totalsCorte.cachoBrocado || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#DC2626" loading={loading} />
                <QualityBar label="Cachos avermelhados" value={totalsCorte.cachoAvermelhado || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#B45309" loading={loading} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Falhas e ocorrências no corte</h3>
                  <span className="card-subtitle">Irregularidades técnicas por categoria</span>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                <StatusBadgeRow label="Cachos mal posicionados" value={totalsCorte.cachoMalPosicionado || 0} total={totalsCorte.plantasObservadas} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Folha cortada indevida" value={totalsCorte.folhaCortada || 0} total={totalsCorte.plantasObservadas} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Folha mamando" value={totalsCorte.folhaMamando || 0} total={totalsCorte.plantasObservadas} color="#8B5CF6" loading={loading} />
                <StatusBadgeRow label="Talo comprido" value={totalsCorte.taloComprido || 0} total={totalsCorte.plantasObservadas} color="var(--orange-institutional)" loading={loading} />
                <StatusBadgeRow label="Cachos brocados" value={totalsCorte.cachoBrocado || 0} total={totalsCorte.plantasObservadas} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Com acompanhamento" value={corteRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} total={corteRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Com registro GPS" value={corteRecords.filter((r) => r.gps).length} total={corteRecords.length} color="var(--status-info)" loading={loading} />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid-container grid-cols-2" style={{ marginBottom: '16px' }}>
            <CustomChart loading={loading} type="line" data={chartsCorte.byDayOfMonth} title="Evolução por dia do mês — Nota CQO Corte" />
            <CustomChart
              loading={loading}
              type="bar"
              data={chartsCorte.lossRateByWeekOfMonth}
              title="Perda no Corte por Semana do mês (%)"
              targetValue={2.0}
              targetLabel="Limite Tolerável"
            />
          </div>
          <div className="grid-container grid-cols-2">
            <CustomChart loading={loading} type="bar" data={chartsCorte.byFarm} title="Nota CQO Corte por Fazenda" />
            <CustomChart loading={loading} type="bar" data={chartsCorte.byEvaluator} title="Nota CQO Corte por Avaliador" />
          </div>

          {/* Status resumo */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Resumo de status — CQO Corte</h3>
                <span className="card-subtitle">Distribuição dos registros por status de transmissão</span>
              </div>
            </div>
            <div style={{ padding: '4px 0' }}>
              <StatusBadgeRow label="Sincronizados" value={corteRecords.filter((r) => r.status === 'Sincronizado').length} total={corteRecords.length} color="var(--status-success)" loading={loading} />
              <StatusBadgeRow label="Aprovados" value={corteRecords.filter((r) => r.status === 'Aprovado').length} total={corteRecords.length} color="var(--status-success)" loading={loading} />
              <StatusBadgeRow label="Reprovados" value={corteRecords.filter((r) => r.status === 'Reprovado').length} total={corteRecords.length} color="var(--status-danger)" loading={loading} />
              <StatusBadgeRow label="Pendente validação" value={corteRecords.filter((r) => r.status === 'Pendente validação').length} total={corteRecords.length} color="var(--status-warning)" loading={loading} />
              <StatusBadgeRow label="Falha de sincronização" value={corteRecords.filter((r) => r.status === 'Falha').length} total={corteRecords.length} color="var(--status-danger)" loading={loading} />
            </div>
          </div>

          {/* Ranking */}
          <SectionHeader eyebrow="Performance Individual" title="Ranking de Avaliadores — Corte" color="var(--green-institutional)" />
          <RankingAvaliadores records={corteRecords} loading={loading} />
        </>
      )}

      {/* ============ CQO CARREAMENTO ============ */}
      {currentTab === 'carreamento' && (loading || carreamentoRecords.length > 0) && (
        <>
          <SectionHeader eyebrow="Formulário CQO Carreamento e Fruto Solto" title="Indicadores de transporte e rastreio" color="var(--orange-institutional)" />

          {/* Gauge + KPIs */}
          <div className="grid-container grid-cols-3">
            <CustomChart
              type="gauge"
              title="Nota CQO Carreamento"
              data={[{ label: 'Score geral de qualidade do carreamento', value: totalsCarreamento.carreamentoScore }]}
              loading={loading}
            />
            <KpiCard title="Fichas carreamento" value={fmt(carreamentoRecords.length)} subtitle={`${fmt(totalsCarreamento.linhas)} linhas registradas`} icon={Truck} tone="orange" loading={loading} />
            <KpiCard title="Plantas observadas" value={fmt(totalsCarreamento.plantasObservadas)} subtitle="Base de cálculo por linha" icon={Sprout} tone="green" loading={loading} />
          </div>

          <div className="grid-container grid-cols-2" style={{ marginTop: 12 }}>
            <KpiCard
              title="Acúmulo de Peso Observado"
              value={`${fmt(totalsCarreamento.pesoMedio, 1)} kg`}
              subtitle={`Média de ${mediaPesoFicha} kg/ficha`}
              icon={Weight}
              tone="info"
              loading={loading}
            />
            <KpiCard
              title="Taxa de Sincronização"
              value={pct(carreamentoRecords.filter((r) => r.status === 'Sincronizado').length, carreamentoRecords.length)}
              subtitle={`${carreamentoRecords.filter((r) => r.status === 'Sincronizado').length} fichas concluídas`}
              icon={TrendingUp}
              tone="info"
              loading={loading}
            />
          </div>

          <SectionHeader eyebrow="Irregularidades de transporte" title="Perdas e falhas no carreamento" color="var(--orange-institutional)" />
          <div className="grid-container grid-cols-4" style={{ marginBottom: '18px' }}>
            <KpiCard
              title="Mal posicionados"
              value={`${taxaMalPos.replace('.', ',')}%`}
              subtitle={`${fmt(totalsCarreamento.cachoMalPosicionado)} cachos`}
              icon={AlertTriangle}
              tone={totalsCarreamento.cachoMalPosicionadoRate > 5.0 ? 'danger' : 'warning'}
              loading={loading}
            />
            <KpiCard
              title="Não carreados"
              value={`${taxaNaoCarreado.replace('.', ',')}%`}
              subtitle={`${fmt(totalsCarreamento.cachoNaoCarreado)} cachos`}
              icon={ThumbsDown}
              tone={totalsCarreamento.cachoNaoCarreadoRate > 2.0 ? 'danger' : 'green'}
              loading={loading}
            />
            <KpiCard
              title="Com acompanhamento"
              value={pct(carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length, carreamentoRecords.length)}
              subtitle={`${carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} fichas supervisionadas`}
              icon={CheckCircle2}
              tone="info"
              loading={loading}
            />
            <KpiCard
              title="Aprovação"
              value={pct(carreamentoRecords.filter((r) => r.status === 'Aprovado').length, carreamentoRecords.length)}
              subtitle={`${carreamentoRecords.filter((r) => r.status === 'Aprovado').length} fichas aprovadas`}
              icon={ThumbsUp}
              tone="green"
              loading={loading}
            />
          </div>

          {/* Farol logístico */}
          <div className="grid-container grid-cols-2" style={{ marginBottom: '24px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h3 className="card-title">Farol de Alertas e Tolerâncias Logísticas</h3>
                  <span className="card-subtitle">Limites estabelecidos pelo controle de qualidade de transporte</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AlertFarol
                  label="Perda Logística (Cachos Não Carreados)"
                  meta="Meta: < 2,0% de perda"
                  value={taxaNaoCarreado}
                  danger={2.0}
                />
                <AlertFarol
                  label="Cachos Mal Posicionados na Linha"
                  meta="Meta: < 5,0% de desvio"
                  value={taxaMalPos}
                  danger={5.0}
                  warning={3.0}
                />
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="card-header" style={{ marginBottom: 10 }}>
                <div>
                  <h3 className="card-title">Desperdício Físico Estimado (Logística)</h3>
                  <span className="card-subtitle">Estimativa de perdas físicas apenas por cachos não carreados</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: 'auto' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Frutos Deixados no Campo</span>
                <strong style={{ fontSize: '2.2rem', color: totalsCarreamento.cachoNaoCarreado > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                  {fmt((totalsCarreamento.cachoNaoCarreado * 20) / 1000, 2)} Ton.
                </strong>
                <span className={`badge ${totalsCarreamento.cachoNaoCarreado > 0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '4px' }}>
                  {totalsCarreamento.cachoNaoCarreado > 0 ? 'Perda de Matéria-Prima ⚠️' : 'Eficiência Total 🟢'}
                </span>
              </div>
              <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Cachos não carreados:</span>
                <strong>{fmt(totalsCarreamento.cachoNaoCarreado)} cachos</strong>
              </div>
            </div>
          </div>

          <div className="grid-container grid-cols-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Indicadores por linha — Carreamento</h3>
                  <span className="card-subtitle">Proporção sobre total de plantas observadas</span>
                </div>
              </div>
              <div className="quality-stack">
                <QualityBar label="Plantas observadas" value={totalsCarreamento.plantasObservadas} max={Math.max(totalsCarreamento.plantasObservadas, 1)} color="var(--green-institutional)" loading={loading} />
                <QualityBar label="Cachos mal posicionados" value={totalsCarreamento.cachoMalPosicionado} max={Math.max(totalsCarreamento.plantasObservadas, 1)} color="var(--status-warning)" loading={loading} />
                <QualityBar label="Cachos não carreados" value={totalsCarreamento.cachoNaoCarreado} max={Math.max(totalsCarreamento.plantasObservadas, 1)} color="var(--status-danger)" loading={loading} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Status e rastreabilidade</h3>
                  <span className="card-subtitle">Distribuição por status de transmissão</span>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                <StatusBadgeRow label="Sincronizados" value={carreamentoRecords.filter((r) => r.status === 'Sincronizado').length} total={carreamentoRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Aprovados" value={carreamentoRecords.filter((r) => r.status === 'Aprovado').length} total={carreamentoRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Reprovados" value={carreamentoRecords.filter((r) => r.status === 'Reprovado').length} total={carreamentoRecords.length} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Pendente validação" value={carreamentoRecords.filter((r) => r.status === 'Pendente validação').length} total={carreamentoRecords.length} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Falha de sincronização" value={carreamentoRecords.filter((r) => r.status === 'Falha').length} total={carreamentoRecords.length} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Com GPS" value={carreamentoRecords.filter((r) => r.gps).length} total={carreamentoRecords.length} color="var(--status-info)" loading={loading} />
                <StatusBadgeRow label="Com acompanhamento" value={carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} total={carreamentoRecords.length} color="var(--status-info)" loading={loading} />
              </div>
            </div>
          </div>

          {/* Charts */}
          <CustomChart loading={loading} type="line" data={chartsCarreamento.byDayOfMonth} title="Evolução por dia do mês — Nota CQO Carreamento" />
          <div className="grid-container grid-cols-2">
            <CustomChart loading={loading} type="bar" data={chartsCarreamento.byFarm} title="Nota CQO Carreamento por Fazenda" />
            <CustomChart loading={loading} type="bar" data={chartsCarreamento.byEvaluator} title="Nota CQO Carreamento por Avaliador" />
          </div>

          {/* Ranking */}
          <SectionHeader eyebrow="Performance Individual" title="Ranking de Avaliadores — Carreamento" color="var(--orange-institutional)" />
          <RankingAvaliadores records={carreamentoRecords} loading={loading} />
        </>
      )}
    </div>
  );
}
