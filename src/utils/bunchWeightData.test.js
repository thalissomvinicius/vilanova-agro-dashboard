import { describe, expect, it } from 'vitest';
import {
  buildFieldBunchWeightSummary,
  buildRampBunchWeightSummary,
  parseBunchWeight,
  previousCompleteMonthKey,
} from './bunchWeightData';

function corteRecord(overrides = {}) {
  return {
    id: 'res-1',
    type: 'corte',
    source: 'app',
    status: 'Aprovado',
    date: '02/07/2026',
    time: '10:30',
    farm: 'VILA NOVA',
    parcel: 'D-09',
    evaluator: 'ROBERTO',
    evaluatorMatricula: '3102',
    lines: [],
    ...overrides,
  };
}

describe('pesos médios de cachos', () => {
  it('normaliza pesos decimais sem aceitar valores vazios ou negativos', () => {
    expect(parseBunchWeight('19,75 kg')).toBe(19.75);
    expect(parseBunchWeight('20.5')).toBe(20.5);
    expect(parseBunchWeight('')).toBe(0);
    expect(parseBunchWeight('-4')).toBe(0);
  });

  it('calcula o campo somente com pesos individuais de cacho maduro aprovados', () => {
    const result = buildFieldBunchWeightSummary([
      corteRecord({
        id: 'res-a',
        lines: [
          {
            _pesagens_cachos: {
              cacho_maduro: ['10', '20'],
              cacho_avermelhado: ['99'],
              cacho_infermo: ['88'],
            },
          },
        ],
      }),
      corteRecord({
        id: 'res-b',
        parcel: 'D-10',
        lines: [{ _pesagens_cachos: { cacho_maduro: ['30'] } }],
      }),
      corteRecord({
        id: 'res-pendente',
        status: 'Pendente validação',
        lines: [{ _pesagens_cachos: { cacho_maduro: ['100'] } }],
      }),
      corteRecord({
        id: 'res-excel',
        source: 'excel',
        lines: [{ _pesagens_cachos: { cacho_maduro: ['100'] } }],
      }),
    ]);

    expect(result.collectionCount).toBe(2);
    expect(result.weightCount).toBe(3);
    expect(result.totalWeightKg).toBe(60);
    expect(result.averageKg).toBe(20);
    expect(result.medianKg).toBe(20);
    expect(result.minKg).toBe(10);
    expect(result.maxKg).toBe(30);
    expect(result.recordCount).toBe(2);
    expect(result.farmCount).toBe(1);
    expect(result.parcelCount).toBe(2);
  });

  it('separa a fila pendente e calcula cobertura sem contaminar a base oficial', () => {
    const records = [
      corteRecord({
        id: 'res-aprovado',
        lines: [{
          cacho_maduro: '4',
          _pesagens_cachos: { cacho_maduro: ['10', '20'] },
        }],
      }),
      corteRecord({
        id: 'res-pendente',
        status: 'Pendente validação',
        farm: 'FÉ EM DEUS',
        parcel: 'F-18',
        lines: [{
          cacho_maduro: '5',
          _pesagens_cachos: { cacho_maduro: ['18', '22', '20'] },
        }],
      }),
      corteRecord({
        id: 'res-pendente-sem-peso',
        status: 'pendente_validacao',
        farm: 'FÉ EM DEUS',
        parcel: 'F-19',
        lines: [{ cacho_maduro: '2' }],
      }),
    ];

    const approved = buildFieldBunchWeightSummary(records);
    const pending = buildFieldBunchWeightSummary(records, {
      approvalStatus: 'pending',
    });

    expect(approved.weightCount).toBe(2);
    expect(approved.averageKg).toBe(15);
    expect(approved.coveragePercent).toBe(50);
    expect(pending.recordCount).toBe(2);
    expect(pending.collectionCount).toBe(1);
    expect(pending.withoutWeightsCount).toBe(1);
    expect(pending.weightCount).toBe(3);
    expect(pending.totalWeightKg).toBe(60);
    expect(pending.averageKg).toBe(20);
    expect(pending.declaredMatureCount).toBe(7);
    expect(pending.coveragePercent).toBeCloseTo(42.857, 2);
  });

  it('usa o mês anterior completo relativo ao período operacional', () => {
    const now = new Date('2026-07-28T12:00:00Z');

    expect(previousCompleteMonthKey({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      now,
    })).toBe('2026-06');
    expect(previousCompleteMonthKey({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      now,
    })).toBe('2026-04');
    expect(previousCompleteMonthKey({
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      now,
    })).toBe('2026-06');
  });

  it('expõe a média oficial da rampa e mantém competência não homologada indisponível', () => {
    const available = buildRampBunchWeightSummary({
      pesoMedioCacho: {
        byMonth: [{
          monthKey: '2026-06',
          averageBunchKg: 18.5,
          pesoLiquidoKg: 185_000,
          cachos: 10_000,
          status: 'available',
        }],
        competencies: [],
      },
    }, {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      now: new Date('2026-07-28T12:00:00Z'),
    });

    expect(available.available).toBe(true);
    expect(available.monthKey).toBe('2026-06');
    expect(available.averageKg).toBe(18.5);
    expect(available.bunchCount).toBe(10_000);

    const unavailable = buildRampBunchWeightSummary({
      pesoMedioCacho: {
        byMonth: [],
        competencies: [{
          monthKey: '2026-06',
          status: 'unavailable',
          reason: 'Fechamento mensal pendente.',
        }],
      },
    }, {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      now: new Date('2026-07-28T12:00:00Z'),
    });

    expect(unavailable.available).toBe(false);
    expect(unavailable.reason).toBe('Fechamento mensal pendente.');
  });

  it('expõe próprio, terceiros e consolidado sem misturar a base oficial das perdas', () => {
    const result = buildRampBunchWeightSummary({
      pesoMedioCacho: {
        byMonth: [],
        byScope: {
          own: [{
            monthKey: '2026-06',
            averageBunchKg: 11.44,
            pesoLiquidoKg: 1_519_040,
            cachos: 132_775,
            totalTickets: 988,
            includedTickets: 108,
            excludedTickets: 880,
            excludedNetWeightKg: 16_686_221,
            coveragePercent: 10.93,
          }],
          third_party: [],
          combined: [{
            monthKey: '2026-06',
            averageBunchKg: 11.44,
            pesoLiquidoKg: 1_519_040,
            cachos: 132_775,
          }],
        },
        competencies: [{
          monthKey: '2026-06',
          scope: 'third_party',
          status: 'unavailable',
          reason: 'Sem tickets de terceiros.',
        }],
      },
    }, {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      now: new Date('2026-07-29T12:00:00Z'),
    });

    expect(result.averageKg).toBe(11.44);
    expect(result.scope).toBe('own');
    expect(result.totalTickets).toBe(988);
    expect(result.includedTickets).toBe(108);
    expect(result.coveragePercent).toBe(10.93);
    expect(result.scopes.combined.averageKg).toBe(11.44);
    expect(result.scopes.third_party.available).toBe(false);
    expect(result.scopes.third_party.reason).toBe('Sem tickets de terceiros.');
  });
});
