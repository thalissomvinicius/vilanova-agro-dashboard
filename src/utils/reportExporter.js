const corteColumns = [
  'linha',
  'numero_plantas_linha',
  'numero_plantas_observadas',
  'numero_cachos_observados_papel',
  'cacho_esquecido_ciclo',
  'cacho_verde',
  'cacho_maduro',
  'cacho_passado',
  'folha_mamando',
  'cacho_talo_comprido',
  'folha_cortada_indevida',
  'cacho_mal_posicionado',
  'palha_mal_empilhada',
  'cacho_estrela',
  'cacho_brocado',
  'cacho_avermelhado',
];

const carreamentoColumns = [
  'linha',
  'numero_plantas_linha',
  'cacho_mal_posicionado',
  'cacho_nao_carreado',
  'numero_plantas_observadas',
  'peso_medio',
];

const columnLabels = {
  linha: 'Linha',
  numero_plantas_linha: 'Plantas',
  numero_plantas_observadas: 'Plantas Obs',
  numero_cachos_observados_papel: 'Cachos Obs',
  cacho_esquecido_ciclo: 'Esquecido',
  cacho_verde: 'Verde',
  cacho_maduro: 'Maduro',
  cacho_passado: 'Passado',
  folha_mamando: 'F. Mamando',
  cacho_talo_comprido: 'Talo Comp.',
  folha_cortada_indevida: 'F. Cortada',
  cacho_mal_posicionado: 'Mal Pos.',
  cacho_estrela: 'Estrela',
  cacho_brocado: 'Brocado',
  cacho_avermelhado: 'Avermelhado',
  cacho_nao_carreado: 'Não Carr.',
  peso_medio: 'Peso (kg)',
};

const corteColumnLabels = {
  palha_mal_empilhada: 'Palha M.E.',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function numberValue(value) {
  const parsed = Number(String(value || '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function textValue(value) {
  return hasValue(value) ? value : '-';
}

function fiscalValue(record, field, fallback = '') {
  return textValue(record?.[field] || record?.raw?.[
    field === 'fiscalResponsavelEquipe' ? 'fiscal_resp_equipe' : 'fiscal_resp'
  ] || fallback);
}

function tableCellValue(row, column) {
  const value = row?.[column];
  if (hasValue(value)) return value;
  return column === 'linha' ? '-' : '0';
}

function formatTotal(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(numberValue(value));
}

function tableRows(lines, columns) {
  return [...(lines || [])].map((row) => `
    <tr>${columns.map((column) => `<td>${escapeHtml(tableCellValue(row, column))}</td>`).join('')}</tr>
  `).join('');
}

function totals(lines, columns) {
  const rows = lines || [];
  return columns.map((column, index) => {
    if (index === 0) return '<td class="total">Total Geral</td>';
    const total = rows.reduce((sum, row) => sum + numberValue(row[column]), 0);
    return `<td class="total-val">${formatTotal(total)}</td>`;
  }).join('');
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
}

function safeImageSource(photo) {
  const source = photo?.url
    || photo?.thumbnailUrl
    || (photo?.base64 ? `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}` : '');
  return /^(?:https?:|data:image\/)/i.test(String(source || '')) ? source : '';
}

function presenceProofHtml(record) {
  const audit = record?.presenceAudit;
  if (!audit) return '';
  const photos = (audit.photos || []).map((photo) => {
    const source = safeImageSource(photo);
    return `
      <div class="presence-photo">
        ${source ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(photo.label || 'Prova de presença')}" />` : '<div class="presence-photo-empty">Imagem indisponível</div>'}
        <strong>${escapeHtml(photo.label || 'Evidência')}</strong>
        <span>${escapeHtml(formatDateTime(photo.capturedAt))}</span>
        <span>${photo.sizeBytes ? `${formatTotal(numberValue(photo.sizeBytes) / 1024)} KB` : '-'}</span>
      </div>
    `;
  }).join('');
  const gpsLabel = audit.gps?.label
    || (Number.isFinite(Number(audit.gps?.lat)) && Number.isFinite(Number(audit.gps?.lng))
      ? `${Number(audit.gps.lat).toFixed(6)}, ${Number(audit.gps.lng).toFixed(6)}`
      : '-');

  return `
    <section class="presence-report">
      <h2>Prova de presença da coleta</h2>
      <p class="presence-note">Registro guiado para revisão visual; não constitui biometria facial certificada.</p>
      <div class="presence-info">
        <div><span>Desafio</span><strong>${escapeHtml(audit.challenge?.label || 'Movimento orientado')}</strong></div>
        <div><span>Autenticação local</span><strong>${escapeHtml(audit.biometricLabel || 'Não informada')}</strong></div>
        <div><span>Concluída em</span><strong>${escapeHtml(formatDateTime(audit.completedAt))}</strong></div>
        <div><span>GPS final</span><strong>${escapeHtml(gpsLabel)}</strong></div>
        <div><span>IP da sincronização</span><strong>${escapeHtml(audit.syncIp || '-')}</strong></div>
        <div><span>Recebido pelo servidor</span><strong>${escapeHtml(formatDateTime(audit.serverTimestamp || audit.appSyncedAt))}</strong></div>
      </div>
      <div class="presence-photos">${photos || '<div class="presence-photo-empty">Fotos não localizadas</div>'}</div>
      ${(audit.hashes || []).length ? `<div class="presence-hashes">${audit.hashes.map((hash) => `<div><span>${escapeHtml(hash.label)}</span><code>${escapeHtml(hash.value)}</code></div>`).join('')}</div>` : ''}
    </section>
  `;
}

function htmlFor(record, { includePresenceProof = true } = {}) {
  const isCarreamento = record.type === 'carreamento';
  const columns = isCarreamento ? carreamentoColumns : corteColumns;
  const labels = isCarreamento ? columnLabels : { ...columnLabels, ...corteColumnLabels };
  const title = isCarreamento
    ? 'Controle de Qualidade Agrícola: Perdas / Frutos Soltos e Carreamento'
    : 'Controle de Qualidade Agrícola: Corte';

  // Calcular colspan para alinhar perfeitamente no Excel
  const colSpanVal = Math.floor(columns.length / 3);
  const colSpanRemainder = columns.length % 3;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ficha ${record.id}</title>
        <style>
          @page { size: A4 ${isCarreamento ? 'portrait' : 'landscape'}; margin: 5mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 6.5px; line-height: 1.1; color: #1f2937; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { border: none; padding: 0; background: #ffffff; }
          .title { text-align: left; font-size: 10.5px; line-height: 1.15; font-weight: 800; padding: 5px 7px; border: none; background: var(--green-institutional, #234F2A); color: #ffffff; text-transform: uppercase; letter-spacing: 0; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; }
          thead { display: table-row-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          th, td { border: 1px solid #e5e7eb; text-align: center; padding: 2px 1.5px; line-height: 1.1; word-break: normal; overflow-wrap: anywhere; }
          th { font-weight: 700; background: #f3f4f6; color: #374151; font-size: 5.8px; text-transform: uppercase; border-bottom: 1px solid #d1d5db; }
          .header-info td { border: 1px solid #e5e7eb; text-align: left; padding: 3px 5px; background: #f9fafb; vertical-align: top; }
          .info-label { font-weight: 700; color: #6b7280; font-size: 5.4px; line-height: 1; text-transform: uppercase; display: block; margin-bottom: 1px; letter-spacing: 0; }
          .info-value { font-weight: 700; color: #111827; font-size: 7.2px; line-height: 1.1; }
          .spacer-row td { border: none; height: 3px; padding: 0; background: #ffffff; }
          .report-summary { break-inside: avoid; page-break-inside: avoid; }
          .total { text-align: right; font-weight: 800; background: #f3f4f6; color: #111827; padding-right: 3px; text-transform: uppercase; font-size: 6px; }
          .total-val { font-weight: 800; background: #f3f4f6; color: #111827; }
          .footer td { text-align: left; padding: 3px 5px; background: #f9fafb; border: 1px solid #e5e7eb; color: #374151; font-size: 6.5px; }
          .presence-report { page-break-before: always; padding: 5mm; }
          .presence-report h2 { margin: 0 0 2mm; padding: 3mm; background: #234f2a; color: #fff; font-size: 15px; }
          .presence-note { margin: 0 0 3mm; color: #5f6b7c; font-size: 8px; }
          .presence-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; margin-bottom: 3mm; }
          .presence-info div, .presence-hashes div { padding: 2mm; border: 1px solid #d8e0e8; background: #f8faf9; }
          .presence-info span, .presence-hashes span { display: block; margin-bottom: 1mm; color: #6b7280; font-size: 6px; font-weight: 700; text-transform: uppercase; }
          .presence-info strong { display: block; font-size: 8px; overflow-wrap: anywhere; }
          .presence-photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; }
          .presence-photo { padding: 2mm; border: 1px solid #d8e0e8; break-inside: avoid; }
          .presence-photo img { display: block; width: 100%; height: 88mm; object-fit: contain; background: #f3f4f6; }
          .presence-photo strong, .presence-photo span { display: block; margin-top: 1mm; font-size: 7px; }
          .presence-photo-empty { display: grid; min-height: 35mm; place-items: center; color: #6b7280; background: #f3f4f6; }
          .presence-hashes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2mm; margin-top: 3mm; }
          .presence-hashes code { display: block; overflow-wrap: anywhere; font-size: 6px; }
        </style>
      </head>
      <body>
        <div class="page">
          <table>
            <thead>
              <tr>
                <th colspan="${columns.length}" class="title">${title}</th>
              </tr>
              <tr class="header-info">
                <td colspan="${colSpanVal}">
                  <span class="info-label">Fazenda</span>
                  <span class="info-value">${escapeHtml(textValue(record.farm))}</span>
                </td>
                <td colspan="${colSpanVal}">
                  <span class="info-label">Parcela / Ano</span>
                  <span class="info-value">${escapeHtml(textValue(record.parcel))}${record.plantingYear ? ` / ${escapeHtml(textValue(record.plantingYear))}` : ''}</span>
                </td>
                <td colspan="${colSpanVal + colSpanRemainder}">
                  <span class="info-label">Data e Hora</span>
                  <span class="info-value">${escapeHtml(textValue(record.date))} ${escapeHtml(textValue(record.time))}</span>
                </td>
              </tr>
              <tr class="header-info">
                <td colspan="${colSpanVal}">
                  <span class="info-label">Ciclo</span>
                  <span class="info-value">${escapeHtml(textValue(record.cycle))}</span>
                </td>
                <td colspan="${colSpanVal}">
                  <span class="info-label">Avaliador</span>
                  <span class="info-value">${escapeHtml(textValue(record.evaluator))} ${record.evaluatorMatricula ? `(Mat. ${escapeHtml(record.evaluatorMatricula)})` : ''}</span>
                </td>
                <td colspan="${colSpanVal + colSpanRemainder}">
                  <span class="info-label">Ficha (ID)</span>
                  <span class="info-value">${escapeHtml(textValue(record.id))}</span>
                </td>
              </tr>
              <tr class="header-info">
                <td colspan="${Math.floor(columns.length / 2)}">
                  <span class="info-label">Fiscal responsável</span>
                  <span class="info-value">${escapeHtml(fiscalValue(record, 'fiscalResponsavel'))}</span>
                </td>
                <td colspan="${columns.length - Math.floor(columns.length / 2)}">
                  <span class="info-label">Fiscal responsável da equipe</span>
                  <span class="info-value">${escapeHtml(fiscalValue(record, 'fiscalResponsavelEquipe', record.fiscal))}</span>
                </td>
              </tr>
              <tr class="spacer-row"><td colspan="${columns.length}"></td></tr>
              <tr>${columns.map((column) => `<th>${escapeHtml(labels[column] || column.replaceAll('_', ' '))}</th>`).join('')}</tr>
            </thead>
            <tbody>${tableRows(record.lines, columns)}</tbody>
            <tbody class="report-summary">
              <tr>${totals(record.lines, columns)}</tr>
              <tr class="spacer-row"><td colspan="${columns.length}"></td></tr>
              <tr class="footer">
                <td colspan="${columns.length}">
                  <span class="info-label">Observação / Justificativa</span>
                  <span class="info-value" style="font-weight: normal; font-size: 6.5px;">${escapeHtml(record.observation) || 'Nenhuma observação registrada.'}</span>
                </td>
              </tr>
              <tr class="footer">
                <td colspan="${columns.length}">
                  <span class="info-label">Sistema</span>
                  <span class="info-value" style="font-weight: 700; font-size: 6.5px;">Dashboard CQO Vila Nova</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        ${includePresenceProof ? presenceProofHtml(record) : ''}
      </body>
    </html>
  `;
}

export function buildDashboardRecordReportHtml(record, options = {}) {
  return htmlFor(record, options);
}

function downloadWebFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function hydratePresencePhotoUrls(record) {
  if (!record?.presenceAudit?.photos?.length) return record;
  const photos = await Promise.all(record.presenceAudit.photos.map(async (photo) => {
    if (safeImageSource(photo) || !photo.storagePath) return photo;
    try {
      return { ...photo, url: await getAttachmentStorageSignedUrl(photo.storagePath) || '' };
    } catch {
      return photo;
    }
  }));
  return { ...record, presenceAudit: { ...record.presenceAudit, photos } };
}

export async function exportDashboardRecord(record, format) {
  const reportRecord = format === 'pdf' ? await hydratePresencePhotoUrls(record) : record;
  const html = buildDashboardRecordReportHtml(reportRecord, { includePresenceProof: format === 'pdf' });
  const name = `${record.type}-${record.id}`;

  if (format === 'excel') {
    downloadWebFile('\ufeff' + html, `${name}.xls`, 'application/vnd.ms-excel;charset=utf-8');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    downloadWebFile(html, `${name}.html`, 'text/html;charset=utf-8');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
}
import { getAttachmentStorageSignedUrl } from './cqoData';
