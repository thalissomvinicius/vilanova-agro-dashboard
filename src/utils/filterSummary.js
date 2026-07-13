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
  const filters = buildActiveFilterItems({
    farmFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    searchTerm,
  });

  return filters.length ? filters.map((item) => `${item.label}: ${item.value}`).join(' · ') : 'Todos';
}

export function buildActiveFilterItems({
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

  if (farm) filters.push({ id: 'farm', label: 'Fazenda', value: farm });
  if (cycle && cycle !== 'all') filters.push({ id: 'cycle', label: 'Ciclo', value: cycle });
  if (evaluator && evaluator !== 'all') filters.push({ id: 'evaluator', label: 'Fiscal equipe', value: evaluator });
  if (source) filters.push({ id: 'source', label: 'Fonte', value: source });
  if (search) filters.push({ id: 'search', label: 'Busca', value: search });

  return filters;
}
