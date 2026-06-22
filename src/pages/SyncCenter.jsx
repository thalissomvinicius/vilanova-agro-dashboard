import React from 'react';
import { AlertCircle, Camera, CheckCircle2, Clock, Database, FileText, MapPin, RefreshCcw, Server, Users } from 'lucide-react';
import { useCqoData } from '../utils/cqoData';

function formatDateTime(value) {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return date.toLocaleString('pt-BR');
}

function SyncMetric({ title, value, subtitle, icon: Icon, tone = 'green', loading = false }) {
  return (
    <div className="card metric-card">
      <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
        <Icon size={20} />
      </div>
      <div>
        <span className="metric-label">{title}</span>
        <strong className={`metric-value ${loading ? 'skeleton-text' : ''}`}>{loading ? '\u00A0' : value}</strong>
        {subtitle ? (
          <span className={`metric-subtitle ${loading ? 'skeleton-text skeleton-sm' : ''}`}>{loading ? '\u00A0' : subtitle}</span>
        ) : null}
      </div>
    </div>
  );
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
  const receivedOnline = appRecords.filter((record) => !['Pendente', 'Falha'].includes(record.status)).length;
  const validationPending = appRecords.filter((record) => record.status === 'Pendente validação').length;
  const failed = appRecords.filter((record) => record.status === 'Falha').length;
  const embeddedGpsPoints = appRecords.reduce((total, record) => (
    total + (record.gpsTrack?.length || 0) + (record.gpsOccurrences?.length || 0) + (record.gps ? 1 : 0)
  ), 0);
  const totalGpsPoints = gpsRows.length + embeddedGpsPoints;
  const lastRecord = appRecords[0];
  const headcountSource = headcount[0]?.source === 'headcount_import_snapshots'
    ? `Snapshot ${headcount[0]?.reference_date || ''}`.trim()
    : 'headcount_colaboradores';
  const cqoSnapshot = cqoImport.snapshot;

  return (
    <div className="fade-in page-shell sync-page">
      <div className="page-header operational-hero sync-hero">
        <div className="page-title-block">
          <span className="page-eyebrow">Sincronização online</span>
          <h2>Central de Sincronização</h2>
          <p>Monitoramento das coletas recebidas do app Android no Supabase.</p>
        </div>
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
      </div>

      {error ? (
        <div className="warning-strip">
          <AlertCircle size={16} />
          <span>Erro ao ler Supabase: {error}</span>
        </div>
      ) : null}

      <div className="grid-container grid-cols-4">
        <SyncMetric
          title="Fonte"
          value={loading ? 'Carregando' : source}
          subtitle="Leitura direta do Supabase"
          icon={Server}
          tone="info"
          loading={loading}
        />
        <SyncMetric
          title="Coletas recebidas"
          value={appRecords.length}
          subtitle="mobile_respostas do app"
          icon={Database}
          tone="green"
          loading={loading}
        />
        <SyncMetric
          title="Recebidas no Supabase"
          value={receivedOnline}
          subtitle={`${validationPending} aguardando validação / ${failed} falhas`}
          icon={CheckCircle2}
          tone="green"
          loading={loading}
        />
        <SyncMetric
          title="Última coleta"
          value={formatDateTime(lastRecord?.createdAt)}
          subtitle="Baseado em criado_em"
          icon={Clock}
          tone="orange"
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-4">
        <SyncMetric
          title="CQO Excel"
          value={excelRecords.length}
          subtitle={cqoSnapshot?.source_file || 'cqo_import_snapshots'}
          icon={Database}
          tone="orange"
          loading={loading}
        />
        <SyncMetric
          title="Pontos GPS"
          value={totalGpsPoints}
          subtitle={gpsRows.length ? 'mobile_gps + dados_json' : 'GPS embutido no dados_json'}
          icon={MapPin}
          tone="info"
          loading={loading}
        />
        <SyncMetric
          title="Anexos"
          value={anexos.length}
          subtitle="mobile_anexos sincronizados"
          icon={Camera}
          tone="orange"
          loading={loading}
        />
        <SyncMetric
          title="Formulários"
          value={formularios.length}
          subtitle="Catálogo mobile_formularios"
          icon={FileText}
          tone="green"
          loading={loading}
        />
        <SyncMetric
          title="Headcount"
          value={headcount.length}
          subtitle={headcountSource}
          icon={Users}
          tone="info"
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-3">
        <SyncMetric
          title="Corte Excel"
          value={cqoImport.corteRows || 0}
          subtitle="linhas em corte_rows_json"
          icon={FileText}
          tone="green"
          loading={loading}
        />
        <SyncMetric
          title="Carreamento Excel"
          value={cqoImport.carreamentoRows || 0}
          subtitle="linhas em carreamento_rows_json"
          icon={FileText}
          tone="orange"
          loading={loading}
        />
        <SyncMetric
          title="Snapshot CQO"
          value={formatDateTime(cqoSnapshot?.updated_at || cqoSnapshot?.imported_at)}
          subtitle="cqo_1_digitacao_cqo"
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
          <strong>Supabase</strong>
          <small>mobile_respostas, mobile_gps, mobile_anexos, mobile_formularios e headcount.</small>
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
