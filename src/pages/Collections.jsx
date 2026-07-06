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
  X,
} from 'lucide-react';
import EmptyTableRow from '../components/ui/EmptyTableRow';
import PageHeader from '../components/ui/PageHeader';
import StatusBanner from '../components/ui/StatusBanner';
import { canUseDashboardAction, dashboardErrorMessage, filterRecords, updateResponseReviewStatus, deleteResponseRecord, refreshCqoData, useCqoData } from '../utils/cqoData';
import { devWarn } from '../utils/devLog';
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

function TableSelectionCheckbox({ checked, indeterminate = false, ...props }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(node) => {
        if (node) node.indeterminate = indeterminate;
      }}
      {...props}
    />
  );
}

function isLocalOnlyPhotoUrl(url) {
  return /^(file|content):\/\//i.test(String(url || ''));
}

function extractRawPhotos(raw) {
  const photos = [];
  const visit = (value, path = []) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index + 1)]));
      return;
    }

    if (typeof value !== 'object') return;

    const url = value.url || value.signed_url || value.public_url || value.storage_url || value.uri || null;
    const hasPhotoPayload = Boolean(value.base64 || url || value.storage_path || value.storagePath);
    const mimeType = value.mimeType || value.tipo_mime || value.mime_type || 'image/jpeg';

    if (hasPhotoPayload && /^image\//i.test(mimeType)) {
      const fieldId = value.campo_id || value.fieldId || path.filter(Boolean).join('.') || `foto_${photos.length + 1}`;
      photos.push({
        id: `${fieldId}_${photos.length + 1}`,
        fieldId,
        fileName: value.nome_arquivo || value.fileName || fieldId,
        mimeType,
        base64: value.base64 || null,
        url,
        localOnly: isLocalOnlyPhotoUrl(url),
        storagePath: value.storage_path || value.storagePath || null,
        capturedAt: value.capturedAt || value.capturado_em || value.criado_em || null,
        gps: value.gps || null,
      });
    }

    Object.entries(value).forEach(([key, child]) => visit(child, [...path, key]));
  };

  visit(raw);
  return photos;
}

function uniquePhotos(photos) {
  const seen = new Set();
  return [...photos]
    .sort((a, b) => photoPriority(b) - photoPriority(a))
    .filter((photo) => {
    const key = photoDedupKey(photo);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function photoImageSrc(photo) {
  if (photo?.base64) return `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`;
  if (photo?.url && !photo.localOnly && !isLocalOnlyPhotoUrl(photo.url)) return photo.url;
  return '';
}

function photoPriority(photo) {
  if (!photo) return 0;
  if (photo.base64) return 40;
  if (photo.url && !photo.localOnly && !isLocalOnlyPhotoUrl(photo.url)) return 30;
  if (photo.storagePath && !isLocalOnlyPhotoUrl(photo.storagePath)) return 20;
  return 0;
}

function photoDedupKey(photo) {
  const capturedAt = photo?.capturedAt ? new Date(photo.capturedAt).getTime() || photo.capturedAt : '';
  const semanticKey = [
    photo?.fieldId,
    photo?.fileName,
    capturedAt,
  ].filter(Boolean).join('|');

  if (semanticKey && photo?.fileName) return semanticKey;

  return [
    photo?.storagePath,
    photo?.url,
    photo?.id,
    photo?.fieldId,
    photo?.fileName,
  ].filter(Boolean).join('|') || 'foto-sem-identificador';
}

function EvidencePhoto({ photo }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? '' : photoImageSrc(photo);
  const canOpenUrl = Boolean(photo?.url && !photo.localOnly && !isLocalOnlyPhotoUrl(photo.url));
  const placeholderText = photo.localOnly
    ? 'Foto no app, upload pendente'
    : failed
      ? 'Prévia indisponível, abrir arquivo'
      : 'Arquivo sem prévia';

  return (
    <div className="evidence-photo">
      {src ? (
        <img
          src={src}
          alt={photo.fieldId}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="evidence-file-placeholder">
          <Download size={18} />
          <span>{placeholderText}</span>
          {canOpenUrl ? (
            <a href={photo.url} target="_blank" rel="noreferrer">
              Abrir imagem
            </a>
          ) : null}
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
  );
}

function lineColumns(record) {
  if (record.type === 'poda') {
    return [
      ['linha', 'Linha'],
      ['numero_plantas_linha', 'Plantas linha'],
      ['planta_sem_podar', 'Planta sem podar'],
      ['poda_meia_coroa', 'Poda meia coroa'],
      ['poda_maior_1_1', 'Poda > 1:1'],
      ['bico_gaita', 'Bico de gaita'],
      ['cacho_exposto', 'Cacho exposto'],
      ['cacho_podre_planta', 'Cacho podre'],
      ['folha_mamando', 'Folha mamando'],
      ['palha_mal_empilhada', 'Palha mal empilhada'],
    ];
  }

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
    ['cacho_mal_posicionado', 'Palha mal empilhada'],
  ];
}

export default function Collections({ farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter = 'all', dateFrom, dateTo, searchTerm, user }) {
  const { loading, records, source, error } = useCqoData();
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFicha, setSearchFicha] = useState('');
  const [reviewOverrides, setReviewOverrides] = useState({});
  const [deletedRecords, setDeletedRecords] = useState(new Set());
  const [selectedRecordIds, setSelectedRecordIds] = useState(new Set());
  const [isReviewing, setIsReviewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [bulkDeleteCandidate, setBulkDeleteCandidate] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const canReviewResponses = canUseDashboardAction(user, 'review_response');
  const canDeleteResponses = canUseDashboardAction(user, 'delete_response');

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
    sourceFilter,
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

  const selectableRecords = useMemo(
    () => filteredRecords.filter((record) => record.source !== 'excel'),
    [filteredRecords]
  );
  const selectedRecords = useMemo(
    () => selectableRecords.filter((record) => selectedRecordIds.has(record.id)),
    [selectableRecords, selectedRecordIds]
  );
  const allVisibleSelected = selectableRecords.length > 0
    && selectableRecords.every((record) => selectedRecordIds.has(record.id));
  const someVisibleSelected = selectableRecords.some((record) => selectedRecordIds.has(record.id));
  const bulkActionsDisabled = isBulkWorking || isReviewing || isDeleting || selectedRecords.length === 0;

  const collectionStats = useMemo(() => {
    const gpsEligible = filteredRecords.filter((record) => record.gpsApplicable !== false).length;
    const withGps = filteredRecords.filter((record) => record.gpsApplicable !== false && (record.gps || record.gpsOccurrences?.length)).length;
    const approved = filteredRecords.filter((record) => record.status === 'Aprovado' || record.status === 'Sincronizado').length;
    const corte = filteredRecords.filter((record) => record.type === 'corte').length;
    const carreamento = filteredRecords.filter((record) => record.type === 'carreamento').length;
    const poda = filteredRecords.filter((record) => record.type === 'poda').length;

    return {
      total: filteredRecords.length,
      approved,
      withGps,
      gpsEligible,
      corte,
      carreamento,
      poda,
    };
  }, [filteredRecords]);

  const sourceLabel = useMemo(() => {
    if (loading) return 'Carregando...';
    if (sourceFilter === 'excel') return 'Excel / snapshots CQO';
    if (sourceFilter === 'app') return 'App Android / serviço online';
    return source || 'App + Excel';
  }, [loading, source, sourceFilter]);

  const selectedPhotos = selectedRecord
    ? uniquePhotos([
      ...(selectedRecord.attachments || []),
      ...extractRawPhotos(selectedRecord.raw || {}),
    ])
    : [];

  const showFeedback = (title, message, tone = 'warning') => {
    setFeedback({ title, message, tone });
  };

  const toggleRecordSelection = (record) => {
    if (!record || record.source === 'excel' || isBulkWorking) return;
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(record.id)) next.delete(record.id);
      else next.add(record.id);
      return next;
    });
  };

  const toggleAllVisibleSelection = () => {
    if (!selectableRecords.length || isBulkWorking) return;
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        selectableRecords.forEach((record) => next.delete(record.id));
      } else {
        selectableRecords.forEach((record) => next.add(record.id));
      }
      return next;
    });
  };

  const handleReview = async (status) => {
    if (!selectedRecord) return;
    if (!canReviewResponses) {
      showFeedback(
        'Acesso restrito',
        'Seu perfil não tem permissão para validar fichas no dashboard.'
      );
      return;
    }
    if (selectedRecord.source === 'excel') {
      showFeedback(
        'Registro histórico',
        'A validação pelo dashboard está disponível apenas para coletas recebidas pelo app.'
      );
      return;
    }
    setIsReviewing(true);
    try {
      await updateResponseReviewStatus(selectedRecord.id, status, user);
      const label = status === 'aprovado' ? 'Aprovado' : 'Reprovado';
      setReviewOverrides((prev) => ({ ...prev, [selectedRecord.id]: label }));
      setSelectedRecord((prev) => (prev ? { ...prev, status: label } : prev));
      await refreshCqoData().catch((syncError) => {
        devWarn('Nao foi possivel atualizar o cache global apos validacao:', syncError);
      });
    } catch (reviewError) {
      showFeedback(
        'Não foi possível atualizar a validação',
        dashboardErrorMessage(reviewError, 'Tente novamente em instantes.'),
        'danger'
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const handleBulkReview = async (status) => {
    if (!selectedRecords.length) return;
    if (!canReviewResponses) {
      showFeedback(
        'Acesso restrito',
        'Seu perfil não tem permissão para validar fichas no dashboard.'
      );
      return;
    }

    const label = status === 'aprovado' ? 'Aprovado' : 'Reprovado';
    setIsBulkWorking(true);
    setIsReviewing(true);

    const results = await Promise.allSettled(
      selectedRecords.map((record) => updateResponseReviewStatus(record.id, status, user))
    );
    const successIds = selectedRecords
      .filter((_, index) => results[index]?.status === 'fulfilled')
      .map((record) => record.id);
    const failedCount = results.length - successIds.length;

    if (successIds.length) {
      setReviewOverrides((prev) => {
        const next = { ...prev };
        successIds.forEach((id) => {
          next[id] = label;
        });
        return next;
      });
      setSelectedRecord((prev) => (prev && successIds.includes(prev.id) ? { ...prev, status: label } : prev));
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        successIds.forEach((id) => next.delete(id));
        return next;
      });
      await refreshCqoData().catch((syncError) => {
        devWarn('Nao foi possivel atualizar o cache global apos validacao em lote:', syncError);
      });
    }

    if (failedCount) {
      showFeedback(
        'Processo parcialmente concluído',
        `${formatNumber(successIds.length)} ficha(s) atualizada(s) e ${formatNumber(failedCount)} com erro.`,
        'danger'
      );
    } else {
      showFeedback(
        'Validação concluída',
        `${formatNumber(successIds.length)} ficha(s) marcadas como ${label.toLowerCase()}.`,
        'success'
      );
    }

    setIsReviewing(false);
    setIsBulkWorking(false);
  };

  const handleDelete = () => {
    if (!selectedRecord) return;
    if (!canDeleteResponses) {
      showFeedback(
        'Acesso restrito',
        'Seu perfil não tem permissão para excluir fichas no dashboard.'
      );
      return;
    }
    if (selectedRecord.source === 'excel') {
      showFeedback(
        'Registro histórico',
        'A exclusão pelo dashboard está disponível apenas para coletas recebidas pelo app.'
      );
      return;
    }
    setDeleteCandidate(selectedRecord);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;

    setIsDeleting(true);
    try {
      await deleteResponseRecord(deleteCandidate.id, user);
      setDeletedRecords(prev => new Set(prev).add(deleteCandidate.id));
      setSelectedRecord((prev) => (prev?.id === deleteCandidate.id ? null : prev));
      setDeleteCandidate(null);
      await refreshCqoData().catch((syncError) => {
        devWarn('Nao foi possivel atualizar o cache global apos exclusao:', syncError);
      });
    } catch (deleteError) {
      setDeleteCandidate(null);
      showFeedback(
        'Não foi possível excluir a ficha',
        dashboardErrorMessage(deleteError, 'Tente novamente em instantes.'),
        'danger'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = () => {
    if (!selectedRecords.length) return;
    if (!canDeleteResponses) {
      showFeedback(
        'Acesso restrito',
        'Seu perfil não tem permissão para excluir fichas no dashboard.'
      );
      return;
    }
    setBulkDeleteCandidate(selectedRecords);
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteCandidate?.length) return;

    setIsDeleting(true);
    setIsBulkWorking(true);

    const results = await Promise.allSettled(
      bulkDeleteCandidate.map((record) => deleteResponseRecord(record.id, user))
    );
    const successIds = bulkDeleteCandidate
      .filter((_, index) => results[index]?.status === 'fulfilled')
      .map((record) => record.id);
    const failedCount = results.length - successIds.length;

    if (successIds.length) {
      setDeletedRecords((prev) => {
        const next = new Set(prev);
        successIds.forEach((id) => next.add(id));
        return next;
      });
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        successIds.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedRecord((prev) => (prev && successIds.includes(prev.id) ? null : prev));
      await refreshCqoData().catch((syncError) => {
        devWarn('Nao foi possivel atualizar o cache global apos exclusao em lote:', syncError);
      });
    }

    setBulkDeleteCandidate(null);
    setIsDeleting(false);
    setIsBulkWorking(false);

    if (failedCount) {
      showFeedback(
        'Exclusão parcialmente concluída',
        `${formatNumber(successIds.length)} ficha(s) excluída(s) e ${formatNumber(failedCount)} com erro.`,
        'danger'
      );
    } else {
      showFeedback(
        'Fichas excluídas',
        `${formatNumber(successIds.length)} ficha(s) removidas do Supabase.`,
        'success'
      );
    }
  };

  return (
    <>
      <div className="fade-in page-shell collection-page">
        <PageHeader
          variant="dashboard"
          className="collections-hero"
          eyebrow="Auditoria de dados"
          title="Central de Coletas CQO"
          description="Consulta operacional das fichas recebidas do aplicativo, com detalhamento por linha e rastreio de GPS/acompanhamento."
        >
          <div className="operational-hero-stats">
            <div><span>Registros</span><strong>{formatNumber(collectionStats.total)}</strong></div>
            <div><span>GPS app</span><strong>{formatNumber(collectionStats.withGps)}</strong></div>
            <div><span>Corte</span><strong>{formatNumber(collectionStats.corte)}</strong></div>
            <div><span>Poda</span><strong>{formatNumber(collectionStats.poda)}</strong></div>
          </div>
        </PageHeader>

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
            <strong>{sourceLabel}</strong>
          </div>
      </div>

      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <div className="collection-summary-strip">
        <div><CheckCircle2 size={16} /><span>Aprovadas/sincronizadas</span><strong>{formatNumber(collectionStats.approved)}</strong></div>
        <div><MapPin size={16} /><span>GPS app</span><strong>{formatNumber(collectionStats.withGps)} / {formatNumber(collectionStats.gpsEligible)}</strong></div>
        <div><ClipboardList size={16} /><span>Auditoria filtrada</span><strong>{formatNumber(collectionStats.total)}</strong></div>
      </div>

      <div className="card page-card data-surface-card">
        <div className="collection-bulk-actions">
          <div className="collection-bulk-copy">
            <strong>{formatNumber(selectedRecords.length)} selecionada(s)</strong>
            <span>Selecione fichas do app para validar ou excluir em lote.</span>
          </div>
          <div className="collection-bulk-buttons">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleBulkReview('aprovado')}
              disabled={bulkActionsDisabled || !canReviewResponses}
              title={canReviewResponses ? 'Aprovar fichas selecionadas' : 'Permissão necessária'}
            >
              <ThumbsUp size={14} />
              Aprovar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => handleBulkReview('reprovado')}
              disabled={bulkActionsDisabled || !canReviewResponses}
              title={canReviewResponses ? 'Reprovar fichas selecionadas' : 'Permissão necessária'}
            >
              <ThumbsDown size={14} />
              Reprovar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-outline-danger"
              onClick={handleBulkDelete}
              disabled={bulkActionsDisabled || !canDeleteResponses}
              title={canDeleteResponses ? 'Excluir fichas selecionadas' : 'Permissão necessária'}
            >
              <Trash2 size={14} />
              Excluir
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedRecordIds(new Set())}
              disabled={selectedRecordIds.size === 0 || isBulkWorking}
            >
              Limpar
            </button>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="custom-table dense-table">
            <thead>
              <tr>
                <th className="table-selection-cell">
                  <TableSelectionCheckbox
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && someVisibleSelected}
                    onChange={toggleAllVisibleSelection}
                    disabled={!selectableRecords.length || isBulkWorking}
                    aria-label="Selecionar todas as fichas visíveis do app"
                  />
                </th>
                <th>Ficha</th>
                <th>Data / Hora</th>
                <th>Formulário</th>
                <th>Fonte</th>
                <th>Fazenda / Parcela</th>
                <th>Avaliador</th>
                <th>Status</th>
                <th>GPS</th>
                <th>Acomp.</th>
                <th>Linhas</th>
                <th className="table-action-cell">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td><span className="skeleton-text skeleton-sm" /></td>
                    <td>
                      <div className="stack-cell">
                        <strong className="skeleton-text skeleton-sm" />
                        <span className="skeleton-text skeleton-sm" />
                      </div>
                    </td>
                  <td><span className="skeleton-text" /></td>
                  <td><span className="skeleton-text skeleton-sm" /></td>
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
                <EmptyTableRow colSpan={12} message="Nenhuma coleta encontrada para os filtros atuais." />
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className={selectedRecordIds.has(record.id) ? 'is-selected-row' : ''}>
                    <td className="table-selection-cell">
                      <TableSelectionCheckbox
                        checked={selectedRecordIds.has(record.id)}
                        onChange={() => toggleRecordSelection(record)}
                        disabled={record.source === 'excel' || isBulkWorking}
                        aria-label={`Selecionar ficha ${record.id}`}
                        title={record.source === 'excel' ? 'Registros Excel não entram em validação pelo dashboard' : 'Selecionar ficha'}
                      />
                    </td>
                    <td className="table-key-cell">#{record.id}</td>
                    <td>
                      <div className="stack-cell">
                        <strong>{record.date}</strong>
                        <span>{record.time}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack-cell">
                        <span>{record.form}</span>
                        {record.duplicateCount > 1 ? (
                          <span className="badge badge-warning">
                            {record.duplicateCount} fichas agrupadas
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={record.source === 'excel' ? 'badge badge-warning' : 'badge badge-info'}>
                        {record.source === 'excel' ? 'Excel' : 'App'}
                      </span>
                    </td>
                    <td>
                      <div className="stack-cell">
                        <strong>{record.farm}</strong>
                        <span>
                          Parcela {record.parcel}
                          {record.plantingYear ? ` / Ano ${record.plantingYear}` : ''}
                          {' / '}
                          Ciclo {record.cycle}
                        </span>
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
                      {record.source === 'excel' ? (
                        <span className="muted-cell">Excel sem GPS</span>
                      ) : record.gps ? (
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
                    <td className="table-action-cell">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="btn btn-secondary btn-icon btn-icon-sm"
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
                <ClipboardList size={18} className="modal-title-icon-success" />
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
                    <small>
                      Parcela {selectedRecord.parcel}
                      {selectedRecord.plantingYear ? ` / Ano ${selectedRecord.plantingYear}` : ''}
                      {` / Ciclo ${selectedRecord.cycle}`}
                    </small>
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

              <div className="grid-container grid-cols-3 modal-section-grid">
                {Object.entries(selectedRecord.totals).map(([key, value]) => (
                  <div className="mini-metric" key={key}>
                    <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                    <strong>{formatNumber(value, key.toLowerCase().includes('peso') ? 1 : 0)}</strong>
                  </div>
                ))}
              </div>

              <div className="card modal-embedded-card">
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
                  <strong>
                    {selectedRecord.source === 'excel'
                      ? 'Não se aplica'
                      : selectedRecord.gps?.label || 'Não capturado'}
                  </strong>
                  <small>
                    {selectedRecord.source === 'excel'
                      ? 'Registro histórico do Excel não possui GPS'
                      : selectedRecord.gpsOccurrences?.length
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

              {selectedRecord.source !== 'excel' && selectedRecord.gpsOccurrences?.length ? (
                <div className="card modal-embedded-card">
                  <div className="card-header modal-embedded-card-header">
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
                  <div className="card-header modal-section-header-compact">
                    <div>
                      <h3 className="card-title">Imagens geolocalizadas</h3>
                      <span className="card-subtitle">Evidências enviadas pelo app com coordenadas da captura.</span>
                    </div>
                  </div>
                  <div className="evidence-grid">
                    {selectedPhotos.map((photo) => (
                      <EvidencePhoto
                        key={photoDedupKey(photo)}
                        photo={photo}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <span className={`collection-transmission-status ${selectedRecord.status === 'Sincronizado' ? 'is-success' : ''}`}>
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
              <button onClick={handleDelete} className="btn btn-secondary btn-outline-danger" disabled={isDeleting || selectedRecord.source === 'excel' || !canDeleteResponses} title={canDeleteResponses ? 'Excluir ficha' : 'Permissão necessária'}>
                <Trash2 size={14} />
                Excluir
              </button>
              <button onClick={() => handleReview('reprovado')} className="btn btn-danger" disabled={isReviewing || isDeleting || selectedRecord.source === 'excel' || !canReviewResponses} title={canReviewResponses ? 'Reprovar ficha' : 'Permissão necessária'}>
                <ThumbsDown size={14} />
                Reprovar
              </button>
              <button onClick={() => handleReview('aprovado')} className="btn btn-primary" disabled={isReviewing || isDeleting || selectedRecord.source === 'excel' || !canReviewResponses} title={canReviewResponses ? 'Aprovar ficha' : 'Permissão necessária'}>
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

      {deleteCandidate ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar exclusão de ficha"
          onClick={() => (!isDeleting ? setDeleteCandidate(null) : null)}
        >
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Trash2 size={18} className="modal-title-icon-danger" />
                Excluir ficha #{deleteCandidate.id}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteCandidate(null)}
                disabled={isDeleting}
                aria-label="Fechar confirmação de exclusão"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Esta ação remove permanentemente a ficha do Supabase e não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteCandidate(null)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                <Trash2 size={14} />
                {isDeleting ? 'Excluindo...' : 'Excluir ficha'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDeleteCandidate?.length ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar exclusão de fichas selecionadas"
          onClick={() => (!isDeleting ? setBulkDeleteCandidate(null) : null)}
        >
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Trash2 size={18} className="modal-title-icon-danger" />
                Excluir {formatNumber(bulkDeleteCandidate.length)} ficha(s)
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setBulkDeleteCandidate(null)}
                disabled={isDeleting}
                aria-label="Fechar confirmação de exclusão em lote"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Esta ação remove permanentemente as fichas selecionadas do Supabase e não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBulkDeleteCandidate(null)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 size={14} />
                {isDeleting ? 'Excluindo...' : 'Excluir selecionadas'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={feedback.title}
          onClick={() => setFeedback(null)}
        >
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {feedback.tone === 'danger' ? (
                  <AlertCircle size={18} className="modal-title-icon-danger" />
                ) : (
                  <AlertCircle size={18} className="modal-title-icon-warning" />
                )}
                {feedback.title}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setFeedback(null)}
                aria-label="Fechar aviso"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>{feedback.message}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setFeedback(null)}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
