const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_DAYS = 90;
const MAX_WINDOWS = 48;
const MAX_PAGES = 250;
const MAX_RECORDS = 100_000;

function parseDateOnly(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoTimestamp(date) {
  return date.toISOString();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function buildAgroDateWindows(dateFrom = '', dateTo = '') {
  let from = parseDateOnly(dateFrom);
  let toExclusive = parseDateOnly(dateTo);
  if (toExclusive) toExclusive = addDays(toExclusive, 1);

  if (!from && !toExclusive) return [{}];
  if (!from) from = addDays(toExclusive, -MAX_WINDOW_DAYS);
  if (!toExclusive) toExclusive = addDays(from, MAX_WINDOW_DAYS);
  if (toExclusive <= from) return [];

  const windows = [];
  let cursor = from;
  while (cursor < toExclusive) {
    if (windows.length >= MAX_WINDOWS) {
      throw new Error('O período solicitado é muito extenso para uma única atualização.');
    }
    const end = new Date(Math.min(
      cursor.getTime() + MAX_WINDOW_DAYS * DAY_MS,
      toExclusive.getTime()
    ));
    windows.push({
      from: isoTimestamp(cursor),
      to: isoTimestamp(end),
    });
    cursor = end;
  }
  return windows;
}

function responseErrorMessage(status, payload) {
  const detail = String(payload?.error?.message || '').trim();
  if (detail) return detail;
  if (status === 401 || status === 403) {
    return 'Sua sessão expirou. Entre novamente para consultar a API AGRO.';
  }
  return `A API AGRO respondeu com HTTP ${status}.`;
}

async function requestAgroPage(endpoint, query, sessionToken, signal) {
  const response = await fetch(`${endpoint}?${query.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    cache: 'no-store',
    signal,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw new Error(`A API AGRO respondeu com HTTP ${response.status}.`);
  }
  if (!response.ok) throw new Error(responseErrorMessage(response.status, payload));
  return payload || {};
}

async function fetchAgroWindow({
  endpoint,
  window,
  params,
  sessionToken,
  signal,
  limit,
  maxPages,
}) {
  const records = [];
  let cursor = '';
  let generatedAt = null;
  let source = 'AGRO';
  let meta = {};
  let pageCount = 0;
  const seenCursors = new Set();

  do {
    const query = new URLSearchParams();
    Object.entries({ ...window, ...params }).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        query.set(key, String(value));
      }
    });
    query.set('limit', String(limit));
    if (cursor) query.set('cursor', cursor);

    const payload = await requestAgroPage(endpoint, query, sessionToken, signal);
    const pageRecords = Array.isArray(payload?.data)
      ? payload.data
      : (payload?.data && typeof payload.data === 'object' ? [payload.data] : []);
    records.push(...pageRecords);
    generatedAt = payload?.meta?.generatedAt || generatedAt;
    source = payload?.meta?.source || source;
    meta = { ...meta, ...(payload?.meta || {}) };
    pageCount += 1;

    const nextCursor = String(payload?.page?.nextCursor || '').trim();
    if (!nextCursor || pageRecords.length === 0) break;
    if (seenCursors.has(nextCursor)) throw new Error('A API AGRO repetiu o cursor de paginação.');
    seenCursors.add(nextCursor);
    cursor = nextCursor;

    if (records.length >= MAX_RECORDS) {
      throw new Error('A consulta AGRO excedeu o limite seguro de registros.');
    }
  } while (pageCount < maxPages);

  return { records, generatedAt, source, meta, pageCount };
}

function uniqueRecords(records, keyForRecord) {
  if (typeof keyForRecord !== 'function') return records;
  const seen = new Set();
  return records.filter((record, index) => {
    const key = String(keyForRecord(record, index) || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchAgroDataset(endpoint, {
  sessionToken,
  dateFrom = '',
  dateTo = '',
  params = {},
  signal,
  limit = 200,
  maxPages = MAX_PAGES,
  latestWindowOnly = false,
  keyForRecord,
} = {}) {
  if (!sessionToken) throw new Error('Sessão do dashboard não configurada para a API AGRO.');
  const allWindows = buildAgroDateWindows(dateFrom, dateTo);
  const windows = latestWindowOnly ? allWindows.slice(-1) : allWindows;
  if (!windows.length) {
    return {
      records: [],
      generatedAt: null,
      source: 'AGRO',
      meta: {},
      pageCount: 0,
      windowCount: 0,
    };
  }

  const results = [];
  const pending = [...windows];
  const workerCount = Math.min(3, pending.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (pending.length) {
      const window = pending.shift();
      const result = await fetchAgroWindow({
        endpoint,
        window,
        params,
        sessionToken,
        signal,
        limit,
        maxPages,
      });
      results.push(result);
    }
  });
  await Promise.all(workers);

  const generatedAt = results
    .map((result) => result.generatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const records = uniqueRecords(
    results.flatMap((result) => result.records),
    keyForRecord
  );

  return {
    records,
    generatedAt,
    source: results.find((result) => result.source)?.source || 'AGRO',
    meta: results.reduce((merged, result) => ({ ...merged, ...(result.meta || {}) }), {}),
    pageCount: results.reduce((sum, result) => sum + result.pageCount, 0),
    windowCount: windows.length,
  };
}

export async function fetchAgroResource(endpoint, {
  sessionToken,
  params = {},
  signal,
} = {}) {
  if (!sessionToken) throw new Error('Sessão do dashboard não configurada para a API AGRO.');

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  });

  const payload = await requestAgroPage(endpoint, query, sessionToken, signal);
  const records = Array.isArray(payload?.data)
    ? payload.data
    : (payload?.data && typeof payload.data === 'object' ? [payload.data] : []);

  return {
    records,
    generatedAt: payload?.meta?.generatedAt || null,
    source: payload?.meta?.source || 'AGRO',
    meta: payload?.meta || {},
    pageCount: 1,
    windowCount: 1,
  };
}

export function normalizeAgroMonthKey(value) {
  const direct = String(value || '').trim().match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (direct) return direct[0];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function previousMonthStart(value) {
  const parsed = parseDateOnly(value);
  if (!parsed) return '';
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 10);
}

function normalizedText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function farmNameFromRecord(ticket, qualityByTicket) {
  const quality = qualityByTicket.get(String(ticket.ticketCode || ''));
  const value = quality?.farmName || quality?.farmCode || ticket.origin || '';
  return normalizedText(value).replace(/^FAZENDA\s+/i, '');
}

function addWeight(map, key, pesoLiquidoKg) {
  if (!key || !Number.isFinite(pesoLiquidoKg) || pesoLiquidoKg <= 0) return;
  map.set(key, (map.get(key) || 0) + pesoLiquidoKg);
}

function firstValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function firstNumber(record, keys) {
  const value = firstValue(record, keys);
  if (value === null) return 0;
  const normalized = typeof value === 'string'
    ? value.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
    : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function firstBoolean(record, keys) {
  const value = firstValue(record, keys);
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'não', 'nao'].includes(normalized)) return false;
  return null;
}

function nestedRows(records, keys) {
  const rows = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    rows.push(value);
    keys.forEach((key) => {
      if (value[key] && value[key] !== value) visit(value[key]);
    });
  };
  visit(records);
  return rows;
}

function normalizedStatus(record) {
  return normalizedText(firstValue(record, [
    'status',
    'availability',
    'availabilityStatus',
    'readiness',
    'state',
    'situacao',
  ])).toLowerCase();
}

function blockedStatus(status) {
  return /(unavailable|blocked|pending|rejected|incomplete|not.?ready|insufficient|indispon|bloque|pendente|rejeitad|incomplet)/i
    .test(status);
}

function officialWeight(record, averageBunchKg) {
  if (!(averageBunchKg > 0)) return false;
  const status = normalizedStatus(record);
  if (blockedStatus(status)) return false;

  const flags = [
    firstBoolean(record, ['available']),
    firstBoolean(record, ['official', 'isOfficial']),
    firstBoolean(record, ['homologated', 'isHomologated']),
    firstBoolean(record, ['approved', 'isApproved']),
    firstBoolean(record, ['complete', 'isComplete']),
  ].filter((value) => value !== null);

  if (flags.some((value) => value === false)) return false;
  if (flags.some((value) => value === true)) return true;
  if (/(available|ready|official|homologated|approved|dispon|pronto|homologad|aprovad)/i.test(status)) {
    return true;
  }

  // This endpoint only publishes official candidates. A positive value without
  // an explicit blocking state is therefore valid, but no value is invented.
  return !status;
}

function weightReason(record) {
  const direct = firstValue(record, [
    'reason',
    'message',
    'justification',
    'motivo',
    'detail',
  ]);
  if (direct) return normalizedText(direct);
  const reasons = firstValue(record, ['reasons', 'blockers', 'issues']);
  if (Array.isArray(reasons)) {
    return reasons
      .map((item) => normalizedText(item?.message || item?.reason || item))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

function normalizeWeightScope(value) {
  const scope = normalizedText(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (['third_party', 'thirdparty', 'terceiros', 'terceiro'].includes(scope)) return 'third_party';
  if (['combined', 'consolidated', 'all', 'todos', 'consolidado'].includes(scope)) return 'combined';
  return 'own';
}

function normalizeExclusionReasons(record) {
  const reasons = firstValue(record, [
    'exclusionReasons',
    'excludedReasons',
    'reasonCounts',
    'motivosExclusao',
  ]);
  if (Array.isArray(reasons)) {
    return reasons.map((item) => ({
      code: normalizedText(item?.code || item?.reason || item?.name || item),
      count: firstNumber(item, ['count', 'tickets', 'quantity', 'quantidade']),
      netWeightKg: firstNumber(item, ['netWeightKg', 'excludedNetWeightKg', 'pesoLiquidoKg']),
    })).filter((item) => item.code);
  }
  if (reasons && typeof reasons === 'object') {
    return Object.entries(reasons).map(([code, detail]) => ({
      code,
      count: typeof detail === 'object'
        ? firstNumber(detail, ['count', 'tickets', 'quantity', 'quantidade'])
        : Number(detail) || 0,
      netWeightKg: typeof detail === 'object'
        ? firstNumber(detail, ['netWeightKg', 'excludedNetWeightKg', 'pesoLiquidoKg'])
        : 0,
    }));
  }
  return [];
}

export function normalizeMonthlyBunchWeights(records = []) {
  const rows = nestedRows(records, [
    'items',
    'rows',
    'months',
    'competencies',
    'competencias',
    'monthlyBunchWeights',
    'byMonth',
    'own',
    'thirdParty',
    'third_party',
    'combined',
  ]);
  const competencies = [];
  const availableByScope = {
    own: new Map(),
    third_party: new Map(),
    combined: new Map(),
  };

  rows.forEach((record) => {
    const key = normalizeAgroMonthKey(firstValue(record, [
      'monthKey',
      'month',
      'competence',
      'competencia',
      'referenceMonth',
      'periodMonth',
      'mes',
      'data',
    ]));
    if (!key) return;

    const scope = normalizeWeightScope(firstValue(record, [
      'scope',
      'originScope',
      'weightScope',
      'escopo',
    ]));
    const pesoLiquidoKg = firstNumber(record, [
      'netWeightKg',
      'totalNetWeightKg',
      'officialNetWeightKg',
      'pesoLiquidoKg',
      'peso_liquido_kg',
    ]);
    const cachos = firstNumber(record, [
      'officialBunchCount',
      'bunchCount',
      'totalBunches',
      'cachos',
      'quantidadeCachos',
      'quantidade_cachos',
    ]);
    const averageBunchKg = firstNumber(record, [
      'averageBunchKg',
      'averageBunchWeightKg',
      'officialBunchWeightKg',
      'officialAverageBunchKg',
      'officialAverageBunchWeightKg',
      'officialAverageKg',
      'pesoMedioCachoKg',
      'peso_medio_cacho_kg',
      'pesoMedioKg',
    ]) || (pesoLiquidoKg > 0 && cachos > 0 ? pesoLiquidoKg / cachos : 0);
    const available = officialWeight(record, averageBunchKg);
    const totalTickets = firstNumber(record, [
      'totalTickets',
      'ticketCount',
      'ticketsTotal',
      'total_tickets',
    ]);
    const includedTickets = firstNumber(record, [
      'includedTickets',
      'validTickets',
      'ticketsIncluded',
      'included_tickets',
    ]);
    const excludedTickets = firstNumber(record, [
      'excludedTickets',
      'invalidTickets',
      'ticketsExcluded',
      'excluded_tickets',
    ]) || Math.max(0, totalTickets - includedTickets);
    const coveragePercent = firstNumber(record, [
      'coveragePercent',
      'ticketCoveragePercent',
      'coveragePct',
      'coberturaPercentual',
    ]) || (totalTickets > 0 ? (includedTickets / totalTickets) * 100 : 0);
    const normalized = {
      monthKey: key,
      scope,
      averageBunchKg,
      pesoLiquidoKg,
      cachos,
      available,
      status: normalizedStatus(record) || (available ? 'available' : 'unavailable'),
      reason: weightReason(record),
      totalTickets,
      includedTickets,
      excludedTickets,
      excludedNetWeightKg: firstNumber(record, [
        'excludedNetWeightKg',
        'excludedWeightKg',
        'pesoLiquidoExcluidoKg',
      ]),
      coveragePercent,
      calculationMethod: normalizedText(firstValue(record, [
        'calculationMethod',
        'method',
        'metodoCalculo',
      ])),
      periodStart: firstValue(record, ['periodStart', 'from', 'inicioPeriodo']),
      periodEndExclusive: firstValue(record, ['periodEndExclusive', 'to', 'fimPeriodoExclusivo']),
      exclusionReasons: normalizeExclusionReasons(record),
    };
    competencies.push(normalized);
    if (available) availableByScope[scope].set(key, normalized);
  });

  const sortedScope = (scope) => Array.from(availableByScope[scope].values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  return {
    // Perdas das fazendas próprias usam somente CFF próprio.
    byMonth: sortedScope('own'),
    byScope: {
      own: sortedScope('own'),
      third_party: sortedScope('third_party'),
      combined: sortedScope('combined'),
    },
    competencies: competencies.sort((a, b) => (
      `${a.monthKey}|${a.scope}`.localeCompare(`${b.monthKey}|${b.scope}`)
    )),
  };
}

function productionWeightKg(record) {
  const kg = firstNumber(record, [
    'netWeightKg',
    'totalNetWeightKg',
    'productionNetWeightKg',
    'allocatedNetWeightKg',
    'allocatedWeightKg',
    'weightKg',
    'productionKg',
    'pesoLiquidoKg',
    'peso_liquido_kg',
    'pesoKg',
  ]);
  if (kg > 0) return kg;
  const tons = firstNumber(record, [
    'netWeightT',
    'productionTon',
    'productionT',
    'productionTons',
    'pesoT',
    'pesoTon',
    'producao_t',
  ]);
  return tons > 0 ? tons * 1000 : 0;
}

function productionDimensions(record) {
  return {
    monthKey: normalizeAgroMonthKey(firstValue(record, [
      'monthKey',
      'month',
      'competence',
      'competencia',
      'referenceMonth',
      'periodMonth',
      'mes',
      'data',
    ])),
    fazenda: normalizedText(firstValue(record, [
      'farmName',
      'farm',
      'fazenda',
      'nomeFazenda',
      'nome_fazenda',
      'farmCode',
    ])).replace(/^FAZENDA\s+/i, ''),
    parcela: normalizedText(firstValue(record, [
      'parcelName',
      'parcel',
      'parcela',
      'parcelCode',
      'codigoParcela',
    ])),
  };
}

function aggregateProduction(rows, keyForRow, mapRow) {
  const map = new Map();
  rows.forEach((record) => {
    const dimensions = productionDimensions(record);
    const key = keyForRow(dimensions);
    const pesoLiquidoKg = productionWeightKg(record);
    if (!key || !(pesoLiquidoKg > 0)) return;
    const current = map.get(key) || { pesoLiquidoKg: 0 };
    current.pesoLiquidoKg += pesoLiquidoKg;
    map.set(key, { ...current, ...mapRow(dimensions) });
  });
  return Array.from(map.values(), (row) => ({
    ...row,
    pesoT: row.pesoLiquidoKg / 1000,
  }));
}

export function normalizeProductionSummary(records = []) {
  const rows = nestedRows(records, [
    'items',
    'rows',
    'summary',
    'summaries',
    'months',
    'farms',
    'parcels',
    'allocations',
    'byMonth',
    'byFarm',
    'byFarmMonth',
    'byFarmParcelMonth',
  ]).filter((record) => productionWeightKg(record) > 0);

  const monthRows = rows.filter((record) => {
    const { monthKey: key, fazenda, parcela } = productionDimensions(record);
    return key && !fazenda && !parcela;
  });
  const farmRows = rows.filter((record) => {
    const { monthKey: key, fazenda, parcela } = productionDimensions(record);
    return fazenda && !key && !parcela;
  });
  const farmMonthRows = rows.filter((record) => {
    const { monthKey: key, fazenda, parcela } = productionDimensions(record);
    return key && fazenda && !parcela;
  });
  const parcelMonthRows = rows.filter((record) => {
    const { monthKey: key, fazenda, parcela } = productionDimensions(record);
    return key && fazenda && parcela;
  });
  const selectedFarmMonthRows = farmMonthRows.length ? farmMonthRows : parcelMonthRows;

  const byFarmMonth = aggregateProduction(
    selectedFarmMonthRows,
    ({ monthKey: key, fazenda }) => `${fazenda}|${key}`,
    ({ monthKey: key, fazenda }) => ({ monthKey: key, fazenda })
  );
  const byMonth = monthRows.length
    ? aggregateProduction(
        monthRows,
        ({ monthKey: key }) => key,
        ({ monthKey: key }) => ({ monthKey: key })
      )
    : aggregateProduction(
        byFarmMonth,
        ({ monthKey: key }) => key,
        ({ monthKey: key }) => ({ monthKey: key })
      );
  const byFarm = farmRows.length
    ? aggregateProduction(
        farmRows,
        ({ fazenda }) => fazenda,
        ({ fazenda }) => ({ fazenda })
      )
    : aggregateProduction(
        byFarmMonth,
        ({ fazenda }) => fazenda,
        ({ fazenda }) => ({ fazenda })
      );
  const byFarmParcelMonth = aggregateProduction(
    parcelMonthRows,
    ({ monthKey: key, fazenda, parcela }) => `${fazenda}|${parcela}|${key}`,
    ({ monthKey: key, fazenda, parcela }) => ({ monthKey: key, fazenda, parcela })
  );

  return {
    byMonth: byMonth.sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    byFarm: byFarm.sort((a, b) => a.fazenda.localeCompare(b.fazenda)),
    byFarmMonth: byFarmMonth.sort((a, b) => `${a.monthKey}|${a.fazenda}`.localeCompare(`${b.monthKey}|${b.fazenda}`)),
    byFarmParcelMonth,
  };
}

export function normalizeLossesReadiness(records = [], meta = {}) {
  const rows = nestedRows(records, [
    'items',
    'rows',
    'months',
    'competencies',
    'competencias',
    'checks',
  ]);
  const primary = rows.find((record) => blockedStatus(normalizedStatus(record)))
    || rows.find((record) => normalizedStatus(record))
    || rows[0]
    || {};
  const status = normalizedStatus(primary)
    || normalizedText(meta?.status || meta?.readiness).toLowerCase()
    || 'unknown';
  const reason = weightReason(primary) || weightReason(meta);
  const reasons = rows
    .map((record) => weightReason(record))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);

  return {
    status,
    available: !blockedStatus(status)
      && /(available|ready|official|homologated|approved|dispon|pronto|homologad|aprovad)/i.test(status),
    reason,
    reasons,
    generatedAt: meta?.generatedAt || null,
  };
}

export function buildAgroBalanceSnapshot({
  qualityScaleTickets = [],
  qualityLosses = [],
  monthlyBunchWeights = [],
  productionSummary = [],
  lossesReadiness = [],
  monthlyWeightsMeta = {},
  productionSummaryMeta = {},
  readinessMeta = {},
  monthlyWeightsAuthoritative = false,
  productionSummaryAuthoritative = false,
  readinessAuthoritative = false,
  generatedAt = null,
} = {}) {
  const qualityByTicket = new Map();
  qualityLosses.forEach((record) => {
    const key = String(record?.ticketCode || '');
    if (!key) return;
    const current = qualityByTicket.get(key);
    const currentDate = Date.parse(current?.recordedAt || current?.measuredAt || 0);
    const nextDate = Date.parse(record?.recordedAt || record?.measuredAt || 0);
    if (!current || nextDate >= currentDate) qualityByTicket.set(key, record);
  });

  const uniqueTickets = new Map();
  qualityScaleTickets.forEach((ticket) => {
    const key = String(ticket?.ticketCode || ticket?.sourceTicketId || '');
    if (!key || uniqueTickets.has(key)) return;
    uniqueTickets.set(key, ticket);
  });

  const byMonth = new Map();
  const byFarm = new Map();
  const byFarmMonth = new Map();

  uniqueTickets.forEach((ticket) => {
    const pesoLiquidoKg = Number(ticket?.netWeightKg || 0);
    const key = normalizeAgroMonthKey(ticket?.enteredAt);
    if (!key || !Number.isFinite(pesoLiquidoKg) || pesoLiquidoKg <= 0) return;
    const farm = farmNameFromRecord(ticket, qualityByTicket);
    addWeight(byMonth, key, pesoLiquidoKg);
    addWeight(byFarm, farm, pesoLiquidoKg);
    addWeight(byFarmMonth, farm ? `${farm}|${key}` : '', pesoLiquidoKg);
  });

  const legacyProductionByMonth = Array.from(byMonth, ([key, pesoLiquidoKg]) => ({
    monthKey: key,
    pesoLiquidoKg,
    pesoT: pesoLiquidoKg / 1000,
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const legacyProductionByFarm = Array.from(byFarm, ([fazenda, pesoLiquidoKg]) => ({
    fazenda,
    pesoLiquidoKg,
    pesoT: pesoLiquidoKg / 1000,
  })).sort((a, b) => a.fazenda.localeCompare(b.fazenda));
  const legacyProductionByFarmMonth = Array.from(byFarmMonth, ([compoundKey, pesoLiquidoKg]) => {
    const separator = compoundKey.lastIndexOf('|');
    return {
      fazenda: compoundKey.slice(0, separator),
      monthKey: compoundKey.slice(separator + 1),
      pesoLiquidoKg,
      pesoT: pesoLiquidoKg / 1000,
    };
  }).sort((a, b) => `${a.monthKey}|${a.fazenda}`.localeCompare(`${b.monthKey}|${b.fazenda}`));

  const officialWeights = normalizeMonthlyBunchWeights(monthlyBunchWeights);
  const officialProduction = normalizeProductionSummary(productionSummary);
  const readiness = normalizeLossesReadiness(lossesReadiness, readinessMeta);
  const production = productionSummaryAuthoritative
    ? officialProduction
    : {
        byMonth: legacyProductionByMonth,
        byFarm: legacyProductionByFarm,
        byFarmMonth: legacyProductionByFarmMonth,
        byFarmParcelMonth: [],
      };
  const hasProduction = production.byMonth.length > 0
    || production.byFarm.length > 0
    || production.byFarmMonth.length > 0;
  const hasOfficialWeights = officialWeights.byMonth.length > 0;

  return {
    available: hasProduction || hasOfficialWeights || readinessAuthoritative,
    online: true,
    source: 'SQL AGRO via Cloudflare',
    sourceLabel: 'SQL AGRO',
    sourceOrigin: 'sql',
    sourceTransport: 'agro-api',
    sourceKind: 'balanca-agro-api',
    importedAt: generatedAt,
    snapshotUpdatedAt: generatedAt,
    pesoMedioCacho: {
      byMonth: officialWeights.byMonth,
      byScope: officialWeights.byScope,
      competencies: officialWeights.competencies,
      status: readiness.status,
    },
    producao: production,
    entradaDeCff: { byMonth: production.byMonth },
    cqoRampa: {
      byFarm: production.byFarm,
      byFarmMonth: production.byFarmMonth,
    },
    readiness,
    metadata: {
      ticketCount: uniqueTickets.size,
      qualityCount: qualityLosses.length,
      generatedAt,
      monthlyWeightsGeneratedAt: monthlyWeightsMeta?.generatedAt || null,
      productionGeneratedAt: productionSummaryMeta?.generatedAt || null,
      monthlyWeightsAuthoritative,
      productionSummaryAuthoritative,
      readinessAuthoritative,
      monthlyWeightCompetencyCount: officialWeights.competencies.length,
      officialWeightCount: officialWeights.byMonth.length,
    },
  };
}

export function mergeAgroBalanceData(sqlData, fallbackData) {
  const hasAuthoritativeContract = Boolean(
    sqlData?.metadata?.monthlyWeightsAuthoritative
    || sqlData?.metadata?.productionSummaryAuthoritative
    || sqlData?.metadata?.readinessAuthoritative
  );
  if (!sqlData?.available && !hasAuthoritativeContract) return fallbackData || null;
  const useOfficialWeights = Boolean(
    sqlData?.metadata?.monthlyWeightsAuthoritative
    || sqlData?.metadata?.readinessAuthoritative
  );
  const useOfficialProduction = Boolean(sqlData?.metadata?.productionSummaryAuthoritative);
  const fallbackWeights = fallbackData?.pesoMedioCacho || { byMonth: [] };
  const fallbackProduction = fallbackData?.producao || { byMonth: [], byFarm: [], byFarmMonth: [] };

  return {
    ...(fallbackData || {}),
    ...sqlData,
    pesoMedioCacho: useOfficialWeights ? sqlData.pesoMedioCacho : fallbackWeights,
    producao: useOfficialProduction ? sqlData.producao : (sqlData.producao?.byMonth?.length
      ? sqlData.producao
      : fallbackProduction),
    entradaDeCff: useOfficialProduction
      ? sqlData.entradaDeCff
      : (sqlData.producao?.byMonth?.length
        ? sqlData.entradaDeCff
        : (fallbackData?.entradaDeCff || { byMonth: fallbackProduction.byMonth || [] })),
    cqoRampa: useOfficialProduction
      ? sqlData.cqoRampa
      : (sqlData.producao?.byMonth?.length
        ? sqlData.cqoRampa
        : (fallbackData?.cqoRampa || {
            byFarm: fallbackProduction.byFarm || [],
            byFarmMonth: fallbackProduction.byFarmMonth || [],
          })),
    metadata: {
      ...(fallbackData?.metadata || {}),
      ...(sqlData.metadata || {}),
      weightSource: useOfficialWeights
        ? (sqlData.pesoMedioCacho?.byMonth?.length ? 'API AGRO oficial' : 'API AGRO: indisponível')
        : (fallbackWeights?.byMonth?.length
          ? fallbackData?.sourceLabel || fallbackData?.source || 'snapshot histórico'
          : 'indisponível'),
      productionSource: useOfficialProduction
        ? 'API AGRO oficial'
        : (sqlData.producao?.byMonth?.length ? 'API AGRO legado' : 'snapshot histórico'),
    },
  };
}
