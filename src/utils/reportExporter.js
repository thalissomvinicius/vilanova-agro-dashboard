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

function formatDate(value) {
  if (!value) return '____/____/______';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatTotal(value) {
  if (!value) return '';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function rowsFrom(values, key) {
  return Array.isArray(values?.[key]) ? values[key] : [];
}

function tableRows(values, key, columns, targetRows) {
  const rows = rowsFrom(values, key).slice(0, targetRows);
  while (rows.length < targetRows) rows.push({});
  return rows.map((row) => `
    <tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>
  `).join('');
}

function totals(values, key, columns) {
  const rows = rowsFrom(values, key);
  return columns.map((column, index) => {
    if (index === 0) return '<td class="total">Total</td>';
    const total = rows.reduce((sum, row) => sum + numberValue(row[column]), 0);
    return `<td>${formatTotal(total)}</td>`;
  }).join('');
}

function htmlFor(record) {
  const values = record.raw || {};
  const isCarreamento = record.type === 'carreamento';
  const columns = isCarreamento ? carreamentoColumns : corteColumns;
  const key = isCarreamento ? 'linhas_carreamento' : 'linhas_corte';
  const title = isCarreamento
    ? 'Controle de Qualidade Agrícola: Perdas / Frutos Soltos e Carreamento'
    : 'Controle de Qualidade Agrícola: Corte';

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
          .info-table td{border:none;text-align:left;padding:4px;font-weight:bold;font-size:10px;}
          .line{border-bottom:1px solid #000;min-width:110px;display:inline-block;padding-bottom:2px}
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
              <td>Fazenda: <span class="line">${escapeHtml(values.nome_fazenda)}</span></td>
              <td>Parcela: <span class="line">${escapeHtml(values.parcela)}</span></td>
              <td>Data: <span class="line">${escapeHtml(formatDate(values.data_avaliacao))}</span></td>
            </tr>
            <tr>
              <td>Ciclo: <span class="line">${escapeHtml(values.ciclo_mes)}</span></td>
              <td>Avaliador: <span class="line">${escapeHtml(values.matricula_avaliador)}</span></td>
              <td>Fiscal: <span class="line">${escapeHtml(values.fiscal_resp)}</span></td>
            </tr>
          </table>
          <table>
            <thead><tr>${columns.map((column) => `<th>${escapeHtml(columnLabels[column] || column.replaceAll('_', ' '))}</th>`).join('')}</tr></thead>
            <tbody>${tableRows(values, key, columns, isCarreamento ? 11 : 10)}</tbody>
            <tfoot>
              <tr>${totals(values, key, columns)}</tr>
              <tr class="footer"><td colspan="${columns.length}">Observação: ${escapeHtml(values.observacao)}</td></tr>
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
