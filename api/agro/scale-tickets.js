import { Buffer } from 'node:buffer';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';

const MAX_LIMIT = 200;
const UPSTREAM_TIMEOUT_MS = 15_000;
const ALLOWED_STATUS = new Set(['open', 'closed']);
const ALLOWED_QUERY_KEYS = new Set([
  'from',
  'to',
  'ticket',
  'status',
  'products',
  'limit',
  'cursor',
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new HttpError(503, 'Integração da balança não configurada.');
  return value;
}

function singleHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function bearerToken(request) {
  const authorization = String(singleHeader(request.headers?.authorization) || '').trim();
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]{20,256})$/i);
  if (!match) throw new HttpError(401, 'Sessão do dashboard ausente ou inválida.');
  return match[1];
}

function validateIsoDate(value, field) {
  if (value.length > 40 || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `Parâmetro ${field} inválido.`);
  }
}

export function sanitizeScaleTicketQuery(requestUrl = '') {
  const input = new URL(requestUrl, 'https://dashboard.local');
  const output = new URLSearchParams();

  for (const key of input.searchParams.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      throw new HttpError(400, `Parâmetro não permitido: ${key}.`);
    }
  }

  for (const field of ['from', 'to']) {
    const value = String(input.searchParams.get(field) || '').trim();
    if (value) {
      validateIsoDate(value, field);
      output.set(field, value);
    }
  }

  const ticket = String(input.searchParams.get('ticket') || '').trim();
  if (ticket) {
    if (!/^\d{1,20}$/.test(ticket)) throw new HttpError(400, 'Ticket inválido.');
    output.set('ticket', ticket);
  }

  const status = String(input.searchParams.get('status') || '').trim().toLowerCase();
  if (status) {
    if (!ALLOWED_STATUS.has(status)) throw new HttpError(400, 'Status inválido.');
    output.set('status', status);
  }

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
      throw new HttpError(400, 'Filtro de produtos inválido.');
    }
    output.set('products', items.join(','));
  }

  const limitInput = String(input.searchParams.get('limit') || '100').trim();
  if (!/^\d{1,3}$/.test(limitInput)) throw new HttpError(400, 'Limite inválido.');
  const limit = Number(limitInput);
  if (limit < 1 || limit > MAX_LIMIT) throw new HttpError(400, 'Limite inválido.');
  output.set('limit', String(limit));

  const cursor = String(input.searchParams.get('cursor') || '').trim();
  if (cursor) {
    if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
      throw new HttpError(400, 'Cursor inválido.');
    }
    output.set('cursor', cursor);
  }

  return output;
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

  if (!response.ok) throw new HttpError(401, 'Sessão do dashboard expirada ou inválida.');
  const payload = await response.json();
  const profile = Array.isArray(payload) ? payload[0] : payload;
  if (!profile || typeof profile !== 'object') {
    throw new HttpError(401, 'Sessão do dashboard expirada ou inválida.');
  }
}

async function fetchScaleTickets(query) {
  const baseUrl = requiredEnvironment('AGRO_API_BASE_URL');
  const clientId = requiredEnvironment('AGRO_API_CLIENT_ID');
  const clientSecret = requiredEnvironment('AGRO_API_CLIENT_SECRET');
  const cloudflareClientId = requiredEnvironment('AGRO_CF_ACCESS_CLIENT_ID');
  const cloudflareClientSecret = requiredEnvironment('AGRO_CF_ACCESS_CLIENT_SECRET');
  const method = 'GET';
  const upstreamUrl = new URL(`/v1/scale-tickets?${query.toString()}`, baseUrl);
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
    throw new HttpError(502, 'A API da balança retornou uma resposta inválida.');
  }

  if (!response.ok) {
    const upstreamMessage = payload?.error?.message;
    throw new HttpError(
      response.status >= 400 && response.status < 500 ? 502 : response.status,
      upstreamMessage || 'A API da balança não respondeu corretamente.'
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

export default async function handler(request, response) {
  const requestId = randomUUID();
  response.setHeader('X-Request-Id', requestId);

  try {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      throw new HttpError(405, 'Método não permitido.');
    }

    const sessionToken = bearerToken(request);
    const query = sanitizeScaleTicketQuery(request.url);
    await validateDashboardSession(sessionToken);
    const payload = await fetchScaleTickets(query);
    sendJson(response, 200, payload);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    const message = error instanceof HttpError
      ? error.message
      : 'Não foi possível consultar a balança agora.';

    if (!(error instanceof HttpError)) {
      console.error('scale-tickets proxy failed', {
        requestId,
        name: error?.name || 'Error',
      });
    }
    sendJson(response, status, { error: { message, requestId } });
  }
}
