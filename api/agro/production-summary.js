import {
  createAgroProxyHandler,
  sanitizeQualityQuery,
} from '../../server/agroApiProxy.js';

export default createAgroProxyHandler({
  upstreamPath: '/v1/production-summary',
  sanitizeQuery: sanitizeQualityQuery,
  errorMessage: 'Não foi possível consultar o resumo de produção agora.',
  logLabel: 'production-summary proxy',
});
