import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  MapPin,
  Rows3,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
} from 'lucide-react';
import { filterRecords, updateResponseReviewStatus, deleteResponseRecord, refreshCqoData, useCqoData } from '../utils/cqoData';
import { exportDashboardRecord } from '../utils/reportExporter';

function statusBadge(status) {
  if (status === 'Aprovado') return 'badge-success';
  if (status === 'Reprovado') return 'badge-danger';
  if (status === 'Pendente validação') return 'badge-warning';
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
      ['cacho_nao_carreado', 'Não carreado'],
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
    ['cacho_infermo', 'Infermo'],
    ['bucha', 'Bucha'],
    ['cacho_talo_comprido', 'Talo comprido'],
    ['cacho_estrela', 'Estrela'],
    ['cacho_avermelhado', 'Avermelhado'],
    ['cacho_brocado', 'Brocado'],
    ['cacho_mal_posicionado', 'Mal posicionado'],
  ];
}

export default function Collections({ farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, dateFrom, dateTo, searchTerm }) {
  const { loading, records, source, error } = useCqoData();
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFicha, setSearchFicha] = useState('');
  const [reviewOverrides, setReviewOverrides] = useState({});
  const [deletedRecords, setDeletedRecords] = useState(new Set());
  const [isReviewing, setIsReviewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const displayRecords = records
    .filter(record => !deletedRecords.has(record.id))
    .map((record) => ({
      ...record,
      status: reviewOverrides[record.id] || record.status,
    }));

  const filteredRecords = filterRecords(displayRecords, {
    farmFilter,
    areaFilter,
    searchTerm,
    evaluatorFilter,
    statusFilter,
    periodFilter,
    cycleFilter,
    dateFrom,
    dateTo,
  }).filter((record) => {
    if (!searchFicha) return true;
    const term = searchFicha.toLowerCase();
    return String(record.id || '').toLowerCase().includes(term) || 
           String(record.formId || '').toLowerCase().includes(term);
  });

  const collectionStats = useMemo(() => {
    const withGps = filteredRecords.filter((record) => record.gps || record.gpsOccurrences?.length).length;
    const approved = filteredRecords.filter((record) => record.status === 'Aprovado' || record.status === 'Sincronizado').length;
    const corte = filteredRecords.filter((record) => record.type === 'corte').length;
    const carreamento = filteredRecords.filter((record) => record.type === 'carreamento').length;

    return {
      total: filteredRecords.length,
      approved,
      withGps,
      corte,
      carreamento,
    };
  }, [filteredRecords]);

  const selectedPhotos = selectedRecord
    ? [
      ...(selectedRecord.attachments || []),
      ...Object.entries(selectedRecord.raw || {})
      .filter(([, value]) => value && typeof value === 'object' && value.base64)
      .map(([fieldId, value]) => ({
        id: fieldId,
        fieldId,
        fileName: fieldId,
        mimeType: value.mimeType || 'image/jpeg',
        base64: value.base64,
        url: value.url || null,
        capturedAt: value.capturedAt || value.capturado_em || null,
        gps: value.gps || null,
      })),
    ]
    : [];

  const handleReview = async (status) => {
    if (!selectedRecord) return;
    setIsReviewing(true);
    try {
      await updateResponseReviewStatus(selectedRecord.id, status);
      const label = status === 'aprovado' ? 'Aprovado' : 'Reprovado';
      setReviewOverrides((prev) => ({ ...prev, [selectedRecord.id]: label }));
      setSelectedRecord((prev) => (prev ? { ...prev, status: label } : prev));
      await refreshCqoData().catch((syncError) => {
        console.warn('Nao foi possivel atualizar o cache global apos validacao:', syncError);
      });
    } catch (reviewError) {
      window.alert(`Não foi possível atualizar a validação: ${reviewError.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    if (!window.confirm(`Tem certeza que deseja excluir a ficha ${selectedRecord.id}? Esta ação não pode ser desfeita e removerá os dados permanentemente do Supabase.`)) return;
    
    setIsDeleting(true);
    try {
      await deleteResponseRecord(selectedRecord.id);
      setDeletedRecords(prev => new Set(prev).add(selectedRecord.id));
      setSelectedRecord(null);
      await refreshCqoData().catch((syncError) => {
        console.warn('Nao foi possivel atualizar o cache global apos exclusao:', syncError);
      });
    } catch (error) {
      window.alert(`Não foi possível excluir a ficha: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="fade-in page-shell collection-page">
        <div className="dashboard-page-header operational-hero collections-hero">
        <div>
          <span className="page-eyebrow">Auditoria de dados</span>
          <h2>Central de Coletas CQO</h2>
          <p>
            Consulta operacional das fichas recebidas do aplicativo, com detalhamento por linha e rastreio de GPS/acompanhamento.
          </p>
        </div>
        <div className="operational-hero-stats">
          <div><span>Registros</span><strong>{formatNumber(collectionStats.total)}</strong></div>
          <div><span>Com GPS</span><strong>{formatNumber(collectionStats.withGps)}</strong></div>
          <div><span>Corte</span><strong>{formatNumber(collectionStats.corte)}</strong></div>
          <div><span>Carream.</span><strong>{formatNumber(collectionStats.carreamento)}</strong></div>
        </div>
      </div>

      <div className="operational-filter-bar">
        <div className="table-search operational-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar Nº da Ficha"
              value={searchFicha}
              onChange={(e) => setSearchFicha(e.target.value)}
            />
        </div>
        <label className="operational-select-control">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="header-filter-select"
          >
            <option value="all">Todos os status</option>
            <option value="Sincronizado">Sincronizado</option>
            <option value="Pendente validação">Pendente validação</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Reprovado">Reprovado</option>
            <option value="Pendente">Pendente</option>
            <option value="Falha">Falha</option>
          </select>
        </label>
          <div className="source-card compact">
            <span>Fonte</span>
            <strong>{loading ? 'Carregando...' : source}</strong>
          </div>
      </div>

      {error ? (
        <div className="warning-strip">
          <AlertCircle size={16} />
          <span>Sem leitura direta do Supabase neste momento: {error}. Exibindo amostra tecnica para validar o painel.</span>
        </div>
      ) : null}

      <div className="collection-summary-strip">
        <div><CheckCircle2 size={16} /><span>Aprovadas/sincronizadas</span><strong>{formatNumber(collectionStats.approved)}</strong></div>
        <div><MapPin size={16} /><span>Rastreáveis por GPS</span><strong>{formatNumber(collectionStats.withGps)}</strong></div>
        <div><ClipboardList size={16} /><span>Auditoria filtrada</span><strong>{formatNumber(collectionStats.total)}</strong></div>
      </div>

      <div className="card page-card data-surface-card">
        <div className="table-wrapper">
          <table className="custom-table dense-table">
            <thead>
              <tr>
                <th>Ficha</th>
                <th>Data / Hora</th>
                <th>Formulário</th>
                <th>Fazenda / Parcela</th>
                <th>Avaliador</th>
                <th>Status</th>
                <th>GPS</th>
                <th>Acomp.</th>
                <th>Linhas</th>
                <th style={{ textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td>
                      <div className="stack-cell">
                        <strong className="skeleton-text skeleton-sm" />
                        <span className="skeleton-text skeleton-sm" />
                      </div>
                    </td>
                    <td><span className="skeleton-text" /></td>
                    <td>
                      <div className="stack-cell">
                        <strong className="skeleton-text skeleton-sm" />
                        <span className="skeleton-text skeleton-sm" />
                      </div>
                    </td>
                    <td>
                      <div className="stack-cell">
                        <strong className="skeleton-text skeleton-sm" />
                        <span className="skeleton-text skeleton-sm" />
                      </div>
                    </td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                  </tr>
                ))
              ) : filteredRecords.length === 0 ? (
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
                        <span className="gps-chip">
                          <MapPin size={12} />
                          {record.gpsOccurrences?.length
                            ? `${record.gpsOccurrences.length} ocorrencia(s)`
                            : record.gps.label}
                        </span>
                      ) : (
                        <span className="muted-cell">Sem ponto</span>
                      )}
                    </td>
                    <td>
                      {record.acompanhamento?.teve === 'sim' ? (
                        <span className="badge badge-info">Sim</span>
                      ) : (
                        <span className="muted-cell">Não</span>
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
                    <small>Matrícula {selectedRecord.evaluatorMatricula || '--'}</small>
                  </div>
                </div>
                <div className="detail-item">
                  <Calendar size={16} />
                  <div>
                    <span>Data / hora</span>
                    <strong>{selectedRecord.date} às {selectedRecord.time}</strong>
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
                    <span>Formulário</span>
                    <strong>{selectedRecord.form}</strong>
                    <small>
                      {selectedRecord.lines.length} linha(s) digitada(s)
                      {selectedRecord.type === 'carreamento' && selectedRecord.variety ? ` / ${selectedRecord.variety}` : ''}
                    </small>
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
                  <strong>{selectedRecord.gps?.label || 'Não capturado'}</strong>
                  <small>
                    {selectedRecord.gpsOccurrences?.length
                      ? `${selectedRecord.gpsOccurrences.length} ocorrencia(s) georreferenciada(s)`
                      : `${selectedRecord.gpsTrack?.length || 0} ponto(s) de trilha`}
                  </small>
                </div>
                <div>
                  <span className="footer-label">Acompanhamento</span>
                  <strong>
                    {selectedRecord.acompanhamento?.teve === 'sim'
                      ? `${selectedRecord.acompanhamento.matricula || '--'} - ${selectedRecord.acompanhamento.nome || 'Sem nome'}`
                      : 'Não houve'}
                  </strong>
                </div>
                <div>
                  <span className="footer-label">Observação</span>
                  <strong>{selectedRecord.observation || 'Sem observação'}</strong>
                </div>
              </div>

              {selectedRecord.gpsOccurrences?.length ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
                  <div className="card-header" style={{ padding: '14px 16px', marginBottom: 0 }}>
                    <div>
                      <h3 className="card-title">Ocorrencias georreferenciadas</h3>
                      <span className="card-subtitle">Pontos capturados no momento do registro da linha.</span>
                    </div>
                  </div>
                  <div className="table-wrapper">
                    <table className="custom-table dense-table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Linha</th>
                          <th>Coordenada</th>
                          <th>Precisao</th>
                          <th>Capturado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRecord.gpsOccurrences.map((point, index) => (
                          <tr key={`${selectedRecord.id}_gps_occ_${index}`}>
                            <td>{point.title || point.fieldId}</td>
                            <td>{point.line || '--'}</td>
                            <td>{point.label}</td>
                            <td>{Number.isFinite(point.accuracy) ? `${Math.round(point.accuracy)}m` : '--'}</td>
                            <td>{point.capturedAt ? new Date(point.capturedAt).toLocaleString('pt-BR') : '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {selectedPhotos.length ? (
                <div className="evidence-section">
                  <div className="card-header" style={{ marginBottom: 10 }}>
                    <div>
                      <h3 className="card-title">Imagens geolocalizadas</h3>
                      <span className="card-subtitle">Evidências enviadas pelo app com coordenadas da captura.</span>
                    </div>
                  </div>
                  <div className="evidence-grid">
                    {selectedPhotos.map((photo) => (
                      <div className="evidence-photo" key={photo.id || photo.fieldId}>
                        {photo.base64 || photo.url ? (
                          <img
                            src={photo.base64 ? `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}` : photo.url}
                            alt={photo.fieldId}
                          />
                        ) : (
                          <div className="evidence-file-placeholder">
                            <Download size={18} />
                            <span>Arquivo sincronizado</span>
                          </div>
                        )}
                        <div>
                          <strong>{photo.fileName || photo.fieldId}</strong>
                          <span>{photo.capturedAt ? new Date(photo.capturedAt).toLocaleString('pt-BR') : 'Sem data'}</span>
                          <span>
                            {photo.gps
                              ? `${Number(photo.gps.latitude ?? photo.gps.lat).toFixed(6)}, ${Number(photo.gps.longitude ?? photo.gps.lng).toFixed(6)}`
                              : 'Sem GPS'}
                          </span>
                          {photo.storagePath ? <span>{photo.storagePath}</span> : null}
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
                Transmissão: {selectedRecord.status}
              </span>
              <button onClick={() => exportDashboardRecord(selectedRecord, 'pdf')} className="btn btn-secondary">
                <Download size={14} />
                PDF
              </button>
              <button onClick={() => exportDashboardRecord(selectedRecord, 'excel')} className="btn btn-secondary">
                <Download size={14} />
                Excel
              </button>
              <button onClick={handleDelete} className="btn btn-secondary" style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }} disabled={isDeleting}>
                <Trash2 size={14} />
                Excluir
              </button>
              <button onClick={() => handleReview('reprovado')} className="btn btn-danger" disabled={isReviewing || isDeleting}>
                <ThumbsDown size={14} />
                Reprovar
              </button>
              <button onClick={() => handleReview('aprovado')} className="btn btn-primary" disabled={isReviewing || isDeleting}>
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
    </>
  );
}
