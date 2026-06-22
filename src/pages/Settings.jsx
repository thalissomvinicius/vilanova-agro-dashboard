import React from 'react';
import { Database, LogOut, Moon, RefreshCcw, ShieldCheck, Sun } from 'lucide-react';
import { SUPABASE_CONFIG, useCqoData } from '../utils/cqoData';

export default function Settings({ theme, setTheme, user, onLogout, triggerManualSync, isSyncing }) {
  const maskedKey = SUPABASE_CONFIG.anonKey
    ? `${SUPABASE_CONFIG.anonKey.slice(0, 10)}...${SUPABASE_CONFIG.anonKey.slice(-6)}`
    : 'Nao exposta no codigo';
  const { records, gpsRows = [], anexos = [], formularios = [], loading } = useCqoData();

  return (
    <div className="fade-in page-shell settings-page">
      <div className="dashboard-page-header operational-hero settings-hero">
        <div>
          <span className="page-eyebrow">Administração</span>
          <h2>Configurações</h2>
          <p>Parâmetros operacionais do painel, conexão Supabase e sessão ativa.</p>
        </div>
        <div className="settings-hero-card">
          <ShieldCheck size={24} />
          <strong>{user?.nome || 'Usuário autenticado'}</strong>
          <span>{user?.matricula ? `Matrícula ${user.matricula}` : 'Sessão local do dashboard'}</span>
        </div>
      </div>

      <div className="settings-status-grid">
        <div><span>Tema atual</span><strong>{theme === 'light' ? 'Claro' : 'Escuro'}</strong></div>
        <div><span>Banco online</span><strong>Supabase</strong></div>
        <div><span>Coletas</span><strong>{loading ? 'Carregando' : records.length}</strong></div>
        <div><span>Desenvolvedor</span><strong>Vinicius Dev.</strong></div>
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
              <h3 className="card-title"><Database size={18} /> Supabase</h3>
              <span className="card-subtitle">Banco online usado para coletas e headcount.</span>
            </div>
          </div>
          <div className="settings-list">
            <div><span>URL</span><strong>{SUPABASE_CONFIG.url}</strong></div>
            <div><span>Anon key</span><strong>{maskedKey}</strong></div>
            <div><span>Tabela de coletas</span><strong>mobile_respostas</strong></div>
            <div><span>Pontos GPS</span><strong>{gpsRows.length} em mobile_gps</strong></div>
            <div><span>Anexos</span><strong>{anexos.length} em mobile_anexos</strong></div>
            <div><span>Formulários</span><strong>mobile_formularios</strong></div>
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
