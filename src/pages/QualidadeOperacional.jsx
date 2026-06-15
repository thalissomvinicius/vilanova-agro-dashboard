import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Leaf,
  Scale,
  Sprout,
  Target,
  Tractor,
  Truck,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { filterRecords, useCqoData } from '../utils/cqoData';
import { buildQualidadeOperacional, QUALITY_LOSS_LIMITS } from '../utils/qualidadeOperacionalData';

function fmt(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function pct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/D';
  return `${fmt(value, digits)}%`;
}

function KpiCard({ title, value, subtitle, icon: Icon, tone = 'green', loading = false }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-body">
        <span className={`kpi-value ${loading ? 'skeleton-text' : ''}`}>
          {loading ? '\u00A0' : value}
        </span>
      </div>
      <span className={`kpi-footer ${loading ? 'skeleton-text skeleton-sm' : ''}`}>
        {loading ? '\u00A0' : subtitle}
      </span>
    </div>
  );
}

function QualityMetric({ label, value, meta, goodWhen = 'high', loading = false }) {
  const numeric = Number(value || 0);
  const color = goodWhen === 'high'
    ? numeric >= 90 ? 'var(--status-success)' : numeric >= 80 ? 'var(--status-warning)' : 'var(--status-danger)'
    : numeric <= meta ? 'var(--status-success)' : numeric <= meta * 1.25 ? 'var(--status-warning)' : 'var(--status-danger)';

  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong className={loading ? 'skeleton-text' : ''} style={{ color }}>
        {loading ? '\u00A0' : pct(value)}
      </strong>
      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
        {typeof meta === 'number' ? `meta ${pct(meta)}` : meta}
      </small>
    </div>
  );
}

function FormulaCard({ title, lines }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">{title}</h3>
          <span className="card-subtitle">Regra portada do BI de Qualidade Operacional Agricola.</span>
        </div>
        <ClipboardCheck size={20} style={{ color: 'var(--green-institutional)' }} />
      </div>
      <div className="compact-list">
        {lines.map((line) => (
          <div className="compact-row" key={line.label}>
            <div>
              <strong>{line.label}</strong>
              <span>{line.formula}</span>
            </div>
            <div>
              <strong>{line.value}</strong>
              <span>{line.note}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaturationBar({ verde, maduro, passado, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 24, borderRadius: 12 }}></div>;
  const total = verde + maduro + passado || 1;
  const vPct = (verde / total) * 100;
  const mPct = (maduro / total) * 100;
  const pPct = (passado / total) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500 }}>
        <span style={{ color: 'var(--status-danger)' }}>Verde {verde.toFixed(1)}%</span>
        <span style={{ color: 'var(--status-success)' }}>Maduro {maduro.toFixed(1)}%</span>
        <span style={{ color: '#B45309' }}>Passado {passado.toFixed(1)}%</span>
      </div>
      <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--surface-hover)' }}>
        <div style={{ width: `${vPct}%`, backgroundColor: 'var(--status-danger)', transition: 'width 0.5s' }} title="Verde" />
        <div style={{ width: `${mPct}%`, backgroundColor: 'var(--status-success)', transition: 'width 0.5s' }} title="Maduro" />
        <div style={{ width: `${pPct}%`, backgroundColor: '#B45309', transition: 'width 0.5s' }} title="Passado" />
      </div>
    </div>
  );
}

function LossWaterfall({ totals, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 120 }}></div>;
  const max = totals.producedTon + totals.perdasT || 1;
  const renderRow = (label, val, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }} key={label}>
      <div style={{ width: '130px', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ flex: 1, backgroundColor: 'var(--surface-hover)', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${(val / max) * 100}%`, backgroundColor: color, height: '100%', borderRadius: '8px', transition: 'width 0.5s' }} />
      </div>
      <div style={{ width: '70px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{fmt(val, 1)} t</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
      {renderRow('Produção Bruta', totals.producedTon + totals.perdasT, 'var(--status-info)')}
      {renderRow('Perda (Corte)', totals.corteT, 'var(--status-danger)')}
      {renderRow('Perda (Carream.)', totals.carreamentoT, 'var(--orange-highlight)')}
      {renderRow('Entregue (Real)', totals.producedTon, 'var(--status-success)')}
    </div>
  );
}

function FolhaMamandoAlert({ count, pct, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 80 }}></div>;
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--orange-highlight)', backgroundColor: 'var(--surface-hover)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
        <div style={{ padding: '10px', backgroundColor: 'var(--orange-highlight)', borderRadius: '50%', color: '#fff', display: 'flex' }}>
          <AlertTriangle size={24} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--orange-highlight)' }}>Alerta: Folha Mamando</h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            <span style={{ fontSize: '0.85rem' }}><strong>{fmt(count)}</strong> folhas cortadas</span>
            <span style={{ fontSize: '0.85rem' }}><strong>{pct.toFixed(1)}%</strong> das plantas</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskMatrix({ parcelas, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 200 }}></div>;
  if (!parcelas || parcelas.length === 0) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum dado</div>;

  const getCellColor = (val, meta) => {
    if (val <= meta) return 'transparent';
    if (val <= meta * 1.5) return 'rgba(254, 240, 138, 0.2)'; // light yellow
    if (val <= meta * 2) return 'rgba(254, 215, 170, 0.3)'; // light orange
    return 'rgba(254, 202, 202, 0.4)'; // light red
  };

  return (
    <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
      <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h3 className="card-title">Matriz de Risco por Parcela (Top 10)</h3>
          <span className="card-subtitle">Mapeamento de anomalias que excedem o limite de controle.</span>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-hover)' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left' }}>Parcela</th>
            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Coletas</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Perdas</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Verde</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Passado</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>F. Mamando</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Talo</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Brocado</th>
          </tr>
        </thead>
        <tbody>
          {parcelas.slice(0, 10).map((p, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '12px 16px', fontWeight: 500 }}>{p.label}</td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.recordsCount}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--status-danger)' }}>{fmt(p.perdasT, 1)} t</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', backgroundColor: getCellColor(p.cachoVerdePct, 8) }}>{p.cachoVerdePct.toFixed(1)}%</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', backgroundColor: getCellColor(p.cachoPassadoPct, 5) }}>{p.cachoPassadoPct.toFixed(1)}%</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', backgroundColor: getCellColor(p.folhaMamandoPct, 2) }}>{p.folhaMamandoPct.toFixed(1)}%</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', backgroundColor: getCellColor(p.taloCompridoPct, 3) }}>{p.taloCompridoPct.toFixed(1)}%</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', backgroundColor: getCellColor(p.cachoBrocadoPct, 5) }}>{p.cachoBrocadoPct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualityScorecard({ label, pctValue, meta, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 80, borderRadius: 8 }}></div>;
  const isGood = pctValue <= meta;
  if (label === 'Cacho Maduro %') {
    const isMaduroGood = pctValue >= meta;
    return (
      <div className="card" style={{ padding: '16px', textAlign: 'center', borderTop: isMaduroGood ? '4px solid var(--status-success)' : '4px solid var(--status-warning)' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: isMaduroGood ? 'var(--status-success)' : 'var(--text-primary)' }}>
          {pctValue.toFixed(2)}%
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Meta: {meta.toFixed(2)}%</div>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: '16px', textAlign: 'center', borderTop: isGood ? '4px solid var(--status-success)' : '4px solid var(--status-danger)' }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: isGood ? 'var(--status-success)' : 'var(--status-danger)' }}>
        {pctValue.toFixed(2)}%
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Meta: {meta.toFixed(2)}%</div>
    </div>
  );
}

function StackedBarHorizontal({ data, title, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 200 }}></div>;
  if (!data || data.length === 0) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
        {data.slice(0, 10).map((row, idx) => {
          const total = row.cachoMaduroPct + row.cachoVerdePct + row.cachoPassadoPct + row.cachoAvermelhadoPct || 1;
          const wMaduro = (row.cachoMaduroPct / total) * 100;
          const wVerde = (row.cachoVerdePct / total) * 100;
          const wPassado = (row.cachoPassadoPct / total) * 100;
          const wAvermelhado = (row.cachoAvermelhadoPct / total) * 100;
          return (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 500 }}>{row.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>M: {row.cachoMaduroPct.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', height: '16px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--surface-hover)' }}>
                <div style={{ width: `${wMaduro}%`, backgroundColor: '#F88A4E', transition: 'width 0.5s' }} title="Maduro" />
                <div style={{ width: `${wPassado}%`, backgroundColor: '#8B5A2B', transition: 'width 0.5s' }} title="Passado" />
                <div style={{ width: `${wVerde}%`, backgroundColor: '#65A30D', transition: 'width 0.5s' }} title="Verde" />
                <div style={{ width: `${wAvermelhado}%`, backgroundColor: '#B45309', transition: 'width 0.5s' }} title="Avermelhado" />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, backgroundColor: '#F88A4E', borderRadius: 2 }}/> Maduro</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, backgroundColor: '#8B5A2B', borderRadius: 2 }}/> Passado</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, backgroundColor: '#65A30D', borderRadius: 2 }}/> Verde</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, backgroundColor: '#B45309', borderRadius: 2 }}/> Avermelhado</span>
      </div>
    </div>
  );
}

function StackedBarVertical({ data, title, loading, hideLabels = false }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 200 }}></div>;
  if (!data || data.length === 0) return null;
  return (
    <div className="card" style={{ flex: 1 }}>
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '220px', padding: '10px 0', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
        {data.slice(-20).map((row, idx) => {
          const total = row.cachoMaduroPct + row.cachoVerdePct + row.cachoPassadoPct + row.cachoAvermelhadoPct || 1;
          const hMaduro = (row.cachoMaduroPct / total) * 100;
          const hVerde = (row.cachoVerdePct / total) * 100;
          const hPassado = (row.cachoPassadoPct / total) * 100;
          const hAvermelhado = (row.cachoAvermelhadoPct / total) * 100;
          return (
            <div key={idx} style={{ flexShrink: 0, width: hideLabels ? '24px' : '40px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: '0.65rem', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {!hideLabels && `${row.cachoMaduroPct.toFixed(0)}%`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '4px 4px 0 0', overflow: 'hidden', backgroundColor: 'var(--surface-hover)' }}>
                <div style={{ height: `${hMaduro}%`, backgroundColor: '#F88A4E', transition: 'height 0.5s' }} title="Maduro" />
                <div style={{ height: `${hPassado}%`, backgroundColor: '#8B5A2B', transition: 'height 0.5s' }} title="Passado" />
                <div style={{ height: `${hVerde}%`, backgroundColor: '#65A30D', transition: 'height 0.5s' }} title="Verde" />
                <div style={{ height: `${hAvermelhado}%`, backgroundColor: '#B45309', transition: 'height 0.5s' }} title="Avermelhado" />
              </div>
              <div style={{ fontSize: '0.65rem', textAlign: 'center', marginTop: '8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: hideLabels ? '0' : 'auto' }}>
                {!hideLabels && String(row.label).split(' ')[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvaluatorRanking({ data, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 200 }}></div>;
  if (!data || data.length === 0) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Avaliadores</h3>
      </div>
      <div className="compact-list">
        {data.slice(0, 8).map((row, idx) => (
          <div className="compact-row" key={idx} style={{ alignItems: 'center', padding: '12px 0' }}>
            <div style={{ flex: 1 }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{row.label}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Passado: {row.cachoPassadoPct.toFixed(2)}% | Verde: {row.cachoVerdePct.toFixed(2)}%
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--status-success)' }}>
                {row.cachoMaduroPct.toFixed(2)}%
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cacho maduro %</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function YtdScorecard({ label, value, meta, metaLabel, loading, isDanger = false, isWarning = false }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 80, borderRadius: 8 }}></div>;
  const borderColor = isDanger ? 'var(--status-danger)' : isWarning ? 'var(--status-warning)' : 'var(--text-muted)';
  return (
    <div className="card" style={{ padding: '16px', borderLeft: `4px solid ${borderColor}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: isDanger ? 'var(--status-danger)' : 'var(--text-primary)' }}>
        {value}
      </div>
      {meta && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Meta: {meta} {metaLabel}
        </div>
      )}
    </div>
  );
}

function LossesHorizontalBar({ data, title, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 200 }}></div>;
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.totalPct), 0.1);
  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">{title}</h3></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
        {data.slice(0, 10).map((row, idx) => {
          const w = (row.totalPct / max) * 100;
          return (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 500 }}>{row.label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.totalPct.toFixed(2)}%</span>
              </div>
              <div style={{ width: '100%', height: '16px', borderRadius: '4px', backgroundColor: 'var(--surface-hover)' }}>
                <div style={{ width: `${w}%`, height: '100%', backgroundColor: '#0EA5E9', borderRadius: '4px', transition: 'width 0.5s' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LossesVerticalBar({ data, title, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 200 }}></div>;
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.perdasT), 1);
  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">{title}</h3></div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '200px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
        {data.slice(0, 10).map((row, idx) => {
          const h = (row.perdasT / max) * 100;
          return (
             <div key={idx} style={{ width: '40px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{row.perdasT.toFixed(1)}</div>
              <div style={{ width: '100%', height: `${h}%`, backgroundColor: '#F88A4E', borderRadius: '4px 4px 0 0', transition: 'height 0.5s' }} />
              <div style={{ fontSize: '0.65rem', textAlign: 'center', marginTop: '8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '50px' }}>
                {String(row.label).split(' ')[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LossesMultiLineChart({ data, loading }) {
  if (loading) return <div className="skeleton-chart" style={{ height: 320 }}></div>;
  if (!data || data.length === 0) return null;

  const width = 800;
  const height = 280;
  const pad = { top: 20, right: 20, bottom: 40, left: 40 };
  const gw = width - pad.left - pad.right;
  const gh = height - pad.top - pad.bottom;

  let maxVal = Math.max(
    ...data.map(d => d.cortePct),
    ...data.map(d => d.carreamentoPct),
    1.00, 0.40 // metas
  );
  if (maxVal === 0) maxVal = 2;
  maxVal = maxVal * 1.2;

  const stepX = data.length > 1 ? gw / (data.length - 1) : gw;
  const pointsCorte = data.map((d, i) => `${pad.left + i * stepX},${pad.top + gh - (d.cortePct / maxVal) * gh}`).join(' ');
  const pointsCarreamento = data.map((d, i) => `${pad.left + i * stepX},${pad.top + gh - (d.carreamentoPct / maxVal) * gh}`).join(' ');

  const yCorteLimit = pad.top + gh - (1.00 / maxVal) * gh; // Meta 1.00%
  const yCarrLimit = pad.top + gh - (0.40 / maxVal) * gh; // Meta 0.40%

  return (
    <div className="card">
      <div className="card-header" style={{ borderBottom: 'none' }}>
        <h3 className="card-title">Perdas por Semana/mês</h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', flexWrap: 'wrap', marginTop: '4px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 3, backgroundColor: '#F88A4E' }}/> Perda corte %</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 3, backgroundColor: '#0EA5E9' }}/> Perda carream. %</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 3, backgroundColor: '#F88A4E', borderTop: '2px dashed #F88A4E', opacity: 0.5 }}/> Limite Corte (1.0%)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 3, backgroundColor: '#0EA5E9', borderTop: '2px dashed #0EA5E9', opacity: 0.5 }}/> Limite Carream. (0.4%)</span>
        </div>
      </div>
      <div style={{ overflowX: 'auto', padding: '0 10px' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '600px' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = pad.top + gh * (1 - ratio);
            return (
              <g key={i}>
                <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--border-color)" />
                <text x={pad.left - 5} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{(maxVal * ratio).toFixed(1)}%</text>
              </g>
            );
          })}
          
          <line x1={pad.left} y1={yCorteLimit} x2={width - pad.right} y2={yCorteLimit} stroke="#F88A4E" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.6" />
          <line x1={pad.left} y1={yCarrLimit} x2={width - pad.right} y2={yCarrLimit} stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.6" />

          <polyline fill="none" stroke="#F88A4E" strokeWidth="2.5" points={pointsCorte} />
          <polyline fill="none" stroke="#0EA5E9" strokeWidth="2.5" points={pointsCarreamento} />

          {data.map((d, i) => {
            const cx = pad.left + i * stepX;
            const cyCorte = pad.top + gh - (d.cortePct / maxVal) * gh;
            const cyCarr = pad.top + gh - (d.carreamentoPct / maxVal) * gh;
            return (
              <g key={i}>
                <circle cx={cx} cy={cyCorte} r="4" fill="#F88A4E" />
                <text x={cx} y={cyCorte - 10} textAnchor="middle" fontSize="9" fill="var(--text-primary)" fontWeight="600">{d.cortePct.toFixed(2)}%</text>
                
                <circle cx={cx} cy={cyCarr} r="4" fill="#0EA5E9" />
                <text x={cx} y={cyCarr + 15} textAnchor="middle" fontSize="9" fill="var(--text-primary)" fontWeight="600">{d.carreamentoPct.toFixed(2)}%</text>
                
                <text x={cx} y={height - 15} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{String(d.label).replace('Semana ', 'S')}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function QualidadeOperacional({
  farmFilter,
  areaFilter,
  periodFilter,
  cycleFilter,
  evaluatorFilter,
  dateFrom,
  dateTo,
  searchTerm,
}) {
  const [activeTab, setActiveTab] = useState('geral');

  const { loading, error, records: allRecords, source } = useCqoData();
  const filtered = useMemo(() => filterRecords(allRecords, {
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    dateFrom,
    dateTo,
    searchTerm,
  }), [allRecords, farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, dateFrom, dateTo, searchTerm]);

  const model = useMemo(() => buildQualidadeOperacional(filtered), [filtered]);
  const lossPctLabel = model.hasProductionBase ? pct(model.lossRates.totalPct) : 'N/D';
  const cortePctLabel = model.hasProductionBase ? pct(model.lossRates.cortePct) : 'N/D';
  const carreamentoPctLabel = model.hasProductionBase ? pct(model.lossRates.carreamentoPct) : 'N/D';

  const fMamandoPct = (model.allTotals.folhaMamando / Math.max(model.allTotals.plantasObservadas, 1)) * 100 || 0;
  const cBrocadoPct = (model.corteTotals.cachoBrocado / Math.max(model.corteTotals.cachosObservados, 1)) * 100 || 0;

  // Calculos para a visao de perdas
  const perdasYtd = model.charts.perdasPctMensal.at(-1)?.perdasYtd || model.totals.perdasT;
  const pesoYtd = model.charts.perdasPctMensal.at(-1)?.pesoYtd || model.totals.producedTon;
  const perdasPctYtd = pesoYtd > 0 ? (perdasYtd / pesoYtd) * 100 : 0;
  const hasBase = model.hasProductionBase;

  return (
    <div className="fade-in page-shell">
      <div className="page-header" style={{ marginBottom: '10px' }}>
        <div className="page-title-block">
          <span className="page-eyebrow">BI Qualidade Operacional</span>
          <h2>Qualidade Agricola e Perdas</h2>
          <p>Visões dinâmicas dos indicadores de campo. Escolha uma aba abaixo para explorar.</p>
        </div>
        <div className="source-card compact">
          <span>Fonte</span>
          <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : source}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('geral')} 
          style={{ padding: '10px 16px', borderBottom: activeTab === 'geral' ? '2px solid var(--green-institutional)' : '2px solid transparent', backgroundColor: 'transparent', fontWeight: activeTab === 'geral' ? 600 : 400, color: activeTab === 'geral' ? 'var(--green-institutional)' : 'var(--text-secondary)', cursor: 'pointer' }}>
          Visão Geral (Misto)
        </button>
        <button 
          onClick={() => setActiveTab('qualidade')} 
          style={{ padding: '10px 16px', borderBottom: activeTab === 'qualidade' ? '2px solid var(--green-institutional)' : '2px solid transparent', backgroundColor: 'transparent', fontWeight: activeTab === 'qualidade' ? 600 : 400, color: activeTab === 'qualidade' ? 'var(--green-institutional)' : 'var(--text-secondary)', cursor: 'pointer' }}>
          Qualidade Agrícola (Power BI)
        </button>
        <button 
          onClick={() => setActiveTab('perdas')} 
          style={{ padding: '10px 16px', borderBottom: activeTab === 'perdas' ? '2px solid var(--orange-institutional)' : '2px solid transparent', backgroundColor: 'transparent', fontWeight: activeTab === 'perdas' ? 600 : 400, color: activeTab === 'perdas' ? 'var(--orange-institutional)' : 'var(--text-secondary)', cursor: 'pointer' }}>
          Perdas Agrícolas (Power BI)
        </button>
      </div>

      {error && (
        <div className="warning-strip">
          <AlertTriangle size={16} />
          <span>Falha ao carregar dados: {error}</span>
        </div>
      )}

      {!model.hasProductionBase && !loading && filtered.length > 0 && (
        <div className="warning-strip">
          <AlertTriangle size={16} />
          <span>Percentuais de perdas dependem da base de balanca/producao. As toneladas ja sao estimadas; os percentuais aparecem como N/D ate essa fonte entrar no payload.</span>
        </div>
      )}
          {activeTab === 'geral' && (
        <div className="fade-in">
          <div className="grid-container grid-cols-4">
            <KpiCard
              title="Perdas t"
              value={`${fmt(model.totals.perdasT, 2)} t`}
              subtitle={`${fmt(model.totals.estimatedCachos)} cachos estimados`}
              icon={Scale}
              tone="danger"
              loading={loading}
            />
            <KpiCard
              title="Perdas %"
              value={lossPctLabel}
              subtitle={`limite geral ${pct(QUALITY_LOSS_LIMITS.totalPct)}`}
              icon={Gauge}
              tone={model.hasProductionBase && model.lossRates.totalPct > QUALITY_LOSS_LIMITS.totalPct ? 'danger' : 'green'}
              loading={loading}
            />
            <KpiCard
              title="Peso t YTD"
              value={`${fmt(model.totals.producedTon, 1)} t`}
              subtitle="base de balanca/producao recebida"
              icon={Truck}
              tone="info"
              loading={loading}
            />
            <KpiCard
              title="Coletas"
              value={fmt(model.allTotals.total)}
              subtitle={`${fmt(model.corteRecords.length)} corte / ${fmt(model.carreamentoRecords.length)} carreamento`}
              icon={ClipboardCheck}
              tone="green"
              loading={loading}
            />
          </div>

          <div className="grid-container grid-cols-3">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Qualidade Agricola</h3>
                  <span className="card-subtitle">Raio-X de Maturação e Anomalias no CQO Corte.</span>
                </div>
                <Leaf size={20} style={{ color: 'var(--green-institutional)' }} />
              </div>
              <MaturationBar verde={model.quality.cachoVerdePct} maduro={model.quality.cachoMaduroPct} passado={model.quality.cachoPassadoPct} loading={loading} />
              <div className="grid-container grid-cols-2" style={{ marginBottom: 0, gap: '12px' }}>
                <QualityMetric loading={loading} label="Avermelhado" value={model.quality.cachoAvermelhadoPct} meta={5} goodWhen="low" />
                <QualityMetric loading={loading} label="Cacho estrela" value={model.quality.cachoEstrelaPct} meta={3} goodWhen="low" />
                <QualityMetric loading={loading} label="Talo comprido" value={model.quality.taloCompridoPct} meta={3} goodWhen="low" />
                <QualityMetric loading={loading} label="Cacho brocado" value={cBrocadoPct} meta={5} goodWhen="low" />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Diagrama de Perdas</h3>
                  <span className="card-subtitle">Impacto de quebras estimadas na produção bruta.</span>
                </div>
                <Target size={20} style={{ color: 'var(--orange-institutional)' }} />
              </div>
              <LossWaterfall totals={model.totals} loading={loading} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <FolhaMamandoAlert count={model.allTotals.folhaMamando || 0} pct={fMamandoPct} loading={loading} />
              
              <div className="card" style={{ flex: 1 }}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Base de Calculo</h3>
                    <span className="card-subtitle">Variaveis que sustentam o BI.</span>
                  </div>
                  <Sprout size={20} style={{ color: 'var(--status-info)' }} />
                </div>
                <div className="compact-list">
                  <div className="compact-row">
                    <div><strong>Cachos observados</strong></div>
                    <div><strong>{fmt(model.corteTotals.cachosObservados)}</strong></div>
                  </div>
                  <div className="compact-row">
                    <div><strong>Esquecidos (Corte)</strong></div>
                    <div><strong>{fmt(model.corteTotals.cachoEsquecido)}</strong></div>
                  </div>
                  <div className="compact-row">
                    <div><strong>Nao carreados (Carream.)</strong></div>
                    <div><strong>{fmt(model.carreamentoTotals.cachoNaoCarreado)}</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid-container grid-cols-3">
            <KpiCard title="Perdas corte t" value={`${fmt(model.totals.corteT, 2)} t`} subtitle={cortePctLabel} icon={Tractor} tone="danger" loading={loading} />
            <KpiCard title="Perdas carreamento t" value={`${fmt(model.totals.carreamentoT, 2)} t`} subtitle={carreamentoPctLabel} icon={Truck} tone="orange" loading={loading} />
            <KpiCard title="Perdas t YTD" value={`${fmt(perdasYtd, 2)} t`} subtitle={`Peso YTD ${fmt(pesoYtd, 1)} t`} icon={BarChart3} tone="info" loading={loading} />
          </div>

          <RiskMatrix parcelas={model.parcelaRows} loading={loading} />

          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header table-card-header">
              <div>
                <h3 className="card-title">Detalhe por Fazenda</h3>
                <span className="card-subtitle">Comparativo de perdas, producao e qualidade com os filtros ativos.</span>
              </div>
              <CheckCircle2 size={20} style={{ color: 'var(--green-institutional)' }} />
            </div>
            <div className="table-wrapper">
              <table className="custom-table dense-table">
                <thead>
                  <tr>
                    <th>Fazenda</th>
                    <th>Coletas</th>
                    <th>Corte t</th>
                    <th>Carreamento t</th>
                    <th>Perdas t</th>
                    <th>Perdas %</th>
                    <th>Cacho maduro %</th>
                    <th>Cacho verde %</th>
                    <th>Talo comprido %</th>
                  </tr>
                </thead>
                <tbody>
                  {model.farmRows.map((row) => (
                    <tr key={row.label}>
                      <td><strong>{row.label}</strong></td>
                      <td>{fmt(row.records.length)}</td>
                      <td>{fmt(row.corteT, 2)}</td>
                      <td>{fmt(row.carreamentoT, 2)}</td>
                      <td>{fmt(row.perdasT, 2)}</td>
                      <td>{row.producedTon > 0 ? pct(row.totalPct) : 'N/D'}</td>
                      <td>{pct(row.qualidade.cachosObservados ? (row.qualidade.cachoMaduro / row.qualidade.cachosObservados) * 100 : 0)}</td>
                      <td>{pct(row.qualidade.cachosObservados ? (row.qualidade.cachoVerde / row.qualidade.cachosObservados) * 100 : 0)}</td>
                      <td>{pct(row.qualidade.cachosObservados ? (row.qualidade.taloComprido / row.qualidade.cachosObservados) * 100 : 0)}</td>
                    </tr>
                  ))}
                  {!loading && model.farmRows.length === 0 && (
                    <tr>
                      <td colSpan="9" className="empty-table-cell">Nenhuma coleta encontrada para os filtros atuais.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'qualidade' && (
        <div className="fade-in">
          <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <QualityScorecard loading={loading} label="Cacho Maduro %" pctValue={model.quality.cachoMaduroPct} meta={85} />
            <QualityScorecard loading={loading} label="Cacho passado %" pctValue={model.quality.cachoPassadoPct} meta={10} />
            <QualityScorecard loading={loading} label="Cacho verde %" pctValue={model.quality.cachoVerdePct} meta={1} />
            <QualityScorecard loading={loading} label="Cacho Avermelhado %" pctValue={model.quality.cachoAvermelhadoPct} meta={4} />
            <QualityScorecard loading={loading} label="Talo Comprido %" pctValue={model.quality.taloCompridoPct} meta={3} />
            <QualityScorecard loading={loading} label="Cacho Estrela %" pctValue={model.quality.cachoEstrelaPct} meta={2} />
          </div>

          <div className="grid-container grid-cols-2">
            <StackedBarHorizontal loading={loading} title="Qualidade por Fazenda" data={model.farmRows} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <StackedBarVertical loading={loading} title="Qualidade por Semana" data={model.weekRows} />
              <EvaluatorRanking loading={loading} data={model.evaluatorRows} />
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <StackedBarVertical loading={loading} title="Qualidade por Dia / Fazenda / Parcela (Timeline Geral)" data={model.dayRows} hideLabels={true} />
          </div>
        </div>
      )}

      {activeTab === 'perdas' && (
        <div className="fade-in">
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* Coluna Esquerda: Scorecards YTD */}
            <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
              <YtdScorecard loading={loading} label="Peso t YTD" value={fmt(pesoYtd, 1)} />
              <YtdScorecard loading={loading} label="Perdas % YTD" value={pct(perdasPctYtd, 2)} />
              <YtdScorecard loading={loading} label="Perdas t YTD" value={fmt(perdasYtd, 2)} />
              
              <YtdScorecard 
                loading={loading} 
                label="Perdas %" 
                value={hasBase ? pct(model.lossRates.totalPct, 2) : 'N/D'} 
                meta={pct(QUALITY_LOSS_LIMITS.totalPct, 2)}
                isDanger={hasBase && model.lossRates.totalPct > QUALITY_LOSS_LIMITS.totalPct}
              />
              <YtdScorecard 
                loading={loading} 
                label="Perdas % Corte" 
                value={hasBase ? pct(model.lossRates.cortePct, 2) : 'N/D'} 
                meta={pct(QUALITY_LOSS_LIMITS.cortePct, 2)}
                isDanger={hasBase && model.lossRates.cortePct > QUALITY_LOSS_LIMITS.cortePct}
              />
              <YtdScorecard 
                loading={loading} 
                label="Perdas % Carreamento" 
                value={hasBase ? pct(model.lossRates.carreamentoPct, 2) : 'N/D'} 
                meta={pct(QUALITY_LOSS_LIMITS.carreamentoPct, 2)}
                isDanger={hasBase && model.lossRates.carreamentoPct > QUALITY_LOSS_LIMITS.carreamentoPct}
              />

              <YtdScorecard loading={loading} label="Perdas Corte (t)" value={fmt(model.totals.corteT, 2)} />
              <YtdScorecard loading={loading} label="Perdas Carreamento (t)" value={fmt(model.totals.carreamentoT, 2)} />
            </div>

            {/* Coluna Direita: Gráficos de Perdas */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '0' }}>
              <div className="grid-container grid-cols-2" style={{ margin: 0 }}>
                <LossesHorizontalBar loading={loading} title="Perdas por Fazenda (%)" data={model.farmRows} />
                <LossesVerticalBar loading={loading} title="Perdas Por Fazenda (t)" data={model.farmRows} />
              </div>
              
              <LossesMultiLineChart loading={loading} data={model.weekRows} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
