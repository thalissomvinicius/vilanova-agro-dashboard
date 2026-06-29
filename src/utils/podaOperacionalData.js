import { aggregateRecords, parseRecordDateValue } from './cqoData';

function recordDate(record) {
  return parseRecordDateValue(
    record.raw?.data_avaliacao
    || record.raw?.data
    || record.raw?.Data
    || record.sentAt
    || record.createdAt
    || record.date,
  );
}

function weekKey(record) {
  const date = recordDate(record);
  if (date && !Number.isNaN(date.getTime())) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `S${String(weekNo).padStart(2, '0')} (${d.getUTCFullYear()})`;
  }
  return 'Sem semana';
}

function monthBucket(record) {
  const date = recordDate(record);
  if (date && !Number.isNaN(date.getTime())) {
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const year = date.getFullYear();
    const month = date.getMonth();
    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${monthNames[month]}/${String(year).slice(-2)}`,
    };
  }
  return { key: 'sem-mes', label: 'Sem mês' };
}

function dayKey(record) {
  const date = recordDate(record);
  if (date && !Number.isNaN(date.getTime())) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  return 'Sem data';
}

function shortLabel(value, size = 18) {
  const text = String(value || 'Sem nome');
  return text.length > size ? `${text.slice(0, size)}...` : text;
}

function createBucket(label, sortKey = label) {
  return { label, sortKey, records: [] };
}

function pushBucket(map, key, record, label = key) {
  if (!map.has(key)) map.set(key, createBucket(label, key));
  map.get(key).records.push(record);
}

/** Mapeia indicadores da poda para as mesmas chaves usadas nos gráficos do Corte. */
function formatPodaQualityRow(bucket) {
  const agg = aggregateRecords(bucket.records);
  return {
    label: bucket.label,
    sortKey: bucket.sortKey,
    records: bucket.records,
    recordsCount: bucket.records.length,
    cachoMaduroPct: agg.plantaSemPodarRate,
    cachoPassadoPct: agg.cachoExpostoRate,
    cachoVerdePct: agg.podaMeiaCoroaRate,
    cachoAvermelhadoPct: agg.cachoPodrePlantaRate,
    taloCompridoPct: agg.podaMaiorUmParaUmRate,
    cachoEstrelaPct: agg.bicoGaitaRate,
    cachoInfermoPct: agg.folhaMamandoPodaRate,
    buchaPct: agg.palhaMalEmpilhadaRate,
    qualidade: agg,
    podaScore: agg.podaScore,
  };
}

export function buildPodaOperacional(records) {
  const podaRecords = records.filter((record) => record.type === 'poda');
  const podaTotals = aggregateRecords(podaRecords);

  const quality = {
    cachoMaduroPct: podaTotals.plantaSemPodarRate,
    cachoPassadoPct: podaTotals.cachoExpostoRate,
    cachoVerdePct: podaTotals.podaMeiaCoroaRate,
    cachoAvermelhadoPct: podaTotals.cachoPodrePlantaRate,
    taloCompridoPct: podaTotals.podaMaiorUmParaUmRate,
    cachoEstrelaPct: podaTotals.bicoGaitaRate,
    cachoInfermoPct: podaTotals.folhaMamandoPodaRate,
    buchaPct: podaTotals.palhaMalEmpilhadaRate,
  };

  const byFarm = new Map();
  const byFiscal = new Map();
  const byWeek = new Map();
  const byMonth = new Map();
  const byDay = new Map();

  podaRecords.forEach((record) => {
    pushBucket(byFarm, record.farm || 'Sem fazenda', record);
    const fiscalLabel = record.fiscal && record.fiscal !== '--' ? record.fiscal : 'Sem fiscal';
    pushBucket(byFiscal, shortLabel(fiscalLabel), record);
    pushBucket(byWeek, weekKey(record), record);
    const month = monthBucket(record);
    pushBucket(byMonth, month.key, record, month.label);
    pushBucket(byDay, dayKey(record), record);
  });

  const farmRows = Array.from(byFarm.values())
    .map(formatPodaQualityRow)
    .sort((a, b) => (b.cachoPassadoPct + b.cachoMaduroPct) - (a.cachoPassadoPct + a.cachoMaduroPct));

  const evaluatorRows = Array.from(byFiscal.values())
    .map(formatPodaQualityRow)
    .sort((a, b) => b.recordsCount - a.recordsCount);

  const weekRows = Array.from(byWeek.values())
    .map(formatPodaQualityRow)
    .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

  const monthRows = Array.from(byMonth.values())
    .map(formatPodaQualityRow)
    .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

  const dayRows = Array.from(byDay.values())
    .map(formatPodaQualityRow)
    .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

  return {
    records: podaRecords,
    podaRecords,
    podaTotals,
    quality,
    farmRows,
    evaluatorRows,
    weekRows,
    monthRows,
    dayRows,
  };
}
