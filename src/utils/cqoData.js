import { useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
};

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
  ['cacho_mal_posicionado', 'CachoMalPosicionado'],
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
    base64: row?.base64 || row?.arquivo_base64 || row?.conteudo_base64 || row?.file_base64 || meta?.base64 || meta?.arquivo_base64 || null,
    url: row?.url || row?.public_url || row?.storage_url || row?.arquivo_url || row?.download_url || meta?.url || meta?.publicUrl || meta?.public_url || null,
    storagePath: row?.storage_path || row?.caminho || row?.path || row?.arquivo_path || row?.storagePath || meta?.storagePath || meta?.storage_path || meta?.path || null,
    bucket: row?.bucket || row?.bucket_id || row?.storage_bucket || meta?.bucket || meta?.bucket_id || meta?.storage_bucket || null,
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
  if (normalized === 'auditoria-fechada' || normalized === 'auditoria-encerrada') return 'Auditoria fechada';
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

export function normalizeResponse(row, headcount = [], gpsRows = [], attachmentRows = []) {
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
        if (newLine.folha_cortada_indevida === undefined) newLine.folha_cortada_indevida = line.FolhaCortada || line.folhaCortadaIndev || line.FolhaCortadaIndev;
        if (newLine.cacho_mal_posicionado === undefined) newLine.cacho_mal_posicionado = line.CachoMalPosicionado;
        if (newLine.cacho_estrela === undefined) newLine.cacho_estrela = line.CachoEstrela || line.cachos_estrela;
        if (newLine.cacho_brocado === undefined) newLine.cacho_brocado = line.CachoBrocado || line.cachos_brocados;
        if (newLine.cacho_avermelhado === undefined) newLine.cacho_avermelhado = line.CachoAvermelhado || line.cachos_avermelhados;
        
        // Carreamento
        if (newLine.cacho_nao_carreado === undefined) newLine.cacho_nao_carreado = line.CachoNaoCarreado || line.Cachonaocarreado;
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
  const dateTime = formatDateTime(data.data_avaliacao || row.criado_em);
  const matricula = data.matricula_avaliador || row.usuario_id || '';
  const collaborator = headcount.find((item) => String(item.matricula) === String(matricula));
  const acompanhamento = data.acompanhamento && typeof data.acompanhamento === 'object'
    ? data.acompanhamento
    : { teve: 'nao', matricula: '', nome: '' };
  const isExcelSource = Boolean(data.fonte_excel)
    || row.source === 'cqo_import_snapshots'
    || String(row.formulario_id || '').startsWith('excel_');
  const effectiveGps = isExcelSource ? null : (gps || gpsOccurrences[0] || gpsTrack[0] || null);
  const effectiveGpsTrack = isExcelSource ? [] : gpsTrack;
  const effectiveGpsOccurrences = isExcelSource ? [] : gpsOccurrences;

  const base = {
    id: row.id,
    type,
    form: type === 'carreamento' ? 'CQO Carreamento e Fruto Solto' : 'CQO Corte',
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
    farmId: normalizeText(data.nome_fazenda || 'sem-fazenda'),
    parcel: data.parcela || '--',
    cycle: data.ciclo_mes || '--',
    evaluatorMatricula: matricula,
    evaluator: collaborator?.nome || matricula || 'Sem avaliador',
    evaluatorRole: collaborator?.cargo || '',
    fiscal: formatPersonName(data.fiscal_resp) || '--',
    observation: data.observacao || '',
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

async function fetchSupabaseTable(table, query) {
  if (!SUPABASE_CONFIG.configured) {
    throw new Error('Supabase nao configurado no ambiente.');
  }

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
  const snapshot = await loadHeadcountSnapshotData();
  if (snapshot.rows.length) return snapshot.rows;

  return fetchLegacyHeadcountData();
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

async function loadHeadcountSnapshotData() {
  const query = new URLSearchParams({
    select: 'import_key,fonte,reference_month,source_file,source_sheet,total_rows,columns_json,rows_json,imported_at,updated_at',
    fonte: 'eq.headcount_agricola',
    order: 'reference_month.desc',
    limit: '1',
  }).toString();

  try {
    const snapshots = await fetchSupabaseTable('headcount_import_snapshots', query);
    const snapshot = snapshots[0];
    const rawRows = Array.isArray(snapshot?.rows_json) ? snapshot.rows_json : [];
    const rows = rawRows
      .map((row) => normalizeHeadcountSnapshotRow(row, snapshot))
      .filter((row) => row.matricula || row.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return { snapshot, rows };
  } catch {
    return { snapshot: null, rows: [] };
  }
}

async function fetchLegacyHeadcountData(query = 'select=matricula,nome,departamento,cargo,gestor,status,senha,reference_date,updated_at&order=nome.asc&limit=3000') {
  const rows = await fetchSupabaseTable('headcount_colaboradores', query);
  return rows.map((row) => ({
    ...row,
    source: 'headcount_colaboradores',
  }));
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
  return rowText(row, ['MatriculaAvaliadores', 'Matricula Avaliadores', 'MatriculaDigitador', 'Matrícula', 'Matricula']);
}

function cqoSnapshotFiscal(row) {
  return rowText(row, ['Fiscal Resp', 'FiscalResp', 'Fiscal', 'fiscal_resp']);
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
    linha_json: row,
  };
}

function buildCarreamentoSnapshotLine(row, index) {
  return {
    rua_index: rowText(row, ['rua_index', 'Rua', 'RuaIndex']) || String(index + 1),
    lado_linha: rowText(row, ['lado_linha', 'LadoLinha', 'Lado']),
    linha: rowText(row, ['linha', 'Linha']) || String(index + 1),
    numero_plantas_linha: rowNumber(row, ['NumeroPlantasLinha', 'numero_plantas_linha', 'NumeroPlantas']),
    numero_plantas_observadas: rowNumber(row, ['NumeroPlantasObservadas', 'numero_plantas_observadas', 'numero_na_linha']),
    cacho_mal_posicionado: rowNumber(row, ['cachoMalOosicionado', 'CachoMalPosicionado', 'cacho_mal_posicionado']),
    cacho_nao_carreado: rowNumber(row, ['CachoNaoCarreado', 'Cachonaocarreado', 'cacho_nao_carreado', 'CachoNaoCarriado']),
    peso_medio: rowNumber(row, ['PesoMedio', 'peso_medio']),
    linha_json: row,
  };
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
    const date = cqoSnapshotDate(first) || cqoSnapshotMonth(first) || snapshot?.imported_at || snapshot?.updated_at || new Date().toISOString();
    const lines = group.rows.map(({ row, index }) => (
      type === 'carreamento' ? buildCarreamentoSnapshotLine(row, index) : buildCorteSnapshotLine(row, index)
    ));
    const data = {
      nome_polo: rowText(first, ['NomePolo', 'Nome Polo', 'Polo']),
      nome_fazenda: cqoSnapshotFarm(first),
      parcela: cqoSnapshotParcel(first),
      parcela_original: rowText(first, ['parcela_original', 'Parcela', 'parcela']),
      data_avaliacao: date,
      ciclo_mes: cqoSnapshotCycle(first),
      matricula_avaliador: cqoSnapshotEvaluator(first),
      fiscal_resp: cqoSnapshotFiscal(first),
      observacao: rowText(first, ['Observacao', 'Observação', 'observacao']),
      mapeamento_legado: false,
      fonte_excel: {
        tabela: 'cqo_import_snapshots',
        import_key: snapshot?.import_key || '',
        source_file: snapshot?.source_file || '',
        source_path: snapshot?.source_path || '',
        file_last_write_time: snapshot?.file_last_write_time || '',
      },
    };

    if (type === 'carreamento') {
      data.ano_plantio = rowText(first, ['ano_plantio', 'AnoPlantio', 'Ano']);
      data.densidade = rowText(first, ['densidade', 'Densidade']);
      data.total_plantas_parcela = rowText(first, ['total_plantas_parcela', 'TotalPlantasParcela']);
      data.total_cachos_carreados = rowText(first, ['total_cachos_carreados', 'TotalCachosCarreados']);
      data.variedade = rowText(first, ['variedade', 'Variedade']);
      data.linhas_carreamento = lines;
    } else {
      data.linhas_corte = lines;
    }

    return {
      id: `excel-${type}-${group.index}`,
      formulario_id: type === 'carreamento' ? 'excel_cqo_carreamento' : 'excel_cqo_corte',
      formulario_versao: 'excel-snapshot',
      usuario_id: data.matricula_avaliador,
      status: 'aprovado',
      criado_em: date,
      enviado_em: date,
      recebido_em: snapshot?.imported_at || snapshot?.updated_at || date,
      dados_json: data,
      excel_rows: group.rows.map(({ row }) => row),
      source: 'cqo_import_snapshots',
    };
  });
}

async function loadCqoImportSnapshotRows() {
  const query = new URLSearchParams({
    select: 'import_key,fonte,source_file,source_path,file_last_write_time,corte_total_rows,carreamento_total_rows,corte_columns_json,carreamento_columns_json,corte_rows_json,carreamento_rows_json,imported_at,updated_at',
    import_key: 'eq.cqo_1_digitacao_cqo',
    limit: '1',
  }).toString();

  try {
    const snapshots = await fetchSupabaseTable('cqo_import_snapshots', query);
    const snapshot = snapshots[0];
    if (!snapshot) return { rows: [], snapshot: null };
    const corteRows = Array.isArray(snapshot.corte_rows_json) ? snapshot.corte_rows_json : [];
    const carreamentoRows = Array.isArray(snapshot.carreamento_rows_json) ? snapshot.carreamento_rows_json : [];
    return {
      snapshot,
      rows: [
        ...groupCqoSnapshotRows(corteRows, 'corte', snapshot),
        ...groupCqoSnapshotRows(carreamentoRows, 'carreamento', snapshot),
      ],
    };
  } catch {
    return { rows: [], snapshot: null };
  }
}

export async function updateResponseReviewStatus(responseId, status) {
  const statusMap = {
    aprovado: 'aprovado',
    aprovar: 'aprovado',
    reprovado: 'reprovado',
    reprovar: 'reprovado',
    'auditoria-fechada': 'auditoria_fechada',
    'fechar-auditoria': 'auditoria_fechada',
    'auditoria-encerrada': 'auditoria_fechada',
  };
  const normalizedStatus = statusMap[normalizeText(status)];
  if (!normalizedStatus) {
    throw new Error(`Status de auditoria inválido: ${status}`);
  }

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

function normalizeLoadOptions(options = {}) {
  const sourceFilter = options.sourceFilter || 'all';
  const appLimitValue = Number(options.appLimit ?? 1000);
  const appLimit = Number.isFinite(appLimitValue)
    ? Math.max(1, Math.min(1000, Math.round(appLimitValue)))
    : 1000;

  return {
    includeApp: options.includeApp ?? sourceFilter !== 'excel',
    includeExcel: options.includeExcel ?? sourceFilter !== 'app',
    includeHeadcount: options.includeHeadcount ?? true,
    includeGps: options.includeGps ?? sourceFilter !== 'excel',
    includeAttachments: options.includeAttachments ?? sourceFilter !== 'excel',
    includeForms: options.includeForms ?? true,
    appLimit,
  };
}

function loadOptionsKey(options) {
  return [
    options.includeApp ? 'app' : 'no-app',
    options.includeExcel ? 'excel' : 'no-excel',
    options.includeHeadcount ? 'headcount' : 'no-headcount',
    options.includeGps ? 'gps' : 'no-gps',
    options.includeAttachments ? 'attachments' : 'no-attachments',
    options.includeForms ? 'forms' : 'no-forms',
    `limit-${options.appLimit}`,
  ].join('|');
}

async function loadSupabaseData(options = {}) {
  const loadOptions = normalizeLoadOptions(options);
  const [
    responseResult,
    headcount,
    gpsRows,
    attachmentRows,
    formRows,
    cqoImport,
  ] = await Promise.all([
    loadOptions.includeApp
      ? fetchFirstAvailableTable(
        ['mobile_respostas', 'respostas'],
        `select=*&status=neq.excluido&order=criado_em.desc&limit=${loadOptions.appLimit}`
      )
      : Promise.resolve({ table: 'mobile_respostas', rows: [] }),
    loadOptions.includeHeadcount ? loadHeadcountData() : Promise.resolve([]),
    loadOptions.includeApp && loadOptions.includeGps
      ? fetchOptionalTable(
        'mobile_gps',
        'select=id,resposta_id,campo_id,latitude,longitude,precisao,altitude,capturado_em&order=capturado_em.asc&limit=10000'
      )
      : Promise.resolve([]),
    loadOptions.includeApp && loadOptions.includeAttachments
      ? fetchOptionalTable(
        'mobile_anexos',
        'select=*&limit=10000'
      )
      : Promise.resolve([]),
    loadOptions.includeForms
      ? fetchOptionalTable(
        'mobile_formularios',
        'select=*&limit=500'
      )
      : Promise.resolve([]),
    loadOptions.includeExcel
      ? loadCqoImportSnapshotRows()
      : Promise.resolve({ rows: [], snapshot: null }),
  ]);

  const gpsByResponse = gpsRows.reduce((acc, point) => {
    const key = point.resposta_id;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(point);
    return acc;
  }, {});

  const attachmentsByResponse = attachmentRows
    .map((row, index) => normalizeAttachment(row, index))
    .reduce((acc, attachment) => {
      const key = attachment.responseId;
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(attachment);
      return acc;
    }, {});

  const mobileRecords = responseResult.rows.map((row) => normalizeResponse(
      row,
      headcount,
      gpsByResponse[row.id] || [],
      attachmentsByResponse[row.id] || []
  ));
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
    formularios: formRows,
    anexos: attachmentRows,
    gpsRows,
    cqoImport: {
      snapshot: cqoImport.snapshot,
      records: excelRecords.length,
      corteRows: Number(cqoImport.snapshot?.corte_total_rows || 0),
      carreamentoRows: Number(cqoImport.snapshot?.carreamento_total_rows || 0),
    },
    source: loadOptions.includeExcel && loadOptions.includeApp
      ? `Supabase / ${responseResult.table}`
      : loadOptions.includeApp
        ? `Supabase / ${responseResult.table} (App)`
        : 'Supabase / cqo_import_snapshots (Excel)',
    error: '',
  };
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
    cqoImport: { snapshot: null, records: 0, corteRows: 0, carreamentoRows: 0 },
    source: 'Supabase indisponivel',
    error,
  };
}

const cachedDataByKey = new Map();
const activePromiseByKey = new Map();
const loadOptionsByKey = new Map();
const listeners = new Set();

function emptyCqoData(source = 'Carregando', error = '') {
  return {
    records: [],
    mobileRecords: [],
    excelRecords: [],
    headcount: [],
    formularios: [],
    anexos: [],
    gpsRows: [],
    cqoImport: { snapshot: null, records: 0, corteRows: 0, carreamentoRows: 0 },
    source,
    error,
  };
}

function notifyCqoListeners(key, state) {
  listeners.forEach((listener) => {
    if (listener.key === key) {
      listener.setState(state);
    }
  });
}

function startCqoLoad(key, options) {
  if (activePromiseByKey.has(key)) return activePromiseByKey.get(key);

  const promise = loadSupabaseData(options)
    .then((data) => {
      cachedDataByKey.set(key, data);
      activePromiseByKey.delete(key);
      notifyCqoListeners(key, { ...data, loading: false });
      return data;
    })
    .catch((error) => {
      activePromiseByKey.delete(key);
      const failedData = sampleData(error.message);
      cachedDataByKey.set(key, failedData);
      notifyCqoListeners(key, { ...failedData, loading: false });
      return failedData;
    });

  activePromiseByKey.set(key, promise);
  return promise;
}

export function clearCqoCache() {
  cachedDataByKey.clear();
  activePromiseByKey.clear();
}

export function refreshCqoData() {
  clearCqoCache();

  const activeKeys = Array.from(new Set(Array.from(listeners).map((listener) => listener.key)));
  const keysToRefresh = activeKeys.length ? activeKeys : [loadOptionsKey(normalizeLoadOptions())];

  keysToRefresh.forEach((key) => {
    notifyCqoListeners(key, {
      loading: true,
      ...emptyCqoData('Atualizando...'),
    });
  });

  return Promise.all(keysToRefresh.map((key) => (
    startCqoLoad(key, loadOptionsByKey.get(key) || normalizeLoadOptions())
  )));
}

export function useCqoData(options = {}) {
  const {
    sourceFilter,
    includeApp,
    includeExcel,
    includeHeadcount,
    includeGps,
    includeAttachments,
    includeForms,
    appLimit,
  } = options;

  const loadOptions = useMemo(() => normalizeLoadOptions({
    sourceFilter,
    includeApp,
    includeExcel,
    includeHeadcount,
    includeGps,
    includeAttachments,
    includeForms,
    appLimit,
  }), [
    sourceFilter,
    includeApp,
    includeExcel,
    includeHeadcount,
    includeGps,
    includeAttachments,
    includeForms,
    appLimit,
  ]);
  const cacheKey = useMemo(() => loadOptionsKey(loadOptions), [loadOptions]);

  const [state, setState] = useState(() => {
    const cachedData = cachedDataByKey.get(cacheKey);
    if (cachedData) {
      return {
        loading: false,
        ...cachedData,
      };
    }
    return {
      loading: true,
      ...emptyCqoData(),
    };
  });

  useEffect(() => {
    let active = true;
    const safeSetState = (nextState) => {
      if (active) setState(nextState);
    };
    loadOptionsByKey.set(cacheKey, loadOptions);
    const listener = { key: cacheKey, setState: safeSetState };
    listeners.add(listener);

    const cachedData = cachedDataByKey.get(cacheKey);
    queueMicrotask(() => {
      if (cachedData) {
        safeSetState({ loading: false, ...cachedData });
      } else {
        safeSetState({ loading: true, ...emptyCqoData() });
        startCqoLoad(cacheKey, loadOptions);
      }
    });

    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, [cacheKey, loadOptions]);

  return state;
}

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseRecordDateValue(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

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
    acc.cachoEsquecido += record.totals.cachoEsquecido || 0;
    acc.cachoVerde += record.totals.cachoVerde || 0;
    acc.cachoMaduro += record.totals.cachoMaduro || 0;
    acc.cachoPassado += record.totals.cachoPassado || 0;
    acc.cachoInfermo += record.totals.cachoInfermo || 0;
    acc.bucha += record.totals.bucha || 0;
    acc.cachoMalPosicionado += record.totals.cachoMalPosicionado || 0;
    acc.cachoNaoCarreado += record.totals.cachoNaoCarreado || 0;
    acc.pesoMedio += record.totals.pesoMedio || 0;
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
    linhas: 0,
    plantasObservadas: 0,
    cachosObservados: 0,
    cachoEsquecido: 0,
    cachoVerde: 0,
    cachoMaduro: 0,
    cachoPassado: 0,
    cachoInfermo: 0,
    bucha: 0,
    cachoMalPosicionado: 0,
    cachoNaoCarreado: 0,
    pesoMedio: 0,
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
  const data = useCqoData({ sourceFilter: filters?.sourceFilter });
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
