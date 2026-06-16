import React, { useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Leaf,
  Scale,
  Sprout,
  Target,
  Tractor,
  TrendingUp,
  Users,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { useCqoDashboard } from '../utils/cqoData';
import { buildQualidadeOperacional } from '../utils/qualidadeOperacionalData';

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function formatPercent(value, digits = 2) {
  return `${formatNumber(value, digits)}%`;
}

function periodLabel(periodFilter, dateFrom, dateTo) {
  if (periodFilter === 'today') return 'Hoje';
  if (periodFilter === 'week') return 'Ultimos 7 dias';
  if (periodFilter === 'month') return 'Este mes';
  if (periodFilter === 'custom') return `${dateFrom || 'Inicio'} ate ${dateTo || 'Fim'}`;
  return 'Todos os tempos';
}

function resolveRecordDate(record) {
  const candidates = [
    record.createdAt,
    record.sentAt,
    record.raw?.data_avaliacao,
    record.date,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const direct = new Date(candidate);
    if (!Number.isNaN(direct.getTime())) return direct;

    if (typeof candidate === 'string') {
      const brDate = candidate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (brDate) {
        const parsed = new Date(Number(brDate[3]), Number(brDate[2]) - 1, Number(brDate[1]));
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }
  }

  return null;
}

function buildDailyBunchRows(records) {
  const buckets = new Map();

  records
    .filter((record) => record.type === 'corte')
    .forEach((record) => {
      const date = resolveRecordDate(record);
      const sortKey = date ? date.toISOString().slice(0, 10) : `sem-data-${record.id}`;
      const label = date
        ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
        : 'Sem data';

      if (!buckets.has(sortKey)) {
        buckets.set(sortKey, {
          sortKey,
          label,
          maduro: 0,
          passado: 0,
          verde: 0,
          avermelhado: 0,
          estrela: 0,
          talo: 0,
        });
      }

      const bucket = buckets.get(sortKey);
      bucket.maduro += record.totals?.cachoMaduro || 0;
      bucket.passado += record.totals?.cachoPassado || 0;
      bucket.verde += record.totals?.cachoVerde || 0;
      bucket.avermelhado += record.totals?.cachoAvermelhado || 0;
      bucket.estrela += record.totals?.cachoEstrela || 0;
      bucket.talo += record.totals?.taloComprido || 0;
    });

  return Array.from(buckets.values()).sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
}

function qualityTone(value, meta, goodWhen = 'low') {
  const numeric = Number(value || 0);
  if (goodWhen === 'high') {
    if (numeric >= meta) return { tone: 'green', color: 'var(--status-success)', status: 'Dentro da meta' };
    if (numeric >= meta * 0.95) return { tone: 'orange', color: 'var(--status-warning)', status: 'Atencao' };
    return { tone: 'danger', color: 'var(--status-danger)', status: 'Fora da meta' };
  }

  if (numeric <= meta) return { tone: 'green', color: 'var(--status-success)', status: 'Dentro da meta' };
  if (numeric <= meta * 1.25) return { tone: 'orange', color: 'var(--status-warning)', status: 'Atencao' };
  return { tone: 'danger', color: 'var(--status-danger)', status: 'Fora da meta' };
}

function KpiCard({ title, value, footer, icon: Icon, tone = 'green', loading = false }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-body">
        <div>
          <span className={`kpi-value ${loading ? 'skeleton-text' : ''}`}>
            {loading ? '\u00A0' : value}
          </span>
        </div>
      </div>
      <span className={`kpi-footer ${loading ? 'skeleton-text skeleton-sm' : ''}`}>
        {loading ? '\u00A0' : footer}
      </span>
    </div>
  );
}

function QualityScorecard({ label, value, meta, goodWhen = 'low', loading = false }) {
  const tone = qualityTone(value, meta, goodWhen);
  return (
    <div className="card field-quality-scorecard">
      <div className="field-quality-scorecard-top">
        <span>{label}</span>
        <strong className={loading ? 'skeleton-text' : ''} style={{ color: tone.color }}>
          {loading ? '\u00A0' : formatPercent(value)}
        </strong>
      </div>
      <div className="field-quality-scorecard-bottom">
        <span>Meta {goodWhen === 'high' ? 'min.' : 'max.'} {formatPercent(meta)}</span>
        <span className={`field-quality-status field-quality-status-${tone.tone}`}>{tone.status}</span>
      </div>
    </div>
  );
}

function QualityDistribution({ quality, loading = false }) {
  const rows = [
    { label: 'Maduro', value: quality.cachoMaduroPct, color: '#F88A4E' },
    { label: 'Passado', value: quality.cachoPassadoPct, color: '#8B5A2B' },
    { label: 'Verde', value: quality.cachoVerdePct, color: '#65A30D' },
    { label: 'Avermelhado', value: quality.cachoAvermelhadoPct, color: '#B45309' },
  ];
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0) || 1;

  return (
    <div className="card field-quality-panel">
      <div className="card-header">
        <div>
          <h3 className="card-title">Distribuicao da maturacao</h3>
          <span className="card-subtitle">Leitura equivalente aos percentuais de qualidade do Power BI.</span>
        </div>
        <Leaf size={20} style={{ color: 'var(--green-institutional)' }} />
      </div>

      {loading ? (
        <div className="skeleton-chart" style={{ height: 132 }} />
      ) : (
        <>
          <div className="field-quality-stackbar">
            {rows.map((row) => (
              <div
                key={row.label}
                style={{ width: `${Math.max((row.value / total) * 100, row.value > 0 ? 2 : 0)}%`, background: row.color }}
                title={`${row.label}: ${formatPercent(row.value)}`}
              />
            ))}
          </div>
          <div className="field-quality-legend">
            {rows.map((row) => (
              <div key={row.label}>
                <span style={{ background: row.color }} />
                <strong>{row.label}</strong>
                <small>{formatPercent(row.value)}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StackedQualityRows({ title, subtitle, rows, loading = false, limit = 8 }) {
  const colors = {
    maduro: '#F88A4E',
    passado: '#8B5A2B',
    verde: '#65A30D',
    avermelhado: '#B45309',
  };

  const getQualityValues = (row) => {
    if (row.qualidade) {
      const base = Math.max(row.qualidade.cachosObservados || 0, 0);
      return {
        maduro: base ? (row.qualidade.cachoMaduro / base) * 100 : 0,
        passado: base ? (row.qualidade.cachoPassado / base) * 100 : 0,
        verde: base ? (row.qualidade.cachoVerde / base) * 100 : 0,
        avermelhado: base ? (row.qualidade.cachoAvermelhado / base) * 100 : 0,
        samples: base,
      };
    }

    return {
      maduro: Number(row.cachoMaduroPct || 0),
      passado: Number(row.cachoPassadoPct || 0),
      verde: Number(row.cachoVerdePct || 0),
      avermelhado: Number(row.cachoAvermelhadoPct || 0),
      samples: row.recordsCount || 0,
    };
  };

  return (
    <div className="card field-quality-panel">
      <div className="card-header">
        <div>
          <h3 className="card-title">{title}</h3>
          <span className="card-subtitle">{subtitle}</span>
        </div>
        <BarChart3 size={20} style={{ color: 'var(--orange-institutional)' }} />
      </div>

      {loading ? (
        <div className="skeleton-chart" style={{ height: 240 }} />
      ) : (
        <div className="field-quality-bars">
          {rows.slice(0, limit).map((row) => {
            const values = getQualityValues(row);
            const total = values.maduro + values.passado + values.verde + values.avermelhado;
            const hasSample = values.samples > 0 && total > 0;
            return (
              <div className={`field-quality-bar-row ${hasSample ? '' : 'is-empty'}`} key={row.label}>
                <div className="field-quality-bar-label">
                  <strong>{row.label}</strong>
                  <span>{hasSample ? `${formatPercent(values.maduro)} maduro` : 'Sem amostra de corte'}</span>
                </div>
                <div className="field-quality-mini-stack">
                  {hasSample ? (
                    <>
                      <span style={{ width: `${(values.maduro / total) * 100}%`, background: colors.maduro }} title={`Maduro: ${formatPercent(values.maduro)}`} />
                      <span style={{ width: `${(values.passado / total) * 100}%`, background: colors.passado }} title={`Passado: ${formatPercent(values.passado)}`} />
                      <span style={{ width: `${(values.verde / total) * 100}%`, background: colors.verde }} title={`Verde: ${formatPercent(values.verde)}`} />
                      <span style={{ width: `${(values.avermelhado / total) * 100}%`, background: colors.avermelhado }} title={`Avermelhado: ${formatPercent(values.avermelhado)}`} />
                    </>
                  ) : (
                    <small>Sem base</small>
                  )}
                </div>
              </div>
            );
          })}
          {!rows.length && <div className="empty-panel">Nenhum dado de corte encontrado para os filtros atuais.</div>}
        </div>
      )}
    </div>
  );
}

function DailyBunchBarChart({ rows, loading = false }) {
  const series = [
    { key: 'maduro', label: 'Cacho maduro %', color: '#F88A4E' },
    { key: 'passado', label: 'Cacho passado %', color: '#4A3A2E' },
    { key: 'verde', label: 'Cacho verde %', color: '#4EA64F' },
    { key: 'avermelhado', label: 'Cacho Avermelhado %', color: '#B02025' },
  ];

  const visibleRows = rows.slice(-18);
  const chartHeight = 245;
  const padding = { top: 18, right: 18, bottom: 35, left: 46 };
  const dayWidth = 92;
  const width = Math.max(760, padding.left + padding.right + visibleRows.length * dayWidth);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = 58;

  return (
    <div className="card field-daily-chart-card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Qualidade por Dia/Fazenda/Parcela</h3>
          <span className="card-subtitle">Percentual diário por classificação, mantendo a quantidade no detalhe de cada barra.</span>
        </div>
        <BarChart3 size={20} style={{ color: 'var(--orange-institutional)' }} />
      </div>

      {loading ? (
        <div className="skeleton-chart" style={{ height: chartHeight }} />
      ) : (
        <>
          <div className="field-daily-legend">
            {series.map((item) => (
              <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
            ))}
          </div>
          <div className="field-daily-chart-scroll">
            {visibleRows.length ? (
              <svg className="field-daily-chart-svg" viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight}>
                {[0, 0.5, 1].map((ratio) => {
                  const y = padding.top + graphHeight * (1 - ratio);
                  return (
                    <g key={ratio}>
                      <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />
                      <text x={padding.left - 10} y={y + 4} textAnchor="end" className="chart-axis-text">
                        {Math.round(ratio * 100)}%
                      </text>
                    </g>
                  );
                })}

                {visibleRows.map((row, rowIndex) => {
                  const groupX = padding.left + rowIndex * dayWidth + (dayWidth - barWidth) / 2;
                  const total = series.reduce((sum, item) => sum + Number(row[item.key] || 0), 0);
                  let stackedHeight = 0;
                  return (
                    <g key={row.sortKey}>
                      {series.map((item) => {
                        const value = Number(row[item.key] || 0);
                        const pct = total > 0 ? (value / total) * 100 : 0;
                        const segmentHeight = total > 0 ? (pct / 100) * graphHeight : 0;
                        const y = padding.top + graphHeight - stackedHeight - segmentHeight;
                        stackedHeight += segmentHeight;
                        return (
                          <g key={item.key}>
                            <rect
                              x={groupX}
                              y={y}
                              width={barWidth}
                              height={Math.max(segmentHeight, value > 0 ? 1.5 : 0)}
                              fill={item.color}
                              className="chart-bar"
                            >
                              <title>{`${row.label} - ${item.label}: ${formatNumber(value)} cachos (${formatPercent(pct)})`}</title>
                            </rect>
                          </g>
                        );
                      })}
                      <text x={groupX + barWidth / 2} y={chartHeight - 14} textAnchor="middle" className="chart-axis-text">
                        {row.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="empty-panel">Nenhum dado de corte encontrado para montar o grafico por dia.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function QualityTable({ rows, loading = false }) {
  return (
    <div className="card page-card">
      <div className="card-header table-card-header">
        <div>
          <h3 className="card-title">Detalhe por fazenda</h3>
          <span className="card-subtitle">Mesmas leituras do PBIX: maturacao, anomalias e volume de coletas.</span>
        </div>
        <Sprout size={20} style={{ color: 'var(--green-institutional)' }} />
      </div>
      <div className="table-wrapper">
        <table className="custom-table dense-table">
          <thead>
            <tr>
              <th>Fazenda</th>
              <th>Coletas</th>
              <th>Cacho maduro %</th>
              <th>Cacho passado %</th>
              <th>Cacho verde %</th>
              <th>Avermelhado %</th>
              <th>Talo comprido %</th>
              <th>Cacho estrela %</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.map((row) => (
              <tr key={row.label}>
                <td><strong>{row.label}</strong></td>
                <td>{formatNumber(row.records.length)}</td>
                <td>{formatPercent(row.qualidade.cachosObservados ? (row.qualidade.cachoMaduro / row.qualidade.cachosObservados) * 100 : 0)}</td>
                <td>{formatPercent(row.qualidade.cachosObservados ? (row.qualidade.cachoPassado / row.qualidade.cachosObservados) * 100 : 0)}</td>
                <td>{formatPercent(row.qualidade.cachosObservados ? (row.qualidade.cachoVerde / row.qualidade.cachosObservados) * 100 : 0)}</td>
                <td>{formatPercent(row.qualidade.cachosObservados ? (row.qualidade.cachoAvermelhado / row.qualidade.cachosObservados) * 100 : 0)}</td>
                <td>{formatPercent(row.qualidade.cachosObservados ? (row.qualidade.taloComprido / row.qualidade.cachosObservados) * 100 : 0)}</td>
                <td>{formatPercent(row.qualidade.cachosObservados ? (row.qualidade.cachoEstrela / row.qualidade.cachosObservados) * 100 : 0)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="8" className="empty-table-cell">Nenhuma coleta encontrada para os filtros atuais.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="8" className="empty-table-cell">Carregando indicadores...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard({ farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, dateFrom, dateTo, searchTerm }) {
  const { loading, records, totals, source, error } = useCqoDashboard({
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    dateFrom,
    dateTo,
    searchTerm,
  });

  const model = useMemo(() => buildQualidadeOperacional(records), [records]);
  const dailyBunchRows = useMemo(() => buildDailyBunchRows(records), [records]);
  const lastRecord = records[0];
  const quality = model.quality;

  const matureTrend = model.weekRows.map((row) => ({
    label: row.label,
    value: Number(row.cachoMaduroPct.toFixed(1)),
  }));
  const anomalyTrend = model.weekRows.map((row) => ({
    label: row.label,
    value: Number((row.cachoVerdePct + row.cachoPassadoPct + row.cachoAvermelhadoPct).toFixed(1)),
  }));

  return (
    <div className="fade-in page-shell">
      <div className="dashboard-page-header field-powerbi-header">
        <div>
          <span className="page-eyebrow">Qualidade Agricola • CQO Campo</span>
          <h2>Campo no modelo do Power BI</h2>
          <div className="field-powerbi-meta">
            <span><Calendar size={14} /> {periodLabel(periodFilter, dateFrom, dateTo)}</span>
            <span><CheckCircle2 size={14} /> {loading ? 'Carregando base' : source}</span>
            <span><ClipboardCheck size={14} /> {formatNumber(model.corteRecords.length)} corte / {formatNumber(model.carreamentoRecords.length)} carreamento</span>
          </div>
        </div>
        <div className="source-card compact">
          <span>Referencia</span>
          <strong>Qualidade Agricola.pbix</strong>
          <small>{lastRecord ? `Ultima coleta: ${lastRecord.date} ${lastRecord.time}` : 'Sem dados no filtro'}</small>
        </div>
      </div>

      {error && (
        <div className="warning-strip">
          <AlertTriangle size={16} />
          <span>Falha ao carregar dados: {error}</span>
        </div>
      )}

      <div className="grid-container grid-cols-4">
        <QualityScorecard loading={loading} label="Cacho Maduro %" value={quality.cachoMaduroPct} meta={85} goodWhen="high" />
        <QualityScorecard loading={loading} label="Cacho passado %" value={quality.cachoPassadoPct} meta={10} />
        <QualityScorecard loading={loading} label="Cacho verde %" value={quality.cachoVerdePct} meta={1} />
        <QualityScorecard loading={loading} label="Cacho Avermelhado %" value={quality.cachoAvermelhadoPct} meta={4} />
      </div>

      <div className="grid-container grid-cols-4">
        <KpiCard
          title="Talo Comprido %"
          value={formatPercent(quality.taloCompridoPct)}
          footer="Meta maxima 3,00%"
          icon={Target}
          tone={qualityTone(quality.taloCompridoPct, 3).tone}
          loading={loading}
        />
        <KpiCard
          title="Cacho Estrela %"
          value={formatPercent(quality.cachoEstrelaPct)}
          footer="Meta maxima 2,00%"
          icon={Gauge}
          tone={qualityTone(quality.cachoEstrelaPct, 2).tone}
          loading={loading}
        />
        <KpiCard
          title="Cachos observados"
          value={formatNumber(model.corteTotals.cachosObservados)}
          footer={`${formatNumber(model.corteTotals.plantasObservadas)} plantas observadas`}
          icon={Tractor}
          tone="green"
          loading={loading}
        />
        <KpiCard
          title="Perdas estimadas"
          value={`${formatNumber(model.totals.perdasT, 2)} t`}
          footer={`${formatNumber(model.totals.estimatedCachos)} cachos estimados`}
          icon={Scale}
          tone={model.totals.perdasT > 0 ? 'orange' : 'green'}
          loading={loading}
        />
      </div>

      <div className="grid-container grid-cols-2">
        <QualityDistribution quality={quality} loading={loading} />
        <DailyBunchBarChart rows={dailyBunchRows} loading={loading} />
      </div>

      <div className="grid-container grid-cols-2">
        <StackedQualityRows
          loading={loading}
          title="Qualidade por Fazenda"
          subtitle="Maduro, passado, verde e avermelhado por origem."
          rows={model.farmRows}
          limit={10}
        />
        <StackedQualityRows
          loading={loading}
          title="Qualidade por Semana"
          subtitle="Evolucao semanal dos percentuais de corte."
          rows={model.weekRows}
          limit={10}
        />
      </div>

      <div className="grid-container grid-cols-2">
        <CustomChart loading={loading} type="line" data={matureTrend} title="Cacho maduro % por semana" targetValue={85} targetLabel="Meta" />
        <CustomChart loading={loading} type="line" data={anomalyTrend} title="Anomalias de maturacao % por semana" targetValue={15} targetLabel="Limite" />
      </div>

      <div className="grid-container grid-cols-2">
        <StackedQualityRows
          loading={loading}
          title="Ranking de Avaliadores"
          subtitle="Auditores/fiscais com maior volume de amostras no filtro."
          rows={model.evaluatorRows}
          limit={8}
        />
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Resumo operacional</h3>
              <span className="card-subtitle">Base usada para aproximar a leitura do PBIX no sistema.</span>
            </div>
            <Users size={20} style={{ color: 'var(--green-institutional)' }} />
          </div>
          <div className="compact-list">
            <div className="compact-row">
              <div><strong>Total de coletas</strong><span>Registros dentro dos filtros</span></div>
              <strong>{formatNumber(totals.total)}</strong>
            </div>
            <div className="compact-row">
              <div><strong>Cachos maduros</strong><span>Base do indicador principal</span></div>
              <strong>{formatNumber(model.corteTotals.cachoMaduro)}</strong>
            </div>
            <div className="compact-row">
              <div><strong>Ocorrencias criticas</strong><span>Verde + passado + avermelhado</span></div>
              <strong>{formatNumber(model.corteTotals.cachoVerde + model.corteTotals.cachoPassado + model.corteTotals.cachoAvermelhado)}</strong>
            </div>
            <div className="compact-row">
              <div><strong>Sincronizacao</strong><span>Coletas ja sincronizadas</span></div>
              <strong>{formatNumber(totals.syncRate)}%</strong>
            </div>
          </div>
        </div>
      </div>

      <QualityTable rows={model.farmRows} loading={loading} />

      <div className="grid-container grid-cols-1">
        <CustomChart
          loading={loading}
          type="bar"
          data={model.farmRows.slice(0, 12).map((row) => ({
            label: row.label.length > 16 ? `${row.label.slice(0, 16)}...` : row.label,
            value: Number((row.qualidade.cachosObservados ? (row.qualidade.cachoMaduro / row.qualidade.cachosObservados) * 100 : 0).toFixed(1)),
            fill: '#234F2A',
          }))}
          title="Cacho maduro % por fazenda"
          targetValue={85}
          targetLabel="Meta"
        />
      </div>

      <div className="field-powerbi-footnote">
        <TrendingUp size={16} />
        <span>Indicadores estruturados a partir da pagina "Qualidade Agricola" do PBIX: scorecards de maturacao, qualidade por fazenda, qualidade por semana e ranking de avaliadores.</span>
      </div>
    </div>
  );
}
