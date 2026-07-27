import {
  createAgroProxyHandler,
  sanitizeQualityQuery,
} from '../../server/agroApiProxy.js';

export default createAgroProxyHandler({
  upstreamPath: '/v1/monthly-bunch-weights',
  sanitizeQuery: sanitizeQualityQuery,
  errorMessage: 'Não foi possível consultar os pesos médios mensais agora.',
  logLabel: 'monthly-bunch-weights proxy',
});
