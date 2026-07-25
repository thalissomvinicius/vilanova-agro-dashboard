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
    const pageRecords = Array.isArray(payload?.data) ? payload.data : [];
    records.push(...pageRecords);
    generatedAt = payload?.meta?.generatedAt || generatedAt;
    source = payload?.meta?.source || source;
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

  return { records, generatedAt, source, pageCount };
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
    return { records: [], generatedAt: null, source: 'AGRO', pageCount: 0, windowCount: 0 };
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
    pageCount: results.reduce((sum, result) => sum + result.pageCount, 0),
    windowCount: windows.length,
  };
}

function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
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

export function buildAgroBalanceSnapshot({
  qualityScaleTickets = [],
  qualityLosses = [],
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
    const key = monthKey(ticket?.enteredAt);
    if (!key || !Number.isFinite(pesoLiquidoKg) || pesoLiquidoKg <= 0) return;
    const farm = farmNameFromRecord(ticket, qualityByTicket);
    addWeight(byMonth, key, pesoLiquidoKg);
    addWeight(byFarm, farm, pesoLiquidoKg);
    addWeight(byFarmMonth, farm ? `${farm}|${key}` : '', pesoLiquidoKg);
  });

  const productionByMonth = Array.from(byMonth, ([key, pesoLiquidoKg]) => ({
    monthKey: key,
    pesoLiquidoKg,
    pesoT: pesoLiquidoKg / 1000,
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const productionByFarm = Array.from(byFarm, ([fazenda, pesoLiquidoKg]) => ({
    fazenda,
    pesoLiquidoKg,
    pesoT: pesoLiquidoKg / 1000,
  })).sort((a, b) => a.fazenda.localeCompare(b.fazenda));
  const productionByFarmMonth = Array.from(byFarmMonth, ([compoundKey, pesoLiquidoKg]) => {
    const separator = compoundKey.lastIndexOf('|');
    return {
      fazenda: compoundKey.slice(0, separator),
      monthKey: compoundKey.slice(separator + 1),
      pesoLiquidoKg,
      pesoT: pesoLiquidoKg / 1000,
    };
  }).sort((a, b) => `${a.monthKey}|${a.fazenda}`.localeCompare(`${b.monthKey}|${b.fazenda}`));

  return {
    available: productionByMonth.length > 0,
    online: true,
    source: 'SQL AGRO via Cloudflare',
    sourceLabel: 'SQL AGRO',
    sourceOrigin: 'sql',
    sourceTransport: 'agro-api',
    sourceKind: 'balanca-agro-api',
    importedAt: generatedAt,
    snapshotUpdatedAt: generatedAt,
    pesoMedioCacho: { byMonth: [] },
    producao: {
      byMonth: productionByMonth,
      byFarm: productionByFarm,
      byFarmMonth: productionByFarmMonth,
    },
    entradaDeCff: { byMonth: productionByMonth },
    cqoRampa: {
      byFarm: productionByFarm,
      byFarmMonth: productionByFarmMonth,
    },
    metadata: {
      ticketCount: uniqueTickets.size,
      qualityCount: qualityLosses.length,
      generatedAt,
    },
  };
}

export function mergeAgroBalanceData(sqlData, fallbackData) {
  if (!sqlData?.available) return fallbackData || null;
  return {
    ...(fallbackData || {}),
    ...sqlData,
    pesoMedioCacho: fallbackData?.pesoMedioCacho || sqlData.pesoMedioCacho,
    metadata: {
      ...(fallbackData?.metadata || {}),
      ...(sqlData.metadata || {}),
      weightSource: fallbackData?.pesoMedioCacho?.byMonth?.length
        ? fallbackData.sourceLabel || fallbackData.source || 'snapshot'
        : 'indisponível',
    },
  };
}
