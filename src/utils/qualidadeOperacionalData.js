import { aggregateRecords } from './cqoData';

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

function sumLineKeys(lines, keys) {
  return (lines || []).reduce((total, line) => total + firstNumber([line], keys), 0);
}

function safePct(num, den) {
  return den > 0 ? (num / den) * 100 : 0;
}

function monthKey(record) {
  const date = new Date(record.createdAt || record.sentAt || record.raw?.data_avaliacao || '');
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  return record.date || 'Sem data';
}

function shortLabel(value, size = 18) {
  const text = String(value || 'Sem nome');
  return text.length > size ? `${text.slice(0, size)}...` : text;
}

function resolvePlantsAtual(record) {
  const raw = record.raw || {};
  const lines = record.lines || [];
  return firstNumber([raw], [
    'n_plantas_atual',
    'N de plantas Atual',
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
  const totals = record.totals || {};
  const plantasObservadas = totals.plantasObservadas || 0;
  const plantasAtual = resolvePlantsAtual(record);
  const producedTon = resolveProducedTon(record);

  if (record.type === 'carreamento') {
    const cachoNaoCarreado = totals.cachoNaoCarreado || 0;
    const pesoKg = resolveWeightKg(record, 'carreamento');
    const estimatedCachos = plantasObservadas > 0 ? (cachoNaoCarreado / plantasObservadas) * plantasAtual : 0;
    const perdasT = (estimatedCachos * pesoKg) / 1000;
    return { corteT: 0, carreamentoT: perdasT, totalT: perdasT, producedTon, estimatedCachos };
  }

  const cachoEsquecido = totals.cachoEsquecido || 0;
  const pesoKg = resolveWeightKg(record, 'corte');
  const estimatedCachos = plantasObservadas > 0 ? (cachoEsquecido / plantasObservadas) * plantasAtual : 0;
  const perdasT = (estimatedCachos * pesoKg) / 1000;
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
  losses.forEach(({ record, loss }) => {
    pushBucket(byFarm, record.farm || 'Sem fazenda', record, loss);
    pushBucket(byMonth, monthKey(record), record, loss);
    pushBucket(byParcela, record.parcel || 'Sem parcela', record, loss);
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
  };
}
