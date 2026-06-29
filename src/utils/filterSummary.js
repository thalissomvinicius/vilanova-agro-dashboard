const FARM_LABELS = {
  'fe-em-deus': 'Fé em Deus',
  'nova-conceicao': 'Nova Conceição',
  'vila-nova': 'Vila Nova',
  'santa-maria': 'Santa Maria',
};

const SOURCE_LABELS = {
  app: 'Só App',
  excel: 'Só Excel',
  sql: 'Só SQL',
};

function cleanText(value) {
  return String(value || '').trim();
}

export function readableFarmFilter(value) {
  const key = cleanText(value);
  if (!key || key === 'all') return '';
  return FARM_LABELS[key] || key;
}

export function readableSourceFilter(value) {
  const key = cleanText(value);
  if (!key || key === 'all') return '';
  return SOURCE_LABELS[key] || key;
}

export function buildActiveFilterSummary({
  farmFilter = 'all',
  cycleFilter = 'all',
  evaluatorFilter = 'all',
  sourceFilter = 'all',
  searchTerm = '',
} = {}) {
  const filters = [];
  const farm = readableFarmFilter(farmFilter);
  const source = readableSourceFilter(sourceFilter);
  const cycle = cleanText(cycleFilter);
  const evaluator = cleanText(evaluatorFilter);
  const search = cleanText(searchTerm);

  if (farm) filters.push(`Fazenda: ${farm}`);
  if (cycle && cycle !== 'all') filters.push(`Ciclo: ${cycle}`);
  if (evaluator && evaluator !== 'all') filters.push(`Fiscal equipe: ${evaluator}`);
  if (source) filters.push(`Fonte: ${source}`);
  if (search) filters.push(`Busca: ${search}`);

  return filters.length ? filters.join(' · ') : 'Todos';
}
