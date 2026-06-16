import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Database, RefreshCcw, Server } from 'lucide-react';
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
  const { loading, records, source, error } = useCqoData();
  const synced = records.filter((record) => record.status === 'Sincronizado').length;
  const failed = records.filter((record) => record.status === 'Falha').length;
  const pending = records.filter((record) => record.status === 'Pendente').length;
  const lastRecord = records[0];

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
          value={records.length}
          subtitle="Total no banco online"
          icon={Database}
          tone="green"
          loading={loading}
        />
        <SyncMetric
          title="Sincronizadas"
          value={synced}
          subtitle={`${pending} pendentes / ${failed} falhas`}
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
          <small>mobile_respostas e headcount.</small>
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
