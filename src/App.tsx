import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  FileSpreadsheet,
  Filter,
  Search,
  XCircle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LabelProps, RenderableText } from 'recharts'
import './App.css'

type Corte = '01-18/06' | '19-30/06'
type CorteFilter = Corte | 'todos'
type ChartMode = 'consolidado' | 'semanal'
type WeekWindow = {
  endDay: number
  label: string
  note?: string
  shortLabel: string
  startDay: number
}
type IndicatorKey =
  | 'Verde'
  | 'Maduro'
  | 'Passado'
  | 'Avermelhado'
  | 'Talo_Comprido'
  | 'Bucha'
type RawRecord = Record<string, unknown>
type NullableIndicators = Record<IndicatorKey, number | null>
type WeightedIndicators = Record<IndicatorKey, number>

type BiRow = {
  id: number
  data: string
  produtor: string
  transportadora: string
  peso: number
  corte: Corte
  indicators: WeightedIndicators
}

type SummaryRow = {
  produtor: string
  corte: Corte
  peso: number | null
  nAnalises: number | null
  indicators: NullableIndicators
}

type AggregateRow = {
  produtor: string
  corte: Corte
  peso: number
  nAnalises: number
  indicators: NullableIndicators
}

type ParseResult<T> = {
  rows: T[]
  warnings: string[]
}

type ConferenceResult = {
  status: 'empty' | 'pending' | 'ok' | 'divergent'
  label: string
  detail: string
  mismatches: string[]
}

const CORTES: readonly Corte[] = ['01-18/06', '19-30/06']
const EXCEL_PERCENT_DECIMALS = 2
const WEEK_WINDOWS: readonly WeekWindow[] = [
  { label: '01-07/06', shortLabel: '01-07', startDay: 1, endDay: 7 },
  { label: '08-14/06', shortLabel: '08-14', startDay: 8, endDay: 14 },
  {
    label: '15-18/06',
    shortLabel: '15-18 VNA',
    startDay: 15,
    endDay: 18,
    note: 'fecha VNA',
  },
  {
    label: '19-21/06',
    shortLabel: '19-21 externa',
    startDay: 19,
    endDay: 21,
    note: 'inicia externa',
  },
  { label: '22-28/06', shortLabel: '22-28', startDay: 22, endDay: 28 },
  { label: '29-30/06', shortLabel: '29-30', startDay: 29, endDay: 30 },
]

const INDICATORS: readonly { key: IndicatorKey; label: string }[] = [
  { key: 'Verde', label: 'Verde' },
  { key: 'Maduro', label: 'Maduro' },
  { key: 'Passado', label: 'Passado' },
  { key: 'Avermelhado', label: 'Avermelhado' },
  { key: 'Talo_Comprido', label: 'Talo Comprido' },
  { key: 'Bucha', label: 'Bucha' },
]

const INDICATOR_TARGETS: Record<IndicatorKey, number> = {
  Verde: 1,
  Maduro: 85,
  Passado: 10,
  Avermelhado: 4,
  Talo_Comprido: 3,
  Bucha: 0,
}

const INDICATOR_KEYS = INDICATORS.map(({ key }) => key)
const PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#4d7c0f',
  '#be123c',
  '#0f766e',
  '#9333ea',
]

const OWNED_PRODUCERS = [
  'BOIBA/PALMARES',
  'CUPU/PALMARES',
  'FE EM DEUS',
  'VILA NOVA',
  'NOVA CONCEICAO',
]

const OWNERSHIP_COLORS = {
  owned: '#0f766e',
  third: '#d97706',
}

const EMPTY_INDICATORS = Object.fromEntries(
  INDICATOR_KEYS.map((key) => [key, null]),
) as NullableIndicators

function App() {
  const [biRows, setBiRows] = useState<BiRow[]>([])
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [selectedProducers, setSelectedProducers] = useState<string[]>([])
  const [selectedOwnProducers, setSelectedOwnProducers] = useState<string[]>([
    ...OWNED_PRODUCERS,
  ])
  const [showProducerCharts, setShowProducerCharts] = useState(false)
  const [producerSearch, setProducerSearch] = useState('')
  const [corteFilter, setCorteFilter] = useState<CorteFilter>('todos')
  const [generalMode, setGeneralMode] = useState<ChartMode>('consolidado')
  const [ownershipMode, setOwnershipMode] = useState<ChartMode>('consolidado')
  const [loadMessages, setLoadMessages] = useState<string[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [hasSelectionInteracted, setHasSelectionInteracted] = useState(false)
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true)

  useEffect(() => {
    let isCurrent = true

    async function loadDefaultCsvs() {
      const messages: string[] = []
      const warnings: string[] = []

      const bi = await fetchCsv('/BI_Import.csv')
      if (bi.ok) {
        const parsed = parseBiRecords(parseCsvText(bi.text))
        if (isCurrent) {
          setBiRows(parsed.rows)
        }
        warnings.push(...parsed.warnings)
      } else {
        messages.push('BI_Import.csv não encontrado em public/.')
      }

      const summary = await fetchCsv('/Resumo_Prod_Corte.csv')
      if (summary.ok) {
        const parsed = parseSummaryRecords(parseCsvText(summary.text))
        if (isCurrent) {
          setSummaryRows(parsed.rows)
        }
        warnings.push(...parsed.warnings)
      } else {
        messages.push('Resumo_Prod_Corte.csv não encontrado em public/.')
      }

      if (isCurrent) {
        setLoadMessages(messages)
        setParseWarnings(warnings)
        setIsLoadingDefaults(false)
      }
    }

    loadDefaultCsvs()

    return () => {
      isCurrent = false
    }
  }, [])

  const producers = useMemo(
    () =>
      Array.from(new Set(biRows.map((row) => row.produtor))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [biRows],
  )

  useEffect(() => {
    if (producers.length > 0 && !hasSelectionInteracted) {
      setSelectedProducers(producers)
    }
  }, [hasSelectionInteracted, producers])

  const selectedProducerSet = useMemo(
    () => new Set(selectedProducers),
    [selectedProducers],
  )

  const activeCortes = useMemo(
    () => (corteFilter === 'todos' ? [...CORTES] : [corteFilter]),
    [corteFilter],
  )

  const aggregateMap = useMemo(() => buildAggregateMap(biRows), [biRows])
  const summaryMap = useMemo(() => buildSummaryMap(summaryRows), [summaryRows])

  const tableRows = useMemo(() => {
    return producers.flatMap((produtor) =>
      activeCortes.map(
        (corte) =>
          aggregateMap.get(makeKey(produtor, corte)) ??
          emptyAggregate(produtor, corte),
      ),
    )
  }, [activeCortes, aggregateMap, producers])

  const selectedStats = useMemo(() => {
    return tableRows.reduce(
      (acc, row) => ({
        peso: acc.peso + row.peso,
        nAnalises: acc.nAnalises + row.nAnalises,
      }),
      { peso: 0, nAnalises: 0 },
    )
  }, [tableRows])

  const generalRows = useMemo(
    () => biRows.filter((row) => activeCortes.includes(row.corte)),
    [activeCortes, biRows],
  )

  const ownershipRows = useMemo(
    () => biRows.filter((row) => activeCortes.includes(row.corte)),
    [activeCortes, biRows],
  )

  const selectedOwnRows = useMemo(() => {
    const selectedOwnSet = new Set(selectedOwnProducers.map(canonical))
    return ownershipRows.filter((row) => selectedOwnSet.has(canonical(row.produtor)))
  }, [ownershipRows, selectedOwnProducers])

  const thirdPartyRows = useMemo(
    () => ownershipRows.filter((row) => !isOwnedProducer(row.produtor)),
    [ownershipRows],
  )

  const selectedOwnershipWeights = useMemo(
    () => [
      { label: 'Próprios', value: sumWeight(selectedOwnRows) },
      { label: 'Terceiros', value: sumWeight(thirdPartyRows) },
    ],
    [selectedOwnRows, thirdPartyRows],
  )

  const selectedOwnershipChartData = useMemo(() => {
    return buildDatedComparisonChartData(selectedOwnRows, thirdPartyRows)
  }, [selectedOwnRows, thirdPartyRows])

  const geralMap = useMemo(
    () => buildCorteAggregateMap(generalRows),
    [generalRows],
  )

  const geralChartData = useMemo(() => {
    return INDICATORS.map(({ key, label }) => ({
      indicador: label,
      antes: toExcelDisplayPercent(
        geralMap.get('01-18/06')?.indicators[key] ?? null,
      ),
      depois: toExcelDisplayPercent(
        geralMap.get('19-30/06')?.indicators[key] ?? null,
      ),
      meta: INDICATOR_TARGETS[key],
    }))
  }, [geralMap])

  const generalWeeklyCharts = useMemo(
    () =>
      buildWeeklyIndicatorCharts([
        {
          color: '#4d7c0f',
          id: 'geral',
          label: 'Geral',
          rows: generalRows,
        },
      ]),
    [generalRows],
  )

  const selectedOwnershipWeeklyCharts = useMemo(
    () =>
      buildWeeklyIndicatorCharts([
        {
          color: OWNERSHIP_COLORS.owned,
          id: 'proprios',
          label: 'Próprios',
          rows: selectedOwnRows,
        },
        {
          color: OWNERSHIP_COLORS.third,
          id: 'terceiros',
          label: 'Terceiros',
          rows: thirdPartyRows,
        },
      ]),
    [selectedOwnRows, thirdPartyRows],
  )

  const geralDomainMax = useMemo(() => {
    const values = geralChartData
      .flatMap((item) => [item.antes, item.depois, item.meta])
      .filter((value): value is number => typeof value === 'number')
    const maxValue = Math.max(0, ...values)
    return Math.min(100, Math.max(10, Math.ceil((maxValue * 1.12) / 5) * 5))
  }, [geralChartData])

  const producerQualityCharts = useMemo(() => {
    if (!showProducerCharts || selectedProducers.length > 12) return []
    return selectedProducers.map((produtor) => ({
      produtor,
      colorBefore: getSeriesColor(produtor, producers, '01-18/06'),
      colorAfter: getSeriesColor(produtor, producers, '19-30/06'),
      peso: activeCortes.reduce(
        (total, corte) =>
          total + (aggregateMap.get(makeKey(produtor, corte))?.peso ?? 0),
        0,
      ),
      data: INDICATORS.map(({ key, label }) => ({
        indicador: label,
        antes: toExcelDisplayPercent(
          aggregateMap.get(makeKey(produtor, '01-18/06'))?.indicators[key] ??
            null,
        ),
        depois: toExcelDisplayPercent(
          aggregateMap.get(makeKey(produtor, '19-30/06'))?.indicators[key] ??
            null,
        ),
      })),
    }))
  }, [
    activeCortes,
    aggregateMap,
    producers,
    selectedProducers,
    showProducerCharts,
  ])

  const producerComparisonSeries = useMemo(
    () =>
      selectedProducers.flatMap((produtor, producerIndex) =>
        activeCortes.map((corte) => ({
          color: getSeriesColor(produtor, producers, corte),
          corte,
          key: makeProducerSeriesKey(producerIndex, corte),
          name: `${produtor} • ${corte}`,
          produtor,
        })),
      ),
    [activeCortes, producers, selectedProducers],
  )

  const producerComparisonData = useMemo(
    () =>
      INDICATORS.map(({ key, label }) => {
        const point: Record<string, string | number | null> = {
          indicador: label,
        }

        selectedProducers.forEach((produtor, producerIndex) => {
          activeCortes.forEach((corte) => {
            point[makeProducerSeriesKey(producerIndex, corte)] =
              toExcelDisplayPercent(
                aggregateMap.get(makeKey(produtor, corte))?.indicators[key] ??
                  null,
              )
          })
        })

        return point
      }),
    [activeCortes, aggregateMap, selectedProducers],
  )

  const producerComparisonChartWidth = useMemo(
    () =>
      Math.max(
        900,
        selectedProducers.length * activeCortes.length * 10,
      ),
    [activeCortes.length, selectedProducers.length],
  )

  const producerComparisonBarSize = getProducerComparisonBarSize(
    selectedProducers.length,
    corteFilter,
  )

  const visibleProducers = useMemo(() => {
    const term = normalizeSearch(producerSearch)
    if (!term) return producers
    return producers.filter((producer) =>
      normalizeSearch(producer).includes(term),
    )
  }, [producerSearch, producers])

  const conference = useMemo(
    () => buildConference(tableRows, summaryMap, summaryRows.length),
    [summaryMap, summaryRows.length, tableRows],
  )

  const hasBiData = biRows.length > 0

  function toggleProducer(produtor: string) {
    setHasSelectionInteracted(true)
    setSelectedProducers((current) =>
      current.includes(produtor)
        ? current.filter((item) => item !== produtor)
        : [...current, produtor],
    )
  }

  function selectAllProducers() {
    setHasSelectionInteracted(true)
    setSelectedProducers(producers)
  }

  function clearProducers() {
    setHasSelectionInteracted(true)
    setSelectedProducers([])
  }

  function toggleOwnProducer(produtor: string) {
    setSelectedOwnProducers((current) =>
      current.includes(produtor)
        ? current.filter((item) => item !== produtor)
        : [...current, produtor],
    )
  }

  function selectAllOwnProducers() {
    setSelectedOwnProducers([...OWNED_PRODUCERS])
  }

  function clearOwnProducers() {
    setSelectedOwnProducers([])
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">VNA • qualidade de carga</span>
          <h1>Dashboard por produtor</h1>
          <p>Cortes 01-18/06 e 19-30/06, com média ponderada pelo peso.</p>
        </div>
        <div className="header-badge">
          <BarChart3 aria-hidden="true" size={20} />
          <span>{formatInteger(producers.length)} produtores</span>
        </div>
      </header>

      <section
        className="control-band general-filter-band"
        aria-label="Filtros gerais do dashboard"
      >
        <div className="filter-panel side-panel">
          <div className="panel-title-row">
            <div>
              <span className="section-kicker">Filtro</span>
              <h2>Corte</h2>
            </div>
            <Filter aria-hidden="true" size={20} />
          </div>
          <div className="segmented-control" role="group" aria-label="Corte">
            {(['todos', ...CORTES] as CorteFilter[]).map((value) => (
              <button
                className={corteFilter === value ? 'active' : ''}
                key={value}
                type="button"
                onClick={() => setCorteFilter(value)}
              >
                {value === 'todos' ? 'Todos' : value}
              </button>
            ))}
          </div>
        </div>
      </section>

      {(loadMessages.length > 0 || parseWarnings.length > 0) && (
        <section className="notice-stack" aria-label="Mensagens de leitura">
          {isLoadingDefaults && (
            <div className="notice neutral">Carregando arquivos locais...</div>
          )}
          {loadMessages.map((message) => (
            <div className="notice neutral" key={message}>
              {message}
            </div>
          ))}
          {parseWarnings.slice(0, 4).map((warning) => (
            <div className="notice warning" key={warning}>
              <AlertCircle aria-hidden="true" size={16} />
              {warning}
            </div>
          ))}
          {parseWarnings.length > 4 && (
            <div className="notice warning">
              <AlertCircle aria-hidden="true" size={16} />
              +{parseWarnings.length - 4} avisos de leitura.
            </div>
          )}
        </section>
      )}

      {!hasBiData && !isLoadingDefaults && (
        <section className="empty-state">
          <FileSpreadsheet aria-hidden="true" size={32} />
          <h2>Carregue o BI_Import.csv</h2>
          <p>O painel aparece assim que houver dados de carga.</p>
        </section>
      )}

      {hasBiData && (
        <>
          <section className="metric-grid" aria-label="Resumo geral">
            <article className="metric-card">
              <span>Peso Total (t)</span>
              <strong>{formatWeight(selectedStats.peso)}</strong>
            </article>
            <article className="metric-card">
              <span>Nº de Análises</span>
              <strong>{formatInteger(selectedStats.nAnalises)}</strong>
            </article>
          </section>

          <section className="chart-panel">
            <div className="chart-title-row">
              <div>
                <span className="section-kicker">A</span>
                <h2>Qualidade geral — cortes consolidados</h2>
              </div>
              <div className="title-actions">
                <ModeToggle value={generalMode} onChange={setGeneralMode} />
                <ChartTonnage items={[{ label: 'Total', value: selectedStats.peso }]} />
              </div>
            </div>
            {generalMode === 'semanal' ? (
              <WeeklyIndicatorGrid charts={generalWeeklyCharts} />
            ) : (
              <div className="chart-scroll">
                <div className="chart-frame general-chart-frame">
                  <ResponsiveContainer height={430} width="100%">
                    <BarChart
                      barCategoryGap="26%"
                      barGap={8}
                      data={geralChartData}
                      margin={{ top: 34, right: 22, bottom: 12, left: 12 }}
                    >
                      <CartesianGrid stroke="#dde3ec" strokeDasharray="4 4" />
                      <XAxis
                        dataKey="indicador"
                        interval={0}
                        tick={{ fill: '#475569', fontSize: 12 }}
                      />
                      <YAxis
                        domain={[0, geralDomainMax]}
                        tick={{ fill: '#475569', fontSize: 12 }}
                        tickFormatter={(value) => formatPercent(Number(value))}
                        width={72}
                      />
                      <Tooltip content={<PercentTooltip />} cursor={false} />
                      <Legend
                        align="center"
                        content={() => (
                          <PeriodLegend
                            corteFilter={corteFilter}
                            groups={[
                              {
                                label: 'Geral',
                                beforeColor: '#9fbd7e',
                                afterColor: '#4d7c0f',
                              },
                              {
                                label: 'Meta',
                                targetColor: '#111827',
                              },
                            ]}
                          />
                        )}
                        wrapperStyle={{ paddingTop: 10 }}
                      />
                      {(corteFilter === 'todos' || corteFilter === '01-18/06') && (
                        <Bar
                          dataKey="antes"
                          fill="#9fbd7e"
                          isAnimationActive={false}
                          maxBarSize={52}
                          name="Geral • 01-18/06"
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList
                            dataKey="antes"
                            fill="#0f172a"
                            fontSize={11}
                            formatter={labelPercent}
                            position="top"
                          />
                        </Bar>
                      )}
                      {(corteFilter === 'todos' || corteFilter === '19-30/06') && (
                        <Bar
                          dataKey="depois"
                          fill="#4d7c0f"
                          isAnimationActive={false}
                          maxBarSize={52}
                          name="Geral • 19-30/06"
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList
                            dataKey="depois"
                            fill="#0f172a"
                            fontSize={11}
                            formatter={labelPercent}
                            position="top"
                          />
                        </Bar>
                      )}
                      <Bar
                        dataKey="meta"
                        fill="#111827"
                        isAnimationActive={false}
                        maxBarSize={8}
                        name="Meta"
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          content={renderTinyTopPercentLabel}
                          dataKey="meta"
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          <section className="chart-panel">
            <div className="chart-title-row">
              <div>
                <span className="section-kicker">B</span>
                <h2>Próprios x Terceiros</h2>
              </div>
              <div className="title-actions">
                <ModeToggle value={ownershipMode} onChange={setOwnershipMode} />
                <span className="count-pill">
                  {formatInteger(selectedOwnProducers.length)} de 5 próprios
                </span>
                <ChartTonnage items={selectedOwnershipWeights} />
              </div>
            </div>

            <div className="ownership-picker" aria-label="Escolher próprios">
              <div className="button-row compact-buttons">
                <button type="button" onClick={selectAllOwnProducers}>
                  <CheckSquare aria-hidden="true" size={17} />
                  Marcar 5
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={clearOwnProducers}
                >
                  <XCircle aria-hidden="true" size={17} />
                  Limpar
                </button>
              </div>
              <div className="own-producer-options">
                {OWNED_PRODUCERS.map((produtor) => (
                  <label className="own-producer-option" key={produtor}>
                    <input
                      checked={selectedOwnProducers.includes(produtor)}
                      type="checkbox"
                      onChange={() => toggleOwnProducer(produtor)}
                    />
                    <span>{produtor}</span>
                  </label>
                ))}
              </div>
            </div>
            {ownershipMode === 'semanal' ? (
              <WeeklyIndicatorGrid charts={selectedOwnershipWeeklyCharts} />
            ) : (
              <OwnershipChart
                data={selectedOwnershipChartData}
                ownedName="Próprios"
                thirdName="Terceiros"
                corteFilter={corteFilter}
              />
            )}
          </section>

          <section className="chart-panel">
            <div className="chart-title-row">
              <div>
                <span className="section-kicker">C</span>
                <h2>Qualidade por Produtor — 6 indicadores</h2>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => setShowProducerCharts((current) => !current)}
              >
                <BarChart3 aria-hidden="true" size={17} />
                {showProducerCharts ? 'Ocultar detalhes' : 'Mostrar detalhes'}
              </button>
            </div>
            <div className="producer-detail-filter">
              <div className="panel-title-row">
                <div>
                  <span className="section-kicker">Filtro deste gráfico</span>
                  <h3>Produtor</h3>
                </div>
                <span className="count-pill">
                  {formatInteger(selectedProducers.length)} selecionados
                </span>
              </div>

              <label className="search-field">
                <Search aria-hidden="true" size={18} />
                <input
                  type="search"
                  value={producerSearch}
                  onChange={(event) => setProducerSearch(event.target.value)}
                  placeholder="Buscar produtor"
                />
              </label>

              <div className="button-row">
                <button type="button" onClick={selectAllProducers}>
                  <CheckSquare aria-hidden="true" size={17} />
                  Selecionar todos
                </button>
                <button type="button" className="ghost" onClick={clearProducers}>
                  <XCircle aria-hidden="true" size={17} />
                  Limpar
                </button>
              </div>

              <div className="producer-list">
                {visibleProducers.map((produtor) => (
                  <label className="producer-option" key={produtor}>
                    <input
                      checked={selectedProducerSet.has(produtor)}
                      type="checkbox"
                      onChange={() => toggleProducer(produtor)}
                    />
                    <span
                      className="producer-swatch"
                      style={{ background: getBaseColor(produtor, producers) }}
                    />
                    <span>{produtor}</span>
                  </label>
                ))}
                {visibleProducers.length === 0 && (
                  <div className="empty-inline">Nenhum produtor encontrado.</div>
                )}
              </div>
            </div>
            <div className="compact-producer-block">
              <div className="compact-producer-header">
                <div>
                  <span className="section-kicker">Comparação</span>
                  <h3>Produtores selecionados — 6 indicadores</h3>
                </div>
              </div>
              {selectedProducers.length === 0 ? (
                <div className="detail-placeholder compact-placeholder">
                  Selecione ao menos um produtor para comparar os indicadores.
                </div>
              ) : (
                <>
                  <ProducerComparisonLegend
                    corteFilter={corteFilter}
                    producers={selectedProducers}
                    producerUniverse={producers}
                  />
                  <div className="chart-scroll">
                    <div
                      className="chart-frame producer-comparison-chart-frame"
                      style={{ minWidth: producerComparisonChartWidth }}
                    >
                      <ResponsiveContainer height={390} width="100%">
                        <BarChart
                          barCategoryGap={
                            selectedProducers.length > 20 ? '8%' : '20%'
                          }
                          barGap={1}
                          data={producerComparisonData}
                          margin={{ top: 24, right: 20, bottom: 12, left: 10 }}
                        >
                          <CartesianGrid stroke="#dde3ec" strokeDasharray="4 4" />
                          <XAxis
                            dataKey="indicador"
                            interval={0}
                            tick={{ fill: '#475569', fontSize: 12 }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fill: '#475569', fontSize: 11 }}
                            tickFormatter={(value) => formatPercent(Number(value))}
                            width={68}
                          />
                          <Tooltip content={<PercentTooltip />} cursor={false} />
                          {producerComparisonSeries.map((series) => (
                            <Bar
                              dataKey={series.key}
                              fill={series.color}
                              isAnimationActive={false}
                              key={series.key}
                              maxBarSize={producerComparisonBarSize}
                              name={series.name}
                              radius={[3, 3, 0, 0]}
                            >
                              {producerComparisonSeries.length <= 8 && (
                                <LabelList
                                  content={renderTinyTopPercentLabel}
                                  dataKey={series.key}
                                />
                              )}
                            </Bar>
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
            {!showProducerCharts && (
              <div className="detail-placeholder">
                Detalhes por produtor ficam fechados para manter o painel rápido.
              </div>
            )}
            {showProducerCharts && selectedProducers.length === 0 && (
              <div className="detail-placeholder">
                Selecione ao menos um produtor para abrir os gráficos detalhados.
              </div>
            )}
            {showProducerCharts && selectedProducers.length > 12 && (
              <div className="detail-placeholder">
                Selecione até 12 produtores para abrir os gráficos detalhados.
              </div>
            )}
            {producerQualityCharts.length > 0 && (
              <div className="producer-chart-grid">
                {producerQualityCharts.map((chart) => (
                  <article className="producer-mini-chart" key={chart.produtor}>
                    <div className="producer-mini-title">
                      <div className="producer-mini-heading">
                        <span
                          className="producer-swatch"
                          style={{
                            background: getBaseColor(chart.produtor, producers),
                          }}
                        />
                        <h3>{chart.produtor}</h3>
                      </div>
                      <ChartTonnage compact items={[{ value: chart.peso }]} />
                    </div>
                    <ResponsiveContainer height={300} width="100%">
                      <BarChart
                        barCategoryGap="22%"
                        barGap={8}
                        data={chart.data}
                        margin={{ top: 28, right: 14, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid stroke="#dde3ec" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="indicador"
                          interval={0}
                          tick={{ fill: '#475569', fontSize: 11 }}
                        />
                        <YAxis
                          allowDecimals
                          domain={[0, 100]}
                          tick={{ fill: '#475569', fontSize: 11 }}
                          tickFormatter={(value) => formatPercent(Number(value))}
                          width={68}
                        />
                        <Tooltip content={<PercentTooltip />} cursor={false} />
                        <Legend
                          align="center"
                          content={() => (
                            <PeriodLegend
                              corteFilter={corteFilter}
                              groups={[
                                {
                                  beforeColor: chart.colorBefore,
                                  afterColor: chart.colorAfter,
                                },
                              ]}
                            />
                          )}
                          wrapperStyle={{ paddingTop: 8 }}
                        />
                        {(corteFilter === 'todos' ||
                          corteFilter === '01-18/06') && (
                          <Bar
                            dataKey="antes"
                            fill={chart.colorBefore}
                            isAnimationActive={false}
                            maxBarSize={34}
                            name="01-18/06"
                            radius={[4, 4, 0, 0]}
                          >
                            <LabelList
                              dataKey="antes"
                              fill="#0f172a"
                              fontSize={10}
                              formatter={labelPercent}
                              position="top"
                            />
                          </Bar>
                        )}
                        {(corteFilter === 'todos' ||
                          corteFilter === '19-30/06') && (
                          <Bar
                            dataKey="depois"
                            fill={chart.colorAfter}
                            isAnimationActive={false}
                            maxBarSize={34}
                            name="19-30/06"
                            radius={[4, 4, 0, 0]}
                          >
                            <LabelList
                              dataKey="depois"
                              fill="#0f172a"
                              fontSize={10}
                              formatter={labelPercent}
                              position="top"
                            />
                          </Bar>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="table-panel">
            <div className="chart-title-row">
              <div>
                <span className="section-kicker">Tabela</span>
                <h2>Resumo por Produtor e Corte</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produtor</th>
                    <th>Corte</th>
                    <th>Peso (t)</th>
                    <th>Nº análises</th>
                    {INDICATORS.map(({ key, label }) => (
                      <th key={key}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={makeKey(row.produtor, row.corte)}>
                      <td>
                        <span className="producer-cell">
                          <span
                            className="producer-swatch"
                            style={{
                              background: getBaseColor(row.produtor, producers),
                            }}
                          />
                          {row.produtor}
                        </span>
                      </td>
                      <td>{row.corte}</td>
                      <td>{row.nAnalises > 0 ? formatWeight(row.peso) : '—'}</td>
                      <td>
                        {row.nAnalises > 0 ? formatInteger(row.nAnalises) : '—'}
                      </td>
                      {INDICATORS.map(({ key }) => (
                        <td key={key}>{formatPercent(row.indicators[key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <footer className={`conference-footer ${conference.status}`}>
        <div>
          {conference.status === 'ok' && <CheckCircle2 aria-hidden="true" />}
          {conference.status === 'divergent' && <AlertCircle aria-hidden="true" />}
          {(conference.status === 'pending' || conference.status === 'empty') && (
            <FileSpreadsheet aria-hidden="true" />
          )}
          <strong>{conference.label}</strong>
          <span>{conference.detail}</span>
        </div>
        {conference.mismatches.length > 0 && (
          <details>
            <summary>Ver divergências</summary>
            <ul>
              {conference.mismatches.slice(0, 8).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </details>
        )}
      </footer>
    </main>
  )
}

async function fetchCsv(path: string) {
  try {
    const response = await fetch(path, { cache: 'no-store' })
    if (!response.ok) {
      return { ok: false as const, text: '' }
    }
    return { ok: true as const, text: await response.text() }
  } catch {
    return { ok: false as const, text: '' }
  }
}

function parseCsvText(text: string): RawRecord[] {
  const result = Papa.parse<RawRecord>(text, {
    delimiter: '',
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim().replace(/^\uFEFF/, ''),
  })
  return result.data.filter((row) =>
    Object.values(row).some((value) => String(value ?? '').trim() !== ''),
  )
}

function parseBiRecords(records: RawRecord[]): ParseResult<BiRow> {
  const rows: BiRow[] = []
  const warnings: string[] = []

  records.forEach((record, index) => {
    const produtor = stringValue(pick(record, ['Produtor']))
    if (!produtor) return

    const corte = parseCorte(pick(record, ['Corte']))
    const peso = parseNumber(pick(record, ['Peso_t', 'Peso t', 'Peso']))
    const indicators = parseIndicators(record, false)

    if (!corte || peso === null || indicators === null) {
      warnings.push(`BI_Import: linha ${index + 2} ignorada por dado inválido.`)
      return
    }

    rows.push({
      id: index,
      data: stringValue(pick(record, ['Data'])),
      produtor,
      transportadora: stringValue(pick(record, ['Transportadora'])),
      peso,
      corte,
      indicators,
    })
  })

  if (records.length > 0 && rows.length === 0) {
    warnings.push('BI_Import: nenhuma linha válida encontrada.')
  }

  return { rows, warnings: uniqueMessages(warnings) }
}

function parseSummaryRecords(records: RawRecord[]): ParseResult<SummaryRow> {
  const rows: SummaryRow[] = []
  const warnings: string[] = []

  records.forEach((record, index) => {
    const produtor = stringValue(pick(record, ['Produtor']))
    if (!produtor) return

    const corte = parseCorte(pick(record, ['Corte']))
    if (!corte) {
      warnings.push(
        `Resumo_Prod_Corte: linha ${index + 2} ignorada por corte inválido.`,
      )
      return
    }

    rows.push({
      produtor,
      corte,
      peso: parseNumber(pick(record, ['Peso_t', 'Peso t', 'Peso'])),
      nAnalises: parseNumber(pick(record, ['N_Analises', 'N Análises'])),
      indicators: parseIndicators(record, true) ?? { ...EMPTY_INDICATORS },
    })
  })

  return { rows, warnings: uniqueMessages(warnings) }
}

function parseIndicators(record: RawRecord, allowNull: false): WeightedIndicators | null
function parseIndicators(record: RawRecord, allowNull: true): NullableIndicators | null
function parseIndicators(
  record: RawRecord,
  allowNull: boolean,
): WeightedIndicators | NullableIndicators | null {
  const entries = INDICATOR_KEYS.map((key) => {
    const value = parseNumber(pick(record, [key, key.replace('_', ' ')]))
    if (value === null && !allowNull) return null
    return [key, value] as const
  })

  if (entries.some((entry) => entry === null)) return null
  return Object.fromEntries(
    entries as readonly (readonly [IndicatorKey, number | null])[],
  ) as WeightedIndicators | NullableIndicators
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return null

  const normalized = String(value)
    .trim()
    .replace('%', '')
    .replace(/\s/g, '')

  if (!normalized || normalized === '—' || normalized === '-') return null

  let numberText = normalized
  if (numberText.includes(',') && numberText.includes('.')) {
    numberText = numberText.replace(/\./g, '').replace(',', '.')
  } else if (numberText.includes(',')) {
    numberText = numberText.replace(',', '.')
  }

  const parsed = Number(numberText)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCorte(value: unknown): Corte | null {
  const text = stringValue(value)
  if (text.includes('01-18')) return '01-18/06'
  if (text.includes('19-30')) return '19-30/06'
  return null
}

function stringValue(value: unknown): string {
  if (value instanceof Date) return value.toLocaleDateString('pt-BR')
  return String(value ?? '').trim()
}

function pick(record: RawRecord, candidates: string[]) {
  const normalized = new Map(
    Object.entries(record).map(([key, value]) => [canonical(key), value]),
  )
  for (const candidate of candidates) {
    const value = normalized.get(canonical(candidate))
    if (value !== undefined) return value
  }
  return undefined
}

function canonical(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeSearch(value: string) {
  return canonical(value)
}

function buildAggregateMap(rows: BiRow[]) {
  type Accumulator = {
    produtor: string
    corte: Corte
    peso: number
    nAnalises: number
    weighted: WeightedIndicators
  }

  const map = new Map<string, Accumulator>()

  rows.forEach((row) => {
    const key = makeKey(row.produtor, row.corte)
    const current =
      map.get(key) ??
      ({
        produtor: row.produtor,
        corte: row.corte,
        peso: 0,
        nAnalises: 0,
        weighted: Object.fromEntries(
          INDICATOR_KEYS.map((indicator) => [indicator, 0]),
        ) as WeightedIndicators,
      } satisfies Accumulator)

    current.peso += row.peso
    current.nAnalises += 1
    INDICATOR_KEYS.forEach((indicator) => {
      current.weighted[indicator] += row.peso * row.indicators[indicator]
    })
    map.set(key, current)
  })

  return new Map(
    Array.from(map.entries()).map(([key, acc]) => [
      key,
      {
        produtor: acc.produtor,
        corte: acc.corte,
        peso: acc.peso,
        nAnalises: acc.nAnalises,
        indicators:
          acc.peso > 0
            ? (Object.fromEntries(
                INDICATOR_KEYS.map((indicator) => [
                  indicator,
                  acc.weighted[indicator] / acc.peso,
                ]),
              ) as NullableIndicators)
            : { ...EMPTY_INDICATORS },
      },
    ]),
  )
}

function buildCorteAggregateMap(rows: BiRow[]) {
  type Accumulator = {
    corte: Corte
    peso: number
    nAnalises: number
    weighted: WeightedIndicators
  }

  const map = new Map<Corte, Accumulator>()

  rows.forEach((row) => {
    const current =
      map.get(row.corte) ??
      ({
        corte: row.corte,
        peso: 0,
        nAnalises: 0,
        weighted: Object.fromEntries(
          INDICATOR_KEYS.map((indicator) => [indicator, 0]),
        ) as WeightedIndicators,
      } satisfies Accumulator)

    current.peso += row.peso
    current.nAnalises += 1
    INDICATOR_KEYS.forEach((indicator) => {
      current.weighted[indicator] += row.peso * row.indicators[indicator]
    })
    map.set(row.corte, current)
  })

  return new Map(
    Array.from(map.entries()).map(([corte, acc]) => [
      corte,
      {
        produtor: 'Seleção',
        corte: acc.corte,
        peso: acc.peso,
        nAnalises: acc.nAnalises,
        indicators:
          acc.peso > 0
            ? (Object.fromEntries(
                INDICATOR_KEYS.map((indicator) => [
                  indicator,
                  acc.weighted[indicator] / acc.peso,
                ]),
              ) as NullableIndicators)
            : { ...EMPTY_INDICATORS },
      },
    ]),
  )
}

function buildDatedComparisonChartData(ownedRows: BiRow[], thirdRows: BiRow[]) {
  const ownedMap = buildCorteAggregateMap(ownedRows)
  const thirdMap = buildCorteAggregateMap(thirdRows)
  return INDICATORS.map(({ key, label }) => ({
    indicador: label,
    propriosAntes: toExcelDisplayPercent(
      ownedMap.get('01-18/06')?.indicators[key] ?? null,
    ),
    propriosDepois: toExcelDisplayPercent(
      ownedMap.get('19-30/06')?.indicators[key] ?? null,
    ),
    terceirosAntes: toExcelDisplayPercent(
      thirdMap.get('01-18/06')?.indicators[key] ?? null,
    ),
    terceirosDepois: toExcelDisplayPercent(
      thirdMap.get('19-30/06')?.indicators[key] ?? null,
    ),
  }))
}

type WeeklySeriesConfig = {
  id: string
  label: string
  color: string
  rows: BiRow[]
}

type WeeklyIndicatorChart = {
  data: Record<string, string | number | null>[]
  key: IndicatorKey
  label: string
  series: Omit<WeeklySeriesConfig, 'rows'>[]
}

function buildWeeklyIndicatorCharts(
  seriesConfigs: WeeklySeriesConfig[],
): WeeklyIndicatorChart[] {
  return INDICATORS.map(({ key, label }) => {
    const data = WEEK_WINDOWS.map((window) => {
      const point: Record<string, string | number | null> = {
        periodo: window.shortLabel,
        periodoCompleto: window.label,
        nota: window.note ?? '',
      }

      seriesConfigs.forEach((series) => {
        const aggregate = aggregateRows(
          series.rows.filter((row) => rowMatchesWeek(row, window)),
        )
        point[series.id] = toExcelDisplayPercent(aggregate.indicators[key])
      })

      return point
    }).filter((point) =>
      seriesConfigs.some((series) => typeof point[series.id] === 'number'),
    )

    return {
      data,
      key,
      label,
      series: seriesConfigs.map(({ color, id, label: seriesLabel }) => ({
        color,
        id,
        label: seriesLabel,
      })),
    }
  })
}

function aggregateRows(rows: BiRow[]) {
  const weighted = Object.fromEntries(
    INDICATOR_KEYS.map((indicator) => [indicator, 0]),
  ) as WeightedIndicators
  const peso = rows.reduce((total, row) => {
    INDICATOR_KEYS.forEach((indicator) => {
      weighted[indicator] += row.peso * row.indicators[indicator]
    })
    return total + row.peso
  }, 0)

  return {
    indicators:
      peso > 0
        ? (Object.fromEntries(
            INDICATOR_KEYS.map((indicator) => [
              indicator,
              weighted[indicator] / peso,
            ]),
          ) as NullableIndicators)
        : { ...EMPTY_INDICATORS },
    nAnalises: rows.length,
    peso,
  }
}

function rowMatchesWeek(row: BiRow, window: WeekWindow) {
  const day = parseDayOfMonth(row.data)
  return day !== null && day >= window.startDay && day <= window.endDay
}

function parseDayOfMonth(value: string) {
  const match = value.match(/^(\d{1,2})\//)
  if (!match) return null
  const day = Number(match[1])
  return Number.isFinite(day) ? day : null
}

function isOwnedProducer(produtor: string) {
  return OWNED_PRODUCERS.some((owned) => canonical(owned) === canonical(produtor))
}

function buildSummaryMap(rows: SummaryRow[]) {
  return new Map(rows.map((row) => [makeKey(row.produtor, row.corte), row]))
}

function buildConference(
  tableRows: AggregateRow[],
  summaryMap: Map<string, SummaryRow>,
  summaryCount: number,
): ConferenceResult {
  if (tableRows.length === 0) {
    return {
      status: 'empty',
      label: 'Conferência: sem seleção',
      detail: 'Selecione produtor para comparar.',
      mismatches: [],
    }
  }

  if (summaryCount === 0) {
    return {
      status: 'pending',
      label: 'Conferência: aguardando resumo',
      detail: 'Resumo_Prod_Corte não carregado.',
      mismatches: [],
    }
  }

  const mismatches: string[] = []
  let checked = 0

  tableRows.forEach((row) => {
    if (row.nAnalises === 0) return
    const summary = summaryMap.get(makeKey(row.produtor, row.corte))
    if (!summary) {
      mismatches.push(`${row.produtor} ${row.corte}: linha ausente no resumo.`)
      return
    }

    checked += 1
    compareNumber(
      mismatches,
      row.produtor,
      row.corte,
      'Peso_t',
      row.peso,
      summary.peso,
      0.01,
    )
    compareNumber(
      mismatches,
      row.produtor,
      row.corte,
      'N_Analises',
      row.nAnalises,
      summary.nAnalises,
      0,
    )

    INDICATOR_KEYS.forEach((indicator) => {
      compareNumber(
        mismatches,
        row.produtor,
        row.corte,
        indicator,
        row.indicators[indicator],
        summary.indicators[indicator],
        0.01,
      )
    })
  })

  if (mismatches.length > 0) {
    return {
      status: 'divergent',
      label: 'Conferência: divergente',
      detail: `${mismatches.length} diferença(s) acima da tolerância.`,
      mismatches,
    }
  }

  return {
    status: 'ok',
    label: 'Conferência: OK',
    detail: `${formatInteger(checked)} combinação(ões) produtor/corte validadas.`,
    mismatches: [],
  }
}

function compareNumber(
  mismatches: string[],
  produtor: string,
  corte: Corte,
  field: string,
  calculated: number | null,
  expected: number | null,
  tolerance: number,
) {
  if (calculated === null || expected === null) {
    if (calculated !== expected) {
      mismatches.push(`${produtor} ${corte} ${field}: cálculo ${formatMaybeNumber(
        calculated,
      )}, resumo ${formatMaybeNumber(expected)}.`)
    }
    return
  }

  if (field !== 'Peso_t' && field !== 'N_Analises') {
    const calculatedDisplay = toExcelDisplayPercent(calculated)
    const expectedDisplay = toExcelDisplayPercent(expected)
    if (calculatedDisplay !== expectedDisplay) {
      mismatches.push(
        `${produtor} ${corte} ${field}: cálculo ${formatMaybePercent(
          calculated,
        )}, resumo ${formatMaybePercent(expected)}.`,
      )
    }
    return
  }

  if (Math.abs(calculated - expected) > tolerance + Number.EPSILON) {
    const formatter =
      field === 'Peso_t' || field === 'N_Analises'
        ? formatMaybeNumber
        : formatMaybePercent
    mismatches.push(
      `${produtor} ${corte} ${field}: cálculo ${formatter(
        calculated,
      )}, resumo ${formatter(expected)}.`,
    )
  }
}

function emptyAggregate(produtor: string, corte: Corte): AggregateRow {
  return {
    produtor,
    corte,
    peso: 0,
    nAnalises: 0,
    indicators: { ...EMPTY_INDICATORS },
  }
}

function sumWeight(rows: BiRow[]) {
  return rows.reduce((total, row) => total + row.peso, 0)
}

function makeKey(produtor: string, corte: Corte) {
  return `${produtor}|||${corte}`
}

function makeProducerSeriesKey(producerIndex: number, corte: Corte) {
  return `produtor_${producerIndex}_${corte === '01-18/06' ? 'antes' : 'depois'}`
}

function uniqueMessages(messages: string[]) {
  return Array.from(new Set(messages)).slice(0, 12)
}

function getBaseColor(produtor: string, producers: string[]) {
  const index = Math.max(0, producers.indexOf(produtor))
  return PALETTE[index % PALETTE.length]
}

function getSeriesColor(produtor: string, producers: string[], corte: Corte) {
  const base = getBaseColor(produtor, producers)
  return corte === '01-18/06' ? mixColor(base, '#ffffff', 0.45) : base
}

function getProducerComparisonBarSize(count: number, corteFilter: CorteFilter) {
  const divisor = corteFilter === 'todos' ? 2 : 1
  if (count <= 12) return Math.max(8, Math.floor(24 / divisor))
  if (count <= 24) return Math.max(5, Math.floor(16 / divisor))
  if (count <= 40) return Math.max(3, Math.floor(10 / divisor))
  return Math.max(2, Math.floor(7 / divisor))
}

function mixColor(hexA: string, hexB: string, weight: number) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const mix = (left: number, right: number) =>
    Math.round(left * (1 - weight) + right * weight)
  return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${formatFixedDecimal(toExcelDisplayPercent(value) ?? 0)}%`
}

function formatWeight(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatInteger(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function formatMaybeNumber(value: number | null) {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatMaybePercent(value: number | null) {
  return formatPercent(value)
}

function toExcelDisplayPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  const factor = 10 ** EXCEL_PERCENT_DECIMALS
  const normalized = Math.round((value + Number.EPSILON) * factor) / factor
  return Object.is(normalized, -0) ? 0 : normalized
}

function formatFixedDecimal(
  value: number,
  decimals = EXCEL_PERCENT_DECIMALS,
) {
  return value.toFixed(decimals).replace('.', ',')
}

function labelPercent(value: unknown) {
  return typeof value === 'number' ? formatPercent(value) : ''
}

type TonnageItem = {
  label?: string
  value: number
}

function ChartTonnage({
  items,
  compact = false,
}: {
  items: TonnageItem[]
  compact?: boolean
}) {
  return (
    <div className={`chart-tonnage ${compact ? 'compact' : ''}`}>
      {items.map((item, index) => (
        <span
          className="chart-tonnage-pill"
          key={`${item.label ?? 'peso'}-${index}`}
        >
          {item.label && <span className="chart-tonnage-label">{item.label}</span>}
          <span className="chart-tonnage-value">{formatWeight(item.value)} t</span>
        </span>
      ))}
    </div>
  )
}

type PercentLabelProps = {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: RenderableText
}

function renderTinyTopPercentLabel(props: LabelProps) {
  const labelProps = props as PercentLabelProps
  const x = chartNumber(labelProps.x)
  const y = chartNumber(labelProps.y)
  const width = chartNumber(labelProps.width)
  const rawValue = labelProps.value
  const value = typeof rawValue === 'number' ? rawValue : parseNumber(rawValue)

  if (x === null || y === null || width === null || value === null || value === 0) {
    return null
  }

  return (
    <text
      dominantBaseline="central"
      fill="#0f172a"
      fontSize={8}
      fontWeight={680}
      paintOrder="stroke fill"
      pointerEvents="none"
      stroke="#ffffff"
      strokeLinejoin="round"
      strokeWidth={1.2}
      textAnchor="middle"
      x={x + width / 2}
      y={Math.max(9, y - 5)}
    >
      {formatPercent(value)}
    </text>
  )
}

function chartNumber(value: number | string | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function PercentTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: {
    color?: string
    name?: string
    value?: number | string | null
  }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload
        .filter((item) => typeof item.value === 'number')
        .map((item) => (
          <div className="tooltip-row" key={`${item.name}-${item.value}`}>
            <span
              className="tooltip-dot"
              style={{ background: item.color ?? '#64748b' }}
            />
            <span>{item.name}</span>
            <b>{formatPercent(Number(item.value))}</b>
          </div>
        ))}
    </div>
  )
}

function ModeToggle({
  value,
  onChange,
}: {
  value: ChartMode
  onChange: (value: ChartMode) => void
}) {
  return (
    <div className="mode-toggle" role="group" aria-label="Modo do gráfico">
      <button
        className={value === 'consolidado' ? 'active' : ''}
        type="button"
        onClick={() => onChange('consolidado')}
      >
        Consolidado
      </button>
      <button
        className={value === 'semanal' ? 'active' : ''}
        type="button"
        onClick={() => onChange('semanal')}
      >
        Semanal
      </button>
    </div>
  )
}

function WeeklyIndicatorGrid({ charts }: { charts: WeeklyIndicatorChart[] }) {
  const series = charts[0]?.series ?? []

  return (
    <div className="weekly-block">
      <div className="weekly-note">
        <span>Semanas: 01-07, 08-14, 22-28 e 29-30.</span>
        <strong>Virada separada: 15-18 fecha o período 01-18/06; 19-21 inicia o 19-30/06.</strong>
      </div>
      <div className="weekly-series-legend">
        {series.map((item) => (
          <span className="weekly-series-item" key={item.id}>
            <span
              className="legend-dot"
              style={{ background: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="weekly-chart-grid">
        {charts.map((chart) => (
          <article className="weekly-mini-chart" key={chart.key}>
            <h3>{chart.label}</h3>
            <ResponsiveContainer height={190} width="100%">
              <LineChart
                data={chart.data}
                margin={{ top: 14, right: 14, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="#dde3ec" strokeDasharray="4 4" />
                <XAxis
                  dataKey="periodo"
                  interval={0}
                  tick={{ fill: '#475569', fontSize: 10 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#475569', fontSize: 10 }}
                  tickFormatter={(tick) => formatPercent(Number(tick))}
                  width={58}
                />
                <Tooltip content={<WeeklyTooltip />} cursor={false} />
                {chart.series.map((item) => (
                  <Line
                    connectNulls={false}
                    dataKey={item.id}
                    dot={{ r: 2.5, strokeWidth: 1 }}
                    isAnimationActive={false}
                    key={item.id}
                    name={item.label}
                    stroke={item.color}
                    strokeWidth={2}
                    type="monotone"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </article>
        ))}
      </div>
    </div>
  )
}

function WeeklyTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: {
    color?: string
    name?: string
    payload?: Record<string, string | number | null>
    value?: number | string | null
  }[]
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload

  return (
    <div className="chart-tooltip">
      <strong>{point?.periodoCompleto ?? 'Semana'}</strong>
      {point?.nota && <span className="tooltip-note">{point.nota}</span>}
      {payload
        .filter((item) => typeof item.value === 'number')
        .map((item) => (
          <div className="tooltip-row" key={`${item.name}-${item.value}`}>
            <span
              className="tooltip-dot"
              style={{ background: item.color ?? '#64748b' }}
            />
            <span>{item.name}</span>
            <b>{formatPercent(Number(item.value))}</b>
          </div>
        ))}
    </div>
  )
}

function ProducerComparisonLegend({
  corteFilter,
  producers,
  producerUniverse,
}: {
  corteFilter: CorteFilter
  producers: string[]
  producerUniverse: string[]
}) {
  const visible = producers.slice(0, 18)
  const hiddenCount = Math.max(0, producers.length - visible.length)

  return (
    <div className="comparison-producer-legend">
      <div className="comparison-date-hint">
        {(corteFilter === 'todos' || corteFilter === '01-18/06') && (
          <span>tom claro: 01-18/06</span>
        )}
        {(corteFilter === 'todos' || corteFilter === '19-30/06') && (
          <span>tom forte: 19-30/06</span>
        )}
      </div>
      <div className="comparison-producer-chips">
        {visible.map((produtor) => (
          <span className="comparison-producer-chip" key={produtor}>
            <span
              className="producer-swatch"
              style={{ background: getBaseColor(produtor, producerUniverse) }}
            />
            {produtor}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="comparison-producer-chip muted">
            +{formatInteger(hiddenCount)} produtores
          </span>
        )}
      </div>
    </div>
  )
}

function OwnershipChart({
  data,
  ownedName,
  thirdName,
  corteFilter,
}: {
  data: Record<string, string | number | null>[]
  ownedName: string
  thirdName: string
  corteFilter: CorteFilter
}) {
  return (
    <div className="chart-scroll">
      <div className="chart-frame ownership-chart-frame">
        <ResponsiveContainer height={430} width="100%">
          <BarChart
            barCategoryGap="12%"
            barGap={14}
            data={data}
            margin={{ top: 58, right: 22, bottom: 12, left: 12 }}
          >
            <CartesianGrid stroke="#dde3ec" strokeDasharray="4 4" />
            <XAxis
              dataKey="indicador"
              interval={0}
              tick={{ fill: '#475569', fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#475569', fontSize: 12 }}
              tickFormatter={(value) => formatPercent(Number(value))}
              width={72}
            />
            <Tooltip content={<PercentTooltip />} cursor={false} />
            <Legend
              align="center"
              content={() => (
                <PeriodLegend
                  corteFilter={corteFilter}
                  groups={[
                    {
                      label: ownedName,
                      beforeColor: mixColor(
                        OWNERSHIP_COLORS.owned,
                        '#ffffff',
                        0.42,
                      ),
                      afterColor: OWNERSHIP_COLORS.owned,
                    },
                    {
                      label: thirdName,
                      beforeColor: mixColor(
                        OWNERSHIP_COLORS.third,
                        '#ffffff',
                        0.42,
                      ),
                      afterColor: OWNERSHIP_COLORS.third,
                    },
                  ]}
                />
              )}
              wrapperStyle={{ paddingTop: 10 }}
            />
            {(corteFilter === 'todos' || corteFilter === '01-18/06') && (
              <Bar
                dataKey="propriosAntes"
                fill={mixColor(OWNERSHIP_COLORS.owned, '#ffffff', 0.42)}
                isAnimationActive={false}
                maxBarSize={42}
                name={`${ownedName} • 01-18/06`}
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  content={renderTinyTopPercentLabel}
                  dataKey="propriosAntes"
                />
              </Bar>
            )}
            {(corteFilter === 'todos' || corteFilter === '19-30/06') && (
              <Bar
                dataKey="propriosDepois"
                fill={OWNERSHIP_COLORS.owned}
                isAnimationActive={false}
                maxBarSize={42}
                name={`${ownedName} • 19-30/06`}
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  content={renderTinyTopPercentLabel}
                  dataKey="propriosDepois"
                />
              </Bar>
            )}
            {(corteFilter === 'todos' || corteFilter === '01-18/06') && (
              <Bar
                dataKey="terceirosAntes"
                fill={mixColor(OWNERSHIP_COLORS.third, '#ffffff', 0.42)}
                isAnimationActive={false}
                maxBarSize={42}
                name={`${thirdName} • 01-18/06`}
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  content={renderTinyTopPercentLabel}
                  dataKey="terceirosAntes"
                />
              </Bar>
            )}
            {(corteFilter === 'todos' || corteFilter === '19-30/06') && (
              <Bar
                dataKey="terceirosDepois"
                fill={OWNERSHIP_COLORS.third}
                isAnimationActive={false}
                maxBarSize={42}
                name={`${thirdName} • 19-30/06`}
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  content={renderTinyTopPercentLabel}
                  dataKey="terceirosDepois"
                />
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function PeriodLegend({
  groups,
  corteFilter,
}: {
  groups: {
    label?: string
    beforeColor?: string
    afterColor?: string
    targetColor?: string
  }[]
  corteFilter: CorteFilter
}) {
  const showBefore = corteFilter === 'todos' || corteFilter === '01-18/06'
  const showAfter = corteFilter === 'todos' || corteFilter === '19-30/06'

  return (
    <div className="period-legend">
      {groups.map((group, index) => (
        <div className="period-legend-group" key={`${group.label ?? 'datas'}-${index}`}>
          {group.label && (
            <span className="legend-group-label">{group.label}</span>
          )}
          {showBefore && group.beforeColor && (
            <span className="legend-date">
              <span
                className="legend-dot"
                style={{ background: group.beforeColor }}
              />
              01-18/06
            </span>
          )}
          {showAfter && group.afterColor && (
            <span className="legend-date">
              <span
                className="legend-dot"
                style={{ background: group.afterColor }}
              />
              19-30/06
            </span>
          )}
          {group.targetColor && (
            <span className="legend-date">
              <span
                className="legend-dot legend-dot-slim"
                style={{ background: group.targetColor }}
              />
              {!group.label && 'Meta'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export default App
