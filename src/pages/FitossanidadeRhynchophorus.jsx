import React, { useMemo, useState } from 'react';
import {
  Bug,
  Download,
  Eye,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  VenusAndMars,
  X,
} from 'lucide-react';
import EmptyTableRow from '../components/ui/EmptyTableRow';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import StatusBanner from '../components/ui/StatusBanner';
import {
  exportRhynchophorusToExcel,
  summarizeRhynchophorus,
  useFilteredFitossanidadeRhynchophorus,
  useFitossanidadeRhynchophorus,
} from '../utils/fitossanidadeRhynchophorusData';

const initialFilters = { search: '', dateFrom: '', dateTo: '', farm: 'all', status: 'all' };

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

function statusTone(status) {
  if (['aprovado', 'sincronizado'].includes(status)) return 'success';
  if (status === 'reprovado' || status === 'erro') return 'danger';
  return 'warning';
}

function TrapDetail({ record, onClose }) {
  if (!record) return null;
  return (
    <div className="fito-detail-overlay" role="presentation">
      <section className="fito-detail-dialog fito-trap-dialog" role="dialog" aria-modal="true" aria-labelledby="fito-trap-detail-title">
        <header className="fito-detail-header">
          <div>
            <span>Inspecao de armadilhas</span>
            <h3 id="fito-trap-detail-title">{record.farm} - {formatDate(record.date)}</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar detalhes" aria-label="Fechar detalhes"><X size={20} /></button>
        </header>
        <div className="fito-detail-body">
          <div className="fito-detail-context fito-trap-context">
            <div><span>Data</span><strong>{formatDate(record.date)}</strong></div>
            <div><span>Fazenda</span><strong>{record.farm}</strong></div>
            <div><span>Matricula responsavel</span><strong>{record.responsibleId}</strong></div>
            <div><span>Status</span><strong>{record.statusLabel}</strong></div>
          </div>
          <div className="fito-detail-totals fito-trap-totals">
            <div><span>Armadilhas</span><strong>{record.trapCount}</strong></div>
            <div><span>Machos</span><strong>{formatNumber(record.males)}</strong></div>
            <div><span>Femeas</span><strong>{formatNumber(record.females)}</strong></div>
            <div><span>Total capturado</span><strong>{formatNumber(record.total)}</strong></div>
            <div><span>Trocas de feromonio</span><strong>{record.pheromoneChanges}</strong></div>
            <div><span>DN / EX</span><strong>{record.damaged} / {record.missing}</strong></div>
          </div>
          <div className="fito-detail-table-wrap">
            <table className="custom-table dense-table fito-detail-table">
              <thead><tr><th>#</th><th>Localizacao / armadilha</th><th>Feromonio</th><th>Machos</th><th>Femeas</th><th>Total</th><th>Situacao</th></tr></thead>
              <tbody>{record.traps.map((trap) => (
                <tr key={`${trap.index}-${trap.location}`}>
                  <td>{trap.index}</td><td className="table-key-cell">{trap.location}</td>
                  <td>{trap.pheromoneChanged ? 'Trocado' : 'Nao'}</td><td>{trap.males}</td>
                  <td>{trap.females}</td><td><strong>{trap.total}</strong></td><td>{trap.stateLabel}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function FitossanidadeRhynchophorus() {
  const { loading, records, generatedAt, error } = useFitossanidadeRhynchophorus();
  const [filters, setFilters] = useState(initialFilters);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const filteredRecords = useFilteredFitossanidadeRhynchophorus(records, filters);
  const totals = useMemo(() => summarizeRhynchophorus(filteredRecords), [filteredRecords]);
  const farms = useMemo(() => [...new Set(records.map((record) => record.farm).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [records]);
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="fade-in page-shell fito-inventory-page fito-traps-page">
      <PageHeader
        variant="dashboard"
        className="fito-inventory-hero"
        eyebrow="Fitossanidade"
        title="Monitoramento de Rhynchophorus palmarum"
        description="Troca de feromonio, captura por sexo e situacao das armadilhas coletadas offline no campo."
        meta={generatedAt ? <span className="fito-generated-at">Atualizado em {new Date(generatedAt).toLocaleString('pt-BR')}</span> : null}
      >
        <button type="button" className="btn btn-primary fito-export-button" onClick={() => exportRhynchophorusToExcel(filteredRecords)} disabled={loading || filteredRecords.length === 0}>
          <Download size={18} />Exportar Excel
        </button>
      </PageHeader>

      {error ? <StatusBanner tone="danger">{error} Execute o arquivo supabase/fitossanidade_rhynchophorus_dashboard.sql no projeto Supabase.</StatusBanner> : null}

      <div className="fito-filter-bar fito-trap-filter-bar">
        <label className="fito-filter-search"><span>Buscar</span><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Ficha, fazenda, matricula ou armadilha" /></label>
        <label><span>Data inicial</span><input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
        <label><span>Data final</span><input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
        <label><span>Fazenda</span><select value={filters.farm} onChange={(event) => updateFilter('farm', event.target.value)}><option value="all">Todas</option>{farms.map((farm) => <option key={farm}>{farm}</option>)}</select></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="all">Todos</option><option value="pendente_validacao">Pendentes</option><option value="aprovado">Aprovados</option><option value="sincronizado">Sincronizados</option><option value="reprovado">Reprovados</option></select></label>
        <button type="button" className="btn btn-secondary fito-clear-button" onClick={() => setFilters(initialFilters)}>Limpar</button>
      </div>

      <div className="grid-container grid-cols-4 fito-metric-grid fito-trap-metrics">
        <MetricCard variant="kpi" title="Inspecoes" value={formatNumber(totals.records)} footer={`${formatNumber(totals.approved)} aprovadas/sincronizadas`} icon={FileCheck2} tone="green" loading={loading} />
        <MetricCard variant="kpi" title="Armadilhas verificadas" value={formatNumber(totals.traps)} footer={`${formatNumber(totals.changes)} trocas de feromonio`} icon={RefreshCw} tone="info" loading={loading} />
        <MetricCard variant="kpi" title="Insetos capturados" value={formatNumber(totals.total)} footer={`${formatNumber(totals.males)} machos / ${formatNumber(totals.females)} femeas`} icon={VenusAndMars} tone="orange" loading={loading} />
        <MetricCard variant="kpi" title="Problemas de armadilha" value={formatNumber(totals.damaged + totals.missing)} footer={`${formatNumber(totals.damaged)} DN / ${formatNumber(totals.missing)} EX`} icon={ShieldAlert} tone="red" loading={loading} />
      </div>

      <section className="card page-card fito-table-card">
        <div className="table-card-header card-header">
          <div><h3 className="card-title">Inspecoes recebidas</h3><span className="card-subtitle">Totais recalculados a partir de Machos + Femeas para impedir divergencias.</span></div>
          <span className="badge badge-info">{formatNumber(filteredRecords.length)} ficha(s)</span>
        </div>
        <div className="table-wrapper fito-table-wrapper">
          <table className="custom-table dense-table fito-inventory-table fito-trap-table">
            <thead><tr><th>Data</th><th>Fazenda</th><th>Responsavel</th><th>Armadilhas</th><th>Machos</th><th>Femeas</th><th>Total</th><th>Trocas</th><th>DN / EX</th><th>Status</th><th>Acao</th></tr></thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, index) => <tr key={index}>{Array.from({ length: 11 }).map((__, cell) => <td key={cell}><span className="skeleton-text skeleton-sm" /></td>)}</tr>) : filteredRecords.length === 0 ? (
                <EmptyTableRow colSpan={11} message="Nenhuma inspecao de armadilhas encontrada para os filtros atuais." />
              ) : filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td className="table-key-cell">{formatDate(record.date)}</td><td><strong>{record.farm}</strong></td>
                  <td>Mat. {record.responsibleId}</td><td>{record.trapCount}</td><td>{record.males}</td><td>{record.females}</td>
                  <td><strong>{record.total}</strong></td><td>{record.pheromoneChanges}</td><td>{record.damaged} / {record.missing}</td>
                  <td><span className={`fito-status fito-status-${statusTone(record.status)}`}>{record.statusLabel}</span></td>
                  <td><button type="button" className="icon-button" onClick={() => setSelectedRecord(record)} title="Ver inspecao" aria-label={`Ver inspecao ${record.id}`}><Eye size={17} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fito-table-note"><Bug size={14} /> Formato compativel com a aba BASE da planilha historica.</div>
      </section>
      <TrapDetail record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
