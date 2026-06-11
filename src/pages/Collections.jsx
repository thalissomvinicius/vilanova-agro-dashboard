import React, { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  MapPin,
  Rows3,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react';
import { filterRecords, updateResponseReviewStatus, useCqoData } from '../utils/cqoData';
import { exportDashboardRecord } from '../utils/reportExporter';

function statusBadge(status) {
  if (status === 'Aprovado') return 'badge-success';
  if (status === 'Reprovado') return 'badge-danger';
  if (status === 'Pendente validacao') return 'badge-warning';
  if (status === 'Sincronizado') return 'badge-success';
  if (status === 'Falha') return 'badge-danger';
  return 'badge-warning';
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function lineColumns(record) {
  if (record.type === 'carreamento') {
    return [
      ['linha', 'Linha'],
      ['numero_plantas_linha', 'Plantas linha'],
      ['cacho_mal_posicionado', 'Mal posicionado'],
      ['cacho_nao_carreado', 'Nao carreado'],
      ['numero_plantas_observadas', 'Plantas observadas'],
      ['peso_medio', 'Peso frutos'],
    ];
  }

  return [
    ['linha', 'Linha'],
    ['numero_plantas_linha', 'Plantas linha'],
    ['numero_plantas_observadas', 'Plantas obs.'],
    ['numero_cachos_observados_papel', 'Cachos obs.'],
    ['cacho_esquecido_ciclo', 'Esquecido'],
    ['cacho_verde', 'Verde'],
    ['cacho_maduro', 'Maduro'],
    ['cacho_passado', 'Passado'],
    ['cacho_mal_posicionado', 'Mal posicionado'],
  ];
}

export default function Collections({ farmFilter, areaFilter, periodFilter, dateFrom, dateTo, searchTerm }) {
  const { loading, records, source, error } = useCqoData();
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewOverrides, setReviewOverrides] = useState({});
  const [isReviewing, setIsReviewing] = useState(false);

  const displayRecords = records.map((record) => ({
    ...record,
    status: reviewOverrides[record.id] || record.status,
  }));

  const filteredRecords = filterRecords(displayRecords, {
    farmFilter,
    areaFilter,
    searchTerm,
    statusFilter,
    periodFilter,
    dateFrom,
    dateTo,
  });

  const selectedPhotos = selectedRecord
    ? Object.entries(selectedRecord.raw || {})
      .filter(([, value]) => value && typeof value === 'object' && value.base64)
      .map(([fieldId, value]) => ({ fieldId, ...value }))
    : [];

  const handleReview = async (status) => {
    if (!selectedRecord) return;
    setIsReviewing(true);
    try {
      await updateResponseReviewStatus(selectedRecord.id, status);
      const label = status === 'aprovado' ? 'Aprovado' : 'Reprovado';
      setReviewOverrides((prev) => ({ ...prev, [selectedRecord.id]: label }));
      setSelectedRecord((prev) => (prev ? { ...prev, status: label } : prev));
    } catch (reviewError) {
      window.alert(`Nao foi possivel atualizar a validacao: ${reviewError.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="fade-in page-shell">
      <div className="dashboard-page-header">
        <div>
          <span className="page-eyebrow">Auditoria de dados</span>
          <h2>Central de Coletas CQO</h2>
          <p>
            Consulta operacional das fichas recebidas do aplicativo, com detalhamento por linha e rastreio de GPS/acompanhamento.
          </p>
        </div>
        <div className="page-actions">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="header-filter-select"
          >
            <option value="all">Todos os status</option>
            <option value="Sincronizado">Sincronizado</option>
            <option value="Pendente validacao">Pendente validacao</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Reprovado">Reprovado</option>
            <option value="Pendente">Pendente</option>
            <option value="Falha">Falha</option>
          </select>
          <div className="source-card compact">
            <span>Fonte</span>
            <strong>{loading ? 'Carregando...' : source}</strong>
          </div>
        </div>
      </div>

      {error ? (
        <div className="warning-strip">
          <AlertCircle size={16} />
          <span>Sem leitura direta do Supabase neste momento: {error}. Exibindo amostra tecnica para validar o painel.</span>
        </div>
      ) : null}

      <div className="card page-card">
        <div className="table-wrapper">
          <table className="custom-table dense-table">
            <thead>
              <tr>
                <th>Ficha</th>
                <th>Data / Hora</th>
                <th>Formulario</th>
                <th>Fazenda / Parcela</th>
                <th>Avaliador</th>
                <th>Status</th>
                <th>GPS</th>
                <th>Acomp.</th>
                <th>Linhas</th>
                <th style={{ textAlign: 'center' }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-table-cell">
                    Nenhuma coleta encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>#{record.id}</td>
                    <td>
                      <div className="stack-cell">
                        <strong>{record.date}</strong>
                        <span>{record.time}</span>
                      </div>
                    </td>
                    <td>{record.form}</td>
                    <td>
                      <div className="stack-cell">
                        <strong>{record.farm}</strong>
                        <span>Parcela {record.parcel} / Ciclo {record.cycle}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack-cell">
                        <strong>{record.evaluator}</strong>
                        <span>Mat. {record.evaluatorMatricula || '--'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(record.status)}`}>{record.status}</span>
                    </td>
                    <td>
                      {record.gps ? (
                        <span className="gps-chip"><MapPin size={12} /> {record.gps.label}</span>
                      ) : (
                        <span className="muted-cell">Sem ponto</span>
                      )}
                    </td>
                    <td>
                      {record.acompanhamento?.teve === 'sim' ? (
                        <span className="badge badge-info">Sim</span>
                      ) : (
                        <span className="muted-cell">Nao</span>
                      )}
                    </td>
                    <td>{formatNumber(record.lines.length)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="btn btn-secondary btn-icon"
                        style={{ width: 34, height: 34 }}
                        title="Abrir coleta"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRecord && (
        <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="modal-content wide-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <ClipboardList size={18} style={{ color: 'var(--green-institutional)' }} />
                Ficha #{selectedRecord.id}
              </h3>
              <button className="modal-close" onClick={() => setSelectedRecord(null)}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <User size={16} />
                  <div>
                    <span>Avaliador</span>
                    <strong>{selectedRecord.evaluator}</strong>
                    <small>Matricula {selectedRecord.evaluatorMatricula || '--'}</small>
                  </div>
                </div>
                <div className="detail-item">
                  <Calendar size={16} />
                  <div>
                    <span>Data / hora</span>
                    <strong>{selectedRecord.date} as {selectedRecord.time}</strong>
                    <small>Status: {selectedRecord.status}</small>
                  </div>
                </div>
                <div className="detail-item">
                  <MapPin size={16} />
                  <div>
                    <span>Local</span>
                    <strong>{selectedRecord.farm}</strong>
                    <small>Parcela {selectedRecord.parcel} / Ciclo {selectedRecord.cycle}</small>
                  </div>
                </div>
                <div className="detail-item">
                  <Rows3 size={16} />
                  <div>
                    <span>Formulario</span>
                    <strong>{selectedRecord.form}</strong>
                    <small>{selectedRecord.lines.length} linha(s) digitada(s)</small>
                  </div>
                </div>
              </div>

              <div className="grid-container grid-cols-3" style={{ marginBottom: 18 }}>
                {Object.entries(selectedRecord.totals).map(([key, value]) => (
                  <div className="mini-metric" key={key}>
                    <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                    <strong>{formatNumber(value, key.toLowerCase().includes('peso') ? 1 : 0)}</strong>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
                <div className="table-wrapper">
                  <table className="custom-table dense-table">
                    <thead>
                      <tr>
                        {lineColumns(selectedRecord).map(([key, label]) => (
                          <th key={key}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecord.lines.map((line, index) => (
                        <tr key={`${selectedRecord.id}_line_${index}`}>
                          {lineColumns(selectedRecord).map(([key]) => (
                            <td key={key}>{line[key] || '0'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="detail-footer-grid">
                <div>
                  <span className="footer-label">GPS</span>
                  <strong>{selectedRecord.gps?.label || 'Nao capturado'}</strong>
                </div>
                <div>
                  <span className="footer-label">Acompanhamento</span>
                  <strong>
                    {selectedRecord.acompanhamento?.teve === 'sim'
                      ? `${selectedRecord.acompanhamento.matricula || '--'} - ${selectedRecord.acompanhamento.nome || 'Sem nome'}`
                      : 'Nao houve'}
                  </strong>
                </div>
                <div>
                  <span className="footer-label">Observacao</span>
                  <strong>{selectedRecord.observation || 'Sem observacao'}</strong>
                </div>
              </div>

              {selectedPhotos.length ? (
                <div className="evidence-section">
                  <div className="card-header" style={{ marginBottom: 10 }}>
                    <div>
                      <h3 className="card-title">Imagens geolocalizadas</h3>
                      <span className="card-subtitle">Evidencias enviadas pelo app com coordenadas da captura.</span>
                    </div>
                  </div>
                  <div className="evidence-grid">
                    {selectedPhotos.map((photo) => (
                      <div className="evidence-photo" key={photo.fieldId}>
                        <img src={`data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`} alt={photo.fieldId} />
                        <div>
                          <strong>{photo.fieldId}</strong>
                          <span>{photo.capturedAt ? new Date(photo.capturedAt).toLocaleString('pt-BR') : 'Sem data'}</span>
                          <span>
                            {photo.gps
                              ? `${Number(photo.gps.latitude).toFixed(6)}, ${Number(photo.gps.longitude).toFixed(6)}`
                              : 'Sem GPS'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <span style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: selectedRecord.status === 'Sincronizado' ? 'var(--status-success)' : 'var(--status-warning)' }}>
                {selectedRecord.status === 'Sincronizado' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                Transmissao: {selectedRecord.status}
              </span>
              <button onClick={() => exportDashboardRecord(selectedRecord, 'pdf')} className="btn btn-secondary">
                <Download size={14} />
                PDF
              </button>
              <button onClick={() => exportDashboardRecord(selectedRecord, 'excel')} className="btn btn-secondary">
                <Download size={14} />
                Excel
              </button>
              <button onClick={() => handleReview('reprovado')} className="btn btn-danger" disabled={isReviewing}>
                <ThumbsDown size={14} />
                Reprovar
              </button>
              <button onClick={() => handleReview('aprovado')} className="btn btn-primary" disabled={isReviewing}>
                <ThumbsUp size={14} />
                Aprovar
              </button>
              <button onClick={() => setSelectedRecord(null)} className="btn btn-primary">
                Fechar auditoria
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
