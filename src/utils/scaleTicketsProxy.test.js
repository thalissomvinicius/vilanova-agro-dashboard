import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import scaleTicketsHandler, { sanitizeScaleTicketQuery } from '../../api/agro/scale-tickets';
import { sanitizeQualityQuery } from '../../api/agro/quality-losses';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function responseMock() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: '',
    setHeader: vi.fn((name, value) => headers.set(name.toLowerCase(), value)),
    end: vi.fn(function end(body) {
      this.body = body;
    }),
    headers,
  };
}

describe('sanitizeScaleTicketQuery', () => {
  it('mantem somente filtros permitidos e aplica limite padrao', () => {
    const result = sanitizeScaleTicketQuery(
      '/api/agro/scale-tickets?status=closed&products=CFF%20Fruto%20de%20dend%C3%AA&ticket=123'
    );

    expect(result.get('status')).toBe('closed');
    expect(result.get('products')).toBe('CFF Fruto de dendê');
    expect(result.get('ticket')).toBe('123');
    expect(result.get('limit')).toBe('100');
  });

  it('recusa parametros desconhecidos', () => {
    expect(() => sanitizeScaleTicketQuery(
      '/api/agro/scale-tickets?sql=select'
    )).toThrow('Parâmetro não permitido');
  });

  it('recusa ticket, status e limite fora da allowlist', () => {
    expect(() => sanitizeScaleTicketQuery(
      '/api/agro/scale-tickets?ticket=1%20OR%201%3D1'
    )).toThrow('Ticket inválido');
    expect(() => sanitizeScaleTicketQuery(
      '/api/agro/scale-tickets?status=deleted'
    )).toThrow('Status inválido');
    expect(() => sanitizeScaleTicketQuery(
      '/api/agro/scale-tickets?limit=999'
    )).toThrow('Limite inválido');
  });

  it('recusa parâmetros duplicados e períodos acima de 90 dias', () => {
    expect(() => sanitizeScaleTicketQuery(
      '/api/agro/scale-tickets?limit=10&limit=20'
    )).toThrow('Parâmetro duplicado');
    expect(() => sanitizeScaleTicketQuery(
      '/api/agro/scale-tickets?from=2026-01-01T00:00:00.000Z&to=2026-04-02T00:00:00.000Z'
    )).toThrow('período máximo');
  });
});

describe('scaleTicketsHandler', () => {
  it('valida a sessão e assina a chamada AGRO apenas no servidor', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('AGRO_API_BASE_URL', 'https://api-agro.example');
    vi.stubEnv('AGRO_API_CLIENT_ID', 'dashboard-client');
    vi.stubEnv('AGRO_API_CLIENT_SECRET', Buffer.from('hmac-secret').toString('base64url'));
    vi.stubEnv('AGRO_CF_ACCESS_CLIENT_ID', 'cloudflare-id');
    vi.stubEnv('AGRO_CF_ACCESS_CLIENT_SECRET', 'cloudflare-secret');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ matricula: '2170' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ ticketCode: '123' }],
          page: { limit: 1, nextCursor: null },
          meta: { source: 'AGRO', generatedAt: '2026-07-25T12:00:00Z' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const response = responseMock();

    await scaleTicketsHandler({
      method: 'GET',
      url: '/api/agro/scale-tickets?ticket=123&limit=1',
      headers: { authorization: `Bearer ${'a'.repeat(32)}` },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const upstreamCall = fetchMock.mock.calls[1];
    expect(String(upstreamCall[0])).toBe('https://api-agro.example/v1/scale-tickets?ticket=123&limit=1');
    expect(upstreamCall[1].headers).toEqual(expect.objectContaining({
      'CF-Access-Client-Id': 'cloudflare-id',
      'CF-Access-Client-Secret': 'cloudflare-secret',
      'x-agro-client-id': 'dashboard-client',
      'x-agro-signature': expect.any(String),
    }));
    expect(upstreamCall[1].headers).not.toHaveProperty('Authorization');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(JSON.parse(response.body).data[0].ticketCode).toBe('123');
  });
});

describe('sanitizeQualityQuery', () => {
  it('aceita os filtros do contrato de qualidade', () => {
    const result = sanitizeQualityQuery(
      '/api/agro/quality-losses?from=2026-06-01T00%3A00%3A00.000Z&to=2026-07-01T00%3A00%3A00.000Z&ticket=123&limit=200'
    );

    expect(result.get('ticket')).toBe('123');
    expect(result.get('limit')).toBe('200');
    expect(result.get('from')).toBe('2026-06-01T00:00:00.000Z');
  });

  it('não aceita filtros exclusivos da rota geral de tickets', () => {
    expect(() => sanitizeQualityQuery(
      '/api/agro/quality-losses?status=closed'
    )).toThrow('Parâmetro não permitido');
    expect(() => sanitizeQualityQuery(
      '/api/agro/quality-losses?products=CFF'
    )).toThrow('Parâmetro não permitido');
  });
});
