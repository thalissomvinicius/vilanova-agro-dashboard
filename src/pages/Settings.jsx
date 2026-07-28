import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock3,
  Database,
  LogOut,
  Moon,
  RefreshCcw,
  Server,
  ShieldCheck,
  Sun,
  Wifi,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { dashboardErrorMessage, useCqoData } from '../utils/cqoData';
import {
  classifyAgroApiHeartbeat,
  formatHeartbeatAge,
  formatStatusTimestamp,
  heartbeatAgeMs,
  HEARTBEAT_HEALTH,
  loadAgroApiHeartbeat,
  statusTone,
} from '../utils/agroApiStatus';

const HEALTH_CONTENT = {
  [HEARTBEAT_HEALTH.ONLINE]: {
    label: 'Operacional',
    description: 'API, VPN e SQL respondendo normalmente.',
    tone: 'success',
  },
  [HEARTBEAT_HEALTH.WARNING]: {
    label: 'Atenção',
    description: 'A integração está ativa, mas exige acompanhamento.',
    tone: 'warning',
  },
  [HEARTBEAT_HEALTH.OFFLINE]: {
    label: 'Indisponível',
    description: 'O último sinal expirou ou a API está fora do ar.',
    tone: 'danger',
  },
  [HEARTBEAT_HEALTH.UNKNOWN]: {
    label: 'Não verificado',
    description: 'Ainda não há um heartbeat válido para esta integração.',
    tone: 'neutral',
  },
};

function dependencyLabel(status, onlineLabel = 'Online') {
  const normalized = String(status || '').trim().toLowerCase();
  if (['online', 'ready', 'ok', 'healthy'].includes(normalized)) return onlineLabel;
  if (['warning', 'degraded', 'stale'].includes(normalized)) return 'Atenção';
  if (['offline', 'error', 'failed', 'unavailable'].includes(normalized)) return 'Indisponível';
  return 'Não verificado';
}

function latencyLabel(value) {
  const latency = Number(value);
  return Number.isFinite(latency) && latency >= 0 ? `${latency} ms` : '--';
}

function uptimeLabel(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) return `${days} d ${hours} h`;
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${hours} h ${minutes} min`;
}

function StatusDot({ tone }) {
  return <span className={`integration-status-dot is-${tone}`} aria-hidden="true" />;
}

export default function Settings({ theme, setTheme, user, onLogout, triggerManualSync, isSyncing }) {
  const { records, gpsRows = [], anexos = [], formularios = [], loading } = useCqoData();
  const [heartbeat, setHeartbeat] = useState({});
  const [heartbeatLoading, setHeartbeatLoading] = useState(true);
  const [heartbeatError, setHeartbeatError] = useState('');
  const [statusNow, setStatusNow] = useState(Date.now());

  const refreshHeartbeat = useCallback(async () => {
    setHeartbeatLoading(true);
    setHeartbeatError('');

    try {
      setHeartbeat(await loadAgroApiHeartbeat());
      setStatusNow(Date.now());
    } catch (error) {
      setHeartbeatError(dashboardErrorMessage(
        error,
        'Não foi possível consultar o monitoramento agora.'
      ));
    } finally {
      setHeartbeatLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(refreshHeartbeat, 0);
    const refreshInterval = window.setInterval(refreshHeartbeat, 60_000);
    const clockInterval = window.setInterval(() => setStatusNow(Date.now()), 15_000);
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refreshHeartbeat();
    };

    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
      window.clearInterval(clockInterval);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [refreshHeartbeat]);

  const heartbeatHealth = useMemo(
    () => classifyAgroApiHeartbeat(heartbeat, statusNow),
    [heartbeat, statusNow]
  );
  const healthContent = HEALTH_CONTENT[heartbeatHealth];
  const heartbeatAge = heartbeatAgeMs(heartbeat, statusNow);
  const sqlTone = statusTone(heartbeat.database_status);
  const apiTone = statusTone(heartbeat.api_status);
  const vpnTone = statusTone(heartbeat.vpn_status);
  const clockTone = statusTone(heartbeat.clock_status);
  const hasHeartbeat = Boolean(heartbeat && Object.keys(heartbeat).length);

  return (
    <div className="fade-in page-shell settings-page">
      <PageHeader
        variant="dashboard"
        className="settings-hero"
        eyebrow="Administração"
        title="Configurações"
        description="Parâmetros operacionais do painel, serviço de dados e sessão ativa."
      >
        <div className="settings-hero-card">
          <ShieldCheck size={24} />
          <strong>{user?.nome || 'Usuário autenticado'}</strong>
          <span>{user?.matricula ? `Matrícula ${user.matricula}` : 'Sessão local do dashboard'}</span>
        </div>
      </PageHeader>

      <div className="settings-status-grid">
        <div><span>Tema atual</span><strong>{theme === 'light' ? 'Claro' : 'Escuro'}</strong></div>
        <div>
          <span>SQL corporativo</span>
          <strong className={`settings-inline-health is-${healthContent.tone}`}>
            <StatusDot tone={healthContent.tone} />
            {heartbeatLoading && !hasHeartbeat ? 'Verificando' : healthContent.label}
          </strong>
        </div>
        <div><span>Coletas</span><strong>{loading ? 'Carregando' : records.length}</strong></div>
        <div><span>Perfil</span><strong>{user?.role || 'Usuário'}</strong></div>
      </div>

      <section className={`card integration-monitor is-${healthContent.tone}`} aria-live="polite">
        <div className="integration-monitor-header">
          <div className="integration-monitor-title">
            <span className={`integration-monitor-icon is-${healthContent.tone}`}>
              <Activity size={22} />
            </span>
            <div>
              <span className="section-eyebrow">Monitoramento de infraestrutura</span>
              <h3>Integração SQL AGRO TI</h3>
              <p>{healthContent.description}</p>
            </div>
          </div>
          <div className="integration-monitor-actions">
            <span className={`integration-health-badge is-${healthContent.tone}`}>
              <StatusDot tone={healthContent.tone} />
              {heartbeatLoading && !hasHeartbeat ? 'Verificando' : healthContent.label}
            </span>
            <button
              type="button"
              className="btn-icon"
              onClick={refreshHeartbeat}
              disabled={heartbeatLoading}
              title="Atualizar status"
              aria-label="Atualizar status da integração SQL"
            >
              <RefreshCcw className={heartbeatLoading ? 'spin' : ''} size={17} />
            </button>
          </div>
        </div>

        {heartbeatError ? (
          <div className="integration-monitor-error" role="alert">
            {heartbeatError}
          </div>
        ) : null}

        <div className="integration-dependency-grid">
          <div className={`integration-dependency is-${apiTone}`}>
            <Server size={19} />
            <span>API local</span>
            <strong>{dependencyLabel(heartbeat.api_status)}</strong>
            <small>Latência {latencyLabel(heartbeat.api_latency_ms)}</small>
          </div>
          <div className={`integration-dependency is-${vpnTone}`}>
            <Wifi size={19} />
            <span>VPN corporativa</span>
            <strong>{dependencyLabel(heartbeat.vpn_status, 'Conectada')}</strong>
            <small>Rota segura até o banco</small>
          </div>
          <div className={`integration-dependency is-${sqlTone}`}>
            <Database size={19} />
            <span>SQL Server</span>
            <strong>{dependencyLabel(heartbeat.database_status)}</strong>
            <small>Latência {latencyLabel(heartbeat.database_latency_ms)}</small>
          </div>
          <div className={`integration-dependency is-${clockTone}`}>
            <Clock3 size={19} />
            <span>Relógio do servidor</span>
            <strong>{dependencyLabel(heartbeat.clock_status, 'Sincronizado')}</strong>
            <small>
              Desvio {Number.isFinite(Number(heartbeat.clock_skew_seconds))
                ? `${Math.abs(Number(heartbeat.clock_skew_seconds))} s`
                : '--'}
            </small>
          </div>
        </div>

        <div className="integration-monitor-meta">
          <div>
            <span>Último sinal</span>
            <strong>{formatHeartbeatAge(heartbeatAge)}</strong>
          </div>
          <div>
            <span>Recebido pelo Supabase</span>
            <strong>{formatStatusTimestamp(heartbeat.received_at)}</strong>
          </div>
          <div>
            <span>Último sucesso SQL</span>
            <strong>{formatStatusTimestamp(heartbeat.database_last_success_at)}</strong>
          </div>
          <div>
            <span>Versão / atividade</span>
            <strong>{heartbeat.version || '--'} · {uptimeLabel(heartbeat.uptime_seconds)}</strong>
          </div>
        </div>
      </section>

      <div className="settings-grid">
        <div className="card settings-card admin-settings-card">
          <div className="card-header">
            <div>
              <h3 className="card-title"><ShieldCheck size={18} /> Sessão</h3>
              <span className="card-subtitle">Usuário autenticado no dashboard.</span>
            </div>
          </div>
          <div className="settings-list">
            <div><span>Nome</span><strong>{user?.nome || '--'}</strong></div>
            <div><span>Matrícula</span><strong>{user?.matricula || '--'}</strong></div>
            <div><span>Cargo</span><strong>{user?.cargo || '--'}</strong></div>
            <div><span>Departamento</span><strong>{user?.departamento || '--'}</strong></div>
          </div>
          <button className="btn btn-secondary" onClick={onLogout} style={{ marginTop: 18 }}>
            <LogOut size={16} />
            Sair
          </button>
        </div>

        <div className="card settings-card admin-settings-card">
          <div className="card-header">
            <div>
              <h3 className="card-title"><Database size={18} /> Dados online</h3>
              <span className="card-subtitle">Serviço autenticado usado para coletas e cadastros.</span>
            </div>
          </div>
          <div className="settings-list">
            <div><span>Status Supabase</span><strong>Conexão autenticada</strong></div>
            <div><span>Credenciais</span><strong>Gerenciadas por ambiente</strong></div>
            <div><span>Coletas recebidas</span><strong>{records.length}</strong></div>
            <div><span>Pontos GPS</span><strong>{gpsRows.length}</strong></div>
            <div><span>Anexos</span><strong>{anexos.length}</strong></div>
            <div><span>Formulários</span><strong>{formularios.length}</strong></div>
            <div><span>Catálogo carregado</span><strong>{formularios.length} versão(ões)</strong></div>
          </div>
          <button className="btn btn-primary" onClick={triggerManualSync} disabled={isSyncing} style={{ marginTop: 18 }}>
            <RefreshCcw className={isSyncing ? 'spin' : ''} size={16} />
            {isSyncing ? 'Atualizando...' : 'Atualizar painel'}
          </button>
        </div>

        <div className="card settings-card admin-settings-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">{theme === 'light' ? <Sun size={18} /> : <Moon size={18} />} Aparência</h3>
              <span className="card-subtitle">Preferência visual local do navegador.</span>
            </div>
          </div>
          <div className="segmented-control">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
              <Sun size={16} />
              Claro
            </button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
              <Moon size={16} />
              Escuro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
