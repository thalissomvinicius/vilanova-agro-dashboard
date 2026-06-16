import { useEffect, useState } from 'react';
import snapshot from '../data/bonificacaoSnapshot.json';

export const BONIFICACAO_SOURCE = {
  workbook: 'Base Qualidade CFF.xlsx',
  workbookUpdatedAt: '2026-06-16',
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

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return fallbackData();
  }

  const entradaDeCff = snapshot.entradaDeCff || {};
  const cqoRampa = snapshot.cqoRampa || {};
  const faturamento = snapshot.faturamento || {};
  const fornecedores = snapshot.fornecedores || {};

  return {
    available: true,
    source: snapshot.sourcePath || BONIFICACAO_SOURCE.workbook,
    generatedAt: snapshot.generatedAt || null,
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

    fetch('/bonificacaoSnapshot.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (mounted && json) {
          setState(normalizeSnapshot(json));
        }
      })
      .catch(() => {
        if (mounted) {
          setState(fallbackData());
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
