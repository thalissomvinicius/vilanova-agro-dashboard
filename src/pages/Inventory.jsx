import React, { useState } from 'react';
import {
  FileSpreadsheet,
  MapPin,
  Rows3,
  Sprout,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import EmptyTableRow from '../components/ui/EmptyTableRow';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import StatusBanner from '../components/ui/StatusBanner';
import { useInventoryDashboard } from '../utils/inventoryData';

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

export default function Inventory({ farmFilter, searchTerm }) {
  const [yearFilter, setYearFilter] = useState('all');
  const [cultivarFilter, setCultivarFilter] = useState('all');
  const {
    loading,
    records,
    source,
    error,
    generatedAt,
    totals,
    availableYears,
    availableCultivars,
  } = useInventoryDashboard({
    farmFilter,
    searchTerm,
    yearFilter,
    cultivarFilter,
  });

  return (
    <div className="fade-in page-shell inventory-page">
      <PageHeader
        variant="dashboard"
        className="inventory-hero"
        eyebrow="Inventário agrícola"
        title="Inventário de Parcelas das Fazendas"
        description="Base histórica importada dos Excel de inventário para consulta por fazenda, ano de plantio, bloco, parcela e cultivar."
      >
        <div className="operational-hero-stats">
          <div><span>Parcelas</span><strong>{formatNumber(totals.parcels)}</strong></div>
          <div><span>Área</span><strong>{formatNumber(totals.areaHa, 1)} ha</strong></div>
          <div><span>Plantas</span><strong>{formatNumber(totals.plants)}</strong></div>
          <div><span>Cultivares</span><strong>{formatNumber(totals.cultivars.length)}</strong></div>
        </div>
      </PageHeader>

      <div className="operational-filter-bar inventory-filter-bar">
        <label className="operational-select-control">
          <span>Ano de plantio</span>
          <select
            className="header-filter-select"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            title="Ano de plantio"
          >
            <option value="all">Todos os anos</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
        <label className="operational-select-control">
          <span>Cultivar</span>
          <select
            className="header-filter-select"
            value={cultivarFilter}
            onChange={(event) => setCultivarFilter(event.target.value)}
            title="Cultivar"
          >
            <option value="all">Todos os cultivares</option>
            {availableCultivars.map((cultivar) => (
              <option key={cultivar} value={cultivar}>{cultivar}</option>
            ))}
          </select>
        </label>
          <div className="source-card compact">
            <span>Fonte</span>
            <strong>{loading ? 'Carregando...' : source}</strong>
            <small>{generatedAt ? `Gerado em ${new Date(generatedAt).toLocaleString('pt-BR')}` : 'Aguardando leitura'}</small>
          </div>
      </div>

      {error ? (
        <StatusBanner tone="danger">
          Não foi possível carregar o inventário: {error}
        </StatusBanner>
      ) : null}

      <div className="grid-container grid-cols-4">
        <MetricCard
          variant="kpi"
          title="Parcelas"
          value={formatNumber(totals.parcels)}
          footer={`${formatNumber(totals.blocks.length)} blocos no filtro`}
          icon={Rows3}
          tone="green"
          loading={loading}
        />
        <MetricCard
          variant="kpi"
          title="Área inventariada"
          value={`${formatNumber(totals.areaHa, 2)} ha`}
          footer={`${formatNumber(totals.years.length)} ano(s) de plantio`}
          icon={MapPin}
          tone="info"
          loading={loading}
        />
        <MetricCard
          variant="kpi"
          title="Plantas"
          value={formatNumber(totals.plants)}
          footer={`${formatNumber(totals.averagePlantsPerHa, 1)} plantas/ha média`}
          icon={Sprout}
          tone="green"
          loading={loading}
        />
        <MetricCard
          variant="kpi"
          title="Cultivares"
          value={formatNumber(totals.cultivars.length)}
          footer={`${formatNumber(totals.corrected)} linhas corrigidas por área x densidade`}
          icon={FileSpreadsheet}
          tone="orange"
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-2">
        <CustomChart loading={loading} type="bar" data={totals.byFarm} title="Parcelas por fazenda" />
        <CustomChart loading={loading} type="bar" data={totals.byYear} title="Parcelas por ano de plantio" />
      </div>

      <div className="card page-card data-surface-card">
        <div className="table-card-header card-header">
          <div>
            <h3 className="card-title">Base de parcelas</h3>
            <span className="card-subtitle">Vila Nova considera somente os anos 2011 e 2012.</span>
          </div>
          <span className="badge badge-info">{formatNumber(records.length)} registros</span>
        </div>
        <div className="table-wrapper">
          <table className="custom-table dense-table">
            <thead>
              <tr>
                <th>Fazenda</th>
                <th>Ano</th>
                <th>Bloco</th>
                <th>Parcela</th>
                <th>Plantas</th>
                <th>Plantas/ha</th>
                <th>Área</th>
                <th>Cultivar</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td>
                      <div className="stack-cell">
                        <strong className="skeleton-text skeleton-sm" />
                        <span className="skeleton-text skeleton-sm" />
                      </div>
                    </td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td>
                      <div className="stack-cell">
                        <strong className="skeleton-text skeleton-sm" />
                        <span className="skeleton-text skeleton-sm" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <EmptyTableRow colSpan={9} message="Nenhuma parcela encontrada para os filtros atuais." />
              ) : (
                records.map((record) => (
                  <tr key={`${record.id}-${record.sourceRow}`}>
                    <td className="table-key-cell">{record.farmName}</td>
                    <td>{record.year}</td>
                    <td>{record.block}</td>
                    <td>
                      <div className="stack-cell">
                        <strong>{record.parcel}</strong>
                        {record.originalPlants ? <span>Plantas no Excel: {formatNumber(record.originalPlants)}</span> : null}
                      </div>
                    </td>
                    <td>{formatNumber(record.plants)}</td>
                    <td>{formatNumber(record.plantsPerHa, 0)}</td>
                    <td>{formatNumber(record.areaHa, 2)} ha</td>
                    <td>{record.cultivar}</td>
                    <td>
                      <div className="stack-cell">
                        <strong>{record.sheet}</strong>
                        <span>Linha {record.sourceRow}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
