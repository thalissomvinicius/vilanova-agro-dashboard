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

function monthKey(record) {
  const date = recordDate(record);
  if (date && !Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

function resolveWeightKg(record, type) {
  const raw = record.raw || {};
  const lines = record.lines || [];
  const keys = type === 'carreamento'
    ? ['peso_kg_carreamento', 'Peso Kg carreamento', 'peso_medio_carreamento', 'peso_medio', 'PesoMedio']
    : ['peso_kg_corte', 'Peso Kg CORTE', 'peso_medio_corte', 'peso_medio', 'PesoMedio'];

  const direct = firstNumber([raw, raw.medias, raw.peso_medio], keys);
  if (direct) return direct;

  const lineWeight = sumLineKeys(lines, keys);
  if (lineWeight && lines.length) return lineWeight / lines.length;

  return 20;
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

function computeRecordLoss(record) {
  if (record.type !== 'corte' && record.type !== 'carreamento') {
    return { corteT: 0, carreamentoT: 0, totalT: 0, producedTon: 0, estimatedCachos: 0 };
  }

  const totals = record.totals || {};
  const plantasObservadas = totals.plantasObservadas || 0;
  const plantasAtual = resolvePlantsAtual(record);
  const producedTon = resolveProducedTon(record);

  if (record.type === 'carreamento') {
    const cachoNaoCarreado = totals.cachoNaoCarreado || 0;
    const pesoKg = resolveWeightKg(record, 'carreamento');
    const fallbackEstimatedCachos = plantasObservadas > 0 ? (cachoNaoCarreado / plantasObservadas) * plantasAtual : 0;
    const estimatedCachos = resolveEstimatedCachos(record, 'carreamento') ?? fallbackEstimatedCachos;
    const perdasT = resolveDirectLossTon(record, 'carreamento') ?? ((estimatedCachos * pesoKg) / 1000);
    return { corteT: 0, carreamentoT: perdasT, totalT: perdasT, producedTon, estimatedCachos };
  }

  const cachoEsquecido = totals.cachoEsquecido || 0;
  const pesoKg = resolveWeightKg(record, 'corte');
  const fallbackEstimatedCachos = plantasObservadas > 0 ? (cachoEsquecido / plantasObservadas) * plantasAtual : 0;
  const estimatedCachos = resolveEstimatedCachos(record, 'corte') ?? fallbackEstimatedCachos;
  const perdasT = resolveDirectLossTon(record, 'corte') ?? ((estimatedCachos * pesoKg) / 1000);
  return { corteT: perdasT, carreamentoT: 0, totalT: perdasT, producedTon, estimatedCachos };
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

function pushBucket(map, key, record, loss) {
  if (!map.has(key)) map.set(key, createBucket(key));
  const bucket = map.get(key);
  bucket.records.push(record);
  bucket.corteT += loss.corteT;
  bucket.carreamentoT += loss.carreamentoT;
  bucket.perdasT += loss.totalT;
  bucket.producedTon += loss.producedTon;
}

export function buildQualidadeOperacional(records) {
  const corteRecords = records.filter((record) => record.type === 'corte');
  const carreamentoRecords = records.filter((record) => record.type === 'carreamento');
  const corteTotals = aggregateRecords(corteRecords);
  const carreamentoTotals = aggregateRecords(carreamentoRecords);
  const allTotals = aggregateRecords(records);

  const losses = records.map((record) => ({ record, loss: computeRecordLoss(record) }));
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

  const percentBase = totals.producedTon;
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

  losses.forEach(({ record, loss }) => {
    pushBucket(byFarm, record.farm || 'Sem fazenda', record, loss);
    pushBucket(byMonth, monthKey(record), record, loss);
    pushBucket(byParcela, record.parcel || 'Sem parcela', record, loss);
    
    // Novas agregações para o painel estilo Power BI
    const fiscalLabel = record.fiscal && record.fiscal !== '--' ? record.fiscal : 'Sem fiscal';
    pushBucket(byFiscal, shortLabel(fiscalLabel), record, loss);
    pushBucket(byWeek, weekKey(record), record, loss);
    
    const dKey = `${dayKey(record)} - ${record.farm || 'Sem fazenda'} - ${record.parcel || 'Sem parcela'}`;
    pushBucket(byDay, dKey, record, loss);
  });

  const farmRows = Array.from(byFarm.values())
    .map((bucket) => ({
      ...bucket,
      cortePct: safePct(bucket.corteT, bucket.producedTon),
      carreamentoPct: safePct(bucket.carreamentoT, bucket.producedTon),
      totalPct: safePct(bucket.perdasT, bucket.producedTon),
      qualidade: aggregateRecords(bucket.records),
    }))
    .sort((a, b) => b.perdasT - a.perdasT);

  const monthRows = Array.from(byMonth.values())
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
    .map((bucket) => ({
      ...bucket,
      totalPct: safePct(bucket.perdasT, bucket.producedTon),
    }));

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
      cortePct: safePct(bucket.corteT, bucket.producedTon),
      carreamentoPct: safePct(bucket.carreamentoT, bucket.producedTon),
    };
  };

  const evaluatorRows = Array.from(byFiscal.values())
    .map(formatQualityRow)
    .sort((a, b) => b.recordsCount - a.recordsCount);

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
    return {
      label: bucket.label,
      value: Number(safePct(bucket.perdasT, bucket.producedTon).toFixed(2)),
      perdasT: Number(bucket.perdasT.toFixed(2)),
      perdasYtd: Number(perdasYtd.toFixed(2)),
      pesoYtd: Number(pesoYtd.toFixed(2)),
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
    weekRows,
    dayRows,
  };
}
