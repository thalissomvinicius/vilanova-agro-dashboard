import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  MapPin,
  Pencil,
  PlusCircle,
  Rows3,
  Save,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import EmptyTableRow from '../components/ui/EmptyTableRow';
import PageHeader from '../components/ui/PageHeader';
import StatusBanner from '../components/ui/StatusBanner';
import { canUseDashboardAction, createManualResponse, dashboardErrorMessage, filterRecords, getAttachmentStorageSignedUrl, updateResponseMetadata, updateResponseReviewStatus, deleteResponseRecord, refreshAttachmentStorageSignedUrl, refreshCqoData, useCqoData } from '../utils/cqoData';
import { devWarn } from '../utils/devLog';
import { exportDashboardRecord } from '../utils/reportExporter';
import {
  evidencePhotoLabel,
  extractRawPhotos,
  isLocalOnlyPhotoUrl,
  photoDedupKey,
  photoImageCandidates,
  uniquePhotos,
} from '../utils/cqoPhotos';

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

function EvidencePhoto({ photo }) {
  const [failedSources, setFailedSources] = useState([]);
  const [preview, setPreview] = useState(() => ({
    url: '',
    attempted: false,
    loading: photoImageCandidates(photo).length === 0
      && Boolean(photo?.thumbnailStoragePath || photo?.storagePath)
      && !photo?.localOnly,
  }));
  const src = photoImageCandidates(photo, preview.url)
    .find((candidate) => !failedSources.includes(candidate)) || '';
  const canResolveRemoteFile = Boolean(photo?.storagePath && !photo?.localOnly);
  const placeholderText = photo.localOnly
    ? 'Foto no app, upload pendente'
    : preview.loading
      ? 'Carregando prévia...'
      : failedSources.length > 0
        ? 'Prévia indisponível, abrir arquivo'
        : 'Arquivo sem prévia';

  useEffect(() => {
    let active = true;
    const hasInlinePreview = photoImageCandidates(photo).length > 0;
    const storagePaths = Array.from(new Set([
      photo?.thumbnailStoragePath,
      photo?.storagePath,
    ].filter(Boolean)));

    if (hasInlinePreview || storagePaths.length === 0 || photo?.localOnly) {
      return () => {
        active = false;
      };
    }

    (async () => {
      for (const storagePath of storagePaths) {
        try {
          const signedUrl = await getAttachmentStorageSignedUrl(storagePath);
          if (signedUrl && active) {
            setPreview({ url: signedUrl, attempted: true, loading: false });
            return;
          }
        } catch (error) {
          devWarn('Nao foi possivel carregar a previa da evidencia:', error);
        }
      }

      if (active) setPreview({ url: '', attempted: true, loading: false });
    })();

    return () => {
      active = false;
    };
  }, [photo]);

  const handlePreviewError = async () => {
    if (src) setFailedSources((current) => (current.includes(src) ? current : [...current, src]));
    if (preview.attempted || !canResolveRemoteFile) return;

    setPreview({ url: '', attempted: true, loading: true });
    try {
      const freshUrl = await refreshAttachmentStorageSignedUrl(photo.storagePath);
      setPreview({ url: freshUrl || '', attempted: true, loading: false });
    } catch (error) {
      devWarn('Nao foi possivel renovar a URL da evidencia:', error);
      setPreview({ url: '', attempted: true, loading: false });
    }
  };

  const handleOpenImage = async () => {
    let targetUrl = photo?.url && !isLocalOnlyPhotoUrl(photo.url) ? photo.url : '';
    if (canResolveRemoteFile) {
      try {
        targetUrl = await getAttachmentStorageSignedUrl(photo.storagePath) || targetUrl;
      } catch (error) {
        devWarn('Nao foi possivel abrir a evidencia original:', error);
      }
    }
    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="evidence-photo">
      {src ? (
        <img
          src={src}
          alt={photo.fieldId}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handlePreviewError}
        />
      ) : (
        <div className="evidence-file-placeholder">
          <Download size={18} />
          <span>{placeholderText}</span>
          {canResolveRemoteFile || (photo?.url && !photo?.localOnly) ? (
            <button type="button" className="evidence-open-link" onClick={handleOpenImage}>
              Abrir imagem
            </button>
          ) : null}
        </div>
      )}
      <div>
        <strong>{evidencePhotoLabel(photo)}</strong>
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

function EvidencePhotoGrid({ photos }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePhotos = expanded ? photos : photos.slice(0, 8);
  const hiddenCount = Math.max(0, photos.length - visiblePhotos.length);

  return (
    <>
      <div className="evidence-grid">
        {visiblePhotos.map((photo) => (
          <EvidencePhoto
            key={photoDedupKey(photo)}
            photo={photo}
          />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="btn btn-secondary evidence-load-more"
          onClick={() => setExpanded(true)}
        >
          Carregar mais {hiddenCount} foto(s)
        </button>
      ) : null}
    </>
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

const MANUAL_FORM_OPTIONS = [
  { id: 'form_cqo_corte', label: 'CQO Corte', type: 'corte', lineKey: 'linhas_corte' },
  { id: 'form_cqo_carreamento_fruto_solto', label: 'CQO Carreamento e Fruto Solto', type: 'carreamento', lineKey: 'linhas_carreamento' },
  { id: 'form_cqo_poda', label: 'CQO Poda', type: 'poda', lineKey: 'linhas_poda' },
];

const MANUAL_FORM_BY_ID = MANUAL_FORM_OPTIONS.reduce((acc, form) => {
  acc[form.id] = form;
  return acc;
}, {});

const MANUAL_POLO_OPTIONS = ['Tomé-Açu', 'Tome-Acu'];
const MANUAL_FARM_OPTIONS = ['FÉ EM DEUS', 'NOVA CONCEIÇÃO', 'VILA NOVA'];
const MANUAL_FISCAL_RESP_OPTIONS = ['1938 - DANIEL SOUZA COSTA'];
const MANUAL_FISCAL_EQUIPE_OPTIONS = [
  '2833 - ANTONIO BARBOSA FERREIRA',
  '1790 - DANILSON OLIVEIRA MOREIRA',
  '2950 - FRANCISCO DAS CHAGAS PEREIRA SANTOS',
  '2844 - JOAO GABRIEL PEREIRA BEZERRA',
  '384 - RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR',
  '2146 - RENEY NERES DA COSTA',
  '2084 - RONALD DA SILVA PONTES',
  '1155 - VALDINEI GOMES SANCHES',
  '2179 - JOAO BATISTA SANTOS DE OLIVEIRA',
  '2487 - ANTONIO CARLOS PEREIRA SOARES',
  '2798 - MAISES ALBUQUERQUE DE ANDRADE',
  '2963 - VALCIONE DA CONCEICAO',
];

const MANUAL_LINE_FIELDS = {
  corte: [
    ['linha', 'Linha', 'text'],
    ['matricula_colaborador', 'Mat. colab.', 'text'],
    ['numero_plantas_linha', 'Plantas', 'number'],
    ['numero_cachos_observados_papel', 'Cachos obs.', 'number'],
    ['cacho_esquecido_ciclo', 'Esquecido', 'number'],
    ['cacho_verde', 'Verde', 'number'],
    ['cacho_maduro', 'Maduro', 'number'],
    ['cacho_passado', 'Passado', 'number'],
    ['cacho_infermo', 'Infermo', 'number'],
    ['bucha', 'Bucha', 'number'],
    ['folha_mamando', 'F. mamando', 'number'],
    ['cacho_talo_comprido', 'Talo comp.', 'number'],
    ['folha_cortada_indevida', 'F. cortada', 'number'],
    ['cacho_mal_posicionado', 'Palha M.E.', 'number'],
    ['cacho_estrela', 'Estrela', 'number'],
    ['cacho_brocado', 'Brocado', 'number'],
    ['cacho_avermelhado', 'Avermelhado', 'number'],
  ],
  carreamento: [
    ['linha', 'Linha', 'text'],
    ['numero_plantas_linha', 'Plantas', 'number'],
    ['cacho_nao_carreado', 'Não carreado', 'number'],
    ['cacho_mal_posicionado', 'Mal posicionado', 'number'],
  ],
  poda: [
    ['linha', 'Linha', 'text'],
    ['numero_plantas_linha', 'Plantas', 'number'],
    ['planta_sem_podar', 'Sem podar', 'number'],
    ['cacho_exposto', 'Cacho exposto', 'number'],
    ['poda_meia_coroa', 'Meia coroa', 'number'],
    ['folha_mamando', 'Folha mamando', 'number'],
    ['poda_maior_1_1', 'Poda > 1:1', 'number'],
    ['bico_gaita', 'Bico gaita', 'number'],
    ['cacho_podre_planta', 'Cacho podre', 'number'],
    ['palha_mal_empilhada', 'Palha M.E.', 'number'],
  ],
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueTextOptions(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

function optionValue(option) {
  return typeof option === 'object' && option !== null ? option.value : option;
}

function optionLabel(option) {
  return typeof option === 'object' && option !== null ? option.label : '';
}

function uniqueObjectOptions(options) {
  const seen = new Set();
  return options
    .map((option) => {
      if (typeof option === 'object' && option !== null) {
        return {
          value: String(option.value || '').trim(),
          label: String(option.label || '').trim(),
        };
      }
      return { value: String(option || '').trim(), label: '' };
    })
    .filter((option) => option.value)
    .filter((option) => {
      const key = option.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR', { numeric: true }));
}

function buildManualOptionSources(records = []) {
  const parcelsByFarm = {};
  const evaluatorOptions = [];
  const fiscalEquipeOptions = [...MANUAL_FISCAL_EQUIPE_OPTIONS];
  const fiscalRespOptions = [...MANUAL_FISCAL_RESP_OPTIONS];

  records.forEach((record) => {
    const farm = String(record?.farm || record?.raw?.nome_fazenda || '').trim();
    const parcel = String(record?.parcel || record?.raw?.parcela || '').trim();
    if (farm && parcel) {
      if (!parcelsByFarm[farm]) parcelsByFarm[farm] = [];
      parcelsByFarm[farm].push(parcel);
    }

    const evaluatorMatricula = String(record?.evaluatorMatricula || record?.raw?.matricula_avaliador || '').trim();
    const evaluatorName = String(record?.evaluator || '').trim();
    if (evaluatorMatricula) {
      evaluatorOptions.push({
        value: evaluatorMatricula,
        label: evaluatorName && evaluatorName !== evaluatorMatricula ? evaluatorName : '',
      });
    }

    const evaluator2 = String(record?.raw?.matricula_avaliador_2 || '').trim();
    if (evaluator2) evaluatorOptions.push({ value: evaluator2, label: '' });

    const fiscalEquipe = String(record?.raw?.fiscal_resp_equipe || record?.fiscal || '').trim();
    if (fiscalEquipe && fiscalEquipe !== '--') fiscalEquipeOptions.push(fiscalEquipe);

    const fiscalResp = String(record?.raw?.fiscal_resp || '').trim();
    if (fiscalResp && fiscalResp !== '--') fiscalRespOptions.push(fiscalResp);
  });

  const normalizedParcelsByFarm = Object.fromEntries(
    Object.entries(parcelsByFarm).map(([farm, parcels]) => [farm, uniqueTextOptions(parcels)])
  );

  return {
    farms: uniqueTextOptions([...MANUAL_FARM_OPTIONS, ...records.map((record) => record?.farm)]),
    parcels: uniqueTextOptions(records.map((record) => record?.parcel)),
    parcelsByFarm: normalizedParcelsByFarm,
    cycles: uniqueTextOptions(records.map((record) => record?.cycle).filter((value) => value && value !== '--')),
    plantingYears: uniqueTextOptions(records.map((record) => record?.plantingYear || record?.raw?.ano_plantio)),
    evaluators: uniqueObjectOptions(evaluatorOptions),
    fiscalResp: uniqueTextOptions(fiscalRespOptions),
    fiscalEquipe: uniqueTextOptions(fiscalEquipeOptions),
  };
}

function ManualDatalistField({
  label,
  value,
  onChange,
  options = [],
  listId,
  required = false,
  type = 'text',
  inputMode,
  placeholder = '',
  className = '',
}) {
  return (
    <label className={`form-group ${className}`.trim()}>
      <span className="form-label">{label}</span>
      <input
        className="form-input manual-choice-input"
        type={type}
        inputMode={inputMode}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
      <datalist id={listId}>
        {options.map((option) => {
          const valueText = optionValue(option);
          return (
            <option
              key={`${listId}-${valueText}`}
              value={valueText}
              label={optionLabel(option)}
            />
          );
        })}
      </datalist>
    </label>
  );
}

function emptyManualMeta(formularioId = 'form_cqo_corte', user = {}) {
  return {
    formularioId,
    status: 'aprovado',
    nome_polo: 'Tomé-Açu',
    data_avaliacao: todayInputValue(),
    hora_avaliacao: '',
    nome_fazenda: '',
    parcela: '',
    ano_plantio: '',
    ciclo_mes: '',
    densidade: '',
    total_plantas_parcela: '',
    total_cachos_carreados: '',
    variedade: '',
    empresa_tipo: 'VILA NOVA',
    empresa_outra: '',
    matricula_avaliador: user?.matricula || '',
    matricula_avaliador_2: '',
    fiscal_resp: '',
    fiscal_resp_equipe: '',
    observacao: '',
  };
}

function emptyManualLine(formularioId = 'form_cqo_corte', index = 0) {
  const form = MANUAL_FORM_BY_ID[formularioId] || MANUAL_FORM_OPTIONS[0];
  return (MANUAL_LINE_FIELDS[form.type] || []).reduce((acc, [key, , type]) => {
    acc[key] = key === 'linha' ? String(index + 1) : type === 'number' ? '0' : '';
    return acc;
  }, {});
}

function manualComparableValue(value) {
  return String(value ?? '').trim();
}

function hasManualDraftChanges(meta, lines, user = {}) {
  const form = MANUAL_FORM_BY_ID[meta.formularioId] || MANUAL_FORM_OPTIONS[0];
  const lineFields = MANUAL_LINE_FIELDS[form.type] || [];
  const initialMeta = emptyManualMeta(meta.formularioId, user);
  const metaChanged = Object.keys(initialMeta).some((key) => (
    manualComparableValue(meta[key]) !== manualComparableValue(initialMeta[key])
  ));

  if (metaChanged || lines.length !== 1) return true;

  const initialLine = emptyManualLine(meta.formularioId, 0);
  return lineFields.some(([key]) => (
    manualComparableValue(lines[0]?.[key]) !== manualComparableValue(initialLine[key])
  ));
}

function manualInsertErrorMessage(error) {
  const friendly = dashboardErrorMessage(error, 'Confira os campos e tente novamente.');
  const raw = String(error?.message || error || '').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!raw) return friendly;
  if (normalized.includes('dashboard_create_manual_response')
    || normalized.includes('could not find the function')
    || normalized.includes('pgrst202')) {
    return 'A função de lançamento manual não está disponível no Supabase. Rode o arquivo supabase/DASHBOARD_MANUAL_RESPONSE_HOTFIX.sql e tente novamente.';
  }
  if (normalized.includes('create_manual_response') && normalized.includes('sem permissao')) {
    return 'Seu perfil não tem permissão para lançar ficha manual. Libere a permissão create_manual_response para sua matrícula.';
  }

  const detail = raw
    .replace(/^Lancamento manual de ficha:\s*/i, '')
    .replace(/^Lançamento manual de ficha:\s*/i, '')
    .slice(0, 300);

  if (!detail || friendly.includes(detail)) return friendly;
  return `${friendly} Detalhe: ${detail}`;
}

function recordEditErrorMessage(error) {
  const friendly = dashboardErrorMessage(error, 'Confira os campos e tente novamente.');
  const raw = String(error?.message || error || '').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!raw) return friendly;
  if (normalized.includes('dashboard_update_response_metadata')
    || normalized.includes('could not find the function')
    || normalized.includes('pgrst202')) {
    return 'A função de edição de ficha não está disponível no Supabase. Rode o arquivo supabase/DASHBOARD_RESPONSE_EDIT_HOTFIX.sql e tente novamente.';
  }

  const detail = raw
    .replace(/^Correção de ficha:\s*/i, '')
    .replace(/^Correcao de ficha:\s*/i, '')
    .slice(0, 300);

  if (!detail || friendly.includes(detail)) return friendly;
  return `${friendly} Detalhe: ${detail}`;
}

function dateInputValue(value, fallback = '') {
  const raw = String(value || fallback || '').trim();
  if (!raw || raw === '--') return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function timeInputValue(value, fallback = '') {
  const raw = String(value || fallback || '').trim();
  if (!raw || raw === '--') return '';
  const direct = raw.match(/(?:T|\s)?(\d{2}):(\d{2})/);
  if (direct) return `${direct[1]}:${direct[2]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function displayDateFromInput(value) {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return raw || '--';
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

function buildRecordEditDraft(record) {
  const raw = record?.raw || {};
  return {
    data_avaliacao: dateInputValue(raw.data_avaliacao || raw.data_hora_avaliacao, record?.date),
    hora_avaliacao: timeInputValue(raw.hora_avaliacao || raw.data_hora_avaliacao, record?.time),
    nome_polo: String(raw.nome_polo || '').trim(),
    nome_fazenda: String(raw.nome_fazenda || record?.farm || '').trim(),
    parcela: String(raw.parcela || record?.parcel || '').trim(),
    ano_plantio: String(raw.ano_plantio || record?.plantingYear || '').trim(),
    ciclo_mes: String(raw.ciclo_mes || record?.cycle || '').trim(),
    matricula_avaliador: String(raw.matricula_avaliador || record?.evaluatorMatricula || '').trim(),
    matricula_avaliador_2: String(raw.matricula_avaliador_2 || '').trim(),
    fiscal_resp: String(raw.fiscal_resp || '').trim(),
    fiscal_resp_equipe: String(raw.fiscal_resp_equipe || record?.fiscal || '').trim(),
    observacao: String(raw.observacao || record?.observation || '').trim(),
  };
}

function buildRecordEditPatch(draft) {
  const date = String(draft.data_avaliacao || '').trim();
  const time = String(draft.hora_avaliacao || '').trim();
  return {
    nome_polo: String(draft.nome_polo || '').trim(),
    nome_fazenda: String(draft.nome_fazenda || '').trim(),
    parcela: String(draft.parcela || '').trim(),
    ano_plantio: String(draft.ano_plantio || '').trim(),
    ciclo_mes: String(draft.ciclo_mes || '').trim(),
    data_avaliacao: date,
    hora_avaliacao: time,
    data_hora_avaliacao: date && time ? `${date}T${time}:00` : date,
    matricula_avaliador: String(draft.matricula_avaliador || '').trim(),
    matricula_avaliador_2: String(draft.matricula_avaliador_2 || '').trim(),
    fiscal_resp: String(draft.fiscal_resp || '').trim(),
    fiscal_resp_equipe: String(draft.fiscal_resp_equipe || '').trim(),
    observacao: String(draft.observacao || '').trim(),
  };
}

function applyRecordPatchForDisplay(record, patch) {
  if (!record) return record;
  const fiscalResponsavel = patch.fiscal_resp || '--';
  const fiscalResponsavelEquipe = patch.fiscal_resp_equipe || '--';
  return {
    ...record,
    raw: { ...(record.raw || {}), ...patch },
    date: displayDateFromInput(patch.data_avaliacao) || record.date,
    time: patch.hora_avaliacao || '--',
    farm: patch.nome_fazenda || record.farm,
    parcel: patch.parcela || record.parcel,
    cycle: patch.ciclo_mes || record.cycle,
    evaluatorMatricula: patch.matricula_avaliador || record.evaluatorMatricula,
    fiscal: patch.fiscal_resp_equipe || patch.fiscal_resp || record.fiscal,
    fiscalResponsavel,
    fiscalResponsavelEquipe,
    observation: patch.observacao || '',
    plantingYear: patch.ano_plantio || '',
  };
}

function parseManualNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const normalized = String(value).replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildManualPayload(meta, lines) {
  const form = MANUAL_FORM_BY_ID[meta.formularioId] || MANUAL_FORM_OPTIONS[0];
  const lineFields = MANUAL_LINE_FIELDS[form.type] || [];
  const cleanedLines = lines.map((line, index) => lineFields.reduce((acc, [key, , type]) => {
    if (type === 'number') {
      acc[key] = parseManualNumber(line[key]);
    } else {
      acc[key] = String(line[key] || '').trim() || String(index + 1);
    }
    return acc;
  }, {}));
  const dataHora = meta.data_avaliacao && meta.hora_avaliacao
    ? `${meta.data_avaliacao}T${meta.hora_avaliacao}:00`
    : meta.data_avaliacao;
  return {
    nome_polo: String(meta.nome_polo || '').trim(),
    nome_fazenda: String(meta.nome_fazenda || '').trim(),
    parcela: String(meta.parcela || '').trim(),
    ano_plantio: String(meta.ano_plantio || '').trim(),
    ciclo_mes: String(meta.ciclo_mes || '').trim(),
    data_avaliacao: meta.data_avaliacao,
    hora_avaliacao: meta.hora_avaliacao,
    data_hora_avaliacao: dataHora,
    matricula_avaliador: String(meta.matricula_avaliador || '').trim(),
    matricula_avaliador_2: String(meta.matricula_avaliador_2 || '').trim(),
    fiscal_resp: String(meta.fiscal_resp || '').trim(),
    fiscal_resp_equipe: String(meta.fiscal_resp_equipe || '').trim(),
    observacao: String(meta.observacao || '').trim(),
    acompanhamento: { teve: 'nao', matricula: '', nome: '' },
    origem_manual_dashboard: true,
    origem_manual_tipo: 'papel',
    gps_nao_aplicavel: true,
    ...(form.type === 'carreamento'
      ? {
          densidade: parseManualNumber(meta.densidade),
          total_plantas_parcela: parseManualNumber(meta.total_plantas_parcela),
          total_cachos_carreados: parseManualNumber(meta.total_cachos_carreados),
          variedade: String(meta.variedade || '').trim(),
        }
      : {}),
    ...(form.type === 'poda'
      ? {
          atividade: 'PODA',
          empresa_tipo: String(meta.empresa_tipo || '').trim(),
          empresa_outra: String(meta.empresa_outra || '').trim(),
          empresa: meta.empresa_tipo === 'OUTRA'
            ? String(meta.empresa_outra || '').trim()
            : 'VILA NOVA',
        }
      : {}),
    [form.lineKey]: cleanedLines,
  };
}

export default function Collections({ farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter = 'all', dateFrom, dateTo, searchTerm, user }) {
  const { loading, records, source, error } = useCqoData();
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formTypeFilter, setFormTypeFilter] = useState('all');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [searchFicha, setSearchFicha] = useState('');
  const [reviewOverrides, setReviewOverrides] = useState({});
  const [deletedRecords, setDeletedRecords] = useState(new Set());
  const [selectedRecordIds, setSelectedRecordIds] = useState(new Set());
  const [recordEditDraft, setRecordEditDraft] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingRecordEdit, setIsSavingRecordEdit] = useState(false);
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [bulkDeleteCandidate, setBulkDeleteCandidate] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualMeta, setManualMeta] = useState(() => emptyManualMeta('form_cqo_corte', user));
  const [manualLines, setManualLines] = useState(() => [emptyManualLine('form_cqo_corte', 0)]);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [manualCloseConfirmOpen, setManualCloseConfirmOpen] = useState(false);
  const manualMetaRef = useRef(manualMeta);
  const manualLinesContainerRef = useRef(null);
  const manualFirstInputRefs = useRef([]);
  const pendingManualLineFocusRef = useRef(null);
  const canReviewResponses = canUseDashboardAction(user, 'review_response');
  const canDeleteResponses = canUseDashboardAction(user, 'delete_response');
  const canCreateManualResponse = canUseDashboardAction(user, 'create_manual_response') || canReviewResponses;
  const canEditResponses = canReviewResponses;

  useEffect(() => {
    manualMetaRef.current = manualMeta;
  }, [manualMeta]);

  useEffect(() => {
    const focusIndex = pendingManualLineFocusRef.current;
    if (focusIndex === null || focusIndex === undefined) return undefined;
    pendingManualLineFocusRef.current = null;

    const raf = window.requestAnimationFrame(() => {
      const container = manualLinesContainerRef.current;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
      manualFirstInputRefs.current[focusIndex]?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [manualLines.length]);

  const displayRecords = useMemo(() => (
    records
      .filter(record => !deletedRecords.has(record.id))
      .map((record) => ({
        ...record,
        status: reviewOverrides[record.id] || record.status,
      }))
  ), [records, deletedRecords, reviewOverrides]);

  const filteredRecords = useMemo(() => {
    const globallyFiltered = filterRecords(displayRecords, {
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
    });
    const locallyFiltered = filterRecords(globallyFiltered, {
      areaFilter: formTypeFilter,
      periodFilter: auditDateFrom || auditDateTo ? 'custom' : 'all',
      dateFrom: auditDateFrom,
      dateTo: auditDateTo,
    });

    return locallyFiltered.filter((record) => {
      if (!searchFicha) return true;
      const term = searchFicha.toLowerCase();
      return String(record.id || '').toLowerCase().includes(term)
        || String(record.formId || '').toLowerCase().includes(term);
    });
  }, [
    displayRecords,
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
    formTypeFilter,
    auditDateFrom,
    auditDateTo,
    searchFicha,
  ]);

  const hasLocalAuditFilters = formTypeFilter !== 'all' || Boolean(auditDateFrom) || Boolean(auditDateTo);

  const handleAuditDateFromChange = (value) => {
    setAuditDateFrom(value);
    if (value && auditDateTo && value > auditDateTo) setAuditDateTo(value);
  };

  const handleAuditDateToChange = (value) => {
    setAuditDateTo(value);
    if (value && auditDateFrom && value < auditDateFrom) setAuditDateFrom(value);
  };

  const clearLocalAuditFilters = () => {
    setFormTypeFilter('all');
    setAuditDateFrom('');
    setAuditDateTo('');
  };

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

  const openRecordDetails = (record) => {
    setRecordEditDraft(null);
    setSelectedRecord(record);
  };

  const closeRecordDetails = () => {
    if (isSavingRecordEdit) return;
    setRecordEditDraft(null);
    setSelectedRecord(null);
  };

  const openRecordEditor = () => {
    if (!selectedRecord || selectedRecord.source === 'excel') return;
    if (!canEditResponses) {
      showFeedback(
        'Acesso restrito',
        'Seu perfil não tem permissão para corrigir fichas do app no dashboard.'
      );
      return;
    }
    setRecordEditDraft(buildRecordEditDraft(selectedRecord));
  };

  const updateRecordEditDraft = (field, value) => {
    setRecordEditDraft((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const cancelRecordEdit = () => {
    if (isSavingRecordEdit) return;
    setRecordEditDraft(null);
  };

  const openManualEntryModal = () => {
    if (!canCreateManualResponse) {
      showFeedback(
        'Acesso restrito',
        'Seu perfil não tem permissão para lançar fichas manuais no dashboard.'
      );
      return;
    }
    const formularioId = manualMeta.formularioId || 'form_cqo_corte';
    setManualMeta(emptyManualMeta(formularioId, user));
    setManualLines([emptyManualLine(formularioId, 0)]);
    setManualCloseConfirmOpen(false);
    setManualModalOpen(true);
  };

  const closeManualEntryModal = ({ force = false } = {}) => {
    if (isCreatingManual) return;
    if (!force && hasManualDraftChanges(manualMeta, manualLines, user)) {
      setManualCloseConfirmOpen(true);
      return;
    }
    setManualCloseConfirmOpen(false);
    setManualModalOpen(false);
  };

  const handleManualFormChange = (event) => {
    const formularioId = event.target.value;
    setManualMeta(emptyManualMeta(formularioId, user));
    setManualLines([emptyManualLine(formularioId, 0)]);
  };

  const updateManualMeta = (field, value) => {
    setManualMeta((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'empresa_tipo' && value !== 'OUTRA' ? { empresa_outra: '' } : {}),
    }));
  };

  const updateManualLine = (index, field, value) => {
    setManualLines((prev) => prev.map((line, lineIndex) => (
      lineIndex === index ? { ...line, [field]: value } : line
    )));
  };

  const addManualLine = () => {
    setManualLines((prev) => {
      const nextIndex = prev.length;
      pendingManualLineFocusRef.current = nextIndex;
      return [
        ...prev,
        emptyManualLine(manualMetaRef.current?.formularioId || 'form_cqo_corte', nextIndex),
      ];
    });
  };

  const removeManualLine = (index) => {
    setManualLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, lineIndex) => lineIndex !== index);
    });
  };

  const handleCreateManualResponse = async (event) => {
    event.preventDefault();
    if (!canCreateManualResponse) {
      showFeedback(
        'Acesso restrito',
        'Seu perfil não tem permissão para lançar fichas manuais no dashboard.'
      );
      return;
    }

    const requiredFields = [
      ['nome_polo', 'Polo'],
      ['data_avaliacao', 'Data da avaliação'],
      ['nome_fazenda', 'Fazenda'],
      ['parcela', 'Parcela'],
      ['matricula_avaliador', 'Matrícula do avaliador'],
      ['fiscal_resp', 'Fiscal responsável'],
      ['fiscal_resp_equipe', 'Fiscal responsável da equipe'],
    ];
    if (currentManualForm.type !== 'carreamento') {
      requiredFields.push(['ano_plantio', 'Ano do plantio']);
    }
    if (currentManualForm.type === 'poda' && manualMeta.empresa_tipo === 'OUTRA') {
      requiredFields.push(['empresa_outra', 'Nome da empresa']);
    }
    const missing = requiredFields.find(([field]) => !String(manualMeta[field] || '').trim());
    if (missing) {
      showFeedback('Campo obrigatório', `Informe: ${missing[1]}.`);
      return;
    }

    const payload = buildManualPayload(manualMeta, manualLines);
    setIsCreatingManual(true);
    try {
      const created = await createManualResponse({
        formularioId: manualMeta.formularioId,
        dados: payload,
        status: manualMeta.status,
        session: user,
      });
      const createdId = Array.isArray(created) ? created[0]?.id : created?.id;
      await refreshCqoData().catch((syncError) => {
        devWarn('Nao foi possivel atualizar o cache global apos lancamento manual:', syncError);
      });
      closeManualEntryModal({ force: true });
      showFeedback(
        'Ficha manual inserida',
        `${createdId ? `Ficha #${createdId} criada. ` : ''}Ela entrou como fonte APP/manual e GPS não aplicável.`,
        'success'
      );
    } catch (manualError) {
      showFeedback(
        'Não foi possível inserir a ficha manual',
        manualInsertErrorMessage(manualError),
        'danger'
      );
    } finally {
      setIsCreatingManual(false);
    }
  };

  const handleSaveRecordEdit = async (event) => {
    event.preventDefault();
    if (!selectedRecord || !recordEditDraft) return;
    if (!canEditResponses) {
      showFeedback(
        'Acesso restrito',
        'Seu perfil não tem permissão para corrigir fichas do app no dashboard.'
      );
      return;
    }
    if (selectedRecord.source === 'excel') {
      showFeedback(
        'Registro Excel bloqueado',
        'Snapshots de Excel são históricos. Corrija a planilha de origem e reimporte.'
      );
      return;
    }

    const requiredFields = [
      ['data_avaliacao', 'Data'],
      ['nome_fazenda', 'Fazenda'],
      ['parcela', 'Parcela'],
      ['matricula_avaliador', 'Matrícula do avaliador'],
    ];
    const missing = requiredFields.find(([field]) => !String(recordEditDraft[field] || '').trim());
    if (missing) {
      showFeedback('Campo obrigatório', `Informe: ${missing[1]}.`);
      return;
    }

    const patch = buildRecordEditPatch(recordEditDraft);
    setIsSavingRecordEdit(true);
    try {
      await updateResponseMetadata(selectedRecord.id, patch, user);
      setSelectedRecord((prev) => applyRecordPatchForDisplay(prev, patch));
      setRecordEditDraft(null);
      const refreshed = await refreshCqoData().catch((syncError) => {
        devWarn('Nao foi possivel atualizar o cache global apos correcao de ficha:', syncError);
        return null;
      });
      const refreshedRecord = refreshed?.records?.find((record) => record.id === selectedRecord.id);
      if (refreshedRecord) setSelectedRecord(refreshedRecord);
      showFeedback(
        'Ficha corrigida',
        'Os dados principais da ficha foram atualizados e registrados na auditoria.',
        'success'
      );
    } catch (editError) {
      showFeedback(
        'Não foi possível corrigir a ficha',
        recordEditErrorMessage(editError),
        'danger'
      );
    } finally {
      setIsSavingRecordEdit(false);
    }
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

  const currentManualForm = MANUAL_FORM_BY_ID[manualMeta.formularioId] || MANUAL_FORM_OPTIONS[0];
  const currentManualLineFields = MANUAL_LINE_FIELDS[currentManualForm.type] || [];
  const manualOptionSources = useMemo(
    () => buildManualOptionSources(records),
    [records]
  );
  const currentManualParcelOptions = manualMeta.nome_fazenda && manualOptionSources.parcelsByFarm[manualMeta.nome_fazenda]
    ? manualOptionSources.parcelsByFarm[manualMeta.nome_fazenda]
    : manualOptionSources.parcels;
  const isManualCarreamento = currentManualForm.type === 'carreamento';
  const isManualPoda = currentManualForm.type === 'poda';

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

      <div className="operational-filter-bar collections-filter-bar">
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
        <label className="operational-select-control collections-form-filter">
          <span>Formulário</span>
          <select
            value={formTypeFilter}
            onChange={(event) => setFormTypeFilter(event.target.value)}
            className="header-filter-select"
          >
            <option value="all">Todos os formulários</option>
            <option value="corte">CQO Corte</option>
            <option value="carreamento">CQO Carreamento</option>
            <option value="poda">CQO Poda</option>
          </select>
        </label>
        <div className="source-card compact">
          <span>Fonte</span>
          <strong>{sourceLabel}</strong>
        </div>
        <label className="operational-select-control operational-date-control">
          <span>Data inicial</span>
          <input
            type="date"
            value={auditDateFrom}
            max={auditDateTo || undefined}
            onChange={(event) => handleAuditDateFromChange(event.target.value)}
            aria-label="Filtrar coletas a partir da data"
          />
        </label>
        <label className="operational-select-control operational-date-control">
          <span>Data final</span>
          <input
            type="date"
            value={auditDateTo}
            min={auditDateFrom || undefined}
            onChange={(event) => handleAuditDateToChange(event.target.value)}
            aria-label="Filtrar coletas até a data"
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary collections-clear-filter-btn"
          onClick={clearLocalAuditFilters}
          disabled={!hasLocalAuditFilters}
          title="Limpar formulário e período da auditoria"
        >
          <X size={15} />
          Limpar filtros
        </button>
        <button
          type="button"
          className="btn btn-primary manual-entry-open-btn"
          onClick={openManualEntryModal}
          disabled={!canCreateManualResponse}
          title={canCreateManualResponse ? 'Inserir ficha preenchida em papel' : 'Permissão necessária'}
        >
          <PlusCircle size={16} />
          Inserir manual
        </button>
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
                      {record.gpsApplicable === false ? (
                        <span className="muted-cell">{record.gpsUnavailableReason || 'Sem GPS aplicável'}</span>
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
                        onClick={() => openRecordDetails(record)}
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
        <div className="modal-overlay" onClick={closeRecordDetails}>
          <div className="modal-content wide-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <ClipboardList size={18} className="modal-title-icon-success" />
                Ficha #{selectedRecord.id}
              </h3>
              <button className="modal-close" onClick={closeRecordDetails} disabled={isSavingRecordEdit}>&times;</button>
            </div>

            <div className="modal-body">
              {recordEditDraft ? (
                <form className="record-edit-panel" onSubmit={handleSaveRecordEdit}>
                  <div className="record-edit-panel-header">
                    <div>
                      <strong>Corrigir dados principais</strong>
                      <span>Use para ajustar data, ano, fazenda, parcela, ciclo, avaliador e fiscal sem alterar as linhas coletadas.</span>
                    </div>
                    <span className="badge badge-info">Edição auditada</span>
                  </div>

                  <div className="record-edit-grid">
                    <label className="form-group">
                      <span className="form-label">Data</span>
                      <input
                        className="form-input"
                        type="date"
                        value={recordEditDraft.data_avaliacao}
                        onChange={(event) => updateRecordEditDraft('data_avaliacao', event.target.value)}
                        required
                      />
                    </label>
                    <label className="form-group">
                      <span className="form-label">Hora</span>
                      <input
                        className="form-input"
                        type="time"
                        value={recordEditDraft.hora_avaliacao}
                        onChange={(event) => updateRecordEditDraft('hora_avaliacao', event.target.value)}
                      />
                    </label>
                    <ManualDatalistField
                      label="Polo"
                      value={recordEditDraft.nome_polo}
                      onChange={(value) => updateRecordEditDraft('nome_polo', value)}
                      options={MANUAL_POLO_OPTIONS}
                      listId="edit-polo-options"
                      placeholder="Selecione ou digite"
                    />
                    <ManualDatalistField
                      label="Fazenda"
                      value={recordEditDraft.nome_fazenda}
                      onChange={(value) => updateRecordEditDraft('nome_fazenda', value)}
                      options={manualOptionSources.farms}
                      listId="edit-fazenda-options"
                      required
                      placeholder="Selecione ou digite"
                    />
                    <ManualDatalistField
                      label="Parcela"
                      value={recordEditDraft.parcela}
                      onChange={(value) => updateRecordEditDraft('parcela', value)}
                      options={recordEditDraft.nome_fazenda && manualOptionSources.parcelsByFarm[recordEditDraft.nome_fazenda]
                        ? manualOptionSources.parcelsByFarm[recordEditDraft.nome_fazenda]
                        : manualOptionSources.parcels}
                      listId="edit-parcela-options"
                      required
                      placeholder="Selecione ou digite"
                    />
                    <ManualDatalistField
                      label="Ano do plantio"
                      value={recordEditDraft.ano_plantio}
                      onChange={(value) => updateRecordEditDraft('ano_plantio', value)}
                      options={manualOptionSources.plantingYears}
                      listId="edit-ano-plantio-options"
                      inputMode="numeric"
                      placeholder="Ex.: 2013"
                    />
                    <ManualDatalistField
                      label="Ciclo / mês"
                      value={recordEditDraft.ciclo_mes}
                      onChange={(value) => updateRecordEditDraft('ciclo_mes', value)}
                      options={manualOptionSources.cycles}
                      listId="edit-ciclo-options"
                      placeholder="Ex.: 1 ou 06/2026"
                    />
                    <ManualDatalistField
                      label="Matrícula avaliador"
                      value={recordEditDraft.matricula_avaliador}
                      onChange={(value) => updateRecordEditDraft('matricula_avaliador', value)}
                      options={manualOptionSources.evaluators}
                      listId="edit-avaliador-options"
                      required
                      inputMode="numeric"
                      placeholder="Selecione ou digite"
                    />
                    <ManualDatalistField
                      label="Matrícula avaliador 2"
                      value={recordEditDraft.matricula_avaliador_2}
                      onChange={(value) => updateRecordEditDraft('matricula_avaliador_2', value)}
                      options={manualOptionSources.evaluators}
                      listId="edit-avaliador-2-options"
                      inputMode="numeric"
                      placeholder="Opcional"
                    />
                    <ManualDatalistField
                      label="Fiscal responsável"
                      value={recordEditDraft.fiscal_resp}
                      onChange={(value) => updateRecordEditDraft('fiscal_resp', value)}
                      options={manualOptionSources.fiscalResp}
                      listId="edit-fiscal-resp-options"
                      placeholder="Selecione ou digite"
                    />
                    <ManualDatalistField
                      label="Fiscal responsável da equipe"
                      value={recordEditDraft.fiscal_resp_equipe}
                      onChange={(value) => updateRecordEditDraft('fiscal_resp_equipe', value)}
                      options={manualOptionSources.fiscalEquipe}
                      listId="edit-fiscal-equipe-options"
                      placeholder="Selecione ou digite"
                    />
                    <label className="form-group record-edit-observation">
                      <span className="form-label">Observação</span>
                      <textarea
                        className="form-input"
                        value={recordEditDraft.observacao}
                        onChange={(event) => updateRecordEditDraft('observacao', event.target.value)}
                        rows={2}
                        placeholder="Observação da ficha"
                      />
                    </label>
                  </div>

                  <div className="record-edit-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={cancelRecordEdit}
                      disabled={isSavingRecordEdit}
                    >
                      Cancelar edição
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSavingRecordEdit}
                    >
                      <Save size={14} />
                      {isSavingRecordEdit ? 'Salvando...' : 'Salvar correção'}
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="detail-grid collection-detail-grid">
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
                <div className="detail-item">
                  <User size={16} />
                  <div>
                    <span>Fiscal responsável</span>
                    <strong>{selectedRecord.fiscalResponsavel || selectedRecord.raw?.fiscal_resp || 'Não informado'}</strong>
                    <small>Responsável pela fiscalização da coleta</small>
                  </div>
                </div>
                <div className="detail-item">
                  <Users size={16} />
                  <div>
                    <span>Fiscal responsável da equipe</span>
                    <strong>{selectedRecord.fiscalResponsavelEquipe || selectedRecord.raw?.fiscal_resp_equipe || 'Não informado'}</strong>
                    <small>Responsável pela equipe avaliada</small>
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
                    {selectedRecord.gpsApplicable === false
                      ? 'Não se aplica'
                      : selectedRecord.gps?.label || 'Não capturado'}
                  </strong>
                  <small>
                    {selectedRecord.gpsApplicable === false
                      ? selectedRecord.gpsUnavailableReason || 'Registro sem GPS aplicável'
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
                  <EvidencePhotoGrid photos={selectedPhotos} />
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
              <button
                onClick={recordEditDraft ? cancelRecordEdit : openRecordEditor}
                className="btn btn-secondary"
                disabled={isSavingRecordEdit || selectedRecord.source === 'excel' || !canEditResponses}
                title={selectedRecord.source === 'excel'
                  ? 'Registros Excel devem ser corrigidos na planilha de origem'
                  : canEditResponses ? 'Corrigir dados principais da ficha' : 'Permissão necessária'}
              >
                <Pencil size={14} />
                {recordEditDraft ? 'Fechar edição' : 'Editar'}
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
              <button onClick={closeRecordDetails} className="btn btn-primary" disabled={isSavingRecordEdit}>
                Fechar auditoria
              </button>
            </div>
          </div>
        </div>
      )}

      {manualModalOpen ? (
        <div
          className="modal-overlay manual-entry-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Inserir ficha manual"
        >
          <form
            className="modal-content wide-modal manual-entry-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreateManualResponse}
          >
            <div className="modal-header">
              <h3>
                <PlusCircle size={18} className="modal-title-icon-success" />
                Inserir ficha manual
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeManualEntryModal}
                disabled={isCreatingManual}
                aria-label="Fechar lançamento manual"
              >
                <X size={18} />
              </button>
            </div>

            {manualCloseConfirmOpen ? (
              <div
                className="manual-close-confirm"
                role="alertdialog"
                aria-modal="true"
                aria-label="Descartar lançamento manual"
              >
                <div className="manual-close-confirm-card">
                  <div>
                    <strong>Descartar lançamento?</strong>
                    <span>Os dados digitados nesta ficha ainda não foram inseridos.</span>
                  </div>
                  <div className="manual-close-confirm-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setManualCloseConfirmOpen(false)}
                    >
                      Continuar digitando
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => closeManualEntryModal({ force: true })}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="modal-body manual-entry-body">
              <StatusBanner tone="info" className="status-banner-compact">
                O lançamento entra como fonte APP/manual, sem GPS e sem fotos. Use para digitar fichas preenchidas em papel.
              </StatusBanner>

              <div className="manual-entry-grid">
                <label className="form-group">
                  <span className="form-label">Formulário</span>
                  <select
                    className="form-input"
                    value={manualMeta.formularioId}
                    onChange={handleManualFormChange}
                  >
                    {MANUAL_FORM_OPTIONS.map((form) => (
                      <option key={form.id} value={form.id}>{form.label}</option>
                    ))}
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Status inicial</span>
                  <select
                    className="form-input"
                    value={manualMeta.status}
                    onChange={(event) => updateManualMeta('status', event.target.value)}
                  >
                    <option value="aprovado">Aprovado</option>
                    <option value="pendente_validacao">Pendente validação</option>
                  </select>
                </label>
                <ManualDatalistField
                  label="Polo"
                  value={manualMeta.nome_polo}
                  onChange={(value) => updateManualMeta('nome_polo', value)}
                  options={MANUAL_POLO_OPTIONS}
                  listId="manual-polo-options"
                  required
                  placeholder="Selecione ou digite o polo"
                />
                <label className="form-group">
                  <span className="form-label">Data</span>
                  <input
                    className="form-input"
                    type="date"
                    value={manualMeta.data_avaliacao}
                    onChange={(event) => updateManualMeta('data_avaliacao', event.target.value)}
                    required
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Hora</span>
                  <input
                    className="form-input"
                    type="time"
                    value={manualMeta.hora_avaliacao}
                    onChange={(event) => updateManualMeta('hora_avaliacao', event.target.value)}
                  />
                </label>
                <ManualDatalistField
                  label="Fazenda"
                  value={manualMeta.nome_fazenda}
                  onChange={(value) => updateManualMeta('nome_fazenda', value)}
                  options={manualOptionSources.farms}
                  listId="manual-fazenda-options"
                  required
                  placeholder="Selecione ou digite a fazenda"
                />
                <ManualDatalistField
                  label="Parcela"
                  value={manualMeta.parcela}
                  onChange={(value) => updateManualMeta('parcela', value)}
                  options={currentManualParcelOptions}
                  listId="manual-parcela-options"
                  required
                  placeholder="Selecione ou digite a parcela"
                />
                <ManualDatalistField
                  label="Ano do plantio"
                  value={manualMeta.ano_plantio}
                  onChange={(value) => updateManualMeta('ano_plantio', value)}
                  options={manualOptionSources.plantingYears}
                  listId="manual-ano-plantio-options"
                  required={!isManualCarreamento}
                  inputMode="numeric"
                  placeholder="Ex.: 2012"
                />
                <ManualDatalistField
                  label="Ciclo / mês"
                  value={manualMeta.ciclo_mes}
                  onChange={(value) => updateManualMeta('ciclo_mes', value)}
                  options={manualOptionSources.cycles}
                  listId="manual-ciclo-options"
                  inputMode="numeric"
                  placeholder="Ex.: 2 ou 06/2026"
                />
                {isManualCarreamento ? (
                  <>
                    <ManualDatalistField
                      label="Densidade"
                      value={manualMeta.densidade}
                      onChange={(value) => updateManualMeta('densidade', value)}
                      options={['143', '160']}
                      listId="manual-densidade-options"
                      inputMode="decimal"
                      placeholder="Ex.: 160"
                    />
                    <ManualDatalistField
                      label="Total plantas parcela"
                      value={manualMeta.total_plantas_parcela}
                      onChange={(value) => updateManualMeta('total_plantas_parcela', value)}
                      options={[]}
                      listId="manual-total-plantas-options"
                      inputMode="decimal"
                      placeholder="Ex.: 5067"
                    />
                    <ManualDatalistField
                      label="Total cachos carreados"
                      value={manualMeta.total_cachos_carreados}
                      onChange={(value) => updateManualMeta('total_cachos_carreados', value)}
                      options={[]}
                      listId="manual-total-cachos-options"
                      inputMode="decimal"
                      placeholder="Ex.: 120"
                    />
                    <ManualDatalistField
                      label="Variedade"
                      value={manualMeta.variedade}
                      onChange={(value) => updateManualMeta('variedade', value)}
                      options={['Híbrido', 'Guineensis']}
                      listId="manual-variedade-options"
                      placeholder="Digite a variedade"
                    />
                  </>
                ) : null}
                {isManualPoda ? (
                  <>
                    <label className="form-group">
                      <span className="form-label">Empresa</span>
                      <select
                        className="form-input"
                        value={manualMeta.empresa_tipo}
                        onChange={(event) => updateManualMeta('empresa_tipo', event.target.value)}
                        required
                      >
                        <option value="VILA NOVA">VILA NOVA</option>
                        <option value="OUTRA">OUTRA</option>
                      </select>
                    </label>
                    {manualMeta.empresa_tipo === 'OUTRA' ? (
                      <ManualDatalistField
                        label="Nome da empresa"
                        value={manualMeta.empresa_outra}
                        onChange={(value) => updateManualMeta('empresa_outra', value)}
                        options={[]}
                        listId="manual-empresa-outra-options"
                        required
                        placeholder="Digite a empresa"
                      />
                    ) : null}
                  </>
                ) : null}
                <ManualDatalistField
                  label="Matrícula avaliador"
                  value={manualMeta.matricula_avaliador}
                  onChange={(value) => updateManualMeta('matricula_avaliador', value)}
                  options={manualOptionSources.evaluators}
                  listId="manual-avaliador-options"
                  required
                  inputMode="numeric"
                  placeholder="Selecione ou digite"
                />
                <ManualDatalistField
                  label="Matrícula avaliador 2"
                  value={manualMeta.matricula_avaliador_2}
                  onChange={(value) => updateManualMeta('matricula_avaliador_2', value)}
                  options={manualOptionSources.evaluators}
                  listId="manual-avaliador-2-options"
                  inputMode="numeric"
                  placeholder="Opcional"
                />
                <ManualDatalistField
                  label="Fiscal responsável"
                  value={manualMeta.fiscal_resp}
                  onChange={(value) => updateManualMeta('fiscal_resp', value)}
                  options={manualOptionSources.fiscalResp}
                  listId="manual-fiscal-resp-options"
                  required
                  placeholder="Selecione ou digite"
                />
                <ManualDatalistField
                  label="Fiscal responsável da equipe"
                  value={manualMeta.fiscal_resp_equipe}
                  onChange={(value) => updateManualMeta('fiscal_resp_equipe', value)}
                  options={manualOptionSources.fiscalEquipe}
                  listId="manual-fiscal-equipe-options"
                  required
                  placeholder="Selecione ou digite"
                />
                <label className="form-group manual-entry-observation">
                  <span className="form-label">Observação</span>
                  <textarea
                    className="form-input"
                    value={manualMeta.observacao}
                    onChange={(event) => updateManualMeta('observacao', event.target.value)}
                    rows={2}
                    placeholder="Observação registrada no papel"
                  />
                </label>
              </div>

              <div className="manual-entry-lines-header">
                <div>
                  <strong>Linhas avaliadas</strong>
                  <span>{manualLines.length} linha(s) adicionada(s) · {currentManualForm.label} · digite os valores exatamente como vieram no papel.</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={addManualLine}>
                  <PlusCircle size={14} />
                  Adicionar linha
                </button>
              </div>

              <div className="manual-entry-lines table-wrapper" ref={manualLinesContainerRef}>
                <table className="custom-table dense-table manual-entry-table">
                  <thead>
                    <tr>
                      {currentManualLineFields.map(([key, label]) => (
                        <th key={key}>{label}</th>
                      ))}
                      <th className="table-action-cell">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualLines.map((line, index) => (
                      <tr key={`manual-line-${index}`}>
                        {currentManualLineFields.map(([key, label, type]) => (
                          <td key={key}>
                            <input
                              className="manual-line-input"
                              aria-label={`${label} linha ${index + 1}`}
                              type={type === 'number' ? 'number' : 'text'}
                              inputMode={type === 'number' ? 'decimal' : 'text'}
                              min={type === 'number' ? '0' : undefined}
                              step={type === 'number' ? 'any' : undefined}
                              value={line[key] ?? ''}
                              onChange={(event) => updateManualLine(index, key, event.target.value)}
                              ref={key === 'linha' ? (node) => {
                                manualFirstInputRefs.current[index] = node;
                              } : undefined}
                            />
                          </td>
                        ))}
                        <td className="table-action-cell">
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon btn-icon-sm"
                            onClick={() => removeManualLine(index)}
                            disabled={manualLines.length <= 1}
                            title="Remover linha"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeManualEntryModal}
                disabled={isCreatingManual}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCreatingManual}
              >
                <PlusCircle size={14} />
                {isCreatingManual ? 'Inserindo...' : 'Inserir ficha'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
