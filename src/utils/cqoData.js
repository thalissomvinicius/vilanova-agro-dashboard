import { useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const ATTACHMENT_BUCKET = 'mobile-anexos';
const ATTACHMENT_SIGN_EXPIRES_SECONDS = 6 * 60 * 60;

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  isConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
};

export const LOCAL_DEMO_SESSION_TOKEN = 'local-demo-session';
export const LOCAL_DEMO_MODE = !SUPABASE_CONFIG.isConfigured && import.meta.env.DEV;

export const DASHBOARD_SESSION_EXPIRED_EVENT = 'vilanova-dashboard-session-expired';

function buildLocalDemoProfile(matricula = 'demo') {
  return {
    nome: 'Demonstração Local',
    matricula: String(matricula || 'demo'),
    role: 'admin',
    permissions: ['manage_collaborators'],
    sessionToken: LOCAL_DEMO_SESSION_TOKEN,
    cargo: 'CQO',
    departamento: 'Campo',
  };
}

function buildLocalDemoData() {
  return buildSupabaseData({
    responseRows: [],
    headcount: [],
    gpsRows: [],
    attachmentRows: [],
    formRows: [],
    cqoImport: { snapshot: null, records: 0, corteRows: 0, carreamentoRows: 0 },
    source: 'Modo demonstração local',
  });
}

function requireSupabaseConfig() {
  if (!SUPABASE_CONFIG.isConfigured) {
    throw new Error('Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente.');
  }

  return SUPABASE_CONFIG;
}

function supabaseHeaders(extraHeaders = {}) {
  const { anonKey } = requireSupabaseConfig();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: 'application/json',
    ...extraHeaders,
  };
}

function supabaseStorageOrigin() {
  const { url } = requireSupabaseConfig();
  return url.replace(/\/+$/, '');
}

function encodeStoragePath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

async function signAttachmentStoragePath(storagePath) {
  if (!storagePath || /^(https?:|data:|blob:)/i.test(String(storagePath))) return storagePath || null;

  const origin = supabaseStorageOrigin();
  const encodedPath = encodeStoragePath(storagePath);
  if (!encodedPath) return null;

  const response = await fetch(`${origin}/storage/v1/object/sign/${ATTACHMENT_BUCKET}/${encodedPath}`, {
    method: 'POST',
    headers: supabaseHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      expiresIn: ATTACHMENT_SIGN_EXPIRES_SECONDS,
    }),
  });

  if (!response.ok) {
    throw new Error(await supabaseResponseError(response, 'Assinatura de anexo'));
  }

  const payload = await response.json();
  const signedUrl = payload?.signedURL || payload?.signedUrl || payload?.url || '';
  if (!signedUrl) return null;
  if (/^https?:/i.test(signedUrl)) return signedUrl;
  if (signedUrl.startsWith('/')) return `${origin}${signedUrl}`;
  return `${origin}/${signedUrl.replace(/^\/+/, '')}`;
}

async function attachSignedStorageUrls(attachmentRows) {
  if (!Array.isArray(attachmentRows) || attachmentRows.length === 0) return [];

  return Promise.all(attachmentRows.map(async (row) => {
    const storagePath = row?.storage_path || row?.caminho || row?.path || null;
    const hasRenderableUrl = row?.url || row?.public_url || row?.storage_url || row?.signed_url;
    if (!storagePath || hasRenderableUrl) return row;

    try {
      const signedUrl = await signAttachmentStoragePath(storagePath);
      return signedUrl ? { ...row, signed_url: signedUrl, url: signedUrl } : row;
    } catch {
      return row;
    }
  }));
}

async function supabaseResponseError(response, context) {
  let detail;

  try {
    const payload = await response.clone().json();
    detail = [payload.message, payload.details, payload.hint, payload.error]
      .filter(Boolean)
      .join(' ');
  } catch {
    try {
      detail = (await response.text()).trim();
    } catch {
      detail = undefined;
    }
  }

  const suffix = detail ? ` - ${detail.slice(0, 240)}` : '';
  return `${context}: HTTP ${response.status}${suffix}`;
}

export function isDashboardSessionExpiredError(error) {
  const message = String(error?.message || error || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return message.includes('sessao expirada ou invalida')
    || message.includes('session expired')
    || message.includes('invalid session')
    || message.includes('jwt expired')
    || message.includes('http 401')
    || message.includes('http 403');
}

function notifyDashboardSessionExpired(error) {
  if (!isDashboardSessionExpiredError(error) || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_SESSION_EXPIRED_EVENT, {
    detail: { message: error?.message || 'Sessao expirada.' },
  }));
}

export function dashboardErrorMessage(error, fallback = 'Não foi possível concluir a operação agora.') {
  const rawMessage = String(error?.message || error || '').trim();
  const normalized = rawMessage
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!rawMessage) return fallback;
  if (normalized.includes('muitas tentativas de login')) {
    return 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.';
  }
  if (normalized.includes('matricula ou senha invalida')) {
    return 'Matricula ou senha invalida.';
  }
  if (normalized.includes('informe matricula e senha')) {
    return 'Informe matricula e senha.';
  }
  if (normalized.includes('sem permissao')) {
    return 'Seu perfil não tem permissão para esta ação.';
  }
  if (normalized.includes('autenticacao do dashboard') && normalized.includes('http ')) {
    return 'Não foi possível validar o acesso agora. Tente novamente em instantes.';
  }
  if (isDashboardSessionExpiredError(rawMessage)) {
    return 'Sua sessão expirou. Entre novamente para continuar.';
  }
  if (normalized.includes('supabase nao configurado') || normalized.includes('vite_supabase')) {
    return 'Serviço de dados não configurado. Verifique as variáveis de ambiente.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('networkerror') || normalized.includes('network error')) {
    return 'Não foi possível conectar ao serviço de dados. Tente novamente em instantes.';
  }
  if (normalized.includes('http ')) {
    return 'Não foi possível acessar os dados agora. Tente novamente em instantes.';
  }

  return fallback;
}

export const CQO_FARMS = [
  { id: 'all', name: 'Todas as Fazendas' },
  { id: 'fe-em-deus', name: 'Fé em Deus' },
  { id: 'nova-conceicao', name: 'Nova Conceição' },
  { id: 'vila-nova', name: 'Vila Nova' },
];

export const ACTIVE_CQO_FARM_IDS = CQO_FARMS
  .filter((farm) => farm.id !== 'all')
  .map((farm) => farm.id);

export const CQO_AREAS = [
  { id: 'all', name: 'Todos os formulários' },
  { id: 'corte', name: 'CQO Corte' },
  { id: 'carreamento', name: 'CQO Carreamento' },
  { id: 'poda', name: 'CQO Poda' },
];

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeCqoFarmId(value) {
  const normalized = normalizeText(value);
  const withoutPrefix = normalized
    .replace(/^(fazenda|faz)-+/, '')
    .replace(/-+(fazenda|faz)$/, '');

  if (withoutPrefix.includes('fe-em-deus')) return 'fe-em-deus';
  if (withoutPrefix.includes('nova-conceicao')) return 'nova-conceicao';
  if (withoutPrefix.includes('vila-nova')) return 'vila-nova';

  return withoutPrefix || normalized || 'sem-fazenda';
}

function formatPersonName(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || text === '--') return '';
  if (/^\d+$/.test(text)) return text;

  return text.split(' ').map((part) => {
    const lower = part.toLowerCase();
    if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(lower)) return lower;
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  }).join(' ');
}

function numberValue(value) {
  const parsed = Number(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedRowEntries(row) {
  return Object.entries(row || {}).reduce((acc, [key, value]) => {
    const normalized = normalizeText(key);
    acc[normalized] = value;
    acc[normalized.replace(/-/g, '')] = value;
    return acc;
  }, {});
}

function pickRowValue(row, keys) {
  const normalizedEntries = normalizedRowEntries(row);
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
    const normalized = normalizeText(key);
    if (normalizedEntries[normalized] !== undefined && normalizedEntries[normalized] !== null && normalizedEntries[normalized] !== '') {
      return normalizedEntries[normalized];
    }
    const compact = normalized.replace(/-/g, '');
    if (normalizedEntries[compact] !== undefined && normalizedEntries[compact] !== null && normalizedEntries[compact] !== '') {
      return normalizedEntries[compact];
    }
  }
  return '';
}

function rowText(row, keys) {
  return String(pickRowValue(row, keys) ?? '').trim();
}

function rowNumber(row, keys) {
  return numberValue(pickRowValue(row, keys));
}

const CORTE_OBSERVED_BUNCH_GROUPS = [
  ['cacho_esquecido_ciclo', 'cacho_esquecido', 'CachoEsquecido'],
  ['cacho_verde', 'CachoVerde'],
  ['cacho_maduro', 'CachoMaduro'],
  ['cacho_passado', 'CachoPassado'],
  ['cacho_infermo', 'CachoInfermo'],
  ['bucha', 'Bucha'],
  ['cacho_talo_comprido', 'TaloComprido', 'CachoTaloComprido'],
  ['cacho_estrela', 'cachos_estrela', 'CachoEstrela'],
  ['cacho_avermelhado', 'cachos_avermelhados', 'CachoAvermelhado'],
];

function rowValue(row, keys) {
  return numberValue(pickRowValue(row, keys));
}

function sumRows(rows, keys) {
  return rows.reduce((total, row) => {
    return total + rowValue(row, keys);
  }, 0);
}

function sumRowsByGroups(rows, groups) {
  return rows.reduce((total, row) => (
    total + groups.reduce((rowTotal, keys) => rowTotal + rowValue(row, keys), 0)
  ), 0);
}

function buildGps(latValue, lngValue, accuracyValue) {
  const lat = Number(String(latValue ?? '').replace(',', '.').trim());
  const lng = Number(String(lngValue ?? '').replace(',', '.').trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return null;
  const accuracy = Number(String(accuracyValue ?? '').replace(',', '.').trim());
  const suffix = Number.isFinite(accuracy) ? ` (${Math.round(accuracy)}m)` : '';
  return { lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, label: `${lat.toFixed(6)}, ${lng.toFixed(6)}${suffix}` };
}

function parseGps(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    const parts = value
      .split(/[,\s;|]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) return buildGps(parts[0], parts[1], parts[2]);
    return null;
  }

  if (Array.isArray(value) && value.length >= 2) {
    return buildGps(value[0], value[1], value[2]);
  }

  if (typeof value === 'object') {
    const coords = value.coords && typeof value.coords === 'object' ? value.coords : value;
    return buildGps(
      coords.latitude ?? coords.lat,
      coords.longitude ?? coords.lng ?? coords.lon,
      coords.accuracy ?? coords.precisao
    );
  }

  return null;
}

function parseTrackArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeTrackPoint(value, index) {
  const gps = parseGps(value);
  if (!gps) return null;
  return {
    ...gps,
    order: Number(value?.ordem ?? value?.order ?? index + 1),
    capturedAt: value?.capturado_em || value?.capturedAt || value?.timestamp || null,
    source: value?.source || value?.origem || 'auto',
  };
}

function parseOccurrenceFieldId(fieldId) {
  const text = String(fieldId || '');
  if (!text.startsWith('ocorrencia_')) return { title: text, line: '--' };
  const [, rawType = '', rawLine = ''] = text.match(/^ocorrencia_(.*?)(?:_linha_(.*))?$/) || [];
  return {
    title: rawType.replaceAll('_', ' ') || 'Ocorrencia',
    line: rawLine || '--',
  };
}

function normalizeGpsTablePoint(value, index) {
  const gps = buildGps(value?.latitude, value?.longitude, value?.precisao);
  if (!gps) return null;
  const fieldId = value?.campo_id || 'gps';
  const isOccurrence = String(fieldId).startsWith('ocorrencia_');
  const occurrenceMeta = parseOccurrenceFieldId(fieldId);
  return {
    ...gps,
    id: value?.id || `${fieldId}_${index + 1}`,
    fieldId,
    title: isOccurrence ? occurrenceMeta.title : fieldId,
    line: isOccurrence ? occurrenceMeta.line : '--',
    quantity: 1,
    order: index + 1,
    capturedAt: value?.capturado_em || null,
    source: isOccurrence ? 'ocorrencia' : fieldId === 'gps_track' ? 'track' : 'mobile_gps',
    occurrence: isOccurrence,
  };
}

function normalizeOccurrencePoint(value, index) {
  const gps = parseGps(value);
  if (!gps) return null;
  const fieldId = value?.campo_id || value?.fieldId || 'ocorrencia';
  return {
    ...gps,
    id: value?.id || `${fieldId}_${index + 1}`,
    fieldId,
    title: value?.titulo || value?.title || fieldId.replace(/^ocorrencia_/, '').replaceAll('_', ' '),
    line: value?.linha || value?.linha_index || value?.line || '--',
    quantity: Number(value?.quantidade || value?.quantity || 1) || 1,
    capturedAt: value?.capturado_em || value?.capturedAt || null,
    source: value?.source || 'ocorrencia',
    occurrence: true,
  };
}

function normalizeAttachment(row, index) {
  const meta = parseJson(row?.dados_json || row?.metadata || row?.metadados || row?.extra);
  const gps = parseGps(row?.gps || meta?.gps || {
    latitude: row?.latitude ?? meta?.latitude,
    longitude: row?.longitude ?? meta?.longitude,
    precisao: row?.precisao ?? meta?.precisao,
  });

  return {
    id: row?.id || `anexo_${index + 1}`,
    responseId: row?.resposta_id || row?.respostaId || meta?.resposta_id || '',
    fieldId: row?.campo_id || row?.field_id || meta?.campo_id || meta?.fieldId || `anexo_${index + 1}`,
    fileName: row?.nome_arquivo || row?.filename || row?.file_name || meta?.nome_arquivo || meta?.fileName || '',
    mimeType: row?.mime_type || row?.mimetype || row?.tipo_mime || meta?.mimeType || meta?.mime_type || 'image/jpeg',
    base64: row?.base64 || row?.arquivo_base64 || row?.conteudo_base64 || meta?.base64 || null,
    url: row?.url || row?.signed_url || row?.public_url || row?.storage_url || meta?.url || meta?.signedUrl || meta?.publicUrl || null,
    storagePath: row?.storage_path || row?.caminho || row?.path || meta?.storagePath || meta?.storage_path || null,
    capturedAt: row?.capturado_em || row?.criado_em || meta?.capturedAt || meta?.capturado_em || null,
    gps,
    raw: row,
  };
}

function parseOccurrenceArray(value) {
  return parseTrackArray(value)
    .map((point, index) => normalizeOccurrencePoint(point, index))
    .filter(Boolean);
}

function dedupeGpsPoints(points) {
  const seen = new Set();
  return points.filter((point) => {
    const key = [
      point.fieldId || point.source || 'gps',
      point.capturedAt || '',
      Number(point.lat).toFixed(6),
      Number(point.lng).toFixed(6),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findGps(data, type) {
  const preferredKeys = type === 'carreamento'
    ? ['gps_cqo_carreamento', 'gps_carreamento']
    : ['gps_cqo_corte', 'gps_corte'];

  const candidateKeys = [
    ...preferredKeys,
    'gps',
    'gps_localizacao',
    'localizacao',
    'location',
    'coordenadas',
    'coordenadas_gps',
  ];

  for (const key of candidateKeys) {
    const parsed = parseGps(data?.[key]);
    if (parsed) return parsed;
  }

  return buildGps(
    data?.latitude ?? data?.lat,
    data?.longitude ?? data?.lng ?? data?.lon,
    data?.accuracy ?? data?.precisao
  );
}

function findGpsTrack(data, gps, gpsRows = []) {
  const tableTrack = gpsRows
    .filter((point) => point?.campo_id === 'gps_track')
    .map((point, index) => normalizeGpsTablePoint(point, index))
    .filter(Boolean)
    .sort((a, b) => new Date(a.capturedAt || 0) - new Date(b.capturedAt || 0));

  if (tableTrack.length) return tableTrack;

  const candidateKeys = [
    'gps_track',
    'gpsTrack',
    'track_gps',
    'trilha_gps',
    'pontos_gps',
  ];

  for (const key of candidateKeys) {
    const points = parseTrackArray(data?.[key])
      .map((point, index) => normalizeTrackPoint(point, index))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);

    if (points.length) return points;
  }

  return gps ? [{ ...gps, order: 1, capturedAt: null, source: 'principal' }] : [];
}

function findGpsOccurrences(data, gpsRows = []) {
  const tableOccurrences = gpsRows
    .filter((point) => String(point?.campo_id || '').startsWith('ocorrencia_'))
    .map((point, index) => normalizeGpsTablePoint(point, index))
    .filter(Boolean);

  const payloadOccurrences = [
    ...parseOccurrenceArray(data?.cqo_ocorrencias_gps),
    ...parseOccurrenceArray(data?.cqoGpsOccurrences),
    ...parseOccurrenceArray(data?.ocorrencias_gps),
  ];

  return dedupeGpsPoints([...tableOccurrences, ...payloadOccurrences]);
}

function formType(formularioId, data) {
  if (formularioId === 'form_cqo_poda' || Array.isArray(data.linhas_poda)) {
    return 'poda';
  }
  if (formularioId === 'form_cqo_carreamento_fruto_solto' || Array.isArray(data.linhas_carreamento)) {
    return 'carreamento';
  }
  return 'corte';
}

function statusLabel(status) {
  const normalized = normalizeText(status);
  if (normalized === 'sincronizado' || normalized === 'sync') return 'Sincronizado';
  if (normalized === 'pendente-validacao') return 'Pendente validação';
  if (normalized === 'aprovado') return 'Aprovado';
  if (normalized === 'reprovado') return 'Reprovado';
  if (normalized === 'erro' || normalized === 'falha') return 'Falha';
  return 'Pendente';
}

function formatDateTime(value) {
  if (!value) return { date: '--', time: '--' };
  const date = parseRecordDateValue(value);
  if (!date || Number.isNaN(date.getTime())) return { date: String(value), time: '--' };
  const hasTime = typeof value !== 'string'
    || /(?:T|\s)\d{2}:\d{2}/.test(value)
    || /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(value);
  return {
    date: date.toLocaleDateString('pt-BR'),
    time: hasTime ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--',
  };
}

function formatObservation(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(formatObservation).filter(Boolean).join(' | ');
  if (typeof value === 'object') {
    const text = value.texto || value.observacao || value.descricao || value.description || value.comentario || value.comment;
    if (text) return String(text);
    const photoCount = Array.isArray(value.fotos) ? value.fotos.length : 0;
    return photoCount ? `${photoCount} foto(s) anexada(s), sem observação textual.` : '';
  }
  return '';
}

function duplicateStatusRank(status) {
  const normalized = normalizeText(status);
  if (normalized === 'aprovado' || normalized === 'sincronizado') return 5;
  if (normalized === 'pendente-validacao') return 4;
  if (normalized === 'pendente') return 3;
  if (normalized === 'reprovado') return 2;
  if (normalized === 'falha') return 1;
  return 0;
}

function duplicateRecordKey(record) {
  if (!record || record.source !== 'app') return `${record?.source || 'registro'}:${record?.id || Math.random()}`;

  const raw = record.raw || {};
  return [
    'app',
    record.formularioId || record.type,
    record.farmId || record.farm,
    record.parcel,
    record.cycle,
    raw.data_avaliacao || record.date,
    record.evaluatorMatricula || raw.matricula_avaliador || raw.matricula_digitador,
    raw.fiscal_resp_equipe || raw.fiscal_resp || record.fiscal,
  ].map(normalizeText).join('|');
}

function recordEventTime(record) {
  const date = parseRecordDateValue(record?.receivedAt || record?.sentAt || record?.createdAt || record?.raw?.data_avaliacao);
  return date?.getTime?.() || 0;
}

function preferredDuplicateRecord(a, b) {
  const rankA = duplicateStatusRank(a?.status);
  const rankB = duplicateStatusRank(b?.status);
  if (rankA !== rankB) return rankA > rankB ? a : b;
  const timeA = recordEventTime(a);
  const timeB = recordEventTime(b);
  if (timeA !== timeB) return timeA > timeB ? a : b;
  return String(a?.id || '') > String(b?.id || '') ? a : b;
}

function dedupeMobileRecords(records) {
  const groups = records.reduce((acc, record) => {
    const key = duplicateRecordKey(record);
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(record);
    return acc;
  }, new Map());

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];
    const selected = group.reduce((best, record) => preferredDuplicateRecord(best, record), group[0]);
    return {
      ...selected,
      duplicateCount: group.length,
      duplicateIds: group.map((record) => record.id),
      duplicateRecords: group
        .filter((record) => record.id !== selected.id)
        .map((record) => ({
          id: record.id,
          status: record.status,
          createdAt: record.createdAt,
          receivedAt: record.receivedAt,
        })),
    };
  });
}

export function normalizeResponse(row, headcount = [], gpsRows = [], attachmentRows = []) {
  const data = parseJson(row.dados_json);

  // Normalizar a estrutura de dados de legado (Android) para o padrão
  if (data.mapeamento_legado) {
    const legacy = data.mapeamento_legado;
    if (legacy.campos_digitados) {
      const cd = legacy.campos_digitados;
      if (data.nome_fazenda === undefined) data.nome_fazenda = cd.NomeFazenda;
      if (data.parcela === undefined) data.parcela = cd.Parcela;
      if (data.ano_plantio === undefined) data.ano_plantio = cd.AnoPlantio;
      if (data.atividade === undefined) data.atividade = cd.Atividade;
      if (data.empresa === undefined) data.empresa = cd.Empresa;
      if (data.equipe === undefined) data.equipe = cd.Equipe;
      if (data.ciclo_mes === undefined) data.ciclo_mes = cd.ciclo_mes;
      if (data.fiscal_resp === undefined) data.fiscal_resp = cd["Fiscal Resp"] || cd.FiscalResp;
      if (data.fiscal_resp_equipe === undefined) {
        data.fiscal_resp_equipe = cd["Fiscal Resp Equipe"]
          || cd.FiscalRespEquipe
          || cd["Fiscal Responsavel Equipe"]
          || cd.FiscalResponsavelEquipe
          || cd.fiscal_resp_equipe;
      }
      if (data.observacao === undefined) data.observacao = cd.Observacao;
      if (data.matricula_avaliador === undefined) data.matricula_avaliador = cd.MatriculaAvaliadores || cd.MatriculaDigitador;
      if (data.acompanhamento === undefined) data.acompanhamento = cd.Acompanhamento;

      // Converter DataAvaliacao de "DD/MM/YYYY" para "YYYY-MM-DD"
      if (data.data_avaliacao === undefined && cd.DataAvaliacao) {
        const parts = String(cd.DataAvaliacao).split('/');
        if (parts.length === 3) {
          data.data_avaliacao = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          data.data_avaliacao = cd.DataAvaliacao;
        }
      }
    }

    // Normalizar as linhas do relatório
    if (Array.isArray(legacy.linhas_raw)) {
      const normalizedLines = legacy.linhas_raw.map(line => {
        const newLine = { ...line };
        // Mapeamento de chaves legadas (PascalCase) para o padrão snake_case
        if (newLine.numero_plantas_linha === undefined) newLine.numero_plantas_linha = line.NumeroPlantasLinha;
        if (newLine.numero_plantas_observadas === undefined) newLine.numero_plantas_observadas = line.NumeroPlantasObservadas || line.numero_na_linha;
        if (newLine.numero_cachos_observados_papel === undefined) newLine.numero_cachos_observados_papel = line.NumeroCachosAvaliados || line.numero_cacho_observado;
        if (newLine.cacho_esquecido_ciclo === undefined) newLine.cacho_esquecido_ciclo = line.CachoEsquecido || line.cacho_esquecido;
        if (newLine.cacho_verde === undefined) newLine.cacho_verde = line.CachoVerde;
        if (newLine.cacho_maduro === undefined) newLine.cacho_maduro = line.CachoMaduro;
        if (newLine.cacho_passado === undefined) newLine.cacho_passado = line.CachoPassado;
        if (newLine.folha_mamando === undefined) newLine.folha_mamando = line.FolhaMamando;
        if (newLine.cacho_talo_comprido === undefined) newLine.cacho_talo_comprido = line.TaloComprido;
        if (newLine.folha_cortada_indevida === undefined) newLine.folha_cortada_indevida = line.FolhaCortada || line.folhaCortadaIndev || line.FolhaCortadaIndev;
        if (newLine.cacho_mal_posicionado === undefined) newLine.cacho_mal_posicionado = line.CachoMalPosicionado;
        if (newLine.cacho_estrela === undefined) newLine.cacho_estrela = line.CachoEstrela || line.cachos_estrela;
        if (newLine.cacho_brocado === undefined) newLine.cacho_brocado = line.CachoBrocado || line.cachos_brocados;
        if (newLine.cacho_avermelhado === undefined) newLine.cacho_avermelhado = line.CachoAvermelhado || line.cachos_avermelhados;
        
        // Carreamento
        if (newLine.cacho_nao_carreado === undefined) newLine.cacho_nao_carreado = line.CachoNaoCarreado || line.Cachonaocarreado;
        if (newLine.peso_medio === undefined) newLine.peso_medio = line.PesoMedio || line.pesoMedio;

        // Poda
        if (newLine.planta_sem_podar === undefined) newLine.planta_sem_podar = line.PlantaSemPodar;
        if (newLine.cacho_exposto === undefined) newLine.cacho_exposto = line.CachoExposto;
        if (newLine.poda_meia_coroa === undefined) newLine.poda_meia_coroa = line.PodaMeiaCoroa;
        if (newLine.poda_maior_1_1 === undefined) newLine.poda_maior_1_1 = line.PodaMaiorUmParaUm;
        if (newLine.bico_gaita === undefined) newLine.bico_gaita = line.BicoGaita;
        if (newLine.cacho_podre_planta === undefined) newLine.cacho_podre_planta = line.CachoPodrePlanta;
        if (newLine.palha_mal_empilhada === undefined) newLine.palha_mal_empilhada = line.PalhaMalEmpilhada;
        
        return newLine;
      });

      const legacyType = formType(row.formulario_id, data);
      if (legacyType === 'poda') {
        if (!Array.isArray(data.linhas_poda)) {
          data.linhas_poda = normalizedLines;
        }
      } else if (legacyType === 'carreamento') {
        if (!Array.isArray(data.linhas_carreamento)) {
          data.linhas_carreamento = normalizedLines;
        }
      } else {
        if (!Array.isArray(data.linhas_corte)) {
          data.linhas_corte = normalizedLines;
        }
      }
    }
  }

  const type = formType(row.formulario_id, data);
  const lines = type === 'poda'
    ? (Array.isArray(data.linhas_poda) ? data.linhas_poda : [])
    : type === 'carreamento'
      ? (Array.isArray(data.linhas_carreamento) ? data.linhas_carreamento : [])
      : (Array.isArray(data.linhas_corte) ? data.linhas_corte : []);
  const gps = findGps(data, type);
  const gpsOccurrences = findGpsOccurrences(data, gpsRows);
  const gpsTrack = findGpsTrack(data, gps, gpsRows);
  const dateTime = formatDateTime(data.data_avaliacao || row.criado_em);
  const matricula = data.matricula_avaliador || row.usuario_id || '';
  const collaborator = headcount.find((item) => String(item.matricula) === String(matricula));
  const acompanhamento = data.acompanhamento && typeof data.acompanhamento === 'object'
    ? data.acompanhamento
    : { teve: 'nao', matricula: '', nome: '' };
  const isExcelSource = Boolean(data.fonte_excel)
    || row.source === 'cqo_import_snapshots'
    || row.source === 'cqo_poda_import_snapshots'
    || String(row.formulario_id || '').startsWith('excel_');
  const effectiveGps = isExcelSource ? null : (gpsOccurrences[0] || gpsTrack[0] || gps || null);
  const effectiveGpsTrack = isExcelSource ? [] : gpsTrack;
  const effectiveGpsOccurrences = isExcelSource ? [] : gpsOccurrences;

  const base = {
    id: row.id,
    type,
    form: type === 'poda' ? 'CQO Poda' : type === 'carreamento' ? 'CQO Carreamento e Fruto Solto' : 'CQO Corte',
    formularioId: row.formulario_id,
    formularioVersao: row.formulario_versao || '',
    status: statusLabel(row.status),
    createdAt: row.criado_em,
    sentAt: row.enviado_em,
    receivedAt: row.recebido_em,
    date: dateTime.date,
    time: dateTime.time,
    source: isExcelSource ? 'excel' : 'app',
    sourceLabel: isExcelSource ? 'Excel / Supabase' : 'App / Supabase',
    farm: data.nome_fazenda || 'Sem fazenda',
    farmId: normalizeCqoFarmId(data.nome_fazenda || 'sem-fazenda'),
    parcel: data.parcela || '--',
    cycle: data.ciclo_mes || '--',
    evaluatorMatricula: matricula,
    evaluator: collaborator?.nome || matricula || 'Sem avaliador',
    evaluatorRole: collaborator?.cargo || '',
    fiscal: formatPersonName(data.fiscal_resp_equipe) || formatPersonName(data.fiscal_resp) || '--',
    observation: formatObservation(data.observacao),
    acompanhamento,
    gps: effectiveGps,
    gpsTrack: effectiveGpsTrack,
    gpsOccurrences: effectiveGpsOccurrences,
    gpsApplicable: !isExcelSource,
    gpsUnavailableReason: isExcelSource ? 'Registro historico do Excel sem GPS.' : '',
    attachments: attachmentRows,
    raw: data,
    lines,
    plantingYear: data.ano_plantio || '',
    activity: data.atividade || '',
    company: data.empresa || '',
    team: data.equipe || '',
    density: data.densidade || '',
    totalPlantsParcel: numberValue(data.total_plantas_parcela),
    totalBunchesCarried: numberValue(data.total_cachos_carreados),
    variety: data.variedade || '',
  };

  if (type === 'carreamento') {
    const plantasLinha = sumRows(lines, ['numero_plantas_linha']);
    const plantasObservadas = sumRows(lines, ['numero_plantas_observadas']) || plantasLinha || numberValue(data.total_plantas_parcela);
    return {
      ...base,
      totals: {
        linhas: lines.length,
        plantasLinha,
        cachoMalPosicionado: sumRows(lines, ['cacho_mal_posicionado']),
        cachoNaoCarreado: sumRows(lines, ['cacho_nao_carreado']),
        plantasObservadas,
        pesoMedio: sumRows(lines, ['peso_medio']),
        totalPlantasParcela: numberValue(data.total_plantas_parcela),
        totalCachosCarreados: numberValue(data.total_cachos_carreados),
      },
    };
  }

  if (type === 'poda') {
    const plantasLinha = sumRows(lines, ['numero_plantas_linha']);
    const totalPlantasParcela = numberValue(data.total_plantas_parcela);
    const plantasProjetadas = totalPlantasParcela || plantasLinha;
    const projectOccurrence = (value) => {
      if (!plantasLinha || !plantasProjetadas) return value || 0;
      return Math.round(((value || 0) / plantasLinha) * plantasProjetadas);
    };
    const plantaSemPodar = sumRows(lines, ['planta_sem_podar']);
    const cachoExposto = sumRows(lines, ['cacho_exposto']);
    const podaMeiaCoroa = sumRows(lines, ['poda_meia_coroa']);
    const folhaMamando = sumRows(lines, ['folha_mamando']);
    const podaMaiorUmParaUm = sumRows(lines, ['poda_maior_1_1']);
    const bicoGaita = sumRows(lines, ['bico_gaita']);
    const cachoPodrePlanta = sumRows(lines, ['cacho_podre_planta']);
    const palhaMalEmpilhada = sumRows(lines, ['palha_mal_empilhada']);
    return {
      ...base,
      totals: {
        linhas: lines.length,
        plantasLinha,
        plantasObservadas: plantasLinha,
        plantasProjetadas,
        totalPlantasParcela,
        plantaSemPodar,
        cachoExposto,
        podaMeiaCoroa,
        folhaMamando,
        podaMaiorUmParaUm,
        bicoGaita,
        cachoPodrePlanta,
        palhaMalEmpilhada,
        plantaSemPodarProjetada: projectOccurrence(plantaSemPodar),
        cachoExpostoProjetado: projectOccurrence(cachoExposto),
        podaMeiaCoroaProjetada: projectOccurrence(podaMeiaCoroa),
        folhaMamandoProjetada: projectOccurrence(folhaMamando),
        podaMaiorUmParaUmProjetada: projectOccurrence(podaMaiorUmParaUm),
        bicoGaitaProjetado: projectOccurrence(bicoGaita),
        cachoPodrePlantaProjetado: projectOccurrence(cachoPodrePlanta),
        palhaMalEmpilhadaProjetada: projectOccurrence(palhaMalEmpilhada),
      },
    };
  }

  const cachosObservados = sumRowsByGroups(lines, CORTE_OBSERVED_BUNCH_GROUPS);

  return {
    ...base,
    totals: {
      linhas: lines.length,
      plantasLinha: sumRows(lines, ['numero_plantas_linha']),
      plantasObservadas: sumRows(lines, ['numero_plantas_observadas', 'numero_na_linha']),
      cachosObservados,
      cachosObservadosPapel: sumRows(lines, ['numero_cachos_observados_papel', 'numero_cacho_observado']),
      cachoEsquecido: sumRows(lines, ['cacho_esquecido_ciclo', 'cacho_esquecido']),
      cachoVerde: sumRows(lines, ['cacho_verde']),
      cachoMaduro: sumRows(lines, ['cacho_maduro']),
      cachoPassado: sumRows(lines, ['cacho_passado']),
      cachoInfermo: sumRows(lines, ['cacho_infermo']),
      bucha: sumRows(lines, ['bucha']),
      folhaMamando: sumRows(lines, ['folha_mamando']),
      taloComprido: sumRows(lines, ['cacho_talo_comprido']),
      folhaCortada: sumRows(lines, ['folha_cortada_indevida', 'folhaCortadaIndev', 'FolhaCortadaIndev']),
      cachoMalPosicionado: sumRows(lines, ['cacho_mal_posicionado']),
      cachoEstrela: sumRows(lines, ['cacho_estrela', 'cachos_estrela']),
      cachoBrocado: sumRows(lines, ['cacho_brocado', 'cachos_brocados']),
      cachoAvermelhado: sumRows(lines, ['cacho_avermelhado', 'cachos_avermelhados']),
    },
  };
}

async function postSupabaseRpc(functionName, body, context) {
  const { url } = requireSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: supabaseHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = new Error(await supabaseResponseError(response, context));
    error.status = response.status;
    notifyDashboardSessionExpired(error);
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function callDashboardRpc(functionName, body, context) {
  return postSupabaseRpc(functionName, body, context);
}

function firstRpcRow(payload) {
  if (Array.isArray(payload)) return payload[0] || null;
  return payload || null;
}

function dashboardProfile(profile) {
  if (!profile) return null;
  return {
    matricula: profile.matricula,
    nome: profile.nome,
    departamento: profile.departamento,
    cargo: profile.cargo,
    gestor: profile.gestor,
    status: profile.status,
    role: profile.role || 'viewer',
    permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
    sessionToken: profile.session_token || profile.sessionToken || null,
    sessionExpiresAt: profile.session_expires_at || profile.sessionExpiresAt || null,
  };
}

export function canUseDashboardAction(user, permission) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

function sessionRpcPayload(session = {}) {
  return {
    p_session_token: String(session?.sessionToken || session || '').trim() || null,
  };
}

function validateLoginInput(matricula, senha) {
  const normalizedMatricula = String(matricula || '').trim();
  const normalizedSenha = String(senha || '').trim();

  if (!normalizedMatricula || !normalizedSenha) {
    throw new Error('Informe matricula e senha.');
  }

  return { normalizedMatricula, normalizedSenha };
}

function isLoginRateLimitError(error) {
  const message = String(error?.message || error || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return message.includes('muitas tentativas de login');
}

async function authenticateDashboardUserRpc(normalizedMatricula, normalizedSenha) {
  const payload = await postSupabaseRpc(
    'dashboard_authenticate',
    {
      p_matricula: normalizedMatricula,
      p_senha: normalizedSenha,
    },
    'Autenticação do dashboard'
  );

  return dashboardProfile(firstRpcRow(payload));
}

export async function authenticateDashboardUser(matricula, senha) {
  const { normalizedMatricula, normalizedSenha } = validateLoginInput(matricula, senha);

  if (LOCAL_DEMO_MODE) {
    return buildLocalDemoProfile(normalizedMatricula);
  }

  let profile;

  try {
    profile = await authenticateDashboardUserRpc(normalizedMatricula, normalizedSenha);
  } catch (error) {
    if (isLoginRateLimitError(error)) {
      throw new Error('Muitas tentativas de login. Aguarde 15 minutos e tente novamente.', { cause: error });
    }
    throw error;
  }

  if (!profile) {
    throw new Error('Matricula ou senha invalida.');
  }
  return profile;
}

export async function refreshDashboardSession(sessionToken) {
  if (!sessionToken) return null;
  if (LOCAL_DEMO_MODE && sessionToken === LOCAL_DEMO_SESSION_TOKEN) {
    return buildLocalDemoProfile('demo');
  }
  const payload = await postSupabaseRpc(
    'dashboard_session_profile',
    { p_session_token: String(sessionToken).trim() },
    'Validação da sessão'
  );
  const profile = dashboardProfile(firstRpcRow(payload));
  return profile ? { ...profile, sessionToken } : null;
}

export async function loadHeadcountData() {
  if (!activeDashboardSessionToken) {
    throw new Error('Sessao do dashboard nao configurada para leitura do headcount.');
  }

  const payload = await postSupabaseRpc(
    'dashboard_headcount_snapshot',
    { p_session_token: activeDashboardSessionToken },
    'Leitura do headcount'
  );
  return normalizeHeadcountSnapshotData(rpcScalarPayload(payload, 'dashboard_headcount_snapshot')).rows;
}

function pickHeadcountValue(row, keys) {
  const normalizedEntries = Object.entries(row || {}).reduce((acc, [key, value]) => {
    acc[normalizeText(key)] = value;
    return acc;
  }, {});

  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
    const normalized = normalizeText(key);
    if (normalizedEntries[normalized] !== undefined && normalizedEntries[normalized] !== null && normalizedEntries[normalized] !== '') {
      return normalizedEntries[normalized];
    }
  }

  return '';
}

function normalizeHeadcountStatus(value) {
  const text = String(value || '').trim();
  if (!text) return 'SEM STATUS';
  const normalized = normalizeText(text);
  if (normalized.includes('ferias')) return 'FERIAS';
  if (normalized.includes('demit') || normalized.includes('deslig') || normalized.includes('inativo')) return 'INATIVO';
  if (normalized.includes('ativo')) return 'ATIVO';
  return text.toUpperCase();
}

function normalizeHeadcountSnapshotRow(row, snapshot) {
  const matricula = String(pickHeadcountValue(row, ['MATRÍCULA', 'MATRICULA', 'matricula'])).trim();
  const nome = String(pickHeadcountValue(row, ['NOME', 'nome'])).trim();

  return {
    matricula,
    nome,
    departamento: String(pickHeadcountValue(row, ['DEPARTAMENTO', 'departamento'])).trim(),
    cargo: String(pickHeadcountValue(row, ['FUNÇÃO', 'FUNCAO', 'FUNCAO/CARGO', 'CARGO', 'funcao', 'cargo'])).trim(),
    gestor: String(pickHeadcountValue(row, ['GESTOR', 'gestor'])).trim(),
    status: normalizeHeadcountStatus(pickHeadcountValue(row, ['STATUS AGR', 'STATUS_AGR', 'STATUS', 'status'])),
    senha: '',
    reference_date: snapshot?.reference_month || '',
    updated_at: snapshot?.updated_at || snapshot?.imported_at || '',
    source_file: snapshot?.source_file || '',
    source_sheet: snapshot?.source_sheet || '',
    source: 'headcount_import_snapshots',
  };
}

function normalizeHeadcountSnapshotData(snapshot) {
  const rawRows = Array.isArray(snapshot?.rows_json) ? snapshot.rows_json : [];
  const rows = rawRows
    .map((row) => normalizeHeadcountSnapshotRow(row, snapshot))
    .filter((row) => row.matricula || row.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { snapshot: snapshot || null, rows };
}

export async function logoutDashboardSession(sessionToken) {
  if (!sessionToken) return null;
  return postSupabaseRpc(
    'dashboard_logout',
    { p_session_token: String(sessionToken).trim() },
    'Encerramento da sessão'
  );
}

export async function updateCollaborator({ matricula, status, senha, sessionToken }) {
  const payload = await postSupabaseRpc(
    'dashboard_update_collaborator_access',
    {
      ...sessionRpcPayload({ sessionToken }),
      p_matricula: String(matricula || '').trim(),
      p_status: status,
      p_senha: senha,
    },
    'Atualização de colaborador'
  );

  return payload || [];
}

function cqoSnapshotDate(row) {
  return rowText(row, ['data_avaliacao_iso', 'DataAvaliacao', 'Data Avaliacao', 'Data', 'data']);
}

function cqoSnapshotMonth(row) {
  return rowText(row, ['mes_referencia_iso', 'MesReferencia', 'Mês Referência', 'Mes Referencia', 'DataMes']);
}

function cqoSnapshotFarm(row) {
  return rowText(row, ['NomeFazenda', 'Nome Fazenda', 'Fazenda', 'fazenda']);
}

function cqoSnapshotParcel(row) {
  return rowText(row, ['parcela_normalizada', 'ParcelaNormalizada', 'Parcela', 'parcela']);
}

function cqoSnapshotEvaluator(row) {
  return rowText(row, [
    'MatriculaAvaliadores',
    'Matricula Avaliadores',
    'MatriculaDigitador',
    'matricula_avaliador',
    'Matrícula',
    'Matricula',
    'Avaliador',
  ]);
}

function cqoSnapshotFiscal(row) {
  return rowText(row, [
    'Fiscal Resp Equipe',
    'FiscalRespEquipe',
    'Fiscal Responsavel Equipe',
    'FiscalResponsavelEquipe',
    'fiscal_resp_equipe',
    'Fiscal Resp',
    'FiscalResp',
    'Fiscal',
    'fiscal_resp',
  ]);
}

function cqoSnapshotCycle(row) {
  return rowText(row, ['ciclo_mes', 'CicloMes', 'Ciclo', 'Mes', 'Mês', 'mes_referencia_iso']) || '--';
}

function buildCorteSnapshotLine(row, index) {
  return {
    rua_index: rowText(row, ['rua_index', 'Rua', 'RuaIndex']) || String(index + 1),
    lado_linha: rowText(row, ['lado_linha', 'LadoLinha', 'Lado']),
    linha: rowText(row, ['linha', 'Linha']) || String(index + 1),
    matricula_colaborador: rowText(row, ['matricula_colaborador', 'MatriculaColaborador', 'MatriculaCortador']),
    numero_plantas_atual: rowNumber(row, ['Nº de plantas Atual', 'N de plantas Atual', 'NumeroPlantasAtual', 'numero_plantas_atual']),
    area_plantada: rowNumber(row, ['Área Plantada', 'Area Plantada', 'area_plantada']),
    numero_plantas_linha: rowNumber(row, ['NumeroPlantasLinha', 'numero_plantas_linha', 'NumeroPlantas']),
    numero_plantas_observadas: rowNumber(row, ['NumeroPlantasObservadas', 'numero_plantas_observadas', 'numero_na_linha']),
    numero_cachos_observados_papel: rowNumber(row, ['NumeroCahosObservados', 'NumeroCachosObservados', 'NumeroCachosAvaliados', 'numero_cachos_observados_papel']),
    cacho_esquecido_ciclo: rowNumber(row, ['CachoEsquecidoCiclo', 'CachoEsquecido', 'cacho_esquecido_ciclo']),
    cacho_verde: rowNumber(row, ['CachoVerde', 'cacho_verde']),
    cacho_maduro: rowNumber(row, ['CachoMaduro', 'cacho_maduro']),
    cacho_passado: rowNumber(row, ['CachoPassado', 'cacho_passado']),
    cacho_infermo: rowNumber(row, ['CachoInfermo', 'cacho_infermo']),
    bucha: rowNumber(row, ['Bucha', 'bucha']),
    folha_mamando: rowNumber(row, ['FolhaMamando', 'folha_mamando']),
    cacho_talo_comprido: rowNumber(row, ['TaloComprido', 'CachoTaloComprido', 'cacho_talo_comprido']),
    folha_cortada_indevida: rowNumber(row, ['FolhaCortada', 'folhaCortadaIndev', 'FolhaCortadaIndev', 'folha_cortada_indevida']),
    cacho_mal_posicionado: rowNumber(row, ['cachoMalOosicionado', 'CachoMalPosicionado', 'cacho_mal_posicionado']),
    cacho_estrela: rowNumber(row, ['CachoEstrela', 'cacho_estrela', 'cachos_estrela']),
    cacho_brocado: rowNumber(row, ['CachoBrocado', 'cacho_brocado', 'cachos_brocados']),
    cacho_avermelhado: rowNumber(row, ['CachoAvermelhado', 'cacho_avermelhado', 'cachos_avermelhados']),
    estimativa_cachos_perdidos: rowNumber(row, ['estimativa de cacho perdido/pla', 'estimativa_cacho_perdido_pla']),
    perdas_t: rowNumber(row, ['perdas t', 'Perdas t', 'perdas_t', 'perda_t']),
    linha_json: row,
  };
}

function buildCarreamentoSnapshotLine(row, index) {
  return {
    rua_index: rowText(row, ['rua_index', 'Rua', 'RuaIndex']) || String(index + 1),
    lado_linha: rowText(row, ['lado_linha', 'LadoLinha', 'Lado']),
    linha: rowText(row, ['linha', 'Linha']) || String(index + 1),
    numero_plantas_atual: rowNumber(row, ['Nº de plantas Atual', 'N de plantas Atual', 'NumeroPlantasAtual', 'numero_plantas_atual']),
    area_plantada: rowNumber(row, ['Área Plantada', 'Area Plantada', 'area_plantada']),
    numero_plantas_linha: rowNumber(row, ['NumeroPlantasLinha', 'numero_plantas_linha', 'NumeroPlantas']),
    numero_plantas_observadas: rowNumber(row, ['NumeroPlantasObservadas', 'numero_plantas_observadas', 'numero_na_linha']),
    cacho_mal_posicionado: rowNumber(row, ['cachoMalOosicionado', 'CachoMalPosicionado', 'cacho_mal_posicionado']),
    cacho_nao_carreado: rowNumber(row, ['CachoNaoCarreado', 'Cachonaocarreado', 'cacho_nao_carreado', 'CachoNaoCarriado']),
    estimativa_perdas_cnc_pla: rowNumber(row, ['estimativa de perdas cnc/pla', 'estimativa_perdas_cnc_pla']),
    perdas_t: rowNumber(row, ['perdas t', 'Perdas t', 'perdas_t', 'perda_t']),
    peso_medio: rowNumber(row, ['PesoMedio', 'peso_medio']),
    linha_json: row,
  };
}

function buildPodaSnapshotLine(row, index) {
  return {
    rua_index: rowText(row, ['rua_index', 'Rua', 'RuaIndex']) || String(index + 1),
    lado_linha: rowText(row, ['lado_linha', 'LadoLinha', 'Lado']),
    linha: rowText(row, ['linha', 'Linha', 'Linha Avaliada']) || String(index + 1),
    numero_plantas_linha: rowNumber(row, [
      'NumeroPlantasLinha',
      'numero_plantas_linha',
      'NumeroPlantas',
      'N de plantas',
      'Nº de plantas',
      'Plantas linha',
      'Plantas avaliadas',
    ]),
    planta_sem_podar: rowNumber(row, ['PlantaSemPodar', 'Planta sem podar', 'planta_sem_podar']),
    cacho_exposto: rowNumber(row, ['CachoExposto', 'Cacho exposto', 'cacho_exposto']),
    poda_meia_coroa: rowNumber(row, ['PodaMeiaCoroa', 'Poda meia coroa', 'Meia coroa', 'poda_meia_coroa']),
    folha_mamando: rowNumber(row, ['FolhaMamando', 'Folha mamando', 'folha_mamando']),
    poda_maior_1_1: rowNumber(row, [
      'PodaMaiorUmParaUm',
      'PodaMaior11',
      'Poda maior que 1:1',
      'Poda maior 1:1',
      'poda_maior_1_1',
    ]),
    bico_gaita: rowNumber(row, ['BicoGaita', 'Bico de gaita', 'bico_gaita']),
    cacho_podre_planta: rowNumber(row, [
      'CachoPodrePlanta',
      'Cacho podre na planta',
      'Cacho podre',
      'cacho_podre_planta',
    ]),
    palha_mal_empilhada: rowNumber(row, [
      'PalhaMalEmpilhada',
      'Palha mal empilhada',
      'palha_mal_empilhada',
      'CachoMalPosicionado',
      'cacho_mal_posicionado',
    ]),
    linha_json: row,
  };
}

function buildSnapshotLine(row, index, type) {
  if (type === 'poda') return buildPodaSnapshotLine(row, index);
  if (type === 'carreamento') return buildCarreamentoSnapshotLine(row, index);
  return buildCorteSnapshotLine(row, index);
}

function cqoSnapshotSourceTable(type, snapshot) {
  return snapshot?.source_table || (type === 'poda' ? 'cqo_poda_import_snapshots' : 'cqo_import_snapshots');
}

function cqoSnapshotFormId(type) {
  if (type === 'poda') return 'excel_cqo_poda';
  if (type === 'carreamento') return 'excel_cqo_carreamento';
  return 'excel_cqo_corte';
}

const SNAPSHOT_TOTAL_PLANTS_KEYS = ['total_plantas_parcela', 'TotalPlantasParcela', 'Nº de plantas Atual', 'N de plantas Atual', 'NumeroPlantasAtual', 'numero_plantas_atual'];
const SNAPSHOT_AREA_KEYS = ['Área Plantada', 'Area Plantada', 'area_plantada'];
const SNAPSHOT_LOSS_T_KEYS = ['perdas_t_bi', 'perdas_t', 'perdas t', 'Perdas t', 'perda_t', 'Perda t', 'perdasT'];
const SNAPSHOT_ESTIMATED_LOSS_KEYS = [
  'estimativa_cachos_perdidos_bi',
  'estimativa_cachos_perdidos',
  'estimativa de cacho perdido/pla',
  'estimativa_cacho_perdido_pla',
  'estimativa de perdas cnc/pla',
  'estimativa_perdas_cnc_pla',
];

function sumSnapshotRows(groupRows, keys) {
  return groupRows.reduce((total, item) => total + rowNumber(item.row, keys), 0);
}

function hasSnapshotValue(groupRows, keys) {
  return groupRows.some((item) => keys.some((key) => {
    const value = item.row?.[key];
    return value !== undefined && value !== null && value !== '';
  }));
}

function cqoSnapshotGroupKey(row, type) {
  return [
    type,
    normalizeText(cqoSnapshotFarm(row)),
    normalizeText(cqoSnapshotParcel(row)),
    cqoSnapshotDate(row) || cqoSnapshotMonth(row) || 'sem-data',
    cqoSnapshotEvaluator(row) || 'sem-avaliador',
    cqoSnapshotFiscal(row) || 'sem-fiscal',
  ].join('|');
}

function groupCqoSnapshotRows(rows, type, snapshot) {
  const groups = new Map();

  rows.forEach((row, index) => {
    const key = cqoSnapshotGroupKey(row, type);
    const current = groups.get(key) || {
      index: groups.size + 1,
      type,
      rows: [],
      firstRow: row,
    };
    current.rows.push({ row, index });
    groups.set(key, current);
  });

  return Array.from(groups.values()).map((group) => {
    const first = group.firstRow;
    const date = normalizeSnapshotDateValue(cqoSnapshotDate(first) || cqoSnapshotMonth(first))
      || normalizeSnapshotDateValue(snapshot?.imported_at || snapshot?.updated_at)
      || new Date().toISOString();
    const lines = group.rows.map(({ row, index }) => buildSnapshotLine(row, index, type));
    const sourceTable = cqoSnapshotSourceTable(type, snapshot);
    const data = {
      nome_polo: rowText(first, ['NomePolo', 'Nome Polo', 'Polo']),
      nome_fazenda: cqoSnapshotFarm(first),
      parcela: cqoSnapshotParcel(first),
      parcela_original: rowText(first, ['parcela_original', 'Parcela', 'parcela']),
      data_avaliacao: date,
      ciclo_mes: cqoSnapshotCycle(first),
      matricula_avaliador: cqoSnapshotEvaluator(first),
      fiscal_resp: cqoSnapshotFiscal(first),
      fiscal_resp_equipe: cqoSnapshotFiscal(first),
      observacao: rowText(first, ['Observacao', 'Observação', 'observacao']),
      mapeamento_legado: false,
      fonte_excel: {
        tabela: sourceTable,
        import_key: snapshot?.import_key || '',
        source_file: snapshot?.source_file || '',
        source_path: snapshot?.source_path || '',
        file_last_write_time: snapshot?.file_last_write_time || '',
      },
    };
    const totalPlants = rowText(first, SNAPSHOT_TOTAL_PLANTS_KEYS);
    const areaPlantada = rowText(first, SNAPSHOT_AREA_KEYS);
    const perdasT = sumSnapshotRows(group.rows, SNAPSHOT_LOSS_T_KEYS);
    const estimatedLoss = sumSnapshotRows(group.rows, SNAPSHOT_ESTIMATED_LOSS_KEYS);

    if (totalPlants) data.total_plantas_parcela = totalPlants;
    if (areaPlantada) data.area_plantada = areaPlantada;
    if (hasSnapshotValue(group.rows, SNAPSHOT_LOSS_T_KEYS)) {
      data.perdas_t_bi = perdasT;
      if (type === 'carreamento') {
        data.perdas_t_carreamento_bi = perdasT;
      } else if (type === 'corte') {
        data.perdas_t_corte_bi = perdasT;
      }
    }
    if (hasSnapshotValue(group.rows, SNAPSHOT_ESTIMATED_LOSS_KEYS)) {
      data.estimativa_cachos_perdidos_bi = estimatedLoss;
      if (type === 'carreamento') {
        data.estimativa_cachos_nao_carreados_bi = estimatedLoss;
      } else if (type === 'corte') {
        data.estimativa_cachos_esquecidos_bi = estimatedLoss;
      }
    }

    if (type === 'carreamento') {
      data.ano_plantio = rowText(first, ['ano_plantio', 'AnoPlantio', 'Ano']);
      data.densidade = rowText(first, ['densidade', 'Densidade']);
      data.total_plantas_parcela = data.total_plantas_parcela || rowText(first, ['total_plantas_parcela', 'TotalPlantasParcela']);
      data.total_cachos_carreados = rowText(first, ['total_cachos_carreados', 'TotalCachosCarreados']);
      data.variedade = rowText(first, ['variedade', 'Variedade']);
      data.linhas_carreamento = lines;
    } else if (type === 'poda') {
      data.atividade = rowText(first, ['Atividade', 'atividade']) || 'Poda';
      data.empresa = rowText(first, ['Empresa', 'empresa']) || 'Vila Nova';
      data.ano_plantio = rowText(first, ['ano_plantio', 'AnoPlantio', 'Ano plantio', 'Ano']);
      data.total_plantas_parcela = data.total_plantas_parcela || rowText(first, [
        'total_plantas_parcela',
        'TotalPlantasParcela',
        'Total de plantas da parcela',
        'Plantas projetadas',
      ]);
      data.linhas_poda = lines;
    } else {
      data.linhas_corte = lines;
    }

    return {
      id: `excel-${type}-${snapshot?.import_key || 'snapshot'}-${group.index}`,
      formulario_id: cqoSnapshotFormId(type),
      formulario_versao: 'excel-snapshot',
      usuario_id: data.matricula_avaliador,
      status: 'aprovado',
      criado_em: date,
      enviado_em: date,
      recebido_em: snapshot?.imported_at || snapshot?.updated_at || date,
      dados_json: data,
      excel_rows: group.rows.map(({ row }) => row),
      source: sourceTable,
    };
  });
}

function normalizeCqoImportSnapshotData(snapshot, podaSnapshots = []) {
  const safePodaSnapshots = Array.isArray(podaSnapshots) ? podaSnapshots : [];
  const corteRows = Array.isArray(snapshot?.corte_rows_json) ? snapshot.corte_rows_json : [];
  const carreamentoRows = Array.isArray(snapshot?.carreamento_rows_json) ? snapshot.carreamento_rows_json : [];
  const podaRows = safePodaSnapshots.flatMap((podaSnapshot) => {
    const rows = Array.isArray(podaSnapshot?.rows_json) ? podaSnapshot.rows_json : [];
    return groupCqoSnapshotRows(rows, 'poda', {
      ...podaSnapshot,
      source_table: 'cqo_poda_import_snapshots',
    });
  });
  const podaTotalRows = safePodaSnapshots.reduce((total, podaSnapshot) => {
    const rows = Array.isArray(podaSnapshot?.rows_json) ? podaSnapshot.rows_json.length : 0;
    return total + Number(podaSnapshot?.total_rows || rows || 0);
  }, 0);

  return {
    snapshot: snapshot || null,
    podaSnapshots: safePodaSnapshots,
    podaRows: podaTotalRows,
    rows: [
      ...groupCqoSnapshotRows(corteRows, 'corte', snapshot),
      ...groupCqoSnapshotRows(carreamentoRows, 'carreamento', snapshot),
      ...podaRows,
    ],
  };
}

export async function updateResponseReviewStatus(responseId, status, session = {}) {
  const normalizedStatus = normalizeText(status) === 'aprovado' ? 'aprovado' : 'reprovado';
  const payload = await postSupabaseRpc(
    'dashboard_review_response',
    {
      ...sessionRpcPayload(session),
      p_response_id: String(responseId),
      p_status: normalizedStatus,
    },
    'Atualização de validação'
  );

  return payload || [];
}

export async function deleteResponseRecord(responseId, session = {}) {
  const payload = await postSupabaseRpc(
    'dashboard_delete_response',
    {
      ...sessionRpcPayload(session),
      p_response_id: String(responseId),
    },
    'Exclusão de ficha'
  );

  return payload || [];
}

function rpcScalarPayload(payload, functionName) {
  if (Array.isArray(payload)) {
    const first = payload[0] || null;
    return first?.[functionName] || first || {};
  }

  return payload?.[functionName] || payload || {};
}

function datasetRows(dataset, key) {
  const rows = dataset?.[key];
  return Array.isArray(rows) ? rows : [];
}

function buildSupabaseData({
  responseRows,
  headcount,
  gpsRows,
  attachmentRows,
  formRows,
  cqoImport,
  source,
}) {
  const safeGpsRows = Array.isArray(gpsRows) ? gpsRows : [];
  const safeAttachmentRows = Array.isArray(attachmentRows) ? attachmentRows : [];
  const safeFormRows = Array.isArray(formRows) ? formRows : [];

  const gpsByResponse = safeGpsRows.reduce((acc, point) => {
    const key = point.resposta_id;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(point);
    return acc;
  }, {});

  const attachmentsByResponse = safeAttachmentRows
    .map((row, index) => normalizeAttachment(row, index))
    .reduce((acc, attachment) => {
      const key = attachment.responseId;
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(attachment);
      return acc;
    }, {});

  const mobileRecordsRaw = responseRows.map((row) => normalizeResponse(
      row,
      headcount,
      gpsByResponse[row.id] || [],
      attachmentsByResponse[row.id] || []
  ));
  const mobileRecords = dedupeMobileRecords(mobileRecordsRaw);
  const excelRecords = cqoImport.rows.map((row) => normalizeResponse(row, headcount));
  const records = [...mobileRecords, ...excelRecords]
    .sort((a, b) => {
      const dateA = parseRecordDateValue(a.raw?.data_avaliacao || a.createdAt)?.getTime() || 0;
      const dateB = parseRecordDateValue(b.raw?.data_avaliacao || b.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });

  return {
    records,
    mobileRecords,
    excelRecords,
    headcount,
    formularios: safeFormRows,
    anexos: safeAttachmentRows,
    gpsRows: safeGpsRows,
    cqoImport: {
      snapshot: cqoImport.snapshot,
      podaSnapshots: cqoImport.podaSnapshots || [],
      records: excelRecords.length,
      corteRows: Number(cqoImport.snapshot?.corte_total_rows || 0),
      carreamentoRows: Number(cqoImport.snapshot?.carreamento_total_rows || 0),
      podaRows: Number(cqoImport.podaRows || 0),
    },
    source: source || 'Banco online',
    error: '',
  };
}

async function loadSupabaseDataFromRpc(sessionToken) {
  const payload = await postSupabaseRpc(
    'dashboard_cqo_dataset',
    { p_session_token: sessionToken },
    'Leitura do dashboard'
  );
  const dataset = rpcScalarPayload(payload, 'dashboard_cqo_dataset');
  const headcount = normalizeHeadcountSnapshotData(datasetRows(dataset, 'headcount_import_snapshots')[0]).rows;
  const cqoImport = normalizeCqoImportSnapshotData(
    datasetRows(dataset, 'cqo_import_snapshots')[0],
    datasetRows(dataset, 'cqo_poda_import_snapshots')
  );
  const attachmentRows = await attachSignedStorageUrls(datasetRows(dataset, 'mobile_anexos'));

  return buildSupabaseData({
    responseRows: datasetRows(dataset, 'mobile_respostas'),
    headcount,
    gpsRows: datasetRows(dataset, 'mobile_gps'),
    attachmentRows,
    formRows: datasetRows(dataset, 'mobile_formularios'),
    cqoImport,
    source: 'Banco online',
  });
}

async function loadSupabaseData() {
  if (!activeDashboardSessionToken) {
    throw new Error('Sessao do dashboard nao configurada para leitura dos dados.');
  }

  if (LOCAL_DEMO_MODE) {
    return buildLocalDemoData();
  }

  return loadSupabaseDataFromRpc(activeDashboardSessionToken);
}

function sampleData(error = '') {
  return {
    records: [],
    mobileRecords: [],
    excelRecords: [],
    headcount: [],
    formularios: [],
    anexos: [],
    gpsRows: [],
    cqoImport: { snapshot: null, podaSnapshots: [], records: 0, corteRows: 0, carreamentoRows: 0, podaRows: 0 },
    source: 'Serviço online indisponível',
    error: dashboardErrorMessage(error, 'Não foi possível carregar os dados do dashboard.'),
  };
}

let cachedData = null;
let activePromise = null;
let activeDashboardSessionToken = '';
const listeners = new Set();

export function clearCqoCache() {
  cachedData = null;
  activePromise = null;
}

export function setCqoSessionToken(sessionToken) {
  const nextToken = String(sessionToken || '').trim();
  if (nextToken === activeDashboardSessionToken) return;
  activeDashboardSessionToken = nextToken;
  clearCqoCache();
}

export function getCqoSessionToken() {
  return activeDashboardSessionToken;
}

export function refreshCqoData() {
  clearCqoCache();

  // Notificar todos os listeners ativos de que estamos recarregando
  listeners.forEach((listener) =>
    listener({
      loading: true,
      records: [],
      mobileRecords: [],
      excelRecords: [],
      headcount: [],
      formularios: [],
      anexos: [],
      gpsRows: [],
      cqoImport: { snapshot: null, podaSnapshots: [], records: 0, corteRows: 0, carreamentoRows: 0, podaRows: 0 },
      source: 'Atualizando...',
      error: '',
    })
  );

  activePromise = loadSupabaseData()
    .then((data) => {
      cachedData = data;
      activePromise = null;
      listeners.forEach((listener) => listener({ ...data, loading: false }));
      return data;
    })
    .catch((error) => {
      activePromise = null;
      const failedData = sampleData(error);
      listeners.forEach((listener) => listener({ ...failedData, loading: false }));
      throw error;
    });

  return activePromise;
}

export function useCqoData() {
  const [state, setState] = useState(() => {
    if (cachedData) {
      return {
        loading: false,
        ...cachedData,
      };
    }
    return {
      loading: true,
      records: [],
      headcount: [],
      formularios: [],
      anexos: [],
      gpsRows: [],
      source: 'Carregando',
      error: '',
    };
  });

  useEffect(() => {
    listeners.add(setState);

    // Se o cache não estiver pronto e nenhuma busca estiver ativa, inicia a busca
    if (!cachedData && !activePromise) {
      activePromise = loadSupabaseData()
        .then((data) => {
          cachedData = data;
          activePromise = null;
          listeners.forEach((listener) => listener({ ...data, loading: false }));
        })
        .catch((error) => {
          activePromise = null;
          const failedData = sampleData(error);
          listeners.forEach((listener) => listener({ ...failedData, loading: false }));
        });
    }

    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseExcelDateSerial(value) {
  const serial = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;

  const utcDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 24 * 60 * 60 * 1000);
  if (Number.isNaN(utcDate.getTime())) return null;

  return new Date(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth(),
    utcDate.getUTCDate(),
    12,
    0,
    0
  );
}

export function parseRecordDateValue(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const excelSerialDate = parseExcelDateSerial(value);
  if (excelSerialDate) return excelSerialDate;

  if (typeof value === 'string') {
    const brDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (brDate) {
      const parsed = new Date(
        Number(brDate[3]),
        Number(brDate[2]) - 1,
        Number(brDate[1]),
        Number(brDate[4] || 12),
        Number(brDate[5] || 0),
        Number(brDate[6] || 0)
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const isoOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoOnly) {
      const parsed = new Date(Number(isoOnly[1]), Number(isoOnly[2]) - 1, Number(isoOnly[3]), 12, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoDate) {
      const parsed = new Date(
        Number(isoDate[1]),
        Number(isoDate[2]) - 1,
        Number(isoDate[3]),
        Number(isoDate[4] || 12),
        Number(isoDate[5] || 0),
        Number(isoDate[6] || 0)
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatInputDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeSnapshotDateValue(value) {
  const parsed = parseRecordDateValue(value);
  return parsed ? formatInputDate(parsed) : String(value || '').trim();
}

function resolveFilterDate(record) {
  const candidates = [
    record.raw?.data_avaliacao,
    record.raw?.data,
    record.raw?.Data,
    record.raw?.data_coleta,
    record.raw?.dataAvaliacao,
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

function isWithinPeriod(record, periodFilter, dateFrom = '', dateTo = '') {
  const created = resolveFilterDate(record);
  if (!created) return true;
  if (periodFilter === 'custom') {
    const from = parseDateBoundary(dateFrom);
    const to = parseDateBoundary(dateTo, true);
    return (!from || created >= from) && (!to || created <= to);
  }
  if (periodFilter === 'season' || periodFilter === 'all') return true;
  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (periodFilter === 'today') return created.toDateString() === now.toDateString();
  if (periodFilter === 'week') return diffDays <= 7;
  if (periodFilter === 'month') return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  return true;
}

export function filterRecords(records, { farmFilter = 'all', areaFilter = 'all', periodFilter = 'month', cycleFilter = 'all', evaluatorFilter = 'all', sourceFilter = 'all', dateFrom = '', dateTo = '', searchTerm = '', statusFilter = 'all' } = {}) {
  const search = normalizeText(searchTerm);
  return records.filter((record) => {
    const activeFarmOk = ACTIVE_CQO_FARM_IDS.includes(record.farmId);
    const farmOk = farmFilter === 'all' || record.farmId === farmFilter;
    const areaOk = areaFilter === 'all' || record.type === areaFilter;
    const cycleOk = cycleFilter === 'all' || String(record.cycle) === String(cycleFilter);
    const evaluatorOk = evaluatorFilter === 'all' || normalizeText(record.fiscal) === normalizeText(evaluatorFilter);
    const sourceOk = sourceFilter === 'all' || record.source === sourceFilter;
    const statusOk = statusFilter === 'all' || normalizeText(record.status) === normalizeText(statusFilter);
    const periodOk = isWithinPeriod(record, periodFilter, dateFrom, dateTo);
    const haystack = normalizeText([
      record.id,
      record.farm,
      record.parcel,
      record.cycle,
      record.form,
      record.evaluator,
      record.evaluatorMatricula,
      record.fiscal,
    ].join(' '));
    const searchOk = !search || haystack.includes(search);
    return activeFarmOk && farmOk && areaOk && cycleOk && evaluatorOk && sourceOk && statusOk && periodOk && searchOk;
  });
}

export function aggregateRecords(records) {
  const totals = records.reduce((acc, record) => {
    acc.total += 1;
    acc[record.type] += 1;
    acc.linhas += record.totals.linhas || 0;
    acc.plantasObservadas += record.totals.plantasObservadas || 0;
    acc.cachosObservados += record.totals.cachosObservados || 0;
    if (record.type === 'corte') {
      acc.cortePlantasObservadas += record.totals.plantasObservadas || 0;
      acc.corteCachosObservados += record.totals.cachosObservados || 0;
    }
    if (record.type === 'carreamento') {
      acc.carreamentoPlantasObservadas += record.totals.plantasObservadas || 0;
    }
    if (record.type === 'poda') {
      acc.podaPlantasObservadas += record.totals.plantasObservadas || 0;
    }
    acc.cachoEsquecido += record.totals.cachoEsquecido || 0;
    acc.cachoVerde += record.totals.cachoVerde || 0;
    acc.cachoMaduro += record.totals.cachoMaduro || 0;
    acc.cachoPassado += record.totals.cachoPassado || 0;
    acc.cachoInfermo += record.totals.cachoInfermo || 0;
    acc.bucha += record.totals.bucha || 0;
    acc.cachoMalPosicionado += record.totals.cachoMalPosicionado || 0;
    acc.cachoNaoCarreado += record.totals.cachoNaoCarreado || 0;
    acc.pesoMedio += record.totals.pesoMedio || 0;
    acc.plantaSemPodar += record.totals.plantaSemPodar || 0;
    acc.cachoExposto += record.totals.cachoExposto || 0;
    acc.podaMeiaCoroa += record.totals.podaMeiaCoroa || 0;
    acc.podaMaiorUmParaUm += record.totals.podaMaiorUmParaUm || 0;
    acc.bicoGaita += record.totals.bicoGaita || 0;
    acc.cachoPodrePlanta += record.totals.cachoPodrePlanta || 0;
    acc.palhaMalEmpilhada += record.totals.palhaMalEmpilhada || 0;
    acc.plantasProjetadas += record.totals.plantasProjetadas || 0;
    acc.podaComProjecao += record.totals.totalPlantasParcela ? 1 : 0;
    acc.plantaSemPodarProjetada += record.totals.plantaSemPodarProjetada || 0;
    acc.cachoExpostoProjetado += record.totals.cachoExpostoProjetado || 0;
    acc.podaMeiaCoroaProjetada += record.totals.podaMeiaCoroaProjetada || 0;
    acc.folhaMamandoProjetada += record.totals.folhaMamandoProjetada || 0;
    acc.podaMaiorUmParaUmProjetada += record.totals.podaMaiorUmParaUmProjetada || 0;
    acc.bicoGaitaProjetado += record.totals.bicoGaitaProjetado || 0;
    acc.cachoPodrePlantaProjetado += record.totals.cachoPodrePlantaProjetado || 0;
    acc.palhaMalEmpilhadaProjetada += record.totals.palhaMalEmpilhadaProjetada || 0;
    if (record.gpsApplicable !== false) {
      acc.gpsEligible += 1;
      acc.gps += record.gps ? 1 : 0;
      acc.gpsPoints += record.gpsTrack?.length || 0;
      acc.gpsOccurrences += record.gpsOccurrences?.length || 0;
    }
    
    // Novos acumulados adicionados para corrigir a agregação global
    acc.cachoBrocado += record.totals.cachoBrocado || 0;
    acc.taloComprido += record.totals.taloComprido || 0;
    acc.folhaCortada += record.totals.folhaCortada || 0;
    acc.folhaMamando += record.totals.folhaMamando || 0;
    acc.cachoEstrela += record.totals.cachoEstrela || 0;
    acc.cachoAvermelhado += record.totals.cachoAvermelhado || 0;

    if (record.status === 'Sincronizado') acc.sincronizados += 1;
    if (record.status === 'Pendente validação') acc.pendentesValidacao += 1;
    if (record.status === 'Aprovado') acc.aprovados += 1;
    if (record.status === 'Reprovado') acc.reprovados += 1;
    if (record.status === 'Pendente') acc.pendentes += 1;
    if (record.status === 'Falha') acc.falhas += 1;
    return acc;
  }, {
    total: 0,
    corte: 0,
    carreamento: 0,
    poda: 0,
    linhas: 0,
    plantasObservadas: 0,
    cachosObservados: 0,
    cortePlantasObservadas: 0,
    corteCachosObservados: 0,
    carreamentoPlantasObservadas: 0,
    podaPlantasObservadas: 0,
    cachoEsquecido: 0,
    cachoVerde: 0,
    cachoMaduro: 0,
    cachoPassado: 0,
    cachoInfermo: 0,
    bucha: 0,
    cachoMalPosicionado: 0,
    cachoNaoCarreado: 0,
    pesoMedio: 0,
    plantaSemPodar: 0,
    cachoExposto: 0,
    podaMeiaCoroa: 0,
    podaMaiorUmParaUm: 0,
    bicoGaita: 0,
    cachoPodrePlanta: 0,
    palhaMalEmpilhada: 0,
    plantasProjetadas: 0,
    podaComProjecao: 0,
    plantaSemPodarProjetada: 0,
    cachoExpostoProjetado: 0,
    podaMeiaCoroaProjetada: 0,
    folhaMamandoProjetada: 0,
    podaMaiorUmParaUmProjetada: 0,
    bicoGaitaProjetado: 0,
    cachoPodrePlantaProjetado: 0,
    palhaMalEmpilhadaProjetada: 0,
    gpsEligible: 0,
    gps: 0,
    gpsPoints: 0,
    gpsOccurrences: 0,
    sincronizados: 0,
    pendentesValidacao: 0,
    aprovados: 0,
    reprovados: 0,
    pendentes: 0,
    falhas: 0,
    // Inicialização dos novos campos
    cachoBrocado: 0,
    taloComprido: 0,
    folhaCortada: 0,
    folhaMamando: 0,
    cachoEstrela: 0,
    cachoAvermelhado: 0,
  });

  totals.syncRate = totals.total ? Math.round((totals.sincronizados / totals.total) * 100) : 0;
  totals.validationRate = totals.total ? Math.round(((totals.aprovados + totals.reprovados) / totals.total) * 100) : 0;
  totals.approvalRate = (totals.aprovados + totals.reprovados) ? Math.round((totals.aprovados / (totals.aprovados + totals.reprovados)) * 100) : 0;
  totals.gpsRate = totals.gpsEligible ? Math.round((totals.gps / totals.gpsEligible) * 100) : 0;
  totals.perdaCorteRate = totals.corteCachosObservados ? ((totals.cachoEsquecido / totals.corteCachosObservados) * 100).toFixed(1) : '0.0';
  totals.mediaPesoFrutos = totals.carreamento ? (totals.pesoMedio / totals.carreamento).toFixed(1) : '0.0';

  // --- Novos Cálculos de Qualidade Operacional ---
  
  // Taxas individuais de qualidade do Corte
  totals.cachoVerdeRate = totals.corteCachosObservados ? (totals.cachoVerde / totals.corteCachosObservados) * 100 : 0;
  totals.cachoPassadoRate = totals.corteCachosObservados ? (totals.cachoPassado / totals.corteCachosObservados) * 100 : 0;
  totals.taloCompridoRate = totals.cortePlantasObservadas ? (totals.taloComprido / totals.cortePlantasObservadas) * 100 : 0;
  totals.folhaCortadaRate = totals.cortePlantasObservadas ? (totals.folhaCortada / totals.cortePlantasObservadas) * 100 : 0;
  totals.pragasRate = totals.corteCachosObservados ? (totals.cachoBrocado / totals.corteCachosObservados) * 100 : 0;

  // Nota de Qualidade do Corte (Score 0-100)
  const cLoss = (Number(totals.perdaCorteRate) * 12) + (totals.cachoVerdeRate * 8) + (totals.cachoPassadoRate * 4) + (totals.taloCompridoRate * 3) + (totals.folhaCortadaRate * 3);
  totals.corteScore = totals.corte > 0 ? Math.max(0, Math.min(100, Math.round(100 - cLoss))) : 100;

  // Taxas individuais de qualidade do Carreamento
  totals.cachoNaoCarreadoRate = totals.carreamentoPlantasObservadas ? (totals.cachoNaoCarreado / totals.carreamentoPlantasObservadas) * 100 : 0;
  totals.cachoMalPosicionadoRate = totals.carreamentoPlantasObservadas ? (totals.cachoMalPosicionado / totals.carreamentoPlantasObservadas) * 100 : 0;

  // Nota de Qualidade do Carreamento (Score 0-100)
  const carLoss = (totals.cachoNaoCarreadoRate * 15) + (totals.cachoMalPosicionadoRate * 6);
  totals.carreamentoScore = totals.carreamento > 0 ? Math.max(0, Math.min(100, Math.round(100 - carLoss))) : 100;

  // Taxas individuais de qualidade da Poda
  totals.plantaSemPodarRate = totals.podaPlantasObservadas ? (totals.plantaSemPodar / totals.podaPlantasObservadas) * 100 : 0;
  totals.cachoExpostoRate = totals.podaPlantasObservadas ? (totals.cachoExposto / totals.podaPlantasObservadas) * 100 : 0;
  totals.podaMeiaCoroaRate = totals.podaPlantasObservadas ? (totals.podaMeiaCoroa / totals.podaPlantasObservadas) * 100 : 0;
  totals.folhaMamandoPodaRate = totals.podaPlantasObservadas ? (totals.folhaMamando / totals.podaPlantasObservadas) * 100 : 0;
  totals.podaMaiorUmParaUmRate = totals.podaPlantasObservadas ? (totals.podaMaiorUmParaUm / totals.podaPlantasObservadas) * 100 : 0;
  totals.bicoGaitaRate = totals.podaPlantasObservadas ? (totals.bicoGaita / totals.podaPlantasObservadas) * 100 : 0;
  totals.cachoPodrePlantaRate = totals.podaPlantasObservadas ? (totals.cachoPodrePlanta / totals.podaPlantasObservadas) * 100 : 0;
  totals.palhaMalEmpilhadaRate = totals.podaPlantasObservadas ? (totals.palhaMalEmpilhada / totals.podaPlantasObservadas) * 100 : 0;

  const podaLoss = (totals.plantaSemPodarRate * 14)
    + (totals.cachoPodrePlantaRate * 10)
    + (totals.cachoExpostoRate * 8)
    + (totals.podaMeiaCoroaRate * 6)
    + (totals.podaMaiorUmParaUmRate * 6)
    + (totals.bicoGaitaRate * 5)
    + (totals.folhaMamandoPodaRate * 4)
    + (totals.palhaMalEmpilhadaRate * 4);
  totals.podaScore = totals.poda > 0 ? Math.max(0, Math.min(100, Math.round(100 - podaLoss))) : 100;
  totals.ocorrenciasPodaProjetadas = totals.plantaSemPodarProjetada
    + totals.cachoExpostoProjetado
    + totals.podaMeiaCoroaProjetada
    + totals.folhaMamandoProjetada
    + totals.podaMaiorUmParaUmProjetada
    + totals.bicoGaitaProjetado
    + totals.cachoPodrePlantaProjetado
    + totals.palhaMalEmpilhadaProjetada;

  // Nota Geral de Qualidade CQO (Média simples dos formulários ativos)
  let validScores = [];
  if (totals.corte > 0) validScores.push(totals.corteScore);
  if (totals.carreamento > 0) validScores.push(totals.carreamentoScore);
  if (totals.poda > 0) validScores.push(totals.podaScore);
  totals.generalScore = validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 100;

  // Estimativa de Perdas (Volume de Frutos e Óleo de Palma)
  totals.lostCachosQty = totals.cachoEsquecido + totals.cachoNaoCarreado;
  totals.lostFrutosTon = (totals.lostCachosQty * 20) / 1000; // 20kg por cacho
  totals.lostOilTon = totals.lostFrutosTon * 0.20; // 20% de rendimento de CPO

  return totals;
}

function formatEvaluatorName(name) {
  if (!name || typeof name !== 'string') return name;
  if (name === 'Sem avaliador') return name;
  if (/^\d+$/.test(name)) return name;

  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 1) return name;

  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const last = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1).toLowerCase();

  if (['de', 'da', 'do', 'dos', 'das'].includes(last.toLowerCase()) && parts.length > 2) {
    const secondLast = parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1).toLowerCase();
    return `${first} ${secondLast}`;
  }

  return `${first} ${last}`;
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

function monthWeekKey(record) {
  const date = resolveRecordDate(record);
  if (!date) return 'Semana sem data';
  const week = Math.min(5, Math.max(1, Math.ceil(date.getDate() / 7)));
  return `Semana ${week}`;
}

function monthDayKey(record) {
  const date = resolveRecordDate(record);
  if (!date) return 'Sem data';
  return String(date.getDate()).padStart(2, '0');
}

export function buildCharts(records) {
  const byFarm = new Map();
  const byEvaluator = new Map();
  const byDay = new Map();
  const byWeek = new Map();
  const byMonthDay = new Map();
  const byMonthWeek = new Map();
  const byCycle = new Map();

  records.forEach((record) => {
    // Farm
    if (!byFarm.has(record.farm)) byFarm.set(record.farm, []);
    byFarm.get(record.farm).push(record);

    // Evaluator
    const evalName = formatEvaluatorName(record.evaluator);
    if (!byEvaluator.has(evalName)) byEvaluator.set(evalName, []);
    byEvaluator.get(evalName).push(record);

    // Day
    if (!byDay.has(record.date)) byDay.set(record.date, []);
    byDay.get(record.date).push(record);

    const monthDay = monthDayKey(record);
    if (!byMonthDay.has(monthDay)) byMonthDay.set(monthDay, []);
    byMonthDay.get(monthDay).push(record);

    // Week
    const week = monthWeekKey(record);
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week).push(record);

    if (!byMonthWeek.has(week)) byMonthWeek.set(week, []);
    byMonthWeek.get(week).push(record);

    // Cycle
    if (!byCycle.has(String(record.cycle))) byCycle.set(String(record.cycle), []);
    byCycle.get(String(record.cycle)).push(record);
  });

  const getScore = (recs) => aggregateRecords(recs).generalScore;
  const getLossTon = (recs) => aggregateRecords(recs).lostFrutosTon;

  const mapToChart = (map, fill = '#D98C10') => Array.from(map.entries())
    .map(([label, recs]) => ({ label: label.length > 18 ? `${label.slice(0, 18)}...` : label, value: getScore(recs), fill }))
    .sort((a, b) => b.value - a.value);

  const mapToBarChartByLabel = (map, fill = '#D98C10') => Array.from(map.entries())
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([label, recs]) => ({ label, value: getScore(recs), fill }));

  const byDayData = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, recs]) => ({ label, value: getScore(recs) }));

  const byWeekData = Array.from(byWeek.entries())
    .sort(([a], [b]) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, '')))
    .map(([label, recs]) => ({ label, value: getScore(recs) }));

  const byMonthDayData = Array.from(byMonthDay.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([label, recs]) => ({ label, value: getScore(recs) }));

  const byMonthWeekData = Array.from(byMonthWeek.entries())
    .sort(([a], [b]) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, '')))
    .map(([label, recs]) => ({ label, value: getScore(recs) }));

  // YTD Calculation (Losses accumulated)
  let accumulatedLoss = 0;
  const ytdLossData = Array.from(byWeek.entries())
    .sort(([a], [b]) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, '')))
    .map(([label, recs]) => {
      accumulatedLoss += getLossTon(recs);
      return { label, value: Number(accumulatedLoss.toFixed(2)) };
    });

  const getLossRate = (recs) => {
    const totals = aggregateRecords(recs);
    return Number(totals.perdaCorteRate);
  };

  const lossRateByWeekData = Array.from(byWeek.entries())
    .sort(([a], [b]) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, '')))
    .map(([label, recs]) => ({ label, value: getLossRate(recs) }));

  return {
    byFarm: mapToChart(byFarm, '#234F2A'),
    byEvaluator: mapToChart(byEvaluator, '#F2B544').slice(0, 10),
    byDay: byDayData,
    byDayOfMonth: byMonthDayData,
    byWeek: byWeekData,
    byWeekOfMonth: byMonthWeekData,
    byCycle: mapToBarChartByLabel(byCycle, '#F59E0B'),
    ytdLoss: ytdLossData,
    lossRateByWeek: lossRateByWeekData,
    lossRateByWeekOfMonth: lossRateByWeekData,
  };
}

export function useCqoDashboard(filters) {
  const data = useCqoData();
  const filtered = useMemo(() => filterRecords(data.records, filters), [data.records, filters]);
  const totals = useMemo(() => aggregateRecords(filtered), [filtered]);
  const charts = useMemo(() => buildCharts(filtered), [filtered]);

  return {
    ...data,
    allRecords: data.records,
    records: filtered,
    totals,
    charts,
  };
}
