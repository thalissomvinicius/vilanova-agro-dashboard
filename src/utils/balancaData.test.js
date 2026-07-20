import { describe, expect, it } from 'vitest';
import { normalizeBalancaSnapshot } from './balancaData';

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
});
