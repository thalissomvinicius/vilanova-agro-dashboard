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
  cacho_mal_posicionado: 'Palha M.E.',
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

function formatTotal(value) {
  if (!value) return '';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function tableRows(lines, columns, targetRows) {
  const rows = [...(lines || [])].slice(0, targetRows);
  while (rows.length < targetRows) rows.push({});
  return rows.map((row) => `
    <tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>
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

function htmlFor(record) {
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
          @page { size: A4 ${isCarreamento ? 'portrait' : 'landscape'}; margin: 12mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1f2937; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { border: none; padding: 0; background: #ffffff; }
          .title { text-align: left; font-size: 16px; font-weight: 800; padding: 14px 16px; border: none; background: var(--green-institutional, #234F2A); color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; table-layout: auto; margin: 0 0 16px 0; }
          th, td { border: 1px solid #e5e7eb; text-align: center; padding: 8px 6px; word-break: break-word; }
          th { font-weight: 700; background: #f3f4f6; color: #374151; font-size: 9px; text-transform: uppercase; border-bottom: 2px solid #d1d5db; }
          .header-info td { border: 1px solid #e5e7eb; text-align: left; padding: 10px 14px; background: #f9fafb; vertical-align: top; }
          .info-label { font-weight: 700; color: #6b7280; font-size: 8px; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px; }
          .info-value { font-weight: 700; color: #111827; font-size: 12px; }
          .spacer-row td { border: none; height: 16px; background: #ffffff; }
          .total { text-align: right; font-weight: 800; background: #f3f4f6; color: #111827; padding-right: 12px; text-transform: uppercase; font-size: 9px; }
          .total-val { font-weight: 800; background: #f3f4f6; color: #111827; }
          .footer td { text-align: left; padding: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: 2px solid #d1d5db; color: #374151; font-size: 11px; }
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
                  <span class="info-value">${escapeHtml(record.farm)}</span>
                </td>
                <td colspan="${colSpanVal}">
                  <span class="info-label">Parcela</span>
                  <span class="info-value">${escapeHtml(record.parcel)}</span>
                </td>
                <td colspan="${colSpanVal + colSpanRemainder}">
                  <span class="info-label">Data e Hora</span>
                  <span class="info-value">${escapeHtml(record.date)} ${escapeHtml(record.time || '')}</span>
                </td>
              </tr>
              <tr class="header-info">
                <td colspan="${colSpanVal}">
                  <span class="info-label">Ciclo</span>
                  <span class="info-value">${escapeHtml(record.cycle)}</span>
                </td>
                <td colspan="${colSpanVal}">
                  <span class="info-label">Avaliador</span>
                  <span class="info-value">${escapeHtml(record.evaluator)} ${record.evaluatorMatricula ? `(Mat. ${escapeHtml(record.evaluatorMatricula)})` : ''}</span>
                </td>
                <td colspan="${colSpanVal + colSpanRemainder}">
                  <span class="info-label">Ficha (ID)</span>
                  <span class="info-value">${escapeHtml(record.id)}</span>
                </td>
              </tr>
              <tr class="spacer-row"><td colspan="${columns.length}"></td></tr>
              <tr>${columns.map((column) => `<th>${escapeHtml(labels[column] || column.replaceAll('_', ' '))}</th>`).join('')}</tr>
            </thead>
            <tbody>${tableRows(record.lines, columns, isCarreamento ? 11 : 10)}</tbody>
            <tfoot>
              <tr>${totals(record.lines, columns)}</tr>
              <tr class="spacer-row"><td colspan="${columns.length}"></td></tr>
              <tr class="footer">
                <td colspan="${columns.length}">
                  <span class="info-label">Observação / Justificativa</span>
                  <span class="info-value" style="font-weight: normal; font-size: 11px;">${escapeHtml(record.observation) || 'Nenhuma observação registrada.'}</span>
                </td>
              </tr>
              <tr class="footer">
                <td colspan="${columns.length}">
                  <span class="info-label">Sistema</span>
                  <span class="info-value" style="font-weight: 700; font-size: 11px;">Dashboard CQO Vila Nova</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </body>
    </html>
  `;
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

export function exportDashboardRecord(record, format) {
  const html = htmlFor(record);
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
