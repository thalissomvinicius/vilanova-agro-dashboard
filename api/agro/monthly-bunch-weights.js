import {
  createAgroProxyHandler,
  sanitizeMonthlyBunchWeightQuery,
} from '../../server/agroApiProxy.js';

export default createAgroProxyHandler({
  upstreamPath: '/v1/monthly-bunch-weights',
  sanitizeQuery: sanitizeMonthlyBunchWeightQuery,
  errorMessage: 'Não foi possível consultar os pesos médios mensais agora.',
  logLabel: 'monthly-bunch-weights proxy',
});
