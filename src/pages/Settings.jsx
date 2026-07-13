import React from 'react';
import { Database, LogOut, Moon, RefreshCcw, ShieldCheck, Sun } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { useCqoData } from '../utils/cqoData';

export default function Settings({ theme, setTheme, user, onLogout, triggerManualSync, isSyncing }) {
  const { records, gpsRows = [], anexos = [], formularios = [], loading } = useCqoData();

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
        <div><span>Serviço online</span><strong>Conexão autenticada</strong></div>
        <div><span>Coletas</span><strong>{loading ? 'Carregando' : records.length}</strong></div>
        <div><span>Perfil</span><strong>{user?.role || 'Usuário'}</strong></div>
      </div>

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
            <div><span>Status</span><strong>Operacional</strong></div>
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
