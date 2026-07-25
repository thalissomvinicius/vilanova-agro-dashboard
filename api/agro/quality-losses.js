import {
  createAgroProxyHandler,
  sanitizeQualityQuery,
} from '../../server/agroApiProxy.js';

export { sanitizeQualityQuery };

export default createAgroProxyHandler({
  upstreamPath: '/v1/quality-losses',
  sanitizeQuery: sanitizeQualityQuery,
  errorMessage: 'Não foi possível consultar as análises de qualidade agora.',
  logLabel: 'quality-losses proxy',
});
