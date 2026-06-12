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
    if (index === 0) return '<td class="total">Total</td>';
    const total = rows.reduce((sum, row) => sum + numberValue(row[column]), 0);
    return `<td>${formatTotal(total)}</td>`;
  }).join('');
}

function htmlFor(record) {
  const isCarreamento = record.type === 'carreamento';
  const columns = isCarreamento ? carreamentoColumns : corteColumns;
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
        <style>
          @page{size:A4 ${isCarreamento ? 'portrait' : 'landscape'};margin:8mm}
          body{font-family:Arial,sans-serif;font-size:10px;color:#000}
          .page{border:2px solid #000;padding:5px}
          .title{text-align:center;font-size:14px;font-weight:bold;padding:6px}
          .info-table{width:100%;border-collapse:collapse;margin:10px 0;table-layout:auto;}
          .info-table td{border:none;text-align:left;padding:4px;font-size:10px;}
          .info-label{font-weight:bold;color:#444;}
          .info-value{font-weight:bold;color:#000;}
          table{width:100%;border-collapse:collapse;table-layout:auto}
          th,td{border:1px solid #000;text-align:center;padding:5px 3px;word-break:break-word}
          th{font-weight:bold;background:#efefef;font-size:9px}
          .total{text-align:left;font-weight:bold}
          .footer td{text-align:left;height:34px;vertical-align:top;padding:8px}
        </style>
      </head>
      <body>
        <div class="page">
          <div class="title">${title}</div>
          <table class="info-table">
            <tr>
              <td colspan="${colSpanVal}"><span class="info-label">Fazenda:</span> <span class="info-value">${escapeHtml(record.farm)}</span></td>
              <td colspan="${colSpanVal}"><span class="info-label">Parcela:</span> <span class="info-value">${escapeHtml(record.parcel)}</span></td>
              <td colspan="${colSpanVal + colSpanRemainder}"><span class="info-label">Data:</span> <span class="info-value">${escapeHtml(record.date)}</span></td>
            </tr>
            <tr>
              <td colspan="${colSpanVal}"><span class="info-label">Ciclo:</span> <span class="info-value">${escapeHtml(record.cycle)}</span></td>
              <td colspan="${colSpanVal}"><span class="info-label">Avaliador:</span> <span class="info-value">${escapeHtml(record.evaluator)} ${record.evaluatorMatricula ? `(${escapeHtml(record.evaluatorMatricula)})` : ''}</span></td>
              <td colspan="${colSpanVal + colSpanRemainder}"><span class="info-label">Fiscal:</span> <span class="info-value">${escapeHtml(record.fiscal)}</span></td>
            </tr>
          </table>
          <table>
            <thead><tr>${columns.map((column) => `<th>${escapeHtml(columnLabels[column] || column.replaceAll('_', ' '))}</th>`).join('')}</tr></thead>
            <tbody>${tableRows(record.lines, columns, isCarreamento ? 11 : 10)}</tbody>
            <tfoot>
              <tr>${totals(record.lines, columns)}</tr>
              <tr class="footer"><td colspan="${columns.length}"><span class="info-label">Observação:</span> <span class="info-value">${escapeHtml(record.observation)}</span></td></tr>
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
