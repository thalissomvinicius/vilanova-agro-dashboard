import React, { useMemo, useState } from 'react';
import {
  Camera,
  Download,
  Eye,
  FileSpreadsheet,
  Leaf,
  MapPin,
  Rows3,
  Sprout,
  X,
} from 'lucide-react';
import EmptyTableRow from '../components/ui/EmptyTableRow';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import StatusBanner from '../components/ui/StatusBanner';
import {
  exportInventoryToExcel,
  summarizeInventory,
  useFilteredFitossanidadeInventory,
  useFitossanidadeInventory,
} from '../utils/fitossanidadeInventoryData';

const initialFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  city: 'all',
  farm: 'all',
  status: 'all',
};

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

function uniqueOptions(records, key) {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

function statusTone(status) {
  if (['aprovado', 'sincronizado'].includes(status)) return 'success';
  if (status === 'reprovado' || status === 'erro') return 'danger';
  return 'warning';
}

function InventoryDetail({ record, onClose }) {
  if (!record) return null;
  return (
    <div className="fito-detail-overlay" role="presentation">
      <section className="fito-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="fito-detail-title">
        <header className="fito-detail-header">
          <div>
            <span>Ficha de inventário</span>
            <h3 id="fito-detail-title">{record.farm} / {record.parcel}</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar detalhes" aria-label="Fechar detalhes">
            <X size={20} />
          </button>
        </header>

        <div className="fito-detail-body">
          <div className="fito-detail-context">
            <div><span>Data</span><strong>{formatDate(record.date)}</strong></div>
            <div><span>Cidade</span><strong>{record.city}</strong></div>
            <div><span>Fazenda</span><strong>{record.farm}</strong></div>
            <div><span>Parcela</span><strong>{record.parcel}</strong></div>
            <div><span>Ano do plantio</span><strong>{record.plantingYear}</strong></div>
            <div><span>Coletor</span><strong>Mat. {record.userId}</strong></div>
          </div>

          <div className="fito-detail-totals">
            <div><span>Ruas / linhas</span><strong>{record.streets} / {record.lines.length}</strong></div>
            <div><span>Plantas totais</span><strong>{formatNumber(record.plants)}</strong></div>
            <div><span>Falhas</span><strong>{formatNumber(record.gaps)} ({formatNumber(record.gapsRate, 1)}%)</strong></div>
            <div><span>Mortas</span><strong>{formatNumber(record.dead)} ({formatNumber(record.deadRate, 1)}%)</strong></div>
            <div><span>Produtivas</span><strong>{formatNumber(record.productive)}</strong></div>
          </div>

          <div className="fito-detail-table-wrap">
            <table className="custom-table dense-table fito-detail-table">
              <thead><tr><th>Rua</th><th>Lado</th><th>Linha</th><th>Plantas totais</th><th>Falhas</th><th>Mortas</th><th>Produtivas</th></tr></thead>
              <tbody>
                {record.lines.map((line, index) => (
                  <tr key={`${line.street}-${line.side}-${index}`}>
                    <td>{line.street}</td><td>{line.side}</td><td>{line.lineNumber}</td>
                    <td>{formatNumber(line.plants)}</td><td>{formatNumber(line.gaps)}</td>
                    <td>{formatNumber(line.dead)}</td><td>{formatNumber(line.productive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="fito-detail-notes">
            <div>
              <span>Observações</span>
              <p>{record.observation || 'Nenhuma observação registrada.'}</p>
            </div>
            <div>
              <span>Evidências</span>
              <p>{record.evidenceCount} foto(s) sincronizada(s)</p>
              {record.attachments.length ? (
                <ul>{record.attachments.map((attachment) => <li key={attachment.id}>{attachment.nome_arquivo}</li>)}</ul>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function FitossanidadeInventory() {
  const { loading, records, generatedAt, error } = useFitossanidadeInventory();
  const [filters, setFilters] = useState(initialFilters);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const filteredRecords = useFilteredFitossanidadeInventory(records, filters);
  const totals = useMemo(() => summarizeInventory(filteredRecords), [filteredRecords]);
  const cities = useMemo(() => uniqueOptions(records, 'city'), [records]);
  const farms = useMemo(() => uniqueOptions(records, 'farm'), [records]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="fade-in page-shell fito-inventory-page">
      <PageHeader
        variant="dashboard"
        className="fito-inventory-hero"
        eyebrow="Fitossanidade"
        title="Inventário de plantas em campo"
        description="Contagem offline por rua e linha, incluindo áreas novas ainda sem cadastro no Supabase."
        meta={generatedAt ? <span className="fito-generated-at">Atualizado em {new Date(generatedAt).toLocaleString('pt-BR')}</span> : null}
      >
        <button
          type="button"
          className="btn btn-primary fito-export-button"
          onClick={() => exportInventoryToExcel(filteredRecords)}
          disabled={loading || filteredRecords.length === 0}
        >
          <Download size={18} />
          Exportar Excel
        </button>
      </PageHeader>

      {error ? (
        <StatusBanner tone="danger">
          {error} Execute o arquivo supabase/fitossanidade_inventory_dashboard.sql no projeto Supabase.
        </StatusBanner>
      ) : null}

      <div className="fito-filter-bar">
        <label className="fito-filter-search">
          <span>Buscar</span>
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Ficha, cidade, fazenda, parcela ou matrícula" />
        </label>
        <label><span>Data inicial</span><input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
        <label><span>Data final</span><input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
        <label><span>Cidade</span><select value={filters.city} onChange={(event) => updateFilter('city', event.target.value)}><option value="all">Todas</option>{cities.map((city) => <option key={city}>{city}</option>)}</select></label>
        <label><span>Fazenda / área</span><select value={filters.farm} onChange={(event) => updateFilter('farm', event.target.value)}><option value="all">Todas</option>{farms.map((farm) => <option key={farm}>{farm}</option>)}</select></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="all">Todos</option><option value="pendente_validacao">Pendentes</option><option value="aprovado">Aprovados</option><option value="sincronizado">Sincronizados</option><option value="reprovado">Reprovados</option></select></label>
        <button type="button" className="btn btn-secondary fito-clear-button" onClick={() => setFilters(initialFilters)}>Limpar</button>
      </div>

      <div className="grid-container grid-cols-4 fito-metric-grid">
        <MetricCard variant="kpi" title="Fichas" value={formatNumber(totals.records)} footer={`${formatNumber(totals.approved)} aprovadas/sincronizadas`} icon={FileSpreadsheet} tone="green" loading={loading} />
        <MetricCard variant="kpi" title="Ruas e linhas" value={`${formatNumber(totals.streets)} / ${formatNumber(totals.lines)}`} footer="Duas linhas avaliadas por rua" icon={Rows3} tone="info" loading={loading} />
        <MetricCard variant="kpi" title="Plantas totais" value={formatNumber(totals.plants)} footer="Inclui falhas e plantas mortas" icon={Sprout} tone="green" loading={loading} />
        <MetricCard variant="kpi" title="Falhas / mortas" value={`${formatNumber(totals.gaps)} / ${formatNumber(totals.dead)}`} footer={`${formatNumber(totals.productive)} plantas produtivas`} icon={Leaf} tone="orange" loading={loading} />
      </div>

      <section className="card page-card fito-table-card">
        <div className="table-card-header card-header">
          <div>
            <h3 className="card-title">Coletas de inventário recebidas</h3>
            <span className="card-subtitle">Os dados de áreas novas permanecem com os nomes digitados no campo.</span>
          </div>
          <span className="badge badge-info">{formatNumber(filteredRecords.length)} ficha(s)</span>
        </div>
        <div className="table-wrapper fito-table-wrapper">
          <table className="custom-table dense-table fito-inventory-table">
            <thead><tr><th>Data</th><th>Cidade / fazenda</th><th>Parcela / ano</th><th>Coletor</th><th>Ruas / linhas</th><th>Plantas</th><th>Falhas</th><th>Mortas</th><th>Fotos</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}>{Array.from({ length: 11 }).map((__, cell) => <td key={cell}><span className="skeleton-text skeleton-sm" /></td>)}</tr>
              )) : filteredRecords.length === 0 ? (
                <EmptyTableRow colSpan={11} message="Nenhum inventário encontrado para os filtros atuais." />
              ) : filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td className="table-key-cell">{formatDate(record.date)}</td>
                  <td><div className="stack-cell"><strong>{record.city}</strong><span>{record.farm}</span></div></td>
                  <td><div className="stack-cell"><strong>{record.parcel}</strong><span>Ano {record.plantingYear}</span></div></td>
                  <td>Mat. {record.userId}</td>
                  <td>{record.streets} / {record.lines.length}</td>
                  <td>{formatNumber(record.plants)}</td>
                  <td><strong className="fito-gap-value">{formatNumber(record.gaps)}</strong><small>{formatNumber(record.gapsRate, 1)}%</small></td>
                  <td><strong className="fito-dead-value">{formatNumber(record.dead)}</strong><small>{formatNumber(record.deadRate, 1)}%</small></td>
                  <td><span className="fito-photo-count"><Camera size={14} />{record.evidenceCount}</span></td>
                  <td><span className={`fito-status fito-status-${statusTone(record.status)}`}>{record.statusLabel}</span></td>
                  <td><button type="button" className="icon-button" onClick={() => setSelectedRecord(record)} title="Ver inventário" aria-label={`Ver inventário ${record.id}`}><Eye size={17} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fito-table-note"><MapPin size={14} /> Cidade, fazenda, parcela e ano são livres para permitir o levantamento de novas áreas.</div>
      </section>

      <InventoryDetail record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
