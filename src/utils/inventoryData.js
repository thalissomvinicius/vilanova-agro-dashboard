import { useEffect, useMemo, useState } from 'react';
import {
  ACTIVE_CQO_FARM_IDS,
  dashboardErrorMessage,
  normalizeCqoFarmId,
  normalizeText,
  SUPABASE_CONFIG,
} from './cqoData';

const INVENTORY_SELECT = [
  'id',
  'nome_fazenda',
  'parcela',
  'parcela_base',
  'bloco',
  'ano_plantio',
  'cultivar',
  'area_ha',
  'plantas',
  'densidade',
  'sequencia_plantio',
  'quantidade_anos_parcela',
  'shap_ids',
  'source_file',
  'source_sheet',
  'source_rows',
  'atualizado_em',
].join(',');

export function normalizeInventoryRecord(record = {}) {
  const farmName = record.nome_fazenda ?? record.farmName ?? '';
  const parcel = String(record.parcela ?? record.parcel ?? '').trim();
  return {
    ...record,
    id: String(record.id || `${normalizeCqoFarmId(farmName)}-${parcel}-${record.ano_plantio ?? record.year ?? ''}`),
    farmId: record.farmId || normalizeCqoFarmId(farmName),
    farmName,
    year: record.ano_plantio ?? record.year ?? null,
    block: record.bloco ?? record.block ?? '',
    parcel,
    parcelBase: String(record.parcela_base ?? record.parcelBase ?? parcel.replace(/\.\d+$/, '')).trim(),
    sequence: Number(record.sequencia_plantio ?? record.sequence ?? 1),
    yearsCount: Number(record.quantidade_anos_parcela ?? record.yearsCount ?? 1),
    plants: Number(record.plantas ?? record.plants ?? 0),
    plantsPerHa: Number(record.densidade ?? record.plantsPerHa ?? 0),
    areaHa: Number(record.area_ha ?? record.areaHa ?? 0),
    cultivar: record.cultivar || '',
    shapeIds: (Array.isArray(record.shap_ids) ? record.shap_ids : record.shapeIds || []).map(String),
    sourceFile: record.source_file ?? record.sourceFile ?? '',
    sheet: record.source_sheet ?? record.sheet ?? '',
    sourceRows: record.source_rows ?? record.sourceRows ?? [],
    updatedAt: record.atualizado_em ?? record.updatedAt ?? '',
  };
}

function normalizeParcelIdentity(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function inventoryRecordForShape(records, properties = {}) {
  const objectId = String(properties.OBJECTID ?? properties.objectid ?? properties.objectId ?? '').trim();
  if (!objectId) return null;
  return records.find((record) => (
    record.farmId === properties.farmId
    && record.shapeIds?.includes(objectId)
  )) || null;
}

export function cqoRecordMatchesInventoryParcel(record, inventoryRecord) {
  if (!inventoryRecord) return false;
  const exactGeneratedParcel = normalizeParcelIdentity(record.parcel)
    === normalizeParcelIdentity(inventoryRecord.parcel);
  const sameBaseAndYear = normalizeParcelIdentity(String(record.parcel || '').replace(/\.\d+$/, ''))
    === normalizeParcelIdentity(inventoryRecord.parcelBase)
    && String(record.plantingYear || '') === String(inventoryRecord.year || '');
  const singleYearBase = inventoryRecord.yearsCount <= 1
    && normalizeParcelIdentity(record.parcel) === normalizeParcelIdentity(inventoryRecord.parcelBase);
  return exactGeneratedParcel || sameBaseAndYear || singleYearBase;
}

export function inventoryRecordForCqoRecord(records, cqoRecord) {
  return records.find((inventoryRecord) => (
    inventoryRecord.farmId === cqoRecord.farmId
    && cqoRecordMatchesInventoryParcel(cqoRecord, inventoryRecord)
  )) || null;
}

async function fetchSnapshotInventory() {
  const response = await fetch('/data/inventory-parcels.json');
  if (!response.ok) throw new Error(`Inventario: HTTP ${response.status}`);
  const data = await response.json();
  return {
    ...data,
    records: (Array.isArray(data.records) ? data.records : []).map(normalizeInventoryRecord),
    source: 'Snapshot offline do inventário',
  };
}

export async function fetchInventoryData() {
  if (!SUPABASE_CONFIG.isConfigured) return fetchSnapshotInventory();

  const params = new URLSearchParams({
    select: INVENTORY_SELECT,
    ativo: 'eq.true',
    order: 'nome_fazenda.asc,parcela.asc,ano_plantio.asc',
    limit: '1000',
  });
  const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/inventario_parcelas?${params}`, {
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Inventário Supabase: HTTP ${response.status}`);
  const rows = await response.json();
  return {
    records: (Array.isArray(rows) ? rows : []).map(normalizeInventoryRecord),
    summary: null,
    source: 'Supabase / inventario_parcelas',
    generatedAt: new Date().toISOString(),
    notes: [],
  };
}

export function useInventoryData() {
  const [state, setState] = useState({
    loading: true,
    records: [],
    summary: null,
    source: 'Carregando',
    error: '',
  });

  useEffect(() => {
    let mounted = true;

    fetchInventoryData()
      .catch(() => fetchSnapshotInventory())
      .then((data) => {
        if (!mounted) return;
        setState({
          loading: false,
          records: Array.isArray(data.records) ? data.records : [],
          summary: data.summary || null,
          source: data.source || 'Inventário de parcelas',
          generatedAt: data.generatedAt,
          notes: data.notes || [],
          error: '',
        });
      })
      .catch((error) => {
        if (!mounted) return;
        setState({
          loading: false,
          records: [],
          summary: null,
          source: 'Inventario indisponivel',
          error: dashboardErrorMessage(error, 'Base de inventário indisponível.'),
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

export function filterInventory(records, { farmFilter = 'all', searchTerm = '', yearFilter = 'all', cultivarFilter = 'all' } = {}) {
  const search = normalizeText(searchTerm);
  return records.filter((record) => {
    const activeFarmOk = ACTIVE_CQO_FARM_IDS.includes(record.farmId);
    const farmOk = farmFilter === 'all' || record.farmId === farmFilter;
    const yearOk = yearFilter === 'all' || String(record.year) === String(yearFilter);
    const cultivarOk = cultivarFilter === 'all' || normalizeText(record.cultivar) === normalizeText(cultivarFilter);
    const haystack = normalizeText([
      record.farmName,
      record.year,
      record.block,
      record.parcel,
      record.cultivar,
      record.sourceFile,
    ].join(' '));
    return activeFarmOk && farmOk && yearOk && cultivarOk && (!search || haystack.includes(search));
  });
}

export function aggregateInventory(records) {
  const totals = records.reduce((acc, record) => {
    acc.parcels += 1;
    acc.plants += Number(record.plants || 0);
    acc.areaHa += Number(record.areaHa || 0);
    if (record.originalPlants) acc.corrected += 1;

    const year = String(record.year);
    acc.years.add(year);
    acc.blocks.add(record.block);
    acc.cultivars.add(record.cultivar);

    const farmBucket = acc.byFarm.get(record.farmName) || { label: record.farmName, value: 0, areaHa: 0, fill: '#234F2A' };
    farmBucket.value += 1;
    farmBucket.areaHa += Number(record.areaHa || 0);
    acc.byFarm.set(record.farmName, farmBucket);

    const yearBucket = acc.byYear.get(year) || { label: year, value: 0, fill: '#D98C10' };
    yearBucket.value += 1;
    acc.byYear.set(year, yearBucket);

    return acc;
  }, {
    parcels: 0,
    plants: 0,
    areaHa: 0,
    corrected: 0,
    years: new Set(),
    blocks: new Set(),
    cultivars: new Set(),
    byFarm: new Map(),
    byYear: new Map(),
  });

  return {
    parcels: totals.parcels,
    plants: totals.plants,
    areaHa: totals.areaHa,
    corrected: totals.corrected,
    averagePlantsPerHa: totals.areaHa ? totals.plants / totals.areaHa : 0,
    years: Array.from(totals.years).sort(),
    blocks: Array.from(totals.blocks).sort(),
    cultivars: Array.from(totals.cultivars).sort((a, b) => a.localeCompare(b)),
    byFarm: Array.from(totals.byFarm.values()).sort((a, b) => b.value - a.value),
    byYear: Array.from(totals.byYear.values()).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export function useInventoryDashboard(filters) {
  const data = useInventoryData();
  const records = useMemo(() => filterInventory(data.records, filters), [data.records, filters]);
  const totals = useMemo(() => aggregateInventory(records), [records]);
  const availableYears = useMemo(() => aggregateInventory(data.records).years, [data.records]);
  const availableCultivars = useMemo(() => aggregateInventory(data.records).cultivars, [data.records]);

  return {
    ...data,
    records,
    totals,
    availableYears,
    availableCultivars,
  };
}
