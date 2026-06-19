import { useEffect, useState } from 'react';
import snapshot from '../data/bonificacaoSnapshot.json';
import { SUPABASE_CONFIG } from './cqoData';

export const BONIFICACAO_SOURCE = {
  workbook: 'Base Qualidade CFF.xlsx',
  workbookUpdatedAt: '2026-06-16',
  importTable: 'bonificacao_import_snapshots',
  importKey: 'bonificacao_qualidade_cff',
  files: [
    'Entrada de CFF',
    'CQO - Rampa',
    'Faturamento',
    'Tipo Fornecedor',
    'Preco Fornecedor',
  ],
  tables: ['f_Balanca', 'f_CQO', 'f_Faturamento'],
  workbookCounts: {
    entradaDeCff: 9422,
    cqoRampa: 9010,
    faturamento: 18521,
    tipoFornecedor: 165,
    precoFornecedor: 144,
  },
};

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasMeaningfulValues(points = [], key = 'value') {
  return points.some((point) => safeNumber(point?.[key]) > 0);
}

function fallbackData() {
  const counts = BONIFICACAO_SOURCE.workbookCounts;
  return {
    available: false,
    source: BONIFICACAO_SOURCE.workbook,
    sourceLabel: 'Base local indisponivel',
    sourceOrigin: 'excel',
    sourceTransport: 'local',
    sourceKind: 'excel-local',
    online: false,
    snapshotUpdatedAt: null,
    importedAt: null,
    ...BONIFICACAO_SOURCE,
    entradaDeCff: {
      totalRegistros: counts.entradaDeCff,
      totalPesoBrutoKg: 0,
      totalPesoLiquidoKg: 0,
      totalTaraKg: 0,
      totalCachos: 0,
      byMonth: [],
      byProduct: [],
    },
    cqoRampa: {
      totalRegistros: counts.cqoRampa,
      byMonth: [],
      byFarm: [],
    },
    faturamento: {
      totalRegistros: counts.faturamento,
      totalPesoLiquidoKg: 0,
      totalPesoBrutoKg: 0,
      totalTaraKg: 0,
      byMonth: [],
      byProduct: [],
    },
    fornecedores: {
      tipo: [],
      preco: [],
    },
    charts: {
      entradaPorMes: [],
      rampaPorMes: [],
      faturamentoPorMes: [],
      fornecedores: [],
    },
  };
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function fetchBonificacaoSnapshot() {
  const query = new URLSearchParams({
    select: 'snapshot_json,source_path,imported_at,updated_at',
    import_key: `eq.${BONIFICACAO_SOURCE.importKey}`,
    order: 'updated_at.desc',
    limit: '1',
  }).toString();

  const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${BONIFICACAO_SOURCE.importTable}?${query}`, {
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${BONIFICACAO_SOURCE.importTable}: HTTP ${response.status}`);
  }

  const rows = await response.json();
  const row = rows?.[0];
  if (!row?.snapshot_json) return null;

  return {
    snapshot: parseJson(row.snapshot_json),
    sourcePath: row.source_path,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSnapshot(rawSnapshot, metadata = {}) {
  const snapshot = parseJson(rawSnapshot);
  if (!snapshot || typeof snapshot !== 'object') {
    return fallbackData();
  }

  const entradaDeCff = snapshot.entradaDeCff || {};
  const cqoRampa = snapshot.cqoRampa || {};
  const faturamento = snapshot.faturamento || {};
  const fornecedores = snapshot.fornecedores || {};

  return {
    available: true,
    source: metadata.sourcePath || snapshot.sourcePath || BONIFICACAO_SOURCE.workbook,
    sourceLabel: metadata.online ? 'Excel / Supabase' : 'Excel / JSON local',
    sourceOrigin: 'excel',
    sourceTransport: metadata.online ? 'supabase' : 'local',
    sourceKind: metadata.online ? 'excel-supabase' : 'excel-local',
    online: Boolean(metadata.online),
    generatedAt: snapshot.generatedAt || metadata.importedAt || null,
    snapshotUpdatedAt: metadata.updatedAt || metadata.importedAt || snapshot.generatedAt || null,
    importedAt: metadata.importedAt || null,
    workbook: BONIFICACAO_SOURCE.workbook,
    workbookUpdatedAt: BONIFICACAO_SOURCE.workbookUpdatedAt,
    files: BONIFICACAO_SOURCE.files,
    tables: BONIFICACAO_SOURCE.tables,
    workbookCounts: BONIFICACAO_SOURCE.workbookCounts,
    entradaDeCff,
    cqoRampa,
    faturamento,
    fornecedores,
    charts: {
      entradaPorMes: hasMeaningfulValues(entradaDeCff.byMonth || [], 'pesoLiquidoKg')
        ? (entradaDeCff.byMonth || []).map((point) => ({
            label: point.monthLabel || '--',
            value: safeNumber(point.pesoLiquidoKg),
            fill: '#234F2A',
          }))
        : [],
      rampaPorMes: hasMeaningfulValues(cqoRampa.byMonth || [], 'tcaMedia')
        ? (cqoRampa.byMonth || []).map((point) => ({
            label: point.monthLabel || '--',
            value: safeNumber(point.tcaMedia),
            fill: '#D98C10',
          }))
        : [],
      faturamentoPorMes: hasMeaningfulValues(faturamento.byMonth || [], 'pesoLiquidoKg')
        ? (faturamento.byMonth || []).map((point) => ({
            label: point.monthLabel || '--',
            value: safeNumber(point.pesoLiquidoKg),
            fill: '#234F2A',
          }))
        : [],
      fornecedores: hasMeaningfulValues(fornecedores.preco || [], 'precoMedio')
        ? (fornecedores.preco || []).slice(0, 10).map((point) => ({
            label: point.fornecedor || '--',
            value: safeNumber(point.precoMedio),
            fill: '#B45309',
          }))
        : [],
    },
  };
}

export function useBonificacaoData() {
  const [state, setState] = useState(normalizeSnapshot(snapshot));

  useEffect(() => {
    let mounted = true;

    fetchBonificacaoSnapshot()
      .then((onlineSnapshot) => {
        if (!mounted) return null;
        if (onlineSnapshot?.snapshot) {
          setState(normalizeSnapshot(onlineSnapshot.snapshot, {
            online: true,
            sourcePath: onlineSnapshot.sourcePath,
            importedAt: onlineSnapshot.importedAt,
            updatedAt: onlineSnapshot.updatedAt,
          }));
          return null;
        }

        return fetch('/bonificacaoSnapshot.json')
          .then((response) => (response.ok ? response.json() : null))
          .then((json) => {
            if (mounted && json) {
              setState(normalizeSnapshot(json));
            }
          });
      })
      .catch(() => (
        fetch('/bonificacaoSnapshot.json')
          .then((response) => (response.ok ? response.json() : null))
          .then((json) => {
            if (mounted && json) {
              setState(normalizeSnapshot(json));
            } else if (mounted) {
              setState(fallbackData());
            }
          })
          .catch(() => {
            if (mounted) setState(fallbackData());
          })
      ));

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
