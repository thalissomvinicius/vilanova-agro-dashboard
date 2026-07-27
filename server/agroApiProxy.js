import { Buffer } from 'node:buffer';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';

const MAX_LIMIT = 200;
const MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 15_000;
const ALLOWED_STATUS = new Set(['open', 'closed']);
const COMMON_QUERY_KEYS = ['from', 'to', 'ticket', 'limit', 'cursor'];
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class AgroProxyError extends Error {
  constructor(status, message, code = '') {
    super(message);
    this.name = 'AgroProxyError';
    this.status = status;
    this.code = code;
  }
}

function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new AgroProxyError(503, 'Integração com o AGRO não configurada.');
  return value;
}

function singleHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function bearerToken(request) {
  const authorization = String(singleHeader(request.headers?.authorization) || '').trim();
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]{20,256})$/i);
  if (!match) throw new AgroProxyError(401, 'Sessão do dashboard ausente ou inválida.');
  return match[1];
}

function parseIsoDate(value, field) {
  if (value.length > 40) throw new AgroProxyError(400, `Parâmetro ${field} inválido.`);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new AgroProxyError(400, `Parâmetro ${field} inválido.`);
  return timestamp;
}

function assertUniqueParams(searchParams) {
  for (const key of new Set(searchParams.keys())) {
    if (searchParams.getAll(key).length > 1) {
      throw new AgroProxyError(400, `Parâmetro duplicado: ${key}.`);
    }
  }
}

export function sanitizeAgroQuery(requestUrl = '', {
  allowStatus = false,
  allowProducts = false,
} = {}) {
  const input = new URL(requestUrl, 'https://dashboard.local');
  const allowedKeys = new Set([
    ...COMMON_QUERY_KEYS,
    ...(allowStatus ? ['status'] : []),
    ...(allowProducts ? ['products'] : []),
  ]);
  const output = new URLSearchParams();

  assertUniqueParams(input.searchParams);
  for (const key of input.searchParams.keys()) {
    if (!allowedKeys.has(key)) {
      throw new AgroProxyError(400, `Parâmetro não permitido: ${key}.`);
    }
  }

  const dateValues = {};
  for (const field of ['from', 'to']) {
    const value = String(input.searchParams.get(field) || '').trim();
    if (!value) continue;
    dateValues[field] = parseIsoDate(value, field);
    output.set(field, value);
  }
  if (dateValues.from != null && dateValues.to != null) {
    if (dateValues.to <= dateValues.from) {
      throw new AgroProxyError(400, 'O período informado é inválido.');
    }
    if (dateValues.to - dateValues.from > MAX_WINDOW_MS) {
      throw new AgroProxyError(400, 'O período máximo por consulta é de 90 dias.');
    }
  }

  const ticket = String(input.searchParams.get('ticket') || '').trim();
  if (ticket) {
    if (!/^\d{1,20}$/.test(ticket)) throw new AgroProxyError(400, 'Ticket inválido.');
    output.set('ticket', ticket);
  }

  if (allowStatus) {
    const status = String(input.searchParams.get('status') || '').trim().toLowerCase();
    if (status) {
      if (!ALLOWED_STATUS.has(status)) throw new AgroProxyError(400, 'Status inválido.');
      output.set('status', status);
    }
  }

  if (allowProducts) {
    const products = String(input.searchParams.get('products') || '').trim();
    if (products) {
      const items = products
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (
        items.length === 0
        || items.length > 10
        || items.some((item) => item.length > 64 || !/^[\p{L}\p{N} ._()/-]+$/u.test(item))
      ) {
        throw new AgroProxyError(400, 'Filtro de produtos inválido.');
      }
      output.set('products', items.join(','));
    }
  }

  const limitInput = String(input.searchParams.get('limit') || '100').trim();
  if (!/^\d{1,3}$/.test(limitInput)) throw new AgroProxyError(400, 'Limite inválido.');
  const limit = Number(limitInput);
  if (limit < 1 || limit > MAX_LIMIT) throw new AgroProxyError(400, 'Limite inválido.');
  output.set('limit', String(limit));

  const cursor = String(input.searchParams.get('cursor') || '').trim();
  if (cursor) {
    if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
      throw new AgroProxyError(400, 'Cursor inválido.');
    }
    output.set('cursor', cursor);
  }

  return output;
}

export function sanitizeScaleTicketQuery(requestUrl = '') {
  return sanitizeAgroQuery(requestUrl, { allowStatus: true, allowProducts: true });
}

export function sanitizeQualityQuery(requestUrl = '') {
  return sanitizeAgroQuery(requestUrl);
}

export function sanitizeMonthlyDetailQuery(requestUrl = '') {
  const input = new URL(requestUrl, 'https://dashboard.local');
  const output = new URLSearchParams();

  assertUniqueParams(input.searchParams);
  for (const key of input.searchParams.keys()) {
    if (!['limit', 'cursor'].includes(key)) {
      throw new AgroProxyError(400, `Parâmetro não permitido: ${key}.`);
    }
  }

  const limitInput = String(input.searchParams.get('limit') || '100').trim();
  if (!/^\d{1,3}$/.test(limitInput)) throw new AgroProxyError(400, 'Limite inválido.');
  const limit = Number(limitInput);
  if (limit < 1 || limit > MAX_LIMIT) throw new AgroProxyError(400, 'Limite inválido.');
  output.set('limit', String(limit));

  const cursor = String(input.searchParams.get('cursor') || '').trim();
  if (cursor) {
    if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
      throw new AgroProxyError(400, 'Cursor inválido.');
    }
    output.set('cursor', cursor);
  }

  return output;
}

export function monthlyBunchWeightTicketsPath(request) {
  const monthKey = String(request?.query?.monthKey || '').trim();
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    throw new AgroProxyError(400, 'Competência mensal inválida.');
  }
  return `/v1/monthly-bunch-weights/${monthKey}/tickets`;
}

async function validateDashboardSession(sessionToken) {
  const supabaseUrl = requiredEnvironment('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = requiredEnvironment('VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/dashboard_session_profile`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_session_token: sessionToken }),
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) throw new AgroProxyError(401, 'Sessão do dashboard expirada ou inválida.');
  const payload = await response.json();
  const profile = Array.isArray(payload) ? payload[0] : payload;
  if (!profile || typeof profile !== 'object') {
    throw new AgroProxyError(401, 'Sessão do dashboard expirada ou inválida.');
  }
}

async function fetchAgro(upstreamPath, query) {
  const baseUrl = requiredEnvironment('AGRO_API_BASE_URL');
  const clientId = requiredEnvironment('AGRO_API_CLIENT_ID');
  const clientSecret = requiredEnvironment('AGRO_API_CLIENT_SECRET');
  const cloudflareClientId = requiredEnvironment('AGRO_CF_ACCESS_CLIENT_ID');
  const cloudflareClientSecret = requiredEnvironment('AGRO_CF_ACCESS_CLIENT_SECRET');
  const method = 'GET';
  const queryText = query.toString();
  const upstreamUrl = new URL(`${upstreamPath}${queryText ? `?${queryText}` : ''}`, baseUrl);
  const canonicalPath = `${upstreamUrl.pathname}${upstreamUrl.search}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const contentHash = createHash('sha256').update('').digest('base64url');
  const canonical = [method, canonicalPath, timestamp, nonce, contentHash].join('\n');
  const signature = createHmac('sha256', Buffer.from(clientSecret, 'base64url'))
    .update(canonical)
    .digest('base64url');

  const response = await fetch(upstreamUrl, {
    method,
    headers: {
      Accept: 'application/json',
      'CF-Access-Client-Id': cloudflareClientId,
      'CF-Access-Client-Secret': cloudflareClientSecret,
      'x-agro-client-id': clientId,
      'x-agro-timestamp': timestamp,
      'x-agro-nonce': nonce,
      'x-agro-content-sha256': contentHash,
      'x-agro-signature': signature,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AgroProxyError(502, 'A API AGRO retornou uma resposta inválida.');
  }

  if (!response.ok) {
    const upstreamMessage = payload?.error?.message;
    const upstreamCode = String(payload?.error?.code || '').trim();
    const status = response.status === 503 || upstreamCode === 'dependency_unavailable'
      ? 503
      : 502;
    throw new AgroProxyError(
      status,
      upstreamMessage || 'A API AGRO não respondeu corretamente.',
      upstreamCode
    );
  }
  return payload;
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Authorization');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

export function createAgroProxyHandler({
  upstreamPath,
  sanitizeQuery = sanitizeQualityQuery,
  errorMessage = 'Não foi possível consultar a API AGRO agora.',
  logLabel = 'agro-proxy',
}) {
  return async function handler(request, response) {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);

    try {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        throw new AgroProxyError(405, 'Método não permitido.');
      }

      const sessionToken = bearerToken(request);
      const query = sanitizeQuery(request.url);
      await validateDashboardSession(sessionToken);
      const resolvedUpstreamPath = typeof upstreamPath === 'function'
        ? upstreamPath(request)
        : upstreamPath;
      const payload = await fetchAgro(resolvedUpstreamPath, query);
      sendJson(response, 200, payload);
    } catch (error) {
      const status = error instanceof AgroProxyError ? error.status : 502;
      const message = error instanceof AgroProxyError ? error.message : errorMessage;

      if (!(error instanceof AgroProxyError)) {
        console.error(`${logLabel} failed`, {
          requestId,
          name: error?.name || 'Error',
        });
      }
      sendJson(response, status, {
        error: {
          message,
          ...(error instanceof AgroProxyError && error.code ? { code: error.code } : {}),
          requestId,
        },
      });
    }
  };
}
