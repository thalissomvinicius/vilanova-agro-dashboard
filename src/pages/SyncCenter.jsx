import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Database, RefreshCcw, Server } from 'lucide-react';
import { useCqoData } from '../utils/cqoData';

function formatDateTime(value) {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return date.toLocaleString('pt-BR');
}

function SyncMetric({ title, value, subtitle, icon: Icon, tone = 'green' }) {
  return (
    <div className="card metric-card">
      <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
        <Icon size={20} />
      </div>
      <div>
        <span className="metric-label">{title}</span>
        <strong className="metric-value">{value}</strong>
        {subtitle ? (
          <span className="metric-subtitle">{subtitle}</span>
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
    <div className="fade-in page-shell">
      <div className="page-header">
        <div className="page-title-block">
          <span className="page-eyebrow">Sincronizacao online</span>
          <h2>Central de Sincronizacao</h2>
          <p>Monitoramento das coletas recebidas do app Android no Supabase.</p>
        </div>
        <div className="page-actions">
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
        />
        <SyncMetric
          title="Coletas recebidas"
          value={records.length}
          subtitle="Total no banco online"
          icon={Database}
          tone="green"
        />
        <SyncMetric
          title="Sincronizadas"
          value={synced}
          subtitle={`${pending} pendentes / ${failed} falhas`}
          icon={CheckCircle2}
          tone="green"
        />
        <SyncMetric
          title="Ultima coleta"
          value={formatDateTime(lastRecord?.createdAt)}
          subtitle="Baseado em criado_em"
          icon={Clock}
          tone="orange"
        />
      </div>

      <div className="card page-card">
        <div className="card-header table-card-header">
          <div>
            <h3 className="card-title">Ultimas transmissoes recebidas</h3>
            <span className="card-subtitle">Esta lista fica vazia ate o app sincronizar a primeira coleta real.</span>
          </div>
        </div>
        <div className="compact-list">
          {records.slice(0, 10).map((record) => (
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
          ))}
          {!records.length && (
            <div className="empty-panel">Nenhuma coleta real recebida no Supabase ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
