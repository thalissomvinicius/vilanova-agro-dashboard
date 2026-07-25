import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAgroBalanceSnapshot,
  buildAgroDateWindows,
  fetchAgroDataset,
  mergeAgroBalanceData,
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
