import React, { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Search, UserCheck, Users, Key, Lock, Loader2 } from 'lucide-react';
import EmptyTableRow from '../components/ui/EmptyTableRow';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import StatusBanner from '../components/ui/StatusBanner';
import { canUseDashboardAction, dashboardErrorMessage, loadHeadcountData, normalizeText, updateCollaborator } from '../utils/cqoData';

export default function Collaborators({ user }) {
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
  const canManageCollaborators = canUseDashboardAction(user, 'manage_collaborators');

  const handleSave = () => {
    if (!canManageCollaborators) {
      setSaveError('Seu perfil não tem permissão para alterar acesso de colaboradores.');
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    updateCollaborator({
      matricula: editingCollab.matricula,
      status: editStatus,
      senha: editSenha.trim() || undefined,
      sessionToken: user?.sessionToken,
    })
      .then(() => {
        setRows((prev) =>
          prev.map((row) =>
            row.matricula === editingCollab.matricula
              ? { ...row, status: editStatus }
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
        setSaveError(dashboardErrorMessage(err, 'Erro ao salvar alterações.'));
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
        if (mounted) setError(dashboardErrorMessage(err, 'Erro ao carregar colaboradores.'));
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
      <PageHeader
        variant="dashboard"
        className="collaborators-hero"
        eyebrow="Gestão operacional"
        title="Colaboradores"
        description={isSnapshotSource
          ? `Snapshot bruto do Headcount importado para o Supabase${referenceDate ? ` (${referenceDate})` : ''}.`
          : 'Consulta da base de headcount usada pelo app e pelo dashboard para autenticar matrículas e identificar avaliadores.'}
        meta={sourceFile ? <small className="hero-meta-line">Fonte: {sourceFile}</small> : null}
      >
        <div className="operational-hero-stats">
          <div><span>Total</span><strong>{rows.length}</strong></div>
          <div><span>Ativos</span><strong>{active}</strong></div>
          <div><span>Deptos</span><strong>{departments}</strong></div>
          <div><span>Filtro</span><strong>{filtered.length}</strong></div>
        </div>
      </PageHeader>

      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <div className="grid-container grid-cols-4">
        <MetricCard variant="collaborator" title="Total na base" value={rows.length} icon={Users} tone="info" loading={loading} />
        <MetricCard variant="collaborator" title="Ativos" value={active} icon={UserCheck} tone="green" loading={loading} />
        <MetricCard variant="collaborator" title="Departamentos" value={departments} icon={BriefcaseBusiness} tone="orange" loading={loading} />
        <MetricCard variant="collaborator" title="Filtro atual" value={filtered.length} icon={Search} tone="info" loading={loading} />
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
        </div>

        <div className="table-wrapper">
          <table className="custom-table dense-table table-auto-width">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Departamento</th>
                <th>Gestor</th>
                <th>Status</th>
                <th className="table-actions-column">Ações</th>
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
              ) : filtered.length ? filtered.slice(0, 500).map((row) => {
                const hasMatricula = Boolean(String(row.matricula || '').trim());
                const canEditAccess = canManageCollaborators && hasMatricula;

                return (
                  <tr key={row.matricula || row.nome}>
                    <td className="table-key-cell">{row.matricula || '--'}</td>
                    <td>{row.nome}</td>
                    <td>{row.cargo || '--'}</td>
                    <td>{row.departamento || '--'}</td>
                    <td>{row.gestor || '--'}</td>
                    <td>
                      <span className={row.status === 'ATIVO' ? 'badge badge-success' : 'badge badge-warning'}>
                        {row.status || '--'}
                      </span>
                    </td>
                    <td className="table-action-cell">
                      <button
                        className="btn btn-secondary btn-icon btn-icon-xs"
                        disabled={!canEditAccess}
                        onClick={() => {
                          if (!canEditAccess) return;
                          setEditingCollab(row);
                          setEditStatus(row.status || 'ATIVO');
                          setEditSenha('');
                          setSaveError('');
                          setSaveSuccess(false);
                        }}
                        title={
                          !canManageCollaborators
                            ? 'Permissão necessária'
                            : hasMatricula
                              ? 'Configurar acesso e senha'
                              : 'Matrícula indisponível'
                        }
                      >
                        <Key size={13} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <EmptyTableRow colSpan={7} message="Nenhum colaborador encontrado." />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingCollab && (
        <div className="modal-overlay" onClick={() => setEditingCollab(null)}>
          <div className="modal-content access-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Key size={18} className="modal-title-icon-success" />
                Configurar Acesso
              </h3>
              <button className="modal-close" onClick={() => setEditingCollab(null)}>&times;</button>
            </div>

            <div className="modal-body access-modal-body">
              <div>
                <span className="access-modal-eyebrow">Colaborador</span>
                <strong className="access-modal-name">{editingCollab.nome}</strong>
                <span className="access-modal-meta">
                  Matrícula: <strong>{editingCollab.matricula}</strong> | Cargo: {editingCollab.cargo || '--'}
                </span>
              </div>

              <div className="access-form-group">
                <label className="access-form-label">Permissão de Acesso</label>
                <select
                  className="header-filter-select access-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="ATIVO">Habilitado (Ativo)</option>
                  <option value="INATIVO">Bloqueado (Inativo)</option>
                </select>
                <span className="access-help-text">
                  Colaboradores inativos não conseguem realizar login no aplicativo móvel ou no dashboard.
                </span>
              </div>

              <div className="access-form-group">
                <label className="access-form-label">Nova senha de acesso</label>
                <div className="access-password-field">
                  <Lock size={14} className="access-password-icon" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="access-password-input"
                    placeholder="Definir senha de acesso"
                    value={editSenha}
                    onChange={(e) => setEditSenha(e.target.value)}
                  />
                </div>
                <span className="access-help-text">
                  Preencha somente quando precisar trocar a senha deste colaborador.
                </span>
              </div>

              {saveError ? (
                <StatusBanner tone="danger" className="status-banner-compact">
                  {saveError}
                </StatusBanner>
              ) : null}

              {saveSuccess ? (
                <StatusBanner tone="success" className="status-banner-compact">
                  Configurações salvas com sucesso!
                </StatusBanner>
              ) : null}

              <div className="access-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary access-action-btn"
                  onClick={() => setEditingCollab(null)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary access-action-btn"
                  onClick={handleSave}
                  disabled={saving}
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
