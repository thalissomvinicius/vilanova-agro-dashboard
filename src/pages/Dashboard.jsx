import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  MapPin,
  RefreshCcw,
  Rows3,
  Scale,
  Sprout,
  Tractor,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { aggregateRecords, useCqoDashboard } from '../utils/cqoData';

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function KpiCard({ title, value, footer, icon: Icon, tone = 'green', loading = false }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-body">
        <div>
          <span className={`kpi-value ${loading ? 'skeleton-text' : ''}`}>
            {loading ? '\u00A0' : value}
          </span>
        </div>
      </div>
      <span className={`kpi-footer ${loading ? 'skeleton-text skeleton-sm' : ''}`}>
        {loading ? '\u00A0' : footer}
      </span>
    </div>
  );
}

function QualityLine({ label, value, max, color = 'var(--green-institutional)', loading = false }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="quality-line">
      <div className="quality-line-top">
        <span>{label}</span>
        <strong className={loading ? 'skeleton-text' : ''}>{loading ? '\u00A0' : formatNumber(value)}</strong>
      </div>
      <div className={`quality-track ${loading ? 'skeleton-chart' : ''}`} style={{ height: '8px', minHeight: '8px' }}>
        {!loading && <div className="quality-bar" style={{ width: `${percent}%`, background: color }} />}
      </div>
    </div>
  );
}

export default function Dashboard({ farmFilter, areaFilter, periodFilter, cycleFilter, dateFrom, dateTo, searchTerm }) {
  const { loading, records, totals, charts, source, error } = useCqoDashboard({
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    dateFrom,
    dateTo,
    searchTerm,
  });

  const corteRecords = records.filter((record) => record.type === 'corte');
  const carreamentoRecords = records.filter((record) => record.type === 'carreamento');
  const corteTotals = aggregateRecords(corteRecords);
  const carreamentoTotals = aggregateRecords(carreamentoRecords);
  const lastRecord = records[0];

  return (
    <div className="fade-in page-shell">
      <div className="dashboard-page-header">
        <div>
          <span className="page-eyebrow">Qualidade Agrícola / CQO</span>
          <h2>Dashboard de Corte, Carreamento e Fruto Solto</h2>
          <p>
            Visão gerencial das coletas reais enviadas pelo app Android para o Supabase.
          </p>
        </div>
        <div className="source-card">
          <span>Fonte atual</span>
          <strong>{loading ? 'Carregando...' : source}</strong>
          {error ? <small>{error}</small> : <small>{lastRecord ? `Último registro: ${lastRecord.date} ${lastRecord.time}` : 'Sem registros'}</small>}
        </div>
      </div>

      <div className="grid-container grid-cols-4">
        <KpiCard
          title="Coletas recebidas"
          value={formatNumber(totals.total)}
          footer={`${formatNumber(totals.linhas)} linhas avaliadas`}
          icon={ClipboardCheck}
          tone="green"
          loading={loading}
        />
        <KpiCard
          title="CQO Corte"
          value={formatNumber(totals.corte)}
          footer={`${formatNumber(corteTotals.cachosObservados)} cachos observados`}
          icon={Tractor}
          tone="info"
          loading={loading}
        />
        <KpiCard
          title="Carreamento"
          value={formatNumber(totals.carreamento)}
          footer={`${formatNumber(carreamentoTotals.cachoNaoCarreado)} cachos não carreados`}
          icon={Rows3}
          tone="orange"
          loading={loading}
        />
        <KpiCard
          title="Sincronização concluída"
          value={`${totals.syncRate}%`}
          footer={`${formatNumber(totals.sincronizados)} sincronizadas / ${formatNumber(totals.pendentes + totals.falhas)} pendentes`}
          icon={RefreshCcw}
          tone="green"
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-4">
        <KpiCard
          title="GPS capturado"
          value={`${totals.gpsRate}%`}
          footer={`${formatNumber(totals.gps)} registros com ponto`}
          icon={MapPin}
          tone="info"
          loading={loading}
        />
        <KpiCard
          title="Plantas observadas"
          value={formatNumber(totals.plantasObservadas)}
          footer="Base de cálculo das perdas"
          icon={Sprout}
          tone="green"
          loading={loading}
        />
        <KpiCard
          title="Perda no corte"
          value={`${totals.perdaCorteRate}%`}
          footer={`${formatNumber(totals.cachoEsquecido)} cachos esquecidos`}
          icon={AlertTriangle}
          tone="danger"
          loading={loading}
        />
        <KpiCard
          title="Peso fruto solto"
          value={formatNumber(totals.pesoMedio, 1)}
          footer="Soma dos pesos informados"
          icon={Scale}
          tone="orange"
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">CQO Corte destrinchado</h3>
              <span className="card-subtitle">Maturação, perdas e falhas observadas no corte.</span>
            </div>
            <FileSpreadsheet size={20} style={{ color: 'var(--orange-institutional)' }} />
          </div>
          <div className="quality-stack">
            <QualityLine loading={loading} label="Cachos maduros" value={corteTotals.cachoMaduro} max={Math.max(corteTotals.cachosObservados, 1)} />
            <QualityLine loading={loading} label="Cachos verdes" value={corteTotals.cachoVerde} max={Math.max(corteTotals.cachosObservados, 1)} color="var(--status-warning)" />
            <QualityLine loading={loading} label="Cachos passados" value={corteTotals.cachoPassado} max={Math.max(corteTotals.cachosObservados, 1)} color="var(--status-danger)" />
            <QualityLine loading={loading} label="Cachos esquecidos" value={corteTotals.cachoEsquecido} max={Math.max(corteTotals.cachosObservados, 1)} color="var(--orange-institutional)" />
            <QualityLine loading={loading} label="Folha cortada indevida" value={corteTotals.folhaCortada} max={Math.max(corteTotals.plantasObservadas, 1)} color="var(--status-info)" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Carreamento e fruto solto</h3>
              <span className="card-subtitle">Indicadores de posicionamento, transporte e peso de fruto.</span>
            </div>
            <CheckCircle2 size={20} style={{ color: 'var(--green-institutional)' }} />
          </div>
          <div className="quality-stack">
            <QualityLine loading={loading} label="Cachos mal posicionados" value={carreamentoTotals.cachoMalPosicionado} max={Math.max(carreamentoTotals.plantasObservadas, 1)} />
            <QualityLine loading={loading} label="Cachos não carreados" value={carreamentoTotals.cachoNaoCarreado} max={Math.max(carreamentoTotals.plantasObservadas, 1)} color="var(--status-danger)" />
            <QualityLine loading={loading} label="Plantas observadas" value={carreamentoTotals.plantasObservadas} max={Math.max(carreamentoTotals.plantasObservadas, 1)} color="var(--status-info)" />
            <QualityLine loading={loading} label="Peso dos frutos" value={carreamentoTotals.pesoMedio} max={Math.max(carreamentoTotals.pesoMedio, 1)} color="var(--orange-institutional)" />
          </div>
        </div>
      </div>

      <div className="grid-container grid-cols-1">
        <CustomChart loading={loading} type="bar" data={charts.byFarm} title="Coletas por fazenda" />
        <CustomChart loading={loading} type="donut" data={charts.byForm} title="Participação por formulário" />
        <CustomChart loading={loading} type="bar" data={charts.byEvaluator} title="Coletas por avaliador" />
      </div>

      <div className="grid-container grid-cols-1">
        <CustomChart loading={loading} type="line" data={charts.byDay} title="Evolução diária das coletas" />
        <div className="card page-card">
          <div className="card-header table-card-header">
            <div>
              <h3 className="card-title">Últimos registros</h3>
              <span className="card-subtitle">Auditoria rápida do que chegou ao painel.</span>
            </div>
          </div>
          <div className="compact-list">
            {records.slice(0, 6).map((record) => (
              <div className="compact-row" key={record.id}>
                <div>
                  <strong>{record.form}</strong>
                  <span>{record.farm} / Parcela {record.parcel}</span>
                </div>
                <div>
                  <strong>{record.status}</strong>
                  <span>{record.date} {record.time}</span>
                </div>
              </div>
            ))}
            {!records.length && (
              <div className="empty-panel">Nenhum registro encontrado para os filtros atuais.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
