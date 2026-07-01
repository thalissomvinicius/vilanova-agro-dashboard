/* eslint-disable no-unused-vars -- a tela de poda mantém variantes de apresentação antigas para alternância rápida durante a reunião. */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
import { aggregateRecords, CQO_FARMS, LOCAL_DEMO_MODE, parseRecordDateValue, useCqoDashboard } from '../utils/cqoData';
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
  const text = String(label || '');
  const weekMatch = text.match(/(?:S|Semana\s*)?(\d{1,2})/i);
  if (!weekMatch) return label;
  const yearMatch = text.match(/(19\d{2}|20\d{2})/);
  const week = `S${Number(weekMatch[1])}`;
  return yearMatch ? `${week}/${yearMatch[1].slice(-2)}` : week;
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
      const dayMonth = date
        ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
        : 'Sem data';
      const year = date ? date.getFullYear() : '';

      if (!buckets.has(sortKey)) {
        buckets.set(sortKey, {
          sortKey,
          label: dayMonth,
          dayMonth,
          year,
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

  const rows = Array.from(buckets.values()).sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
  const years = new Set(rows.map((row) => row.year).filter(Boolean));
  return rows.map((row) => ({
    ...row,
    label: years.size > 1 && row.year ? `${row.dayMonth}/${String(row.year).slice(-2)}` : row.dayMonth || row.label,
  }));
}

function qualityTone(value, meta, goodWhen = 'low') {
  const numeric = Number(value || 0);
  const target = Number(meta || 0);
  if (goodWhen === 'high') {
    if (numeric >= target) return { tone: 'green', color: 'var(--status-success)', status: 'Dentro da meta' };
    if (numeric >= target * 0.85) return { tone: 'warning', color: 'var(--orange-institutional)', status: 'Atenção' };
    return { tone: 'danger', color: 'var(--status-danger)', status: 'Fora da meta' };
  }

  if (numeric <= target) return { tone: 'green', color: 'var(--status-success)', status: 'Dentro da meta' };
  if (numeric <= target * 1.5) return { tone: 'warning', color: 'var(--orange-institutional)', status: 'Atenção' };
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
  { id: 'fazendas', label: 'Fazendas' },
  { id: 'qualidade', label: 'Qualidade' },
  { id: 'falhas', label: 'Falhas' },
  { id: 'amostragem', label: 'Amostragem' },
  { id: 'todos', label: 'Tudo' },
];

const BI_SERIES = [
  { key: 'maduro', sourceKey: 'cachoMaduroPct', label: 'PSP %', fullLabel: 'Planta sem podar %', color: 'var(--orange-institutional)', target: 0 },
  { key: 'passado', sourceKey: 'cachoPassadoPct', label: 'CE %', fullLabel: 'Cacho exposto %', color: 'var(--text-primary)', target: 1 },
  { key: 'verde', sourceKey: 'cachoVerdePct', label: 'PMC %', fullLabel: 'Poda meia coroa %', color: 'var(--green-institutional)', target: 2 },
  { key: 'avermelhado', sourceKey: 'cachoAvermelhadoPct', label: 'CP %', fullLabel: 'Cacho podre %', color: 'var(--status-danger)', target: 2 },
  { key: 'estrela', sourceKey: 'taloCompridoPct', label: 'PM 1:1 %', fullLabel: 'Poda maior 1:1 %', color: '#7C3AED', target: 2 },
  { key: 'talo', sourceKey: 'cachoEstrelaPct', label: 'BG %', fullLabel: 'Bico de gaita %', color: '#2563EB', target: 2 },
];

const MAP_METRIC_BY_SERIES = {
  maduro: 'poda_planta_sem_podar',
  passado: 'poda_cacho_exposto',
  verde: 'poda_meia_coroa',
  avermelhado: 'poda_cacho_podre',
  estrela: 'poda_maior_1_1',
  talo: 'poda_bico_gaita',
};
const MAP_ATTENTION_MULTIPLIER = 2.2;

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

  if (['maduro', 'passado', 'verde', 'avermelhado', 'estrela', 'talo'].some((key) => Number(directValues[key] || 0) > 0)) {
    return directValues;
  }

  if (row.qualidade) {
    const hasPodaRates = row.qualidade.podaPlantasObservadas
      || row.qualidade.plantaSemPodarRate
      || row.qualidade.cachoExpostoRate
      || row.qualidade.podaMeiaCoroaRate
      || row.qualidade.cachoPodrePlantaRate
      || row.qualidade.podaMaiorUmParaUmRate
      || row.qualidade.bicoGaitaRate;
    if (hasPodaRates) {
      return {
        maduro: Number(row.qualidade.plantaSemPodarRate || 0),
        passado: Number(row.qualidade.cachoExpostoRate || 0),
        verde: Number(row.qualidade.podaMeiaCoroaRate || 0),
        avermelhado: Number(row.qualidade.cachoPodrePlantaRate || 0),
        estrela: Number(row.qualidade.podaMaiorUmParaUmRate || 0),
        talo: Number(row.qualidade.bicoGaitaRate || 0),
        samples: row.qualidade.podaPlantasObservadas || row.qualidade.plantasObservadas || 0,
      };
    }

    const base = Math.max(row.qualidade.cachosObservados || 0, 0);
    return {
      maduro: base ? (row.qualidade.cachoMaduro / base) * 100 : 0,
      passado: base ? (row.qualidade.cachoPassado / base) * 100 : 0,
      verde: base ? (row.qualidade.cachoVerde / base) * 100 : 0,
      avermelhado: base ? (row.qualidade.cachoAvermelhado / base) * 100 : 0,
      estrela: 0,
      talo: 0,
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

function seriesQuantityFromRow(row, seriesKey, values = {}) {
  const directValue = Number(row?.[seriesKey]);
  const totals = row?.qualidade || {};
  const quantityBySeries = {
    maduro: totals.plantaSemPodar,
    passado: totals.cachoExposto,
    verde: totals.podaMeiaCoroa,
    avermelhado: totals.cachoPodrePlanta,
    estrela: totals.podaMaiorUmParaUm,
    talo: totals.bicoGaita,
  };
  const quantity = Number.isFinite(directValue)
    ? directValue
    : Number(quantityBySeries[seriesKey] || 0);
  const base = Number(values.samples || row?.samples || totals.podaPlantasObservadas || totals.plantasObservadas || 0);

  return {
    quantity,
    base,
  };
}

function seriesPointTooltip(point, series) {
  const quantityLabel = Number.isFinite(point.quantity)
    ? ` | Qtd.: ${formatNumber(point.quantity)}`
    : '';
  const baseLabel = Number(point.base || 0) > 0
    ? ` | Base: ${formatNumber(point.base)} plantas`
    : '';
  return `${point.label} - ${series.fullLabel}: ${formatPercent(point.value)} | Meta: ${formatPercent(series.target)}${quantityLabel}${baseLabel}`;
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

function collectionDateLabel(record) {
  const date = resolveRecordDate(record);
  const dateText = date
    ? new Intl.DateTimeFormat('pt-BR').format(date)
    : record?.date || '--';
  const timeText = record?.time && record.time !== '--' ? ` ${record.time}` : '';
  return `${dateText}${timeText}`;
}

function collectionGpsLabel(record) {
  if (!record?.gpsApplicable) return 'N/A';
  const points = (record?.gpsOccurrences?.length || 0) + (record?.gpsTrack?.length || 0);
  if (points > 0) return `${formatNumber(points)} ponto(s)`;
  return record?.gps ? '1 ponto' : 'Sem GPS';
}

function comparableFarmName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function reviewState(record) {
  const status = String(record?.status || '').toLowerCase();
  if (status.includes('aprov')) return 'approved';
  if (status.includes('reprov')) return 'rejected';
  return 'pending';
}

function normalizeParcelCode(value) {
  const compact = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const parsed = compact.match(/^([a-z]*)(0*\d+)([a-z]*)$/);
  if (!parsed) return compact;
  return `${parsed[1]}${Number(parsed[2])}${parsed[3]}`;
}

function shapeParcelCode(props = {}) {
  let shapeParcel = props.ID_PARCELA || props.IDE || props.ide || props.parcela || props.parcelId || '';
  if (shapeParcel && props.farmId && String(shapeParcel).startsWith(`${props.farmId}-`)) {
    shapeParcel = String(shapeParcel).replace(`${props.farmId}-`, '');
  }
  return shapeParcel;
}

function parcelShapeKey(farmId, parcel) {
  return `${farmId || 'default'}|${normalizeParcelCode(parcel)}`;
}

function geoNumber(value) {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parcelAreaHa(props = {}) {
  return geoNumber(
    props.HECTARE_PA
    || props.HECTARES
    || props.HECTARE
    || props.AREA_HA
    || props.areaHa
  );
}

function parcelKey(record) {
  return `${record.farmId || record.farm || 'sem-fazenda'}|${record.parcel || 'sem-parcela'}`;
}

function parcelLabel(record) {
  const farm = record.farm || 'Sem fazenda';
  const parcel = record.parcel || 'Sem parcela';
  return `${farm} / ${parcel}`;
}

function signalToneFor(value, target) {
  const numeric = Number(value || 0);
  const rawMeta = Number(target || 0);
  if (rawMeta <= 0) return numeric <= 0 ? 'ok' : 'critical';
  const meta = rawMeta;
  if (numeric <= meta) return 'ok';
  if (numeric <= meta * MAP_ATTENTION_MULTIPLIER) return 'warning';
  return 'critical';
}

function buildParcelSignalSummary(records, series, parcelFeatures = [], quantitySeries = null) {
  const selectedSeries = series || BI_SERIES[1];
  const quantitySeriesList = Array.isArray(quantitySeries) && quantitySeries.length
    ? quantitySeries
    : [selectedSeries];
  const approvedRecords = records
    .filter((record) => record.type === 'poda' && reviewState(record) === 'approved');
  const buckets = new Map();

  approvedRecords
    .forEach((record) => {
      const key = parcelShapeKey(record.farmId || record.farm, record.parcel);
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          label: parcelLabel(record),
          records: [],
          areaHa: 0,
        });
      }
      buckets.get(key).records.push(record);
    });

  const hasFeatures = Array.isArray(parcelFeatures) && parcelFeatures.length > 0;
  const featureRows = hasFeatures
    ? parcelFeatures.map((feature) => {
      const props = feature?.properties || {};
      const shapeParcel = shapeParcelCode(props);
      const key = parcelShapeKey(props.farmId, shapeParcel);
      const bucket = buckets.get(key);
      if (!bucket?.records?.length) return null;
      return {
        ...bucket,
        label: `${props.farmName || props.farmId || 'Fazenda'} / ${shapeParcel || '--'}`,
        areaHa: parcelAreaHa(props),
      };
    }).filter(Boolean)
    : Array.from(buckets.values());

  const rows = featureRows.map((bucket) => {
    const aggregated = aggregateRecords(bucket.records);
    const values = qualityValuesFromRow({ qualidade: aggregated });
    const value = Number(values[selectedSeries.key] || 0);
    const tone = signalToneFor(value, selectedSeries.target);
    return {
      ...bucket,
      value,
      tone,
      coletas: bucket.records.length,
    };
  });

  const totals = approvedRecords.length ? aggregateRecords(approvedRecords) : null;
  const totalValues = qualityValuesFromRow({ qualidade: totals || {} });
  const totalQuantity = quantitySeriesList.reduce((acc, item) => {
    const seriesTotal = seriesQuantityFromRow({ qualidade: totals || {} }, item.key, totalValues);
    acc.quantity += Number(seriesTotal.quantity || 0);
    acc.base = Math.max(acc.base, Number(seriesTotal.base || 0));
    return acc;
  }, { quantity: 0, base: 0 });

  return rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.tone] += 1;
    acc.evaluatedAreaHa += Number(row.areaHa || 0);
    if (!acc.worst || row.value > acc.worst.value) acc.worst = row;
    return acc;
  }, {
    total: 0,
    availableParcels: hasFeatures ? parcelFeatures.length : 0,
    ok: 0,
    warning: 0,
    critical: 0,
    worst: null,
    coletas: approvedRecords.length,
    quantity: totalQuantity.quantity,
    base: totalQuantity.base,
    evaluatedAreaHa: 0,
  });
}

function mapMetricIdForSeries(series) {
  return MAP_METRIC_BY_SERIES[series?.key] || 'poda_cacho_exposto';
}

function FieldBiLegend() {
  return (
    <div className="field-bi-legend">
      {BI_SERIES.map((item) => (
        <span key={item.key} title={item.fullLabel}><i style={{ background: item.color }} />{item.label}</span>
      ))}
    </div>
  );
}

function FieldBiFarmChart({ rows, loading = false, selectedLabel = '', onSelect }) {
  const visibleRows = rows.slice(0, 5);

  return (
    <section className="field-bi-panel field-bi-farm-panel">
      <h3>Qualidade por Fazenda</h3>
      <p className="field-bi-farm-note">Percentual consolidado: ocorrências da fazenda / base amostrada da fazenda.</p>
      <FieldBiLegend />
      {loading ? (
        <div className="skeleton-chart" style={{ height: 180 }} />
      ) : (
        <div className="field-bi-farm-table">
          <div className="field-bi-farm-table-head">
            <span>Fazenda</span>
            {BI_SERIES.map((item) => (
              <span key={item.key} style={{ color: item.color }}>{item.label}</span>
            ))}
          </div>
          {visibleRows.map((row) => {
            const values = qualityValuesFromRow(row);
            const active = selectedLabel === row.label;
            return (
              <button
                type="button"
                className={`field-bi-farm-table-row ${active ? 'is-active' : ''}`.trim()}
                key={row.label}
                onClick={() => onSelect?.(row)}
                aria-pressed={active}
              >
                <strong className="field-bi-farm-name">{row.label}</strong>
                {BI_SERIES.map((item) => {
                  const value = values[item.key];
                  const insideTarget = Number(value || 0) <= Number(item.target || 0);
                  return (
                    <span
                      className={`field-bi-farm-cell ${insideTarget ? 'is-in-target' : 'is-out-target'}`}
                      key={item.key}
                      title={`${row.label} - ${item.fullLabel}: ${formatPercent(value)} | Meta <= ${formatPercent(item.target)}`}
                      style={{ '--metric-color': item.color }}
                    >
                      <b>{formatPercent(value, 1)}</b>
                      <em>{insideTarget ? '✓' : '!'}</em>
                    </span>
                  );
                })}
              </button>
            );
          })}
          {!visibleRows.length && <div className="empty-panel smart-empty-panel"><strong>Sem dados de fazenda</strong><span>Troque o mês, ano ou fazenda para localizar coletas já sincronizadas.</span></div>}
        </div>
      )}
    </section>
  );
}

const MemoFieldBiFarmChart = React.memo(FieldBiFarmChart);

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
          <span>{series.fullLabel}</span>
        </button>
      ))}
    </div>
  );
}

const MemoPodaLineMetricSelector = React.memo(PodaLineMetricSelector);

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
  compact = false,
  chartHeightOverride = null,
  columnWidthOverride = null,
  axisLabelEvery = 1,
  className = '',
}) {
  const visibleRows = Number(maxRows) > 0 ? rows.slice(-maxRows) : rows;
  const normalizedSeries = (Array.isArray(series) ? series : [series]).filter(Boolean);
  const selectedSeries = normalizedSeries.length ? normalizedSeries : [BI_SERIES[1]];
  const isMultiSeries = selectedSeries.length > 1;
  const chartHeight = Number(chartHeightOverride) || (compact ? 216 : 244);
  const padding = compact
    ? { top: 24, right: 34, bottom: 18, left: 44 }
    : { top: 30, right: 40, bottom: 20, left: 50 };
  const columnWidth = Number(columnWidthOverride) || (compact ? 76 : 88);
  const width = Math.max(minWidth, padding.left + padding.right + Math.max(visibleRows.length - 1, 1) * columnWidth + 54);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const graphWidth = width - padding.left - padding.right;
  const valuesBySeries = selectedSeries.map((item) => ({
    series: item,
    values: visibleRows.map((row, index) => {
      const values = getValues(row) || {};
      const quantityInfo = seriesQuantityFromRow(row, item.key, values);
      return {
        row,
        key: `${item.key}-${rowKey(row, index)}`,
        label: labelForRow(row),
        value: Number(values[item.key] || 0),
        ...quantityInfo,
      };
    }),
  }));
  const rawMaxValue = Math.max(
    ...selectedSeries.map((item) => Number(item.target || 0) * 1.45),
    ...valuesBySeries.flatMap((group) => group.values.map((item) => item.value * 1.18)),
    1
  );
  const targetValues = selectedSeries.map((item) => Number(item.target || 0)).filter((value) => value > 0);
  const minTargetValue = targetValues.length ? Math.min(...targetValues) : 1;
  const maxTargetValue = targetValues.length ? Math.max(...targetValues) : 2;
  const warningLimit = isMultiSeries ? maxTargetValue : maxTargetValue * 1.5;
  const softScaleMax = Math.max(maxTargetValue * 4, warningLimit * 1.35, 5);
  const hasClippedValues = rawMaxValue > softScaleMax * 1.12;
  const maxValue = hasClippedValues ? softScaleMax : rawMaxValue;
  const yFor = (value) => padding.top + graphHeight - (Math.min(Math.max(value, 0), maxValue) / maxValue) * graphHeight;
  const xFor = (index) => {
    if (visibleRows.length <= 1) return padding.left + graphWidth / 2;
    return padding.left + (index / (visibleRows.length - 1)) * graphWidth;
  };
  const axisLabelStep = Math.max(Number(axisLabelEvery) || 1, 1);
  const axisTicks = visibleRows.map((row, index) => {
    const shouldShowLabel = index === 0 || index === visibleRows.length - 1 || index % axisLabelStep === 0;
    if (!shouldShowLabel) return null;
    const anchor = index === 0 ? 'start' : index === visibleRows.length - 1 ? 'end' : 'middle';
    const x = index === 0
      ? Math.max(xFor(index), padding.left + 2)
      : index === visibleRows.length - 1
        ? Math.min(xFor(index), width - padding.right - 2)
        : xFor(index);
    return {
      key: rowKey(row, index),
      label: labelForRow(row),
      x,
      anchor,
    };
  }).filter(Boolean);
  const pointGroups = valuesBySeries.map((group) => {
    const points = group.values.map((item, index) => ({
      ...item,
      x: xFor(index),
      y: yFor(item.value),
      clipped: item.value > maxValue,
      scaleMax: maxValue,
    }));
    const linePath = points.length === 1
      ? `M ${Math.max(padding.left, points[0].x - 28)} ${points[0].y} L ${Math.min(width - padding.right, points[0].x + 28)} ${points[0].y}`
      : points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const areaPath = points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`
      : '';
    return { ...group, points, linePath, areaPath };
  });
  const targetLines = selectedSeries.map((item) => ({ ...item, y: yFor(Number(item.target || 0)) }));
  const gridValues = Array.from(new Set([0, minTargetValue, warningLimit, Math.ceil(maxValue * 10) / 10]))
    .sort((a, b) => a - b);
  const hasPoints = pointGroups.some((group) => group.points.length);
  const greenBandY = yFor(minTargetValue);
  const warningBandY = yFor(warningLimit);
  const handleHorizontalWheel = (event) => {
    const node = event.currentTarget;
    const maxScrollLeft = node.scrollWidth - node.clientWidth;
    if (maxScrollLeft <= 1) return;

    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!rawDelta) return;

    const multiplier = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? node.clientWidth : 1;
    const delta = rawDelta * multiplier;
    const currentLeft = node.scrollLeft;
    const canScrollLeft = delta < 0 && currentLeft > 0;
    const canScrollRight = delta > 0 && currentLeft < maxScrollLeft - 1;
    if (!canScrollLeft && !canScrollRight) return;

    event.preventDefault();
    node.scrollLeft = Math.max(0, Math.min(maxScrollLeft, currentLeft + delta));
  };

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
          <span key={item.key} title={item.fullLabel}><i style={{ background: item.color }} />{compact ? item.label : item.fullLabel}</span>
        ))}
        <span><i className="field-target-dot" />{isMultiSeries ? 'Linhas de meta' : 'Linha da meta'}</span>
      </div>
      {loading ? (
        <div className="skeleton-chart" style={{ height: chartHeight }} />
      ) : (
        <div className="field-bi-week-scroll" onWheel={handleHorizontalWheel}>
          {hasPoints ? (
            <div className="field-line-chart-track" style={{ width }}>
              <svg className="field-bi-week-chart" viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight}>
                <rect
                  x={padding.left}
                  y={warningBandY}
                  width={graphWidth}
                  height={Math.max(greenBandY - warningBandY, 0)}
                  className="field-target-band field-target-band-warning"
                />
                <rect
                  x={padding.left}
                  y={greenBandY}
                  width={graphWidth}
                  height={Math.max(padding.top + graphHeight - greenBandY, 0)}
                  className="field-target-band field-target-band-ok"
                />
                <rect
                  x={padding.left}
                  y={padding.top}
                  width={graphWidth}
                  height={Math.max(warningBandY - padding.top, 0)}
                  className="field-target-band field-target-band-critical"
                />
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
                            r={isMultiSeries ? 3 : 4}
                            className={`field-line-point ${overTarget ? 'is-over-target' : 'is-under-target'} ${point.clipped ? 'is-clipped' : ''}`.trim()}
                            style={{ fill: group.series.color }}
                          >
                            <title>{seriesPointTooltip(point, group.series)}</title>
                          </circle>
                          {point.clipped ? (
                            <text
                              x={point.x}
                              y={point.y - 12}
                              textAnchor="middle"
                              className="field-line-value is-over-target is-clipped-label"
                            >
                              {formatPercent(point.value, 1)}
                            </text>
                          ) : !isMultiSeries ? (
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
              </svg>
              <div className="field-line-axis-row" style={{ width }} aria-hidden="true">
                {axisTicks.map((tick) => (
                  <span
                    key={`axis-${tick.key}`}
                    className={`field-line-axis-tick is-${tick.anchor}`}
                    style={{ left: tick.x }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
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
  chartHeight = null,
}) {
  const selectedSeries = Array.isArray(series) ? series : [series];
  const chartLabel = selectedSeries.length > 1 ? 'todos os indicadores' : selectedSeries[0]?.fullLabel;
  const isMonth = mode === 'month';
  const periodLabel = isMonth ? 'mensal' : 'semanal';
  return (
    <PodaTargetLineChart
      rows={isMonth ? monthRows : weekRows}
      loading={loading}
      series={series}
      title={`Evolução ${periodLabel}`}
      subtitle={selectedSeries.length > 1 ? 'Todos os indicadores contra a meta operacional.' : `${chartLabel} contra a meta operacional.`}
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
      minWidth={560}
      compact
      chartHeightOverride={chartHeight}
      className="field-bi-evolution-panel"
    />
  );
}

const MemoFieldBiEvolutionChart = React.memo(FieldBiEvolutionChart);

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
            <h3>Fiscal resp. equipe</h3>
            <span>{selectedLabel ? 'fiscal da equipe em análise' : 'clique para analisar'}</span>
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
          {!visibleRows.length && <div className="empty-panel smart-empty-panel"><strong>Sem fiscais</strong><span>Nenhuma coleta do período trouxe fiscal responsável da equipe válido.</span></div>}
        </>
      )}
    </section>
  );
}

function FieldBiMapPanel({
  mapProps,
  records,
  loading = false,
  mapSeries,
  summarySeries,
  onOpenGeoQuality,
  onMapLoadingChange,
}) {
  const activeSeries = mapSeries || BI_SERIES[1];
  const activeSummarySeries = useMemo(() => (
    Array.isArray(summarySeries) && summarySeries.length ? summarySeries : [activeSeries]
  ), [activeSeries, summarySeries]);
  const isAllSummary = activeSummarySeries.length > 1;
  const [selectedParcelState, setSelectedParcelState] = useState({ mapKey: '', summary: null });
  const [parcelGeoJson, setParcelGeoJson] = useState(null);
  const mapMetricId = mapMetricIdForSeries(activeSeries);
  const farmFilterKey = mapProps?.farmFilter || 'all';
  const filteredParcelFeatures = useMemo(() => (
    parcelGeoJson?.features?.filter((feature) => (
      farmFilterKey === 'all'
      || feature.properties?.farmId === farmFilterKey
    )) || []
  ), [farmFilterKey, parcelGeoJson]);
  const signalSummary = useMemo(
    () => buildParcelSignalSummary(records, activeSeries, filteredParcelFeatures, activeSummarySeries),
    [records, activeSeries, filteredParcelFeatures, activeSummarySeries]
  );
  const mapKey = [
    'poda-inline-map',
    mapMetricId,
    mapProps?.farmFilter || 'all',
    mapProps?.sourceFilter || 'all',
    mapProps?.dateFrom || 'start',
    mapProps?.dateTo || 'end',
  ].join('-');
  const selectedParcelSummary = selectedParcelState.mapKey === mapKey ? selectedParcelState.summary : null;
  const selectedParcelDateRange = useMemo(() => {
    if (!selectedParcelSummary) return '';
    const firstDate = formatDateBr(selectedParcelSummary.firstDate) || selectedParcelSummary.firstDate || '';
    const lastDate = formatDateBr(selectedParcelSummary.lastDate) || selectedParcelSummary.lastDate || '';
    if (firstDate && lastDate && firstDate !== lastDate) return `${firstDate} a ${lastDate}`;
    return firstDate || lastDate || 'Sem data';
  }, [selectedParcelSummary]);
  const selectedParcelTone = useMemo(() => {
    if (!selectedParcelSummary) return '';
    return signalToneFor(Number(selectedParcelSummary.value || 0), activeSeries.target);
  }, [activeSeries.target, selectedParcelSummary]);
  const selectedParcelMetrics = useMemo(() => {
    if (!selectedParcelSummary) return [];
    const totals = selectedParcelSummary.totals || aggregateRecords(selectedParcelSummary.records || []);
    const values = qualityValuesFromRow({ qualidade: totals });

    return BI_SERIES.map((series) => {
      const { quantity, base } = seriesQuantityFromRow({ qualidade: totals }, series.key, values);
      const value = Number(values[series.key] || 0);
      const isInTarget = value <= Number(series.target || 0);

      return {
        ...series,
        value,
        quantity,
        base,
        isInTarget,
      };
    });
  }, [selectedParcelSummary]);
  const handleParcelSelect = useCallback((summary) => {
    setSelectedParcelState({ mapKey, summary });
  }, [mapKey]);

  useEffect(() => {
    let mounted = true;
    fetch('/data/farm-parcels.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('Mapa de parcelas indisponível.');
        return response.json();
      })
      .then((geojson) => {
        if (mounted) setParcelGeoJson(geojson);
      })
      .catch(() => {
        if (mounted) setParcelGeoJson(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="field-bi-panel field-bi-map-panel">
      <div className="field-bi-map-head">
        <div>
          <h3>Mapa das parcelas</h3>
          <span>
            Semáforo por {activeSeries.fullLabel.toLowerCase()}
            {isAllSummary ? ' · resumo de todos os indicadores' : ''}
          </span>
        </div>
        {onOpenGeoQuality ? (
          <button type="button" onClick={onOpenGeoQuality}>
            <MapPinned size={15} />
            Abrir maior
          </button>
        ) : null}
      </div>

      {selectedParcelSummary ? (
        <div className="field-bi-map-parcel-strip" aria-label="Resumo da parcela selecionada">
          <div className="field-bi-map-parcel-id">
            <span>Parcela</span>
            <strong>{selectedParcelSummary.props?.farmName || selectedParcelSummary.props?.farmId || 'Fazenda'} / {selectedParcelSummary.shapeParcel || '--'}</strong>
            <small>{formatNumber(selectedParcelSummary.records?.length || 0)} coleta(s) · {selectedParcelDateRange}</small>
          </div>
          <div className="field-bi-map-parcel-metrics">
            {selectedParcelMetrics.map((metric) => (
              <div
                key={metric.key}
                title={`${metric.fullLabel}: ${formatPercent(metric.value, 2)} | ${formatNumber(metric.quantity)} ocorrência(s) em ${formatNumber(metric.base)} planta(s) | Meta ${formatPercent(metric.target)}`}
                className={[
                  'field-bi-map-parcel-metric',
                  metric.key === activeSeries.key ? 'is-active' : '',
                  metric.isInTarget ? 'is-in-target' : 'is-out-target',
                  selectedParcelTone ? `tone-${selectedParcelTone}` : '',
                ].filter(Boolean).join(' ')}
                style={{ '--metric-color': metric.color }}
              >
                <span>{metric.label}</span>
                <strong>{formatPercent(metric.value, 1)} {metric.isInTarget ? '✓' : '!'}</strong>
                <small>{formatNumber(metric.quantity)}/{formatNumber(metric.base)}</small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="field-bi-map-signals" aria-label="Resumo do semáforo das parcelas">
          <div className="signal-ok">
            <i />
            <span>Dentro da meta</span>
            <strong>{formatNumber(signalSummary.ok)}</strong>
          </div>
          <div className="signal-warning">
            <i />
            <span>Atenção</span>
            <strong>{formatNumber(signalSummary.warning)}</strong>
          </div>
          <div className="signal-critical">
            <i />
            <span>Crítico</span>
            <strong>{formatNumber(signalSummary.critical)}</strong>
          </div>
          <div className="signal-total">
            <span>Parcelas</span>
            <strong>
              {formatNumber(signalSummary.total)}
              {signalSummary.availableParcels ? `/${formatNumber(signalSummary.availableParcels)}` : ''}
            </strong>
            <small>avaliadas/total</small>
          </div>
          <div className="signal-data">
            <span>Avaliadas</span>
            <strong>{formatNumber(signalSummary.base)}</strong>
            <small>plantas</small>
          </div>
          <div className="signal-data signal-found">
            <span>Encontrado</span>
            <strong>{formatNumber(signalSummary.quantity)}</strong>
            <small>{isAllSummary ? 'todos indicadores' : activeSeries.label.replace('%', '').trim()}</small>
          </div>
          <div className="signal-data">
            <span>Coletas</span>
            <strong>{formatNumber(signalSummary.coletas)}</strong>
            <small>aprovadas</small>
          </div>
          <div className="signal-data">
            <span>Área aval.</span>
            <strong>{formatNumber(signalSummary.evaluatedAreaHa, 1)}</strong>
            <small>hectares</small>
          </div>
        </div>
      )}

      <div className="field-bi-inline-map-frame">
        {loading ? (
          <div className="field-map-suspense">
            <div className="gps-map-loading-spinner" />
            <strong>Carregando mapa das parcelas</strong>
            <span>Aplicando semáforo de qualidade.</span>
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
              {...mapProps}
              areaFilter="poda"
              initialOperation="poda"
              initialMetricId={mapMetricId}
              onParcelSelect={handleParcelSelect}
              onLoadingChange={onMapLoadingChange}
            />
          </Suspense>
        )}
      </div>

      <div className="field-bi-map-legend-card" aria-label="Legenda do mapa das parcelas">
        <div className="field-bi-map-legend-title">
          <strong>Legenda</strong>
          <span>{activeSeries.fullLabel}</span>
        </div>
        <div className="field-bi-map-legend-items">
          <span className="is-ok">
            <i />
            Dentro
            <small>{`até ${formatPercent(activeSeries.target)}`}</small>
          </span>
          <span className="is-warning">
            <i />
            Atenção
            <small>{`até ${formatPercent(activeSeries.target * MAP_ATTENTION_MULTIPLIER)}`}</small>
          </span>
          <span className="is-critical">
            <i />
            Crítico
            <small>{`acima de ${formatPercent(activeSeries.target * MAP_ATTENTION_MULTIPLIER)}`}</small>
          </span>
          <span className="is-empty">
            <i />
            Sem avaliação
            <small>sem coleta no filtro</small>
          </span>
        </div>
      </div>
    </section>
  );
}

const MemoFieldBiMapPanel = React.memo(FieldBiMapPanel);

function DailyBunchBarChart({ rows, loading = false, series = BI_SERIES[1], chartHeight = 188 }) {
  const selectedSeries = Array.isArray(series) ? series : [series];
  const chartLabel = selectedSeries.length > 1 ? 'todos os indicadores' : selectedSeries[0]?.fullLabel;
  const axisLabelEvery = rows.length > 80 ? 5 : rows.length > 52 ? 4 : rows.length > 32 ? 3 : rows.length > 18 ? 2 : 1;
  const columnWidth = rows.length > 80 ? 34 : rows.length > 52 ? 42 : rows.length > 32 ? 50 : 58;
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
      maxRows={rows.length || 1}
      minWidth={900}
      chartHeightOverride={chartHeight}
      columnWidthOverride={columnWidth}
      axisLabelEvery={axisLabelEvery}
      className="field-bi-daily-panel"
    />
  );
}

const MemoDailyBunchBarChart = React.memo(DailyBunchBarChart);

function buildTotalMetricGroups(model) {
  const totals = model.podaTotals || {};
  const basePlantas = Math.max(totals.podaPlantasObservadas || 0, 0);
  const quality = model.quality || {};

  return [
    {
      id: 'qualidade',
      title: 'Indicadores de qualidade da poda',
      cards: [
        { label: 'Planta sem podar', value: formatPercent(quality.cachoMaduroPct), detail: `${formatNumber(totals.plantaSemPodar)} plantas`, tone: qualityTone(quality.cachoMaduroPct, BI_SERIES[0].target).tone === 'green' ? 'success' : 'danger' },
        { label: 'Cacho exposto', value: formatPercent(quality.cachoPassadoPct), detail: `${formatNumber(totals.cachoExposto)} ocorrências`, tone: qualityTone(quality.cachoPassadoPct, BI_SERIES[1].target).tone === 'green' ? 'neutral' : 'danger' },
        { label: 'Poda meia coroa', value: formatPercent(quality.cachoVerdePct), detail: `${formatNumber(totals.podaMeiaCoroa)} ocorrências`, tone: qualityTone(quality.cachoVerdePct, BI_SERIES[2].target).tone === 'green' ? 'neutral' : 'warning' },
        { label: 'Cacho podre', value: formatPercent(quality.cachoAvermelhadoPct), detail: `${formatNumber(totals.cachoPodrePlanta)} ocorrências`, tone: qualityTone(quality.cachoAvermelhadoPct, BI_SERIES[3].target).tone === 'green' ? 'neutral' : 'danger' },
        { label: 'Poda maior 1:1', value: formatPercent(quality.taloCompridoPct), detail: `${formatNumber(totals.podaMaiorUmParaUm)} ocorrências`, tone: qualityTone(quality.taloCompridoPct, BI_SERIES[4].target).tone === 'green' ? 'neutral' : 'warning' },
        { label: 'Bico de gaita', value: formatPercent(quality.cachoEstrelaPct), detail: `${formatNumber(totals.bicoGaita)} ocorrências`, tone: qualityTone(quality.cachoEstrelaPct, BI_SERIES[5].target).tone === 'green' ? 'neutral' : 'warning' },
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
  const collectionRows = [...(model.podaRecords || model.records || [])]
    .sort((a, b) => (resolveRecordDate(b)?.getTime?.() || 0) - (resolveRecordDate(a)?.getTime?.() || 0));

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

      <section className="field-total-section field-total-table-section field-total-collection-section">
        <div className="field-total-section-head">
          <div>
            <h3>Coletas detalhadas</h3>
            <span>Todas as fichas de poda carregadas no filtro atual, com origem, status e indicadores coletados.</span>
          </div>
          <strong>{formatNumber(collectionRows.length)} ficha(s)</strong>
        </div>
        <div className="field-total-table-wrap">
          <table className="field-total-table field-total-collection-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Fonte</th>
                <th>Status</th>
                <th>Fazenda</th>
                <th>Parcela</th>
                <th>Ciclo</th>
                <th>Avaliador</th>
                <th>Fiscal equipe</th>
                <th>Linhas</th>
                <th>Plantas</th>
                <th>Sem podar</th>
                <th>Cacho exposto</th>
                <th>Meia coroa</th>
                <th>Poda &gt; 1:1</th>
                <th>Bico gaita</th>
                <th>Cacho podre</th>
                <th>Folha mamando</th>
                <th>Palha M.E.</th>
                <th>GPS</th>
              </tr>
            </thead>
            <tbody>
              {collectionRows.map((record) => {
                const totals = record.totals || {};
                return (
                  <tr key={record.id}>
                    <td>{collectionDateLabel(record)}</td>
                    <td>{record.sourceLabel || record.source || '--'}</td>
                    <td>{record.status || '--'}</td>
                    <td>{record.farm || '--'}</td>
                    <td>{record.parcel || '--'}</td>
                    <td>{record.cycle || '--'}</td>
                    <td>{record.evaluator || '--'}</td>
                    <td>{record.fiscal || '--'}</td>
                    <td>{formatNumber(totals.linhas)}</td>
                    <td>{formatNumber(totals.plantasObservadas)}</td>
                    <td>{formatNumber(totals.plantaSemPodar)}</td>
                    <td>{formatNumber(totals.cachoExposto)}</td>
                    <td>{formatNumber(totals.podaMeiaCoroa)}</td>
                    <td>{formatNumber(totals.podaMaiorUmParaUm)}</td>
                    <td>{formatNumber(totals.bicoGaita)}</td>
                    <td>{formatNumber(totals.cachoPodrePlanta)}</td>
                    <td>{formatNumber(totals.folhaMamando)}</td>
                    <td>{formatNumber(totals.palhaMalEmpilhada)}</td>
                    <td>{collectionGpsLabel(record)}</td>
                  </tr>
                );
              })}
              {!collectionRows.length ? (
                <tr>
                  <td colSpan="19">Sem coletas de poda no filtro atual.</td>
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
  sourceFilter = 'all',
  setSourceFilter,
  boardMode,
  setBoardMode,
  totalSection,
  setTotalSection,
  diagnostics,
  recordCount,
  onResetFilters,
  onClearFilter,
  onPresent,
  onOpenGeoQuality,
  mapProps,
  presentationMode = false,
}) {
  const isTotalMode = !presentationMode && boardMode === 'total';
  const [selectedLineKey, setSelectedLineKey] = useState('all');
  const [selectedFiscalLabel, setSelectedFiscalLabel] = useState('');
  const [selectedFarmLabel, setSelectedFarmLabel] = useState('');
  const [evolutionMode, setEvolutionMode] = useState('week');
  const [viewReady, setViewReady] = useState(false);
  const [mapLoadingState, setMapLoadingState] = useState({
    loading: true,
    progress: 12,
    label: 'Preparando mapa das parcelas',
  });
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
  const selectedFarmId = useMemo(() => {
    if (!selectedFarmLabel) return '';
    const recordMatch = focusedRecords.find((record) => recordFarmLabel(record) === selectedFarmLabel && record.farmId)
      || model.records.find((record) => recordFarmLabel(record) === selectedFarmLabel && record.farmId);
    if (recordMatch?.farmId) return recordMatch.farmId;

    const normalizedSelected = comparableFarmName(selectedFarmLabel);
    return CQO_FARMS.find((farm) => comparableFarmName(farm.name) === normalizedSelected)?.id || '';
  }, [focusedRecords, model.records, selectedFarmLabel]);
  const focusedMapProps = useMemo(() => ({
    ...mapProps,
    farmFilter: selectedFarmId || mapProps?.farmFilter || 'all',
  }), [mapProps, selectedFarmId]);
  const focusedQuality = focusedModel.quality || quality;
  const selectedSeries = useMemo(() => (
    selectedLineKey === 'all'
      ? BI_SERIES
      : [BI_SERIES.find((series) => series.key === selectedLineKey) || primaryPodaSeries(focusedQuality)]
  ), [focusedQuality, selectedLineKey]);
  const mapSeries = useMemo(() => (
    selectedLineKey === 'all'
      ? primaryPodaSeries(focusedQuality)
      : selectedSeries[0]
  ), [focusedQuality, selectedLineKey, selectedSeries]);

  const handleSelectFiscal = useCallback((row) => {
    setSelectedFiscalLabel((current) => (current === row.label ? '' : row.label));
  }, []);

  const handleSelectFarm = useCallback((row) => {
    setSelectedFarmLabel((current) => (current === row.label ? '' : row.label));
  }, []);

  const clearFocus = useCallback(() => {
    setSelectedFiscalLabel('');
    setSelectedFarmLabel('');
  }, []);

  const handleMapLoadingChange = useCallback((state) => {
    setMapLoadingState((current) => {
      const nextProgress = Math.max(0, Math.min(100, Number(state?.progress || 0)));
      const nextLabel = state?.label || (state?.loading ? 'Preparando mapa das parcelas' : 'Mapa pronto');
      const nextLoading = Boolean(state?.loading);
      if (
        current.loading === nextLoading
        && current.progress === nextProgress
        && current.label === nextLabel
      ) {
        return current;
      }
      return {
        loading: nextLoading,
        progress: nextProgress,
        label: nextLabel,
      };
    });
  }, []);

  const handleOpenGeoQuality = useCallback(() => {
    onOpenGeoQuality?.(focusedMapProps);
  }, [focusedMapProps, onOpenGeoQuality]);

  const viewSignature = useMemo(() => [
    boardMode,
    selectedLineKey,
    selectedFarmLabel,
    selectedFiscalLabel,
    evolutionMode,
    recordCount,
    focusedMapProps?.farmFilter || 'all',
    focusedMapProps?.sourceFilter || 'all',
    focusedMapProps?.dateFrom || '',
    focusedMapProps?.dateTo || '',
  ].join('|'), [
    boardMode,
    evolutionMode,
    focusedMapProps?.dateFrom,
    focusedMapProps?.dateTo,
    focusedMapProps?.farmFilter,
    focusedMapProps?.sourceFilter,
    recordCount,
    selectedFarmLabel,
    selectedFiscalLabel,
    selectedLineKey,
  ]);

  useEffect(() => {
    if (presentationMode) {
      return undefined;
    }

    const resetTimer = window.setTimeout(() => setViewReady(false), 0);
    const settleTimer = window.setTimeout(() => setViewReady(true), loading ? 280 : 520);
    const safetyTimer = window.setTimeout(() => {
      setViewReady(true);
      setMapLoadingState((current) => (current.loading ? {
        loading: false,
        progress: 100,
        label: 'Mapa pronto',
      } : current));
    }, 5200);

    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [loading, presentationMode, viewSignature]);

  const mapAreaActive = !isTotalMode && !loading && recordCount > 0;
  const showBoardLoading = !presentationMode && (
    loading
    || (mapAreaActive && (!viewReady || mapLoadingState.loading))
  );
  const boardLoadingProgress = loading
    ? 24
    : mapAreaActive
      ? Math.max(viewReady ? 72 : 48, mapLoadingState.progress)
      : 100;
  const boardLoadingLabel = loading
    ? 'Buscando dados de poda'
    : mapAreaActive
      ? mapLoadingState.label
      : 'Preparando visualização';

  return (
    <div className={`field-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      {showBoardLoading ? (
        <div className="field-bi-ready-overlay" role="status" aria-live="polite">
          <div className="field-bi-ready-card">
            <div className="field-bi-ready-orb" />
            <strong>Preparando CQO Poda</strong>
            <span>{boardLoadingLabel}</span>
            <div className="field-bi-ready-progress" aria-hidden="true">
              <i style={{ width: `${Math.min(100, Math.max(8, boardLoadingProgress))}%` }} />
            </div>
          </div>
        </div>
      ) : null}
      <div className="field-bi-header">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="field-bi-logo" />
        <div className="field-bi-title-block">
          <h2>VNA - Qualidade Agrícola - Poda</h2>
          <div className="field-bi-meta-line">
            <span title={`Período filtrado: ${periodText}`}><CalendarDays size={14} />Período: {periodText}</span>
            <ActiveFilterSummary filters={filterState} onClearFilter={onClearFilter} />
            <span><RefreshCw size={14} />Atualizado: {updateText}</span>
            <span><CalendarDays size={14} />Última coleta: {latestCollectionText}</span>
          </div>
        </div>
        {!presentationMode && (
          <div className="field-bi-header-actions">
            <button type="button" className="field-bi-present-btn" onClick={onPresent}>
              <MonitorPlay size={18} />
              Apresentar
              <Maximize2 size={15} />
            </button>
          </div>
        )}
      </div>

      {presentationMode ? (
        <div className="field-bi-presentation-filters" aria-label="Filtros da apresentação CQO Poda">
          <label>
            <span>Fonte</span>
            <select
              value={sourceFilter || 'all'}
              onChange={(event) => setSourceFilter?.(event.target.value)}
              disabled={!setSourceFilter}
            >
              <option value="all">App + Excel</option>
              <option value="app">Só App</option>
              <option value="excel">Só Excel</option>
            </select>
          </label>
          <label>
            <span>Data inicial</span>
            <input
              type="date"
              value={dateFrom || ''}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom?.(event.target.value)}
              disabled={!setDateFrom}
            />
          </label>
          <label>
            <span>Data final</span>
            <input
              type="date"
              value={dateTo || ''}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo?.(event.target.value)}
              disabled={!setDateTo}
            />
          </label>
        </div>
      ) : null}

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
            <FieldBiKpiCard loading={loading} label="Planta sem podar %" value={focusedQuality.cachoMaduroPct} meta={BI_SERIES[0].target} active={selectedLineKey === 'maduro'} onClick={() => setSelectedLineKey('maduro')} />
            <FieldBiKpiCard loading={loading} label="Cacho exposto %" value={focusedQuality.cachoPassadoPct} meta={BI_SERIES[1].target} active={selectedLineKey === 'passado'} onClick={() => setSelectedLineKey('passado')} />
            <FieldBiKpiCard loading={loading} label="Poda meia coroa %" value={focusedQuality.cachoVerdePct} meta={BI_SERIES[2].target} active={selectedLineKey === 'verde'} onClick={() => setSelectedLineKey('verde')} />
            <FieldBiKpiCard loading={loading} label="Cacho podre %" value={focusedQuality.cachoAvermelhadoPct} meta={BI_SERIES[3].target} active={selectedLineKey === 'avermelhado'} onClick={() => setSelectedLineKey('avermelhado')} />
            <FieldBiKpiCard loading={loading} label="Poda maior 1:1 %" value={focusedQuality.taloCompridoPct} meta={BI_SERIES[4].target} active={selectedLineKey === 'estrela'} onClick={() => setSelectedLineKey('estrela')} />
            <FieldBiKpiCard loading={loading} label="Bico de gaita %" value={focusedQuality.cachoEstrelaPct} meta={BI_SERIES[5].target} active={selectedLineKey === 'talo'} onClick={() => setSelectedLineKey('talo')} />
          </div>

          <MemoPodaLineMetricSelector
            selectedKey={selectedLineKey}
            activeSeries={BI_SERIES}
            onSelect={setSelectedLineKey}
          />

          {selectedFiscalRow || selectedFarmRow ? (
            <div className="field-bi-focus-chip">
              <span>Filtro da análise</span>
              {selectedFarmRow ? <strong>Fazenda: {selectedFarmRow.label}</strong> : null}
              {selectedFiscalRow ? <strong>Fiscal equipe: {selectedFiscalRow.label}</strong> : null}
              <em>{formatNumber(focusedModel.records.length)} coleta(s)</em>
              <button type="button" onClick={clearFocus}>Ver todos</button>
            </div>
          ) : null}

          <div className="field-bi-main-grid">
            <MemoFieldBiFarmChart
              rows={farmChartModel.farmRows}
              loading={loading}
              selectedLabel={selectedFarmLabel}
              onSelect={handleSelectFarm}
            />
            <MemoFieldBiEvolutionChart
              weekRows={focusedModel.weekRows}
              monthRows={focusedModel.monthRows}
              loading={loading}
              series={selectedSeries}
              mode={evolutionMode}
              onModeChange={setEvolutionMode}
              chartHeight={presentationMode ? 136 : null}
            />
            <MemoFieldBiMapPanel
              mapProps={focusedMapProps}
              records={focusedRecords}
              loading={loading}
              mapSeries={mapSeries}
              summarySeries={selectedSeries}
              onOpenGeoQuality={handleOpenGeoQuality}
              onMapLoadingChange={handleMapLoadingChange}
            />
            <MemoDailyBunchBarChart
              rows={focusedDailyRows}
              loading={loading}
              series={selectedSeries}
              chartHeight={presentationMode ? 190 : 188}
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
    <div className="presentation-overlay field-bi-presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentacao em tela cheia">
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
            <p>Shapes das parcelas com semáforo de qualidade da poda, filtros atuais e detalhe por fazenda, parcela e período.</p>
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

export default function PodaDashboard({ theme, farmFilter, areaFilter = 'poda', periodFilter, cycleFilter, evaluatorFilter, sourceFilter = 'all', setSourceFilter, dateFrom, dateTo, setDateFrom, setDateTo, searchTerm, lastSyncTime, onResetFilters, onClearFilter }) {
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [geoQualityOpen, setGeoQualityOpen] = useState(false);
  const [geoQualityMapProps, setGeoQualityMapProps] = useState(null);
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

  const demoRecords = useMemo(() => (LOCAL_DEMO_MODE ? buildPodaDemoRecords() : []), []);
  const mergedRecords = useMemo(() => {
    const realPoda = records.filter((record) => record.type === 'poda');
    return [...demoRecords, ...realPoda];
  }, [records, demoRecords]);

  const model = useMemo(() => buildPodaOperacional(mergedRecords), [mergedRecords]);
  const dailyBunchRows = useMemo(() => buildDailyBunchRows(mergedRecords), [mergedRecords]);
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
      rawExcelRows: Number(cqoImport?.podaRows || 0),
      transformedRecords,
      visibleCount,
      hiddenByFilters,
      mobileCount: mobileRecords.filter((r) => r.type === 'poda').length,
      excelCount: excelRecords.filter((r) => r.type === 'poda').length,
      podaSnapshotRows: Number(cqoImport?.podaRows || 0),
      snapshotLabel: 'CQO Poda',
      updatedAtLabel: updateLabel(lastSyncTime),
      filterLabel: [
        farmFilterLabel(farmFilter),
        sourceFilterLabel(sourceFilter),
        periodLabel(dateFrom, dateTo),
      ].filter(Boolean).join(' · '),
    };
  }, [allRecords, mobileRecords, excelRecords, mergedRecords, records, demoRecords.length, cqoImport?.podaRows, farmFilter, sourceFilter, dateFrom, dateTo, lastSyncTime]);

  const mapProps = useMemo(() => ({
    theme,
    farmFilter,
    areaFilter: 'poda',
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
  }), [cycleFilter, dateFrom, dateTo, evaluatorFilter, farmFilter, periodFilter, sourceFilter, theme]);

  const openPresentation = useCallback(() => {
    setPresentationOpen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const closePresentation = useCallback(() => {
    setPresentationOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const openGeoQuality = useCallback((nextMapProps = null) => {
    setGeoQualityMapProps(nextMapProps);
    setGeoQualityOpen(true);
  }, []);

  const closeGeoQuality = useCallback(() => {
    setGeoQualityOpen(false);
    setGeoQualityMapProps(null);
  }, []);

  const boardProps = useMemo(() => ({
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
    sourceFilter,
    setSourceFilter,
    boardMode,
    setBoardMode,
    totalSection,
    setTotalSection,
    diagnostics,
    recordCount: mergedRecords.length,
    onResetFilters,
    onClearFilter,
    mapProps,
  }), [
    dailyBunchRows,
    dateFrom,
    dateTo,
    diagnostics,
    filterState,
    latestCollectionText,
    loading,
    mapProps,
    mergedRecords.length,
    model,
    onClearFilter,
    onResetFilters,
    periodText,
    quality,
    setDateFrom,
    setDateTo,
    sourceFilter,
    setSourceFilter,
    totalSection,
    updateText,
    boardMode,
  ]);

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
