import { aggregateRecords, parseRecordDateValue } from './cqoData';

export const QUALITY_LOSS_LIMITS = {
  cortePct: 1.6,
  carreamentoPct: 0.5,
  totalPct: 2.1,
  projectionReductionPct: 20,
};

function numberValue(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace('%', '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(sources, keys) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        const value = numberValue(source[key]);
        if (value !== 0) return value;
      }
    }
  }
  return 0;
}

function firstDefinedNumber(sources, keys) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        return numberValue(source[key]);
      }
    }
  }
  return null;
}

function sumLineKeys(lines, keys) {
  return (lines || []).reduce((total, line) => total + firstNumber([line], keys), 0);
}

function sumLineKeysWhenPresent(lines, keys) {
  let found = false;
  const total = (lines || []).reduce((sum, line) => {
    const value = firstDefinedNumber([line], keys);
    if (value === null) return sum;
    found = true;
    return sum + value;
  }, 0);
  return found ? total : null;
}

function safePct(num, den) {
  return den > 0 ? (num / den) * 100 : 0;
}

function productionPotentialTon(producedTon, lossTon) {
  return Math.max(0, Number(producedTon || 0)) + Math.max(0, Number(lossTon || 0));
}

function normalizeBalanceName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function recordDate(record) {
  return parseRecordDateValue(
    record.raw?.data_avaliacao
    || record.raw?.data
    || record.raw?.Data
    || record.sentAt
    || record.createdAt
    || record.date
  );
}

function dateMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeMonthKey(value) {
  if (!value) return '';
  const text = String(value).trim();
  const isoMonth = text.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) return text;

  const brMonth = text.match(/^(\d{2})\/(\d{4})$/);
  if (brMonth) return `${brMonth[2]}-${brMonth[1]}`;

  const parsed = parseRecordDateValue(text);
  return parsed ? dateMonthKey(parsed) : '';
}

function recordBalanceMonthKey(record) {
  const date = recordDate(record);
  if (date && !Number.isNaN(date.getTime())) return dateMonthKey(date);

  return normalizeMonthKey(
    record.raw?.mes_referencia_iso
    || record.raw?.ciclo_mes
    || record.cycle
    || record.date
  );
}

function previousMonthKey(key) {
  const normalized = normalizeMonthKey(key);
  if (!normalized) return '';
  const [year, month] = normalized.split('-').map(Number);
  if (!year || !month) return '';
  return dateMonthKey(new Date(year, month - 2, 1));
}

function monthKey(record) {
  const date = recordDate(record);
  if (date && !Number.isNaN(date.getTime())) {
    return dateMonthKey(date);
  }
  return record.date || 'Sem data';
}

function weekKey(record) {
  const date = recordDate(record);
  if (date && !Number.isNaN(date.getTime())) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `S${String(weekNo).padStart(2, '0')} (${d.getUTCFullYear()})`;
  }
  return 'Sem semana';
}

function dayKey(record) {
  const date = recordDate(record);
  if (date && !Number.isNaN(date.getTime())) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  return 'Sem data';
}

function shortLabel(value, size = 18) {
  const text = String(value || 'Sem nome');
  return text.length > size ? `${text.slice(0, size)}...` : text;
}

function resolvePlantsAtual(record) {
  const raw = record.raw || {};
  const lines = record.lines || [];
  return firstNumber([raw], [
    'total_plantas_parcela',
    'TotalPlantasParcela',
    'n_plantas_atual',
    'Nº de plantas Atual',
    'N de plantas Atual',
    'NumeroPlantasAtual',
    'numero_plantas_atual',
    'numPlantasPlantio',
    'plantas_atual',
  ]) || sumLineKeys(lines, ['numero_plantas_linha', 'NumeroPlantasLinha'])
    || record.totals?.plantasLinha
    || record.totals?.plantasObservadas
    || 0;
}

function sourceNumber(row, keys) {
  return firstNumber([row], keys);
}

function buildBalanceContext(balanceData = {}) {
  const byMonth = new Map();
  const weightByMonth = new Map();
  const byFarm = new Map();
  const byFarmMonth = new Map();
  const legacyEntradaMonths = Array.isArray(balanceData?.entradaDeCff?.byMonth)
    ? balanceData.entradaDeCff.byMonth
    : [];
  const productionMonths = Array.isArray(balanceData?.producao?.byMonth)
    ? balanceData.producao.byMonth
    : legacyEntradaMonths;
  const weightMonths = Array.isArray(balanceData?.pesoMedioCacho?.byMonth)
    ? balanceData.pesoMedioCacho.byMonth
    : legacyEntradaMonths;

  productionMonths.forEach((row) => {
    const key = normalizeMonthKey(row.monthKey || row.mesKey || row.monthLabel || row.mes || row.data);
    if (!key) return;

    const pesoLiquidoKg = sourceNumber(row, ['pesoLiquidoKg', 'peso_liquido_kg', 'Peso Liquido', 'pesoLiquido']);
    const cachos = sourceNumber(row, ['cachos', 'totalCachos', 'qtdCachos', 'quantidade_cachos']);
    const producedTon = sourceNumber(row, ['pesoT', 'pesoTon', 'pesoLiquidoT', 'producao_t'])
      || (pesoLiquidoKg > 0 ? pesoLiquidoKg / 1000 : 0);

    byMonth.set(key, {
      key,
      producedTon,
      pesoLiquidoKg,
      cachos,
      averageBunchKg: pesoLiquidoKg > 0 && cachos > 0 ? pesoLiquidoKg / cachos : 0,
    });
  });

  weightMonths.forEach((row) => {
    const key = normalizeMonthKey(row.monthKey || row.mesKey || row.monthLabel || row.mes || row.data);
    if (!key) return;
    const pesoLiquidoKg = sourceNumber(row, ['pesoLiquidoKg', 'peso_liquido_kg', 'Peso Liquido', 'pesoLiquido']);
    const cachos = sourceNumber(row, ['cachos', 'totalCachos', 'qtdCachos', 'quantidade_cachos']);
    const averageBunchKg = sourceNumber(row, ['averageBunchKg', 'pesoMedioKg', 'peso_medio_kg'])
      || (pesoLiquidoKg > 0 && cachos > 0 ? pesoLiquidoKg / cachos : 0);
    if (averageBunchKg <= 0) return;
    weightByMonth.set(key, {
      key,
      pesoLiquidoKg,
      cachos,
      averageBunchKg,
      complete: row.complete !== false,
    });
  });

  const dedicatedFarmRows = Array.isArray(balanceData?.producao?.byFarm)
    ? balanceData.producao.byFarm
    : [];
  const farmRows = dedicatedFarmRows.length ? dedicatedFarmRows : [
    ...(Array.isArray(balanceData?.cqoRampa?.byFarm) ? balanceData.cqoRampa.byFarm : []),
    ...(Array.isArray(balanceData?.cqoRampa?.byProducer) ? balanceData.cqoRampa.byProducer : []),
  ];
  farmRows.forEach((row) => {
    const farmKey = normalizeBalanceName(row.fazenda || row.fornecedor || row.produtor || row.nome_fazenda);
    if (!farmKey) return;
    const producedTon = sourceNumber(row, ['pesoT', 'pesoTon', 'pesoLiquidoT', 'producao_t'])
      || (sourceNumber(row, ['pesoLiquidoKg', 'peso_liquido_kg']) / 1000);
    if (producedTon > 0) byFarm.set(farmKey, { producedTon });
  });

  const dedicatedFarmMonthRows = Array.isArray(balanceData?.producao?.byFarmMonth)
    ? balanceData.producao.byFarmMonth
    : [];
  const dedicatedFarmPeriodRows = dedicatedFarmMonthRows.length
    ? dedicatedFarmMonthRows
    : (Array.isArray(balanceData?.producao?.byFarmDay) ? balanceData.producao.byFarmDay : []);
  const farmDayRows = dedicatedFarmPeriodRows.length ? dedicatedFarmPeriodRows : [
    ...(Array.isArray(balanceData?.cqoRampa?.byFarmMonth) ? balanceData.cqoRampa.byFarmMonth : []),
    ...(Array.isArray(balanceData?.cqoRampa?.byProducerDay) ? balanceData.cqoRampa.byProducerDay : []),
  ];
  farmDayRows.forEach((row) => {
    const farmKey = normalizeBalanceName(row.fazenda || row.fornecedor || row.produtor || row.nome_fazenda);
    const mKey = normalizeMonthKey(row.monthKey || row.mesKey || row.dayKey || row.dataKey || row.data);
    if (!farmKey || !mKey) return;

    const producedTon = sourceNumber(row, ['pesoT', 'pesoTon', 'pesoLiquidoT', 'producao_t'])
      || (sourceNumber(row, ['pesoLiquidoKg', 'peso_liquido_kg']) / 1000);
    if (producedTon <= 0) return;

    const key = `${farmKey}|${mKey}`;
    const current = byFarmMonth.get(key) || { producedTon: 0 };
    current.producedTon += producedTon;
    byFarmMonth.set(key, current);
  });

  return {
    byMonth,
    weightByMonth,
    byFarm,
    byFarmMonth,
    available: byMonth.size > 0 || weightByMonth.size > 0 || byFarm.size > 0 || byFarmMonth.size > 0,
  };
}

function resolvePreviousMonthWeightInfo(record, balanceContext) {
  const currentMonth = recordBalanceMonthKey(record);
  const targetMonth = previousMonthKey(currentMonth);
  const monthInfo = targetMonth ? balanceContext?.weightByMonth?.get(targetMonth) : null;
  if (!monthInfo?.averageBunchKg) return null;

  return {
    value: monthInfo.averageBunchKg,
    source: 'balanca_mes_anterior',
    monthKey: targetMonth,
  };
}

function resolveWeightInfo(record, type, balanceContext) {
  const previousMonthWeight = resolvePreviousMonthWeightInfo(record, balanceContext);
  if (previousMonthWeight) return previousMonthWeight;

  const raw = record.raw || {};
  const lines = record.lines || [];
  const keys = type === 'carreamento'
    ? ['peso_kg_carreamento', 'Peso Kg carreamento', 'peso_medio_carreamento', 'peso_medio', 'PesoMedio']
    : ['peso_kg_corte', 'Peso Kg CORTE', 'peso_medio_corte', 'peso_medio', 'PesoMedio'];

  const direct = firstNumber([raw, raw.medias, raw.peso_medio], keys);
  if (direct) return { value: direct, source: 'registro', monthKey: '' };

  const lineWeight = sumLineKeys(lines, keys);
  if (lineWeight && lines.length) return { value: lineWeight / lines.length, source: 'linhas', monthKey: '' };

  return { value: 0, source: 'indisponivel', monthKey: '' };
}

function resolveDirectLossTon(record, type) {
  const raw = record.raw || {};
  const lines = record.lines || [];
  const keys = type === 'carreamento'
    ? [
      'perdas_t_carreamento_bi',
      'perdas_t_bi',
      'perdas_t',
      'perdas t',
      'Perdas t',
      'perda_t',
      'Perda t',
      'perdasT',
    ]
    : [
      'perdas_t_corte_bi',
      'perdas_t_bi',
      'perdas_t',
      'perdas t',
      'Perdas t',
      'perda_t',
      'Perda t',
      'perdasT',
    ];

  const direct = firstDefinedNumber([raw, raw.bi, raw.fonte_excel], keys);
  if (direct !== null) return Math.max(0, direct);

  const lineTotal = sumLineKeysWhenPresent(lines, keys);
  return lineTotal === null ? null : Math.max(0, lineTotal);
}

function resolveEstimatedCachos(record, type) {
  const raw = record.raw || {};
  const lines = record.lines || [];
  const keys = type === 'carreamento'
    ? [
      'estimativa_cachos_nao_carreados_bi',
      'estimativa_cachos_perdidos_bi',
      'estimativa_perdas_cnc_pla',
      'estimativa de perdas cnc/pla',
      'estimativa_perdas',
    ]
    : [
      'estimativa_cachos_esquecidos_bi',
      'estimativa_cachos_perdidos_bi',
      'estimativa_cachos_perdidos',
      'estimativa_cacho_perdido_pla',
      'estimativa de cacho perdido/pla',
      'estimativa_perdas',
    ];

  const direct = firstDefinedNumber([raw, raw.bi, raw.fonte_excel], keys);
  if (direct !== null) return Math.max(0, direct);

  const lineTotal = sumLineKeysWhenPresent(lines, keys);
  return lineTotal === null ? null : Math.max(0, lineTotal);
}

function resolveProducedTon(record) {
  const raw = record.raw || {};
  return firstNumber([raw, raw.balanca, raw.facBalanca, raw.producao], [
    'liquido_t',
    'Liquido t',
    'liquidoT',
    'peso_t',
    'Peso t',
    'Peso t YTD',
    'volume_produzido_t',
    'volumeProduzidoT',
    'producao_t',
    'producaoTon',
    'toneladas',
  ]);
}

function resolveBalanceProducedTon(records, balanceContext, farmLabel = '') {
  if (!balanceContext?.available) return 0;

  const months = new Set(
    (records || [])
      .map(recordBalanceMonthKey)
      .filter(Boolean)
  );
  if (!months.size) return 0;

  const farmKey = normalizeBalanceName(farmLabel);
  if (farmKey) {
    const farmMonthTon = Array.from(months).reduce((sum, key) => (
      sum + Number(balanceContext.byFarmMonth.get(`${farmKey}|${key}`)?.producedTon || 0)
    ), 0);
    if (farmMonthTon > 0) return farmMonthTon;

    const farmTon = Number(balanceContext.byFarm.get(farmKey)?.producedTon || 0);
    if (farmTon > 0) return farmTon;
  }

  return Array.from(months).reduce((sum, key) => (
    sum + Number(balanceContext.byMonth.get(key)?.producedTon || 0)
  ), 0);
}

function bucketProducedTon(bucket, balanceContext, farmLabel = '') {
  if (bucket.producedTon > 0) return bucket.producedTon;
  return resolveBalanceProducedTon(bucket.records, balanceContext, farmLabel);
}

function computeRecordLoss(record, balanceContext) {
  if (record.type !== 'corte' && record.type !== 'carreamento') {
    return {
      corteT: 0,
      carreamentoT: 0,
      totalT: 0,
      producedTon: 0,
      estimatedCachos: 0,
      weightKg: 0,
      weightSource: '',
      weightMonthKey: '',
    };
  }

  const totals = record.totals || {};
  const plantasObservadas = totals.plantasObservadas || 0;
  const plantasAtual = resolvePlantsAtual(record);
  const producedTon = resolveProducedTon(record);

  if (record.type === 'carreamento') {
    const cachoNaoCarreado = totals.cachoNaoCarreado || 0;
    const weightInfo = resolveWeightInfo(record, 'carreamento', balanceContext);
    const pesoKg = weightInfo.value;
    const fallbackEstimatedCachos = plantasObservadas > 0 ? (cachoNaoCarreado / plantasObservadas) * plantasAtual : 0;
    const estimatedCachos = resolveEstimatedCachos(record, 'carreamento') ?? fallbackEstimatedCachos;
    const perdasT = resolveDirectLossTon(record, 'carreamento') ?? ((estimatedCachos * pesoKg) / 1000);
    return {
      corteT: 0,
      carreamentoT: perdasT,
      totalT: perdasT,
      producedTon,
      estimatedCachos,
      weightKg: pesoKg,
      weightSource: weightInfo.source,
      weightMonthKey: weightInfo.monthKey,
    };
  }

  const cachoEsquecido = totals.cachoEsquecido || 0;
  const weightInfo = resolveWeightInfo(record, 'corte', balanceContext);
  const pesoKg = weightInfo.value;
  const fallbackEstimatedCachos = plantasObservadas > 0 ? (cachoEsquecido / plantasObservadas) * plantasAtual : 0;
  const estimatedCachos = resolveEstimatedCachos(record, 'corte') ?? fallbackEstimatedCachos;
  const perdasT = resolveDirectLossTon(record, 'corte') ?? ((estimatedCachos * pesoKg) / 1000);
  return {
    corteT: perdasT,
    carreamentoT: 0,
    totalT: perdasT,
    producedTon,
    estimatedCachos,
    weightKg: pesoKg,
    weightSource: weightInfo.source,
    weightMonthKey: weightInfo.monthKey,
  };
}

function lossGroupKey(record) {
  const cycle = record.cycle || record.raw?.ciclo || record.raw?.Ciclo || 'sem-ciclo';
  return [
    record.type,
    normalizeBalanceName(record.farm),
    normalizeBalanceName(record.parcel),
    recordBalanceMonthKey(record) || record.id,
    normalizeBalanceName(cycle),
  ].join('|');
}

function consolidateEstimatedLosses(records, balanceContext) {
  const grouped = new Map();
  records.forEach((record) => {
    const key = lossGroupKey(record);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  });

  return Array.from(grouped.values()).map((groupRecords) => {
    const record = groupRecords[0];
    if (groupRecords.length === 1) {
      return { record, records: groupRecords, loss: computeRecordLoss(record, balanceContext) };
    }

    const directLosses = groupRecords.map((item) => resolveDirectLossTon(item, item.type));
    if (directLosses.some((value) => value !== null)) {
      const computed = groupRecords.map((item) => computeRecordLoss(item, balanceContext));
      return {
        record,
        records: groupRecords,
        loss: computed.reduce((acc, item) => ({
          corteT: acc.corteT + item.corteT,
          carreamentoT: acc.carreamentoT + item.carreamentoT,
          totalT: acc.totalT + item.totalT,
          producedTon: Math.max(acc.producedTon, item.producedTon),
          estimatedCachos: acc.estimatedCachos + item.estimatedCachos,
          weightKg: item.weightKg || acc.weightKg,
          weightSource: item.weightSource || acc.weightSource,
          weightMonthKey: item.weightMonthKey || acc.weightMonthKey,
        }), {
          corteT: 0,
          carreamentoT: 0,
          totalT: 0,
          producedTon: 0,
          estimatedCachos: 0,
          weightKg: 0,
          weightSource: '',
          weightMonthKey: '',
        }),
      };
    }

    const type = record.type;
    const plantasObservadas = groupRecords.reduce(
      (sum, item) => sum + Number(item.totals?.plantasObservadas || 0),
      0
    );
    const ocorrencias = groupRecords.reduce((sum, item) => sum + Number(
      type === 'carreamento'
        ? item.totals?.cachoNaoCarreado || 0
        : item.totals?.cachoEsquecido || 0
    ), 0);
    const plantasAtual = Math.max(...groupRecords.map(resolvePlantsAtual), 0);
    const estimatedCachos = plantasObservadas > 0
      ? (ocorrencias / plantasObservadas) * plantasAtual
      : 0;
    const weightInfo = resolveWeightInfo(record, type, balanceContext);
    const lossTon = weightInfo.value > 0 ? (estimatedCachos * weightInfo.value) / 1000 : 0;
    const producedTon = Math.max(...groupRecords.map(resolveProducedTon), 0);

    return {
      record,
      records: groupRecords,
      loss: {
        corteT: type === 'corte' ? lossTon : 0,
        carreamentoT: type === 'carreamento' ? lossTon : 0,
        totalT: lossTon,
        producedTon,
        estimatedCachos,
        weightKg: weightInfo.value,
        weightSource: weightInfo.source,
        weightMonthKey: weightInfo.monthKey,
      },
    };
  });
}

function createBucket(label) {
  return {
    label,
    records: [],
    corteT: 0,
    carreamentoT: 0,
    perdasT: 0,
    producedTon: 0,
  };
}

function pushBucket(map, key, records, loss) {
  if (!map.has(key)) map.set(key, createBucket(key));
  const bucket = map.get(key);
  bucket.records.push(...records);
  bucket.corteT += loss.corteT;
  bucket.carreamentoT += loss.carreamentoT;
  bucket.perdasT += loss.totalT;
  bucket.producedTon += loss.producedTon;
}

export function buildQualidadeOperacional(records, balanceData = null) {
  const balanceContext = buildBalanceContext(balanceData || {});
  const corteRecords = records.filter((record) => record.type === 'corte');
  const carreamentoRecords = records.filter((record) => record.type === 'carreamento');
  const corteTotals = aggregateRecords(corteRecords);
  const carreamentoTotals = aggregateRecords(carreamentoRecords);
  const allTotals = aggregateRecords(records);

  const lossRecords = records.filter((record) => record.type === 'corte' || record.type === 'carreamento');
  const losses = consolidateEstimatedLosses(lossRecords, balanceContext);
  const totals = losses.reduce((acc, item) => {
    acc.corteT += item.loss.corteT;
    acc.carreamentoT += item.loss.carreamentoT;
    acc.perdasT += item.loss.totalT;
    acc.producedTon += item.loss.producedTon;
    acc.estimatedCachos += item.loss.estimatedCachos;
    return acc;
  }, {
    corteT: 0,
    carreamentoT: 0,
    perdasT: 0,
    producedTon: 0,
    estimatedCachos: 0,
  });
  if (totals.producedTon <= 0) {
    totals.producedTon = resolveBalanceProducedTon(records, balanceContext);
  }

  const weightTotals = losses.reduce((acc, item) => {
    if (!item.loss.weightKg || item.loss.estimatedCachos <= 0) return acc;
    acc.weightedKg += item.loss.weightKg * item.loss.estimatedCachos;
    acc.weight += item.loss.estimatedCachos;
    if (item.loss.weightSource === 'balanca_mes_anterior') acc.usesPreviousMonthWeight = true;
    if (item.loss.weightMonthKey) acc.months.add(item.loss.weightMonthKey);
    return acc;
  }, {
    weightedKg: 0,
    weight: 0,
    usesPreviousMonthWeight: false,
    months: new Set(),
  });

  const qualidadeBase = Math.max(corteTotals.cachosObservados, 0);
  const quality = {
    cachoMaduroPct: safePct(corteTotals.cachoMaduro, qualidadeBase),
    cachoVerdePct: safePct(corteTotals.cachoVerde, qualidadeBase),
    cachoPassadoPct: safePct(corteTotals.cachoPassado, qualidadeBase),
    cachoAvermelhadoPct: safePct(corteTotals.cachoAvermelhado, qualidadeBase),
    cachoEstrelaPct: safePct(corteTotals.cachoEstrela, qualidadeBase),
    cachoInfermoPct: safePct(corteTotals.cachoInfermo, qualidadeBase),
    buchaPct: safePct(corteTotals.bucha, qualidadeBase),
    taloCompridoPct: safePct(corteTotals.taloComprido, qualidadeBase),
  };

  const percentBase = productionPotentialTon(totals.producedTon, totals.perdasT);
  const lossRates = {
    cortePct: safePct(totals.corteT, percentBase),
    carreamentoPct: safePct(totals.carreamentoT, percentBase),
    totalPct: safePct(totals.perdasT, percentBase),
  };

  const byFarm = new Map();
  const byMonth = new Map();
  const byParcela = new Map();
  const byFiscal = new Map();
  const byWeek = new Map();
  const byDay = new Map();

  losses.forEach(({ record, records: groupedRecords, loss }) => {
    pushBucket(byFarm, record.farm || 'Sem fazenda', groupedRecords, loss);
    pushBucket(byMonth, monthKey(record), groupedRecords, loss);
    pushBucket(byParcela, record.parcel || 'Sem parcela', groupedRecords, loss);
    
    // Novas agregações para o painel estilo Power BI
    const fiscalLabel = record.fiscal && record.fiscal !== '--' ? record.fiscal : 'Sem fiscal';
    pushBucket(byFiscal, fiscalLabel, groupedRecords, loss);
    pushBucket(byWeek, weekKey(record), groupedRecords, loss);
    
    const dKey = `${dayKey(record)} - ${record.farm || 'Sem fazenda'} - ${record.parcel || 'Sem parcela'}`;
    pushBucket(byDay, dKey, groupedRecords, loss);
  });

  const farmRows = Array.from(byFarm.values())
    .map((bucket) => {
      const producedTon = bucketProducedTon(bucket, balanceContext, bucket.label);
      const productionPotential = productionPotentialTon(producedTon, bucket.perdasT);
      return {
        ...bucket,
        producedTon,
        productionPotentialTon: productionPotential,
        cortePct: safePct(bucket.corteT, productionPotential),
        carreamentoPct: safePct(bucket.carreamentoT, productionPotential),
        totalPct: safePct(bucket.perdasT, productionPotential),
        qualidade: aggregateRecords(bucket.records),
      };
    })
    .sort((a, b) => b.perdasT - a.perdasT);

  const monthRows = Array.from(byMonth.values())
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
    .map((bucket) => {
      const producedTon = bucketProducedTon(bucket, balanceContext);
      const productionPotential = productionPotentialTon(producedTon, bucket.perdasT);
      return {
        ...bucket,
        producedTon,
        productionPotentialTon: productionPotential,
        totalPct: safePct(bucket.perdasT, productionPotential),
      };
    });

  const parcelaRows = Array.from(byParcela.values())
    .map((bucket) => {
      const agg = aggregateRecords(bucket.records);
      const baseQualidade = Math.max(agg.cachosObservados, 0);
      const basePlantas = Math.max(agg.plantasObservadas, 0);
      return {
        label: bucket.label,
        recordsCount: bucket.records.length,
        perdasT: bucket.perdasT,
        taloCompridoPct: safePct(agg.taloComprido, basePlantas),
        cachoVerdePct: safePct(agg.cachoVerde, baseQualidade),
        cachoPassadoPct: safePct(agg.cachoPassado, baseQualidade),
        folhaMamandoPct: safePct(agg.folhaMamando, basePlantas),
        folhaMamando: agg.folhaMamando,
        cachoBrocadoPct: safePct(agg.cachoBrocado, baseQualidade),
      };
    })
    .sort((a, b) => b.perdasT - a.perdasT);

  const formatQualityRow = (bucket) => {
    const agg = aggregateRecords(bucket.records);
    const base = Math.max(agg.cachosObservados, 0);
    const producedTon = bucketProducedTon(bucket, balanceContext);
    const productionPotential = productionPotentialTon(producedTon, bucket.perdasT);
    return {
      label: bucket.label,
      recordsCount: bucket.records.length,
      cachoMaduroPct: safePct(agg.cachoMaduro, base),
      cachoVerdePct: safePct(agg.cachoVerde, base),
      cachoPassadoPct: safePct(agg.cachoPassado, base),
      cachoAvermelhadoPct: safePct(agg.cachoAvermelhado, base),
      cachoInfermoPct: safePct(agg.cachoInfermo, base),
      buchaPct: safePct(agg.bucha, base),
      taloCompridoPct: safePct(agg.taloComprido, Math.max(agg.plantasObservadas, 0)),
      cachoEstrelaPct: safePct(agg.cachoEstrela, base),
      corteT: bucket.corteT,
      carreamentoT: bucket.carreamentoT,
      producedTon,
      productionPotentialTon: productionPotential,
      cortePct: safePct(bucket.corteT, productionPotential),
      carreamentoPct: safePct(bucket.carreamentoT, productionPotential),
    };
  };

  const evaluatorRows = Array.from(byFiscal.values())
    .map(formatQualityRow)
    .sort((a, b) => b.recordsCount - a.recordsCount);

  const qualityMonthRows = Array.from(byMonth.values())
    .map(formatQualityRow)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));

  const weekRows = Array.from(byWeek.values())
    .map(formatQualityRow)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));

  const dayRows = Array.from(byDay.values())
    .map(formatQualityRow)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));

  let perdasYtd = 0;
  let pesoYtd = 0;
  const monthlyChart = monthRows.map((bucket) => {
    perdasYtd += bucket.perdasT;
    pesoYtd += bucket.producedTon;
    const potentialYtd = productionPotentialTon(pesoYtd, perdasYtd);
    return {
      label: bucket.label,
      value: Number(safePct(bucket.perdasT, bucket.productionPotentialTon).toFixed(2)),
      perdasT: Number(bucket.perdasT.toFixed(2)),
      perdasYtd: Number(perdasYtd.toFixed(2)),
      pesoYtd: Number(pesoYtd.toFixed(2)),
      productionPotentialYtd: Number(potentialYtd.toFixed(2)),
    };
  });

  const projection = monthRows.length
    ? monthRows.reduce((sum, item) => sum + item.totalPct, 0) / monthRows.length * 0.8
    : 0;

  return {
    records,
    corteRecords,
    carreamentoRecords,
    allTotals,
    corteTotals,
    carreamentoTotals,
    totals,
    quality,
    lossRates,
    projection,
    hasProductionBase: percentBase > 0,
    balance: {
      hasBalanceSource: balanceContext.available,
      hasProductionBase: totals.producedTon > 0,
      productionBaseTon: totals.producedTon,
      productionPotentialTon: percentBase,
      averageWeightKg: weightTotals.weight ? weightTotals.weightedKg / weightTotals.weight : 0,
      usesPreviousMonthWeight: weightTotals.usesPreviousMonthWeight,
      weightMonthKeys: Array.from(weightTotals.months).sort(),
      readiness: balanceData?.readiness || null,
      weightAvailability: balanceData?.pesoMedioCacho?.status || 'unknown',
      weightCompetencies: Array.isArray(balanceData?.pesoMedioCacho?.competencies)
        ? balanceData.pesoMedioCacho.competencies
        : [],
      weightSource: balanceData?.metadata?.weightSource || '',
      productionSource: balanceData?.metadata?.productionSource || '',
    },
    charts: {
      qualidade: [
        { label: 'Maduro', value: Number(quality.cachoMaduroPct.toFixed(1)), fill: '#234F2A' },
        { label: 'Verde', value: Number(quality.cachoVerdePct.toFixed(1)), fill: '#65A30D' },
        { label: 'Passado', value: Number(quality.cachoPassadoPct.toFixed(1)), fill: '#D98C10' },
        { label: 'Avermelhado', value: Number(quality.cachoAvermelhadoPct.toFixed(1)), fill: '#B45309' },
        { label: 'Estrela', value: Number(quality.cachoEstrelaPct.toFixed(1)), fill: '#F2B544' },
        { label: 'Infermo', value: Number(quality.cachoInfermoPct.toFixed(1)), fill: '#EF4444' },
        { label: 'Bucha', value: Number(quality.buchaPct.toFixed(1)), fill: '#64748B' },
        { label: 'Talo', value: Number(quality.taloCompridoPct.toFixed(1)), fill: '#64748B' },
      ],
      perdasPorFazenda: farmRows.slice(0, 10).map((item) => ({
        label: shortLabel(item.label),
        value: Number(item.perdasT.toFixed(2)),
        fill: item.totalPct > QUALITY_LOSS_LIMITS.totalPct ? '#DC2626' : '#234F2A',
      })),
      perdasPctMensal: monthlyChart,
    },
    farmRows,
    parcelaRows,
    evaluatorRows,
    monthRows: qualityMonthRows,
    weekRows,
    dayRows,
  };
}
