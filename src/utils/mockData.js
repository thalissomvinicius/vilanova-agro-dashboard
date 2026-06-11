// Mock Data Generator for Vila Nova Agroindustrial
// Locations are based around Tome-Acu, Para, Brazil (approx. coordinates: Latitude -2.39, Longitude -48.15)

export const FARMS = [
  { id: 'all', name: 'Todas as Fazendas' },
  { id: 'fe-em-deus', name: 'Fe em Deus', areaHa: 0, Lat: -2.386, Lng: -48.142 },
  { id: 'nova-conceicao', name: 'Nova Conceicao', areaHa: 0, Lat: -2.401, Lng: -48.168 },
  { id: 'vila-nova', name: 'Vila Nova', areaHa: 0, Lat: -2.396, Lng: -48.154 }
];

export const AREAS = [
  { id: 'all', name: 'Todos os formularios' },
  { id: 'corte', name: 'CQO Corte' },
  { id: 'carreamento', name: 'CQO Carreamento' }
];

export const COLLABORATORS = [
  { id: 'colab-1', name: 'Carlos Santos', role: 'Supervisor de Campo', status: 'active', farm: 'rio-capim', Lat: -2.386, Lng: -48.141, battery: 94, device: 'Samsung Galaxy Tab Active3' },
  { id: 'colab-2', name: 'Ana Oliveira', role: 'Tecnica de Classificacao', status: 'active', farm: 'uraim', Lat: -2.408, Lng: -48.179, battery: 88, device: 'Nokia XR20' },
  { id: 'colab-3', name: 'Marcos Silva', role: 'Inspetor Fitossanitario', status: 'active', farm: 'condor', Lat: -2.362, Lng: -48.112, battery: 72, device: 'Samsung Galaxy XCover 5' },
  { id: 'colab-4', name: 'Paula Costa', role: 'Operadora de Coleta', status: 'active', farm: 'rio-capim', Lat: -2.389, Lng: -48.138, battery: 100, device: 'Motorola Defy' },
  { id: 'colab-5', name: 'Joao Souza', role: 'Auxiliar de Rastreabilidade', status: 'active', farm: 'vila-nova', Lat: -2.396, Lng: -48.154, battery: 65, device: 'Samsung Galaxy Tab Active3' },
  { id: 'colab-6', name: 'Juliana Lima', role: 'Auditora SSMA', status: 'offline', farm: 'uraim', Lat: -2.412, Lng: -48.182, battery: 45, device: 'Nokia XR20' },
  { id: 'colab-7', name: 'Lucas Rocha', role: 'Supervisor de Campo', status: 'active', farm: 'condor', Lat: -2.358, Lng: -48.108, battery: 82, device: 'Cat S42 H+' }
];

export const COLETAS_MOCK = [
  {
    id: 'col-101',
    date: '2026-06-04',
    time: '13:10',
    collaborator: 'Paula Costa',
    area: 'Area Beta (Producao Plena)',
    form: 'Ficha de Colheita Diaria',
    farm: 'Fazenda Rio Capim',
    talhao: 'Talhao C12',
    status: 'Sincronizado',
    gps: '-2.3890, -48.1385',
    lat: -2.3890,
    lng: -48.1385,
    photos: ['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=400&q=80', 'https://images.unsplash.com/photo-1594782078968-2b07656d7bb2?w=400&q=80'],
    signature: 'Paula C.',
    details: {
      cachosColhidos: 142,
      pesoEstimadoKg: 2840,
      grauMadureza: 'Excelente (94%)',
      observacao: 'Area limpa, colheita realizada dentro do cronograma.'
    }
  },
  {
    id: 'col-102',
    date: '2026-06-04',
    time: '12:45',
    collaborator: 'Marcos Silva',
    area: 'Area Alfa (Cultivo Jovem)',
    form: 'Monitoramento Fitossanitário',
    farm: 'Fazenda Condor',
    talhao: 'Talhao A04',
    status: 'Sincronizado',
    gps: '-2.3621, -48.1128',
    lat: -2.3621,
    lng: -48.1128,
    photos: ['https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&q=80'],
    signature: 'Marcos S.',
    details: {
      pragasDetectadas: 'Nenhuma',
      estadoFoliar: 'Saudavel',
      deficienciaNutricional: 'Nenhuma detectada',
      observacao: 'Adubacao anterior surtiu excelente efeito no vigor foliar.'
    }
  },
  {
    id: 'col-103',
    date: '2026-06-04',
    time: '11:30',
    collaborator: 'Ana Oliveira',
    area: 'Area Gama (Consórcio Agroflorestal)',
    form: 'Auditoria de Qualidade do Cacho',
    farm: 'Fazenda Uraim',
    talhao: 'Talhao G02',
    status: 'Pendente',
    gps: '-2.4082, -48.1791',
    lat: -2.4082,
    lng: -48.1791,
    photos: [],
    signature: 'Ana O.',
    details: {
      cachosAvaliados: 45,
      cachosSoltos: 8,
      grauAcidezEstimado: '1.2%',
      observacao: 'Cachos de boa qualidade, porem aguardando liberação do transporte.'
    }
  },
  {
    id: 'col-104',
    date: '2026-06-04',
    time: '10:15',
    collaborator: 'Joao Souza',
    area: 'Area Beta (Producao Plena)',
    form: 'Ficha de Colheita Diaria',
    farm: 'Fazenda Vila Nova',
    talhao: 'Talhao B03',
    status: 'Sincronizado',
    gps: '-2.3965, -48.1542',
    lat: -2.3965,
    lng: -48.1542,
    photos: ['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=400&q=80'],
    signature: 'Joao S.',
    details: {
      cachosColhidos: 98,
      pesoEstimadoKg: 1960,
      grauMadureza: 'Ideal',
      observacao: 'Terreno umido, mas trator de coleta operando normalmente.'
    }
  },
  {
    id: 'col-105',
    date: '2026-06-03',
    time: '16:40',
    collaborator: 'Juliana Lima',
    area: 'Area Alfa (Cultivo Jovem)',
    form: 'Inspecao de Seguranca (SSMA)',
    farm: 'Fazenda Uraim',
    talhao: 'Talhao A02',
    status: 'Falha',
    gps: '-2.4125, -48.1820',
    lat: -2.4125,
    lng: -48.1820,
    photos: ['https://images.unsplash.com/photo-1508962914676-134849a727f0?w=400&q=80'],
    signature: 'Juliana L.',
    details: {
      conformidadeEPI: 'Inconformidade em 1 operador (falta de luvas de raspa)',
      sinalizacaoRisco: 'Adequada',
      quaseAcidentes: 'Nenhum',
      observacao: 'Notificação emitida. Sincronizacao falhou por instabilidade no sinal da fazenda.'
    }
  },
  {
    id: 'col-106',
    date: '2026-06-03',
    time: '14:20',
    collaborator: 'Carlos Santos',
    area: 'Area Beta (Producao Plena)',
    form: 'Rastreabilidade de Transporte',
    farm: 'Fazenda Rio Capim',
    talhao: 'Talhao C05',
    status: 'Sincronizado',
    gps: '-2.3862, -48.1415',
    lat: -2.3862,
    lng: -48.1415,
    photos: [],
    signature: 'Carlos S.',
    details: {
      placaCaminhao: 'JVW-8G52',
      romaneioId: 'ROM-9824',
      pesoLiquidoTons: 14.8,
      observacao: 'Carga lacrada e enviada diretamente para a usina de extracao.'
    }
  }
];

export const SSMA_MOCK = {
  acidentes: 0, // META ZERO!
  incidentes: 2,
  quaseAcidentes: 5,
  auditorias: 14,
  inspecoes: 38,
  treinamentos: 8,
  metaAcidentes: 0,
  taxaConformidadeEPI: 96.8,
  treinamentosConcluidos: 142, // Colaboradores treinados
  totalColaboradores: 180,
  ocorrenciasRecentes: [
    { id: 'ssma-1', categoria: 'Ergonomia', data: '2026-06-02', farm: 'Fazenda Uraim', gravidade: 'Leve', status: 'Fechada', desc: 'Ajuste de assento de colheitadeira solicitado.' },
    { id: 'ssma-2', categoria: 'Meio Ambiente', data: '2026-06-03', farm: 'Fazenda Rio Capim', gravidade: 'Moderada', status: 'Em Analise', desc: 'Pequeno gotejamento de oleo lubrificante no talhao C10.' },
    { id: 'ssma-3', categoria: 'EPI', data: '2026-06-03', farm: 'Fazenda Uraim', gravidade: 'Leve', status: 'Aberta', desc: 'Operador flagrado sem luva de raspa regulamentar.' }
  ]
};

export const SYNC_MOCK = {
  totalDispositivos: 18,
  ativos: 7,
  offline: 11,
  tempoMedioSync: '4.2s',
  taxaSucesso: '98.5%',
  filaPendencias: [
    { id: 'q-1', dispositivo: 'Ana - Nokia XR20', data: '2026-06-04 11:30', tamanho: '42KB', tipo: 'Coleta de Dados' },
    { id: 'q-2', dispositivo: 'Juliana - Nokia XR20', data: '2026-06-03 16:40', tamanho: '1.2MB', tipo: 'Inspeção SSMA (Com Foto)' }
  ],
  historicoLogs: [
    { id: 'log-1', timestamp: '2026-06-04 13:10:45', dispositivo: 'Paula - Motorola Defy', status: 'Sucesso', msg: 'Sincronizacao de 1 registro (Ficha de Colheita Diaria)' },
    { id: 'log-2', timestamp: '2026-06-04 12:45:12', dispositivo: 'Marcos - XCover 5', status: 'Sucesso', msg: 'Sincronizacao de 1 registro (Monitoramento Fitossanitário)' },
    { id: 'log-3', timestamp: '2026-06-04 12:15:30', dispositivo: 'Ana - Nokia XR20', status: 'Erro de Conexão', msg: 'Timeout ao enviar dados binarios (fotos)' },
    { id: 'log-4', timestamp: '2026-06-04 10:15:05', dispositivo: 'João - Tab Active3', status: 'Sucesso', msg: 'Sincronizacao de 1 registro (Ficha de Colheita Diaria)' }
  ]
};

// Functions to query/filter metrics reactively based on active filters
export function getMetrics(farmId = 'all', areaId = 'all') {
  // Base numbers that scale dynamically based on selected Farm
  let factor = 1.0;
  if (farmId === 'rio-capim') factor = 0.35;
  else if (farmId === 'uraim') factor = 0.22;
  else if (farmId === 'condor') factor = 0.30;
  else if (farmId === 'vila-nova') factor = 0.13;

  if (areaId !== 'all') {
    factor = factor * 0.4; // reduce weight if filtered by sub-area
  }

  // Basic KPI computations
  const totalDailyProd = Math.round(184.5 * factor * 10) / 10;
  const totalMonthlyProd = Math.round(5420 * factor);
  const activeCollabs = Math.round(7 * (farmId === 'all' ? 1 : 0.3));
  const totalColetas = Math.round(86 * factor);
  const pendencias = Math.round(5 * factor);
  const syncs = Math.round(78 * factor);
  const ocorrencias = Math.round(3 * factor);
  const sustScore = Math.round(92.5 + (farmId === 'uraim' ? 2.5 : farmId === 'condor' ? -1.5 : 0));

  return {
    producaoDia: totalDailyProd,
    producaoMes: totalMonthlyProd,
    colaboradoresAtivos: activeCollabs,
    coletasRecebidas: totalColetas,
    pendencias,
    syncRealizadas: syncs,
    ocorrenciasAbertas: ocorrencias,
    indicadorSustentabilidade: sustScore
  };
}

// Generates dynamic data for chart components based on selected filters
export function getChartData(farmId = 'all', _areaId = 'all') {
  // 1. Production by Farm
  const prodByFarm = [
    { label: 'F. Rio Capim', value: 1890, fill: '#D98C10' },
    { label: 'F. Uraim', value: 1192, fill: '#F2B544' },
    { label: 'F. Condor', value: 1625, fill: '#B36F00' },
    { label: 'F. Vila Nova', value: 713, fill: '#F2B544' }
  ];

  // 2. Production by Area
  const prodByArea = [
    { label: 'Area Alfa', value: 1620, fill: '#D98C10' },
    { label: 'Area Beta', value: 2840, fill: '#B36F00' },
    { label: 'Area Gama', value: 960, fill: '#F2B544' }
  ];

  // 3. Production by Plot (Talhoes)
  const prodByPlot = [
    { label: 'Talhao C12', value: 450 },
    { label: 'Talhao B03', value: 390 },
    { label: 'Talhao A04', value: 340 },
    { label: 'Talhao G02', value: 290 },
    { label: 'Talhao C05', value: 210 }
  ];

  // 4. Production by Collaborator
  const prodByCollab = [
    { label: 'Paula Costa', value: 85, fill: '#D98C10' },
    { label: 'Joao Souza', value: 72, fill: '#D98C10' },
    { label: 'Carlos Santos', value: 68, fill: '#D98C10' },
    { label: 'Ana Oliveira', value: 55, fill: '#D98C10' },
    { label: 'Marcos Silva', value: 48, fill: '#D98C10' }
  ];

  // 5. Daily Production Trend (Last 7 Days)
  const dailyTrend = [
    { label: '28/05', value: 154 },
    { label: '29/05', value: 162 },
    { label: '30/05', value: 148 },
    { label: '31/05', value: 170 },
    { label: '01/06', value: 185 },
    { label: '02/06', value: 191 },
    { label: '03/06', value: 184 }
  ];

  // 6. Weekly Production Trend (Last 4 Weeks)
  const weeklyTrend = [
    { label: 'Semana 1', value: 1120 },
    { label: 'Semana 2', value: 1250 },
    { label: 'Semana 3', value: 1180 },
    { label: 'Semana 4', value: 1380 }
  ];

  // 7. Monthly Production Trend (Last 6 Months)
  const monthlyTrend = [
    { label: 'Dez', value: 4800 },
    { label: 'Jan', value: 5120 },
    { label: 'Fev', value: 4950 },
    { label: 'Mar', value: 5300 },
    { label: 'Abr', value: 5200 },
    { label: 'Mai', value: 5420 }
  ];

  // 8. Ocorrencias por Categoria (SSMA)
  const ssmaCategories = [
    { label: 'Ergonomia', value: 3, fill: '#3B82F6' },
    { label: 'EPI', value: 4, fill: '#F59E0B' },
    { label: 'Meio Ambiente', value: 2, fill: '#22C55E' },
    { label: 'Ferramentas', value: 1, fill: '#EF4444' }
  ];

  // Scale data if a farm is selected
  let scale = 1.0;
  if (farmId === 'rio-capim') scale = 0.35;
  else if (farmId === 'uraim') scale = 0.22;
  else if (farmId === 'condor') scale = 0.30;
  else if (farmId === 'vila-nova') scale = 0.13;

  const scaleArray = (arr) => arr.map(item => ({ ...item, value: Math.round(item.value * scale) }));

  return {
    prodByFarm: farmId === 'all' ? prodByFarm : scaleArray(prodByFarm),
    prodByArea: scaleArray(prodByArea),
    prodByPlot: scaleArray(prodByPlot),
    prodByCollab: scaleArray(prodByCollab),
    dailyTrend: scaleArray(dailyTrend),
    weeklyTrend: scaleArray(weeklyTrend),
    monthlyTrend: scaleArray(monthlyTrend),
    ssmaCategories: scaleArray(ssmaCategories)
  };
}

