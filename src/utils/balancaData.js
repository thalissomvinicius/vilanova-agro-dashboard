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

export function useBalancaData() {
  const legacyData = useBonificacaoData();
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  useEffect(() => {
    let mounted = true;

    fetchBalancaSnapshot()
      .then((data) => {
        if (mounted) setState({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (mounted) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Base da balança indisponível.',
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return {
    data: state.data || legacyData,
    loading: state.loading,
    error: state.error,
    usingLegacyFallback: !state.data,
  };
}
