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
              <span className="card-subtitle">Percentuais sobre os cachos observados no CQO Corte.</span>
            </div>
            <Leaf size={20} style={{ color: 'var(--green-institutional)' }} />
          </div>
          <div className="grid-container grid-cols-3" style={{ marginBottom: 0 }}>
            <QualityMetric loading={loading} label="Cacho maduro" value={model.quality.cachoMaduroPct} meta="quanto maior, melhor" />
            <QualityMetric loading={loading} label="Cacho verde" value={model.quality.cachoVerdePct} meta={8} goodWhen="low" />
            <QualityMetric loading={loading} label="Cacho passado" value={model.quality.cachoPassadoPct} meta={5} goodWhen="low" />
            <QualityMetric loading={loading} label="Avermelhado" value={model.quality.cachoAvermelhadoPct} meta={5} goodWhen="low" />
            <QualityMetric loading={loading} label="Cacho estrela" value={model.quality.cachoEstrelaPct} meta={3} goodWhen="low" />
            <QualityMetric loading={loading} label="Talo comprido" value={model.quality.taloCompridoPct} meta={3} goodWhen="low" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Metas de Perdas</h3>
              <span className="card-subtitle">Limites identificados em Limite Perdas.xlsx.</span>
            </div>
            <Target size={20} style={{ color: 'var(--orange-institutional)' }} />
          </div>
          <div className="quality-stack">
            <QualityMetric loading={loading} label="Perda corte" value={model.hasProductionBase ? model.lossRates.cortePct : null} meta={QUALITY_LOSS_LIMITS.cortePct} goodWhen="low" />
            <QualityMetric loading={loading} label="Perda carreamento" value={model.hasProductionBase ? model.lossRates.carreamentoPct : null} meta={QUALITY_LOSS_LIMITS.carreamentoPct} goodWhen="low" />
            <QualityMetric loading={loading} label="Perda total" value={model.hasProductionBase ? model.lossRates.totalPct : null} meta={QUALITY_LOSS_LIMITS.totalPct} goodWhen="low" />
            <QualityMetric loading={loading} label="Projecao -20%" value={model.projection} meta="media mensal projetada" goodWhen="low" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Base de Calculo</h3>
              <span className="card-subtitle">Variaveis que sustentam as formulas do BI.</span>
            </div>
            <Sprout size={20} style={{ color: 'var(--status-info)' }} />
          </div>
          <div className="compact-list">
            <div className="compact-row">
              <div><strong>Plantas observadas</strong><span>Corte + carreamento</span></div>
              <div><strong>{fmt(model.allTotals.plantasObservadas)}</strong><span>plantas</span></div>
            </div>
            <div className="compact-row">
              <div><strong>Cachos observados</strong><span>Base de qualidade</span></div>
              <div><strong>{fmt(model.corteTotals.cachosObservados)}</strong><span>cachos</span></div>
            </div>
            <div className="compact-row">
              <div><strong>Cachos esquecidos</strong><span>CQO Corte</span></div>
              <div><strong>{fmt(model.corteTotals.cachoEsquecido)}</strong><span>campo</span></div>
            </div>
            <div className="compact-row">
              <div><strong>Cachos nao carreados</strong><span>CQO Carreamento</span></div>
              <div><strong>{fmt(model.carreamentoTotals.cachoNaoCarreado)}</strong><span>campo</span></div>
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

      <div className="card">
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
  );
}
