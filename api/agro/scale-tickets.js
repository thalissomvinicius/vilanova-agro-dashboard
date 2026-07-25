import {
  createAgroProxyHandler,
  sanitizeScaleTicketQuery,
} from '../../server/agroApiProxy.js';

export { sanitizeScaleTicketQuery };

export default createAgroProxyHandler({
  upstreamPath: '/v1/scale-tickets',
  sanitizeQuery: sanitizeScaleTicketQuery,
  errorMessage: 'Não foi possível consultar a balança agora.',
  logLabel: 'scale-tickets proxy',
});
