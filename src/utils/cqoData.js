import { useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wcifxyvesmhqurqhnway.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjaWZ4eXZlc21ocXVycWhud2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDY2MjgsImV4cCI6MjA4NTc4MjYyOH0.1hnE3IuZQ5wrXtXA22GxS-pUAiSnIlZBOiuGUgS1ABw';

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};

export const CQO_FARMS = [
  { id: 'all', name: 'Todas as Fazendas' },
  { id: 'fe-em-deus', name: 'Fé em Deus' },
  { id: 'nova-conceicao', name: 'Nova Conceição' },
  { id: 'vila-nova', name: 'Vila Nova' },
];

export const CQO_AREAS = [
  { id: 'all', name: 'Todos os formulários' },
  { id: 'corte', name: 'CQO Corte' },
  { id: 'carreamento', name: 'CQO Carreamento' },
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

function numberValue(value) {
  const parsed = Number(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumRows(rows, keys) {
  return rows.reduce((total, row) => {
    const key = keys.find((candidate) => row?.[candidate] !== undefined && row?.[candidate] !== null && row?.[candidate] !== '');
    return total + numberValue(key ? row[key] : 0);
  }, 0);
}

function buildGps(latValue, lngValue, accuracyValue) {
  const lat = Number(String(latValue ?? '').replace(',', '.').trim());
  const lng = Number(String(lngValue ?? '').replace(',', '.').trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: String(value), time: '--' };
  return {
    date: date.toLocaleDateString('pt-BR'),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function normalizeResponse(row, headcount = [], gpsRows = []) {
  const data = parseJson(row.dados_json);

  // Normalizar a estrutura de dados de legado (Android) para o padrão
  if (data.mapeamento_legado) {
    const legacy = data.mapeamento_legado;
    if (legacy.campos_digitados) {
      const cd = legacy.campos_digitados;
      if (data.nome_fazenda === undefined) data.nome_fazenda = cd.NomeFazenda;
      if (data.parcela === undefined) data.parcela = cd.Parcela;
      if (data.ciclo_mes === undefined) data.ciclo_mes = cd.ciclo_mes;
      if (data.fiscal_resp === undefined) data.fiscal_resp = cd["Fiscal Resp"] || cd.FiscalResp;
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
        if (newLine.folha_cortada_indevida === undefined) newLine.folha_cortada_indevida = line.FolhaCortada;
        if (newLine.cacho_mal_posicionado === undefined) newLine.cacho_mal_posicionado = line.CachoMalPosicionado;
        if (newLine.cacho_estrela === undefined) newLine.cacho_estrela = line.CachoEstrela || line.cachos_estrela;
        if (newLine.cacho_brocado === undefined) newLine.cacho_brocado = line.CachoBrocado || line.cachos_brocados;
        if (newLine.cacho_avermelhado === undefined) newLine.cacho_avermelhado = line.CachoAvermelhado || line.cachos_avermelhados;
        
        // Carreamento
        if (newLine.cacho_nao_carreado === undefined) newLine.cacho_nao_carreado = line.CachoNaoCarreado;
        if (newLine.peso_medio === undefined) newLine.peso_medio = line.PesoMedio || line.pesoMedio;
        
        return newLine;
      });

      const isCarreamento = formType(row.formulario_id, data) === 'carreamento';
      if (isCarreamento) {
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
  const lines = type === 'carreamento'
    ? (Array.isArray(data.linhas_carreamento) ? data.linhas_carreamento : [])
    : (Array.isArray(data.linhas_corte) ? data.linhas_corte : []);
  const gps = findGps(data, type);
  const gpsOccurrences = findGpsOccurrences(data, gpsRows);
  const gpsTrack = findGpsTrack(data, gps, gpsRows);
  const dateTime = formatDateTime(row.criado_em || data.data_avaliacao);
  const matricula = data.matricula_avaliador || row.usuario_id || '';
  const collaborator = headcount.find((item) => String(item.matricula) === String(matricula));
  const acompanhamento = data.acompanhamento && typeof data.acompanhamento === 'object'
    ? data.acompanhamento
    : { teve: 'nao', matricula: '', nome: '' };

  const base = {
    id: row.id,
    type,
    form: type === 'carreamento' ? 'CQO Carreamento e Fruto Solto' : 'CQO Corte',
    formularioId: row.formulario_id,
    status: statusLabel(row.status),
    createdAt: row.criado_em,
    sentAt: row.enviado_em,
    date: dateTime.date,
    time: dateTime.time,
    farm: data.nome_fazenda || 'Sem fazenda',
    farmId: normalizeText(data.nome_fazenda || 'sem-fazenda'),
    parcel: data.parcela || '--',
    cycle: data.ciclo_mes || '--',
    evaluatorMatricula: matricula,
    evaluator: collaborator?.nome || matricula || 'Sem avaliador',
    evaluatorRole: collaborator?.cargo || '',
    fiscal: data.fiscal_resp || '--',
    observation: data.observacao || '',
    acompanhamento,
    gps: gps || gpsOccurrences[0] || gpsTrack[0] || null,
    gpsTrack,
    gpsOccurrences,
    raw: data,
    lines,
  };

  if (type === 'carreamento') {
    return {
      ...base,
      totals: {
        linhas: lines.length,
        plantasLinha: sumRows(lines, ['numero_plantas_linha']),
        cachoMalPosicionado: sumRows(lines, ['cacho_mal_posicionado']),
        cachoNaoCarreado: sumRows(lines, ['cacho_nao_carreado']),
        plantasObservadas: sumRows(lines, ['numero_plantas_observadas']),
        pesoMedio: sumRows(lines, ['peso_medio']),
      },
    };
  }

  return {
    ...base,
    totals: {
      linhas: lines.length,
      plantasLinha: sumRows(lines, ['numero_plantas_linha']),
      plantasObservadas: sumRows(lines, ['numero_plantas_observadas', 'numero_na_linha']),
      cachosObservados: sumRows(lines, ['numero_cachos_observados_papel', 'numero_cacho_observado']),
      cachoEsquecido: sumRows(lines, ['cacho_esquecido_ciclo', 'cacho_esquecido']),
      cachoVerde: sumRows(lines, ['cacho_verde']),
      cachoMaduro: sumRows(lines, ['cacho_maduro']),
      cachoPassado: sumRows(lines, ['cacho_passado']),
      folhaMamando: sumRows(lines, ['folha_mamando']),
      taloComprido: sumRows(lines, ['cacho_talo_comprido']),
      folhaCortada: sumRows(lines, ['folha_cortada_indevida']),
      cachoMalPosicionado: sumRows(lines, ['cacho_mal_posicionado']),
      cachoEstrela: sumRows(lines, ['cacho_estrela', 'cachos_estrela']),
      cachoBrocado: sumRows(lines, ['cacho_brocado', 'cachos_brocados']),
      cachoAvermelhado: sumRows(lines, ['cacho_avermelhado', 'cachos_avermelhados']),
    },
  };
}

async function fetchSupabaseTable(table, query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${table}: HTTP ${response.status}`);
  }

  return response.json();
}

export async function authenticateDashboardUser(matricula, senha) {
  const normalizedMatricula = String(matricula || '').trim();
  const normalizedSenha = String(senha || '').trim();

  if (!normalizedMatricula || !normalizedSenha) {
    throw new Error('Informe matricula e senha.');
  }

  const query = new URLSearchParams({
    select: 'matricula,senha,nome,departamento,cargo,gestor,status',
    matricula: `eq.${normalizedMatricula}`,
    status: 'eq.ATIVO',
    limit: '1',
  }).toString();

  const rows = await fetchSupabaseTable('headcount_colaboradores', query);
  const profile = rows[0];

  if (!profile || String(profile.senha || '') !== normalizedSenha) {
    throw new Error('Matricula ou senha invalida.');
  }

  return {
    matricula: profile.matricula,
    nome: profile.nome,
    departamento: profile.departamento,
    cargo: profile.cargo,
    gestor: profile.gestor,
    status: profile.status,
  };
}

export async function loadHeadcountData() {
  return fetchSupabaseTable(
    'headcount_colaboradores',
    'select=matricula,nome,departamento,cargo,gestor,status,senha,reference_date,updated_at&order=nome.asc&limit=3000'
  );
}

export async function updateCollaborator({ matricula, status, senha }) {
  const body = {};
  if (status !== undefined) body.status = status;
  if (senha !== undefined) body.senha = senha;
  body.updated_at = new Date().toISOString();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/headcount_colaboradores?matricula=eq.${encodeURIComponent(matricula)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function updateResponseReviewStatus(responseId, status) {
  const normalizedStatus = normalizeText(status) === 'aprovado' ? 'aprovado' : 'reprovado';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/mobile_respostas?id=eq.${encodeURIComponent(responseId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function deleteResponseRecord(responseId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/mobile_respostas?id=eq.${encodeURIComponent(responseId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: 'excluido',
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchFirstAvailableTable(candidates, query) {
  const errors = [];

  for (const table of candidates) {
    try {
      const rows = await fetchSupabaseTable(table, query);
      return { table, rows };
    } catch (error) {
      errors.push(`${table}: ${error.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

async function fetchOptionalTable(table, query) {
  try {
    return await fetchSupabaseTable(table, query);
  } catch {
    return [];
  }
}

async function loadSupabaseData() {
  const [responseResult, headcount, gpsRows] = await Promise.all([
    fetchFirstAvailableTable(
      ['mobile_respostas', 'respostas'],
      'select=id,formulario_id,usuario_id,dados_json,status,criado_em,enviado_em,erro_msg,tentativas&status=neq.excluido&order=criado_em.desc&limit=1000'
    ),
    fetchSupabaseTable(
      'headcount_colaboradores',
      'select=matricula,nome,cargo,departamento,gestor,status&status=eq.ATIVO&limit=2000'
    ),
    fetchOptionalTable(
      'mobile_gps',
      'select=id,resposta_id,campo_id,latitude,longitude,precisao,altitude,capturado_em&order=capturado_em.asc&limit=10000'
    ),
  ]);

  const gpsByResponse = gpsRows.reduce((acc, point) => {
    const key = point.resposta_id;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(point);
    return acc;
  }, {});

  return {
    records: responseResult.rows.map((row) => normalizeResponse(row, headcount, gpsByResponse[row.id] || [])),
    headcount,
    source: `Supabase / ${responseResult.table}`,
    error: '',
  };
}

function sampleData(error = '') {
  return {
    records: [],
    headcount: [],
    source: 'Supabase indisponivel',
    error,
  };
}

let cachedData = null;
let activePromise = null;
const listeners = new Set();

export function clearCqoCache() {
  cachedData = null;
  activePromise = null;
}

export function refreshCqoData() {
  clearCqoCache();

  // Notificar todos os listeners ativos de que estamos recarregando
  listeners.forEach((listener) =>
    listener({
      loading: true,
      records: [],
      headcount: [],
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
      const failedData = sampleData(error.message);
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
          const failedData = sampleData(error.message);
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

function isWithinPeriod(record, periodFilter, dateFrom = '', dateTo = '') {
  if (!record.createdAt) return true;
  const created = new Date(record.createdAt);
  if (Number.isNaN(created.getTime())) return true;
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

export function filterRecords(records, { farmFilter = 'all', areaFilter = 'all', periodFilter = 'all', cycleFilter = 'all', evaluatorFilter = 'all', dateFrom = '', dateTo = '', searchTerm = '', statusFilter = 'all' } = {}) {
  const search = normalizeText(searchTerm);
  return records.filter((record) => {
    const farmOk = farmFilter === 'all' || record.farmId === farmFilter;
    const areaOk = areaFilter === 'all' || record.type === areaFilter;
    const cycleOk = cycleFilter === 'all' || String(record.cycle) === String(cycleFilter);
    const evaluatorOk = evaluatorFilter === 'all' || record.evaluator === evaluatorFilter;
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
    return farmOk && areaOk && cycleOk && evaluatorOk && statusOk && periodOk && searchOk;
  });
}

export function aggregateRecords(records) {
  const totals = records.reduce((acc, record) => {
    acc.total += 1;
    acc[record.type] += 1;
    acc.linhas += record.totals.linhas || 0;
    acc.plantasObservadas += record.totals.plantasObservadas || 0;
    acc.cachosObservados += record.totals.cachosObservados || 0;
    acc.cachoEsquecido += record.totals.cachoEsquecido || 0;
    acc.cachoVerde += record.totals.cachoVerde || 0;
    acc.cachoMaduro += record.totals.cachoMaduro || 0;
    acc.cachoPassado += record.totals.cachoPassado || 0;
    acc.cachoMalPosicionado += record.totals.cachoMalPosicionado || 0;
    acc.cachoNaoCarreado += record.totals.cachoNaoCarreado || 0;
    acc.pesoMedio += record.totals.pesoMedio || 0;
    acc.gps += record.gps ? 1 : 0;
    acc.gpsPoints += record.gpsTrack?.length || 0;
    acc.gpsOccurrences += record.gpsOccurrences?.length || 0;
    
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
    linhas: 0,
    plantasObservadas: 0,
    cachosObservados: 0,
    cachoEsquecido: 0,
    cachoVerde: 0,
    cachoMaduro: 0,
    cachoPassado: 0,
    cachoMalPosicionado: 0,
    cachoNaoCarreado: 0,
    pesoMedio: 0,
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
  totals.gpsRate = totals.total ? Math.round((totals.gps / totals.total) * 100) : 0;
  totals.perdaCorteRate = totals.cachosObservados ? ((totals.cachoEsquecido / totals.cachosObservados) * 100).toFixed(1) : '0.0';
  totals.mediaPesoFrutos = totals.carreamento ? (totals.pesoMedio / totals.carreamento).toFixed(1) : '0.0';

  // --- Novos Cálculos de Qualidade Operacional ---
  
  // Taxas individuais de qualidade do Corte
  totals.cachoVerdeRate = totals.cachosObservados ? (totals.cachoVerde / totals.cachosObservados) * 100 : 0;
  totals.cachoPassadoRate = totals.cachosObservados ? (totals.cachoPassado / totals.cachosObservados) * 100 : 0;
  totals.taloCompridoRate = totals.plantasObservadas ? (totals.taloComprido / totals.plantasObservadas) * 100 : 0;
  totals.folhaCortadaRate = totals.plantasObservadas ? (totals.folhaCortada / totals.plantasObservadas) * 100 : 0;
  totals.pragasRate = totals.cachosObservados ? (totals.cachoBrocado / totals.cachosObservados) * 100 : 0;

  // Nota de Qualidade do Corte (Score 0-100)
  const cLoss = (Number(totals.perdaCorteRate) * 12) + (totals.cachoVerdeRate * 8) + (totals.cachoPassadoRate * 4) + (totals.taloCompridoRate * 3) + (totals.folhaCortadaRate * 3);
  totals.corteScore = totals.corte > 0 ? Math.max(0, Math.min(100, Math.round(100 - cLoss))) : 100;

  // Taxas individuais de qualidade do Carreamento
  totals.cachoNaoCarreadoRate = totals.plantasObservadas ? (totals.cachoNaoCarreado / totals.plantasObservadas) * 100 : 0;
  totals.cachoMalPosicionadoRate = totals.plantasObservadas ? (totals.cachoMalPosicionado / totals.plantasObservadas) * 100 : 0;

  // Nota de Qualidade do Carreamento (Score 0-100)
  const carLoss = (totals.cachoNaoCarreadoRate * 15) + (totals.cachoMalPosicionadoRate * 6);
  totals.carreamentoScore = totals.carreamento > 0 ? Math.max(0, Math.min(100, Math.round(100 - carLoss))) : 100;

  // Nota Geral de Qualidade CQO (Média simples dos formulários ativos)
  let validScores = [];
  if (totals.corte > 0) validScores.push(totals.corteScore);
  if (totals.carreamento > 0) validScores.push(totals.carreamentoScore);
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
    record.createdAt,
    record.sentAt,
    record.raw?.data_avaliacao,
    record.date,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const direct = new Date(candidate);
    if (!Number.isNaN(direct.getTime())) return direct;

    if (typeof candidate === 'string') {
      const match = candidate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }
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
    records: filtered,
    totals,
    charts,
  };
}
