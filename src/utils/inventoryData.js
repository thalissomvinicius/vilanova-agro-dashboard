import { useEffect, useMemo, useState } from 'react';
import { ACTIVE_CQO_FARM_IDS, normalizeText } from './cqoData';

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

    fetch('/data/inventory-parcels.json')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!mounted) return;
        setState({
          loading: false,
          records: Array.isArray(data.records) ? data.records : [],
          summary: data.summary || null,
          source: 'Excel historico / Inventario',
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
          error: error.message,
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
