import React, { useMemo } from 'react';
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

  return (
    <div className="fade-in page-shell">
      <div className="page-header">
        <div className="page-title-block">
          <span className="page-eyebrow">BI Qualidade Operacional</span>
          <h2>Qualidade Agricola e Perdas</h2>
          <p>Replica operacional dos indicadores do Power BI com dados sincronizados do app e regras de corte, carreamento, metas e YTD.</p>
        </div>
        <div className="source-card compact">
          <span>Fonte</span>
          <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : source}</strong>
        </div>
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
        <KpiCard title="Perdas t YTD" value={`${fmt(model.charts.perdasPctMensal.at(-1)?.perdasYtd || model.totals.perdasT, 2)} t`} subtitle={`Peso YTD ${fmt(model.charts.perdasPctMensal.at(-1)?.pesoYtd || model.totals.producedTon, 1)} t`} icon={BarChart3} tone="info" loading={loading} />
      </div>

      <div className="grid-container grid-cols-2">
        <CustomChart loading={loading} type="bar" data={model.charts.qualidade} title="Qualidade Agricola (%)" targetValue={100} targetLabel="Ideal" />
        <CustomChart loading={loading} type="bar" data={model.charts.perdasPorFazenda} title="Perdas por fazenda (t)" />
      </div>

      <div className="grid-container grid-cols-2">
        <CustomChart loading={loading} type="line" data={model.charts.perdasPctMensal} title="Perdas % mensal" targetValue={QUALITY_LOSS_LIMITS.totalPct} targetLabel="Limite geral" />
        <FormulaCard
          title="Memoria de Calculo"
          lines={[
            {
              label: 'Corte',
              formula: 'Cacho esquecido / plantas observadas * plantas atuais * peso kg / 1000',
              value: `${fmt(model.totals.corteT, 2)} t`,
              note: 'perdas corte t',
            },
            {
              label: 'Carreamento',
              formula: 'Cacho nao carreado / plantas observadas * plantas atuais * peso kg / 1000',
              value: `${fmt(model.totals.carreamentoT, 2)} t`,
              note: 'perdas carreamento t',
            },
            {
              label: 'Percentual',
              formula: 'perdas t / volume produzido ou balanca * 100',
              value: model.hasProductionBase ? pct(model.lossRates.totalPct) : 'N/D',
              note: model.hasProductionBase ? 'base encontrada no payload' : 'aguardando balanca/producao',
            },
          ]}
        />
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

      <div style={{ marginTop: '60px', paddingTop: '40px', borderTop: '2px dashed var(--border-color)' }}>
        <div className="page-title-block" style={{ marginBottom: '20px' }}>
          <span className="page-eyebrow">DASHBOARD EXECUTIVO</span>
          <h2>Qualidade Agrícola (Visão Power BI)</h2>
          <p>Métricas de excelência operacional consolidadas para alta gestão (Substitui visões poluídas do BI antigo).</p>
        </div>

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
    </div>
  );
}
