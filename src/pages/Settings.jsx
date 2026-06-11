import React from 'react';
import { Database, LogOut, Moon, RefreshCcw, ShieldCheck, Sun } from 'lucide-react';
import { SUPABASE_CONFIG } from '../utils/cqoData';

export default function Settings({ theme, setTheme, user, onLogout, triggerManualSync, isSyncing }) {
  const maskedKey = `${SUPABASE_CONFIG.anonKey.slice(0, 18)}...${SUPABASE_CONFIG.anonKey.slice(-8)}`;

  return (
    <div className="fade-in page-shell">
      <div className="dashboard-page-header">
        <div>
          <span className="page-eyebrow">Administracao</span>
          <h2>Configuracoes</h2>
          <p>Parametros operacionais do painel, conexao Supabase e sessao ativa.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="card settings-card">
          <div className="card-header">
            <div>
              <h3 className="card-title"><ShieldCheck size={18} /> Sessao</h3>
              <span className="card-subtitle">Usuario autenticado no dashboard.</span>
            </div>
          </div>
          <div className="settings-list">
            <div><span>Nome</span><strong>{user?.nome || '--'}</strong></div>
            <div><span>Matricula</span><strong>{user?.matricula || '--'}</strong></div>
            <div><span>Cargo</span><strong>{user?.cargo || '--'}</strong></div>
            <div><span>Departamento</span><strong>{user?.departamento || '--'}</strong></div>
          </div>
          <button className="btn btn-secondary" onClick={onLogout} style={{ marginTop: 18 }}>
            <LogOut size={16} />
            Sair
          </button>
        </div>

        <div className="card settings-card">
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
            <div><span>Formularios</span><strong>mobile_formularios</strong></div>
          </div>
          <button className="btn btn-primary" onClick={triggerManualSync} disabled={isSyncing} style={{ marginTop: 18 }}>
            <RefreshCcw className={isSyncing ? 'spin' : ''} size={16} />
            {isSyncing ? 'Atualizando...' : 'Atualizar painel'}
          </button>
        </div>

        <div className="card settings-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">{theme === 'light' ? <Sun size={18} /> : <Moon size={18} />} Aparencia</h3>
              <span className="card-subtitle">Preferencia visual local do navegador.</span>
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
