import {
  createAgroProxyHandler,
  sanitizeLossesReadinessQuery,
} from '../../server/agroApiProxy.js';

export default createAgroProxyHandler({
  upstreamPath: '/v1/losses-readiness',
  sanitizeQuery: sanitizeLossesReadinessQuery,
  errorMessage: 'Não foi possível consultar a prontidão das perdas agora.',
  logLabel: 'losses-readiness proxy',
});
