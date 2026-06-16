import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Box, ClipboardCheck, Leaf, Maximize2, MonitorPlay, Scale, Truck, X } from 'lucide-react';
import { BONIFICACAO_SOURCE, useBonificacaoData } from '../utils/bonificacaoData';

const RAMPA_PRODUCERS = [
  { id: 'fe-em-deus', name: 'FÉ EM DEUS' },
  { id: 'nova-conceicao', name: 'NOVA CONCEIÇÃO' },
  { id: 'vila-nova', name: 'VILA NOVA' },
];

const QUALITY_COLORS = {
  qVerde: 'var(--green-institutional)',
  qMaduro: 'var(--orange-institutional)',
  qPassado: 'var(--text-primary)',
  qTaloComprido: 'var(--orange-highlight)',
  qAvermelhado: 'var(--status-danger)',
  qBucha: 'var(--text-muted)',
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

function hasQualityValue(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
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

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFromDayKey(dayKey) {
  if (!dayKey || dayKey === 'sem-data') return null;
  const date = new Date(`${dayKey}T12:00:00.000`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDateFromRows(rows = []) {
  return rows.reduce((latest, row) => {
    const date = dateFromDayKey(row.dayKey);
    if (!date) return latest;
    if (!latest || date > latest) return date;
    return latest;
  }, null);
}

function isWithinPeriod(row, periodFilter = 'month', dateFrom = '', dateTo = '', referenceDate = null) {
  const date = dateFromDayKey(row.dayKey);
  if (!date) return periodFilter === 'all' || periodFilter === 'season';

  if (periodFilter === 'custom') {
    const from = parseDateBoundary(dateFrom);
    const to = parseDateBoundary(dateTo, true);
    return (!from || date >= from) && (!to || date <= to);
  }

  if (periodFilter === 'all' || periodFilter === 'season') return true;

  const now = referenceDate || new Date();
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (periodFilter === 'today') return date.toDateString() === now.toDateString();
  if (periodFilter === 'week') return diffDays >= 0 && diffDays <= 7;
  if (periodFilter === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

  return true;
}

function filterByPeriod(rows = [], periodFilter, dateFrom, dateTo, referenceDate = null) {
  return rows.filter((row) => isWithinPeriod(row, periodFilter, dateFrom, dateTo, referenceDate));
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

function aggregateProducerRows(rows = []) {
  const buckets = new Map();

  rows.forEach((row) => {
    const key = row.fornecedor || 'Sem origem';
    const current = buckets.get(key) || {
      fornecedor: key,
      registros: 0,
      qVerde: 0,
      qMaduro: 0,
      qPassado: 0,
      qTaloComprido: 0,
      qAvermelhado: null,
      qBucha: null,
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
    .sort((a, b) => Number(b.pesoT || 0) - Number(a.pesoT || 0));
}

function aggregateSemAvaliacaoRows(rows = []) {
  const buckets = new Map();

  rows.forEach((row) => {
    const key = row.fornecedor || 'Sem origem';
    const current = buckets.get(key) || {
      fornecedor: key,
      caixasSemAvaliacao: 0,
      latestDayKey: '',
      dataEntradaMaisRecente: '',
    };
    current.caixasSemAvaliacao += Number(row.caixasSemAvaliacao || 0);
    if (row.dayKey && row.dayKey > current.latestDayKey) {
      current.latestDayKey = row.dayKey;
      current.dataEntradaMaisRecente = row.dataEntrada || row.dayLabel || '';
    }
    buckets.set(key, current);
  });

  return Array.from(buckets.values())
    .map((row) => ({
      fornecedor: row.fornecedor,
      caixasSemAvaliacao: row.caixasSemAvaliacao,
      dataEntradaMaisRecente: row.dataEntradaMaisRecente,
    }))
    .sort((a, b) => Number(b.caixasSemAvaliacao || 0) - Number(a.caixasSemAvaliacao || 0));
}

function QualityCard({ label, value, meta, icon: Icon, color, warning = false, note, unavailable = false }) {
  const hasValue = hasQualityValue(value);
  const delta = hasValue && meta !== null && meta !== undefined ? Number(value) - Number(meta) : null;
  return (
    <div className={`card rampa-bi-kpi ${hasValue ? '' : 'is-unavailable'}`}>
      <div className="rampa-bi-kpi-title" style={{ background: color }}>
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <strong style={{ color: warning ? 'var(--status-danger)' : color }}>
        {hasValue ? fmtPct(value) : unavailable ? 'Sem coluna' : 'Sem dados'}
        {warning && hasValue ? <small>!</small> : null}
      </strong>
      <span>
        {hasValue && meta !== null && meta !== undefined
          ? `Meta: ${fmt(meta, 0)} (${delta >= 0 ? '+' : ''}${fmt(delta, 1)})`
          : note || 'Nenhum registro no período'}
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
              <th>Peso t</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? tableRows.map((row) => (
              <tr key={row.fornecedor} className={row.isTotal ? 'rampa-total-row' : ''}>
                <td><strong>{row.fornecedor}</strong></td>
                <td>{fmt(row.qVerde, 2)}</td>
                <td>{fmt(row.qMaduro, 2)}</td>
                <td>{fmt(row.qPassado, 2)}</td>
                <td>{fmt(row.qTaloComprido, 2)}</td>
                <td>{fmt(row.pesoT, 2)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="empty-table-cell">Nenhum dado de rampa encontrado para o período selecionado.</td>
              </tr>
            )}
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
      </div>
      <div className="rampa-bi-chart-frame">
        <div className="rampa-bi-y-axis">
          <span>100</span>
          <span>50</span>
          <span>0</span>
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
            {rows.length ? (
              <tr className="rampa-total-row">
                <td><strong>Total</strong></td>
                <td>{fmt(total)}</td>
                <td />
              </tr>
            ) : (
              <tr>
                <td colSpan="3" className="empty-table-cell">Nenhuma caixa sem avaliação no período selecionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RampaDeveloperSignature() {
  return <div className="developer-signature">Desenvolvedor: Vinicius Dev.</div>;
}

function RampaBoard({
  data,
  producerNames,
  producerRows,
  dailyRows,
  semAvaliacaoRows,
  total,
  onPresent,
  presentationMode = false,
}) {
  return (
    <div className={`rampa-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="rampa-bi-header">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="rampa-bi-logo" />
        <div>
          <span className="page-eyebrow">Qualidade de CFF na Rampa</span>
          <h2>Qualidade de CFF na Rampa</h2>
          <p>Apuração baseada na fonte BI: CQO - Rampa cruzado com Entrada de CFF por ticket e produtor.</p>
        </div>
        <div className="rampa-bi-header-actions">
          <div className="source-card compact">
            <span>Fonte</span>
            <strong>{BONIFICACAO_SOURCE.workbook}</strong>
            <small>{data.generatedAt ? `Atualizado em ${new Date(data.generatedAt).toLocaleString('pt-BR')}` : 'Snapshot local'}</small>
          </div>
          {!presentationMode && (
            <button type="button" className="rampa-bi-present-btn" onClick={onPresent}>
              <MonitorPlay size={18} />
              Apresentar
              <Maximize2 size={15} />
            </button>
          )}
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
        <QualityCard label="Cacho Averm. (%)" value={total.qAvermelhado} meta={10} icon={AlertTriangle} color={QUALITY_COLORS.qAvermelhado} note="Aguardando fonte do BI" unavailable />
        <QualityCard label="Talo comprido (%)" value={total.qTaloComprido} meta={3} icon={Scale} color={QUALITY_COLORS.qTaloComprido} warning={Number(total.qTaloComprido || 0) > 3} />
        <QualityCard label="Bucha (%)" value={total.qBucha} meta={0} icon={Box} color={QUALITY_COLORS.qBucha} note="Aguardando fonte do BI" unavailable />
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

      <RampaDeveloperSignature />
    </div>
  );
}

function RampaPresentationOverlay(props) {
  return createPortal(
    <div className="presentation-overlay rampa-presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentacao CQO Rampa">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={props.onClose} title="Fechar apresentacao" aria-label="Fechar apresentacao">
        <X size={22} />
      </button>
      <RampaBoard {...props} presentationMode />
    </div>,
    document.body
  );
}

export default function CqoRampa({ farmFilter = 'all', periodFilter = 'month', dateFrom = '', dateTo = '' }) {
  const [presentationOpen, setPresentationOpen] = useState(false);
  const data = useBonificacaoData();
  const rampa = data?.cqoRampa || {};
  const producerNames = selectedProducerNames(farmFilter);
  const producerDayRows = filterByProducer(rampa.byProducerDay || [], producerNames);
  const semAvaliacaoDayRows = filterByProducer(rampa.semAvaliacaoByDay || [], producerNames);
  const referenceDate = latestDateFromRows([...producerDayRows, ...semAvaliacaoDayRows]);
  const filteredProducerDayRows = filterByPeriod(
    producerDayRows,
    periodFilter,
    dateFrom,
    dateTo,
    referenceDate
  );
  const filteredSemAvaliacaoDayRows = filterByPeriod(
    semAvaliacaoDayRows,
    periodFilter,
    dateFrom,
    dateTo,
    referenceDate
  );
  const producerRows = aggregateProducerRows(filteredProducerDayRows);
  const dailyRows = aggregateDayRows(filteredProducerDayRows);
  const semAvaliacaoRows = aggregateSemAvaliacaoRows(filteredSemAvaliacaoDayRows);
  const total = {
    qVerde: weightedAverage(producerRows, 'qVerde'),
    qMaduro: weightedAverage(producerRows, 'qMaduro'),
    qPassado: weightedAverage(producerRows, 'qPassado'),
    qTaloComprido: weightedAverage(producerRows, 'qTaloComprido'),
    qAvermelhado: weightedAverage(producerRows, 'qAvermelhado'),
    qBucha: weightedAverage(producerRows, 'qBucha'),
    pesoT: producerRows.reduce((sum, row) => sum + Number(row.pesoT || 0), 0),
  };

  useEffect(() => {
    if (!presentationOpen) return undefined;

    document.body.classList.add('presentation-active');

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setPresentationOpen(false);
      }
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
    <div className="fade-in page-shell rampa-bi-page">
      {presentationOpen && (
        <RampaPresentationOverlay
          data={data}
          producerNames={producerNames}
          producerRows={producerRows}
          dailyRows={dailyRows}
          semAvaliacaoRows={semAvaliacaoRows}
          total={total}
          onClose={closePresentation}
        />
      )}

      <RampaBoard
        data={data}
        producerNames={producerNames}
        producerRows={producerRows}
        dailyRows={dailyRows}
        semAvaliacaoRows={semAvaliacaoRows}
        total={total}
        onPresent={openPresentation}
      />
    </div>
  );
}
