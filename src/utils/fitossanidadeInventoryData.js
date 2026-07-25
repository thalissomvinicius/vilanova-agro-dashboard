import { useEffect, useMemo, useState } from 'react';
import {
  callDashboardRpc,
  dashboardErrorMessage,
  getCqoSessionToken,
} from './cqoData';

export const FITOSSANIDADE_INVENTORY_FORM_ID = 'form_fitossanidade_inventario';

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

function normalizeLine(rawLine, index) {
  const line = parseObject(rawLine);
  const plants = integer(line.numero_plantas_linha);
  const gaps = integer(line.quantidade_falhas);
  const dead = integer(line.quantidade_mortas);
  return {
    street: integer(line.rua_index) || Math.floor(index / 2) + 1,
    side: integer(line.lado_linha) || (index % 2) + 1,
    lineNumber: String(line.linha ?? '').trim() || '-',
    plants,
    gaps,
    dead,
    productive: Math.max(plants - gaps - dead, 0),
  };
}

function normalizeRecord(rawRecord, attachmentsByResponse) {
  const data = parseObject(rawRecord?.dados_json);
  const lines = (Array.isArray(data.linhas_inventario) ? data.linhas_inventario : [])
    .map(normalizeLine);
  const plants = lines.reduce((sum, line) => sum + line.plants, 0);
  const gaps = lines.reduce((sum, line) => sum + line.gaps, 0);
  const dead = lines.reduce((sum, line) => sum + line.dead, 0);
  const status = normalizeStatus(rawRecord?.status);
  const recordId = String(rawRecord?.id || '');
  const recordAttachments = attachmentsByResponse.get(recordId) || [];

  return {
    id: recordId,
    formId: rawRecord?.formulario_id,
    formVersion: rawRecord?.formulario_versao,
    userId: String(rawRecord?.usuario_id || '').trim() || '-',
    status: status.key,
    statusLabel: status.label,
    origin: String(rawRecord?.origem || 'app_android'),
    createdAt: rawRecord?.criado_em || rawRecord?.recebido_em || '',
    receivedAt: rawRecord?.recebido_em || '',
    date: String(data.data_inventario || '').slice(0, 10),
    city: String(data.cidade || '').trim() || 'Nao informado',
    farm: String(data.nome_fazenda || '').trim() || 'Nao informado',
    parcel: String(data.parcela || '').trim() || 'Nao informado',
    plantingYear: String(data.ano_plantio || '').trim() || '-',
    observation: typeof data.observacao === 'object'
      ? String(data.observacao?.texto || '').trim()
      : String(data.observacao || '').trim(),
    lines,
    streets: new Set(lines.map((line) => line.street)).size,
    plants,
    gaps,
    dead,
    productive: Math.max(plants - gaps - dead, 0),
    gapsRate: plants > 0 ? (gaps / plants) * 100 : 0,
    deadRate: plants > 0 ? (dead / plants) * 100 : 0,
    attachments: recordAttachments,
    evidenceCount: recordAttachments.length,
    raw: rawRecord,
  };
}

export function normalizeFitossanidadeInventoryDataset(payload) {
  const body = Array.isArray(payload) ? payload[0] || {} : payload || {};
  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
  const attachmentsByResponse = new Map();
  rawAttachments.forEach((attachment) => {
    const responseId = String(attachment?.resposta_id || '');
    if (!responseId) return;
    const current = attachmentsByResponse.get(responseId) || [];
    current.push(attachment);
    attachmentsByResponse.set(responseId, current);
  });

  return {
    records: (Array.isArray(body.records) ? body.records : [])
      .map((record) => normalizeRecord(record, attachmentsByResponse)),
    generatedAt: body.generated_at || new Date().toISOString(),
  };
}

export function summarizeInventory(records) {
  return records.reduce((summary, record) => ({
    records: summary.records + 1,
    approved: summary.approved + (['aprovado', 'sincronizado'].includes(record.status) ? 1 : 0),
    streets: summary.streets + record.streets,
    lines: summary.lines + record.lines.length,
    plants: summary.plants + record.plants,
    gaps: summary.gaps + record.gaps,
    dead: summary.dead + record.dead,
    productive: summary.productive + record.productive,
    evidence: summary.evidence + record.evidenceCount,
  }), {
    records: 0,
    approved: 0,
    streets: 0,
    lines: 0,
    plants: 0,
    gaps: 0,
    dead: 0,
    productive: 0,
    evidence: 0,
  });
}

export function useFitossanidadeInventory() {
  const [state, setState] = useState({
    loading: true,
    records: [],
    generatedAt: '',
    error: '',
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const payload = await callDashboardRpc(
          'dashboard_fitossanidade_inventory_dataset',
          { p_session_token: getCqoSessionToken() },
          'carregar o inventario da Fitossanidade'
        );
        if (!active) return;
        setState({ loading: false, error: '', ...normalizeFitossanidadeInventoryDataset(payload) });
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: dashboardErrorMessage(error, 'Nao foi possivel carregar o inventario da Fitossanidade.'),
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

export function exportInventoryToExcel(records) {
  const rows = records.flatMap((record) => record.lines.map((line) => ({ record, line })));
  const bodyRows = rows.map(({ record, line }) => `
    <tr>
      <td>${escapeHtml(record.id)}</td><td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.city)}</td><td>${escapeHtml(record.farm)}</td>
      <td>${escapeHtml(record.parcel)}</td><td>${escapeHtml(record.plantingYear)}</td>
      <td>${escapeHtml(record.userId)}</td><td>${escapeHtml(record.statusLabel)}</td>
      <td>${line.street}</td><td>${line.side}</td><td>${escapeHtml(line.lineNumber)}</td>
      <td>${line.plants}</td><td>${line.gaps}</td><td>${line.dead}</td><td>${line.productive}</td>
      <td>${escapeHtml(record.observation)}</td><td>${record.evidenceCount}</td>
    </tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body>
    <table border="1"><thead><tr>
      <th>Ficha</th><th>Data</th><th>Cidade</th><th>Fazenda</th><th>Parcela</th>
      <th>Ano do plantio</th><th>Matricula</th><th>Status</th><th>Rua</th><th>Lado</th>
      <th>Linha</th><th>Plantas totais</th><th>Falhas</th><th>Mortas</th>
      <th>Plantas produtivas</th><th>Observacao</th><th>Evidencias</th>
    </tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventario-fitossanidade-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useFilteredFitossanidadeInventory(records, filters) {
  return useMemo(() => {
    const query = String(filters.search || '').trim().toLocaleLowerCase('pt-BR');
    return records.filter((record) => {
      if (filters.dateFrom && record.date && record.date < filters.dateFrom) return false;
      if (filters.dateTo && record.date && record.date > filters.dateTo) return false;
      if (filters.city !== 'all' && record.city !== filters.city) return false;
      if (filters.farm !== 'all' && record.farm !== filters.farm) return false;
      if (filters.status !== 'all' && record.status !== filters.status) return false;
      if (!query) return true;
      return [record.id, record.city, record.farm, record.parcel, record.plantingYear, record.userId]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(query);
    });
  }, [records, filters]);
}
