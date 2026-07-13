import { describe, expect, it } from 'vitest';
import { aggregateInventory, filterInventory } from './inventoryData';

const records = [
  {
    farmId: 'vila-nova',
    farmName: 'Vila Nova',
    year: 2026,
    block: 'B1',
    parcel: 'P-01',
    cultivar: 'BRS Manicore',
    sourceFile: 'inventario.xlsx',
    plants: 1200,
    areaHa: 10,
    originalPlants: 1100,
  },
  {
    farmId: 'fe-em-deus',
    farmName: 'Fe em Deus',
    year: 2025,
    block: 'B2',
    parcel: 'P-02',
    cultivar: 'Deli x Ghana',
    sourceFile: 'inventario.xlsx',
    plants: 800,
    areaHa: 8,
  },
  {
    farmId: 'rio-capim',
    farmName: 'Rio Capim',
    year: 2026,
    block: 'B3',
    parcel: 'P-03',
    cultivar: 'Fora do escopo',
    sourceFile: 'inventario.xlsx',
    plants: 500,
    areaHa: 5,
  },
];

describe('filterInventory', () => {
  it('filtra por fazenda, ano, cultivar e busca textual', () => {
    const filtered = filterInventory(records, {
      farmFilter: 'vila-nova',
      yearFilter: 2026,
      cultivarFilter: 'BRS Manicoré',
      searchTerm: 'P-01',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].parcel).toBe('P-01');
  });

  it('remove fazendas fora do escopo ativo CQO', () => {
    const filtered = filterInventory(records, { yearFilter: 'all' });

    expect(filtered.map((item) => item.farmId)).toEqual(['vila-nova', 'fe-em-deus']);
  });
});

describe('aggregateInventory', () => {
  it('soma parcelas, plantas, area e buckets principais', () => {
    const summary = aggregateInventory(records.slice(0, 2));

    expect(summary.parcels).toBe(2);
    expect(summary.plants).toBe(2000);
    expect(summary.areaHa).toBe(18);
    expect(summary.corrected).toBe(1);
    expect(summary.averagePlantsPerHa).toBeCloseTo(111.11, 2);
    expect(summary.years).toEqual(['2025', '2026']);
    expect(summary.byFarm).toHaveLength(2);
    expect(summary.byYear.map((item) => item.label)).toEqual(['2025', '2026']);
  });
});
