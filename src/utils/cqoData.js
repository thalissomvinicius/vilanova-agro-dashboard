import { useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wcifxyvesmhqurqhnway.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjaWZ4eXZlc21ocXVycWhud2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDY2MjgsImV4cCI6MjA4NTc4MjYyOH0.1hnE3IuZQ5wrXtXA22GxS-pUAiSnIlZBOiuGUgS1ABw';

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};

export const CQO_FARMS = [
  { id: 'all', name: 'Todas as Fazendas' },
  { id: 'fe-em-deus', name: 'Fe em Deus' },
  { id: 'nova-conceicao', name: 'Nova Conceicao' },
  { id: 'vila-nova', name: 'Vila Nova' },
];

export const CQO_AREAS = [
  { id: 'all', name: 'Todos os formularios' },
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

function findGpsTrack(data, gps) {
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

function formType(formularioId, data) {
  if (formularioId === 'form_cqo_carreamento_fruto_solto' || Array.isArray(data.linhas_carreamento)) {
    return 'carreamento';
  }
  return 'corte';
}

function statusLabel(status) {
  const normalized = normalizeText(status);
  if (normalized === 'sincronizado' || normalized === 'sync') return 'Sincronizado';
  if (normalized === 'pendente-validacao') return 'Pendente validacao';
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

export function normalizeResponse(row, headcount = []) {
  const data = parseJson(row.dados_json);
  const type = formType(row.formulario_id, data);
  const lines = type === 'carreamento'
    ? (Array.isArray(data.linhas_carreamento) ? data.linhas_carreamento : [])
    : (Array.isArray(data.linhas_corte) ? data.linhas_corte : []);
  const gps = findGps(data, type);
  const gpsTrack = findGpsTrack(data, gps);
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
    gps,
    gpsTrack,
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
    'select=matricula,nome,departamento,cargo,gestor,status,reference_date,updated_at&order=nome.asc&limit=3000'
  );
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

async function loadSupabaseData() {
  const [responseResult, headcount] = await Promise.all([
    fetchFirstAvailableTable(
      ['mobile_respostas', 'respostas'],
      'select=id,formulario_id,usuario_id,dados_json,status,criado_em,enviado_em,erro_msg,tentativas&order=criado_em.desc&limit=1000'
    ),
    fetchSupabaseTable(
      'headcount_colaboradores',
      'select=matricula,nome,cargo,departamento,gestor,status&status=eq.ATIVO&limit=2000'
    ),
  ]);

  return {
    records: responseResult.rows.map((row) => normalizeResponse(row, headcount)),
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

export function useCqoData() {
  const [state, setState] = useState({
    loading: true,
    records: [],
    headcount: [],
    source: 'Carregando',
    error: '',
  });

  useEffect(() => {
    let mounted = true;
    loadSupabaseData()
      .then((data) => {
        if (mounted) setState({ ...data, loading: false });
      })
      .catch((error) => {
        if (mounted) setState({ ...sampleData(error.message), loading: false });
      });

    return () => {
      mounted = false;
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
  if (periodFilter === 'season') return true;
  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (periodFilter === 'today') return created.toDateString() === now.toDateString();
  if (periodFilter === 'week') return diffDays <= 7;
  if (periodFilter === 'month') return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  return true;
}

export function filterRecords(records, { farmFilter = 'all', areaFilter = 'all', periodFilter = 'season', dateFrom = '', dateTo = '', searchTerm = '', statusFilter = 'all' } = {}) {
  const search = normalizeText(searchTerm);
  return records.filter((record) => {
    const farmOk = farmFilter === 'all' || record.farmId === farmFilter;
    const areaOk = areaFilter === 'all' || record.type === areaFilter;
    const statusOk = statusFilter === 'all' || normalizeText(record.status) === normalizeText(statusFilter);
    const periodOk = isWithinPeriod(record, periodFilter, dateFrom, dateTo);
    const haystack = normalizeText([
      record.id,
      record.farm,
      record.parcel,
      record.form,
      record.evaluator,
      record.evaluatorMatricula,
      record.fiscal,
    ].join(' '));
    const searchOk = !search || haystack.includes(search);
    return farmOk && areaOk && statusOk && periodOk && searchOk;
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
    if (record.status === 'Sincronizado') acc.sincronizados += 1;
    if (record.status === 'Pendente validacao') acc.pendentesValidacao += 1;
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
    sincronizados: 0,
    pendentesValidacao: 0,
    aprovados: 0,
    reprovados: 0,
    pendentes: 0,
    falhas: 0,
  });

  totals.syncRate = totals.total ? Math.round((totals.sincronizados / totals.total) * 100) : 0;
  totals.validationRate = totals.total ? Math.round(((totals.aprovados + totals.reprovados) / totals.total) * 100) : 0;
  totals.approvalRate = (totals.aprovados + totals.reprovados) ? Math.round((totals.aprovados / (totals.aprovados + totals.reprovados)) * 100) : 0;
  totals.gpsRate = totals.total ? Math.round((totals.gps / totals.total) * 100) : 0;
  totals.perdaCorteRate = totals.cachosObservados ? ((totals.cachoEsquecido / totals.cachosObservados) * 100).toFixed(1) : '0.0';
  totals.mediaPesoFrutos = totals.carreamento ? (totals.pesoMedio / totals.carreamento).toFixed(1) : '0.0';
  return totals;
}

export function buildCharts(records) {
  const byFarm = new Map();
  const byForm = new Map();
  const byEvaluator = new Map();
  const byDay = new Map();

  records.forEach((record) => {
    byFarm.set(record.farm, (byFarm.get(record.farm) || 0) + 1);
    byForm.set(record.form, (byForm.get(record.form) || 0) + 1);
    byEvaluator.set(record.evaluator, (byEvaluator.get(record.evaluator) || 0) + 1);
    byDay.set(record.date, (byDay.get(record.date) || 0) + 1);
  });

  const mapToChart = (map, fill = '#D98C10') => Array.from(map.entries())
    .map(([label, value]) => ({ label: label.length > 18 ? `${label.slice(0, 18)}...` : label, value, fill }))
    .sort((a, b) => b.value - a.value);

  const byDayData = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));

  if (byDayData.length === 1) {
    byDayData.unshift({ label: 'Anterior', value: 0 });
  }

  return {
    byFarm: mapToChart(byFarm, '#234F2A'),
    byForm: mapToChart(byForm, '#D98C10'),
    byEvaluator: mapToChart(byEvaluator, '#F2B544').slice(0, 8),
    byDay: byDayData,
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
