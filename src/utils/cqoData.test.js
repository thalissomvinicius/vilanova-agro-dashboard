import { describe, expect, it } from 'vitest';
import {
  aggregateRecords,
  filterRecords,
  normalizeCqoFarmId,
  normalizeText,
  parseRecordDateValue,
} from './cqoData';

function record(overrides = {}) {
  return {
    id: 'cq-1',
    farmId: 'vila-nova',
    farm: 'Vila Nova',
    parcel: 'P-01',
    type: 'corte',
    cycle: '2026-06',
    form: 'CQO Corte',
    evaluator: 'Maria Silva',
    evaluatorMatricula: '2170',
    fiscal: 'Joao Souza',
    source: 'app',
    status: 'Aprovado',
    date: '2026-06-15',
    raw: { data_avaliacao: '2026-06-15' },
    gps: { lat: -2.39, lng: -48.15 },
    gpsTrack: [{ lat: -2.39, lng: -48.15 }, { lat: -2.391, lng: -48.151 }],
    gpsOccurrences: [{ fieldId: 'cacho_verde' }],
    totals: {
      linhas: 2,
      plantasObservadas: 20,
      cachosObservados: 50,
      cachoEsquecido: 1,
      cachoVerde: 2,
      cachoMaduro: 40,
      cachoPassado: 3,
      cachoInfermo: 0,
      bucha: 0,
      cachoMalPosicionado: 0,
      cachoNaoCarreado: 0,
      pesoMedio: 0,
      cachoBrocado: 1,
      taloComprido: 2,
      folhaCortada: 1,
      folhaMamando: 1,
      cachoEstrela: 1,
      cachoAvermelhado: 1,
    },
    ...overrides,
  };
}

describe('normalizeText', () => {
  it('normaliza acentos, caixa e separadores para filtros', () => {
    expect(normalizeText('Fé em Deus / CQO Rampa')).toBe('fe-em-deus-cqo-rampa');
  });
});

describe('normalizeCqoFarmId', () => {
  it('mapeia nomes de fazenda com prefixos para o escopo CQO ativo', () => {
    expect(normalizeCqoFarmId('Fazenda Vila Nova')).toBe('vila-nova');
    expect(normalizeCqoFarmId('FAZ. FÉ EM DEUS')).toBe('fe-em-deus');
    expect(normalizeCqoFarmId('Nova Conceição')).toBe('nova-conceicao');
  });
});

describe('parseRecordDateValue', () => {
  it('interpreta datas brasileiras com horario', () => {
    const parsed = parseRecordDateValue('15/06/2026 08:30');

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(15);
    expect(parsed.getHours()).toBe(8);
    expect(parsed.getMinutes()).toBe(30);
  });

  it('retorna null para valor vazio', () => {
    expect(parseRecordDateValue('')).toBeNull();
  });
});

describe('filterRecords', () => {
  it('combina filtros de fazenda, area, periodo, fiscal, fonte, status e busca', () => {
    const records = [
      record(),
      record({ id: 'cq-2', farmId: 'fe-em-deus', farm: 'Fe em Deus', parcel: 'P-99' }),
      record({ id: 'cq-3', type: 'carreamento', form: 'CQO Carreamento' }),
    ];

    const result = filterRecords(records, {
      farmFilter: 'vila-nova',
      areaFilter: 'corte',
      periodFilter: 'custom',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      evaluatorFilter: 'João Souza',
      sourceFilter: 'app',
      statusFilter: 'aprovado',
      searchTerm: 'P-01',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cq-1');
  });

  it('ignora fazendas fora do escopo CQO ativo', () => {
    const result = filterRecords([
      record({ id: 'valid' }),
      record({ id: 'inactive', farmId: 'rio-capim', farm: 'Rio Capim' }),
    ], { periodFilter: 'all' });

    expect(result.map((item) => item.id)).toEqual(['valid']);
  });
});

describe('aggregateRecords', () => {
  it('agrega totais, taxas e indicadores de GPS', () => {
    const totals = aggregateRecords([
      record(),
      record({
        id: 'cq-2',
        type: 'carreamento',
        form: 'CQO Carreamento',
        status: 'Reprovado',
        gps: null,
        gpsTrack: [],
        gpsOccurrences: [],
        totals: {
          ...record().totals,
          cachosObservados: 0,
          cachoEsquecido: 0,
          cachoVerde: 0,
          cachoMaduro: 0,
          cachoPassado: 0,
          cachoNaoCarreado: 2,
          cachoMalPosicionado: 1,
          pesoMedio: 18,
        },
      }),
    ]);

    expect(totals.total).toBe(2);
    expect(totals.corte).toBe(1);
    expect(totals.carreamento).toBe(1);
    expect(totals.aprovados).toBe(1);
    expect(totals.reprovados).toBe(1);
    expect(totals.validationRate).toBe(100);
    expect(totals.approvalRate).toBe(50);
    expect(totals.gpsEligible).toBe(2);
    expect(totals.gps).toBe(1);
    expect(totals.gpsRate).toBe(50);
    expect(totals.lostCachosQty).toBe(3);
  });
});
