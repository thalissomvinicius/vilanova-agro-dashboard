import {
  createAgroProxyHandler,
  monthlyBunchWeightTicketsPath,
  sanitizeMonthlyDetailQuery,
} from '../../../../server/agroApiProxy.js';

export default createAgroProxyHandler({
  upstreamPath: monthlyBunchWeightTicketsPath,
  sanitizeQuery: sanitizeMonthlyDetailQuery,
  errorMessage: 'Não foi possível consultar os tickets da competência agora.',
  logLabel: 'monthly-bunch-weight-tickets proxy',
});
