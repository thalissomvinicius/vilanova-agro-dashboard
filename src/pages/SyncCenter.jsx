import React from 'react';
import { Camera, CheckCircle2, Clock, Database, FileText, MapPin, RefreshCcw, Server, Users } from 'lucide-react';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import StatusBanner from '../components/ui/StatusBanner';
import { useCqoData } from '../utils/cqoData';

function formatDateTime(value) {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return date.toLocaleString('pt-BR');
}

export default function SyncCenter({ isSyncing, triggerManualSync }) {
  const {
    loading,
    records,
    mobileRecords = [],
    excelRecords = [],
    cqoImport = {},
    source,
    error,
    gpsRows = [],
    anexos = [],
    formularios = [],
    headcount = [],
  } = useCqoData();
  const appRecords = mobileRecords.length ? mobileRecords : records.filter((record) => record.raw?.fonte_excel === undefined);
  const synced = appRecords.filter((record) => record.status === 'Sincronizado').length;
  const failed = appRecords.filter((record) => record.status === 'Falha').length;
  const pending = appRecords.filter((record) => record.status === 'Pendente').length;
  const lastRecord = appRecords[0];
  const headcountSource = headcount[0]?.source === 'headcount_import_snapshots'
    ? `Snapshot ${headcount[0]?.reference_date || ''}`.trim()
    : 'Snapshot indisponivel';
  const cqoSnapshot = cqoImport.snapshot;

  return (
    <div className="fade-in page-shell sync-page">
      <PageHeader
        className="sync-hero"
        eyebrow="Sincronização online"
        title="Central de Sincronização"
        description="Monitoramento das coletas recebidas do app Android no serviço online."
      >
        <div className="sync-hero-action">
          <button
            onClick={triggerManualSync}
            disabled={isSyncing}
            className="btn btn-primary"
          >
            <RefreshCcw className={isSyncing ? 'spin' : ''} size={18} />
            <span>{isSyncing ? 'Atualizando...' : 'Atualizar painel'}</span>
          </button>
        </div>
      </PageHeader>

      {error ? (
        <StatusBanner tone="danger">
          Erro ao carregar dados online: {error}
        </StatusBanner>
      ) : null}

      <div className="grid-container grid-cols-4">
        <MetricCard
          title="Fonte"
          value={loading ? 'Carregando' : source}
          subtitle="RPC autenticada do dashboard"
          icon={Server}
          tone="info"
          loading={loading}
        />
        <MetricCard
          title="Coletas recebidas"
          value={appRecords.length}
          subtitle="Registros enviados pelo app"
          icon={Database}
          tone="green"
          loading={loading}
        />
        <MetricCard
          title="Sincronizadas"
          value={synced}
          subtitle={`${pending} pendentes / ${failed} falhas`}
          icon={CheckCircle2}
          tone="green"
          loading={loading}
        />
        <MetricCard
          title="Última coleta"
          value={formatDateTime(lastRecord?.createdAt)}
          subtitle="Horário de recebimento"
          icon={Clock}
          tone="orange"
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-4">
        <MetricCard
          title="CQO Excel"
          value={excelRecords.length}
          subtitle={cqoSnapshot?.source_file || 'Snapshot importado'}
          icon={Database}
          tone="orange"
          loading={loading}
        />
        <MetricCard
          title="Pontos GPS"
          value={gpsRows.length}
          subtitle="Vinculados às fichas"
          icon={MapPin}
          tone="info"
          loading={loading}
        />
        <MetricCard
          title="Anexos"
          value={anexos.length}
          subtitle="Arquivos sincronizados"
          icon={Camera}
          tone="orange"
          loading={loading}
        />
        <MetricCard
          title="Formulários"
          value={formularios.length}
          subtitle="Catálogo do app"
          icon={FileText}
          tone="green"
          loading={loading}
        />
        <MetricCard
          title="Headcount"
          value={headcount.length}
          subtitle={headcountSource}
          icon={Users}
          tone="info"
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-3">
        <MetricCard
          title="Corte Excel"
          value={cqoImport.corteRows || 0}
          subtitle="Linhas importadas"
          icon={FileText}
          tone="green"
          loading={loading}
        />
        <MetricCard
          title="Carreamento Excel"
          value={cqoImport.carreamentoRows || 0}
          subtitle="Linhas importadas"
          icon={FileText}
          tone="orange"
          loading={loading}
        />
        <MetricCard
          title="Snapshot CQO"
          value={formatDateTime(cqoSnapshot?.updated_at || cqoSnapshot?.imported_at)}
          subtitle="Última importação"
          icon={Clock}
          tone="info"
          loading={loading}
        />
      </div>

      <div className="sync-flow-grid">
        <div>
          <Server size={20} />
          <span>Origem</span>
          <strong>App Android CQO</strong>
          <small>Coleta em campo com formulário e GPS.</small>
        </div>
        <div>
          <Database size={20} />
          <span>Banco online</span>
          <strong>Serviço de dados</strong>
          <small>Coletas, GPS, anexos, formulários e cadastros via RPC autenticada.</small>
        </div>
        <div>
          <CheckCircle2 size={20} />
          <span>Leitura</span>
          <strong>Dashboard CQO</strong>
          <small>Indicadores, auditoria e mapas atualizados.</small>
        </div>
      </div>

      <div className="card page-card data-surface-card">
        <div className="card-header table-card-header">
          <div>
            <h3 className="card-title">Últimas transmissões recebidas</h3>
            <span className="card-subtitle">Esta lista fica vazia até o app sincronizar a primeira coleta real.</span>
          </div>
        </div>
        <div className="compact-list">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div className="compact-row" key={`skeleton-${i}`}>
                <div>
                  <strong className="skeleton-text skeleton-sm" />
                  <span className="skeleton-text skeleton-sm" />
                </div>
                <div>
                  <strong className="skeleton-text skeleton-sm" />
                  <span className="skeleton-text skeleton-sm" />
                </div>
              </div>
            ))
          ) : records.length === 0 ? (
            <div className="empty-panel">Nenhuma coleta real recebida no Supabase ainda.</div>
          ) : (
            records.slice(0, 10).map((record) => (
              <div className="compact-row" key={record.id}>
                <div>
                  <strong>{record.form}</strong>
                  <span>{record.farm} / Parcela {record.parcel}</span>
                </div>
                <div>
                  <strong>{record.status}</strong>
                  <span>{record.date} {record.time}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
