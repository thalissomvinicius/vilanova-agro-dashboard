import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAgroBalanceSnapshot,
  buildAgroDateWindows,
  fetchAgroDataset,
  fetchAgroResource,
  mergeAgroBalanceData,
  normalizeMonthlyBunchWeights,
  normalizeProductionSummary,
  previousMonthStart,
} from './agroApiData';
import { buildQualidadeOperacional } from './qualidadeOperacionalData';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildAgroDateWindows', () => {
  it('divide períodos longos em consultas de no máximo 90 dias', () => {
    const windows = buildAgroDateWindows('2026-01-01', '2026-06-30');

    expect(windows).toHaveLength(3);
    windows.forEach((window) => {
      expect(Date.parse(window.to) - Date.parse(window.from))
        .toBeLessThanOrEqual(90 * 24 * 60 * 60 * 1000);
    });
    expect(windows.at(-1).to).toBe('2026-07-01T00:00:00.000Z');
  });

  it('mantém a consulta padrão da API quando não há data', () => {
    expect(buildAgroDateWindows('', '')).toEqual([{}]);
  });

  it('inclui o início do mês anterior para buscar o peso aplicável', () => {
    expect(previousMonthStart('2026-07-15')).toBe('2026-06-01');
    expect(previousMonthStart('2026-01-01')).toBe('2025-12-01');
  });
});

describe('fetchAgroDataset', () => {
  it('percorre cursores e remove registros repetidos', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ ticketCode: '1' }, { ticketCode: '2' }],
          page: { nextCursor: 'cursor_2' },
          meta: { source: 'AGRO', generatedAt: '2026-07-01T10:00:00.000Z' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ ticketCode: '2' }, { ticketCode: '3' }],
          page: { nextCursor: null },
          meta: { source: 'AGRO', generatedAt: '2026-07-01T10:01:00.000Z' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAgroDataset('/api/agro/quality-scale-tickets', {
      sessionToken: 'a'.repeat(32),
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      keyForRecord: (record) => record.ticketCode,
    });

    expect(result.records.map((record) => record.ticketCode)).toEqual(['1', '2', '3']);
    expect(result.pageCount).toBe(2);
    expect(result.generatedAt).toBe('2026-07-01T10:01:00.000Z');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('cursor=cursor_2');
  });

  it('preserva objetos de prontidão e metadados do contrato', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          status: 'unavailable',
          reason: 'Fechamento mensal não homologado.',
        },
        page: { nextCursor: null },
        meta: { source: 'AGRO', generatedAt: '2026-07-27T10:00:00.000Z', version: '1.1.0' },
      }),
    }));

    const result = await fetchAgroDataset('/api/agro/losses-readiness', {
      sessionToken: 'a'.repeat(32),
      dateFrom: '2026-06-01',
      dateTo: '2026-07-31',
    });

    expect(result.records).toEqual([
      expect.objectContaining({ status: 'unavailable' }),
    ]);
    expect(result.meta.version).toBe('1.1.0');
  });
});

describe('fetchAgroResource', () => {
  it('consulta recursos mensais sem injetar período, limite ou paginação', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          monthKey: '2026-06',
          scope: 'own',
          status: 'available',
          averageBunchWeightKg: 11.44,
        },
        meta: {
          source: 'AGRO_API_CLOUDFLARE',
          generatedAt: '2026-07-29T10:00:00.000Z',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAgroResource('/api/agro/monthly-bunch-weights', {
      sessionToken: 'a'.repeat(32),
      params: { scope: 'own' },
    });

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]), 'https://dashboard.local');
    expect(requestUrl.searchParams.get('scope')).toBe('own');
    expect(requestUrl.searchParams.has('from')).toBe(false);
    expect(requestUrl.searchParams.has('to')).toBe(false);
    expect(requestUrl.searchParams.has('limit')).toBe(false);
    expect(result.records).toEqual([
      expect.objectContaining({ monthKey: '2026-06', averageBunchWeightKg: 11.44 }),
    ]);
    expect(result.source).toBe('AGRO_API_CLOUDFLARE');
  });
});

describe('contratos oficiais de perdas', () => {
  it('aceita somente pesos mensais oficiais e mantém os bloqueados para auditoria', () => {
    const result = normalizeMonthlyBunchWeights([
      {
        monthKey: '2026-05',
        status: 'available',
        averageBunchWeightKg: 18.4,
        officialBunchCount: 1200,
      },
      {
        monthKey: '2026-06',
        status: 'unavailable',
        averageBunchWeightKg: 20,
        reason: 'Competência sem fechamento homologado.',
      },
    ]);

    expect(result.byMonth).toEqual([
      expect.objectContaining({ monthKey: '2026-05', averageBunchKg: 18.4 }),
    ]);
    expect(result.competencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        monthKey: '2026-06',
        available: false,
        reason: 'Competência sem fechamento homologado.',
      }),
    ]));
  });

  it('separa os pesos por origem e preserva a auditoria de cobertura da API 1.3', () => {
    const result = normalizeMonthlyBunchWeights([
      {
        monthKey: '2026-06',
        scope: 'own',
        status: 'available',
        netWeightKg: 1_519_040,
        bunchCount: 132_775,
        averageBunchWeightKg: 11.44,
        totalTickets: 988,
        includedTickets: 108,
        excludedTickets: 880,
        coveragePercent: 10.93,
        excludedNetWeightKg: 16_686_221,
      },
      {
        monthKey: '2026-06',
        scope: 'third_party',
        status: 'unavailable',
        reason: 'Sem tickets de terceiros.',
      },
      {
        monthKey: '2026-06',
        scope: 'combined',
        status: 'available',
        netWeightKg: 1_519_040,
        bunchCount: 132_775,
        averageBunchWeightKg: 11.44,
      },
    ]);

    expect(result.byMonth).toEqual([
      expect.objectContaining({
        scope: 'own',
        averageBunchKg: 11.44,
        totalTickets: 988,
        includedTickets: 108,
        excludedTickets: 880,
        coveragePercent: 10.93,
      }),
    ]);
    expect(result.byScope.combined).toEqual([
      expect.objectContaining({ scope: 'combined', averageBunchKg: 11.44 }),
    ]);
    expect(result.byScope.third_party).toEqual([]);
    expect(result.competencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'third_party',
        available: false,
        reason: 'Sem tickets de terceiros.',
      }),
    ]));
  });

  it('interpreta o contrato aninhado da API 1.3 sem usar pesos excluídos', () => {
    const result = normalizeMonthlyBunchWeights([
      {
        scope: 'own',
        data: {
          months: [{
            monthKey: '2026-06',
            status: 'available',
            official: true,
            included: {
              netWeightKg: 1_519_040,
              bunchCount: 132_775,
              ticketCount: 108,
            },
            excluded: {
              netWeightKg: 16_686_221,
              ticketCount: 880,
              reasons: [{ code: 'zero_bunches', count: 880 }],
            },
            coverage: {
              totalTickets: 988,
              includedTickets: 108,
              excludedTickets: 880,
              percent: 10.93,
            },
            calculation: {
              method: 'SUM(VL_PESO_LIQUIDO) / SUM(CACHOS)',
              averageBunchWeightKg: 11.44,
            },
          }],
        },
      },
      {
        scope: 'third_party',
        data: {
          months: [{
            monthKey: '2026-06',
            status: 'unavailable',
            reason: 'Sem tickets de terceiros.',
          }],
        },
      },
      {
        scope: 'combined',
        data: {
          months: [{
            monthKey: '2026-06',
            availability: 'available',
            included: {
              netWeightKg: 1_519_040,
              bunchCount: 132_775,
            },
          }],
        },
      },
    ]);

    expect(result.byScope.own).toEqual([
      expect.objectContaining({
        monthKey: '2026-06',
        scope: 'own',
        averageBunchKg: 11.44,
        pesoLiquidoKg: 1_519_040,
        cachos: 132_775,
        totalTickets: 988,
        includedTickets: 108,
        excludedTickets: 880,
        excludedNetWeightKg: 16_686_221,
        coveragePercent: 10.93,
      }),
    ]);
    expect(result.byScope.own[0].pesoLiquidoKg).not.toBe(16_686_221);
    expect(result.byScope.combined).toEqual([
      expect.objectContaining({
        monthKey: '2026-06',
        scope: 'combined',
        averageBunchKg: expect.closeTo(11.44, 2),
      }),
    ]);
    expect(result.competencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        monthKey: '2026-06',
        scope: 'third_party',
        available: false,
        reason: 'Sem tickets de terceiros.',
      }),
    ]));
  });

  it('normaliza produção por mês e fazenda sem somar resumo e parcelas duas vezes', () => {
    const result = normalizeProductionSummary([
      { monthKey: '2026-06', netWeightKg: 35_000 },
      { monthKey: '2026-06', farmName: 'VILA NOVA', netWeightKg: 20_000 },
      { monthKey: '2026-06', farmName: 'FÉ EM DEUS', netWeightKg: 15_000 },
      { monthKey: '2026-06', farmName: 'VILA NOVA', parcelName: 'D-09', netWeightKg: 20_000 },
    ]);

    expect(result.byMonth).toEqual([
      expect.objectContaining({ monthKey: '2026-06', pesoLiquidoKg: 35_000 }),
    ]);
    expect(result.byFarmMonth).toEqual(expect.arrayContaining([
      expect.objectContaining({ fazenda: 'VILA NOVA', pesoLiquidoKg: 20_000 }),
      expect.objectContaining({ fazenda: 'FÉ EM DEUS', pesoLiquidoKg: 15_000 }),
    ]));
  });
});

describe('buildAgroBalanceSnapshot', () => {
  it('consolida produção SQL por mês e fazenda sem duplicar ticket', () => {
    const data = buildAgroBalanceSnapshot({
      qualityLosses: [
        { ticketCode: '10', farmName: 'VILA NOVA', measuredAt: '2026-06-10T10:00:00Z' },
      ],
      qualityScaleTickets: [
        { ticketCode: '10', enteredAt: '2026-06-10T09:00:00Z', netWeightKg: 20_000 },
        { ticketCode: '10', enteredAt: '2026-06-10T09:00:00Z', netWeightKg: 20_000 },
        { ticketCode: '11', enteredAt: '2026-06-11T09:00:00Z', netWeightKg: 15_000, origin: 'FAZENDA FÉ EM DEUS' },
      ],
      generatedAt: '2026-07-01T12:00:00Z',
    });

    expect(data.available).toBe(true);
    expect(data.producao.byMonth[0].pesoLiquidoKg).toBe(35_000);
    expect(data.producao.byFarm).toEqual(expect.arrayContaining([
      expect.objectContaining({ fazenda: 'VILA NOVA', pesoLiquidoKg: 20_000 }),
      expect.objectContaining({ fazenda: 'FÉ EM DEUS', pesoLiquidoKg: 15_000 }),
    ]));
    expect(data.pesoMedioCacho.byMonth).toEqual([]);
  });

  it('preserva o peso homologado do snapshot e prioriza a produção SQL', () => {
    const merged = mergeAgroBalanceData({
      available: true,
      sourceKind: 'balanca-agro-api',
      producao: { byMonth: [{ monthKey: '2026-06', pesoT: 35 }] },
      pesoMedioCacho: { byMonth: [] },
      metadata: { ticketCount: 2 },
    }, {
      sourceKind: 'balanca-supabase',
      producao: { byMonth: [{ monthKey: '2025-01', pesoT: 1 }] },
      pesoMedioCacho: { byMonth: [{ monthKey: '2026-05', averageBunchKg: 18 }] },
    });

    expect(merged.sourceKind).toBe('balanca-agro-api');
    expect(merged.producao.byMonth[0].pesoT).toBe(35);
    expect(merged.pesoMedioCacho.byMonth[0].averageBunchKg).toBe(18);
  });

  it('não recupera peso legado quando o contrato oficial declara indisponibilidade', () => {
    const sqlData = buildAgroBalanceSnapshot({
      monthlyBunchWeights: [{
        monthKey: '2026-06',
        status: 'unavailable',
        averageBunchWeightKg: 20,
        reason: 'Sem aprovação mensal.',
      }],
      productionSummary: [{
        monthKey: '2026-07',
        farmName: 'VILA NOVA',
        netWeightKg: 500_000,
      }],
      lossesReadiness: [{
        status: 'unavailable',
        reason: 'Sem aprovação mensal.',
      }],
      monthlyWeightsAuthoritative: true,
      productionSummaryAuthoritative: true,
      readinessAuthoritative: true,
    });
    const merged = mergeAgroBalanceData(sqlData, {
      pesoMedioCacho: {
        byMonth: [{ monthKey: '2026-06', averageBunchKg: 20 }],
      },
    });

    expect(merged.pesoMedioCacho.byMonth).toEqual([]);
    expect(merged.metadata.weightSource).toBe('API AGRO: indisponível');
    expect(merged.producao.byMonth[0].pesoLiquidoKg).toBe(500_000);
  });

  it('mantém o peso indisponível quando somente a prontidão oficial respondeu', () => {
    const sqlData = buildAgroBalanceSnapshot({
      productionSummary: [{
        monthKey: '2026-07',
        farmName: 'VILA NOVA',
        netWeightKg: 500_000,
      }],
      lossesReadiness: [{
        status: 'unavailable',
        reason: 'Fonte mensal ainda não homologada.',
      }],
      monthlyWeightsAuthoritative: false,
      productionSummaryAuthoritative: true,
      readinessAuthoritative: true,
    });
    const merged = mergeAgroBalanceData(sqlData, {
      pesoMedioCacho: {
        byMonth: [{ monthKey: '2026-06', averageBunchKg: 20 }],
      },
    });

    expect(merged.pesoMedioCacho.byMonth).toEqual([]);
    expect(merged.metadata.weightSource).toBe('API AGRO: indisponível');
    expect(merged.readiness.reason).toBe('Fonte mensal ainda não homologada.');
  });

  it('alimenta o cálculo de perdas com a produção SQL sem inventar peso médio', () => {
    const sqlData = buildAgroBalanceSnapshot({
      qualityLosses: [
        { ticketCode: '10', farmName: 'VILA NOVA', measuredAt: '2026-06-10T10:00:00Z' },
      ],
      qualityScaleTickets: [
        { ticketCode: '10', enteredAt: '2026-06-10T09:00:00Z', netWeightKg: 500_000 },
      ],
    });
    const record = {
      id: 'corte-junho-sql',
      farmId: 'vila-nova',
      farm: 'Vila Nova',
      parcel: 'D-09',
      type: 'corte',
      form: 'CQO Corte',
      source: 'app',
      status: 'Aprovado',
      date: '2026-06-15',
      raw: {
        data_avaliacao: '2026-06-15',
        total_plantas_parcela: 1000,
      },
      lines: [],
      totals: {
        linhas: 2,
        plantasObservadas: 100,
        cachosObservados: 100,
        cachoEsquecido: 3,
        cachoNaoCarreado: 0,
      },
    };

    const model = buildQualidadeOperacional([record], sqlData);

    expect(model.totals.producedTon).toBeCloseTo(500);
    expect(model.totals.corteT).toBe(0);
    expect(model.balance.averageWeightKg).toBe(0);
    expect(model.lossRates.cortePct).toBe(0);
  });
});
