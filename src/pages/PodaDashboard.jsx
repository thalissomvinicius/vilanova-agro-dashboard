/* eslint-disable no-unused-vars -- a tela de poda mantém variantes de apresentação antigas para alternância rápida durante a reunião. */
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CalendarDays,
  Database,
  FileSpreadsheet,
  Filter,
  Maximize2,
  MapPinned,
  MonitorPlay,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import StatusBanner from '../components/ui/StatusBanner';
import { LOCAL_DEMO_MODE, parseRecordDateValue, useCqoDashboard } from '../utils/cqoData';
import { buildPodaOperacional } from '../utils/podaOperacionalData';
import { buildPodaDemoRecords } from '../utils/podaDemoData';

const OPEN_PODA_PRESENTATION_EVENT = 'vilanova:open-poda-presentation';

const LeafletMap = lazy(() => import('../components/LeafletMap'));

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function formatPercent(value, digits = 2) {
  return `${formatNumber(value, digits)}%`;
}

function formatDateBr(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatMonthYear(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return null;
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  const isFullMonth = from.getDate() === 1
    && to.getDate() === lastDay
    && from.getMonth() === to.getMonth()
    && from.getFullYear() === to.getFullYear();
  const isFullYear = from.getDate() === 1
    && from.getMonth() === 0
    && to.getDate() === 31
    && to.getMonth() === 11
    && from.getFullYear() === to.getFullYear();

  if (isFullYear) return String(from.getFullYear());
  if (!isFullMonth) return null;

  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(from);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${from.getFullYear()}`;
}

function periodLabel(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return 'Todos os tempos';
  return formatMonthYear(dateFrom, dateTo)
    || `${formatDateBr(dateFrom) || 'Início'} a ${formatDateBr(dateTo) || 'Fim'}`;
}

function updateLabel(lastSyncTime) {
  const today = new Intl.DateTimeFormat('pt-BR').format(new Date());
  return lastSyncTime ? `${today} ${lastSyncTime}` : new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
}

function safePct(num, den) {
  return den > 0 ? (Number(num || 0) / den) * 100 : 0;
}

function weekNumberLabel(label) {
  const match = String(label || '').match(/S?(\d{1,2})/i);
  return match ? String(Number(match[1])) : label;
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function resolveRecordDate(record) {
  const candidates = [
    record.raw?.data_avaliacao,
    record.raw?.data,
    record.raw?.Data,
    record.sentAt,
    record.createdAt,
    record.date,
  ];

  for (const candidate of candidates) {
    const date = parseRecordDateValue(candidate);
    if (date) return date;
  }

  return null;
}

function latestCollectionLabel(records) {
  const latest = records.reduce((latestDate, record) => {
    const date = resolveRecordDate(record);
    if (!date) return latestDate;
    return !latestDate || date > latestDate ? date : latestDate;
  }, null);

  return latest ? new Intl.DateTimeFormat('pt-BR').format(latest) : '--';
}

function sourceFilterLabel(value) {
  if (value === 'app') return 'Só App';
  if (value === 'excel') return 'Só Excel';
  return 'App + Excel';
}

function farmFilterLabel(value) {
  if (value === 'fe-em-deus') return 'Fé em Deus';
  if (value === 'nova-conceicao') return 'Nova Conceição';
  if (value === 'vila-nova') return 'Vila Nova';
  return 'Todas as fazendas';
}

function dateTimeLabel(value) {
  const date = parseRecordDateValue(value);
  if (!date) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function buildDataDiagnostics({
  allRecords = [],
  mobileRecords = [],
  excelRecords = [],
  visibleRecords = [],
  cqoImport = {},
  filters = {},
}) {
  const rawExcelRows = Number(cqoImport?.corteRows || 0) + Number(cqoImport?.carreamentoRows || 0);
  const transformedRecords = allRecords.length;
  const visibleCount = visibleRecords.length;
  const hiddenByFilters = Math.max(transformedRecords - visibleCount, 0);
  const snapshot = cqoImport?.snapshot || null;
  const updatedAt = snapshot?.updated_at || snapshot?.imported_at || snapshot?.file_last_write_time || '';

  let tone = 'success';
  let status = 'Dados disponíveis';
  let message = 'O pipeline carregou os dados e há registros visíveis nos filtros atuais.';

  if (rawExcelRows > 0 && transformedRecords === 0) {
    tone = 'danger';
    status = 'Falha na transformação';
    message = 'O snapshot CQO tem linhas brutas, mas elas não viraram registros operacionais.';
  } else if (transformedRecords > 0 && visibleCount === 0) {
    tone = 'warning';
    status = 'Filtros sem resultado';
    message = `${formatNumber(transformedRecords)} registro(s) existem na base, mas nenhum passou pelos filtros atuais.`;
  } else if (rawExcelRows === 0 && transformedRecords === 0) {
    tone = 'warning';
    status = 'Sem carga CQO';
    message = 'Nenhum snapshot ou coleta CQO foi encontrado para montar o dashboard.';
  }

  return {
    tone,
    status,
    message,
    rawExcelRows,
    transformedRecords,
    visibleCount,
    hiddenByFilters,
    mobileCount: mobileRecords.length,
    excelCount: excelRecords.length,
    snapshotLabel: snapshot?.source_file || snapshot?.import_key || 'Sem snapshot',
    updatedAtLabel: dateTimeLabel(updatedAt),
    filterLabel: [
      farmFilterLabel(filters.farmFilter),
      sourceFilterLabel(filters.sourceFilter),
      periodLabel(filters.dateFrom, filters.dateTo),
    ].filter(Boolean).join(' · '),
  };
}

function DataHealthPanel({ diagnostics, loading }) {
  const cards = [
    { label: 'Excel bruto', value: diagnostics.rawExcelRows, icon: FileSpreadsheet },
    { label: 'Transformados', value: diagnostics.transformedRecords, icon: Database },
    { label: 'No filtro', value: diagnostics.visibleCount, icon: Filter },
  ];

  return (
    <section className={`field-data-health field-data-health-${diagnostics.tone}`}>
      <div className="field-data-health-status">
        <Database size={18} />
        <div>
          <span>Integridade dos dados</span>
          <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : diagnostics.status}</strong>
          {!loading ? <p>{diagnostics.message}</p> : null}
        </div>
      </div>

      <div className="field-data-health-metrics">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon size={16} />
            <span>{label}</span>
            <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : formatNumber(value)}</strong>
          </div>
        ))}
      </div>

      {!loading ? (
        <div className="field-data-health-meta">
          <span>{diagnostics.snapshotLabel}</span>
          <strong>{diagnostics.updatedAtLabel}</strong>
          <small>{diagnostics.filterLabel}</small>
        </div>
      ) : null}
    </section>
  );
}

function FieldBiEmptyState({ diagnostics, onResetFilters }) {
  const hasDataOutsideFilters = diagnostics.transformedRecords > 0;

  return (
    <div className={`field-bi-empty-state field-bi-empty-${diagnostics.tone}`}>
      <div className="field-bi-empty-icon">
        <AlertTriangle size={30} />
      </div>
      <div>
        <span>{diagnostics.status}</span>
        <h3>{hasDataOutsideFilters ? 'Há dados na base, mas não neste recorte' : 'Nenhum dado CQO disponível'}</h3>
        <p>{diagnostics.message}</p>
        {hasDataOutsideFilters && onResetFilters ? (
          <button type="button" className="btn btn-primary field-bi-empty-action" onClick={onResetFilters}>
            <RotateCcw size={15} />
            Limpar filtros
          </button>
        ) : null}
      </div>
      <div className="field-bi-empty-grid">
        <div><span>Registros na base</span><strong>{formatNumber(diagnostics.transformedRecords)}</strong></div>
        <div><span>Ocultos por filtro</span><strong>{formatNumber(diagnostics.hiddenByFilters)}</strong></div>
        <div><span>Snapshot</span><strong>{diagnostics.updatedAtLabel}</strong></div>
      </div>
    </div>
  );
}

function buildDailyBunchRows(records) {
  const buckets = new Map();

  records
    .filter((record) => record.type === 'poda')
    .forEach((record) => {
      const date = resolveRecordDate(record);
      const sortKey = date ? localDateKey(date) : `sem-data-${record.id}`;
      const label = date
        ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
        : 'Sem data';

      if (!buckets.has(sortKey)) {
        buckets.set(sortKey, {
          sortKey,
          label,
          samples: 0,
          maduro: 0,
          passado: 0,
          verde: 0,
          avermelhado: 0,
          estrela: 0,
          talo: 0,
        });
      }

      const bucket = buckets.get(sortKey);
      bucket.samples += record.totals?.plantasObservadas || record.totals?.plantasLinha || 0;
      bucket.maduro += record.totals?.plantaSemPodar || 0;
      bucket.passado += record.totals?.cachoExposto || 0;
      bucket.verde += record.totals?.podaMeiaCoroa || 0;
      bucket.avermelhado += record.totals?.cachoPodrePlanta || 0;
      bucket.estrela += record.totals?.podaMaiorUmParaUm || 0;
      bucket.talo += record.totals?.bicoGaita || 0;
    });

  return Array.from(buckets.values()).sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
}

function qualityTone(value, meta, goodWhen = 'low') {
  const numeric = Number(value || 0);
  if (goodWhen === 'high') {
    if (numeric >= meta) return { tone: 'green', color: 'var(--status-success)', status: 'Dentro da meta' };
    return { tone: 'danger', color: 'var(--status-danger)', status: 'Fora da meta' };
  }

  if (numeric <= meta) return { tone: 'green', color: 'var(--status-success)', status: 'Dentro da meta' };
  return { tone: 'danger', color: 'var(--status-danger)', status: 'Fora da meta' };
}

function FieldBiKpiCard({ label, value, meta, goodWhen = 'low', loading = false, onClick, active = false }) {
  const tone = qualityTone(value, meta, goodWhen);
  const signal = tone.tone === 'green' ? '✓' : '!';
  const className = `field-bi-kpi field-bi-kpi-${tone.tone} ${active ? 'is-active' : ''}`.trim();
  const content = (
    <>
      <span>{label}</span>
      <strong className={loading ? 'skeleton-text' : ''}>
        {loading ? '\u00A0' : `${formatPercent(value)}${signal}`}
      </strong>
      <small>Meta: {formatPercent(meta)} · {tone.status}</small>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} disabled={loading}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function FieldTotalMetricCard({ label, value, detail, tone = 'neutral', loading = false }) {
  return (
    <div className={`field-total-metric field-total-metric-${tone}`}>
      <span>{label}</span>
      <strong className={loading ? 'skeleton-text' : ''}>{loading ? '\u00A0' : value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

const TOTAL_SECTION_OPTIONS = [
  { id: 'qualidade', label: 'Qualidade' },
  { id: 'falhas', label: 'Falhas' },
  { id: 'amostragem', label: 'Amostragem' },
  { id: 'todos', label: 'Tudo' },
];

const BI_SERIES = [
  { key: 'maduro', sourceKey: 'cachoMaduroPct', label: 'PSP %', fullLabel: 'Planta sem podar %', color: 'var(--orange-institutional)', target: 1 },
  { key: 'passado', sourceKey: 'cachoPassadoPct', label: 'CE %', fullLabel: 'Cacho exposto %', color: 'var(--text-primary)', target: 2 },
  { key: 'verde', sourceKey: 'cachoVerdePct', label: 'PMC %', fullLabel: 'Poda meia coroa %', color: 'var(--green-institutional)', target: 2 },
  { key: 'avermelhado', sourceKey: 'cachoAvermelhadoPct', label: 'CP %', fullLabel: 'Cacho podre %', color: 'var(--status-danger)', target: 1 },
  { key: 'estrela', sourceKey: 'taloCompridoPct', label: 'PM 1:1 %', fullLabel: 'Poda maior 1:1 %', color: '#7C3AED', target: 2 },
  { key: 'talo', sourceKey: 'cachoEstrelaPct', label: 'BG %', fullLabel: 'Bico de gaita %', color: '#2563EB', target: 2 },
];

function qualityValuesFromRow(row) {
  const directValues = {
    maduro: Number(row.cachoMaduroPct || 0),
    passado: Number(row.cachoPassadoPct || 0),
    verde: Number(row.cachoVerdePct || 0),
    avermelhado: Number(row.cachoAvermelhadoPct || 0),
    estrela: Number(row.taloCompridoPct || 0),
    talo: Number(row.cachoEstrelaPct || 0),
    samples: row.recordsCount || 0,
  };

  if (Object.values(directValues).some((value) => Number(value || 0) > 0)) {
    return directValues;
  }

  if (row.qualidade) {
    const base = Math.max(row.qualidade.cachosObservados || 0, 0);
    const plantBase = row.qualidade.podaPlantasObservadas || row.qualidade.plantasObservadas || base;
    return {
      maduro: base ? (row.qualidade.cachoMaduro / base) * 100 : 0,
      passado: base ? (row.qualidade.cachoPassado / base) * 100 : 0,
      verde: base ? (row.qualidade.cachoVerde / base) * 100 : 0,
      avermelhado: base ? (row.qualidade.cachoAvermelhado / base) * 100 : 0,
      estrela: safePct(row.qualidade.podaMaiorUmParaUm, plantBase),
      talo: safePct(row.qualidade.bicoGaita, plantBase),
      samples: base,
    };
  }

  return {
    ...directValues,
  };
}

function dailyQualityValuesFromRow(row) {
  const base = Math.max(Number(row.samples || 0), 0);
  return {
    maduro: safePct(row.maduro, base),
    passado: safePct(row.passado, base),
    verde: safePct(row.verde, base),
    avermelhado: safePct(row.avermelhado, base),
    estrela: safePct(row.estrela, base),
    talo: safePct(row.talo, base),
    samples: base,
  };
}

function primaryPodaSeries(quality) {
  return BI_SERIES
    .map((series) => {
      const value = Number(quality?.[series.sourceKey] || 0);
      return {
        ...series,
        value,
        pressure: series.target > 0 ? value / series.target : value,
      };
    })
    .sort((a, b) => b.pressure - a.pressure || b.value - a.value)[0] || BI_SERIES[1];
}

function riskFromValues(values) {
  return Number(values.passado || 0) + Number(values.verde || 0) + Number(values.avermelhado || 0);
}

function recordFarmLabel(record) {
  return record.farm || 'Sem fazenda';
}

function FieldBiLegend() {
  return (
    <div className="field-bi-legend">
      {BI_SERIES.map((item) => (
        <span key={item.key}><i style={{ background: item.color }} />{item.fullLabel}</span>
      ))}
    </div>
  );
}

function FieldBiFarmChart({ rows, loading = false, selectedLabel = '', onSelect }) {
  const visibleRows = rows.slice(0, 5);

  return (
    <section className="field-bi-panel">
      <h3>Qualidade por Fazenda</h3>
      <FieldBiLegend />
      {loading ? (
        <div className="skeleton-chart" style={{ height: 180 }} />
      ) : (
        <div className="field-bi-farm-chart">
          {visibleRows.map((row) => {
            const values = qualityValuesFromRow(row);
            const active = selectedLabel === row.label;
            return (
              <button
                type="button"
                className={`field-bi-farm-row ${active ? 'is-active' : ''}`.trim()}
                key={row.label}
                onClick={() => onSelect?.(row)}
                aria-pressed={active}
              >
                <strong>{row.label}</strong>
                <div className="field-bi-farm-bars">
                  {BI_SERIES.map((item, index) => {
                    const value = values[item.key];
                    return (
                      <div className="field-bi-farm-bar-line" key={item.key}>
                        <span
                          style={{ width: `${Math.min(value, 100)}%`, background: item.color }}
                          title={`${row.label} - ${item.fullLabel}: ${formatPercent(value)}`}
                        />
                        {index === 0 && <small>{formatPercent(value)}</small>}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
          {!visibleRows.length && <div className="empty-panel smart-empty-panel"><strong>Sem dados de fazenda</strong><span>Troque o mês, ano ou fazenda para localizar coletas já sincronizadas.</span></div>}
        </div>
      )}
      <div className="field-bi-axis"><span>0%</span><span>50%</span><span>100%</span></div>
    </section>
  );
}

function PodaLineMetricSelector({ selectedKey, activeSeries, onSelect }) {
  return (
    <div className="field-line-metric-selector" role="group" aria-label="Indicador exibido no gráfico">
      <button type="button" className={selectedKey === 'all' ? 'active' : ''} onClick={() => onSelect('all')}>
        Todos
      </button>
      {activeSeries.map((series) => (
        <button
          type="button"
          key={series.key}
          className={selectedKey === series.key ? 'active' : ''}
          onClick={() => onSelect(series.key)}
        >
          <i style={{ background: series.color }} />
          {series.label}
        </button>
      ))}
    </div>
  );
}

function PodaTargetLineChart({
  rows,
  loading = false,
  series = BI_SERIES[1],
  title,
  subtitle,
  headerAction = null,
  emptyTitle,
  emptyMessage,
  getValues = qualityValuesFromRow,
  labelForRow = (row) => row.label,
  rowKey = (row) => row.label,
  maxRows = 10,
  minWidth = 560,
  className = '',
}) {
  const visibleRows = rows.slice(-maxRows);
  const normalizedSeries = (Array.isArray(series) ? series : [series]).filter(Boolean);
  const selectedSeries = normalizedSeries.length ? normalizedSeries : [BI_SERIES[1]];
  const isMultiSeries = selectedSeries.length > 1;
  const chartHeight = 244;
  const padding = { top: 30, right: 34, bottom: 42, left: 48 };
  const columnWidth = 88;
  const width = Math.max(minWidth, padding.left + padding.right + Math.max(visibleRows.length - 1, 1) * columnWidth + 54);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const graphWidth = width - padding.left - padding.right;
  const valuesBySeries = selectedSeries.map((item) => ({
    series: item,
    values: visibleRows.map((row, index) => ({
      row,
      key: `${item.key}-${rowKey(row, index)}`,
      label: labelForRow(row),
      value: Number(getValues(row)?.[item.key] || 0),
    })),
  }));
  const maxValue = Math.max(
    ...selectedSeries.map((item) => Number(item.target || 0) * 1.45),
    ...valuesBySeries.flatMap((group) => group.values.map((item) => item.value * 1.18)),
    1
  );
  const yFor = (value) => padding.top + graphHeight - (Math.min(Math.max(value, 0), maxValue) / maxValue) * graphHeight;
  const xFor = (index) => {
    if (visibleRows.length <= 1) return padding.left + graphWidth / 2;
    return padding.left + (index / (visibleRows.length - 1)) * graphWidth;
  };
  const pointGroups = valuesBySeries.map((group) => {
    const points = group.values.map((item, index) => ({ ...item, x: xFor(index), y: yFor(item.value) }));
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const areaPath = points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`
      : '';
    return { ...group, points, linePath, areaPath };
  });
  const targetLines = selectedSeries.map((item) => ({ ...item, y: yFor(Number(item.target || 0)) }));
  const gridValues = Array.from(new Set([0, ...selectedSeries.map((item) => Number(item.target || 0)), Math.ceil(maxValue * 10) / 10]))
    .sort((a, b) => a - b);
  const hasPoints = pointGroups.some((group) => group.points.length);

  return (
    <section className={`field-bi-panel field-poda-line-panel ${className}`.trim()}>
      <div className="field-line-chart-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <div className="field-line-chart-actions">
          {headerAction}
          <div className="field-line-chart-target">
            <strong>{isMultiSeries ? 'Todas' : formatPercent(selectedSeries[0]?.target || 0)}</strong>
            <span>{isMultiSeries ? 'Metas' : 'Meta'}</span>
          </div>
        </div>
      </div>
      <div className="field-daily-legend">
        {selectedSeries.map((item) => (
          <span key={item.key}><i style={{ background: item.color }} />{item.fullLabel}</span>
        ))}
        <span><i className="field-target-dot" />{isMultiSeries ? 'Linhas de meta' : 'Linha da meta'}</span>
      </div>
      {loading ? (
        <div className="skeleton-chart" style={{ height: chartHeight }} />
      ) : (
        <div className="field-bi-week-scroll">
          {hasPoints ? (
            <svg className="field-bi-week-chart" viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight}>
              {gridValues.map((gridValue) => {
                const y = yFor(gridValue);
                return (
                  <g key={gridValue}>
                    <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />
                    <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
                      {formatPercent(gridValue, gridValue >= 10 ? 0 : 1)}
                    </text>
                  </g>
                );
              })}
              {targetLines.map((targetLine, index) => (
                <g key={`target-${targetLine.key}`}>
                  <line
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={targetLine.y}
                    y2={targetLine.y}
                    className="field-target-line"
                    style={{ stroke: targetLine.color, opacity: isMultiSeries ? 0.45 : 0.95 }}
                  />
                  {(!isMultiSeries || index === targetLines.length - 1) ? (
                    <text x={width - padding.right - 4} y={targetLine.y - 7} textAnchor="end" className="field-target-label" style={{ fill: targetLine.color }}>
                      Meta {formatPercent(targetLine.target)}
                    </text>
                  ) : null}
                </g>
              ))}
              {pointGroups.map((group) => (
                <g key={`line-${group.series.key}`}>
                  {!isMultiSeries && group.areaPath ? <path d={group.areaPath} fill={group.series.color} className="field-line-area" /> : null}
                  {group.linePath ? <path d={group.linePath} stroke={group.series.color} className="field-line-path" /> : null}
                  {group.points.map((point) => {
                    const overTarget = point.value > Number(group.series.target || 0);
                    return (
                      <g key={point.key}>
                        {!isMultiSeries ? <line x1={point.x} x2={point.x} y1={padding.top + graphHeight} y2={padding.top + graphHeight + 5} className="chart-grid-line" /> : null}
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={isMultiSeries ? 4.3 : 5.5}
                          className={`field-line-point ${overTarget ? 'is-over-target' : 'is-under-target'}`}
                          style={{ fill: group.series.color }}
                        >
                          <title>{`${point.label} - ${group.series.fullLabel}: ${formatPercent(point.value)} | Meta: ${formatPercent(group.series.target)}`}</title>
                        </circle>
                        {!isMultiSeries ? (
                          <text
                            x={point.x}
                            y={point.y - 11}
                            textAnchor="middle"
                            className={`field-line-value ${overTarget ? 'is-over-target' : ''}`}
                          >
                            {formatPercent(point.value, 1)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              ))}
              {visibleRows.map((row, index) => (
                <text key={`axis-${rowKey(row, index)}`} x={xFor(index)} y={chartHeight - 12} textAnchor="middle" className="chart-axis-text">
                  {labelForRow(row)}
                </text>
              ))}
            </svg>
          ) : (
            <div className="empty-panel smart-empty-panel"><strong>{emptyTitle}</strong><span>{emptyMessage}</span></div>
          )}
        </div>
      )}
    </section>
  );
}

function FieldBiEvolutionChart({
  weekRows,
  monthRows,
  loading = false,
  series = BI_SERIES[1],
  mode = 'week',
  onModeChange,
}) {
  const selectedSeries = Array.isArray(series) ? series : [series];
  const chartLabel = selectedSeries.length > 1 ? 'todos os indicadores' : selectedSeries[0]?.fullLabel;
  const isMonth = mode === 'month';
  return (
    <PodaTargetLineChart
      rows={isMonth ? monthRows : weekRows}
      loading={loading}
      series={series}
      title={`Evolução ${isMonth ? 'mensal' : 'semanal'} - ${chartLabel}`}
      subtitle={isMonth ? 'Comparação por mês para enxergar tendência contra períodos anteriores.' : 'Linha do indicador contra a meta operacional.'}
      headerAction={(
        <div className="field-evolution-switch" role="group" aria-label="Granularidade da evolução">
          <button type="button" className={!isMonth ? 'active' : ''} onClick={() => onModeChange?.('week')}>Semanal</button>
          <button type="button" className={isMonth ? 'active' : ''} onClick={() => onModeChange?.('month')}>Mensal</button>
        </div>
      )}
      emptyTitle={isMonth ? 'Sem meses no filtro' : 'Sem semanas no filtro'}
      emptyMessage={isMonth ? 'Libere o filtro de mês ou amplie o período para comparar meses anteriores.' : 'A visão semanal aparece quando houver coletas dentro do período selecionado.'}
      labelForRow={(row) => (isMonth ? row.label : weekNumberLabel(row.label))}
      rowKey={(row) => row.sortKey || row.label}
      maxRows={isMonth ? 12 : 10}
      minWidth={620}
    />
  );
}

function FiscalQualityCards({ rows, loading = false, selectedLabel = '', onSelect }) {
  const visibleRows = rows
    .map((row) => {
      const risk = riskFromValues({
        passado: row.cachoPassadoPct,
        verde: row.cachoVerdePct,
        avermelhado: row.cachoAvermelhadoPct,
      });
      return {
        ...row,
        risk,
        tone: risk > 8 ? 'danger' : risk > 4 ? 'warning' : 'success',
      };
    })
    .sort((a, b) => b.risk - a.risk || b.recordsCount - a.recordsCount)
    .slice(0, 4);

  return (
    <section className="field-bi-panel field-bi-evaluators">
      {loading ? (
        <div className="skeleton-chart" style={{ height: 196 }} />
      ) : (
        <>
          <div className="field-bi-evaluator-head">
            <h3>Fiscal responsável</h3>
            <span>{selectedLabel ? 'fiscal em análise' : 'clique para analisar'}</span>
          </div>
          {visibleRows.map((row) => {
            const active = selectedLabel === row.label;
            return (
              <button
                type="button"
                className={`field-bi-evaluator-card field-bi-evaluator-${row.tone} ${active ? 'is-active' : ''}`.trim()}
                key={row.label}
                onClick={() => onSelect?.(row)}
                aria-pressed={active}
              >
                <strong>
                  <span>{row.label}</span>
                  <em>{formatPercent(row.risk)} risco</em>
                </strong>
                <div>
                  <span><b>{formatPercent(row.cachoPassadoPct)}</b>Cacho exposto %</span>
                  <span><b>{formatPercent(row.cachoVerdePct)}</b>Poda meia coroa %</span>
                  <span><b>{formatPercent(row.cachoMaduroPct)}</b>Planta sem podar %</span>
                </div>
                <small>{formatNumber(row.recordsCount)} coleta(s) · {active ? 'em análise' : row.tone === 'danger' ? 'prioridade alta' : row.tone === 'warning' ? 'acompanhar' : 'controlado'}</small>
              </button>
            );
          })}
          {!visibleRows.length && <div className="empty-panel smart-empty-panel"><strong>Sem fiscais</strong><span>Nenhuma coleta do período trouxe fiscal responsável válido.</span></div>}
        </>
      )}
    </section>
  );
}

function DailyBunchBarChart({ rows, loading = false, series = BI_SERIES[1] }) {
  const selectedSeries = Array.isArray(series) ? series : [series];
  const chartLabel = selectedSeries.length > 1 ? 'todos os indicadores' : selectedSeries[0]?.fullLabel;
  return (
    <PodaTargetLineChart
      rows={rows}
      loading={loading}
      series={series}
      title={`Evolução diária - ${chartLabel}`}
      subtitle="Percentual diário sobre plantas avaliadas, comparado com a meta."
      emptyTitle="Sem dados diários"
      emptyMessage="O gráfico por dia será montado quando houver coletas no período selecionado."
      getValues={dailyQualityValuesFromRow}
      labelForRow={(row) => row.label}
      rowKey={(row) => row.sortKey}
      maxRows={12}
      minWidth={760}
      className="field-bi-daily-panel"
    />
  );
}

function buildTotalMetricGroups(model) {
  const totals = model.podaTotals || {};
  const basePlantas = Math.max(totals.podaPlantasObservadas || 0, 0);
  const quality = model.quality || {};

  return [
    {
      id: 'qualidade',
      title: 'Indicadores de qualidade da poda',
      cards: [
        { label: 'Planta sem podar', value: formatPercent(quality.cachoMaduroPct), detail: `${formatNumber(totals.plantaSemPodar)} plantas`, tone: quality.cachoMaduroPct > 1 ? 'danger' : 'success' },
        { label: 'Cacho exposto', value: formatPercent(quality.cachoPassadoPct), detail: `${formatNumber(totals.cachoExposto)} ocorrências`, tone: quality.cachoPassadoPct > 2 ? 'danger' : 'neutral' },
        { label: 'Poda meia coroa', value: formatPercent(quality.cachoVerdePct), detail: `${formatNumber(totals.podaMeiaCoroa)} ocorrências`, tone: quality.cachoVerdePct > 2 ? 'warning' : 'neutral' },
        { label: 'Cacho podre', value: formatPercent(quality.cachoAvermelhadoPct), detail: `${formatNumber(totals.cachoPodrePlanta)} ocorrências`, tone: quality.cachoAvermelhadoPct > 1 ? 'danger' : 'neutral' },
        { label: 'Poda maior 1:1', value: formatPercent(quality.taloCompridoPct), detail: `${formatNumber(totals.podaMaiorUmParaUm)} ocorrências`, tone: quality.taloCompridoPct > 2 ? 'warning' : 'neutral' },
        { label: 'Bico de gaita', value: formatPercent(quality.cachoEstrelaPct), detail: `${formatNumber(totals.bicoGaita)} ocorrências`, tone: quality.cachoEstrelaPct > 2 ? 'warning' : 'neutral' },
        { label: 'Folha mamando', value: formatPercent(quality.cachoInfermoPct), detail: `${formatNumber(totals.folhaMamando)} ocorrências`, tone: 'warning' },
        { label: 'Palha mal empilhada', value: formatPercent(quality.buchaPct), detail: `${formatNumber(totals.palhaMalEmpilhada)} ocorrências`, tone: 'warning' },
      ],
    },
    {
      id: 'falhas',
      title: 'Projeções e ocorrências',
      cards: [
        { label: 'Planta sem podar (proj.)', value: formatNumber(totals.plantaSemPodarProjetada), detail: `${formatPercent(quality.cachoMaduroPct)} da amostra`, tone: 'danger' },
        { label: 'Cacho exposto (proj.)', value: formatNumber(totals.cachoExpostoProjetado), detail: `${formatPercent(quality.cachoPassadoPct)} da amostra`, tone: 'warning' },
        { label: 'Poda meia coroa (proj.)', value: formatNumber(totals.podaMeiaCoroaProjetada), detail: `${formatPercent(quality.cachoVerdePct)} da amostra`, tone: 'warning' },
        { label: 'Total projetado', value: formatNumber(totals.ocorrenciasPodaProjetadas), detail: 'soma das projeções', tone: 'neutral' },
        { label: 'Plantas projetadas', value: formatNumber(totals.plantasProjetadas), detail: 'base da projeção', tone: 'neutral' },
        { label: 'Fichas com projeção', value: formatNumber(totals.podaComProjecao), detail: 'coletas com total de plantas', tone: 'neutral' },
      ],
    },
    {
      id: 'amostragem',
      title: 'Amostragem e auditoria',
      cards: [
        { label: 'Fichas de poda', value: formatNumber(model.podaRecords.length), detail: 'coletas no filtro', tone: 'success' },
        { label: 'Linhas avaliadas', value: formatNumber(totals.linhas), detail: 'linhas/ruas amostradas', tone: 'neutral' },
        { label: 'Plantas observadas', value: formatNumber(basePlantas), detail: 'base da auditoria', tone: 'neutral' },
        {
          label: 'Registros com GPS',
          value: `${formatNumber(totals.gps)} / ${formatNumber(totals.gpsEligible)}`,
          detail: totals.gpsEligible === totals.total ? `${formatNumber(totals.gpsRate)}% das fichas` : `${formatNumber(totals.gpsRate)}% das coletas do app`,
          tone: 'success',
        },
        { label: 'Pontos GPS', value: formatNumber(totals.gpsPoints), detail: `${formatNumber(totals.gpsOccurrences)} ocorrências`, tone: 'neutral' },
        { label: 'Score poda', value: formatNumber(totals.podaScore), detail: 'nota técnica da poda', tone: totals.podaScore >= 85 ? 'success' : 'warning' },
      ],
    },
  ];
}

function FieldTotalDataPanel({ model, selectedSection, loading = false }) {
  const groups = buildTotalMetricGroups(model)
    .filter((group) => selectedSection === 'todos' || group.id === selectedSection);
  const farmRows = model.farmRows.slice(0, 8);

  return (
    <div className={`field-total-panel ${groups.length === 1 ? 'is-single-section' : ''}`}>
      {groups.map((group) => (
        <section className="field-total-section" key={group.id}>
          <h3>{group.title}</h3>
          <div className="field-total-metric-grid">
            {group.cards.map((card) => (
              <FieldTotalMetricCard
                key={`${group.id}-${card.label}`}
                loading={loading}
                {...card}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="field-total-section field-total-table-section">
        <h3>Resumo por fazenda</h3>
        <div className="field-total-table-wrap">
          <table className="field-total-table">
            <thead>
              <tr>
                <th>Fazenda</th>
                <th>Coletas</th>
                <th>Sem podar</th>
                <th>Meia coroa</th>
                <th>Cacho exposto</th>
                <th>Cacho podre</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {farmRows.map((row) => {
                const values = qualityValuesFromRow(row);
                const totals = row.qualidade || {};
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatNumber(row.records?.length || row.recordsCount || 0)}</td>
                    <td>{formatPercent(values.maduro)}</td>
                    <td>{formatPercent(values.verde)}</td>
                    <td>{formatPercent(values.passado)}</td>
                    <td>{formatPercent(values.avermelhado)}</td>
                    <td>{formatNumber(row.podaScore ?? totals.podaScore)}</td>
                  </tr>
                );
              })}
              {!farmRows.length ? (
                <tr>
                  <td colSpan="7">Sem fazendas no filtro atual.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FieldBiBoard({
  loading,
  model,
  quality,
  dailyBunchRows,
  periodText,
  updateText,
  latestCollectionText,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  boardMode,
  setBoardMode,
  totalSection,
  setTotalSection,
  diagnostics,
  recordCount,
  onResetFilters,
  onPresent,
  onOpenGeoQuality,
  presentationMode = false,
}) {
  const isTotalMode = !presentationMode && boardMode === 'total';
  const [selectedLineKey, setSelectedLineKey] = useState('all');
  const [selectedFiscalLabel, setSelectedFiscalLabel] = useState('');
  const [selectedFarmLabel, setSelectedFarmLabel] = useState('');
  const [evolutionMode, setEvolutionMode] = useState('week');
  const farmFilteredModel = useMemo(() => {
    if (!selectedFarmLabel) return model;
    return buildPodaOperacional(model.records.filter((record) => recordFarmLabel(record) === selectedFarmLabel));
  }, [model, selectedFarmLabel]);
  const selectedFiscalRow = useMemo(
    () => farmFilteredModel.evaluatorRows.find((row) => row.label === selectedFiscalLabel) || null,
    [farmFilteredModel.evaluatorRows, selectedFiscalLabel]
  );
  const farmChartModel = useMemo(() => {
    if (!selectedFiscalRow?.records?.length) return model;
    return buildPodaOperacional(selectedFiscalRow.records);
  }, [model, selectedFiscalRow]);
  const selectedFarmRow = useMemo(
    () => farmChartModel.farmRows.find((row) => row.label === selectedFarmLabel) || null,
    [farmChartModel.farmRows, selectedFarmLabel]
  );
  const focusedRecords = useMemo(() => {
    const sourceRecords = selectedFiscalRow?.records?.length ? selectedFiscalRow.records : model.records;
    if (!selectedFarmLabel) return sourceRecords;
    return sourceRecords.filter((record) => recordFarmLabel(record) === selectedFarmLabel);
  }, [model.records, selectedFarmLabel, selectedFiscalRow]);
  const hasFocus = Boolean(selectedFiscalRow || selectedFarmLabel);
  const focusedModel = useMemo(
    () => (hasFocus ? buildPodaOperacional(focusedRecords) : model),
    [focusedRecords, hasFocus, model]
  );
  const focusedDailyRows = useMemo(
    () => (hasFocus ? buildDailyBunchRows(focusedRecords) : dailyBunchRows),
    [dailyBunchRows, focusedRecords, hasFocus]
  );
  const focusedQuality = focusedModel.quality || quality;
  const selectedSeries = selectedLineKey === 'all'
    ? BI_SERIES
    : [BI_SERIES.find((series) => series.key === selectedLineKey) || primaryPodaSeries(focusedQuality)];

  const handleSelectFiscal = (row) => {
    setSelectedFiscalLabel((current) => (current === row.label ? '' : row.label));
  };

  const handleSelectFarm = (row) => {
    setSelectedFarmLabel((current) => (current === row.label ? '' : row.label));
  };

  const clearFocus = () => {
    setSelectedFiscalLabel('');
    setSelectedFarmLabel('');
  };

  return (
    <div className={`field-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="field-bi-header">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="field-bi-logo" />
        <div className="field-bi-title-block">
          <h2>Qualidade Agrícola</h2>
          <div className="field-bi-meta-line">
            <span><CalendarDays size={14} />{periodText}</span>
            <span><RefreshCw size={14} />Atualizado: {updateText}</span>
            <span><CalendarDays size={14} />Última coleta: {latestCollectionText}</span>
          </div>
        </div>
        {!presentationMode && (
          <div className="field-bi-header-actions">
            <button type="button" className="field-bi-map-btn" onClick={onOpenGeoQuality}>
              <MapPinned size={17} />
              Qualidade por parcela
            </button>
            <button type="button" className="field-bi-present-btn" onClick={onPresent}>
              <MonitorPlay size={18} />
              Apresentar
              <Maximize2 size={15} />
            </button>
          </div>
        )}
      </div>

      {!presentationMode ? (
        <div className="field-bi-control-bar">
          <div className="field-bi-mode-switch" role="group" aria-label="Modo de visualização CQO Poda">
            <button type="button" className={!isTotalMode ? 'active' : ''} onClick={() => setBoardMode('meeting')}>
              <MonitorPlay size={15} />
              Dados de apresentação
            </button>
            <button type="button" className={isTotalMode ? 'active' : ''} onClick={() => setBoardMode('total')}>
              <SlidersHorizontal size={15} />
              Dados totais
            </button>
          </div>

          {isTotalMode ? (
            <div className="field-total-filters">
              <label>
                <span>Exibir</span>
                <select value={totalSection} onChange={(event) => setTotalSection(event.target.value)}>
                  {TOTAL_SECTION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              {setDateFrom && setDateTo ? (
                <>
                  <label>
                    <span>De</span>
                    <input type="date" value={dateFrom || ''} onChange={(event) => setDateFrom(event.target.value)} />
                  </label>
                  <label>
                    <span>Até</span>
                    <input type="date" value={dateTo || ''} onChange={(event) => setDateTo(event.target.value)} />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && recordCount === 0 ? (
        <FieldBiEmptyState diagnostics={diagnostics} onResetFilters={onResetFilters} />
      ) : !isTotalMode ? (
        <>
          <div className="field-bi-kpi-grid">
            <FieldBiKpiCard loading={loading} label="Planta sem podar %" value={focusedQuality.cachoMaduroPct} meta={1} active={selectedLineKey === 'maduro'} onClick={() => setSelectedLineKey('maduro')} />
            <FieldBiKpiCard loading={loading} label="Cacho exposto %" value={focusedQuality.cachoPassadoPct} meta={2} active={selectedLineKey === 'passado'} onClick={() => setSelectedLineKey('passado')} />
            <FieldBiKpiCard loading={loading} label="Poda meia coroa %" value={focusedQuality.cachoVerdePct} meta={2} active={selectedLineKey === 'verde'} onClick={() => setSelectedLineKey('verde')} />
            <FieldBiKpiCard loading={loading} label="Cacho podre %" value={focusedQuality.cachoAvermelhadoPct} meta={1} active={selectedLineKey === 'avermelhado'} onClick={() => setSelectedLineKey('avermelhado')} />
            <FieldBiKpiCard loading={loading} label="Poda maior 1:1 %" value={focusedQuality.taloCompridoPct} meta={2} active={selectedLineKey === 'estrela'} onClick={() => setSelectedLineKey('estrela')} />
            <FieldBiKpiCard loading={loading} label="Bico de gaita %" value={focusedQuality.cachoEstrelaPct} meta={2} active={selectedLineKey === 'talo'} onClick={() => setSelectedLineKey('talo')} />
          </div>

          <PodaLineMetricSelector
            selectedKey={selectedLineKey}
            activeSeries={BI_SERIES}
            onSelect={setSelectedLineKey}
          />

          {selectedFiscalRow || selectedFarmRow ? (
            <div className="field-bi-focus-chip">
              <span>Filtro da análise</span>
              {selectedFarmRow ? <strong>Fazenda: {selectedFarmRow.label}</strong> : null}
              {selectedFiscalRow ? <strong>Fiscal: {selectedFiscalRow.label}</strong> : null}
              <em>{formatNumber(focusedModel.records.length)} coleta(s)</em>
              <button type="button" onClick={clearFocus}>Ver todos</button>
            </div>
          ) : null}

          <div className="field-bi-main-grid">
            <FieldBiFarmChart
              rows={farmChartModel.farmRows}
              loading={loading}
              selectedLabel={selectedFarmLabel}
              onSelect={handleSelectFarm}
            />
            <FieldBiEvolutionChart
              weekRows={focusedModel.weekRows}
              monthRows={focusedModel.monthRows}
              loading={loading}
              series={selectedSeries}
              mode={evolutionMode}
              onModeChange={setEvolutionMode}
            />
            <FiscalQualityCards
              rows={farmFilteredModel.evaluatorRows}
              loading={loading}
              selectedLabel={selectedFiscalLabel}
              onSelect={handleSelectFiscal}
            />
          </div>

          <DailyBunchBarChart rows={focusedDailyRows} loading={loading} series={selectedSeries} />
        </>
      ) : (
        <FieldTotalDataPanel model={model} selectedSection={totalSection} loading={loading} />
      )}

    </div>
  );
}

function PresentationOverlay(props) {
  return createPortal(
    <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentacao em tela cheia">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={props.onClose} title="Fechar apresentacao" aria-label="Fechar apresentacao">
        <X size={22} />
      </button>
      <div className="presentation-scroll">
        <FieldBiBoard {...props} presentationMode />
      </div>
    </div>,
    document.body
  );
}

function FieldGeoQualityOverlay({ mapProps, periodText, updateText, latestCollectionText, onClose }) {
  return createPortal(
    <div className="field-map-overlay" role="dialog" aria-modal="true" aria-label="Qualidade por parcela no mapa">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={onClose} title="Fechar mapa" aria-label="Fechar mapa">
        <X size={22} />
      </button>
      <section className="field-map-dialog">
        <header className="field-map-header">
          <img src="/logo.png" alt="Vila Nova Agroindustrial" />
          <div>
            <span>Georreferenciamento CQO Poda</span>
            <h2>Qualidade por parcela</h2>
            <p>Shapes das parcelas com semáforo de qualidade da poda, filtros atuais e detalhe por fazenda, parcela, fiscal e período.</p>
          </div>
          <div className="field-map-context">
            <span>{periodText}</span>
            <span>Atualizado: {updateText}</span>
            <span>Última coleta: {latestCollectionText}</span>
          </div>
        </header>
        <div className="field-map-frame">
          <Suspense
            fallback={(
              <div className="field-map-suspense">
                <div className="gps-map-loading-spinner" />
                <strong>Carregando mapa das parcelas</strong>
                <span>Preparando shapefiles e indicadores de qualidade.</span>
              </div>
            )}
          >
            <LeafletMap
              {...mapProps}
              areaFilter="poda"
              initialOperation="poda"
              initialMetricId="poda_planta_sem_podar"
            />
          </Suspense>
        </div>
      </section>
    </div>,
    document.body
  );
}

export default function PodaDashboard({ theme, farmFilter, areaFilter = 'poda', periodFilter, cycleFilter, evaluatorFilter, sourceFilter = 'all', dateFrom, dateTo, setDateFrom, setDateTo, searchTerm, lastSyncTime, onResetFilters }) {
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [geoQualityOpen, setGeoQualityOpen] = useState(false);
  const [boardMode, setBoardMode] = useState('meeting');
  const [totalSection, setTotalSection] = useState('qualidade');
  const {
    loading,
    records,
    allRecords = [],
    mobileRecords = [],
    excelRecords = [],
    cqoImport = {},
    error,
  } = useCqoDashboard({
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    searchTerm,
  });

  const demoRecords = useMemo(() => buildPodaDemoRecords(), []);
  const mergedRecords = useMemo(() => {
    const realPoda = records.filter((record) => record.type === 'poda');
    return [...demoRecords, ...realPoda];
  }, [records, demoRecords]);

  const model = useMemo(() => buildPodaOperacional(mergedRecords), [mergedRecords]);
  const dailyBunchRows = useMemo(() => buildDailyBunchRows(mergedRecords), [mergedRecords]);
  const quality = model.quality;
  const periodText = periodLabel(dateFrom, dateTo);
  const updateText = updateLabel(lastSyncTime);
  const latestCollectionText = loading ? 'Carregando...' : latestCollectionLabel(mergedRecords);
  const diagnostics = useMemo(() => {
    const podaAll = allRecords.filter((record) => record.type === 'poda');
    const visibleCount = mergedRecords.length;
    const transformedRecords = podaAll.length + demoRecords.length;
    const hiddenByFilters = Math.max(podaAll.length - records.filter((r) => r.type === 'poda').length, 0);

    let tone = 'success';
    let status = 'Dados disponíveis';
    let message = 'O pipeline carregou os dados e há registros visíveis nos filtros atuais.';

    if (transformedRecords > 0 && visibleCount === 0) {
      tone = 'warning';
      status = 'Filtros sem resultado';
      message = `${formatNumber(transformedRecords)} registro(s) de poda existem na base, mas nenhum passou pelos filtros atuais.`;
    } else if (transformedRecords === 0) {
      tone = 'warning';
      status = 'Sem carga de poda';
      message = 'Nenhuma coleta CQO Poda foi encontrada para montar o dashboard.';
    }

    return {
      tone,
      status,
      message,
      rawExcelRows: 0,
      transformedRecords,
      visibleCount,
      hiddenByFilters,
      mobileCount: mobileRecords.filter((r) => r.type === 'poda').length,
      excelCount: excelRecords.filter((r) => r.type === 'poda').length,
      snapshotLabel: 'CQO Poda',
      updatedAtLabel: updateLabel(lastSyncTime),
      filterLabel: [
        farmFilterLabel(farmFilter),
        sourceFilterLabel(sourceFilter),
        periodLabel(dateFrom, dateTo),
      ].filter(Boolean).join(' · '),
    };
  }, [allRecords, mobileRecords, excelRecords, mergedRecords, records, demoRecords.length, farmFilter, sourceFilter, dateFrom, dateTo, lastSyncTime]);

  const boardProps = {
    loading,
    model,
    quality,
    dailyBunchRows,
    periodText,
    updateText,
    latestCollectionText,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    boardMode,
    setBoardMode,
    totalSection,
    setTotalSection,
    diagnostics,
    recordCount: mergedRecords.length,
    onResetFilters,
  };

  const mapProps = {
    theme,
    farmFilter,
    areaFilter: 'poda',
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
  };

  useEffect(() => {
    const openPresentation = () => {
      setPresentationOpen(true);
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener(OPEN_PODA_PRESENTATION_EVENT, openPresentation);
    return () => window.removeEventListener(OPEN_PODA_PRESENTATION_EVENT, openPresentation);
  }, []);

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

  useEffect(() => {
    if (!geoQualityOpen) return undefined;

    document.body.classList.add('field-map-active');
    return () => {
      document.body.classList.remove('field-map-active');
    };
  }, [geoQualityOpen]);

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

  const openGeoQuality = () => setGeoQualityOpen(true);
  const closeGeoQuality = () => setGeoQualityOpen(false);

  return (
    <div className="fade-in page-shell field-bi-page">
      {presentationOpen && (
        <PresentationOverlay
          {...boardProps}
          onClose={closePresentation}
        />
      )}

      {geoQualityOpen && (
        <FieldGeoQualityOverlay
          mapProps={mapProps}
          periodText={periodText}
          updateText={updateText}
          latestCollectionText={latestCollectionText}
          onClose={closeGeoQuality}
        />
      )}

      {LOCAL_DEMO_MODE && demoRecords.length > 0 ? (
        <StatusBanner tone="warning" icon={AlertTriangle}>
          Modo demonstração local ativo — exibindo dados simulados de poda. Configure `.env.local` com as chaves do Supabase para carregar coletas reais.
        </StatusBanner>
      ) : null}

      {error && !(LOCAL_DEMO_MODE && demoRecords.length > 0) ? (
        <StatusBanner tone="danger" icon={AlertTriangle}>
          Falha ao carregar dados: {error}
        </StatusBanner>
      ) : null}

      <DataHealthPanel diagnostics={diagnostics} loading={loading} />

      <FieldBiBoard
        {...boardProps}
        onPresent={openPresentation}
        onOpenGeoQuality={openGeoQuality}
      />
    </div>
  );
}
