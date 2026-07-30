function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

export function isLocalOnlyPhotoUrl(url) {
  return /^(file|content):\/\//i.test(String(url || ''));
}

function normalizedMediaBasename(value) {
  if (!value) return '';

  let candidate = String(value).split(/[?#]/, 1)[0];
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Keep the original value when a legacy path has invalid URL escaping.
  }

  const basename = candidate.replaceAll('\\', '/').split('/').filter(Boolean).pop() || '';
  return basename
    .replace(/^\d+_/, '')
    .replace(/^(?:thumb|thumbnail)_/i, '')
    .toLowerCase();
}

function mediaIdentity(photo) {
  const candidates = [
    photo?.storagePath,
    photo?.url,
    photo?.thumbnailStoragePath,
    photo?.thumbnailUrl,
    photo?.fileName,
  ];

  for (const candidate of candidates) {
    const basename = normalizedMediaBasename(candidate);
    if (basename && /\.(?:jpe?g|png|webp|heic|heif)$/i.test(basename)) return basename;
  }

  return '';
}

function capturedAtKey(value) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? String(timestamp) : String(value);
}

function semanticIdentity(photo) {
  return [photo?.fieldId, capturedAtKey(photo?.capturedAt)]
    .filter(Boolean)
    .join('|')
    .toLowerCase();
}

function meaningfulFieldId(value) {
  const fieldId = String(value || '').trim();
  if (!fieldId || /^foto_\d+$/i.test(fieldId) || /^anexo_\d+$/i.test(fieldId)) return '';
  return fieldId;
}

function remoteUrl(...values) {
  return values.find((value) => value && !isLocalOnlyPhotoUrl(value)) || null;
}

function mergePhotos(current, incoming) {
  const url = remoteUrl(current?.url, incoming?.url)
    || firstDefined(current?.url, incoming?.url);
  const fieldId = meaningfulFieldId(current?.fieldId)
    || meaningfulFieldId(incoming?.fieldId)
    || firstDefined(current?.fieldId, incoming?.fieldId);

  return {
    ...incoming,
    ...current,
    id: firstDefined(current?.id, incoming?.id),
    fieldId,
    fileName: firstDefined(current?.fileName, incoming?.fileName),
    mimeType: firstDefined(current?.mimeType, incoming?.mimeType, 'image/jpeg'),
    base64: firstDefined(current?.base64, incoming?.base64),
    url,
    thumbnailUrl: remoteUrl(current?.thumbnailUrl, incoming?.thumbnailUrl),
    storagePath: firstDefined(current?.storagePath, incoming?.storagePath),
    thumbnailStoragePath: firstDefined(current?.thumbnailStoragePath, incoming?.thumbnailStoragePath),
    sizeBytes: firstDefined(current?.sizeBytes, incoming?.sizeBytes),
    thumbnailSizeBytes: firstDefined(current?.thumbnailSizeBytes, incoming?.thumbnailSizeBytes),
    originalSizeBytes: firstDefined(current?.originalSizeBytes, incoming?.originalSizeBytes),
    optimized: Boolean(current?.optimized || incoming?.optimized),
    capturedAt: firstDefined(current?.capturedAt, incoming?.capturedAt),
    gps: firstDefined(current?.gps, incoming?.gps),
    localOnly: isLocalOnlyPhotoUrl(url),
  };
}

export function extractRawPhotos(raw) {
  const photos = [];
  const visit = (value, path = []) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index + 1)]));
      return;
    }

    if (typeof value !== 'object') return;

    const url = value.url || value.signed_url || value.public_url || value.storage_url || value.uri || null;
    const thumbnailUrl = value.thumbnailUrl
      || value.thumbnail_url
      || value.thumbnail_signed_url
      || value.thumbUrl
      || value.thumb_url
      || null;
    const thumbnailStoragePath = value.thumbnailStoragePath
      || value.thumbnail_storage_path
      || value.thumbStoragePath
      || value.thumb_storage_path
      || null;
    const hasPhotoPayload = Boolean(
      value.base64
      || url
      || thumbnailUrl
      || value.storage_path
      || value.storagePath
      || thumbnailStoragePath
    );
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
        thumbnailUrl,
        localOnly: isLocalOnlyPhotoUrl(url),
        storagePath: value.storage_path || value.storagePath || null,
        thumbnailStoragePath,
        sizeBytes: value.tamanho_bytes || value.sizeBytes || value.size || null,
        thumbnailSizeBytes: value.thumbnail_tamanho_bytes || value.thumbnailSizeBytes || null,
        originalSizeBytes: value.original_tamanho_bytes || value.originalSizeBytes || null,
        optimized: Boolean(value.otimizado || value.optimized),
        capturedAt: value.capturedAt || value.capturado_em || value.criado_em || null,
        gps: value.gps || null,
      });
    }

    Object.entries(value).forEach(([key, child]) => visit(child, [...path, key]));
  };

  visit(raw);
  return photos;
}

export function photoDedupKey(photo) {
  const mediaKey = mediaIdentity(photo);
  if (mediaKey) return `media:${mediaKey}`;

  const semanticKey = semanticIdentity(photo);
  if (semanticKey) return `event:${semanticKey}`;

  return `photo:${[
    photo?.id,
    photo?.fieldId,
    photo?.fileName,
  ].filter(Boolean).join('|') || 'sem-identificador'}`;
}

export function uniquePhotos(photos) {
  const merged = new Map();

  (photos || []).filter(Boolean).forEach((photo) => {
    const key = photoDedupKey(photo);
    const current = merged.get(key);
    merged.set(key, current ? mergePhotos(current, photo) : photo);
  });

  return Array.from(merged.values());
}

export function photoImageCandidates(photo, recoveryUrl = '') {
  const candidates = [
    recoveryUrl,
    photo?.thumbnailUrl && !isLocalOnlyPhotoUrl(photo.thumbnailUrl) ? photo.thumbnailUrl : '',
    photo?.url && !photo?.localOnly && !isLocalOnlyPhotoUrl(photo.url) ? photo.url : '',
    photo?.base64 ? `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}` : '',
  ].filter(Boolean);

  return Array.from(new Set(candidates));
}

const EVIDENCE_LABELS = {
  cacho_avermelhado: 'Cacho avermelhado',
  cacho_esquecido_ciclo: 'Cacho esquecido',
  cacho_mal_posicionado: 'Cacho mal posicionado',
  cacho_nao_carreado: 'Cacho não carreado',
  cacho_podre_planta: 'Cacho podre na planta',
  cacho_verde: 'Cacho verde',
  folha_mamando: 'Folha mamando',
  palha_mal_empilhada: 'Palha mal empilhada',
  planta_sem_podar: 'Planta sem podar',
  poda_maior_1_1: 'Poda maior que 1:1',
  poda_meia_coroa: 'Poda em meia coroa',
};

export function evidencePhotoLabel(photo) {
  const fieldId = meaningfulFieldId(photo?.fieldId);
  if (!fieldId) return 'Evidência fotográfica';
  if (EVIDENCE_LABELS[fieldId]) return EVIDENCE_LABELS[fieldId];

  const label = fieldId
    .replace(/^ocorrencia_/, '')
    .replaceAll('_', ' ')
    .trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Evidência fotográfica';
}
