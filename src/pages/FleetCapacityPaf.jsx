import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Scale,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { fetchAgroDataset } from '../utils/agroApiData';
import { getCqoSessionToken } from '../utils/cqoData';
import './FleetCapacityPaf.css';

const FLEET = [
  { plate: 'QEC-8126', supplier: 'JDF', contact: 'Diogo Mardone' },
  { plate: 'QET-6I08', supplier: 'JDF', contact: 'Diogo Mardone' },
  { plate: 'QDZ-2G85', supplier: 'JDF', contact: 'Diogo Mardone' },
  { plate: 'QEB-2E24', supplier: 'JDF', contact: 'Diogo Mardone' },
  { plate: 'SZX-1D20', supplier: 'Faz. Chermont', contact: 'Walter Chermont' },
  { plate: 'OBT-9H67', supplier: 'TS Transporte', contact: 'Gleidson' },
  { plate: 'RWX-5I94', supplier: 'SMG - Transporte e Logística', contact: 'Bruno Matoso' },
];

const PRODUCTS = [
  'CFF FRUTO DE DENDÊ',
  'CFF - M.O',
  'CFF - FRUTO DE DENDE',
  'CFF Fruto de Dendê- Terceiros',
];

const PLAN = {
  targetMonth: 4565,
  referenceMonth: 3827,
  months: [
    ['Jan', 1580, 2907.42], ['Fev', 2230, 2175.68], ['Mar', 2330, 2602.62],
    ['Abr', 3230, 3213.34], ['Mai', 3270, 4099.20], ['Jun', 3740, 3811.34],
    ['Jul', 3827, 3705.89], ['Ago', 4565, null], ['Set', 7125, null],
    ['Out', 9925, null], ['Nov', 11625, null], ['Dez', 10360, null],
  ],
  suppliers: [
    ['Etino', 22500, 5374.45, 17750],
    ['Consulvale / BBF Faz. Amanda', 20357, 8910.77, 10800],
    ['Antonio Rocha', 12540, 5457.67, 9150],
    ['Coopafamita', 6410, 2181.94, 4350],
    ['Ednaldo Lima', 2000, 590.66, 1550],
  ],
};

const number = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function tonnes(value) { return `${number.format(Number(value || 0))} t`; }
function percent(value) { return `${one.format(Number(value || 0))}%`; }
function signed(value, suffix = ' t') {
  const numeric = Number(value || 0);
  return `${numeric > 0 ? '+' : numeric < 0 ? '−' : ''}${number.format(Math.abs(numeric))}${suffix}`;
}
function normalizePlate(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.length === 7 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
}
function localDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function todayKey() { return localDateKey(new Date()); }
function dateBr(value, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', withTime
    ? { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }
    : { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}
function daysInclusive(from, to) {
  return Math.max(1, Math.round((new Date(`${to}T12:00:00-03:00`) - new Date(`${from}T12:00:00-03:00`)) / 86400000) + 1);
}
function monthDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function consolidate(rawTickets) {
  const fleetByPlate = new Map(FLEET.map((item) => [item.plate, item]));
  const uniqueTickets = new Map();
  rawTickets.forEach((ticket) => {
    const plate = normalizePlate(ticket.vehiclePlate);
    if (!fleetByPlate.has(plate) || ticket.status !== 'closed' || Number(ticket.netWeightKg) <= 0 || !ticket.enteredAt) return;
    const key = String(ticket.sourceTicketId || ticket.ticketCode || `${plate}|${ticket.enteredAt}`);
    if (!uniqueTickets.has(key)) uniqueTickets.set(key, { ...ticket, plate, fleet: fleetByPlate.get(plate) });
  });

  const trips = new Map();
  uniqueTickets.forEach((ticket) => {
    const key = `${ticket.plate}|${ticket.enteredAt}`;
    const current = trips.get(key) || {
      key, plate: ticket.plate, supplier: ticket.fleet.supplier, contact: ticket.fleet.contact,
      enteredAt: ticket.enteredAt, exitedAt: ticket.exitedAt, netWeightKg: 0, tickets: [],
    };
    current.netWeightKg += Number(ticket.netWeightKg || 0);
    current.tickets.push(ticket);
    if (ticket.exitedAt && (!current.exitedAt || ticket.exitedAt > current.exitedAt)) current.exitedAt = ticket.exitedAt;
    trips.set(key, current);
  });
  return { tickets: [...uniqueTickets.values()], trips: [...trips.values()] };
}

function summarize(trips) {
  const totalKg = trips.reduce((sum, trip) => sum + trip.netWeightKg, 0);
  return {
    tonnes: totalKg / 1000,
    trips: trips.length,
    tickets: trips.reduce((sum, trip) => sum + trip.tickets.length, 0),
    averageLoad: trips.length ? totalKg / 1000 / trips.length : 0,
    activeVehicles: new Set(trips.map((trip) => trip.plate)).size,
    lastEntryAt: trips.map((trip) => trip.enteredAt).sort().at(-1) || null,
  };
}

function filterTrips(trips, { from, to, plate = '', supplier = '' }) {
  return trips.filter((trip) => {
    const day = localDateKey(trip.enteredAt);
    return (!from || day >= from) && (!to || day <= to)
      && (!plate || trip.plate === plate) && (!supplier || trip.supplier === supplier);
  });
}

function capacityAnalysis(trips, today) {
  const july = summarize(filterTrips(trips, { from: '2026-07-01', to: '2026-07-31' }));
  const augustTo = today.startsWith('2026-08') ? today : '2026-08-31';
  const august = summarize(filterTrips(trips, { from: '2026-08-01', to: augustTo }));
  const year = summarize(filterTrips(trips, { from: '2026-01-01', to: augustTo }));
  const tripsPerTruck = july.trips / FLEET.length;
  const tonnesPerTruck = july.tonnes / FLEET.length;
  const withOne = tonnesPerTruck * 8;
  const combined = tripsPerTruck * 8 * year.averageLoad;
  const targetGap = PLAN.targetMonth - july.tonnes;
  const contribution = withOne - july.tonnes;
  const elapsed = daysInclusive('2026-08-01', augustTo);
  const totalDays = monthDays('2026-08');
  const remainingDays = Math.max(0, totalDays - elapsed);
  const daily = august.tonnes / elapsed;
  const paceProjection = daily * totalDays;
  const remaining = Math.max(0, PLAN.targetMonth - august.tonnes);
  const requiredDaily = remainingDays ? remaining / remainingDays : remaining;
  return {
    july, august, year, augustTo, tripsPerTruck, tonnesPerTruck, withOne, combined,
    contribution, coverage: targetGap > 0 ? contribution / targetGap * 100 : 100,
    attainment: combined / PLAN.targetMonth * 100, margin: combined - PLAN.targetMonth,
    loadRecovery: july.averageLoad ? (year.averageLoad / july.averageLoad - 1) * 100 : 0,
    elapsed, daily, paceProjection, projectedGap: Math.max(0, PLAN.targetMonth - paceProjection),
    requiredDaily, requiredIncrease: daily ? (requiredDaily / daily - 1) * 100 : 0,
    reconciliation: july.tonnes / PLAN.referenceMonth * 100,
  };
}

function Metric({ label, value, detail, icon: Icon, tone = '' }) {
  return <article className={`fleet-paf-metric ${tone}`}><span><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}

function CapacityBars({ analysis }) {
  const rows = [
    ['A • Frota observada', '7 veículos • produtividade de julho', analysis.july.tonnes, 'observed'],
    ['B • Solicitação +1', '8 veículos • mesma produtividade', analysis.withOne, 'calculated'],
    ['C • +1 e carga recuperada', `8 veículos • carga média ${number.format(analysis.year.averageLoad)} t`, analysis.combined, 'assumption'],
  ];
  const max = Math.max(PLAN.targetMonth, ...rows.map((row) => row[2])) * 1.06;
  return <div className="fleet-paf-capacity">
    {rows.map(([label, detail, value, tone]) => <div className="fleet-paf-capacity-row" key={label}>
      <div><b>{label}</b><small>{detail}</small></div>
      <div className="fleet-paf-capacity-track"><span className={tone} style={{ width: `${Math.min(100, value / max * 100)}%` }}><b>{tonnes(value)}</b></span>{tone === 'assumption' && <i style={{ left: `${PLAN.targetMonth / max * 100}%` }}>Meta</i>}</div>
    </div>)}
  </div>;
}

function TrendChart({ rows }) {
  const width = 760, height = 250, pad = 38;
  const max = Math.max(...rows.map((row) => row.tonnes), 1) * 1.12;
  const points = rows.map((row, index) => ({
    ...row,
    x: pad + index * ((width - pad * 2) / Math.max(1, rows.length - 1)),
    y: height - pad - row.tonnes / max * (height - pad * 2),
  }));
  return <div className="fleet-paf-chart-scroll"><svg className="fleet-paf-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução do volume de CFF">
    {[0, 1, 2, 3, 4].map((step) => { const y = pad + step * ((height - pad * 2) / 4); return <line key={step} x1={pad} x2={width - pad} y1={y} y2={y} />; })}
    <path className="area" d={`M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')} L ${points.at(-1)?.x || pad} ${height - pad} L ${pad} ${height - pad} Z`} />
    <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
    {points.map((point) => <g key={point.key}><circle cx={point.x} cy={point.y} r="3.5"/><text x={point.x} y={height - 14}>{point.label}</text></g>)}
  </svg></div>;
}

function ProjectionChart() {
  const width = 760, height = 260, pad = 38;
  const max = Math.max(...PLAN.months.map((row) => row[1])) * 1.12;
  const slot = (width - pad * 2) / PLAN.months.length;
  const planPoints = PLAN.months.map((row, index) => `${pad + slot * index + slot / 2},${height - pad - row[1] / max * (height - pad * 2)}`).join(' ');
  return <div className="fleet-paf-chart-scroll"><svg className="fleet-paf-projection-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Plano, realizado e projeção de CFF em 2026">
    {[0, 1, 2, 3, 4].map((step) => { const y = pad + step * ((height - pad * 2) / 4); return <line key={step} x1={pad} x2={width - pad} y1={y} y2={y} />; })}
    {PLAN.months.map((row, index) => { const value = row[2] ?? row[1]; const h = value / max * (height - pad * 2); const x = pad + slot * index + slot * .2; return <g key={row[0]}><rect className={row[2] == null ? 'forecast' : 'actual'} x={x} y={height - pad - h} width={slot * .6} height={h} rx="4"/><text x={x + slot * .3} y={height - 14}>{row[0]}</text></g>; })}
    <polyline className="plan" points={planPoints}/>
  </svg></div>;
}

export default function FleetCapacityPaf() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [raw, setRaw] = useState({ tickets: [], trips: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [filters, setFilters] = useState({ from: '2026-01-01', to: todayKey(), supplier: '', plate: '' });

  const load = useCallback(async () => {
    const token = getCqoSessionToken();
    if (!token) { setError('Sessão do dashboard não configurada.'); setLoading(false); return; }
    setLoading(true); setError('');
    const controller = new AbortController();
    try {
      const result = await fetchAgroDataset('/api/agro/scale-tickets', {
        sessionToken: token,
        dateFrom: '2026-01-01',
        dateTo: todayKey(),
        params: { status: 'closed', products: PRODUCTS.join(',') },
        signal: controller.signal,
        limit: 200,
        keyForRecord: (ticket) => ticket.sourceTicketId || ticket.ticketCode,
      });
      setRaw(consolidate(result.records));
      setUpdatedAt(result.generatedAt || new Date().toISOString());
    } catch (loadError) {
      setError(String(loadError?.message || 'Não foi possível consultar a balança.'));
    } finally { setLoading(false); }
    return () => controller.abort();
  }, []);

  // The async loader synchronizes this page with the authenticated AGRO API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const analysis = useMemo(() => capacityAnalysis(raw.trips, todayKey()), [raw.trips]);
  const scopedTrips = useMemo(() => filterTrips(raw.trips, filters), [raw.trips, filters]);
  const summary = useMemo(() => summarize(scopedTrips), [scopedTrips]);
  const vehicles = useMemo(() => FLEET.map((vehicle) => {
    const rows = scopedTrips.filter((trip) => trip.plate === vehicle.plate);
    return { ...vehicle, ...summarize(rows) };
  }).sort((a, b) => b.tonnes - a.tonnes), [scopedTrips]);
  const suppliers = useMemo(() => [...new Set(FLEET.map((item) => item.supplier))].map((supplier) => {
    const rows = scopedTrips.filter((trip) => trip.supplier === supplier);
    return { supplier, ...summarize(rows) };
  }).sort((a, b) => b.tonnes - a.tonnes), [scopedTrips]);
  const series = useMemo(() => {
    const byMonth = daysInclusive(filters.from, filters.to) > 150;
    const buckets = new Map();
    scopedTrips.forEach((trip) => {
      const day = localDateKey(trip.enteredAt); const key = byMonth ? day.slice(0, 7) : day;
      buckets.set(key, (buckets.get(key) || 0) + trip.netWeightKg / 1000);
    });
    return [...buckets.entries()].sort().map(([key, value]) => ({ key, tonnes: value, label: byMonth ? key.slice(5) : key.slice(8) }));
  }, [scopedTrips, filters]);
  const scopedTickets = useMemo(() => raw.tickets.filter((ticket) => {
    const day = localDateKey(ticket.enteredAt);
    return day >= filters.from && day <= filters.to && (!filters.plate || ticket.plate === filters.plate)
      && (!filters.supplier || ticket.fleet.supplier === filters.supplier);
  }).sort((a, b) => String(b.enteredAt).localeCompare(String(a.enteredAt))).slice(0, 100), [raw.tickets, filters]);

  const annualPlan = PLAN.months.reduce((sum, row) => sum + row[1], 0);
  const actualYtd = PLAN.months.reduce((sum, row) => sum + (row[2] || 0), 0);
  const remainingPlan = PLAN.months.reduce((sum, row) => sum + (row[2] == null ? row[1] : 0), 0);
  const projectedClose = actualYtd + remainingPlan;

  return <div className="fleet-paf-page">
    <header className="fleet-paf-page-head">
      <div><span>INTELIGÊNCIA OPERACIONAL • CFF</span><h2>Análise de Capacidade da Frota PAF</h2><p>Evidências operacionais para avaliação gerencial do pedido de +1 veículo.</p></div>
      <div className={`fleet-paf-online ${error ? 'offline' : ''}`}><i></i><span><b>{error ? 'Dados indisponíveis' : loading ? 'Consultando SQL' : 'SQL online'}</b><small>{updatedAt ? `Atualizado ${dateBr(updatedAt, true)}` : 'Aguardando atualização'}</small></span></div>
    </header>

    <nav className="fleet-paf-tabs" aria-label="Visualizações da análise">
      {[['analysis', BarChart3, 'Análise do pedido'], ['operation', Truck, 'Operação da frota'], ['projection', TrendingUp, 'Projeção 2026']].map(([id, Icon, label]) => <button type="button" key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}><Icon size={16}/>{label}</button>)}
    </nav>

    {error && <div className="fleet-paf-error"><AlertTriangle size={18}/><span>{error} O site continua disponível, mas a consulta depende do computador da API, VPN, túnel e SQL.</span><button type="button" onClick={load}><RefreshCw size={15}/>Tentar novamente</button></div>}

    {activeTab === 'analysis' && <section className="fleet-paf-view">
      <article className="fleet-paf-hero">
        <div><span className="fleet-paf-badge"><Database size={13}/> ANÁLISE TÉCNICA INDEPENDENTE</span><small>AGOSTO DE 2026</small><h1>Avaliação do pedido de <em>+1 caminhão</em></h1><p>A solicitação operacional é confrontada com o volume real da balança, a produtividade da frota e a meta informada. A decisão final cabe à gestão.</p><div className="fleet-paf-evidence"><span><CheckCircle2/>Base real do SQL</span><span><Scale/>Premissas identificadas</span></div></div>
        <aside><small>CENÁRIO SOLICITADO</small><div className="fleet-paf-change"><span><b>7</b>atuais</span><i>→</i><span><b>8</b>com +1</span></div><hr/><small>CAPACIDADE DO CENÁRIO COMBINADO</small><strong>{tonnes(analysis.combined)}</strong><p>{percent(analysis.attainment)} da meta mensal</p><div className="fleet-paf-conditioned">Resultado condicionado a veículo, carga média e frequência</div></aside>
      </article>

      <div className="fleet-paf-key"><span><i className="observed"/><b>Observado</b> balança</span><span><i className="calculated"/><b>Calculado</b> fórmula</span><span><i className="assumption"/><b>Premissa</b> condição necessária</span></div>
      <div className="fleet-paf-metrics">
        <Metric label="Meta mensal analisada" value={tonnes(PLAN.targetMonth)} detail="Plano Safra • agosto" icon={CalendarDays}/>
        <Metric label="Contribuição estimada de +1" value={tonnes(analysis.contribution)} detail="mantida a produtividade de julho" icon={Truck} tone="orange"/>
        <Metric label="Cobertura estimada da lacuna" value={percent(analysis.coverage)} detail="atribuída ao veículo adicional" icon={BarChart3} tone="blue"/>
        <Metric label="Produtividade observada" value={tonnes(analysis.tonnesPerTruck)} detail="por veículo em julho" icon={Database} tone="green"/>
      </div>

      <div className="fleet-paf-grid main">
        <article className="fleet-paf-panel"><header><span>01</span><div><h3>Capacidade mensal comparada</h3><p>Fato observado versus cenários calculados</p></div></header><CapacityBars analysis={analysis}/><div className="fleet-paf-conclusion"><b>{analysis.margin >= 0 ? 'O cenário combinado supera a meta' : 'O cenário combinado não alcança a meta'}</b><p>{analysis.margin >= 0 ? `Margem calculada de ${tonnes(analysis.margin)}.` : `Lacuna calculada de ${tonnes(Math.abs(analysis.margin))}.`} O resultado não é produzido apenas pelo veículo.</p></div></article>
        <article className="fleet-paf-panel"><header><span>02</span><div><h3>Premissas do cenário</h3><p>Condições necessárias para o resultado</p></div></header><div className="fleet-paf-assumptions">
          <div><i>1</i><span><small>SOLICITAÇÃO</small><b>Adicionar 1 veículo</b><p>Passar de 7 para 8 caminhões acompanhados.</p></span><em>PREMISSA</em></div>
          <div><i>2</i><span><small>CARGA MÉDIA</small><b>{number.format(analysis.july.averageLoad)} → {number.format(analysis.year.averageLoad)} t</b><p>Recuperação calculada de {percent(analysis.loadRecovery)}.</p></span><em>ACOMPANHAR</em></div>
          <div><i>3</i><span><small>FREQUÊNCIA</small><b>{one.format(analysis.tripsPerTruck)} viagens/veículo</b><p>Manter a frequência observada em julho.</p></span><em>ACOMPANHAR</em></div>
        </div></article>
      </div>

      <div className="fleet-paf-grid lower">
        <article className="fleet-paf-panel"><header><span>03</span><div><h3>Ritmo do mês analisado</h3><p>Realizado até {dateBr(`${analysis.augustTo}T12:00:00-03:00`)}</p></div></header><div className="fleet-paf-pace"><div className="fleet-paf-ring" style={{ '--progress': `${Math.min(100, analysis.august.tonnes / PLAN.targetMonth * 100) * 3.6}deg` }}><span><b>{percent(analysis.august.tonnes / PLAN.targetMonth * 100)}</b><small>da meta</small></span></div><div className="fleet-paf-pace-values"><span><small>Realizado</small><b>{tonnes(analysis.august.tonnes)}</b></span><span><small>Projeção no ritmo</small><b>{tonnes(analysis.paceProjection)}</b></span><span><small>Diferença para meta</small><b>{tonnes(analysis.projectedGap)}</b></span><span><small>Ritmo necessário</small><b>{number.format(analysis.requiredDaily)} t/dia</b></span></div></div></article>
        <article className="fleet-paf-panel"><header><span>04</span><div><h3>Qualidade e limites da base</h3><p>Plano confrontado com a balança</p></div></header><div className="fleet-paf-quality"><strong>{percent(analysis.reconciliation)}</strong><p>Aderência entre o plano de julho ({tonnes(PLAN.referenceMonth)}) e o SQL ({tonnes(analysis.july.tonnes)}).</p><ul><li>✓ Peso líquido real</li><li>✓ Viagens consolidadas por placa + entrada</li><li>! Projeção não inclui custo financeiro homologado</li></ul></div></article>
      </div>
    </section>}

    {activeTab === 'operation' && <section className="fleet-paf-view">
      <div className="fleet-paf-filters"><label>Data inicial<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })}/></label><label>Data final<input type="date" value={filters.to} max={todayKey()} onChange={(event) => setFilters({ ...filters, to: event.target.value })}/></label><label>Fornecedor<select value={filters.supplier} onChange={(event) => setFilters({ ...filters, supplier: event.target.value, plate: '' })}><option value="">Todos</option>{[...new Set(FLEET.map((item) => item.supplier))].map((item) => <option key={item}>{item}</option>)}</select></label><label>Placa<select value={filters.plate} onChange={(event) => setFilters({ ...filters, plate: event.target.value })}><option value="">Todas</option>{FLEET.filter((item) => !filters.supplier || item.supplier === filters.supplier).map((item) => <option key={item.plate}>{item.plate}</option>)}</select></label></div>
      <div className="fleet-paf-operation-kpis"><Metric label="Volume de CFF" value={tonnes(summary.tonnes)} detail="peso líquido" icon={Scale}/><Metric label="Viagens consolidadas" value={integer.format(summary.trips)} detail={`${integer.format(summary.tickets)} tickets`} icon={Truck}/><Metric label="Carga média" value={tonnes(summary.averageLoad)} detail="por viagem" icon={BarChart3}/><Metric label="Frota ativa" value={integer.format(summary.activeVehicles)} detail={`de ${FLEET.length} placas`} icon={Database}/></div>
      <div className="fleet-paf-grid main"><article className="fleet-paf-panel"><header><span>01</span><div><h3>Evolução do volume</h3><p>Toneladas no período selecionado</p></div></header>{series.length ? <TrendChart rows={series}/> : <div className="fleet-paf-empty">Sem entradas no período.</div>}</article><article className="fleet-paf-panel"><header><span>02</span><div><h3>Leitura dos dados</h3><p>Sinais do período</p></div></header><div className="fleet-paf-insights"><p><b>Líder:</b> {vehicles[0]?.trips ? `${vehicles[0].plate} • ${tonnes(vehicles[0].tonnes)}` : 'sem entregas'}</p><p><b>Inativos:</b> {vehicles.filter((item) => !item.trips).length} veículo(s)</p><p><b>Última entrada:</b> {dateBr(summary.lastEntryAt, true)}</p></div></article></div>
      <div className="fleet-paf-grid lower"><article className="fleet-paf-panel"><header><span>03</span><div><h3>Ranking por caminhão</h3><p>Viagens físicas consolidadas</p></div></header><div className="fleet-paf-table-wrap"><table><thead><tr><th>#</th><th>Placa</th><th>Fornecedor</th><th>Toneladas</th><th>Viagens</th><th>Carga média</th></tr></thead><tbody>{vehicles.map((item, index) => <tr key={item.plate} onClick={() => setFilters({ ...filters, plate: item.plate })}><td>{item.trips ? index + 1 : '—'}</td><td><b>{item.plate}</b></td><td>{item.supplier}</td><td>{number.format(item.tonnes)}</td><td>{integer.format(item.trips)}</td><td>{item.trips ? number.format(item.averageLoad) : '—'}</td></tr>)}</tbody></table></div></article><article className="fleet-paf-panel"><header><span>04</span><div><h3>Volume por fornecedor</h3><p>Composição do período</p></div></header><div className="fleet-paf-suppliers">{suppliers.map((item) => <div key={item.supplier}><span><b>{item.supplier}</b><em>{tonnes(item.tonnes)}</em></span><i><b style={{ width: `${summary.tonnes ? item.tonnes / summary.tonnes * 100 : 0}%` }}/></i><small>{percent(summary.tonnes ? item.tonnes / summary.tonnes * 100 : 0)} • {integer.format(item.trips)} viagens</small></div>)}</div></article></div>
      <article className="fleet-paf-panel"><header><span>05</span><div><h3>Tickets recentes da balança</h3><p>Até 100 registros do período filtrado</p></div></header><div className="fleet-paf-table-wrap"><table><thead><tr><th>Entrada</th><th>Ticket</th><th>Placa</th><th>Fornecedor</th><th>Motorista</th><th>Origem</th><th>Peso t</th></tr></thead><tbody>{scopedTickets.map((ticket) => <tr key={ticket.sourceTicketId}><td>{dateBr(ticket.enteredAt, true)}</td><td>{ticket.ticketCode}</td><td><b>{ticket.plate}</b></td><td>{ticket.fleet.supplier}</td><td>{ticket.driverName || '—'}</td><td>{ticket.items?.[0]?.origin || '—'}</td><td>{number.format(Number(ticket.netWeightKg) / 1000)}</td></tr>)}</tbody></table></div></article>
    </section>}

    {activeTab === 'projection' && <section className="fleet-paf-view">
      <article className="fleet-paf-projection-hero"><div><span><FileSpreadsheet size={14}/> PLANO SAFRA • COMPRA DE CFF</span><small>CURVA ANUAL 2026</small><h1>Plano, realizado e <em>projeção de fechamento</em></h1><p>Realizado registrado até julho somado ao plano de agosto a dezembro.</p></div><aside><small>FECHAMENTO PROJETADO</small><strong>{tonnes(projectedClose)}</strong><p>{signed((projectedClose / annualPlan - 1) * 100, '%')} sobre a meta anual</p></aside></article>
      <div className="fleet-paf-metrics"><Metric label="Meta anual" value={tonnes(annualPlan)} detail="Plano Safra" icon={CalendarDays}/><Metric label="Realizado jan–jul" value={tonnes(actualYtd)} detail={percent(actualYtd / PLAN.months.slice(0, 7).reduce((sum, row) => sum + row[1], 0) * 100) + ' do plano'} icon={Database} tone="green"/><Metric label="Plano restante" value={tonnes(remainingPlan)} detail="agosto a dezembro" icon={TrendingUp}/><Metric label="Variação projetada" value={signed(projectedClose - annualPlan)} detail="fechamento híbrido" icon={BarChart3} tone="orange"/></div>
      <div className="fleet-paf-grid main"><article className="fleet-paf-panel"><header><span>01</span><div><h3>Curva mensal de CFF</h3><p>Linha: plano • barras: realizado/projeção</p></div></header><ProjectionChart/></article><article className="fleet-paf-panel"><header><span>02</span><div><h3>Leitura gerencial</h3><p>Pontos de atenção</p></div></header><div className="fleet-paf-insights"><p><b>Acumulado jan–jul:</b> {signed(actualYtd - 20207)}</p><p><b>Pico planejado:</b> novembro • 11.625,00 t</p><p><b>Escalada agosto → novembro:</b> +154,7%</p><p><b>Concentração dos 2 maiores:</b> 67,2%</p></div></article></div>
      <div className="fleet-paf-grid lower"><article className="fleet-paf-panel"><header><span>03</span><div><h3>Plano mensal detalhado</h3><p>Realizado e projeção</p></div></header><div className="fleet-paf-table-wrap"><table><thead><tr><th>Mês</th><th>Status</th><th>Plano t</th><th>Realizado / projeção</th><th>Variação</th></tr></thead><tbody>{PLAN.months.map((row) => <tr key={row[0]}><td><b>{row[0]}/2026</b></td><td><span className={`fleet-paf-status ${row[2] == null ? 'forecast' : 'actual'}`}>{row[2] == null ? 'Projeção' : 'Realizado'}</span></td><td>{number.format(row[1])}</td><td>{number.format(row[2] ?? row[1])}</td><td>{row[2] == null ? '—' : signed(row[2] - row[1])}</td></tr>)}</tbody></table></div></article><article className="fleet-paf-panel"><header><span>04</span><div><h3>Projeção por fornecedor</h3><p>Fechamento híbrido</p></div></header><div className="fleet-paf-table-wrap"><table><thead><tr><th>Fornecedor</th><th>Plano</th><th>Realizado</th><th>Restante</th><th>Fechamento</th></tr></thead><tbody>{PLAN.suppliers.map((row) => <tr key={row[0]}><td><b>{row[0]}</b></td><td>{number.format(row[1])}</td><td>{number.format(row[2])}</td><td>{number.format(row[3])}</td><td>{number.format(row[2] + row[3])}</td></tr>)}</tbody></table></div></article></div>
    </section>}

    <footer className="fleet-paf-footer"><span>Fontes: AGRO SQL • Plano Safra CFF 2026</span><span>Análise técnica independente • acesso autenticado</span><b>Desenvolvido por Vinicius Dev.</b></footer>
  </div>;
}
