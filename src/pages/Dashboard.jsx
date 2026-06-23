import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CalendarDays,
  Database,
  FileSpreadsheet,
  Filter,
  Maximize2,
  MonitorPlay,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import StatusBanner from '../components/ui/StatusBanner';
import { parseRecordDateValue, useCqoDashboard } from '../utils/cqoData';
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

function formatDateBr(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatMonthYear(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return null;
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  const isFullMonth = from.getDate() === 1
    && to.getDate() === lastDay
    && from.getMonth() === to.getMonth()
    && from.getFullYear() === to.getFullYear();
  const isFullYear = from.getDate() === 1
    && from.getMonth() === 0
    && to.getDate() === 31
    && to.getMonth() === 11
    && from.getFullYear() === to.getFullYear();

  if (isFullYear) return String(from.getFullYear());
  if (!isFullMonth) return null;

  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(from);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${from.getFullYear()}`;
}

function periodLabel(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return 'Todos os tempos';
  return formatMonthYear(dateFrom, dateTo)
    || `${formatDateBr(dateFrom) || 'Início'} a ${formatDateBr(dateTo) || 'Fim'}`;
}

function updateLabel(lastSyncTime) {
  const today = new Intl.DateTimeFormat('pt-BR').format(new Date());
  return lastSyncTime ? `${today} ${lastSyncTime}` : new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
}

function safePct(num, den) {
  return den > 0 ? (Number(num || 0) / den) * 100 : 0;
}

function weekNumberLabel(label) {
  const match = String(label || '').match(/S?(\d{1,2})/i);
  return match ? String(Number(match[1])) : label;
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function resolveRecordDate(record) {
  const candidates = [
    record.raw?.data_avaliacao,
    record.raw?.data,
    record.raw?.Data,
    record.sentAt,
    record.createdAt,
    record.date,
  ];

  for (const candidate of candidates) {
    const date = parseRecordDateValue(candidate);
    if (date) return date;
  }

  return null;
}

function latestCollectionLabel(records) {
  const latest = records.reduce((latestDate, record) => {
    const date = resolveRecordDate(record);
    if (!date) return latestDate;
    return !latestDate || date > latestDate ? date : latestDate;
  }, null);

  return latest ? new Intl.DateTimeFormat('pt-BR').format(latest) : '--';
}

function sourceFilterLabel(value) {
  if (value === 'app') return 'Só App';
  if (value === 'excel') return 'Só Excel';
  return 'App + Excel';
}

function farmFilterLabel(value) {
  if (value === 'fe-em-deus') return 'Fé em Deus';
  if (value === 'nova-conceicao') return 'Nova Conceição';
  if (value === 'vila-nova') return 'Vila Nova';
  return 'Todas as fazendas';
}

function dateTimeLabel(value) {
  const date = parseRecordDateValue(value);
  if (!date) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function buildDataDiagnostics({
  allRecords = [],
  mobileRecords = [],
  excelRecords = [],
  visibleRecords = [],
  cqoImport = {},
  filters = {},
}) {
  const rawExcelRows = Number(cqoImport?.corteRows || 0) + Number(cqoImport?.carreamentoRows || 0);
  const transformedRecords = allRecords.length;
  const visibleCount = visibleRecords.length;
  const hiddenByFilters = Math.max(transformedRecords - visibleCount, 0);
  const snapshot = cqoImport?.snapshot || null;
  const updatedAt = snapshot?.updated_at || snapshot?.imported_at || snapshot?.file_last_write_time || '';

  let tone = 'success';
  let status = 'Dados disponíveis';
  let message = 'O pipeline carregou os dados e há registros visíveis nos filtros atuais.';

  if (rawExcelRows > 0 && transformedRecords === 0) {
    tone = 'danger';
    status = 'Falha na transformação';
    message = 'O snapshot CQO tem linhas brutas, mas elas não viraram registros operacionais.';
  } else if (transformedRecords > 0 && visibleCount === 0) {
    tone = 'warning';
    status = 'Filtros sem resultado';
    message = `${formatNumber(transformedRecords)} registro(s) existem na base, mas nenhum passou pelos filtros atuais.`;
  } else if (rawExcelRows === 0 && transformedRecords === 0) {
    tone = 'warning';
    status = 'Sem carga CQO';
    message = 'Nenhum snapshot ou coleta CQO foi encontrado para montar o dashboard.';
  }

  return {
    tone,
    status,
    message,
    rawExcelRows,
    transformedRecords,
    visibleCount,
    hiddenByFilters,
    mobileCount: mobileRecords.length,
    excelCount: excelRecords.length,
    snapshotLabel: snapshot?.source_file || snapshot?.import_key || 'Sem snapshot',
    updatedAtLabel: dateTimeLabel(updatedAt),
    filterLabel: [
      farmFilterLabel(filters.farmFilter),
      sourceFilterLabel(filters.sourceFilter),
      periodLabel(filters.dateFrom, filters.dateTo),
    ].filter(Boolean).join(' · '),
  };
}

function DataHealthPanel({ diagnostics, loading }) {
  const cards = [
    { label: 'Excel bruto', value: diagnostics.rawExcelRows, icon: FileSpreadsheet },
    { label: 'Transformados', value: diagnostics.transformedRecords, icon: Database },
    { label: 'No filtro', value: diagnostics.visibleCount, icon: Filter },
  ];

  return (
    <section className={`field-data-health field-data-health-${diagnostics.tone}`}>
      <div className="field-data-health-status">
        <Database size={18} />
        <div>
          <span>Integridade dos dados</span>
          <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : diagnostics.status}</strong>
          {!loading ? <p>{diagnostics.message}</p> : null}
        </div>
      </div>

      <div className="field-data-health-metrics">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon size={16} />
            <span>{label}</span>
            <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : formatNumber(value)}</strong>
          </div>
        ))}
      </div>

      {!loading ? (
        <div className="field-data-health-meta">
          <span>{diagnostics.snapshotLabel}</span>
          <strong>{diagnostics.updatedAtLabel}</strong>
          <small>{diagnostics.filterLabel}</small>
        </div>
      ) : null}
    </section>
  );
}

function FieldBiEmptyState({ diagnostics, onResetFilters }) {
  const hasDataOutsideFilters = diagnostics.transformedRecords > 0;

  return (
    <div className={`field-bi-empty-state field-bi-empty-${diagnostics.tone}`}>
      <div className="field-bi-empty-icon">
        <AlertTriangle size={30} />
      </div>
      <div>
        <span>{diagnostics.status}</span>
        <h3>{hasDataOutsideFilters ? 'Há dados na base, mas não neste recorte' : 'Nenhum dado CQO disponível'}</h3>
        <p>{diagnostics.message}</p>
        {hasDataOutsideFilters && onResetFilters ? (
          <button type="button" className="btn btn-primary field-bi-empty-action" onClick={onResetFilters}>
            <RotateCcw size={15} />
            Limpar filtros
          </button>
        ) : null}
      </div>
      <div className="field-bi-empty-grid">
        <div><span>Registros na base</span><strong>{formatNumber(diagnostics.transformedRecords)}</strong></div>
        <div><span>Ocultos por filtro</span><strong>{formatNumber(diagnostics.hiddenByFilters)}</strong></div>
        <div><span>Snapshot</span><strong>{diagnostics.updatedAtLabel}</strong></div>
      </div>
    </div>
  );
}

function buildDailyBunchRows(records) {
  const buckets = new Map();

  records
    .filter((record) => record.type === 'corte')
    .forEach((record) => {
      const date = resolveRecordDate(record);
      const sortKey = date ? localDateKey(date) : `sem-data-${record.id}`;
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
    return { tone: 'danger', color: 'var(--status-danger)', status: 'Fora da meta' };
  }

  if (numeric <= meta) return { tone: 'green', color: 'var(--status-success)', status: 'Dentro da meta' };
  return { tone: 'danger', color: 'var(--status-danger)', status: 'Fora da meta' };
}

function FieldBiKpiCard({ label, value, meta, goodWhen = 'low', loading = false }) {
  const tone = qualityTone(value, meta, goodWhen);
  const signal = tone.tone === 'green' ? '✓' : '!';
  return (
    <div className={`field-bi-kpi field-bi-kpi-${tone.tone}`}>
      <span>{label}</span>
      <strong className={loading ? 'skeleton-text' : ''}>
        {loading ? '\u00A0' : `${formatPercent(value)}${signal}`}
      </strong>
      <small>Meta: {formatPercent(meta)} · {tone.status}</small>
    </div>
  );
}

function FieldTotalMetricCard({ label, value, detail, tone = 'neutral', loading = false }) {
  return (
    <div className={`field-total-metric field-total-metric-${tone}`}>
      <span>{label}</span>
      <strong className={loading ? 'skeleton-text' : ''}>{loading ? '\u00A0' : value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

const TOTAL_SECTION_OPTIONS = [
  { id: 'qualidade', label: 'Qualidade' },
  { id: 'falhas', label: 'Falhas' },
  { id: 'amostragem', label: 'Amostragem' },
  { id: 'perdas', label: 'Perdas' },
  { id: 'todos', label: 'Tudo' },
];

const BI_SERIES = [
  { key: 'maduro', sourceKey: 'cachoMaduroPct', label: 'CM %', fullLabel: 'Cacho Maduro %', color: 'var(--orange-institutional)' },
  { key: 'passado', sourceKey: 'cachoPassadoPct', label: 'CP %', fullLabel: 'Cacho Passado %', color: 'var(--text-primary)' },
  { key: 'verde', sourceKey: 'cachoVerdePct', label: 'CV %', fullLabel: 'Cacho Verde %', color: 'var(--green-institutional)' },
  { key: 'avermelhado', sourceKey: 'cachoAvermelhadoPct', label: 'CA %', fullLabel: 'Cacho Avermelhado %', color: 'var(--status-danger)' },
];

function qualityValuesFromRow(row) {
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
}

function riskFromValues(values) {
  return Number(values.passado || 0) + Number(values.verde || 0) + Number(values.avermelhado || 0);
}

function FieldBiLegend() {
  return (
    <div className="field-bi-legend">
      {BI_SERIES.map((item) => (
        <span key={item.key}><i style={{ background: item.color }} />{item.fullLabel}</span>
      ))}
    </div>
  );
}

function FieldBiFarmChart({ rows, loading = false }) {
  const visibleRows = rows.slice(0, 5);

  return (
    <section className="field-bi-panel">
      <h3>Qualidade por Fazenda</h3>
      <FieldBiLegend />
      {loading ? (
        <div className="skeleton-chart" style={{ height: 180 }} />
      ) : (
        <div className="field-bi-farm-chart">
          {visibleRows.map((row) => {
            const values = qualityValuesFromRow(row);
            return (
              <div className="field-bi-farm-row" key={row.label}>
                <strong>{row.label}</strong>
                <div className="field-bi-farm-bars">
                  {BI_SERIES.map((item, index) => {
                    const value = values[item.key];
                    return (
                      <div className="field-bi-farm-bar-line" key={item.key}>
                        <span
                          style={{ width: `${Math.min(value, 100)}%`, background: item.color }}
                          title={`${row.label} - ${item.fullLabel}: ${formatPercent(value)}`}
                        />
                        {index === 0 && <small>{formatPercent(value)}</small>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!visibleRows.length && <div className="empty-panel smart-empty-panel"><strong>Sem dados de fazenda</strong><span>Troque o mês, ano ou fazenda para localizar coletas já sincronizadas.</span></div>}
        </div>
      )}
      <div className="field-bi-axis"><span>0%</span><span>50%</span><span>100%</span></div>
    </section>
  );
}

function FieldBiWeekChart({ rows, loading = false }) {
  const visibleRows = rows.slice(-8);
  const chartHeight = 232;
  const padding = { top: 22, right: 18, bottom: 36, left: 42 };
  const weekWidth = 86;
  const width = Math.max(420, padding.left + padding.right + visibleRows.length * weekWidth);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = 42;

  return (
    <section className="field-bi-panel">
      <h3>Qualidade por semana</h3>
      <FieldBiLegend />
      {loading ? (
        <div className="skeleton-chart" style={{ height: chartHeight }} />
      ) : (
        <div className="field-bi-week-scroll">
          {visibleRows.length ? (
            <svg className="field-bi-week-chart" viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight}>
              {[0, 0.5, 1].map((ratio) => {
                const y = padding.top + graphHeight * (1 - ratio);
                return (
                  <g key={ratio}>
                    <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />
                    <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">{Math.round(ratio * 100)}%</text>
                  </g>
                );
              })}
              {visibleRows.map((row, rowIndex) => {
                const values = qualityValuesFromRow(row);
                const groupX = padding.left + rowIndex * weekWidth + (weekWidth - barWidth) / 2;
                let stackedHeight = 0;
                return (
                  <g key={row.label}>
                    {BI_SERIES.map((item) => {
                      const pct = Math.max(0, Math.min(values[item.key], 100));
                      const segmentHeight = (pct / 100) * graphHeight;
                      const y = padding.top + graphHeight - stackedHeight - segmentHeight;
                      stackedHeight += segmentHeight;
                      return (
                        <rect
                          key={item.key}
                          x={groupX}
                          y={y}
                          width={barWidth}
                          height={Math.max(segmentHeight, pct > 0 ? 1.5 : 0)}
                          fill={item.color}
                          className="chart-bar"
                        >
                          <title>{`${row.label} - ${item.fullLabel}: ${formatPercent(pct)}`}</title>
                        </rect>
                      );
                    })}
                    {values.maduro > 12 && (
                      <text
                        x={groupX + barWidth / 2}
                        y={padding.top + graphHeight - ((Math.min(values.maduro, 100) / 100) * graphHeight / 2)}
                        textAnchor="middle"
                        className="field-bi-bar-label"
                        transform={`rotate(-90 ${groupX + barWidth / 2} ${padding.top + graphHeight - ((Math.min(values.maduro, 100) / 100) * graphHeight / 2)})`}
                      >
                        {formatPercent(values.maduro, 0)}
                      </text>
                    )}
                    <text x={groupX + barWidth / 2} y={chartHeight - 12} textAnchor="middle" className="chart-axis-text">
                      {weekNumberLabel(row.label)}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="empty-panel smart-empty-panel"><strong>Sem semanas no filtro</strong><span>A visão semanal aparece quando houver coletas dentro do período selecionado.</span></div>
          )}
        </div>
      )}
    </section>
  );
}

function FiscalQualityCards({ rows, loading = false }) {
  const visibleRows = rows
    .map((row) => {
      const risk = riskFromValues({
        passado: row.cachoPassadoPct,
        verde: row.cachoVerdePct,
        avermelhado: row.cachoAvermelhadoPct,
      });
      return {
        ...row,
        risk,
        tone: risk > 8 ? 'danger' : risk > 4 ? 'warning' : 'success',
      };
    })
    .sort((a, b) => b.risk - a.risk || b.recordsCount - a.recordsCount)
    .slice(0, 4);

  return (
    <section className="field-bi-panel field-bi-evaluators">
      {loading ? (
        <div className="skeleton-chart" style={{ height: 196 }} />
      ) : (
        <>
          <div className="field-bi-evaluator-head">
            <h3>Fiscal responsável</h3>
            <span>ranking por risco de qualidade</span>
          </div>
          {visibleRows.map((row) => (
            <div className={`field-bi-evaluator-card field-bi-evaluator-${row.tone}`} key={row.label}>
              <strong>
                <span>{row.label}</span>
                <em>{formatPercent(row.risk)} risco</em>
              </strong>
              <div>
                <span><b>{formatPercent(row.cachoPassadoPct)}</b>Cacho passado %</span>
                <span><b>{formatPercent(row.cachoVerdePct)}</b>Cacho verde %</span>
                <span><b>{formatPercent(row.cachoMaduroPct)}</b>Cacho maduro %</span>
              </div>
              <small>{formatNumber(row.recordsCount)} coleta(s) · {row.tone === 'danger' ? 'prioridade alta' : row.tone === 'warning' ? 'acompanhar' : 'controlado'}</small>
            </div>
          ))}
          {!visibleRows.length && <div className="empty-panel smart-empty-panel"><strong>Sem fiscais</strong><span>Nenhuma coleta do período trouxe fiscal responsável válido.</span></div>}
        </>
      )}
    </section>
  );
}

function DailyBunchBarChart({ rows, loading = false }) {
  const series = [
    { key: 'maduro', label: 'Cacho maduro %', color: 'var(--orange-institutional)' },
    { key: 'passado', label: 'Cacho passado %', color: 'var(--text-primary)' },
    { key: 'verde', label: 'Cacho verde %', color: 'var(--green-institutional)' },
    { key: 'avermelhado', label: 'Cacho Avermelhado %', color: 'var(--status-danger)' },
  ];

  const visibleRows = rows.slice(-12);
  const chartHeight = 236;
  const padding = { top: 18, right: 18, bottom: 32, left: 46 };
  const dayWidth = 96;
  const width = Math.max(880, padding.left + padding.right + visibleRows.length * dayWidth);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = 62;

  return (
    <section className="field-bi-panel field-bi-daily-panel">
      <h3>Qualidade por Dia/Fazenda/Parcela</h3>
      <div className="field-daily-legend">
        {series.map((item) => (
          <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
        ))}
      </div>

      {loading ? (
        <div className="skeleton-chart" style={{ height: chartHeight }} />
      ) : (
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
                        <rect
                          key={item.key}
                          x={groupX}
                          y={y}
                          width={barWidth}
                          height={Math.max(segmentHeight, value > 0 ? 1.5 : 0)}
                          fill={item.color}
                          className="chart-bar"
                        >
                          <title>{`${row.label} - ${item.label}: ${formatNumber(value)} cachos (${formatPercent(pct)})`}</title>
                        </rect>
                      );
                    })}
                    <text x={groupX + barWidth / 2} y={chartHeight - 12} textAnchor="middle" className="chart-axis-text">
                      {row.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="empty-panel smart-empty-panel"><strong>Sem barras diárias</strong><span>O gráfico por dia será montado quando houver cachos avaliados no mês selecionado.</span></div>
          )}
        </div>
      )}
    </section>
  );
}

function buildTotalMetricGroups(model) {
  const totals = model.corteTotals || {};
  const baseCachos = Math.max(totals.cachosObservados || 0, 0);
  const basePlantas = Math.max(totals.plantasObservadas || 0, 0);
  const quality = model.quality || {};
  const lossBase = model.totals?.producedTon || 0;

  return [
    {
      id: 'qualidade',
      title: 'Qualidade dos cachos',
      cards: [
        { label: 'Cacho maduro', value: formatPercent(quality.cachoMaduroPct), detail: `${formatNumber(totals.cachoMaduro)} cachos`, tone: 'success' },
        { label: 'Cacho passado', value: formatPercent(quality.cachoPassadoPct), detail: `${formatNumber(totals.cachoPassado)} cachos`, tone: quality.cachoPassadoPct > 10 ? 'danger' : 'neutral' },
        { label: 'Cacho verde', value: formatPercent(quality.cachoVerdePct), detail: `${formatNumber(totals.cachoVerde)} cachos`, tone: quality.cachoVerdePct > 1 ? 'warning' : 'neutral' },
        { label: 'Cacho avermelhado', value: formatPercent(quality.cachoAvermelhadoPct), detail: `${formatNumber(totals.cachoAvermelhado)} cachos`, tone: quality.cachoAvermelhadoPct > 4 ? 'danger' : 'neutral' },
        { label: 'Cacho estrela', value: formatPercent(quality.cachoEstrelaPct), detail: `${formatNumber(totals.cachoEstrela)} cachos`, tone: quality.cachoEstrelaPct > 2 ? 'danger' : 'neutral' },
        { label: 'Cacho infermo', value: formatPercent(quality.cachoInfermoPct), detail: `${formatNumber(totals.cachoInfermo)} cachos`, tone: 'neutral' },
        { label: 'Bucha', value: formatPercent(quality.buchaPct), detail: `${formatNumber(totals.bucha)} cachos`, tone: 'neutral' },
        { label: 'Cacho brocado', value: formatPercent(safePct(totals.cachoBrocado, baseCachos)), detail: `${formatNumber(totals.cachoBrocado)} cachos`, tone: 'warning' },
      ],
    },
    {
      id: 'falhas',
      title: 'Falhas e ocorrências do corte',
      cards: [
        { label: 'Cacho esquecido', value: formatNumber(totals.cachoEsquecido), detail: `${formatPercent(safePct(totals.cachoEsquecido, baseCachos))} dos cachos`, tone: 'danger' },
        { label: 'Talo comprido', value: formatNumber(totals.taloComprido), detail: `${formatPercent(safePct(totals.taloComprido, basePlantas))} das plantas`, tone: quality.taloCompridoPct > 3 ? 'danger' : 'warning' },
        { label: 'Folha cortada indevida', value: formatNumber(totals.folhaCortada), detail: `${formatPercent(safePct(totals.folhaCortada, basePlantas))} das plantas`, tone: 'warning' },
        { label: 'Folha mamando', value: formatNumber(totals.folhaMamando), detail: `${formatPercent(safePct(totals.folhaMamando, basePlantas))} das plantas`, tone: 'warning' },
        { label: 'Mal posicionado', value: formatNumber(totals.cachoMalPosicionado), detail: `${formatPercent(safePct(totals.cachoMalPosicionado, baseCachos))} dos cachos`, tone: 'warning' },
        { label: 'Bucha', value: formatNumber(totals.bucha), detail: `${formatPercent(safePct(totals.bucha, baseCachos))} dos cachos`, tone: 'neutral' },
      ],
    },
    {
      id: 'amostragem',
      title: 'Amostragem e auditoria',
      cards: [
        { label: 'Fichas de corte', value: formatNumber(model.corteRecords.length), detail: 'coletas no filtro', tone: 'success' },
        { label: 'Linhas avaliadas', value: formatNumber(totals.linhas), detail: 'linhas/ruas amostradas', tone: 'neutral' },
        { label: 'Plantas observadas', value: formatNumber(totals.plantasObservadas), detail: 'base da auditoria', tone: 'neutral' },
        { label: 'Cachos observados', value: formatNumber(totals.cachosObservados), detail: 'base de maturação', tone: 'neutral' },
        {
          label: 'Registros com GPS',
          value: `${formatNumber(totals.gps)} / ${formatNumber(totals.gpsEligible)}`,
          detail: totals.gpsEligible === totals.total ? `${formatNumber(totals.gpsRate)}% das fichas` : `${formatNumber(totals.gpsRate)}% das coletas do app`,
          tone: 'success',
        },
        { label: 'Pontos GPS', value: formatNumber(totals.gpsPoints), detail: `${formatNumber(totals.gpsOccurrences)} ocorrências`, tone: 'neutral' },
      ],
    },
    {
      id: 'perdas',
      title: 'Perdas estimadas',
      cards: [
        { label: 'Perda corte', value: `${formatNumber(model.totals?.corteT, 2)} t`, detail: lossBase ? `${formatPercent(model.lossRates?.cortePct || 0)} da produção` : 'sem base de produção', tone: 'danger' },
        { label: 'Cachos estimados', value: formatNumber(model.totals?.estimatedCachos), detail: 'estimativa por amostragem', tone: 'warning' },
        { label: 'Produção base', value: `${formatNumber(lossBase, 2)} t`, detail: lossBase ? 'base calculada' : 'não informada', tone: 'neutral' },
        { label: 'Score corte', value: formatNumber(totals.corteScore), detail: 'nota técnica do corte', tone: totals.corteScore >= 85 ? 'success' : 'warning' },
      ],
    },
  ];
}

function FieldTotalDataPanel({ model, selectedSection, loading = false }) {
  const groups = buildTotalMetricGroups(model)
    .filter((group) => selectedSection === 'todos' || group.id === selectedSection);
  const farmRows = model.farmRows.slice(0, 8);

  return (
    <div className={`field-total-panel ${groups.length === 1 ? 'is-single-section' : ''}`}>
      {groups.map((group) => (
        <section className="field-total-section" key={group.id}>
          <h3>{group.title}</h3>
          <div className="field-total-metric-grid">
            {group.cards.map((card) => (
              <FieldTotalMetricCard
                key={`${group.id}-${card.label}`}
                loading={loading}
                {...card}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="field-total-section field-total-table-section">
        <h3>Resumo por fazenda</h3>
        <div className="field-total-table-wrap">
          <table className="field-total-table">
            <thead>
              <tr>
                <th>Fazenda</th>
                <th>Coletas</th>
                <th>Maduro</th>
                <th>Verde</th>
                <th>Passado</th>
                <th>Avermelhado</th>
                <th>Cacho esquecido</th>
              </tr>
            </thead>
            <tbody>
              {farmRows.map((row) => {
                const values = qualityValuesFromRow(row);
                const totals = row.qualidade || {};
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatNumber(row.records?.length || row.recordsCount || 0)}</td>
                    <td>{formatPercent(values.maduro)}</td>
                    <td>{formatPercent(values.verde)}</td>
                    <td>{formatPercent(values.passado)}</td>
                    <td>{formatPercent(values.avermelhado)}</td>
                    <td>{formatNumber(totals.cachoEsquecido)}</td>
                  </tr>
                );
              })}
              {!farmRows.length ? (
                <tr>
                  <td colSpan="7">Sem fazendas no filtro atual.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FieldBiBoard({
  loading,
  model,
  quality,
  dailyBunchRows,
  periodText,
  updateText,
  latestCollectionText,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  boardMode,
  setBoardMode,
  totalSection,
  setTotalSection,
  diagnostics,
  recordCount,
  onResetFilters,
  onPresent,
  presentationMode = false,
}) {
  const isTotalMode = !presentationMode && boardMode === 'total';

  return (
    <div className={`field-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="field-bi-header">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="field-bi-logo" />
        <div className="field-bi-title-block">
          <h2>Qualidade Agrícola</h2>
          <div className="field-bi-meta-line">
            <span><CalendarDays size={14} />{periodText}</span>
            <span><RefreshCw size={14} />Atualizado: {updateText}</span>
            <span><CalendarDays size={14} />Última coleta: {latestCollectionText}</span>
          </div>
        </div>
        {!presentationMode && (
          <button type="button" className="field-bi-present-btn" onClick={onPresent}>
            <MonitorPlay size={18} />
            Apresentar
            <Maximize2 size={15} />
          </button>
        )}
      </div>

      {!presentationMode ? (
        <div className="field-bi-control-bar">
          <div className="field-bi-mode-switch" role="group" aria-label="Modo de visualização CQO Campo">
            <button type="button" className={!isTotalMode ? 'active' : ''} onClick={() => setBoardMode('meeting')}>
              <MonitorPlay size={15} />
              Dados de apresentação
            </button>
            <button type="button" className={isTotalMode ? 'active' : ''} onClick={() => setBoardMode('total')}>
              <SlidersHorizontal size={15} />
              Dados totais
            </button>
          </div>

          {isTotalMode ? (
            <div className="field-total-filters">
              <label>
                <span>Exibir</span>
                <select value={totalSection} onChange={(event) => setTotalSection(event.target.value)}>
                  {TOTAL_SECTION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              {setDateFrom && setDateTo ? (
                <>
                  <label>
                    <span>De</span>
                    <input type="date" value={dateFrom || ''} onChange={(event) => setDateFrom(event.target.value)} />
                  </label>
                  <label>
                    <span>Até</span>
                    <input type="date" value={dateTo || ''} onChange={(event) => setDateTo(event.target.value)} />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && recordCount === 0 ? (
        <FieldBiEmptyState diagnostics={diagnostics} onResetFilters={onResetFilters} />
      ) : !isTotalMode ? (
        <>
          <div className="field-bi-kpi-grid">
            <FieldBiKpiCard loading={loading} label="Cacho Maduro %" value={quality.cachoMaduroPct} meta={85} goodWhen="high" />
            <FieldBiKpiCard loading={loading} label="Cacho passado %" value={quality.cachoPassadoPct} meta={10} />
            <FieldBiKpiCard loading={loading} label="Cacho verde %" value={quality.cachoVerdePct} meta={1} />
            <FieldBiKpiCard loading={loading} label="Cacho Avermelhado %" value={quality.cachoAvermelhadoPct} meta={4} />
            <FieldBiKpiCard loading={loading} label="Cacho Talo Compri. %" value={quality.taloCompridoPct} meta={3} />
            <FieldBiKpiCard loading={loading} label="Cacho Estrela %" value={quality.cachoEstrelaPct} meta={2} />
          </div>

          <div className="field-bi-main-grid">
            <FieldBiFarmChart rows={model.farmRows} loading={loading} />
            <FieldBiWeekChart rows={model.weekRows} loading={loading} />
            <FiscalQualityCards rows={model.evaluatorRows} loading={loading} />
          </div>

          <DailyBunchBarChart rows={dailyBunchRows} loading={loading} />
        </>
      ) : (
        <FieldTotalDataPanel model={model} selectedSection={totalSection} loading={loading} />
      )}

    </div>
  );
}

function PresentationOverlay(props) {
  return createPortal(
    <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentacao em tela cheia">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={props.onClose} title="Fechar apresentacao" aria-label="Fechar apresentacao">
        <X size={22} />
      </button>
      <div className="presentation-scroll">
        <FieldBiBoard {...props} presentationMode />
      </div>
    </div>,
    document.body
  );
}

export default function Dashboard({ farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, sourceFilter = 'all', dateFrom, dateTo, setDateFrom, setDateTo, searchTerm, lastSyncTime, onResetFilters }) {
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [boardMode, setBoardMode] = useState('meeting');
  const [totalSection, setTotalSection] = useState('qualidade');
  const {
    loading,
    records,
    allRecords = [],
    mobileRecords = [],
    excelRecords = [],
    cqoImport = {},
    error,
  } = useCqoDashboard({
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    searchTerm,
  });

  const model = useMemo(() => buildQualidadeOperacional(records), [records]);
  const dailyBunchRows = useMemo(() => buildDailyBunchRows(records), [records]);
  const quality = model.quality;
  const periodText = periodLabel(dateFrom, dateTo);
  const updateText = updateLabel(lastSyncTime);
  const latestCollectionText = loading ? 'Carregando...' : latestCollectionLabel(records);
  const diagnostics = useMemo(() => buildDataDiagnostics({
    allRecords,
    mobileRecords,
    excelRecords,
    visibleRecords: records,
    cqoImport,
    filters: {
      farmFilter,
      sourceFilter,
      dateFrom,
      dateTo,
    },
  }), [allRecords, mobileRecords, excelRecords, records, cqoImport, farmFilter, sourceFilter, dateFrom, dateTo]);

  const boardProps = {
    loading,
    model,
    quality,
    dailyBunchRows,
    periodText,
    updateText,
    latestCollectionText,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    boardMode,
    setBoardMode,
    totalSection,
    setTotalSection,
    diagnostics,
    recordCount: records.length,
    onResetFilters,
  };

  useEffect(() => {
    if (!presentationOpen) return undefined;

    document.body.classList.add('presentation-active');

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setPresentationOpen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.body.classList.remove('presentation-active');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [presentationOpen]);

  const openPresentation = () => {
    setPresentationOpen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const closePresentation = () => {
    setPresentationOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fade-in page-shell field-bi-page">
      {presentationOpen && (
        <PresentationOverlay
          {...boardProps}
          onClose={closePresentation}
        />
      )}

      {error && (
        <StatusBanner tone="danger" icon={AlertTriangle}>
          Falha ao carregar dados: {error}
        </StatusBanner>
      )}

      <DataHealthPanel diagnostics={diagnostics} loading={loading} />

      <FieldBiBoard
        {...boardProps}
        onPresent={openPresentation}
      />
    </div>
  );
}
