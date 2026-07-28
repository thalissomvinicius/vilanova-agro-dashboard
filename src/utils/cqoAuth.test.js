import { afterEach, describe, expect, it, vi } from 'vitest';

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

function errorJson(status, payload) {
  return {
    ok: false,
    status,
    clone: () => ({
      json: async () => payload,
    }),
    text: async () => payload.message || '',
  };
}

async function loadAuthModule() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  return import('./cqoData');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('refreshAttachmentStorageSignedUrl', () => {
  it('renova a assinatura do arquivo original no bucket privado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({
      signedURL: '/object/sign/mobile-anexos/3102/res_1/foto.jpeg?token=novo',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAttachmentStorageSignedUrl } = await loadAuthModule();
    const url = await refreshAttachmentStorageSignedUrl('mobile-anexos/3102/res_1/foto.jpeg');

    expect(url).toBe('https://example.supabase.co/storage/v1/object/sign/mobile-anexos/3102/res_1/foto.jpeg?token=novo');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/storage/v1/object/sign/mobile-anexos/3102/res_1/foto.jpeg',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('authenticateDashboardUser', () => {
  it('usa RPC e nao retorna a senha do headcount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson([{
      matricula: '2170',
      nome: 'Maria Silva',
      departamento: 'CQO',
      cargo: 'Fiscal',
      gestor: 'Joao Souza',
      status: 'ATIVO',
      role: 'auditor',
      permissions: ['review_response'],
      session_token: 'session-token',
      session_expires_at: '2026-06-23T23:00:00Z',
      senha: '1234',
    }]));
    vi.stubGlobal('fetch', fetchMock);

    const { authenticateDashboardUser } = await loadAuthModule();
    const profile = await authenticateDashboardUser('2170', '1234');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.supabase.co/rest/v1/rpc/dashboard_authenticate');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_matricula: '2170',
      p_senha: '1234',
    });
    expect(profile).toEqual({
      matricula: '2170',
      nome: 'Maria Silva',
      departamento: 'CQO',
      cargo: 'Fiscal',
      gestor: 'Joao Souza',
      status: 'ATIVO',
      role: 'auditor',
      permissions: ['review_response'],
      sessionToken: 'session-token',
      sessionExpiresAt: '2026-06-23T23:00:00Z',
    });
    expect(profile).not.toHaveProperty('senha');
  });

  it('rejeita credenciais invalidas sem cair no modo legado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson([])));

    const { authenticateDashboardUser } = await loadAuthModule();

    await expect(authenticateDashboardUser('2170', 'errada'))
      .rejects
      .toThrow('Matricula ou senha invalida.');
  });

  it('mostra mensagem limpa quando o banco limita tentativas de login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorJson(400, {
      message: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.',
    })));

    const { authenticateDashboardUser } = await loadAuthModule();

    await expect(authenticateDashboardUser('2170', 'errada'))
      .rejects
      .toThrow('Muitas tentativas de login. Aguarde 15 minutos e tente novamente.');
  });
});

describe('dashboard response mutations', () => {
  it('atualiza perfil da sessao sem trocar o token local', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson([{
      matricula: '2170',
      nome: 'Maria Silva',
      departamento: 'CQO',
      cargo: 'Fiscal',
      gestor: 'Joao Souza',
      status: 'ATIVO',
      role: 'admin',
      permissions: [],
      session_expires_at: '2026-06-23T23:00:00Z',
    }]));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshDashboardSession } = await loadAuthModule();
    const profile = await refreshDashboardSession('session-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.supabase.co/rest/v1/rpc/dashboard_session_profile');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_session_token: 'session-token',
    });
    expect(profile).toMatchObject({
      matricula: '2170',
      role: 'admin',
      permissions: [],
      sessionToken: 'session-token',
    });
    expect(profile).not.toHaveProperty('senha');
  });

  it('avalia permissoes do perfil autenticado', async () => {
    const { canUseDashboardAction } = await loadAuthModule();

    expect(canUseDashboardAction({ role: 'admin', permissions: [] }, 'delete_response')).toBe(true);
    expect(canUseDashboardAction({ role: 'auditor', permissions: ['review_response'] }, 'review_response')).toBe(true);
    expect(canUseDashboardAction({ role: 'viewer', permissions: [] }, 'review_response')).toBe(false);
  });

  it('identifica erros de sessao expirada sem confundir permissao negada', async () => {
    const { isDashboardSessionExpiredError } = await loadAuthModule();

    expect(isDashboardSessionExpiredError(new Error('Leitura do dashboard: HTTP 400 - Sessao expirada ou invalida.'))).toBe(true);
    expect(isDashboardSessionExpiredError(new Error('Atualização: HTTP 400 - Sessao expirada, invalida ou sem permissao.'))).toBe(false);
  });

  it('traduz erros tecnicos para mensagens seguras de interface', async () => {
    const { dashboardErrorMessage } = await loadAuthModule();

    expect(dashboardErrorMessage(new Error('Leitura do dashboard: HTTP 400 - detalhes internos'))).toBe(
      'Não foi possível acessar os dados agora. Tente novamente em instantes.'
    );
    expect(dashboardErrorMessage(new Error('Atualização: HTTP 400 - Sessao expirada, invalida ou sem permissao.'))).toBe(
      'Seu perfil não tem permissão para esta ação.'
    );
    expect(dashboardErrorMessage(new Error('Autenticação do dashboard: HTTP 401 - invalid api key'))).toBe(
      'Não foi possível validar o acesso agora. Tente novamente em instantes.'
    );
    expect(dashboardErrorMessage(new Error('Database schema leaked: public.mobile_respostas'))).toBe(
      'Não foi possível concluir a operação agora.'
    );
  });

  it('carrega o dataset CQO em partes por RPC quando ha sessao ativa', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({
      response_table: 'mobile_respostas',
      mobile_respostas: [],
      mobile_gps: [],
      mobile_anexos: [],
      mobile_formularios: [],
      headcount_import_snapshots: [],
      cqo_import_snapshots: [],
      cqo_poda_import_snapshots: [],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshCqoData, setCqoSessionToken } = await loadAuthModule();
    setCqoSessionToken('session-token');
    const data = await refreshCqoData();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://example.supabase.co/rest/v1/rpc/dashboard_cqo_response_page',
      ...Array(4).fill('https://example.supabase.co/rest/v1/rpc/dashboard_cqo_dataset_part'),
    ]);
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body))).toEqual([
      { p_session_token: 'session-token', p_offset: 0, p_limit: 50 },
      { p_session_token: 'session-token', p_part: 'metadata' },
      { p_session_token: 'session-token', p_part: 'cqo_import' },
      { p_session_token: 'session-token', p_part: 'cqo_poda_import' },
      { p_session_token: 'session-token', p_part: 'gps' },
    ]);
    expect(data.source).toBe('Banco online');
  });

  it('repete uma leitura CQO quando o banco falha temporariamente', async () => {
    let responsePageAttempts = 0;
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('dashboard_cqo_response_page')) {
        responsePageAttempts += 1;
        if (responsePageAttempts === 1) {
          return errorJson(500, {
            message: 'canceling statement due to statement timeout',
          });
        }
      }

      return okJson({
        response_table: 'mobile_respostas',
        mobile_respostas: [],
        mobile_gps: [],
        mobile_anexos: [],
        mobile_formularios: [],
        headcount_import_snapshots: [],
        cqo_import_snapshots: [],
        cqo_poda_import_snapshots: [],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { refreshCqoData, setCqoSessionToken } = await loadAuthModule();
    setCqoSessionToken('session-token');
    const data = await refreshCqoData();

    expect(responsePageAttempts).toBe(2);
    expect(data.source).toBe('Banco online');
  });

  it('usa o dataset legado quando a RPC segmentada ainda nao existe', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorJson(404, { code: 'PGRST202', message: 'function not found' }))
      .mockResolvedValueOnce(errorJson(404, { code: 'PGRST202', message: 'function not found' }))
      .mockResolvedValueOnce(errorJson(404, { code: 'PGRST202', message: 'function not found' }))
      .mockResolvedValueOnce(errorJson(404, { code: 'PGRST202', message: 'function not found' }))
      .mockResolvedValueOnce(okJson({
        mobile_respostas: [],
        mobile_gps: [],
        mobile_anexos: [],
        mobile_formularios: [],
        headcount_import_snapshots: [],
        cqo_import_snapshots: [],
        cqo_poda_import_snapshots: [],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshCqoData, setCqoSessionToken } = await loadAuthModule();
    setCqoSessionToken('session-token');
    const data = await refreshCqoData();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[4][0]).toBe('https://example.supabase.co/rest/v1/rpc/dashboard_cqo_dataset');
    expect(data.source).toBe('Banco online');
  });

  it('nao assina anexos durante a carga global do dashboard', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url, options) => {
      if (String(url).includes('/storage/v1/object/sign/')) {
        throw new Error('A carga global nao deve acessar o Storage.');
      }

      const body = JSON.parse(options.body);
      if (body.p_part === 'metadata') {
        return okJson({
          mobile_anexos: [{
            id: 'anexo-1',
            resposta_id: 'res-1',
            storage_path: '3102/res-1/foto.jpeg',
          }],
          mobile_formularios: [],
          headcount_import_snapshots: [],
        });
      }

      return okJson({
        response_table: 'mobile_respostas',
        mobile_respostas: [],
        mobile_gps: [],
        cqo_import_snapshots: [],
        cqo_poda_import_snapshots: [],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { refreshCqoData, setCqoSessionToken } = await loadAuthModule();
    setCqoSessionToken('session-token');
    const data = await refreshCqoData();

    expect(data.anexos).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/storage/v1/object/sign/'))).toBe(false);
  });

  it('transforma snapshot CQO Excel em registros operacionais filtraveis', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({
      response_table: 'mobile_respostas',
      mobile_respostas: [],
      mobile_gps: [],
      mobile_anexos: [],
      mobile_formularios: [],
      headcount_import_snapshots: [{
        reference_month: '2024-07',
        rows_json: [{
          MATRICULA: '2005',
          NOME: 'Maria Silva',
          STATUS: 'ATIVO',
          FUNCAO: 'Fiscal CQO',
        }],
        imported_at: '2024-07-31T12:00:00Z',
      }],
      cqo_import_snapshots: [{
        import_key: 'cqo_1_digitacao_cqo',
        source_file: '1_Digitação_CQO.xlsx',
        corte_total_rows: 2,
        carreamento_total_rows: 1,
        imported_at: '2026-06-18T19:56:35Z',
        updated_at: '2026-06-18T19:56:35Z',
        corte_rows_json: [
          {
            NomePolo: 'TOMÉ-AÇU',
            NomeFazenda: 'VILA NOVA',
            Parcela: 'E18',
            'DataAvaliação': 45474,
            ciclo_mes: 1,
            MatriculaAvaliadores: '2005',
            'Fiscal Resp': 'Reney',
            NumeroPlantasObservadas: 318,
            NumeroCahosObservados: 30,
            CachoEsquecidoCiclo: 1,
            CachoVerde: 2,
            CachoMaduro: 27,
            CachoPassado: 1,
          },
          {
            NomePolo: 'TOMÉ-AÇU',
            NomeFazenda: 'VILA NOVA',
            Parcela: 'E18',
            'DataAvaliação': 45474,
            ciclo_mes: 1,
            MatriculaAvaliadores: '2005',
            'Fiscal Resp': 'Reney',
            NumeroPlantasObservadas: 114,
            NumeroCahosObservados: 19,
            CachoEsquecidoCiclo: 2,
            CachoVerde: 0,
            CachoMaduro: 19,
            CachoPassado: 0,
          },
        ],
        carreamento_rows_json: [{
          NomePolo: 'TOMÉ-AÇU',
          NomeFazenda: 'NOVA CONCEIÇÃO',
          Parcela: 'D30',
          'DataAvaliação': 45444,
          Ciclo_mes: 1,
          MatriculaAvaliadores: '2005',
          'Fiscal Resp': 'Reginaldo',
          NumeroPlantasObservadas: 474,
          Cachonaocarreado: 3,
          cachoMalPosicionado: 1,
        }],
      }],
      cqo_poda_import_snapshots: [{
        import_key: 'cqo_poda_2026_06',
        fonte: 'excel',
        source_file: 'CQO Poda.xlsx',
        source_path: 'C:/imports/CQO Poda.xlsx',
        source_sheet: 'poda',
        total_rows: 2,
        imported_at: '2026-06-26T12:00:00Z',
        updated_at: '2026-06-26T12:00:00Z',
        rows_json: [
          {
            NomePolo: 'TOMÉ-AÇU',
            NomeFazenda: 'FÉ EM DEUS',
            Parcela: 'F-16',
            'DataAvaliação': '25/06/2026',
            ciclo_mes: 2,
            MatriculaAvaliadores: '2005',
            'Fiscal Resp Equipe': 'Maria Silva',
            Linha: 101,
            'Nº de plantas Avaliadas': 32,
            'Planta Sem Poda': 2,
            'Cachos Exposto': 1,
            'Poda Em Meia Coroa': 1,
            'Poda Maior Que 1:1': 2,
            'Bico De Gaito': 1,
            'Cachos Podre Na Planta/Estrela': 1,
            'Palha mal empilhada': 1,
          },
          {
            NomePolo: 'TOMÉ-AÇU',
            NomeFazenda: 'FÉ EM DEUS',
            Parcela: 'F-16',
            'DataAvaliação': '25/06/2026',
            ciclo_mes: 2,
            MatriculaAvaliadores: '2005',
            'Fiscal Resp Equipe': 'Maria Silva',
            Linha: 102,
            'Nº de plantas Avaliadas': 28,
            'Planta Sem Poda': 1,
            'Cachos Exposto': 2,
            'Poda Em Meia Coroa': 1,
            'Poda Maior Que 1:1': 1,
            'Bico De Gaito': 1,
            'Cachos Podre Na Planta/Estrela': 1,
          },
        ],
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { filterRecords, refreshCqoData, setCqoSessionToken } = await loadAuthModule();
    setCqoSessionToken('session-token');
    const data = await refreshCqoData();

    expect(data.cqoImport).toMatchObject({
      records: 3,
      corteRows: 2,
      carreamentoRows: 1,
      podaRows: 2,
    });
    expect(data.excelRecords).toHaveLength(3);

    const corte = data.excelRecords.find((record) => record.type === 'corte');
    expect(corte).toMatchObject({
      source: 'excel',
      farmId: 'vila-nova',
      farm: 'VILA NOVA',
      parcel: 'E18',
      date: '01/07/2024',
      evaluator: 'Maria Silva',
      fiscal: 'Reney',
    });
    expect(corte.lines).toHaveLength(2);
    expect(corte.totals).toMatchObject({
      plantasObservadas: 432,
      cachoEsquecido: 3,
      cachoMaduro: 46,
    });

    const visible = filterRecords(data.records, {
      areaFilter: 'corte',
      sourceFilter: 'excel',
      periodFilter: 'custom',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    });

    expect(visible.map((record) => record.id)).toEqual([corte.id]);

    const poda = data.excelRecords.find((record) => record.type === 'poda');
    expect(poda).toMatchObject({
      source: 'excel',
      form: 'CQO Poda',
      farmId: 'fe-em-deus',
      farm: 'FÉ EM DEUS',
      parcel: 'F-16',
      fiscal: 'Maria Silva',
      gpsApplicable: false,
    });
    expect(poda.lines).toHaveLength(2);
    expect(poda.totals).toMatchObject({
      plantasObservadas: 60,
      plantaSemPodar: 3,
      cachoExposto: 3,
      podaMeiaCoroa: 2,
      podaMaiorUmParaUm: 3,
      bicoGaita: 2,
      cachoPodrePlanta: 2,
      palhaMalEmpilhada: 1,
    });

    const visiblePoda = filterRecords(data.records, {
      areaFilter: 'poda',
      sourceFilter: 'excel',
      periodFilter: 'custom',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
    });

    expect(visiblePoda.map((record) => record.id)).toEqual([poda.id]);
  });

  it('carrega headcount por RPC quando ha sessao ativa', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({
      reference_month: '2026-06',
      rows_json: [{
        MATRICULA: '2170',
        NOME: 'Maria Silva',
        STATUS: 'ATIVO',
      }],
      imported_at: '2026-06-23T12:00:00Z',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { loadHeadcountData, setCqoSessionToken } = await loadAuthModule();
    setCqoSessionToken('session-token');
    const rows = await loadHeadcountData();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.supabase.co/rest/v1/rpc/dashboard_headcount_snapshot');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_session_token: 'session-token',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      matricula: '2170',
      nome: 'Maria Silva',
      status: 'ATIVO',
      source: 'headcount_import_snapshots',
    });
  });

  it('envia atualizacao de colaborador por RPC com token de sessao', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson([{ matricula: '2170', status: 'INATIVO' }]));
    vi.stubGlobal('fetch', fetchMock);

    const { updateCollaborator } = await loadAuthModule();
    await updateCollaborator({
      matricula: '2170',
      status: 'INATIVO',
      senha: undefined,
      sessionToken: 'session-token',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.supabase.co/rest/v1/rpc/dashboard_update_collaborator_access');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_session_token: 'session-token',
      p_matricula: '2170',
      p_status: 'INATIVO',
    });
  });

  it('envia aprovacao por RPC com token de sessao', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson([{ id: 'resp-1', status: 'aprovado' }]));
    vi.stubGlobal('fetch', fetchMock);

    const { updateResponseReviewStatus } = await loadAuthModule();
    await updateResponseReviewStatus('resp-1', 'aprovado', {
      sessionToken: 'session-token',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.supabase.co/rest/v1/rpc/dashboard_review_response');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_session_token: 'session-token',
      p_response_id: 'resp-1',
      p_status: 'aprovado',
    });
  });

  it('envia exclusao por RPC com token de sessao', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson([{ id: 'resp-1', status: 'excluido' }]));
    vi.stubGlobal('fetch', fetchMock);

    const { deleteResponseRecord } = await loadAuthModule();
    await deleteResponseRecord('resp-1', {
      sessionToken: 'session-token',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.supabase.co/rest/v1/rpc/dashboard_delete_response');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_session_token: 'session-token',
      p_response_id: 'resp-1',
    });
  });
});
