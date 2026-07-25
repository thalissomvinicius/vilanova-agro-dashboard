import { describe, expect, it } from 'vitest';
import {
  normalizeFitossanidadeInventoryDataset,
  summarizeInventory,
} from './fitossanidadeInventoryData';

describe('fitossanidade inventory data', () => {
  it('preserva o total de plantas e calcula produtivas sem remover falhas e mortas da base', () => {
    const dataset = normalizeFitossanidadeInventoryDataset({
      records: [{
        id: 'inv_1',
        formulario_id: 'form_fitossanidade_inventario',
        usuario_id: '2170',
        status: 'aprovado',
        criado_em: '2026-07-21T10:00:00Z',
        dados_json: {
          data_inventario: '2026-07-21',
          cidade: 'Tome-Acu',
          nome_fazenda: 'Area nova',
          parcela: 'Teste 01',
          ano_plantio: 2026,
          linhas_inventario: [
            { rua_index: 1, lado_linha: 1, linha: 10, numero_plantas_linha: 40, quantidade_falhas: 3, quantidade_mortas: 2 },
            { rua_index: 1, lado_linha: 2, linha: 11, numero_plantas_linha: 60, quantidade_falhas: 4, quantidade_mortas: 1 },
          ],
        },
      }],
      attachments: [{ id: 'foto_1', resposta_id: 'inv_1', nome_arquivo: 'evidencia.jpg' }],
    });

    expect(dataset.records).toHaveLength(1);
    expect(dataset.records[0]).toMatchObject({
      city: 'Tome-Acu',
      farm: 'Area nova',
      streets: 1,
      plants: 100,
      gaps: 7,
      dead: 3,
      productive: 90,
      evidenceCount: 1,
    });
  });

  it('soma as fichas filtradas sem alterar a base total de plantas', () => {
    const records = normalizeFitossanidadeInventoryDataset({
      records: [{
        id: 'inv_2',
        status: 'pendente_validacao',
        dados_json: {
          linhas_inventario: [
            { rua_index: 1, lado_linha: 1, linha: 1, numero_plantas_linha: 25, quantidade_falhas: 2, quantidade_mortas: 1 },
            { rua_index: 1, lado_linha: 2, linha: 2, numero_plantas_linha: 25, quantidade_falhas: 1, quantidade_mortas: 0 },
          ],
        },
      }],
    }).records;

    expect(summarizeInventory(records)).toMatchObject({
      records: 1,
      approved: 0,
      streets: 1,
      lines: 2,
      plants: 50,
      gaps: 3,
      dead: 1,
      productive: 46,
    });
  });
});
