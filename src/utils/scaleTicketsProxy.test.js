import { describe, expect, it } from 'vitest';
import { sanitizeScaleTicketQuery } from '../../api/agro/scale-tickets';

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
});
