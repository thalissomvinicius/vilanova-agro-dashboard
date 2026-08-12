import { describe, expect, it } from 'vitest';
import handler, { clientIpFromRequest } from './client-ip';

function responseMock() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe('client-ip route', () => {
  it('prioriza o IP informado pela Vercel e retorna somente o contrato público', () => {
    const response = responseMock();
    handler({
      method: 'GET',
      headers: {
        'x-vercel-forwarded-for': '203.0.113.42',
        authorization: 'Bearer segredo',
        cookie: 'sessao=segredo',
      },
      socket: { remoteAddress: '::ffff:127.0.0.1' },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['ip', 'requestId', 'serverTimestamp', 'timestamp']);
    expect(response.body.ip).toBe('203.0.113.42');
    expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.body.serverTimestamp).toBe(response.body.timestamp);
    expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.stringify(response.body)).not.toContain('segredo');
  });

  it('usa o socket local como fallback e recusa outros métodos sem corpo JSON', () => {
    expect(clientIpFromRequest({ headers: {}, socket: { remoteAddress: '::ffff:127.0.0.1' } })).toBe('127.0.0.1');

    const response = responseMock();
    handler({ method: 'POST', headers: {} }, response);
    expect(response.statusCode).toBe(405);
    expect(response.headers.Allow).toBe('GET');
    expect(response.body).toBeUndefined();
  });
});
