import { describe, expect, it } from 'vitest';
import { normalizeBalancaSnapshot, normalizeScaleTicketPage } from './balancaData';

describe('normalizeBalancaSnapshot', () => {
  it('mantem pesos e producao separados e cria compatibilidade com o painel', () => {
    const data = normalizeBalancaSnapshot({
      pesoMedioCacho: {
        byMonth: [{ monthKey: '2026-06', averageBunchKg: 12.4 }],
      },
      producao: {
        byMonth: [{ monthKey: '2026-07', pesoLiquidoKg: 800000 }],
        byFarm: [{ fazenda: 'VILA NOVA', pesoT: 800 }],
      },
    }, { sourcePath: '2026.XLS' });

    expect(data.sourceKind).toBe('balanca-supabase');
    expect(data.pesoMedioCacho.byMonth[0].averageBunchKg).toBe(12.4);
    expect(data.entradaDeCff.byMonth[0].pesoLiquidoKg).toBe(800000);
    expect(data.cqoRampa.byFarm[0].fazenda).toBe('VILA NOVA');
  });

  it('normaliza os tickets retornados pela API AGRO', () => {
    const result = normalizeScaleTicketPage({
      data: [
        {
          ticketCode: '12345',
          netWeightKg: 21480,
          items: [{ product: 'CFF', origin: 'Fazenda Vila Nova' }],
        },
      ],
      page: { limit: 100, nextCursor: null },
      meta: { source: 'AGRO', generatedAt: '2026-07-24T12:00:00.000Z' },
    });

    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].ticketCode).toBe('12345');
    expect(result.source).toBe('AGRO');
    expect(result.generatedAt).toBe('2026-07-24T12:00:00.000Z');
  });
});
