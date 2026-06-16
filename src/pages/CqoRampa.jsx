import React from 'react';
import { BarChart3, Building2, ClipboardCheck, Truck } from 'lucide-react';
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

export default function CqoRampa() {
  const data = useBonificacaoData();
  const source = data?.available ? data : null;
  const rampa = source?.cqoRampa || {};
  const byMonth = rampa.byMonth || [];
  const byFarm = rampa.byFarm || [];
  const totalRegistros = rampa.totalRegistros || 0;
  const avgTca = byMonth.length
    ? byMonth.reduce((sum, item) => sum + Number(item.tcaMedia || 0), 0) / byMonth.length
    : 0;

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
        <KpiCard title="TCA médio" value={`${fmt(avgTca, 1)}`} subtitle="média dos meses carregados" icon={Truck} tone="orange" />
        <KpiCard title="Fazendas" value={fmt(byFarm.length)} subtitle="agrupamento por origem" icon={Building2} tone="info" />
        <KpiCard title="Meses" value={fmt(byMonth.length)} subtitle="série temporal disponível" icon={BarChart3} tone="green" />
      </div>

      <div className="grid-container grid-cols-2">
        <CustomChart
          loading={false}
          type="line"
          data={byMonth.map((item) => ({
            label: item.monthLabel,
            value: Number(item.tcaMedia || 0),
            fill: '#D98C10',
          }))}
          title="TCA médio por mês"
        />
        <CustomChart
          loading={false}
          type="bar"
          data={byFarm.slice(0, 12).map((item) => ({
            label: item.fazenda || '--',
            value: Number(item.tcaMedia || 0),
            fill: '#234F2A',
          }))}
          title="TCA médio por fazenda"
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
