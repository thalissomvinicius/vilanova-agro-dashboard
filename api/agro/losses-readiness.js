import {
  createAgroProxyHandler,
  sanitizeQualityQuery,
} from '../../server/agroApiProxy.js';

export default createAgroProxyHandler({
  upstreamPath: '/v1/losses-readiness',
  sanitizeQuery: sanitizeQualityQuery,
  errorMessage: 'Não foi possível consultar a prontidão das perdas agora.',
  logLabel: 'losses-readiness proxy',
});
