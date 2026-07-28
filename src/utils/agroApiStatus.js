import {
  callDashboardRpc,
  getCqoSessionToken,
  LOCAL_DEMO_MODE,
} from './cqoData';

export const HEARTBEAT_HEALTH = {
  ONLINE: 'online',
  WARNING: 'warning',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown',
};

const ONLINE_MAX_AGE_MS = 2 * 60 * 1000;
const WARNING_MAX_AGE_MS = 5 * 60 * 1000;

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function heartbeatAgeMs(heartbeat, now = Date.now()) {
  const receivedAt = new Date(heartbeat?.received_at || '').getTime();
  if (!Number.isFinite(receivedAt)) return null;
  return Math.max(0, now - receivedAt);
}

export function classifyAgroApiHeartbeat(heartbeat, now = Date.now()) {
  if (!heartbeat || !Object.keys(heartbeat).length) {
    return HEARTBEAT_HEALTH.UNKNOWN;
  }

  const ageMs = heartbeatAgeMs(heartbeat, now);
  if (ageMs === null) return HEARTBEAT_HEALTH.UNKNOWN;
  if (ageMs > WARNING_MAX_AGE_MS) return HEARTBEAT_HEALTH.OFFLINE;

  const apiStatus = normalizeStatus(heartbeat.api_status);
  const databaseStatus = normalizeStatus(heartbeat.database_status);
  const vpnStatus = normalizeStatus(heartbeat.vpn_status);
  const overallStatus = normalizeStatus(heartbeat.status);

  if (overallStatus === 'offline' || apiStatus === 'offline') {
    return HEARTBEAT_HEALTH.OFFLINE;
  }

  if (
    ageMs > ONLINE_MAX_AGE_MS
    || overallStatus !== 'online'
    || apiStatus !== 'online'
    || databaseStatus !== 'online'
    || vpnStatus !== 'online'
  ) {
    return HEARTBEAT_HEALTH.WARNING;
  }

  return HEARTBEAT_HEALTH.ONLINE;
}

export function formatHeartbeatAge(ageMs) {
  if (ageMs === null || !Number.isFinite(ageMs)) return 'Sem sinal recebido';
  if (ageMs < 60_000) return `há ${Math.max(0, Math.floor(ageMs / 1000))} s`;
  if (ageMs < 60 * 60_000) return `há ${Math.floor(ageMs / 60_000)} min`;
  if (ageMs < 24 * 60 * 60_000) return `há ${Math.floor(ageMs / (60 * 60_000))} h`;
  return `há ${Math.floor(ageMs / (24 * 60 * 60_000))} d`;
}

export function formatStatusTimestamp(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

export function statusTone(value) {
  const normalized = normalizeStatus(value);
  if (['online', 'ready', 'ok', 'healthy', 'synchronized'].includes(normalized)) return 'success';
  if (['warning', 'degraded', 'stale'].includes(normalized)) return 'warning';
  if (['offline', 'error', 'unavailable', 'failed'].includes(normalized)) return 'danger';
  return 'neutral';
}

export async function loadAgroApiHeartbeat(sessionToken = getCqoSessionToken()) {
  if (LOCAL_DEMO_MODE) return {};

  const token = String(sessionToken || '').trim();
  if (!token) throw new Error('Sessao do dashboard nao encontrada.');

  const payload = await callDashboardRpc(
    'dashboard_agro_api_status',
    { p_session_token: token },
    'Status da integracao AGRO'
  );

  if (Array.isArray(payload)) return payload[0] || {};
  return payload || {};
}
