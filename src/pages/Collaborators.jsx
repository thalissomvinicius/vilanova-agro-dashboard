import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BriefcaseBusiness, Search, UserCheck, Users, Key, Lock, Loader2, Check, RotateCcw } from 'lucide-react';
import { loadHeadcountData, normalizeText, updateCollaborator } from '../utils/cqoData';

function metric(label, value, Icon, tone = 'green', loading = false) {
  return (
    <div className="card collaborator-metric">
      <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
        <Icon size={19} />
      </div>
      <div>
        <span>{label}</span>
        <strong className={loading ? 'skeleton-text' : ''}>{loading ? '\u00A0' : value}</strong>
      </div>
    </div>
  );
}

export default function Collaborators() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ATIVO');

  // Edit states
  const [editingCollab, setEditingCollab] = useState(null);
  const [editStatus, setEditStatus] = useState('ATIVO');
  const [editSenha, setEditSenha] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    updateCollaborator({
      matricula: editingCollab.matricula,
      status: editStatus,
      senha: editSenha,
    })
      .then(() => {
        setRows((prev) =>
          prev.map((row) =>
            row.matricula === editingCollab.matricula
              ? { ...row, status: editStatus, senha: editSenha }
              : row
          )
        );
        setSaveSuccess(true);
        setTimeout(() => {
          setEditingCollab(null);
          setSaveSuccess(false);
        }, 1500);
      })
      .catch((err) => {
        setSaveError(err.message || 'Erro ao salvar alterações.');
      })
      .finally(() => {
        setSaving(false);
      });
  };

  useEffect(() => {
    let mounted = true;
    loadHeadcountData()
      .then((data) => {
        if (mounted) {
          setRows(data);
          setError('');
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Erro ao carregar colaboradores.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = normalizeText(search);
    return rows.filter((row) => {
      const statusOk = status === 'all' || row.status === status;
      const haystack = normalizeText([
        row.matricula,
        row.nome,
        row.departamento,
        row.cargo,
        row.gestor,
      ].join(' '));
      return statusOk && (!needle || haystack.includes(needle));
    });
  }, [rows, search, status]);

  const active = rows.filter((row) => row.status === 'ATIVO').length;
  const departments = new Set(rows.map((row) => row.departamento).filter(Boolean)).size;
  const availableStatuses = [...new Set(rows.map((row) => row.status).filter(Boolean))].sort();
  const source = rows[0]?.source || '';
  const referenceDate = rows[0]?.reference_date || '';
  const sourceFile = rows[0]?.source_file || '';
  const isSnapshotSource = source === 'headcount_import_snapshots';

  return (
    <div className="fade-in page-shell collaborators-page">
      <div className="dashboard-page-header operational-hero collaborators-hero">
        <div>
          <span className="page-eyebrow">Gestão operacional</span>
          <h2>Colaboradores</h2>
          <p>
            {isSnapshotSource
              ? `Snapshot bruto do Headcount importado para o Supabase${referenceDate ? ` (${referenceDate})` : ''}.`
              : 'Consulta da base de headcount usada pelo app e pelo dashboard para autenticar matrículas e identificar avaliadores.'}
          </p>
          {sourceFile ? <small className="hero-meta-line">Fonte: {sourceFile}</small> : null}
        </div>
        <div className="operational-hero-stats">
          <div><span>Total</span><strong>{rows.length}</strong></div>
          <div><span>Ativos</span><strong>{active}</strong></div>
          <div><span>Deptos</span><strong>{departments}</strong></div>
          <div><span>Filtro</span><strong>{filtered.length}</strong></div>
        </div>
      </div>

      {error ? (
        <div className="warning-strip">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid-container grid-cols-4">
        {metric('Total na base', rows.length, Users, 'info', loading)}
        {metric('Ativos', active, UserCheck, 'green', loading)}
        {metric('Departamentos', departments, BriefcaseBusiness, 'orange', loading)}
        {metric('Filtro atual', filtered.length, Search, 'info', loading)}
      </div>

      <div className="card page-card data-surface-card">
        <div className="table-toolbar admin-toolbar">
          <div className="table-search operational-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, matrícula, cargo ou gestor"
            />
          </div>
          <label className="operational-select-control compact-control">
            <span>Status</span>
            <select className="header-filter-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ATIVO">Ativos</option>
              <option value="all">Todos</option>
              {availableStatuses.filter((item) => item !== 'ATIVO').map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="operational-clear-btn table-clear-btn"
            onClick={() => {
              setSearch('');
              setStatus('ATIVO');
            }}
            title="Limpar filtros da tela"
          >
            <RotateCcw size={15} />
            Limpar
          </button>
        </div>

        <div className="table-wrapper">
          <table className="custom-table dense-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Departamento</th>
                <th>Gestor</th>
                <th>Status</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                  </tr>
                ))
              ) : filtered.length ? filtered.slice(0, 500).map((row) => (
                <tr key={row.matricula}>
                  <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{row.matricula}</td>
                  <td>{row.nome}</td>
                  <td>{row.cargo || '--'}</td>
                  <td>{row.departamento || '--'}</td>
                  <td>{row.gestor || '--'}</td>
                  <td>
                    <span className={row.status === 'ATIVO' ? 'badge badge-success' : 'badge badge-warning'}>
                      {row.status || '--'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-secondary btn-icon"
                      disabled={row.source !== 'headcount_colaboradores'}
                      onClick={() => {
                        if (row.source !== 'headcount_colaboradores') return;
                        setEditingCollab(row);
                        setEditStatus(row.status || 'ATIVO');
                        setEditSenha(row.senha || '');
                        setSaveError('');
                        setSaveSuccess(false);
                      }}
                      title={row.source === 'headcount_colaboradores' ? 'Configurar acesso e senha' : 'Snapshot bruto: edição feita na tabela de acesso'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        padding: 0,
                      }}
                    >
                      <Key size={13} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="empty-table-cell">
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingCollab && (
        <div className="modal-overlay" onClick={() => setEditingCollab(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>
                <Key size={18} style={{ color: 'var(--green-institutional)', marginRight: '6px' }} />
                Configurar Acesso
              </h3>
              <button className="modal-close" onClick={() => setEditingCollab(null)}>&times;</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0 0 0' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Colaborador</span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{editingCollab.nome}</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                  Matrícula: <strong>{editingCollab.matricula}</strong> | Cargo: {editingCollab.cargo || '--'}
                </span>
              </div>

              {/* Status Select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Permissão de Acesso</label>
                <select
                  className="header-filter-select"
                  style={{ width: '100%', margin: 0 }}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="ATIVO">Habilitado (Ativo)</option>
                  <option value="INATIVO">Bloqueado (Inativo)</option>
                </select>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Colaboradores inativos não conseguem realizar login no aplicativo móvel ou no dashboard.
                </span>
              </div>

              {/* Senha Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Senha de Acesso</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                    placeholder="Definir senha de acesso"
                    value={editSenha}
                    onChange={(e) => setEditSenha(e.target.value)}
                  />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Digite a senha numérica ou de texto que o colaborador usará para autenticar.
                </span>
              </div>

              {/* Error and Success Indicators */}
              {saveError && (
                <div className="warning-strip" style={{ margin: 0, padding: '8px 12px' }}>
                  <AlertCircle size={14} />
                  <span style={{ fontSize: '0.75rem' }}>{saveError}</span>
                </div>
              )}

              {saveSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-success)', fontSize: '0.78rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                  <Check size={14} />
                  <span>Configurações salvas com sucesso!</span>
                </div>
              )}

              {/* Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingCollab(null)}
                  disabled={saving}
                  style={{ fontSize: '0.8rem', padding: '6px 14px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 14px', cursor: 'pointer' }}
                >
                  {saving ? (
                    <>
                      <Loader2 size={12} className="spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
