import {
  createAgroProxyHandler,
  sanitizeQualityQuery,
} from '../../server/agroApiProxy.js';

export { sanitizeQualityQuery };

export default createAgroProxyHandler({
  upstreamPath: '/v1/quality-scale-tickets',
  sanitizeQuery: sanitizeQualityQuery,
  errorMessage: 'Não foi possível consultar as pesagens de qualidade agora.',
  logLabel: 'quality-scale-tickets proxy',
});
