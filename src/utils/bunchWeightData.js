function normalizedText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function parseDateOnly(value) {
  const text = normalizedText(value);
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(Date.UTC(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    ));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!brMatch) return null;
  const date = new Date(Date.UTC(
    Number(brMatch[3]),
    Number(brMatch[2]) - 1,
    Number(brMatch[1])
  ));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = parseDateOnly(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function firstPositiveNumber(record, keys) {
  for (const key of keys) {
    const value = Number(record?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export function parseBunchWeight(value) {
  const normalized = normalizedText(value)
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const weight = Number(normalized);
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

function normalizedStatus(value) {
  return normalizedText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchesApprovalStatus(record, approvalStatus) {
  const status = normalizedStatus(record?.status);
  if (approvalStatus === 'all') {
    return status.startsWith('aprov') || status.startsWith('pendente');
  }
  if (approvalStatus === 'pending') return status.startsWith('pendente');
  return status.startsWith('aprov');
}

function isFieldWeightRecord(record, approvalStatus) {
  return record?.type === 'corte'
    && record?.source === 'app'
    && matchesApprovalStatus(record, approvalStatus);
}

function recordDeclaredMatureBunches(record) {
  return (Array.isArray(record?.lines) ? record.lines : []).reduce(
    (sum, line) => sum + parseBunchWeight(line?.cacho_maduro),
    0
  );
}

function recordMatureWeights(record, approvalStatus) {
  if (record?.type !== 'corte' || record?.source !== 'app') return [];
  if (!matchesApprovalStatus(record, approvalStatus)) return [];

  return (Array.isArray(record?.lines) ? record.lines : []).flatMap((line) => {
    const values = line?._pesagens_cachos?.cacho_maduro;
    if (!Array.isArray(values)) return [];
    return values.map(parseBunchWeight).filter((weight) => weight > 0);
  });
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildFarmRows(collections) {
  const grouped = new Map();

  collections.forEach((collection) => {
    const current = grouped.get(collection.farm) || {
      farm: collection.farm,
      collectionCount: 0,
      parcelKeys: new Set(),
      weightCount: 0,
      totalWeightKg: 0,
    };
    current.collectionCount += 1;
    current.parcelKeys.add(`${collection.farm}|${collection.parcel}`);
    current.weightCount += collection.weightCount;
    current.totalWeightKg += collection.totalWeightKg;
    grouped.set(collection.farm, current);
  });

  return Array.from(grouped.values())
    .map((row) => ({
      farm: row.farm,
      collectionCount: row.collectionCount,
      parcelCount: row.parcelKeys.size,
      weightCount: row.weightCount,
      totalWeightKg: row.totalWeightKg,
      averageKg: row.weightCount ? row.totalWeightKg / row.weightCount : 0,
    }))
    .sort((a, b) => b.weightCount - a.weightCount || a.farm.localeCompare(b.farm));
}

export function buildFieldBunchWeightSummary(
  records = [],
  { approvalStatus = 'approved' } = {}
) {
  const eligibleRecords = records.filter((record) => (
    isFieldWeightRecord(record, approvalStatus)
  ));
  const collections = eligibleRecords
    .map((record) => {
      const weights = recordMatureWeights(record, approvalStatus);
      if (!weights.length) return null;
      const totalWeightKg = weights.reduce((sum, weight) => sum + weight, 0);
      return {
        id: normalizedText(record.id),
        date: dateKey(record.date || record.raw?.data_avaliacao),
        time: normalizedText(record.time),
        farm: normalizedText(record.farm) || 'Sem fazenda',
        parcel: normalizedText(record.parcel) || '--',
        evaluator: normalizedText(record.evaluator) || normalizedText(record.evaluatorMatricula) || '--',
        evaluatorMatricula: normalizedText(record.evaluatorMatricula),
        weightCount: weights.length,
        totalWeightKg,
        averageKg: totalWeightKg / weights.length,
        minKg: Math.min(...weights),
        maxKg: Math.max(...weights),
        weights,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateOrder = b.date.localeCompare(a.date);
      if (dateOrder) return dateOrder;
      return b.time.localeCompare(a.time);
    });

  const weights = collections.flatMap((collection) => collection.weights);
  const totalWeightKg = weights.reduce((sum, weight) => sum + weight, 0);
  const declaredMatureCount = eligibleRecords.reduce(
    (sum, record) => sum + recordDeclaredMatureBunches(record),
    0
  );
  const farmRows = buildFarmRows(collections);
  const parcelCount = farmRows.reduce((sum, farm) => sum + farm.parcelCount, 0);
  const firstDate = collections
    .map((collection) => collection.date)
    .filter(Boolean)
    .sort()[0] || '';

  return {
    available: weights.length > 0,
    approvalStatus,
    source: approvalStatus === 'all'
      ? 'CQO Corte · todas as coletas'
      : approvalStatus === 'pending'
        ? 'CQO Corte aguardando validação'
        : 'CQO Corte aprovado',
    fieldId: 'cacho_maduro',
    recordCount: eligibleRecords.length,
    collectionCount: collections.length,
    withoutWeightsCount: Math.max(eligibleRecords.length - collections.length, 0),
    weightCount: weights.length,
    declaredMatureCount,
    coveragePercent: declaredMatureCount > 0
      ? (weights.length / declaredMatureCount) * 100
      : 0,
    totalWeightKg,
    averageKg: weights.length ? totalWeightKg / weights.length : 0,
    medianKg: median(weights),
    minKg: weights.length ? Math.min(...weights) : 0,
    maxKg: weights.length ? Math.max(...weights) : 0,
    farmCount: farmRows.length,
    parcelCount,
    firstDate,
    latestDate: collections[0]?.date || '',
    farms: farmRows,
    collections,
  };
}

export function previousCompleteMonthKey({
  dateFrom = '',
  dateTo = '',
  now = new Date(),
} = {}) {
  const currentMonth = monthStart(now);
  const fromMonth = parseDateOnly(dateFrom);
  const toMonth = parseDateOnly(dateTo);
  let referenceMonth = currentMonth;

  if (toMonth && monthStart(toMonth) < currentMonth) {
    referenceMonth = monthStart(toMonth);
  } else if (fromMonth && monthStart(fromMonth) > currentMonth) {
    referenceMonth = monthStart(fromMonth);
  }

  return monthKey(new Date(Date.UTC(
    referenceMonth.getUTCFullYear(),
    referenceMonth.getUTCMonth() - 1,
    1
  )));
}

export function buildRampBunchWeightSummary(
  balanceData,
  { dateFrom = '', dateTo = '', now = new Date(), scope = 'own' } = {}
) {
  const targetMonthKey = previousCompleteMonthKey({ dateFrom, dateTo, now });
  const scopedRows = balanceData?.pesoMedioCacho?.byScope?.[scope];
  const officialRows = Array.isArray(scopedRows)
    ? scopedRows
    : (scope === 'own' && Array.isArray(balanceData?.pesoMedioCacho?.byMonth)
      ? balanceData.pesoMedioCacho.byMonth
      : []);
  const competencyRows = Array.isArray(balanceData?.pesoMedioCacho?.competencies)
    ? balanceData.pesoMedioCacho.competencies.filter(
        (row) => (row?.scope || 'own') === scope
      )
    : [];
  const official = officialRows.find((row) => row?.monthKey === targetMonthKey);
  const competency = competencyRows.find((row) => row?.monthKey === targetMonthKey);
  const row = official || competency || {};
  const averageKg = firstPositiveNumber(row, [
    'averageBunchKg',
    'averageBunchWeightKg',
    'pesoMedioCachoKg',
  ]);
  const totalWeightKg = firstPositiveNumber(row, [
    'pesoLiquidoKg',
    'netWeightKg',
    'totalNetWeightKg',
  ]);
  const bunchCount = firstPositiveNumber(row, [
    'cachos',
    'officialBunchCount',
    'bunchCount',
  ]);
  const computedAverageKg = totalWeightKg > 0 && bunchCount > 0
    ? totalWeightKg / bunchCount
    : 0;
  const available = Boolean(official && (averageKg > 0 || computedAverageKg > 0));

  const summary = {
    available,
    source: 'API AGRO / balança',
    scope,
    monthKey: targetMonthKey,
    averageKg: averageKg || computedAverageKg,
    totalWeightKg,
    bunchCount,
    status: normalizedText(row.status) || (available ? 'available' : 'unavailable'),
    reason: normalizedText(row.reason)
      || normalizedText(balanceData?.readiness?.reason)
      || 'Competência anterior ainda não homologada pela balança.',
    totalTickets: firstPositiveNumber(row, ['totalTickets', 'ticketCount']),
    includedTickets: firstPositiveNumber(row, ['includedTickets', 'validTickets']),
    excludedTickets: firstPositiveNumber(row, ['excludedTickets', 'invalidTickets']),
    excludedNetWeightKg: firstPositiveNumber(row, [
      'excludedNetWeightKg',
      'excludedWeightKg',
    ]),
    coveragePercent: firstPositiveNumber(row, [
      'coveragePercent',
      'ticketCoveragePercent',
      'coveragePct',
    ]),
    exclusionReasons: Array.isArray(row?.exclusionReasons) ? row.exclusionReasons : [],
    calculationMethod: normalizedText(row?.calculationMethod),
  };

  if (scope !== 'own') return summary;

  return {
    ...summary,
    scopes: {
      own: summary,
      third_party: buildRampBunchWeightSummary(balanceData, {
        dateFrom,
        dateTo,
        now,
        scope: 'third_party',
      }),
      combined: buildRampBunchWeightSummary(balanceData, {
        dateFrom,
        dateTo,
        now,
        scope: 'combined',
      }),
    },
  };
}
