import { describe, expect, it } from 'vitest';
import {
  normalizeFitossanidadeRhynchophorusDataset,
  summarizeRhynchophorus,
} from './fitossanidadeRhynchophorusData';

describe('fitossanidadeRhynchophorusData', () => {
  it('recalcula o total por linha e ignora total divergente recebido', () => {
    const dataset = normalizeFitossanidadeRhynchophorusDataset({
      records: [{
        id: 'res-1',
        formulario_id: 'form_fitossanidade_rhynchophorus',
        usuario_id: '2170',
        status: 'aprovado',
        dados_json: {
          nome_fazenda: 'FAZ. VILA NOVA',
          data_inspecao: '2026-07-20',
          matricula_responsavel: '2170',
          inspecoes_armadilhas: [{
            localizacao_armadilha: 'A1',
            troca_feromonio: 'sim',
            machos: 3,
            femeas: 2,
            total: 999,
            situacao_armadilha: 'DN',
          }],
        },
      }],
    });

    expect(dataset.records[0].traps[0].total).toBe(5);
    expect(dataset.records[0].total).toBe(5);
    expect(dataset.records[0].pheromoneChanges).toBe(1);
    expect(dataset.records[0].damaged).toBe(1);
  });

  it('consolida fichas, capturas e situacoes', () => {
    const totals = summarizeRhynchophorus([
      { status: 'aprovado', trapCount: 2, males: 4, females: 3, total: 7, pheromoneChanges: 1, damaged: 1, missing: 0 },
      { status: 'pendente_validacao', trapCount: 1, males: 2, females: 5, total: 7, pheromoneChanges: 0, damaged: 0, missing: 1 },
    ]);
    expect(totals).toMatchObject({ records: 2, approved: 1, traps: 3, males: 6, females: 8, total: 14, changes: 1, damaged: 1, missing: 1 });
  });
});
