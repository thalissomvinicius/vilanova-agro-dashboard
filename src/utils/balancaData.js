import { useEffect, useState } from 'react';
import { callDashboardRpc, getCqoSessionToken } from './cqoData';
import { useBonificacaoData } from './bonificacaoData';

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function rpcScalarPayload(payload, functionName) {
  if (Array.isArray(payload)) {
    const first = payload[0] || null;
    return first?.[functionName] || first || {};
  }
  return payload?.[functionName] || payload || {};
}

export function normalizeBalancaSnapshot(rawSnapshot, metadata = {}) {
  const snapshot = parseJson(rawSnapshot);
  if (!snapshot || typeof snapshot !== 'object') return null;

  const pesoMedioCacho = snapshot.pesoMedioCacho || {};
  const producao = snapshot.producao || {};
  const entradaDeCff = snapshot.entradaDeCff || {};
  const cqoRampa = snapshot.cqoRampa || {};

  return {
    ...snapshot,
    available: true,
    online: true,
    source: metadata.sourcePath || snapshot.metadata?.sourceFiles?.join(', ') || 'Balança / Supabase',
    sourceLabel: 'Balança / Supabase',
    sourceOrigin: 'excel',
    sourceTransport: 'supabase',
    sourceKind: 'balanca-supabase',
    importedAt: metadata.importedAt || snapshot.metadata?.importedAt || null,
    snapshotUpdatedAt: metadata.updatedAt || metadata.importedAt || null,
    pesoMedioCacho,
    producao,
    entradaDeCff: {
      ...entradaDeCff,
      byMonth: entradaDeCff.byMonth || producao.byMonth || [],
    },
    cqoRampa: {
      ...cqoRampa,
      byFarm: cqoRampa.byFarm || producao.byFarm || [],
      byProducerDay: cqoRampa.byProducerDay || producao.byFarmDay || [],
      byFarmMonth: cqoRampa.byFarmMonth || producao.byFarmMonth || [],
    },
  };
}

export function normalizeScaleTicketPage(payload) {
  const tickets = Array.isArray(payload?.data) ? payload.data : [];
  return {
    tickets,
    page: payload?.page || { limit: tickets.length, nextCursor: null },
    generatedAt: payload?.meta?.generatedAt || null,
    source: payload?.meta?.source || 'AGRO',
  };
}

function liveTicketErrorMessage(error) {
  const message = String(error?.message || error || '').trim();
  if (message.includes('HTTP 401') || message.includes('HTTP 403')) {
    return 'Sua sessão expirou. Entre novamente para consultar os tickets da balança.';
  }
  return message || 'Tickets da balança indisponíveis.';
}

async function fetchBalancaSnapshot() {
  const sessionToken = getCqoSessionToken();
  if (!sessionToken) throw new Error('Sessão do dashboard não configurada para a balança.');

  const payload = await callDashboardRpc(
    'dashboard_balanca_snapshot',
    { p_session_token: sessionToken },
    'Leitura da balança'
  );
  const row = rpcScalarPayload(payload, 'dashboard_balanca_snapshot');
  if (!row?.snapshot_json) {
    throw new Error('Snapshot da balança ainda não publicado no Supabase.');
  }

  return normalizeBalancaSnapshot(row.snapshot_json, {
    sourcePath: row.source_path,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
  });
}

async function fetchLiveScaleTickets() {
  const sessionToken = getCqoSessionToken();
  if (!sessionToken) throw new Error('Sessão do dashboard não configurada para a balança.');

  const response = await fetch('/api/agro/scale-tickets?limit=100', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = String(payload?.error?.message || '').trim();
    } catch {
      // A mensagem HTTP abaixo continua suficiente quando o corpo não é JSON.
    }
    throw new Error(`Tickets da balança: HTTP ${response.status}${detail ? ` - ${detail}` : ''}`);
  }

  return normalizeScaleTicketPage(await response.json());
}

export function useBalancaData() {
  const legacyData = useBonificacaoData();
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: '',
    liveTickets: [],
    liveTicketsError: '',
    liveTicketsMeta: null,
  });

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([fetchBalancaSnapshot(), fetchLiveScaleTickets()])
      .then(([snapshotResult, ticketsResult]) => {
        if (!mounted) return;

        setState({
          data: snapshotResult.status === 'fulfilled' ? snapshotResult.value : null,
          loading: false,
          error: snapshotResult.status === 'rejected'
            ? (snapshotResult.reason instanceof Error
                ? snapshotResult.reason.message
                : 'Base da balança indisponível.')
            : '',
          liveTickets: ticketsResult.status === 'fulfilled' ? ticketsResult.value.tickets : [],
          liveTicketsError: ticketsResult.status === 'rejected'
            ? liveTicketErrorMessage(ticketsResult.reason)
            : '',
          liveTicketsMeta: ticketsResult.status === 'fulfilled' ? ticketsResult.value : null,
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  return {
    data: state.data || legacyData,
    loading: state.loading,
    error: state.error,
    liveTickets: state.liveTickets,
    liveTicketsError: state.liveTicketsError,
    liveTicketsMeta: state.liveTicketsMeta,
    usingLegacyFallback: !state.data,
  };
}
