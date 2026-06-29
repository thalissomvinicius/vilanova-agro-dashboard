export const PODA_PRESENTATION_DEMO_ENABLED = true;

export const PODA_DEMO_SPECS = [
  // === SEMANA 1 (dia 1-7) ===
  { farm: 'FÉ EM DEUS', parcel: 'F-15', evaluator: 'RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR', matricula: '384', dayOffset: 1, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 6, exposto: 14, meiaCoroa: 8, folhaMamando: 5, maiorUmParaUm: 6, bicoGaita: 3, podre: 2, palha: 10, status: 'Reprovado' },
  { farm: 'VILA NOVA', parcel: 'D-09', evaluator: 'DANIEL SOUZA', matricula: '1938', dayOffset: 2, linhas: 16, plantas: 336, projetadas: 1120, semPodar: 2, exposto: 5, meiaCoroa: 4, folhaMamando: 2, maiorUmParaUm: 3, bicoGaita: 1, podre: 0, palha: 3, status: 'Aprovado' },
  { farm: 'SANTA MARIA', parcel: 'B-11', evaluator: 'LUAN SOUZA FERREIRA', matricula: '2170', dayOffset: 3, linhas: 14, plantas: 288, projetadas: 870, semPodar: 1, exposto: 4, meiaCoroa: 2, folhaMamando: 1, maiorUmParaUm: 2, bicoGaita: 0, podre: 1, palha: 2, status: 'Aprovado' },
  { farm: 'FÉ EM DEUS', parcel: 'H-20', evaluator: 'ROBERTO QUEIROZ COUTINHO', matricula: '3102', dayOffset: 5, linhas: 16, plantas: 304, projetadas: 980, semPodar: 0, exposto: 6, meiaCoroa: 5, folhaMamando: 3, maiorUmParaUm: 8, bicoGaita: 2, podre: 0, palha: 2, status: 'Aprovado' },
  // === SEMANA 2 (dia 8-14) ===
  { farm: 'VILA NOVA', parcel: 'E-16', evaluator: 'LUAN SOUZA FERREIRA', matricula: '2170', dayOffset: 8, linhas: 14, plantas: 288, projetadas: 870, semPodar: 3, exposto: 7, meiaCoroa: 3, folhaMamando: 1, maiorUmParaUm: 4, bicoGaita: 2, podre: 1, palha: 5, status: 'Pendente validação' },
  { farm: 'FÉ EM DEUS', parcel: 'F-16', evaluator: 'DANIEL SOUZA', matricula: '1938', dayOffset: 9, linhas: 16, plantas: 320, projetadas: 1040, semPodar: 5, exposto: 10, meiaCoroa: 6, folhaMamando: 2, maiorUmParaUm: 5, bicoGaita: 2, podre: 2, palha: 7, status: 'Reprovado' },
  { farm: 'SANTA MARIA', parcel: 'C-02', evaluator: 'RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR', matricula: '384', dayOffset: 11, linhas: 16, plantas: 310, projetadas: 1010, semPodar: 1, exposto: 3, meiaCoroa: 2, folhaMamando: 0, maiorUmParaUm: 2, bicoGaita: 1, podre: 0, palha: 1, status: 'Aprovado' },
  { farm: 'VILA NOVA', parcel: 'A-04', evaluator: 'ROBERTO QUEIROZ COUTINHO', matricula: '3102', dayOffset: 12, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 2, exposto: 4, meiaCoroa: 3, folhaMamando: 1, maiorUmParaUm: 3, bicoGaita: 1, podre: 0, palha: 3, status: 'Aprovado' },
  // === SEMANA 3 (dia 15-21) ===
  { farm: 'FÉ EM DEUS', parcel: 'F-15', evaluator: 'DANIEL SOUZA', matricula: '1938', dayOffset: 15, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 4, exposto: 8, meiaCoroa: 5, folhaMamando: 2, maiorUmParaUm: 5, bicoGaita: 2, podre: 1, palha: 6, status: 'Pendente validação' },
  { farm: 'SANTA MARIA', parcel: 'B-11', evaluator: 'RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR', matricula: '384', dayOffset: 16, linhas: 14, plantas: 288, projetadas: 870, semPodar: 0, exposto: 2, meiaCoroa: 1, folhaMamando: 0, maiorUmParaUm: 1, bicoGaita: 0, podre: 0, palha: 1, status: 'Aprovado' },
  { farm: 'VILA NOVA', parcel: 'D-09', evaluator: 'LUAN SOUZA FERREIRA', matricula: '2170', dayOffset: 18, linhas: 16, plantas: 336, projetadas: 1120, semPodar: 3, exposto: 6, meiaCoroa: 4, folhaMamando: 1, maiorUmParaUm: 4, bicoGaita: 1, podre: 1, palha: 4, status: 'Aprovado' },
  { farm: 'FÉ EM DEUS', parcel: 'H-20', evaluator: 'ROBERTO QUEIROZ COUTINHO', matricula: '3102', dayOffset: 20, linhas: 16, plantas: 304, projetadas: 980, semPodar: 2, exposto: 5, meiaCoroa: 3, folhaMamando: 2, maiorUmParaUm: 4, bicoGaita: 1, podre: 0, palha: 3, status: 'Aprovado' },
  // === SEMANA 4 (dia 22-28) ===
  { farm: 'VILA NOVA', parcel: 'E-16', evaluator: 'DANIEL SOUZA', matricula: '1938', dayOffset: 22, linhas: 14, plantas: 288, projetadas: 870, semPodar: 1, exposto: 3, meiaCoroa: 2, folhaMamando: 0, maiorUmParaUm: 2, bicoGaita: 0, podre: 0, palha: 2, status: 'Aprovado' },
  { farm: 'FÉ EM DEUS', parcel: 'F-16', evaluator: 'RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR', matricula: '384', dayOffset: 23, linhas: 16, plantas: 320, projetadas: 1040, semPodar: 6, exposto: 12, meiaCoroa: 7, folhaMamando: 3, maiorUmParaUm: 7, bicoGaita: 3, podre: 2, palha: 9, status: 'Reprovado' },
  { farm: 'SANTA MARIA', parcel: 'C-02', evaluator: 'LUAN SOUZA FERREIRA', matricula: '2170', dayOffset: 25, linhas: 16, plantas: 310, projetadas: 1010, semPodar: 0, exposto: 2, meiaCoroa: 1, folhaMamando: 0, maiorUmParaUm: 1, bicoGaita: 0, podre: 0, palha: 1, status: 'Aprovado' },
  { farm: 'VILA NOVA', parcel: 'A-04', evaluator: 'ROBERTO QUEIROZ COUTINHO', matricula: '3102', dayOffset: 26, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 4, exposto: 7, meiaCoroa: 4, folhaMamando: 2, maiorUmParaUm: 5, bicoGaita: 2, podre: 1, palha: 5, status: 'Pendente validação' },
  // === SEMANA 5 (dia 29-35) ===
  { farm: 'FÉ EM DEUS', parcel: 'F-15', evaluator: 'ROBERTO QUEIROZ COUTINHO', matricula: '3102', dayOffset: 29, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 5, exposto: 9, meiaCoroa: 6, folhaMamando: 3, maiorUmParaUm: 6, bicoGaita: 2, podre: 2, palha: 8, status: 'Pendente validação' },
  { farm: 'SANTA MARIA', parcel: 'B-11', evaluator: 'DANIEL SOUZA', matricula: '1938', dayOffset: 30, linhas: 14, plantas: 288, projetadas: 870, semPodar: 2, exposto: 4, meiaCoroa: 2, folhaMamando: 1, maiorUmParaUm: 3, bicoGaita: 1, podre: 0, palha: 2, status: 'Aprovado' },
  { farm: 'VILA NOVA', parcel: 'D-09', evaluator: 'RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR', matricula: '384', dayOffset: 32, linhas: 16, plantas: 336, projetadas: 1120, semPodar: 1, exposto: 4, meiaCoroa: 2, folhaMamando: 0, maiorUmParaUm: 2, bicoGaita: 0, podre: 0, palha: 2, status: 'Aprovado' },
  { farm: 'FÉ EM DEUS', parcel: 'H-20', evaluator: 'LUAN SOUZA FERREIRA', matricula: '2170', dayOffset: 33, linhas: 16, plantas: 304, projetadas: 980, semPodar: 3, exposto: 7, meiaCoroa: 5, folhaMamando: 2, maiorUmParaUm: 6, bicoGaita: 2, podre: 1, palha: 4, status: 'Aprovado' },
  // === SEMANA 6 (dia 36-42) ===
  { farm: 'VILA NOVA', parcel: 'A-04', evaluator: 'DANIEL SOUZA', matricula: '1938', dayOffset: 36, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 0, exposto: 2, meiaCoroa: 1, folhaMamando: 0, maiorUmParaUm: 1, bicoGaita: 0, podre: 0, palha: 1, status: 'Aprovado' },
  { farm: 'FÉ EM DEUS', parcel: 'F-16', evaluator: 'ROBERTO QUEIROZ COUTINHO', matricula: '3102', dayOffset: 37, linhas: 16, plantas: 320, projetadas: 1040, semPodar: 4, exposto: 8, meiaCoroa: 5, folhaMamando: 2, maiorUmParaUm: 4, bicoGaita: 2, podre: 1, palha: 6, status: 'Pendente validação' },
  { farm: 'SANTA MARIA', parcel: 'C-02', evaluator: 'RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR', matricula: '384', dayOffset: 39, linhas: 16, plantas: 310, projetadas: 1010, semPodar: 1, exposto: 3, meiaCoroa: 2, folhaMamando: 1, maiorUmParaUm: 2, bicoGaita: 0, podre: 0, palha: 2, status: 'Aprovado' },
  { farm: 'VILA NOVA', parcel: 'E-16', evaluator: 'LUAN SOUZA FERREIRA', matricula: '2170', dayOffset: 40, linhas: 14, plantas: 288, projetadas: 870, semPodar: 2, exposto: 5, meiaCoroa: 3, folhaMamando: 1, maiorUmParaUm: 3, bicoGaita: 1, podre: 1, palha: 3, status: 'Aprovado' },
  // === SEMANA 7 (dia 43-49) ===
  { farm: 'FÉ EM DEUS', parcel: 'F-15', evaluator: 'DANIEL SOUZA', matricula: '1938', dayOffset: 43, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 7, exposto: 15, meiaCoroa: 9, folhaMamando: 4, maiorUmParaUm: 8, bicoGaita: 3, podre: 3, palha: 11, status: 'Reprovado' },
  { farm: 'VILA NOVA', parcel: 'D-09', evaluator: 'ROBERTO QUEIROZ COUTINHO', matricula: '3102', dayOffset: 44, linhas: 16, plantas: 336, projetadas: 1120, semPodar: 2, exposto: 5, meiaCoroa: 3, folhaMamando: 1, maiorUmParaUm: 3, bicoGaita: 1, podre: 0, palha: 3, status: 'Aprovado' },
  { farm: 'FÉ EM DEUS', parcel: 'H-20', evaluator: 'LUAN SOUZA FERREIRA', matricula: '2170', dayOffset: 46, linhas: 16, plantas: 304, projetadas: 980, semPodar: 1, exposto: 4, meiaCoroa: 2, folhaMamando: 1, maiorUmParaUm: 2, bicoGaita: 0, podre: 0, palha: 2, status: 'Aprovado' },
  { farm: 'SANTA MARIA', parcel: 'B-11', evaluator: 'RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR', matricula: '384', dayOffset: 47, linhas: 14, plantas: 288, projetadas: 870, semPodar: 0, exposto: 2, meiaCoroa: 1, folhaMamando: 0, maiorUmParaUm: 1, bicoGaita: 0, podre: 0, palha: 1, status: 'Aprovado' },
  // === SEMANA 8 (dia 50-56) ===
  { farm: 'VILA NOVA', parcel: 'A-04', evaluator: 'RAIMUNDO NONATO DOS SANTOS FURTADO JUNIOR', matricula: '384', dayOffset: 50, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 3, exposto: 6, meiaCoroa: 4, folhaMamando: 2, maiorUmParaUm: 4, bicoGaita: 1, podre: 1, palha: 4, status: 'Aprovado' },
  { farm: 'FÉ EM DEUS', parcel: 'F-16', evaluator: 'DANIEL SOUZA', matricula: '1938', dayOffset: 51, linhas: 16, plantas: 320, projetadas: 1040, semPodar: 5, exposto: 11, meiaCoroa: 7, folhaMamando: 3, maiorUmParaUm: 7, bicoGaita: 2, podre: 2, palha: 8, status: 'Reprovado' },
  { farm: 'SANTA MARIA', parcel: 'C-02', evaluator: 'ROBERTO QUEIROZ COUTINHO', matricula: '3102', dayOffset: 53, linhas: 16, plantas: 310, projetadas: 1010, semPodar: 1, exposto: 3, meiaCoroa: 2, folhaMamando: 1, maiorUmParaUm: 2, bicoGaita: 0, podre: 0, palha: 2, status: 'Aprovado' },
  { farm: 'FÉ EM DEUS', parcel: 'F-15', evaluator: 'LUAN SOUZA FERREIRA', matricula: '2170', dayOffset: 54, linhas: 16, plantas: 320, projetadas: 1080, semPodar: 4, exposto: 9, meiaCoroa: 5, folhaMamando: 2, maiorUmParaUm: 5, bicoGaita: 2, podre: 1, palha: 7, status: 'Pendente validação' },
];

function inputDateFromDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function displayDateFromDate(date) {
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function projectPodaOccurrence(value, plantas, projetadas) {
  if (!plantas || !projetadas) return Number(value || 0);
  return Math.round((Number(value || 0) / plantas) * projetadas);
}

export function buildPodaDemoRecords() {
  if (!PODA_PRESENTATION_DEMO_ENABLED) return [];

  // Use absolute dates anchored to today-56 days so chart always shows 8 full weeks
  const anchor = new Date();
  anchor.setDate(anchor.getDate() - 56);
  anchor.setHours(0, 0, 0, 0);

  return PODA_DEMO_SPECS.map((spec, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + spec.dayOffset);
    const inputDate = inputDateFromDate(date);
    const displayDate = displayDateFromDate(date);
    const gpsLat = -2.84 - index * 0.006;
    const gpsLng = -48.22 - index * 0.004;
    const project = (value) => projectPodaOccurrence(value, spec.plantas, spec.projetadas);

    return {
      id: `demo_poda_${index + 1}`,
      type: 'poda',
      form: 'CQO Poda',
      source: 'app',
      farm: spec.farm,
      farmId: spec.farm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'),
      parcel: spec.parcel,
      cycle: '2',
      evaluator: spec.evaluator,
      evaluatorMatricula: spec.matricula,
      fiscal: spec.evaluator,
      status: spec.status,
      date: displayDate,
      createdAt: `${inputDate}T09:00:00`,
      sentAt: `${inputDate}T09:14:00`,
      gps: { lat: gpsLat, lng: gpsLng, accuracy: 6 },
      gpsTrack: [
        { lat: gpsLat, lng: gpsLng, accuracy: 6, capturedAt: `${inputDate}T09:00:00` },
        { lat: gpsLat + 0.001, lng: gpsLng + 0.001, accuracy: 8, capturedAt: `${inputDate}T09:08:00` },
      ],
      gpsOccurrences: [],
      gpsApplicable: true,
      acompanhamento: { teve: 'sim' },
      raw: {
        data_avaliacao: inputDate,
        formulario_id: 'form_cqo_poda',
        formulario_titulo: 'CQO Poda',
        demonstrativo_temporario: true,
      },
      lines: [],
      activity: 'Poda',
      company: 'Vila Nova',
      totals: {
        linhas: spec.linhas,
        plantasLinha: spec.plantas,
        plantasObservadas: spec.plantas,
        plantasProjetadas: spec.projetadas,
        totalPlantasParcela: spec.projetadas,
        plantaSemPodar: spec.semPodar,
        cachoExposto: spec.exposto,
        podaMeiaCoroa: spec.meiaCoroa,
        folhaMamando: spec.folhaMamando,
        podaMaiorUmParaUm: spec.maiorUmParaUm,
        bicoGaita: spec.bicoGaita,
        cachoPodrePlanta: spec.podre,
        palhaMalEmpilhada: spec.palha,
        plantaSemPodarProjetada: project(spec.semPodar),
        cachoExpostoProjetado: project(spec.exposto),
        podaMeiaCoroaProjetada: project(spec.meiaCoroa),
        folhaMamandoProjetada: project(spec.folhaMamando),
        podaMaiorUmParaUmProjetada: project(spec.maiorUmParaUm),
        bicoGaitaProjetado: project(spec.bicoGaita),
        cachoPodrePlantaProjetado: project(spec.podre),
        palhaMalEmpilhadaProjetada: project(spec.palha),
      },
    };
  });
}