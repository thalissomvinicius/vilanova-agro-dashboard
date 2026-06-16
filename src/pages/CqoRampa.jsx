import React from 'react';
import { AlertTriangle, Box, ClipboardCheck, Leaf, Scale, Truck } from 'lucide-react';
import { BONIFICACAO_SOURCE, useBonificacaoData } from '../utils/bonificacaoData';

const RAMPA_PRODUCERS = [
  { id: 'fe-em-deus', name: 'FÉ EM DEUS' },
  { id: 'nova-conceicao', name: 'NOVA CONCEIÇÃO' },
  { id: 'vila-nova', name: 'VILA NOVA' },
];

const QUALITY_COLORS = {
  qVerde: '#08A53A',
  qMaduro: '#E66A00',
  qPassado: '#8B5E53',
  qTaloComprido: '#D8C500',
  qAvermelhado: '#EF4444',
  qBucha: '#BDBDBD',
};

function fmt(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/D';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function fmtPct(value, digits = 2) {
  return value === null || value === undefined ? 'N/D' : `${fmt(value, digits)}%`;
}

function weightedAverage(rows, valueKey) {
  const totals = rows.reduce((acc, row) => {
    if (row[valueKey] === null || row[valueKey] === undefined) return acc;
    const weight = Number(row.registros || 0);
    acc.weight += weight;
    acc.value += Number(row[valueKey] || 0) * weight;
    return acc;
  }, { value: 0, weight: 0 });

  return totals.weight ? totals.value / totals.weight : null;
}

function selectedProducerNames(farmFilter) {
  if (farmFilter === 'all') return RAMPA_PRODUCERS.map((producer) => producer.name);
  return RAMPA_PRODUCERS.filter((producer) => producer.id === farmFilter).map((producer) => producer.name);
}

function filterByProducer(rows = [], names = []) {
  const allowed = new Set(names);
  return rows.filter((row) => allowed.has(row.fornecedor || row.fazenda));
}

function aggregateDayRows(rows = []) {
  const buckets = new Map();

  rows.forEach((row) => {
    const key = row.dayKey || 'sem-data';
    const current = buckets.get(key) || {
      dayKey: key,
      dayLabel: row.dayLabel || 'Sem data',
      registros: 0,
      qVerde: 0,
      qMaduro: 0,
      qPassado: 0,
      qTaloComprido: 0,
      pesoT: 0,
    };
    const weight = Number(row.registros || 0);
    current.registros += weight;
    current.qVerde += Number(row.qVerde || 0) * weight;
    current.qMaduro += Number(row.qMaduro || 0) * weight;
    current.qPassado += Number(row.qPassado || 0) * weight;
    current.qTaloComprido += Number(row.qTaloComprido || 0) * weight;
    current.pesoT += Number(row.pesoT || 0);
    buckets.set(key, current);
  });

  return Array.from(buckets.values())
    .map((row) => {
      const weight = Math.max(row.registros, 1);
      return {
        ...row,
        qVerde: row.qVerde / weight,
        qMaduro: row.qMaduro / weight,
        qPassado: row.qPassado / weight,
        qTaloComprido: row.qTaloComprido / weight,
      };
    })
    .sort((a, b) => String(a.dayKey).localeCompare(String(b.dayKey)));
}

function QualityCard({ label, value, meta, icon: Icon, color, warning = false, note }) {
  const hasValue = value !== null && value !== undefined;
  const delta = hasValue && meta !== null && meta !== undefined ? Number(value) - Number(meta) : null;
  return (
    <div className="card rampa-bi-kpi">
      <div className="rampa-bi-kpi-title" style={{ background: color }}>
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <strong style={{ color: warning ? 'var(--status-danger)' : color }}>
        {fmtPct(value)}
        {warning && hasValue ? <small>!</small> : null}
      </strong>
      <span>
        {hasValue && meta !== null && meta !== undefined
          ? `Meta: ${fmt(meta, 0)} (${delta >= 0 ? '+' : ''}${fmt(delta, 1)})`
          : note || 'Campo não disponível na base local'}
      </span>
    </div>
  );
}

function ProducerQualityTable({ rows, total }) {
  const tableRows = [
    ...rows,
    {
      fornecedor: 'Total',
      qVerde: total.qVerde,
      qMaduro: total.qMaduro,
      qPassado: total.qPassado,
      qTaloComprido: total.qTaloComprido,
      qAvermelhado: total.qAvermelhado,
      qBucha: total.qBucha,
      pesoT: total.pesoT,
      isTotal: true,
    },
  ];

  return (
    <div className="card rampa-bi-panel">
      <div className="rampa-bi-panel-title">Média de Qualidade por Produtor (%)</div>
      <div className="table-wrapper">
        <table className="custom-table dense-table rampa-bi-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Q_Verde</th>
              <th>Q_Maduro</th>
              <th>Q_Passado</th>
              <th>Q. talo comp.</th>
              <th>Q_Avermelhado</th>
              <th>Q_Bucha</th>
              <th>Peso t</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.fornecedor} className={row.isTotal ? 'rampa-total-row' : ''}>
                <td><strong>{row.fornecedor}</strong></td>
                <td>{fmt(row.qVerde, 2)}</td>
                <td>{fmt(row.qMaduro, 2)}</td>
                <td>{fmt(row.qPassado, 2)}</td>
                <td>{fmt(row.qTaloComprido, 2)}</td>
                <td>{fmt(row.qAvermelhado, 2)}</td>
                <td>{fmt(row.qBucha, 2)}</td>
                <td>{fmt(row.pesoT, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DailyQualityChart({ rows }) {
  const visibleRows = rows.slice(-15);
  const series = [
    { key: 'qVerde', label: 'Verde', color: QUALITY_COLORS.qVerde },
    { key: 'qMaduro', label: 'Maduro', color: QUALITY_COLORS.qMaduro },
    { key: 'qPassado', label: 'Passado', color: QUALITY_COLORS.qPassado },
  ];

  return (
    <div className="card rampa-bi-panel">
      <div className="rampa-bi-panel-title">Qualidade do CFF Dia[%]</div>
      <div className="rampa-bi-legend">
        {series.map((item) => (
          <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
        ))}
        <span><i style={{ background: QUALITY_COLORS.qAvermelhado }} />Avermelhado indisponível</span>
        <span><i style={{ background: QUALITY_COLORS.qBucha }} />Bucha indisponível</span>
      </div>
      <div className="rampa-bi-day-chart">
        {visibleRows.map((row) => {
          const total = series.reduce((sum, item) => sum + Number(row[item.key] || 0), 0) || 1;
          return (
            <div className="rampa-bi-day" key={row.dayKey}>
              <div className="rampa-bi-day-stack">
                {series.map((item) => {
                  const value = Number(row[item.key] || 0);
                  return (
                    <span
                      key={item.key}
                      style={{ height: `${Math.max((value / total) * 100, value > 0 ? 2 : 0)}%`, background: item.color }}
                      title={`${item.label}: ${fmtPct(value)}`}
                    >
                      {item.key === 'qMaduro' && value >= 20 ? fmt(value, 0) : ''}
                    </span>
                  );
                })}
              </div>
              <strong>{row.dayLabel}</strong>
            </div>
          );
        })}
        {!visibleRows.length ? <div className="empty-panel">Nenhum dado diário encontrado para os filtros atuais.</div> : null}
      </div>
    </div>
  );
}

function SemAvaliacaoTable({ rows }) {
  const total = rows.reduce((sum, row) => sum + Number(row.caixasSemAvaliacao || 0), 0);
  return (
    <div className="card rampa-bi-panel">
      <div className="rampa-bi-panel-title">Caixas sem Avaliação</div>
      <div className="table-wrapper">
        <table className="custom-table dense-table rampa-bi-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Caixas sem avaliação</th>
              <th>Data Entrada mais recente</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.fornecedor}>
                <td><strong>{row.fornecedor}</strong></td>
                <td>{fmt(row.caixasSemAvaliacao)}</td>
                <td>{row.dataEntradaMaisRecente || '--'}</td>
              </tr>
            ))}
            <tr className="rampa-total-row">
              <td><strong>Total</strong></td>
              <td>{fmt(total)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CqoRampa({ farmFilter = 'all' }) {
  const data = useBonificacaoData();
  const rampa = data?.cqoRampa || {};
  const producerNames = selectedProducerNames(farmFilter);
  const producerRows = filterByProducer(rampa.byProducer || [], producerNames);
  const dailyRows = aggregateDayRows(filterByProducer(rampa.byProducerDay || [], producerNames));
  const semAvaliacaoRows = filterByProducer(rampa.semAvaliacao || [], producerNames);
  const total = {
    qVerde: weightedAverage(producerRows, 'qVerde'),
    qMaduro: weightedAverage(producerRows, 'qMaduro'),
    qPassado: weightedAverage(producerRows, 'qPassado'),
    qTaloComprido: weightedAverage(producerRows, 'qTaloComprido'),
    qAvermelhado: weightedAverage(producerRows, 'qAvermelhado'),
    qBucha: weightedAverage(producerRows, 'qBucha'),
    pesoT: producerRows.reduce((sum, row) => sum + Number(row.pesoT || 0), 0),
  };

  return (
    <div className="fade-in page-shell rampa-bi-page">
      <div className="rampa-bi-header">
        <div>
          <span className="page-eyebrow">Qualidade de CFF na Rampa</span>
          <h2>Qualidade de CFF na Rampa</h2>
          <p>Apuração baseada na fonte BI: CQO - Rampa cruzado com Entrada de CFF por ticket e produtor.</p>
        </div>
        <div className="source-card compact">
          <span>Fonte</span>
          <strong>{BONIFICACAO_SOURCE.workbook}</strong>
          <small>{data.generatedAt ? `Atualizado em ${new Date(data.generatedAt).toLocaleString('pt-BR')}` : 'Snapshot local'}</small>
        </div>
      </div>

      <div className="rampa-bi-producer-strip">
        {RAMPA_PRODUCERS.map((producer) => (
          <span key={producer.id} className={producerNames.includes(producer.name) ? 'active' : ''}>
            {producer.name}
          </span>
        ))}
      </div>

      <div className="rampa-bi-kpi-grid">
        <QualityCard label="Verde (%)" value={total.qVerde} meta={5} icon={Leaf} color={QUALITY_COLORS.qVerde} warning={Number(total.qVerde || 0) > 5} />
        <QualityCard label="Maduro (%)" value={total.qMaduro} meta={80} icon={Truck} color={QUALITY_COLORS.qMaduro} warning={Number(total.qMaduro || 0) < 80} />
        <QualityCard label="Passado (%)" value={total.qPassado} meta={5} icon={AlertTriangle} color={QUALITY_COLORS.qPassado} warning={Number(total.qPassado || 0) > 5} />
        <QualityCard label="Cacho Averm. (%)" value={total.qAvermelhado} meta={10} icon={AlertTriangle} color={QUALITY_COLORS.qAvermelhado} />
        <QualityCard label="Talo comprido (%)" value={total.qTaloComprido} meta={3} icon={Scale} color={QUALITY_COLORS.qTaloComprido} warning={Number(total.qTaloComprido || 0) > 3} />
        <QualityCard label="Bucha (%)" value={total.qBucha} meta={0} icon={Box} color={QUALITY_COLORS.qBucha} />
      </div>

      <div className="warning-strip rampa-bi-warning">
        <AlertTriangle size={16} />
        <span>A planilha local não contém as colunas Q_Avermelhado e Q_Bucha que aparecem no BI remoto; por isso estes campos ficam como N/D até recebermos a fonte completa.</span>
      </div>

      <div className="rampa-bi-grid">
        <ProducerQualityTable rows={producerRows} total={total} />
        <DailyQualityChart rows={dailyRows} />
      </div>

      <div className="rampa-bi-grid rampa-bi-grid-bottom">
        <div className="card rampa-bi-panel rampa-bi-empty-panel">
          <div className="rampa-bi-panel-title">Percentual de Caixa sem Avaliação</div>
          <div className="rampa-bi-empty-content">
            <ClipboardCheck size={26} />
            <strong>{fmt(semAvaliacaoRows.reduce((sum, row) => sum + Number(row.caixasSemAvaliacao || 0), 0))}</strong>
            <span>caixas sem avaliação nos produtores selecionados</span>
          </div>
        </div>
        <SemAvaliacaoTable rows={semAvaliacaoRows} />
      </div>
    </div>
  );
}
