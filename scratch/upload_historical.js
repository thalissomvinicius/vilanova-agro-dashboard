const XLSX = require('xlsx');

const SUPABASE_URL = 'https://wcifxyvesmhqurqhnway.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjaWZ4eXZlc21ocXVycWhud2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDY2MjgsImV4cCI6MjA4NTc4MjYyOH0.1hnE3IuZQ5wrXtXA22GxS-pUAiSnIlZBOiuGUgS1ABw';

function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return new Date();
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function normalizeNumber(val) {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

async function uploadToSupabase(records) {
  const BATCH_SIZE = 50;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/mobile_respostas`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(batch)
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`Error uploading batch ${i}: ${response.status} - ${text}`);
      } else {
        console.log(`Uploaded batch ${i} to ${i + batch.length}`);
      }
    } catch (err) {
      console.error('Fetch error:', err.message);
    }
  }
}

async function main() {
  const filePath = 'C:\\Users\\thali\\Downloads\\1_Digitação_CQO.xlsx';
  const workbook = XLSX.readFile(filePath);
  const recordsToUpload = [];
  const nowStr = new Date().toISOString();

  // 1. Process CORTE
  const sheetCorte = workbook.Sheets['corte'];
  if (sheetCorte) {
    const dataCorte = XLSX.utils.sheet_to_json(sheetCorte, { header: 1 });
    // start from row 1 to skip headers
    for (let i = 1; i < dataCorte.length; i++) {
      const row = dataCorte[i];
      if (!row || !row[1] || !row[2]) continue; // Skip empty/invalid rows

      const dataAvaliacao = formatDate(excelDateToJSDate(row[3]));
      const matricula = String(row[8] || '000');
      
      const payload = {
        nome_fazenda: row[1],
        parcela: row[2],
        ciclo_mes: String(row[4] || ''),
        fiscal_resp: String(row[9] || ''),
        matricula_avaliador: matricula,
        data_avaliacao: dataAvaliacao,
        observacao: "HISTORICO PLANILHA: " + String(row[28] || ''),
        acompanhamento: { teve: "nao" },
        linhas_corte: [
          {
            numero_plantas_linha: normalizeNumber(row[11]),
            numero_plantas_observadas: normalizeNumber(row[13]),
            numero_cachos_observados_papel: normalizeNumber(row[14]),
            cacho_esquecido_ciclo: normalizeNumber(row[15]),
            cacho_verde: normalizeNumber(row[16]),
            cacho_maduro: normalizeNumber(row[17]),
            cacho_passado: normalizeNumber(row[18]),
            folha_mamando: normalizeNumber(row[19]),
            cacho_talo_comprido: normalizeNumber(row[20]),
            folha_cortada_indevida: normalizeNumber(row[21]),
            cacho_mal_posicionado: normalizeNumber(row[22]),
            cacho_estrela: normalizeNumber(row[23]),
            cacho_brocado: normalizeNumber(row[24]),
            cacho_avermelhado: normalizeNumber(row[25]),
          }
        ]
      };

      recordsToUpload.push({
        id: `hist-corte-${Date.now()}-${i}`,
        formulario_id: "form_cqo_corte",
        usuario_id: matricula,
        status: "Aprovado",
        dados_json: payload,
        criado_em: `${dataAvaliacao}T12:00:00.000Z`,
        enviado_em: nowStr
      });
    }
  }

  // 2. Process CARREAMENTO
  const sheetCarr = workbook.Sheets['carreamento'];
  if (sheetCarr) {
    const dataCarr = XLSX.utils.sheet_to_json(sheetCarr, { header: 1 });
    for (let i = 1; i < dataCarr.length; i++) {
      const row = dataCarr[i];
      if (!row || !row[1] || !row[2]) continue;

      const dataAvaliacao = formatDate(excelDateToJSDate(row[3]));
      const matricula = String(row[9] || '000');

      const payload = {
        nome_fazenda: row[1],
        parcela: row[2],
        ciclo_mes: String(row[4] || ''),
        fiscal_resp: String(row[10] || ''),
        matricula_avaliador: matricula,
        data_avaliacao: dataAvaliacao,
        observacao: "HISTORICO PLANILHA",
        acompanhamento: { teve: "nao" },
        linhas_carreamento: [
          {
            numero_plantas_linha: normalizeNumber(row[12]),
            numero_plantas_observadas: normalizeNumber(row[14]),
            cacho_mal_posicionado: normalizeNumber(row[16]),
            cacho_nao_carreado: normalizeNumber(row[17]),
            peso_medio: 0 // Historical default
          }
        ]
      };

      recordsToUpload.push({
        id: `hist-carr-${Date.now()}-${i}`,
        formulario_id: "form_cqo_carreamento_fruto_solto",
        usuario_id: matricula,
        status: "Aprovado",
        dados_json: payload,
        criado_em: `${dataAvaliacao}T12:00:00.000Z`,
        enviado_em: nowStr
      });
    }
  }

  console.log(`Total records to upload: ${recordsToUpload.length}`);
  if (recordsToUpload.length > 0) {
    await uploadToSupabase(recordsToUpload);
  }
}

main();
