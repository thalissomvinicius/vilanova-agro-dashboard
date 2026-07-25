import { useEffect, useMemo, useState } from 'react';
import {
  callDashboardRpc,
  dashboardErrorMessage,
  getCqoSessionToken,
} from './cqoData';

export const FITOSSANIDADE_RHYNCHOPHORUS_FORM_ID = 'form_fitossanidade_rhynchophorus';

function parseObject(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function integer(value) {
  const parsed = Number.parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function normalizeStatus(value) {
  const key = String(value || 'pendente_validacao').trim().toLowerCase();
  const labels = {
    aprovado: 'Aprovado',
    sincronizado: 'Sincronizado',
    pendente_validacao: 'Pendente de validacao',
    reprovado: 'Reprovado',
    erro: 'Erro',
  };
  return { key, label: labels[key] || value || 'Pendente de validacao' };
}

function normalizeTrap(rawTrap, index) {
  const trap = parseObject(rawTrap);
  const males = integer(trap.machos);
  const females = integer(trap.femeas);
  const state = String(trap.situacao_armadilha || 'normal').trim();
  return {
    index: index + 1,
    location: String(trap.localizacao_armadilha || '').trim() || `Armadilha ${index + 1}`,
    pheromoneChanged: trap.troca_feromonio === true || trap.troca_feromonio === 'sim',
    males,
    females,
    total: males + females,
    state,
    stateLabel: state === 'outra'
      ? String(trap.situacao_outra || 'Outra').trim()
      : ({ normal: 'Normal', DN: 'Danificada', EX: 'Extraviada' }[state] || state),
  };
}

function normalizeRecord(rawRecord) {
  const data = parseObject(rawRecord?.dados_json);
  const traps = (Array.isArray(data.inspecoes_armadilhas) ? data.inspecoes_armadilhas : [])
    .map(normalizeTrap);
  const status = normalizeStatus(rawRecord?.status);
  return {
    id: String(rawRecord?.id || ''),
    formId: rawRecord?.formulario_id,
    formVersion: rawRecord?.formulario_versao,
    userId: String(rawRecord?.usuario_id || '').trim() || '-',
    responsibleId: String(data.matricula_responsavel || rawRecord?.usuario_id || '').trim() || '-',
    status: status.key,
    statusLabel: status.label,
    origin: String(rawRecord?.origem || 'app_android'),
    createdAt: rawRecord?.criado_em || rawRecord?.recebido_em || '',
    receivedAt: rawRecord?.recebido_em || '',
    date: String(data.data_inspecao || '').slice(0, 10),
    farm: String(data.nome_fazenda || '').trim() || 'Nao informado',
    traps,
    trapCount: traps.length,
    males: traps.reduce((sum, trap) => sum + trap.males, 0),
    females: traps.reduce((sum, trap) => sum + trap.females, 0),
    total: traps.reduce((sum, trap) => sum + trap.total, 0),
    pheromoneChanges: traps.filter((trap) => trap.pheromoneChanged).length,
    damaged: traps.filter((trap) => trap.state === 'DN').length,
    missing: traps.filter((trap) => trap.state === 'EX').length,
    raw: rawRecord,
  };
}

export function normalizeFitossanidadeRhynchophorusDataset(payload) {
  const body = Array.isArray(payload) ? payload[0] || {} : payload || {};
  return {
    records: (Array.isArray(body.records) ? body.records : []).map(normalizeRecord),
    generatedAt: body.generated_at || new Date().toISOString(),
  };
}

export function summarizeRhynchophorus(records) {
  return records.reduce((summary, record) => ({
    records: summary.records + 1,
    approved: summary.approved + (['aprovado', 'sincronizado'].includes(record.status) ? 1 : 0),
    traps: summary.traps + record.trapCount,
    males: summary.males + record.males,
    females: summary.females + record.females,
    total: summary.total + record.total,
    changes: summary.changes + record.pheromoneChanges,
    damaged: summary.damaged + record.damaged,
    missing: summary.missing + record.missing,
  }), {
    records: 0,
    approved: 0,
    traps: 0,
    males: 0,
    females: 0,
    total: 0,
    changes: 0,
    damaged: 0,
    missing: 0,
  });
}

export function useFitossanidadeRhynchophorus() {
  const [state, setState] = useState({ loading: true, records: [], generatedAt: '', error: '' });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const payload = await callDashboardRpc(
          'dashboard_fitossanidade_rhynchophorus_dataset',
          { p_session_token: getCqoSessionToken() },
          'carregar as armadilhas da Fitossanidade'
        );
        if (active) setState({ loading: false, error: '', ...normalizeFitossanidadeRhynchophorusDataset(payload) });
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: dashboardErrorMessage(error, 'Nao foi possivel carregar as armadilhas da Fitossanidade.'),
        }));
      }
    };
    load();
    return () => { active = false; };
  }, []);

  return state;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function exportRhynchophorusToExcel(records) {
  const bodyRows = records.flatMap((record) => record.traps.map((trap) => `
    <tr>
      <td>${escapeHtml(record.farm)}</td><td>${escapeHtml(trap.location)}</td>
      <td>${trap.pheromoneChanged ? 'NOVO' : ''}</td><td>${trap.males}</td>
      <td>${trap.females}</td><td>${trap.total}</td>
      <td>${trap.state === 'normal' ? '' : escapeHtml(trap.state === 'outra' ? trap.stateLabel : trap.state)}</td>
      <td>${escapeHtml(record.date)}</td><td>${escapeHtml(record.responsibleId)}</td>
      <td>${escapeHtml(record.id)}</td><td>${escapeHtml(record.statusLabel)}</td>
    </tr>`)).join('');
  const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body>
    <table border="1"><thead><tr>
      <th>FAZENDA</th><th>LOCALIZACAO/ARMADILHAS</th><th>TROCA DE FEROMONIO</th>
      <th>MACHO</th><th>FEMEA</th><th>TOTAL</th><th>ARMADILHA</th><th>DATA</th>
      <th>MAT.RESPONSAVEL</th><th>FICHA</th><th>STATUS</th>
    </tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rhynchophorus-fitossanidade-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useFilteredFitossanidadeRhynchophorus(records, filters) {
  return useMemo(() => {
    const query = String(filters.search || '').trim().toLocaleLowerCase('pt-BR');
    return records.filter((record) => {
      if (filters.dateFrom && record.date && record.date < filters.dateFrom) return false;
      if (filters.dateTo && record.date && record.date > filters.dateTo) return false;
      if (filters.farm !== 'all' && record.farm !== filters.farm) return false;
      if (filters.status !== 'all' && record.status !== filters.status) return false;
      if (!query) return true;
      return [record.id, record.farm, record.userId, record.responsibleId, ...record.traps.map((trap) => trap.location)]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(query);
    });
  }, [records, filters]);
}
