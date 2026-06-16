import React from 'react';
import { AlertTriangle, BarChart3, Building2, ClipboardCheck, Leaf, Truck } from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { BONIFICACAO_SOURCE, useBonificacaoData } from '../utils/bonificacaoData';

function fmt(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function KpiCard({ title, value, subtitle, icon: Icon, tone = 'green' }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-body">
        <span className="kpi-value">{value}</span>
      </div>
      <span className="kpi-footer">{subtitle}</span>
    </div>
  );
}

function weightedAverage(rows, valueKey) {
  const totals = rows.reduce((acc, row) => {
    const weight = Number(row.registros || 0);
    acc.weight += weight;
    acc.value += Number(row[valueKey] || 0) * weight;
    return acc;
  }, { value: 0, weight: 0 });

  return totals.weight ? totals.value / totals.weight : 0;
}

export default function CqoRampa() {
  const data = useBonificacaoData();
  const source = data?.available ? data : null;
  const rampa = source?.cqoRampa || {};
  const byMonth = (rampa.byMonth || []).filter((item) => item.monthKey !== 'sem-data');
  const byFarm = rampa.byFarm || [];
  const totalRegistros = rampa.totalRegistros || 0;
  const cmMedia = weightedAverage(byMonth, 'cmMedia');
  const cvMedia = weightedAverage(byMonth, 'cvMedia');
  const cpMedia = weightedAverage(byMonth, 'cpMedia');
  const tcMedia = weightedAverage(byMonth, 'tcMedia');
  const semData = (rampa.byMonth || []).find((item) => item.monthKey === 'sem-data');
  const topFarmRows = [...byFarm].sort((a, b) => Number(b.registros || 0) - Number(a.registros || 0)).slice(0, 12);

  return (
    <div className="fade-in page-shell">
      <div className="page-header">
        <div className="page-title-block">
          <span className="page-eyebrow">CQO Rampa</span>
          <h2>Avaliação da Rampa</h2>
          <p>Visao consolidada da rampa separada do campo. Esta pagina usa a fonte do sistema e nao o fluxo de coleta do app.</p>
        </div>
        <div className="source-card compact">
          <span>Fonte</span>
          <strong>{data.available ? 'Snapshot do sistema' : 'Base local'}</strong>
        </div>
      </div>

      <div className="grid-container grid-cols-4">
        <KpiCard title="Registros" value={fmt(totalRegistros)} subtitle="linhas do CQO de rampa" icon={ClipboardCheck} tone="green" />
        <KpiCard title="Cacho maduro médio" value={`${fmt(cmMedia, 1)}%`} subtitle="média ponderada por registros" icon={Leaf} tone="green" />
        <KpiCard title="Cacho verde médio" value={`${fmt(cvMedia, 1)}%`} subtitle="média ponderada por registros" icon={AlertTriangle} tone={cvMedia > 10 ? 'orange' : 'green'} />
        <KpiCard title="Cacho passado médio" value={`${fmt(cpMedia, 1)}%`} subtitle="média ponderada por registros" icon={Truck} tone={cpMedia > 12 ? 'orange' : 'green'} />
      </div>

      <div className="grid-container grid-cols-4">
        <KpiCard title="Talo comprido médio" value={`${fmt(tcMedia, 1)}%`} subtitle="média ponderada por registros" icon={BarChart3} tone={tcMedia > 6 ? 'orange' : 'green'} />
        <KpiCard title="Origens" value={fmt(byFarm.length)} subtitle="fornecedores/fazendas agrupados" icon={Building2} tone="info" />
        <KpiCard title="Meses" value={fmt(byMonth.length)} subtitle="série temporal com data" icon={BarChart3} tone="green" />
        <KpiCard title="Sem data" value={fmt(semData?.registros || 0)} subtitle="linhas fora da série temporal" icon={ClipboardCheck} tone={(semData?.registros || 0) > 0 ? 'orange' : 'green'} />
      </div>

      <div className="grid-container grid-cols-2">
        <CustomChart
          loading={false}
          type="line"
          data={byMonth.map((item) => ({
            label: item.monthLabel,
            value: Number(item.cmMedia || 0),
            fill: '#D98C10',
          }))}
          title="Cacho maduro médio por mês"
        />
        <CustomChart
          loading={false}
          type="bar"
          data={topFarmRows.map((item) => ({
            label: item.fazenda || '--',
            value: Number(item.cmMedia || 0),
            fill: '#234F2A',
          }))}
          title="Cacho maduro médio por origem"
        />
      </div>

      <div className="card">
        <div className="card-header table-card-header">
          <div>
            <h3 className="card-title">Resumo da rampa</h3>
            <span className="card-subtitle">Fonte usada pelo sistema de bonificacao / qualidade.</span>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="custom-table dense-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Registros</th>
                <th>TCA médio</th>
                <th>CV médio</th>
                <th>CM médio</th>
                <th>CP médio</th>
                <th>TC médio</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((row) => (
                <tr key={row.monthKey}>
                  <td><strong>{row.monthLabel}</strong></td>
                  <td>{fmt(row.registros)}</td>
                  <td>{fmt(row.tcaMedia, 1)}</td>
                  <td>{fmt(row.cvMedia, 1)}</td>
                  <td>{fmt(row.cmMedia, 1)}</td>
                  <td>{fmt(row.cpMedia, 1)}</td>
                  <td>{fmt(row.tcMedia, 1)}</td>
                </tr>
              ))}
              {!byMonth.length && (
                <tr>
                  <td colSpan="7" className="empty-table-cell">Nenhum dado de rampa encontrado no snapshot atual.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Fonte base: {BONIFICACAO_SOURCE.workbook}
        </div>
      </div>
    </div>
  );
}
