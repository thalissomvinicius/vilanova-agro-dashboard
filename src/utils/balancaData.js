import { useEffect, useState } from 'react';
import { callDashboardRpc, getCqoSessionToken } from './cqoData';
import { useBonificacaoData } from './bonificacaoData';
import {
  buildAgroBalanceSnapshot,
  fetchAgroDataset,
  fetchAgroResource,
  mergeAgroBalanceData,
  previousMonthStart,
} from './agroApiData';

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

function errorMessage(error, fallback) {
  const message = String(error?.message || error || '').trim();
  return message || fallback;
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

function scaleTicketKey(ticket) {
  return ticket?.sourceTicketId || ticket?.ticketCode || '';
}

function qualityLossKey(record) {
  return `${record?.ticketCode || ''}|${record?.measuredAt || record?.recordedAt || ''}`;
}

function qualityScaleKey(record) {
  return record?.ticketCode || `${record?.enteredAt || ''}|${record?.origin || ''}`;
}

const MONTHLY_WEIGHT_SCOPES = ['own', 'third_party', 'combined'];

async function fetchMonthlyWeightScopes({ sessionToken, signal }) {
  const settled = await Promise.allSettled(MONTHLY_WEIGHT_SCOPES.map(async (scope) => {
    const result = await fetchAgroResource('/api/agro/monthly-bunch-weights', {
      sessionToken,
      signal,
      params: { scope },
    });
    return {
      ...result,
      records: result.records.map((record) => ({ ...record, scope: record?.scope || scope })),
      scope,
    };
  }));
  const fulfilled = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  if (!fulfilled.length) {
    const firstFailure = settled.find((result) => result.status === 'rejected');
    throw firstFailure?.reason || new Error('Pesos médios mensais indisponíveis.');
  }

  const generatedAt = fulfilled
    .map((result) => result.generatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const failedScopes = settled.flatMap((result, index) => (
    result.status === 'rejected'
      ? [{
          scope: MONTHLY_WEIGHT_SCOPES[index],
          message: errorMessage(result.reason, 'Escopo indisponível.'),
        }]
      : []
  ));

  return {
    records: fulfilled.flatMap((result) => result.records),
    generatedAt,
    source: fulfilled[0]?.source || 'AGRO',
    meta: {
      generatedAt,
      requestedScopes: MONTHLY_WEIGHT_SCOPES,
      loadedScopes: fulfilled.map((result) => result.scope),
      failedScopes,
    },
  };
}

export function useBalancaData({ dateFrom = '', dateTo = '' } = {}) {
  const legacyData = useBonificacaoData();
  const requestKey = `${dateFrom}|${dateTo}`;
  const [state, setState] = useState({
    requestKey: '',
    data: null,
    loading: true,
    error: '',
    liveTickets: [],
    liveTicketsError: '',
    liveTicketsMeta: null,
    qualityLosses: [],
    qualityScaleTickets: [],
    agroIntegrationError: '',
    usingSqlProduction: false,
    usingOfficialProduction: false,
    usingOfficialMonthlyWeights: false,
    lossesReadiness: null,
  });

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const sessionToken = getCqoSessionToken();

    const common = {
      sessionToken,
      dateFrom,
      dateTo,
      signal: controller.signal,
    };
    const weightDateFrom = previousMonthStart(dateFrom || dateTo) || dateFrom;

    const load = async () => {
      const [
        snapshotResult,
        ticketsResult,
        monthlyWeightsResult,
        productionSummaryResult,
        readinessResult,
      ] = await Promise.allSettled([
        fetchBalancaSnapshot(),
        fetchAgroDataset('/api/agro/scale-tickets', {
          ...common,
          limit: 100,
          maxPages: 1,
          latestWindowOnly: true,
          keyForRecord: scaleTicketKey,
        }),
        fetchMonthlyWeightScopes(common),
        fetchAgroDataset('/api/agro/production-summary', {
          ...common,
        }),
        fetchAgroResource('/api/agro/losses-readiness', {
          sessionToken,
          signal: controller.signal,
          params: weightDateFrom ? { monthKey: weightDateFrom.slice(0, 7) } : {},
        }),
      ]);

      let qualityLossesResult = { status: 'fulfilled', value: { records: [] } };
      let qualityScaleResult = { status: 'fulfilled', value: { records: [] } };
      if (productionSummaryResult.status === 'rejected') {
        [qualityLossesResult, qualityScaleResult] = await Promise.allSettled([
          fetchAgroDataset('/api/agro/quality-losses', {
            ...common,
            keyForRecord: qualityLossKey,
          }),
          fetchAgroDataset('/api/agro/quality-scale-tickets', {
            ...common,
            keyForRecord: qualityScaleKey,
          }),
        ]);
      }

      if (!mounted) return;

      const snapshotData = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null;
      const qualityLosses = qualityLossesResult.status === 'fulfilled'
        ? qualityLossesResult.value.records
        : [];
      const qualityScaleTickets = qualityScaleResult.status === 'fulfilled'
        ? qualityScaleResult.value.records
        : [];
      const sqlData = buildAgroBalanceSnapshot({
        qualityScaleTickets,
        qualityLosses,
        monthlyBunchWeights: monthlyWeightsResult.status === 'fulfilled'
          ? monthlyWeightsResult.value.records
          : [],
        productionSummary: productionSummaryResult.status === 'fulfilled'
          ? productionSummaryResult.value.records
          : [],
        lossesReadiness: readinessResult.status === 'fulfilled'
          ? readinessResult.value.records
          : [],
        monthlyWeightsMeta: monthlyWeightsResult.status === 'fulfilled'
          ? { ...monthlyWeightsResult.value.meta, generatedAt: monthlyWeightsResult.value.generatedAt }
          : {},
        productionSummaryMeta: productionSummaryResult.status === 'fulfilled'
          ? { ...productionSummaryResult.value.meta, generatedAt: productionSummaryResult.value.generatedAt }
          : {},
        readinessMeta: readinessResult.status === 'fulfilled'
          ? { ...readinessResult.value.meta, generatedAt: readinessResult.value.generatedAt }
          : {},
        monthlyWeightsAuthoritative: monthlyWeightsResult.status === 'fulfilled',
        productionSummaryAuthoritative: productionSummaryResult.status === 'fulfilled',
        readinessAuthoritative: readinessResult.status === 'fulfilled',
        generatedAt: productionSummaryResult.status === 'fulfilled'
          ? productionSummaryResult.value.generatedAt
          : (qualityScaleResult.status === 'fulfilled' ? qualityScaleResult.value.generatedAt : null),
      });
      const data = mergeAgroBalanceData(sqlData, snapshotData);
      const integrationErrors = [
        monthlyWeightsResult.status === 'rejected'
          ? errorMessage(monthlyWeightsResult.reason, 'Pesos médios mensais indisponíveis.')
          : '',
        ...(monthlyWeightsResult.status === 'fulfilled'
          ? (monthlyWeightsResult.value.meta?.failedScopes || []).map(
              (failure) => `Peso ${failure.scope}: ${failure.message}`
            )
          : []),
        productionSummaryResult.status === 'rejected'
          ? errorMessage(productionSummaryResult.reason, 'Resumo oficial de produção indisponível.')
          : '',
        readinessResult.status === 'rejected'
          ? errorMessage(readinessResult.reason, 'Prontidão das perdas indisponível.')
          : '',
        qualityLossesResult.status === 'rejected'
          ? errorMessage(qualityLossesResult.reason, 'Análises de qualidade indisponíveis.')
          : '',
        qualityScaleResult.status === 'rejected'
          ? errorMessage(qualityScaleResult.reason, 'Pesagens de qualidade indisponíveis.')
          : '',
      ].filter(Boolean);

      setState({
        requestKey,
        data,
        loading: false,
        error: !data
          ? errorMessage(
              snapshotResult.status === 'rejected' ? snapshotResult.reason : null,
              'Base da balança indisponível.'
            )
          : '',
        liveTickets: ticketsResult.status === 'fulfilled' ? ticketsResult.value.records : [],
        liveTicketsError: ticketsResult.status === 'rejected'
          ? errorMessage(ticketsResult.reason, 'Tickets da balança indisponíveis.')
          : '',
        liveTicketsMeta: ticketsResult.status === 'fulfilled' ? ticketsResult.value : null,
        qualityLosses,
        qualityScaleTickets,
        agroIntegrationError: integrationErrors.join(' '),
        usingSqlProduction: sqlData.producao?.byMonth?.length > 0,
        usingOfficialProduction: productionSummaryResult.status === 'fulfilled',
        usingOfficialMonthlyWeights: monthlyWeightsResult.status === 'fulfilled',
        lossesReadiness: sqlData.readiness,
      });
    };

    load().catch((loadError) => {
      if (!mounted || loadError?.name === 'AbortError') return;
      setState((current) => ({
        ...current,
        requestKey,
        loading: false,
        error: errorMessage(loadError, 'Base da balança indisponível.'),
      }));
    });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [dateFrom, dateTo, requestKey]);

  return {
    data: state.data || legacyData,
    loading: state.loading || state.requestKey !== requestKey,
    error: state.error,
    liveTickets: state.liveTickets,
    liveTicketsError: state.liveTicketsError,
    liveTicketsMeta: state.liveTicketsMeta,
    qualityLosses: state.qualityLosses,
    qualityScaleTickets: state.qualityScaleTickets,
    agroIntegrationError: state.agroIntegrationError,
    usingSqlProduction: state.usingSqlProduction,
    usingOfficialProduction: state.usingOfficialProduction,
    usingOfficialMonthlyWeights: state.usingOfficialMonthlyWeights,
    lossesReadiness: state.lossesReadiness,
    usingLegacyFallback: !state.data,
  };
}
