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
import ActiveFilterSummary from '../components/ui/ActiveFilterSummary';
import StatusBanner from '../components/ui/StatusBanner';
import { normalizeCqoFarmId, parseRecordDateValue, useCqoDashboard } from '../utils/cqoData';
import { buildQualidadeOperacional } from '../utils/qualidadeOperacionalData';

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

function compactPeriodAxisLabel(label, mode = 'week') {
  const text = String(label || '');
  if (mode === 'month') {
    const match = text.match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[2]}/${String(match[1]).slice(-2)}`;
  }
  return weekNumberLabel(text);
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function monthBucketKey(date) {
  if (!date || Number.isNaN(date.getTime())) return 'Sem mês';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function weekBucketKey(date) {
  if (!date || Number.isNaN(date.getTime())) return 'Sem semana';
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `S${String(weekNo).padStart(2, '0')} (${d.getUTCFullYear()})`;
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
  const rawExcelRows = Number(cqoImport?.corteRows || 0)
    + Number(cqoImport?.carreamentoRows || 0)
    + Number(cqoImport?.podaRows || 0);
  const transformedRecords = allRecords.length;
  const visibleCount = visibleRecords.length;
  const hiddenByFilters = Math.max(transformedRecords - visibleCount, 0);
  const snapshot = cqoImport?.snapshot || null;
  const latestPodaSnapshot = (cqoImport?.podaSnapshots || [])[0] || null;
  const updatedAt = snapshot?.updated_at
    || latestPodaSnapshot?.updated_at
    || snapshot?.imported_at
    || latestPodaSnapshot?.imported_at
    || snapshot?.file_last_write_time
    || latestPodaSnapshot?.file_last_write_time
    || '';

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
    snapshotLabel: snapshot?.source_file || latestPodaSnapshot?.source_file || snapshot?.import_key || latestPodaSnapshot?.import_key || 'Sem snapshot',
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
    .filter((record) => record.type === 'corte')
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
          weekKey: date ? weekBucketKey(date) : 'Sem semana',
          monthKey: date ? monthBucketKey(date) : 'Sem mês',
          recordsCount: 0,
          maduro: 0,
          passado: 0,
          verde: 0,
          avermelhado: 0,
          estrela: 0,
          talo: 0,
          base: 0,
          plantBase: 0,
        });
      }

      const bucket = buckets.get(sortKey);
      bucket.recordsCount += 1;
      bucket.maduro += record.totals?.cachoMaduro || 0;
      bucket.passado += record.totals?.cachoPassado || 0;
      bucket.verde += record.totals?.cachoVerde || 0;
      bucket.avermelhado += record.totals?.cachoAvermelhado || 0;
      bucket.estrela += record.totals?.cachoEstrela || 0;
      bucket.talo += record.totals?.taloComprido || 0;
      bucket.base += record.totals?.cachosObservados || 0;
      bucket.plantBase += record.totals?.plantasObservadas || 0;
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
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={loading}
        aria-pressed={active}
      >
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
  { id: 'perdas', label: 'Perdas' },
  { id: 'todos', label: 'Tudo' },
];

const BI_SERIES = [
  { key: 'maduro', sourceKey: 'cachoMaduroPct', label: 'CM %', fullLabel: 'Cacho Maduro %', color: 'var(--orange-institutional)', target: 85, goodWhen: 'high', mapMetricId: 'maduro' },
  { key: 'passado', sourceKey: 'cachoPassadoPct', label: 'CP %', fullLabel: 'Cacho Passado %', color: 'var(--text-primary)', target: 10, goodWhen: 'low', mapMetricId: 'passado' },
  { key: 'verde', sourceKey: 'cachoVerdePct', label: 'CV %', fullLabel: 'Cacho Verde %', color: 'var(--green-institutional)', target: 1, goodWhen: 'low', mapMetricId: 'verde' },
  { key: 'avermelhado', sourceKey: 'cachoAvermelhadoPct', label: 'CA %', fullLabel: 'Cacho Avermelhado %', color: 'var(--status-danger)', target: 4, goodWhen: 'low', mapMetricId: 'avermelhado' },
  { key: 'talo', sourceKey: 'taloCompridoPct', label: 'TC %', fullLabel: 'Cacho Talo Compri. %', color: '#64748B', target: 3, goodWhen: 'low', mapMetricId: 'talo' },
  { key: 'estrela', sourceKey: 'cachoEstrelaPct', label: 'EST %', fullLabel: 'Cacho Estrela %', color: '#2563EB', target: 2, goodWhen: 'low', mapMetricId: 'estrela' },
];

function fieldBiSeriesByKey(key) {
  return BI_SERIES.find((item) => item.key === key) || BI_SERIES[0];
}

function mapMetricIdForFieldSeries(key) {
  const series = fieldBiSeriesByKey(key);
  return series.mapMetricId || series.key;
}

function dateKeyToIso(value) {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function dailyMetricBase(row, metricKey) {
  return metricKey === 'talo'
    ? Math.max(row.plantBase || 0, 0)
    : Math.max(row.base || 0, 0);
}

function fieldMetricQuantityFromTotals(totals, metricKey) {
  if (!totals) return 0;
  if (metricKey === 'maduro') return totals.cachoMaduro || 0;
  if (metricKey === 'passado') return totals.cachoPassado || 0;
  if (metricKey === 'verde') return totals.cachoVerde || 0;
  if (metricKey === 'avermelhado') return totals.cachoAvermelhado || 0;
  if (metricKey === 'talo') return totals.taloComprido || 0;
  if (metricKey === 'estrela') return totals.cachoEstrela || 0;
  return 0;
}

function fieldMetricBaseFromTotals(totals, metricKey) {
  if (!totals) return 0;
  if (metricKey === 'talo') return totals.cortePlantasObservadas || totals.plantasObservadas || 0;
  return totals.cachosObservados || 0;
}

function parcelSummaryTitle(summary) {
  const record = summary?.records?.[0];
  const props = summary?.props || {};
  const farm = record?.farm || props.farmName || props.fazenda || props.FAZENDA || 'Fazenda';
  const parcel = summary?.shapeParcel || record?.parcel || props.parcela || props.PARCELA || '--';
  return `${farm} / ${parcel}`;
}

function parcelSummaryPeriod(summary) {
  const first = formatDateBr(summary?.firstDate) || summary?.firstDate || '';
  const last = formatDateBr(summary?.lastDate) || summary?.lastDate || '';
  if (first && last && first !== last) return `${first} a ${last}`;
  return first || last || '--';
}

function FieldBiSelectedParcelSummary({ summary, activeMetricKey, onClear }) {
  const activeSeries = fieldBiSeriesByKey(activeMetricKey);

  if (!summary) {
    return (
      <div className="field-bi-selected-parcel is-empty">
        <div className="field-bi-selected-parcel-main">
          <span>Parcela</span>
          <strong>Clique em uma parcela no mapa</strong>
          <small>O resumo da coleta aparece aqui sem cobrir o fiscal.</small>
        </div>
      </div>
    );
  }

  const totals = summary.metricTotals || summary.totals || {};
  const quantity = fieldMetricQuantityFromTotals(totals, activeMetricKey);
  const base = fieldMetricBaseFromTotals(totals, activeMetricKey);
  const fallbackValue = safePct(quantity, base);
  const value = Number.isFinite(Number(summary.value)) ? Number(summary.value) : fallbackValue;
  const recordsCount = Array.isArray(summary.records) ? summary.records.length : 0;
  const areaHa = Number(summary.areaHa || 0);

  return (
    <div
      className="field-bi-selected-parcel"
      style={{ '--parcel-accent': summary.color || activeSeries.color }}
    >
      <div className="field-bi-selected-parcel-main">
        <span>Parcela selecionada</span>
        <strong>{parcelSummaryTitle(summary)}</strong>
        <small>{parcelSummaryPeriod(summary)}</small>
      </div>
      <div className="field-bi-selected-parcel-metrics">
        <span><b>{formatPercent(value, 1)}</b>{activeSeries.label}</span>
        <span><b>{formatNumber(quantity)}</b>encontrado</span>
        <span><b>{formatNumber(base)}</b>avaliado</span>
        <span><b>{formatNumber(recordsCount)}</b>coleta(s)</span>
        <span><b>{areaHa ? formatNumber(areaHa, 1) : '-'}</b>ha</span>
      </div>
      <button type="button" onClick={onClear} aria-label="Limpar parcela selecionada">
        <X size={14} />
      </button>
    </div>
  );
}

function seriesIsInTarget(series, value) {
  const numeric = Number(value || 0);
  const target = Number(series.target || 0);
  return series.goodWhen === 'high' ? numeric >= target : numeric <= target;
}

function qualityValuesFromRow(row) {
  if (row.qualidade) {
    const base = Math.max(row.qualidade.cachosObservados || 0, 0);
    const plantBase = Math.max(row.qualidade.cortePlantasObservadas || row.qualidade.plantasObservadas || 0, 0);
    return {
      maduro: base ? (row.qualidade.cachoMaduro / base) * 100 : 0,
      passado: base ? (row.qualidade.cachoPassado / base) * 100 : 0,
      verde: base ? (row.qualidade.cachoVerde / base) * 100 : 0,
      avermelhado: base ? (row.qualidade.cachoAvermelhado / base) * 100 : 0,
      talo: plantBase ? (row.qualidade.taloComprido / plantBase) * 100 : 0,
      estrela: base ? (row.qualidade.cachoEstrela / base) * 100 : 0,
      samples: base,
    };
  }

  return {
    maduro: Number(row.cachoMaduroPct || 0),
    passado: Number(row.cachoPassadoPct || 0),
    verde: Number(row.cachoVerdePct || 0),
    avermelhado: Number(row.cachoAvermelhadoPct || 0),
    talo: Number(row.taloCompridoPct || 0),
    estrela: Number(row.cachoEstrelaPct || 0),
    samples: row.recordsCount || 0,
  };
}

function riskFromValues(values) {
  const maduroGap = Math.max(0, 85 - Number(values.maduro || 0));
  return maduroGap
    + Number(values.passado || 0)
    + Number(values.verde || 0)
    + Number(values.avermelhado || 0)
    + Number(values.talo || 0)
    + Number(values.estrela || 0);
}

function FieldBiLegend({ activeKey = '', onSelect }) {
  return (
    <div className="field-bi-legend">
      {BI_SERIES.map((item) => {
        const content = <><i style={{ background: item.color }} />{item.fullLabel}</>;
        if (onSelect) {
          return (
            <button
              type="button"
              key={item.key}
              className={activeKey === item.key ? 'active' : ''}
              onClick={() => onSelect(item.key)}
              aria-pressed={activeKey === item.key}
            >
              {content}
            </button>
          );
        }
        return <span key={item.key}>{content}</span>;
      })}
    </div>
  );
}

function FieldBiFarmChart({
  rows,
  loading = false,
  activeMetricKey = 'maduro',
  onSelectMetric,
  selectedFarmLabel = '',
  onSelectFarm,
}) {
  const visibleRows = rows.slice(0, 5);

  return (
    <section className="field-bi-panel field-bi-farm-legacy-panel">
      <h3>Qualidade por Fazenda</h3>
      {loading ? (
        <div className="skeleton-chart" style={{ height: 180 }} />
      ) : (
        <div className="field-bi-farm-matrix">
          <div className="field-bi-farm-matrix-head">
            <span>Fazenda</span>
            {BI_SERIES.map((item) => (
              <button
                type="button"
                key={item.key}
                className={activeMetricKey === item.key ? 'is-active' : ''}
                style={{ '--metric-color': item.color }}
                onClick={() => onSelectMetric?.(item.key)}
                aria-pressed={activeMetricKey === item.key}
                title={item.fullLabel}
              >
                {item.label.replace(' %', '')}
              </button>
            ))}
          </div>
          {visibleRows.map((row) => {
            const values = qualityValuesFromRow(row);
            const rowRecordsCount = row.records?.length || row.recordsCount || 0;
            const farmActive = selectedFarmLabel === row.label;
            return (
              <div className={`field-bi-farm-matrix-row ${farmActive ? 'is-farm-active' : ''}`} key={row.label}>
                <button
                  type="button"
                  className="field-bi-farm-score-name"
                  onClick={() => onSelectFarm?.(row.label)}
                  aria-pressed={farmActive}
                  title={`${farmActive ? 'Remover filtro da fazenda' : 'Filtrar somente'} ${row.label}`}
                >
                  <strong>{row.label}</strong>
                  <span>{formatNumber(rowRecordsCount)} coleta(s)</span>
                </button>
                {BI_SERIES.map((item) => {
                  const value = values[item.key] || 0;
                  const inTarget = seriesIsInTarget(item, value);
                  return (
                    <button
                      type="button"
                      key={item.key}
                      className={`field-bi-farm-matrix-cell ${inTarget ? 'is-in-target' : 'is-out-target'} ${activeMetricKey === item.key ? 'is-active' : ''}`.trim()}
                      style={{ '--metric-color': item.color }}
                      onClick={() => onSelectMetric?.(item.key)}
                      aria-pressed={activeMetricKey === item.key}
                      title={`${row.label} - ${item.fullLabel}: ${formatPercent(value)} | Meta ${item.goodWhen === 'high' ? '>=' : '<='} ${formatPercent(item.target)}`}
                    >
                      <strong>{formatPercent(value, 1)}</strong>
                      <span>{inTarget ? '✓' : '!'}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!visibleRows.length && <div className="empty-panel smart-empty-panel"><strong>Sem dados de fazenda</strong><span>Troque o mês, ano ou fazenda para localizar coletas já sincronizadas.</span></div>}
        </div>
      )}
    </section>
  );
}

function FieldBiWeekChart({
  rows,
  monthRows = [],
  mode = 'week',
  onModeChange,
  loading = false,
  activeMetricKey = 'maduro',
  onSelectMetric,
  selectedPeriodKey = '',
  onSelectPeriod,
}) {
  const sourceRows = mode === 'month' ? monthRows : rows;
  const visibleRows = sourceRows.slice(mode === 'month' ? -10 : -8);
  const chartHeight = 232;
  const padding = { top: 22, right: 18, bottom: 36, left: 42 };
  const weekWidth = mode === 'month' ? 94 : 86;
  const width = Math.max(420, padding.left + padding.right + Math.max(visibleRows.length, 1) * weekWidth);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = 42;
  const title = mode === 'month' ? 'Qualidade por mês' : 'Qualidade por semana';
  const activeSeries = fieldBiSeriesByKey(activeMetricKey);

  return (
    <section className="field-bi-panel field-bi-week-panel">
      <div className="field-bi-panel-head">
        <h3>{title}</h3>
        <div className="field-bi-chart-toggle" role="group" aria-label="Alternar qualidade por semana ou mês">
          <button type="button" className={mode === 'week' ? 'active' : ''} onClick={() => onModeChange?.('week')}>Semana</button>
          <button type="button" className={mode === 'month' ? 'active' : ''} onClick={() => onModeChange?.('month')}>Mês</button>
        </div>
      </div>
      <FieldBiLegend activeKey={activeMetricKey} onSelect={onSelectMetric} />
      <div className="field-bi-active-context">
        <span>{activeSeries.fullLabel}</span>
        <strong>Mapa, fiscal e dia acompanham este indicador</strong>
      </div>
      {loading ? (
        <div className="skeleton-chart" style={{ height: chartHeight }} />
      ) : (
        <div className="field-bi-week-scroll">
          {visibleRows.length ? (
            <svg className="field-bi-week-chart" viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight}>
              {[0, 0.5, 1].map((ratio) => {
                const y = padding.top + graphHeight * (1 - ratio);
                return (
                  <g key={ratio}>
                    <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />
                    <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">{Math.round(ratio * 100)}%</text>
                  </g>
                );
              })}
              {visibleRows.map((row, rowIndex) => {
                const values = qualityValuesFromRow(row);
                const groupX = padding.left + rowIndex * weekWidth + (weekWidth - barWidth) / 2;
                const isSelected = selectedPeriodKey === row.label;
                let stackedHeight = 0;
                return (
                  <g
                    key={row.label}
                    className={`field-bi-week-group ${isSelected ? 'is-selected' : ''}`.trim()}
                    onClick={() => onSelectPeriod?.(row.label)}
                  >
                    {isSelected ? (
                      <rect
                        x={groupX - 7}
                        y={padding.top - 10}
                        width={barWidth + 14}
                        height={graphHeight + 28}
                        rx="8"
                        className="field-bi-week-highlight"
                      />
                    ) : null}
                    {BI_SERIES.map((item) => {
                      const pct = Math.max(0, Math.min(values[item.key], 100));
                      const segmentHeight = (pct / 100) * graphHeight;
                      const y = padding.top + graphHeight - stackedHeight - segmentHeight;
                      stackedHeight += segmentHeight;
                      return (
                        <rect
                          key={item.key}
                          x={groupX}
                          y={y}
                          width={barWidth}
                          height={Math.max(segmentHeight, pct > 0 ? 1.5 : 0)}
                          fill={item.color}
                          className="chart-bar"
                        >
                          <title>{`${row.label} - ${item.fullLabel}: ${formatPercent(pct)}`}</title>
                        </rect>
                      );
                    })}
                    {values.maduro > 12 && (
                      <text
                        x={groupX + barWidth / 2}
                        y={padding.top + graphHeight - ((Math.min(values.maduro, 100) / 100) * graphHeight / 2)}
                        textAnchor="middle"
                        className="field-bi-bar-label"
                        transform={`rotate(-90 ${groupX + barWidth / 2} ${padding.top + graphHeight - ((Math.min(values.maduro, 100) / 100) * graphHeight / 2)})`}
                      >
                        {formatPercent(values.maduro, 0)}
                      </text>
                    )}
                    <text x={groupX + barWidth / 2} y={chartHeight - 12} textAnchor="middle" className="chart-axis-text">
                      {compactPeriodAxisLabel(row.label, mode)}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="empty-panel smart-empty-panel"><strong>Sem dados no filtro</strong><span>A visão {mode === 'month' ? 'mensal' : 'semanal'} aparece quando houver coletas dentro do período selecionado.</span></div>
          )}
        </div>
      )}
    </section>
  );
}

function FiscalQualityCards({ rows, loading = false, selectedLabel = '', onSelect, activeMetricKey = 'maduro' }) {
  const activeSeries = fieldBiSeriesByKey(activeMetricKey);
  const visibleRows = rows
    .map((row) => {
      const risk = riskFromValues(qualityValuesFromRow(row));
      return {
        ...row,
        risk,
        tone: risk > 8 ? 'danger' : risk > 4 ? 'warning' : 'success',
      };
    })
    .sort((a, b) => b.risk - a.risk || b.recordsCount - a.recordsCount)
    .slice(0, 2);

  return (
    <section className="field-bi-panel field-bi-evaluators field-bi-evaluators-minimal">
      {loading ? (
        <div className="skeleton-chart" style={{ height: 196 }} />
      ) : (
        <>
          <div className="field-bi-evaluator-head">
            <h3>Fiscal resp. equipe</h3>
            <span>{selectedLabel ? 'fiscal filtrando o mapa' : 'clique para filtrar'}</span>
          </div>
          {visibleRows.map((row) => {
            const active = selectedLabel === row.label;
            const rowValues = qualityValuesFromRow(row);
            const activeValue = Number(row[activeSeries.sourceKey] ?? rowValues[activeSeries.key] ?? 0);
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
                  <span><b>{formatPercent(activeValue)}</b>{activeSeries.fullLabel}</span>
                  <span><b>{formatPercent(row.cachoVerdePct)}</b>Cacho verde %</span>
                  <span><b>{formatPercent(row.cachoMaduroPct)}</b>Cacho maduro %</span>
                </div>
                <small>{formatNumber(row.recordsCount)} coleta(s) · {active ? 'em análise' : row.tone === 'danger' ? 'prioridade alta' : row.tone === 'warning' ? 'acompanhar' : 'controlado'}</small>
              </button>
            );
          })}
          {!visibleRows.length && <div className="empty-panel smart-empty-panel"><strong>Sem fiscais</strong><span>Nenhuma coleta do período trouxe fiscal responsável da equipe válido.</span></div>}
        </>
      )}
    </section>
  );
}

function FieldBiInlineCorteMap({
  mapProps,
  loading = false,
  onOpenGeoQuality,
  activeMetricKey = 'maduro',
  selectedFiscalLabel = '',
  selectedDayKey = '',
  selectedDayLabel = '',
}) {
  const [selectedParcelSummary, setSelectedParcelSummary] = useState(null);
  const activeSeries = fieldBiSeriesByKey(activeMetricKey);
  const selectedIsoDate = dateKeyToIso(selectedDayKey);
  const focusedMapProps = {
    ...mapProps,
    evaluatorFilter: selectedFiscalLabel || mapProps?.evaluatorFilter || 'all',
    periodFilter: selectedIsoDate ? 'custom' : mapProps?.periodFilter,
    dateFrom: selectedIsoDate || mapProps?.dateFrom,
    dateTo: selectedIsoDate || mapProps?.dateTo,
  };
  const mapKey = [
    'corte-inline-map',
    mapMetricIdForFieldSeries(activeMetricKey),
    focusedMapProps.farmFilter || 'all',
    focusedMapProps.sourceFilter || 'all',
    focusedMapProps.evaluatorFilter || 'all',
    focusedMapProps.dateFrom || 'start',
    focusedMapProps.dateTo || 'end',
  ].join('-');

  useEffect(() => {
    const resetTimer = window.setTimeout(() => setSelectedParcelSummary(null), 0);
    return () => window.clearTimeout(resetTimer);
  }, [mapKey]);

  return (
    <section className="field-bi-panel field-bi-map-panel field-bi-corte-map-panel">
      <div className="field-bi-map-head">
        <div>
          <h3>Mapa das parcelas</h3>
          <span>
            Semáforo por {activeSeries.fullLabel.toLowerCase()}
            {selectedDayLabel ? ` · Dia ${selectedDayLabel}` : ''}
            {selectedFiscalLabel ? ` · ${selectedFiscalLabel}` : ''}
          </span>
        </div>
        {onOpenGeoQuality ? (
          <button type="button" onClick={() => onOpenGeoQuality?.(focusedMapProps, activeMetricKey)}>
            <MapPinned size={15} />
            Abrir maior
          </button>
        ) : null}
      </div>
      <FieldBiSelectedParcelSummary
        summary={selectedParcelSummary}
        activeMetricKey={activeMetricKey}
        onClear={() => setSelectedParcelSummary(null)}
      />
      <div className="field-bi-inline-map-frame field-bi-corte-inline-map-frame">
        {loading ? (
          <div className="field-map-suspense">
            <div className="gps-map-loading-spinner" />
            <strong>Carregando mapa das parcelas</strong>
            <span>Aplicando os shapes e o semáforo de qualidade.</span>
          </div>
        ) : (
          <Suspense
            fallback={(
              <div className="field-map-suspense">
                <div className="gps-map-loading-spinner" />
                <strong>Carregando mapa das parcelas</strong>
                <span>Preparando shapefiles e indicadores.</span>
              </div>
            )}
          >
            <LeafletMap
              key={mapKey}
              {...focusedMapProps}
              areaFilter="corte"
              initialOperation="corte"
              initialMetricId={mapMetricIdForFieldSeries(activeMetricKey)}
              onParcelSelect={setSelectedParcelSummary}
            />
          </Suspense>
        )}
      </div>
      <div className="field-bi-map-legend-card field-bi-corte-map-legend" aria-label="Legenda do mapa de corte">
        <div className="field-bi-map-legend-title">
          <strong>Legenda</strong>
          <span>Corte</span>
        </div>
        <div className="field-bi-map-legend-items">
          <span className="is-ok"><i />Dentro<small>meta atendida</small></span>
          <span className="is-warning"><i />Atenção<small>acompanhar</small></span>
          <span className="is-critical"><i />Crítico<small>fora da meta</small></span>
          <span className="is-empty"><i />Sem avaliação<small>sem coleta</small></span>
        </div>
      </div>
    </section>
  );
}

function FieldBiRightColumn({
  evaluatorRows,
  mapProps,
  loading = false,
  onOpenGeoQuality,
  activeMetricKey = 'maduro',
  selectedFiscalLabel = '',
  selectedDayKey = '',
  selectedDayLabel = '',
  onSelectFiscal,
}) {
  return (
    <div className="field-bi-right-column">
      <FiscalQualityCards
        rows={evaluatorRows}
        loading={loading}
        selectedLabel={selectedFiscalLabel}
        onSelect={onSelectFiscal}
        activeMetricKey={activeMetricKey}
      />
      <FieldBiInlineCorteMap
        mapProps={mapProps}
        loading={loading}
        onOpenGeoQuality={onOpenGeoQuality}
        activeMetricKey={activeMetricKey}
        selectedFiscalLabel={selectedFiscalLabel}
        selectedDayKey={selectedDayKey}
        selectedDayLabel={selectedDayLabel}
      />
    </div>
  );
}

function DailyBunchBarChart({ rows, selectedDayKey = '', onSelectDay, loading = false, activeMetricKey = 'maduro' }) {
  const series = BI_SERIES;
  const visibleRows = rows;
  const chartHeight = 236;
  const padding = { top: 18, right: 18, bottom: 42, left: 46 };
  const width = 1000;
  const plotWidth = width - padding.left - padding.right;
  const dayWidth = plotWidth / Math.max(visibleRows.length, 1);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = Math.max(3, Math.min(62, dayWidth * 0.66));
  const dayLabelFontSize = Math.max(5.2, Math.min(8.5, dayWidth * 0.24));
  const selectedRow = selectedDayKey ? visibleRows.find((row) => row.sortKey === selectedDayKey) : null;
  const activeSeries = fieldBiSeriesByKey(activeMetricKey);

  return (
    <section className="field-bi-panel field-bi-daily-panel">
      <h3>Qualidade por Dia/Fazenda/Parcela</h3>
      <span className="field-bi-daily-subtitle">Clique em um dia para o mapa mostrar somente aquele recorte.</span>
      <div className="field-daily-legend">
        {series.map((item) => (
          <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
        ))}
      </div>
      {selectedRow ? (
        <div className="field-bi-day-focus">
          <strong>Dia selecionado: {selectedRow.label}</strong>
          <span>{formatNumber(selectedRow.recordsCount)} coleta(s)</span>
          <span>{formatNumber(selectedRow.base)} cachos avaliados</span>
          <span>
            <i style={{ background: activeSeries.color }} />
            {activeSeries.label}: {formatPercent(safePct(selectedRow[activeSeries.key], dailyMetricBase(selectedRow, activeSeries.key)), 1)} · {formatNumber(selectedRow[activeSeries.key])}
          </span>
          {series.map((item) => {
            const total = dailyMetricBase(selectedRow, item.key);
            const pct = total ? safePct(selectedRow[item.key], total) : 0;
            return (
              <span key={item.key}>
                <i style={{ background: item.color }} />
                {item.label.replace('Cacho ', '')}: {formatPercent(pct, 1)} · {formatNumber(selectedRow[item.key])}
              </span>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <div className="skeleton-chart" style={{ height: chartHeight }} />
      ) : (
        <div className="field-daily-chart-scroll">
          {visibleRows.length ? (
            <svg className="field-daily-chart-svg" viewBox={`0 0 ${width} ${chartHeight}`} width="100%" height={chartHeight}>
              {[0, 0.5, 1].map((ratio) => {
                const y = padding.top + graphHeight * (1 - ratio);
                return (
                  <g key={ratio}>
                    <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />
                    <text x={padding.left - 10} y={y + 4} textAnchor="end" className="chart-axis-text">
                      {Math.round(ratio * 100)}%
                    </text>
                  </g>
                );
              })}

              {visibleRows.map((row, rowIndex) => {
                const groupCenterX = padding.left + (rowIndex * dayWidth) + (dayWidth / 2);
                const groupX = groupCenterX - (barWidth / 2);
                const highlightWidth = Math.max(barWidth + 6, Math.min(dayWidth * 0.86, 28));
                const total = series.reduce((sum, item) => sum + Number(row[item.key] || 0), 0);
                let stackedHeight = 0;
                const isSelected = selectedDayKey === row.sortKey;
                return (
                  <g
                    key={row.sortKey}
                    className={`field-bi-day-group ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onSelectDay?.(row.sortKey)}
                  >
                    {isSelected ? (
                      <rect
                        x={groupCenterX - (highlightWidth / 2)}
                        y={padding.top - 8}
                        width={highlightWidth}
                        height={graphHeight + 22}
                        rx="8"
                        className="field-bi-day-highlight"
                      />
                    ) : null}
                    {series.map((item) => {
                      const value = Number(row[item.key] || 0);
                      const pct = total > 0 ? (value / total) * 100 : 0;
                      const segmentHeight = total > 0 ? (pct / 100) * graphHeight : 0;
                      const y = padding.top + graphHeight - stackedHeight - segmentHeight;
                      stackedHeight += segmentHeight;
                      return (
                        <rect
                          key={item.key}
                          x={groupX}
                          y={y}
                          width={barWidth}
                          height={Math.max(segmentHeight, value > 0 ? 1.5 : 0)}
                          fill={item.color}
                          className="chart-bar"
                        >
                          <title>{`${row.label} - ${item.label}: ${formatNumber(value)} cachos (${formatPercent(pct)})`}</title>
                        </rect>
                      );
                    })}
                    <text
                      x={groupCenterX}
                      y={chartHeight - 14}
                      textAnchor="middle"
                      className="chart-axis-text field-bi-day-axis-label"
                      style={{ fontSize: `${dayLabelFontSize}px` }}
                    >
                      {row.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="empty-panel smart-empty-panel"><strong>Sem barras diárias</strong><span>O gráfico por dia será montado quando houver cachos avaliados no mês selecionado.</span></div>
          )}
        </div>
      )}
    </section>
  );
}

function buildTotalMetricGroups(model) {
  const totals = model.corteTotals || {};
  const baseCachos = Math.max(totals.cachosObservados || 0, 0);
  const basePlantas = Math.max(totals.plantasObservadas || 0, 0);
  const quality = model.quality || {};
  const lossBase = model.totals?.producedTon || 0;

  return [
    {
      id: 'qualidade',
      title: 'Qualidade dos cachos',
      cards: [
        { label: 'Cacho maduro', value: formatPercent(quality.cachoMaduroPct), detail: `${formatNumber(totals.cachoMaduro)} cachos`, tone: 'success' },
        { label: 'Cacho passado', value: formatPercent(quality.cachoPassadoPct), detail: `${formatNumber(totals.cachoPassado)} cachos`, tone: quality.cachoPassadoPct > 10 ? 'danger' : 'neutral' },
        { label: 'Cacho verde', value: formatPercent(quality.cachoVerdePct), detail: `${formatNumber(totals.cachoVerde)} cachos`, tone: quality.cachoVerdePct > 1 ? 'warning' : 'neutral' },
        { label: 'Cacho avermelhado', value: formatPercent(quality.cachoAvermelhadoPct), detail: `${formatNumber(totals.cachoAvermelhado)} cachos`, tone: quality.cachoAvermelhadoPct > 4 ? 'danger' : 'neutral' },
        { label: 'Cacho estrela', value: formatPercent(quality.cachoEstrelaPct), detail: `${formatNumber(totals.cachoEstrela)} cachos`, tone: quality.cachoEstrelaPct > 2 ? 'danger' : 'neutral' },
        { label: 'Cacho infermo', value: formatPercent(quality.cachoInfermoPct), detail: `${formatNumber(totals.cachoInfermo)} cachos`, tone: 'neutral' },
        { label: 'Bucha', value: formatPercent(quality.buchaPct), detail: `${formatNumber(totals.bucha)} cachos`, tone: 'neutral' },
        { label: 'Cacho brocado', value: formatPercent(safePct(totals.cachoBrocado, baseCachos)), detail: `${formatNumber(totals.cachoBrocado)} cachos`, tone: 'warning' },
      ],
    },
    {
      id: 'falhas',
      title: 'Falhas e ocorrências do corte',
      cards: [
        { label: 'Cacho esquecido', value: formatNumber(totals.cachoEsquecido), detail: `${formatPercent(safePct(totals.cachoEsquecido, baseCachos))} dos cachos`, tone: 'danger' },
        { label: 'Talo comprido', value: formatNumber(totals.taloComprido), detail: `${formatPercent(safePct(totals.taloComprido, basePlantas))} das plantas`, tone: quality.taloCompridoPct > 3 ? 'danger' : 'warning' },
        { label: 'Folha cortada indevida', value: formatNumber(totals.folhaCortada), detail: `${formatPercent(safePct(totals.folhaCortada, basePlantas))} das plantas`, tone: 'warning' },
        { label: 'Folha mamando', value: formatNumber(totals.folhaMamando), detail: `${formatPercent(safePct(totals.folhaMamando, basePlantas))} das plantas`, tone: 'warning' },
        { label: 'Palha mal empilhada', value: formatNumber(totals.cachoMalPosicionado), detail: `${formatPercent(safePct(totals.cachoMalPosicionado, basePlantas))} das plantas`, tone: 'warning' },
        { label: 'Bucha', value: formatNumber(totals.bucha), detail: `${formatPercent(safePct(totals.bucha, baseCachos))} dos cachos`, tone: 'neutral' },
      ],
    },
    {
      id: 'amostragem',
      title: 'Amostragem e auditoria',
      cards: [
        { label: 'Fichas de corte', value: formatNumber(model.corteRecords.length), detail: 'coletas no filtro', tone: 'success' },
        { label: 'Linhas avaliadas', value: formatNumber(totals.linhas), detail: 'linhas/ruas amostradas', tone: 'neutral' },
        { label: 'Plantas observadas', value: formatNumber(totals.plantasObservadas), detail: 'base da auditoria', tone: 'neutral' },
        { label: 'Cachos observados', value: formatNumber(totals.cachosObservados), detail: 'base de maturação', tone: 'neutral' },
        {
          label: 'Registros com GPS',
          value: `${formatNumber(totals.gps)} / ${formatNumber(totals.gpsEligible)}`,
          detail: totals.gpsEligible === totals.total ? `${formatNumber(totals.gpsRate)}% das fichas` : `${formatNumber(totals.gpsRate)}% das coletas do app`,
          tone: 'success',
        },
        { label: 'Pontos GPS', value: formatNumber(totals.gpsPoints), detail: `${formatNumber(totals.gpsOccurrences)} ocorrências`, tone: 'neutral' },
      ],
    },
    {
      id: 'perdas',
      title: 'Perdas estimadas',
      cards: [
        { label: 'Perda corte', value: `${formatNumber(model.totals?.corteT, 2)} t`, detail: lossBase ? `${formatPercent(model.lossRates?.cortePct || 0)} da produção` : 'sem base de produção', tone: 'danger' },
        { label: 'Cachos estimados', value: formatNumber(model.totals?.estimatedCachos), detail: 'estimativa por amostragem', tone: 'warning' },
        { label: 'Produção base', value: `${formatNumber(lossBase, 2)} t`, detail: lossBase ? 'base calculada' : 'não informada', tone: 'neutral' },
        { label: 'Score corte', value: formatNumber(totals.corteScore), detail: 'nota técnica do corte', tone: totals.corteScore >= 85 ? 'success' : 'warning' },
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
                <th>Maduro</th>
                <th>Verde</th>
                <th>Passado</th>
                <th>Avermelhado</th>
                <th>Cacho esquecido</th>
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
                    <td>{formatNumber(totals.cachoEsquecido)}</td>
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
  filterState,
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
  mapProps,
  onResetFilters,
  onClearFilter,
  onPresent,
  onOpenGeoQuality,
  presentationMode = false,
}) {
  const isTotalMode = !presentationMode && boardMode === 'total';
  const [qualityPeriodMode, setQualityPeriodMode] = useState('week');
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [activeMetricKey, setActiveMetricKey] = useState('maduro');
  const [selectedFiscalLabel, setSelectedFiscalLabel] = useState('');
  const [selectedFarmLabel, setSelectedFarmLabel] = useState('');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('');
  const visibleRecords = useMemo(() => {
    const source = model.records || [];
    if (!selectedFarmLabel) return source;
    return source.filter((record) => record.farm === selectedFarmLabel);
  }, [model.records, selectedFarmLabel]);
  const displayModel = useMemo(
    () => (selectedFarmLabel ? buildQualidadeOperacional(visibleRecords) : model),
    [model, selectedFarmLabel, visibleRecords]
  );
  const displayDailyBunchRows = useMemo(
    () => (selectedFarmLabel ? buildDailyBunchRows(visibleRecords) : dailyBunchRows),
    [dailyBunchRows, selectedFarmLabel, visibleRecords]
  );
  const displayPeriodRows = qualityPeriodMode === 'month' ? displayModel.monthRows : displayModel.weekRows;
  const periodRowKey = qualityPeriodMode === 'month' ? 'monthKey' : 'weekKey';
  const periodFilteredDailyRows = useMemo(() => {
    if (!selectedPeriodKey) return displayDailyBunchRows;
    return displayDailyBunchRows.filter((row) => row[periodRowKey] === selectedPeriodKey);
  }, [displayDailyBunchRows, periodRowKey, selectedPeriodKey]);
  const displayQuality = selectedFarmLabel ? displayModel.quality : quality;
  const selectedFarmId = selectedFarmLabel ? normalizeCqoFarmId(selectedFarmLabel) : '';
  const displayMapProps = selectedFarmLabel
    ? { ...mapProps, farmFilter: selectedFarmId }
    : mapProps;
  const selectedDayRow = selectedDayKey
    ? periodFilteredDailyRows.find((row) => row.sortKey === selectedDayKey)
    : null;
  const handleMetricSelect = (key) => {
    setActiveMetricKey((current) => (current === key ? '' : key));
  };
  const handleFarmSelect = (label) => {
    setSelectedFarmLabel((current) => (current === label ? '' : label));
    setSelectedFiscalLabel('');
    setSelectedDayKey('');
    setSelectedPeriodKey('');
  };
  const handlePeriodSelect = (label) => {
    setSelectedPeriodKey((current) => (current === label ? '' : label));
    setSelectedDayKey('');
  };
  useEffect(() => {
    if (!selectedFarmLabel) return undefined;
    if (!model.farmRows.some((row) => row.label === selectedFarmLabel)) {
      const resetTimer = window.setTimeout(() => setSelectedFarmLabel(''), 0);
      return () => window.clearTimeout(resetTimer);
    }
    return undefined;
  }, [model.farmRows, selectedFarmLabel]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setSelectedPeriodKey('');
      setSelectedDayKey('');
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [qualityPeriodMode]);

  useEffect(() => {
    if (!selectedPeriodKey) return undefined;
    if (!displayPeriodRows.some((row) => row.label === selectedPeriodKey)) {
      const resetTimer = window.setTimeout(() => {
        setSelectedPeriodKey('');
        setSelectedDayKey('');
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    return undefined;
  }, [displayPeriodRows, selectedPeriodKey]);

  useEffect(() => {
    if (!selectedDayKey) return undefined;
    if (!periodFilteredDailyRows.some((row) => row.sortKey === selectedDayKey)) {
      const resetTimer = window.setTimeout(() => setSelectedDayKey(''), 0);
      return () => window.clearTimeout(resetTimer);
    }
    return undefined;
  }, [periodFilteredDailyRows, selectedDayKey]);

  const kpiCards = [
    { key: 'maduro', label: 'Cacho Maduro %', value: displayQuality.cachoMaduroPct, meta: 85, goodWhen: 'high' },
    { key: 'passado', label: 'Cacho passado %', value: displayQuality.cachoPassadoPct, meta: 10 },
    { key: 'verde', label: 'Cacho verde %', value: displayQuality.cachoVerdePct, meta: 1 },
    { key: 'avermelhado', label: 'Cacho Avermelhado %', value: displayQuality.cachoAvermelhadoPct, meta: 4 },
    { key: 'talo', label: 'Cacho Talo Compri. %', value: displayQuality.taloCompridoPct, meta: 3 },
    { key: 'estrela', label: 'Cacho Estrela %', value: displayQuality.cachoEstrelaPct, meta: 2 },
  ];

  return (
    <div className={`field-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="field-bi-header">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="field-bi-logo" />
        <div className="field-bi-title-block">
          <h2>Qualidade Agrícola</h2>
          <div className="field-bi-meta-line">
            <span title={`Período filtrado: ${periodText}`}><CalendarDays size={14} />Período: {periodText}</span>
            <ActiveFilterSummary filters={filterState} onClearFilter={onClearFilter} />
            <span><RefreshCw size={14} />Atualizado: {updateText}</span>
            <span><CalendarDays size={14} />Última coleta: {latestCollectionText}</span>
          </div>
        </div>
        {!presentationMode && (
          <div className="field-bi-header-actions">
            <button type="button" className="field-bi-map-btn" onClick={() => onOpenGeoQuality?.(displayMapProps, activeMetricKey)}>
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
          <div className="field-bi-mode-switch" role="group" aria-label="Modo de visualização CQO Campo">
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
            {kpiCards.map(({ key, ...card }) => (
              <FieldBiKpiCard
                key={key}
                loading={loading}
                active={activeMetricKey === key}
                onClick={() => handleMetricSelect(key)}
                {...card}
              />
            ))}
          </div>

          <div className="field-bi-main-grid">
            <FieldBiFarmChart
              rows={displayModel.farmRows}
              loading={loading}
              activeMetricKey={activeMetricKey}
              onSelectMetric={handleMetricSelect}
              selectedFarmLabel={selectedFarmLabel}
              onSelectFarm={handleFarmSelect}
            />
            <FieldBiWeekChart
              rows={displayModel.weekRows}
              monthRows={displayModel.monthRows}
              mode={qualityPeriodMode}
              onModeChange={setQualityPeriodMode}
              loading={loading}
              activeMetricKey={activeMetricKey}
              onSelectMetric={handleMetricSelect}
              selectedPeriodKey={selectedPeriodKey}
              onSelectPeriod={handlePeriodSelect}
            />
            <FieldBiRightColumn
              evaluatorRows={displayModel.evaluatorRows}
              mapProps={displayMapProps}
              loading={loading}
              onOpenGeoQuality={onOpenGeoQuality}
              activeMetricKey={activeMetricKey}
              selectedFiscalLabel={selectedFiscalLabel}
              selectedDayKey={selectedDayKey}
              selectedDayLabel={selectedDayRow?.label || ''}
              onSelectFiscal={(row) => setSelectedFiscalLabel((current) => (current === row.label ? '' : row.label))}
            />
            <DailyBunchBarChart
              rows={periodFilteredDailyRows}
              selectedDayKey={selectedDayKey}
              onSelectDay={(key) => setSelectedDayKey((current) => (current === key ? '' : key))}
              loading={loading}
              activeMetricKey={activeMetricKey}
            />
          </div>
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

function FieldGeoQualityOverlay({ mapProps, periodText, updateText, latestCollectionText, initialMetricId = 'nota', onClose }) {
  return createPortal(
    <div className="field-map-overlay" role="dialog" aria-modal="true" aria-label="Qualidade por parcela no mapa">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={onClose} title="Fechar mapa" aria-label="Fechar mapa">
        <X size={22} />
      </button>
      <section className="field-map-dialog">
        <header className="field-map-header">
          <img src="/logo.png" alt="Vila Nova Agroindustrial" />
          <div>
            <span>Georreferenciamento CQO Campo</span>
            <h2>Qualidade por parcela</h2>
            <p>Shapes das parcelas com semáforo de qualidade, filtros atuais e detalhe por fazenda, parcela, fiscal e período.</p>
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
              areaFilter="corte"
              initialOperation="corte"
              initialMetricId={initialMetricId}
            />
          </Suspense>
        </div>
      </section>
    </div>,
    document.body
  );
}

export default function Dashboard({ theme, farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter = 'all', dateFrom, dateTo, setDateFrom, setDateTo, searchTerm, lastSyncTime, onResetFilters, onClearFilter }) {
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [geoQualityOpen, setGeoQualityOpen] = useState(false);
  const [geoQualityMapProps, setGeoQualityMapProps] = useState(null);
  const [geoQualityInitialMetricId, setGeoQualityInitialMetricId] = useState('nota');
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

  const model = useMemo(() => buildQualidadeOperacional(records), [records]);
  const dailyBunchRows = useMemo(() => buildDailyBunchRows(records), [records]);
  const quality = model.quality;
  const periodText = periodLabel(dateFrom, dateTo);
  const filterState = useMemo(() => ({
    farmFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    searchTerm,
  }), [farmFilter, cycleFilter, evaluatorFilter, sourceFilter, searchTerm]);
  const updateText = updateLabel(lastSyncTime);
  const latestCollectionText = loading ? 'Carregando...' : latestCollectionLabel(records);
  const diagnostics = useMemo(() => buildDataDiagnostics({
    allRecords,
    mobileRecords,
    excelRecords,
    visibleRecords: records,
    cqoImport,
    filters: {
      farmFilter,
      sourceFilter,
      dateFrom,
      dateTo,
    },
  }), [allRecords, mobileRecords, excelRecords, records, cqoImport, farmFilter, sourceFilter, dateFrom, dateTo]);

  const mapProps = {
    theme,
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
  };

  const boardProps = {
    loading,
    model,
    quality,
    dailyBunchRows,
    periodText,
    filterState,
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
    recordCount: records.length,
    mapProps,
    onResetFilters,
    onClearFilter,
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

  const openGeoQuality = (nextMapProps, metricKey = 'nota') => {
    setGeoQualityMapProps(nextMapProps || null);
    setGeoQualityInitialMetricId(metricKey === 'nota' ? 'nota' : mapMetricIdForFieldSeries(metricKey));
    setGeoQualityOpen(true);
  };
  const closeGeoQuality = () => {
    setGeoQualityOpen(false);
    setGeoQualityMapProps(null);
    setGeoQualityInitialMetricId('nota');
  };

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
          mapProps={geoQualityMapProps || mapProps}
          periodText={periodText}
          updateText={updateText}
          latestCollectionText={latestCollectionText}
          initialMetricId={geoQualityInitialMetricId}
          onClose={closeGeoQuality}
        />
      )}

      {error && (
        <StatusBanner tone="danger" icon={AlertTriangle}>
          Falha ao carregar dados: {error}
        </StatusBanner>
      )}

      <DataHealthPanel diagnostics={diagnostics} loading={loading} />

      <FieldBiBoard
        {...boardProps}
        onPresent={openPresentation}
        onOpenGeoQuality={openGeoQuality}
      />
    </div>
  );
}
