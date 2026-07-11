import { describe, expect, it } from 'vitest';
import {
  aggregateRecords,
  attachmentThumbnailPathCandidates,
  attachmentStoragePathCandidates,
  filterRecords,
  isApprovedAnalyticsRecord,
  normalizeResponse,
  normalizeAttachmentStoragePath,
  normalizeCqoFarmId,
  normalizeText,
  parseRecordDateValue,
  resolveSupabaseStorageSignedUrl,
} from './cqoData';
import { buildQualidadeOperacional } from './qualidadeOperacionalData';
import { buildPodaDemoRecords } from './podaDemoData';

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

  it('interpreta datas seriais do Excel usadas no snapshot CQO', () => {
    const parsed = parseRecordDateValue('45474');

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.getFullYear()).toBe(2024);
    expect(parsed.getMonth()).toBe(6);
    expect(parsed.getDate()).toBe(1);
  });
});

describe('attachments storage', () => {
  it('normaliza caminhos do bucket mobile-anexos antes de assinar', () => {
    expect(normalizeAttachmentStoragePath('mobile-anexos/3102/res_1/foto.jpeg')).toBe('3102/res_1/foto.jpeg');
    expect(normalizeAttachmentStoragePath('storage/v1/object/sign/mobile-anexos/3102/res_1/foto.jpeg?token=abc')).toBe('3102/res_1/foto.jpeg');
    expect(normalizeAttachmentStoragePath('inline_json://res_1/campo')).toBe('');
  });

  it('monta candidato com matricula, resposta e nome do arquivo para anexos antigos', () => {
    expect(attachmentStoragePathCandidates({
      resposta_id: 'res_1783014313554_882',
      usuario_id: '3102',
      nome_arquivo: '44_85d05947.jpeg',
      storage_path: 'anexo_pendente://res_1783014313554_882/foto',
    })).toContain('3102/res_1783014313554_882/44_85d05947.jpeg');
  });

  it('normaliza candidatos de miniatura dos anexos do app', () => {
    expect(attachmentThumbnailPathCandidates({
      thumbnail_storage_path: 'mobile-anexos/3102/res_1/thumbs/foto_thumb.jpg',
    })).toEqual(['3102/res_1/thumbs/foto_thumb.jpg']);
  });

  it('monta URL assinada com o prefixo storage/v1 retornado pelo Supabase', () => {
    expect(resolveSupabaseStorageSignedUrl(
      'https://demo.supabase.co',
      '/object/sign/mobile-anexos/3102/res_1/foto.jpeg?token=abc'
    )).toBe('https://demo.supabase.co/storage/v1/object/sign/mobile-anexos/3102/res_1/foto.jpeg?token=abc');

    expect(resolveSupabaseStorageSignedUrl(
      'https://demo.supabase.co/',
      '/storage/v1/object/sign/mobile-anexos/3102/res_1/foto.jpeg?token=abc'
    )).toBe('https://demo.supabase.co/storage/v1/object/sign/mobile-anexos/3102/res_1/foto.jpeg?token=abc');
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

  it('mantem fazendas novas visiveis em todas e filtra quando uma fazenda e selecionada', () => {
    const records = [
      record({ id: 'valid' }),
      record({ id: 'inactive', farmId: 'rio-capim', farm: 'Rio Capim' }),
    ];
    const allFarms = filterRecords(records, { periodFilter: 'all' });
    const selectedFarm = filterRecords(records, { periodFilter: 'all', farmFilter: 'vila-nova' });

    expect(allFarms.map((item) => item.id)).toEqual(['valid', 'inactive']);
    expect(selectedFarm.map((item) => item.id)).toEqual(['valid']);
  });

  it('filtra registros do Excel por ano mesmo quando a data vem como serial', () => {
    const result = filterRecords([
      record({ id: 'excel-2024', source: 'excel', raw: { data_avaliacao: '45474' }, date: '01/07/2024' }),
      record({ id: 'app-2026', raw: { data_avaliacao: '2026-06-15' } }),
    ], {
      periodFilter: 'custom',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      sourceFilter: 'all',
    });

    expect(result.map((item) => item.id)).toEqual(['excel-2024']);
  });

  it('mantem somente app aprovado e excel consolidado nos filtros analiticos', () => {
    const aprovado = record({ id: 'app-aprovado', status: 'Aprovado' });
    const pendente = record({ id: 'app-pendente', status: 'Pendente validação' });
    const reprovado = record({ id: 'app-reprovado', status: 'Reprovado' });
    const excel = record({ id: 'excel-importado', source: 'excel', status: 'Pendente' });

    expect(isApprovedAnalyticsRecord(aprovado)).toBe(true);
    expect(isApprovedAnalyticsRecord(pendente)).toBe(false);
    expect(isApprovedAnalyticsRecord(excel)).toBe(true);

    const result = filterRecords([aprovado, pendente, reprovado, excel], {
      periodFilter: 'all',
      approvedOnly: true,
    });

    expect(result.map((item) => item.id)).toEqual(['app-aprovado', 'excel-importado']);
  });
});

describe('normalizeResponse', () => {
  it('usa o fiscal responsavel da equipe como fiscal principal do dashboard', () => {
    const normalized = normalizeResponse({
      id: 'res-fiscal-equipe',
      formulario_id: 'form_cqo_corte',
      usuario_id: '2170',
      criado_em: '2026-06-24T12:00:00.000Z',
      status: 'aprovado',
      dados_json: {
        nome_fazenda: 'Vila Nova',
        data_avaliacao: '2026-06-24',
        fiscal_resp: 'Daniel Souza',
        fiscal_resp_equipe: 'Luan Souza Ferreira',
        linhas_corte: [],
      },
    });

    expect(normalized.fiscal).toBe('Luan Souza Ferreira');
  });

  it('mantem lancamento manual como app sem contar GPS', () => {
    const normalized = normalizeResponse({
      id: 'manual-1',
      formulario_id: 'form_cqo_poda',
      usuario_id: '2170',
      criado_em: '2026-07-02T12:00:00.000Z',
      status: 'aprovado',
      dados_json: {
        nome_fazenda: 'Vila Nova',
        data_avaliacao: '2026-07-02',
        origem_manual_dashboard: true,
        gps_nao_aplicavel: true,
        linhas_poda: [{ linha: '1', numero_plantas_linha: 20, cacho_exposto: 1 }],
      },
    });

    expect(normalized.source).toBe('app');
    expect(normalized.sourceLabel).toBe('Manual / Dashboard');
    expect(normalized.gpsApplicable).toBe(false);
    expect(normalized.gps).toBeNull();
  });

  it('nao conta palha mal empilhada como cacho observado no corte', () => {
    const normalized = normalizeResponse({
      id: 'res-palha-mal-empilhada',
      formulario_id: 'form_cqo_corte',
      usuario_id: '2170',
      criado_em: '2026-06-24T12:00:00.000Z',
      status: 'aprovado',
      dados_json: {
        nome_fazenda: 'Vila Nova',
        data_avaliacao: '2026-06-24',
        linhas_corte: [
          {
            cacho_maduro: 2,
            cacho_passado: 1,
            cacho_mal_posicionado: 4,
          },
        ],
      },
    });

    expect(normalized.totals.cachosObservados).toBe(3);
    expect(normalized.totals.cachoMalPosicionado).toBe(4);
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

describe('buildPodaDemoRecords', () => {
  it('nao injeta dados demonstrativos por padrao', () => {
    expect(buildPodaDemoRecords()).toEqual([]);
  });
});

describe('buildQualidadeOperacional', () => {
  it('usa perdas em toneladas vindas do BI antes da estimativa local', () => {
    const corte = record({
      id: 'excel-corte-bi',
      source: 'excel',
      raw: {
        data_avaliacao: '2026-06-15',
        perdas_t_corte_bi: 0.76,
        estimativa_cachos_esquecidos_bi: 38,
        total_plantas_parcela: 5067,
      },
      totals: {
        ...record().totals,
        plantasObservadas: 228,
        cachosObservados: 73,
        cachoEsquecido: 3,
      },
    });
    const carreamento = record({
      id: 'excel-carreamento-bi',
      type: 'carreamento',
      form: 'CQO Carreamento',
      source: 'excel',
      raw: {
        data_avaliacao: '2026-06-15',
        perdas_t_carreamento_bi: 0.12,
        estimativa_cachos_nao_carreados_bi: 12,
        total_plantas_parcela: 3325,
      },
      totals: {
        ...record().totals,
        plantasObservadas: 304,
        cachosObservados: 0,
        cachoEsquecido: 0,
        cachoNaoCarreado: 1,
      },
    });

    const model = buildQualidadeOperacional([corte, carreamento]);

    expect(model.totals.corteT).toBeCloseTo(0.76);
    expect(model.totals.carreamentoT).toBeCloseTo(0.12);
    expect(model.totals.perdasT).toBeCloseTo(0.88);
    expect(model.totals.estimatedCachos).toBeCloseTo(50);
  });

  it('nao trata poda como perda de corte e respeita perda zerada vinda do BI', () => {
    const corteZerado = record({
      id: 'excel-corte-zero-bi',
      source: 'excel',
      raw: {
        data_avaliacao: '2026-06-15',
        perdas_t_corte_bi: 0,
        total_plantas_parcela: 1000,
      },
      totals: {
        ...record().totals,
        plantasObservadas: 10,
        cachosObservados: 10,
        cachoEsquecido: 5,
      },
    });
    const poda = record({
      id: 'excel-poda-bi',
      type: 'poda',
      form: 'CQO Poda',
      source: 'excel',
      raw: {
        data_avaliacao: '2026-06-15',
        perdas_t_bi: 99,
      },
      totals: {
        ...record().totals,
        plantasObservadas: 60,
        cachosObservados: 0,
        cachoEsquecido: 0,
      },
    });

    const model = buildQualidadeOperacional([corteZerado, poda]);

    expect(model.totals.corteT).toBe(0);
    expect(model.totals.carreamentoT).toBe(0);
    expect(model.totals.perdasT).toBe(0);
  });

  it('estima perdas com peso medio do mes anterior da balanca', () => {
    const corte = record({
      id: 'corte-junho-balanca',
      raw: {
        data_avaliacao: '2026-06-15',
        total_plantas_parcela: 1000,
      },
      totals: {
        ...record().totals,
        plantasObservadas: 100,
        cachosObservados: 100,
        cachoEsquecido: 3,
      },
    });
    const balanceData = {
      entradaDeCff: {
        byMonth: [
          {
            monthKey: '2026-05',
            pesoLiquidoKg: 10000,
            cachos: 1000,
          },
          {
            monthKey: '2026-06',
            pesoLiquidoKg: 500000,
            cachos: 10000,
          },
        ],
      },
    };

    const model = buildQualidadeOperacional([corte], balanceData);

    expect(model.totals.corteT).toBeCloseTo(0.3);
    expect(model.totals.producedTon).toBeCloseTo(500);
    expect(model.lossRates.cortePct).toBeCloseTo(0.06);
    expect(model.balance.usesPreviousMonthWeight).toBe(true);
    expect(model.balance.weightMonthKeys).toEqual(['2026-05']);
  });
});
