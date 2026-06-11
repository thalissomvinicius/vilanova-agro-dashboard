import React, { useState } from 'react';
import {
  AlertCircle,
  FileSpreadsheet,
  MapPin,
  Rows3,
  Sprout,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { useInventoryDashboard } from '../utils/inventoryData';

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function InventoryMetric({ title, value, footer, icon: Icon, tone = 'green', loading = false }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-body">
        <span className={`kpi-value ${loading ? 'skeleton-text' : ''}`}>
          {loading ? '\u00A0' : value}
        </span>
      </div>
      <span className={`kpi-footer ${loading ? 'skeleton-text skeleton-sm' : ''}`}>
        {loading ? '\u00A0' : footer}
      </span>
    </div>
  );
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
    <div className="fade-in page-shell">
      <div className="dashboard-page-header">
        <div>
          <span className="page-eyebrow">Inventario agricola</span>
          <h2>Inventario de Parcelas das Fazendas</h2>
          <p>
            Base historica importada dos Excel de inventario para consulta por fazenda, ano de plantio, bloco, parcela e cultivar.
          </p>
        </div>
        <div className="page-actions">
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
          <div className="source-card compact">
            <span>Fonte</span>
            <strong>{loading ? 'Carregando...' : source}</strong>
            <small>{generatedAt ? `Gerado em ${new Date(generatedAt).toLocaleString('pt-BR')}` : 'Aguardando leitura'}</small>
          </div>
        </div>
      </div>

      {error ? (
        <div className="warning-strip">
          <AlertCircle size={16} />
          <span>Nao foi possivel carregar o inventario: {error}</span>
        </div>
      ) : null}

      <div className="grid-container grid-cols-4">
        <InventoryMetric
          title="Parcelas"
          value={formatNumber(totals.parcels)}
          footer={`${formatNumber(totals.blocks.length)} blocos no filtro`}
          icon={Rows3}
          tone="green"
          loading={loading}
        />
        <InventoryMetric
          title="Area inventariada"
          value={`${formatNumber(totals.areaHa, 2)} ha`}
          footer={`${formatNumber(totals.years.length)} ano(s) de plantio`}
          icon={MapPin}
          tone="info"
          loading={loading}
        />
        <InventoryMetric
          title="Plantas"
          value={formatNumber(totals.plants)}
          footer={`${formatNumber(totals.averagePlantsPerHa, 1)} plantas/ha media`}
          icon={Sprout}
          tone="green"
          loading={loading}
        />
        <InventoryMetric
          title="Cultivares"
          value={formatNumber(totals.cultivars.length)}
          footer={`${formatNumber(totals.corrected)} linhas corrigidas por area x densidade`}
          icon={FileSpreadsheet}
          tone="orange"
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-2">
        <CustomChart loading={loading} type="bar" data={totals.byFarm} title="Parcelas por fazenda" />
        <CustomChart loading={loading} type="bar" data={totals.byYear} title="Parcelas por ano de plantio" />
      </div>

      <div className="card page-card">
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
                <th>Area</th>
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
                <tr>
                  <td colSpan="9" className="empty-table-cell">
                    Nenhuma parcela encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={`${record.id}-${record.sourceRow}`}>
                    <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{record.farmName}</td>
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
