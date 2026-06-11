import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BriefcaseBusiness, Search, UserCheck, Users } from 'lucide-react';
import { loadHeadcountData, normalizeText } from '../utils/cqoData';

function metric(label, value, Icon, tone = 'green') {
  return (
    <div className="card collaborator-metric">
      <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
        <Icon size={19} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
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

  return (
    <div className="fade-in page-shell">
      <div className="dashboard-page-header">
        <div>
          <span className="page-eyebrow">Gestao operacional</span>
          <h2>Colaboradores</h2>
          <p>Consulta da base de headcount usada pelo app e pelo dashboard para autenticar matriculas e identificar avaliadores.</p>
        </div>
      </div>

      {error ? (
        <div className="warning-strip">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid-container grid-cols-4">
        {metric('Total na base', loading ? '...' : rows.length, Users, 'info')}
        {metric('Ativos', loading ? '...' : active, UserCheck, 'green')}
        {metric('Departamentos', loading ? '...' : departments, BriefcaseBusiness, 'orange')}
        {metric('Filtro atual', filtered.length, Search, 'info')}
      </div>

      <div className="card page-card">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, matricula, cargo ou gestor"
            />
          </div>
          <select className="header-filter-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ATIVO">Ativos</option>
            <option value="all">Todos</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="custom-table dense-table">
            <thead>
              <tr>
                <th>Matricula</th>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Departamento</th>
                <th>Gestor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.slice(0, 500).map((row) => (
                <tr key={row.matricula}>
                  <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{row.matricula}</td>
                  <td>{row.nome}</td>
                  <td>{row.cargo || '--'}</td>
                  <td>{row.departamento || '--'}</td>
                  <td>{row.gestor || '--'}</td>
                  <td><span className={row.status === 'ATIVO' ? 'badge badge-success' : 'badge badge-warning'}>{row.status || '--'}</span></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="empty-table-cell">
                    {loading ? 'Carregando colaboradores...' : 'Nenhum colaborador encontrado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
