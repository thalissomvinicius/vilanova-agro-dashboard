import React, { useEffect, useState } from 'react';
import {
  Activity,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wifi,
} from 'lucide-react';
import { authenticateDashboardUser, dashboardErrorMessage, LOCAL_DEMO_MODE, SUPABASE_CONFIG } from '../utils/cqoData';

export default function Login({ onLogin }) {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const canSubmit = Boolean(matricula.trim() && senha.trim() && !loading);

  useEffect(() => {
    document.body.classList.add('login-active');
    return () => {
      document.body.classList.remove('login-active');
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const profile = await authenticateDashboardUser(matricula, senha);
      onLogin(profile);
    } catch (err) {
      setError(dashboardErrorMessage(err, 'Não foi possível entrar.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-visual">
        <div className="login-brand">
          <img src="/logo.png" alt="Vila Nova Agroindustrial" />
          <div>
            <span>Vila Nova</span>
            <strong>Qualidade Agrícola</strong>
          </div>
        </div>

        <div className="login-copy">
          <span className="page-eyebrow">Painel CQO Online</span>
          <h1>Controle de qualidade agrícola com dados sincronizados.</h1>
          <p>
            Central para acompanhar coletas de corte, carreamento e fruto solto recebidas do aplicativo em campo.
          </p>
        </div>

        <div className="login-preview">
          <div className="login-preview-header">
            <div>
              <span>Operação conectada</span>
              <strong>App de campo / serviço online</strong>
            </div>
            <div className="login-live-pill">
              <Wifi size={14} />
              Online
            </div>
          </div>

          <div className="login-preview-grid">
            <div className="login-preview-card">
              <Database size={17} />
              <span>Base</span>
              <strong>CQO</strong>
            </div>
            <div className="login-preview-card">
              <Smartphone size={17} />
              <span>Origem</span>
              <strong>App</strong>
            </div>
            <div className="login-preview-card">
              <Activity size={17} />
              <span>Status</span>
              <strong>Tempo real</strong>
            </div>
          </div>
        </div>

        <div className="login-status-grid">
          <div>
            <ShieldCheck size={18} />
            <span>Acesso restrito</span>
          </div>
          <div>
            <LockKeyhole size={18} />
            <span>Matrícula autorizada</span>
          </div>
        </div>
      </div>

      <div className="login-access-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-header">
            <div className="login-lock-badge">
              <LockKeyhole size={18} />
            </div>
            <span className="page-eyebrow">Acesso ao dashboard</span>
            <h2>Entrar na central</h2>
            <p>Use sua matrícula e senha do headcount online para acessar o painel.</p>
          </div>

          <label className="auth-field">
            <span>Matrícula</span>
            <div>
              <UserRound size={18} />
              <input
                value={matricula}
                onChange={(event) => setMatricula(event.target.value)}
                inputMode="numeric"
                autoComplete="username"
                placeholder="Ex: 2170"
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Senha</span>
            <div>
              <LockKeyhole size={18} />
              <input
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {!SUPABASE_CONFIG.isConfigured ? (
            <div className="auth-error" role="status" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
              {LOCAL_DEMO_MODE
                ? 'Supabase não configurado. Modo demonstração ativo: use qualquer matrícula e senha. Crie o arquivo .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para dados reais.'
                : 'Serviço de dados não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente de deploy.'}
            </div>
          ) : null}

          {error ? <div className="auth-error" role="alert" aria-live="polite">{error}</div> : null}

          <button className="btn btn-primary login-submit" type="submit" disabled={!canSubmit}>
            <span>{loading ? 'Validando acesso...' : 'Acessar dashboard'}</span>
            <ChevronRight size={18} />
          </button>

          <div className="login-security-strip">
            <ShieldCheck size={16} />
            <span>Acesso operacional protegido por matrícula autorizada.</span>
          </div>
        </form>

        <div className="login-footer-note">
          <strong>Vila Nova Agroindustrial</strong>
          <span>Corte / Carreamento / Fruto Solto</span>
        </div>
      </div>
    </div>
  );
}
