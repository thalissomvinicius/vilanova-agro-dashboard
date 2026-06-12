const XLSX = require('xlsx');
const fs = require('fs');

try {
  const filePath = 'C:\\Users\\thali\\Downloads\\1_Digitação_CQO.xlsx';
  const workbook = XLSX.readFile(filePath);
  
  let output = '--- EXCEL FILE LOADED ---\n';
  output += 'Sheets found: ' + workbook.SheetNames.join(', ') + '\n';
  
  workbook.SheetNames.forEach(sheetName => {
    output += `\n\n--- SHEET: ${sheetName} ---\n`;
    const sheet = workbook.Sheets[sheetName];
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    // Print first 15 rows
    for(let i = 0; i < Math.min(data.length, 15); i++) {
      output += `Row ${i}: ${JSON.stringify(data[i])}\n`;
    }
  });
  
  fs.writeFileSync('excel_dump_utf8.txt', output, 'utf8');
  console.log('Done!');
} catch (err) {
  console.error('Error reading excel:', err.message);
}
