import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Maximize2,
  MonitorPlay,
  X,
} from 'lucide-react';
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

function periodLabel(periodFilter, dateFrom, dateTo) {
  if (periodFilter === 'today') return 'Hoje';
  if (periodFilter === 'week') return 'Ultimos 7 dias';
  if (periodFilter === 'month') return 'Este mes';
  if (periodFilter === 'custom') return formatMonthYear(dateFrom, dateTo) || `${dateFrom || 'Inicio'} ate ${dateTo || 'Fim'}`;
  return 'Todos os tempos';
}

function weekNumberLabel(label) {
  const match = String(label || '').match(/S?(\d{1,2})/i);
  return match ? String(Number(match[1])) : label;
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

function FieldBiKpiCard({ label, value, meta, goodWhen = 'low', loading = false }) {
  const tone = qualityTone(value, meta, goodWhen);
  const signal = tone.tone === 'green' ? '✓' : '!';
  return (
    <div className={`field-bi-kpi field-bi-kpi-${tone.tone}`}>
      <span>{label}</span>
      <strong className={loading ? 'skeleton-text' : ''}>
        {loading ? '\u00A0' : `${formatPercent(value)}${signal}`}
      </strong>
      <small>Meta: {formatPercent(meta)}</small>
    </div>
  );
}

const BI_SERIES = [
  { key: 'maduro', sourceKey: 'cachoMaduroPct', label: 'CM %', fullLabel: 'Cacho maduro %', color: 'var(--orange-institutional)' },
  { key: 'passado', sourceKey: 'cachoPassadoPct', label: 'CP %', fullLabel: 'Cacho passado %', color: 'var(--text-primary)' },
  { key: 'verde', sourceKey: 'cachoVerdePct', label: 'CV %', fullLabel: 'Cacho verde %', color: 'var(--green-institutional)' },
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

function FieldBiLegend() {
  return (
    <div className="field-bi-legend">
      {BI_SERIES.map((item) => (
        <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
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
          {!visibleRows.length && <div className="empty-panel">Nenhum dado de fazenda para os filtros atuais.</div>}
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
              <text
                x={13}
                y={padding.top + graphHeight / 2}
                textAnchor="middle"
                className="chart-axis-text field-bi-y-label"
                transform={`rotate(-90 13 ${padding.top + graphHeight / 2})`}
              >
                Percentual de qualidade
              </text>
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
                        {formatNumber(values.maduro, 0)}
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
            <div className="empty-panel">Nenhum dado semanal para os filtros atuais.</div>
          )}
        </div>
      )}
    </section>
  );
}

function EvaluatorQualityCards({ rows, loading = false }) {
  const visibleRows = rows.slice(0, 4);
  return (
    <section className="field-bi-panel field-bi-evaluators">
      {loading ? (
        <div className="skeleton-chart" style={{ height: 196 }} />
      ) : (
        <>
          {visibleRows.map((row) => (
            <div className="field-bi-evaluator-card" key={row.label}>
              <strong>{row.label}</strong>
              <div>
                <span><b>{formatPercent(row.cachoPassadoPct)}</b>Cacho passado %</span>
                <span><b>{formatPercent(row.cachoVerdePct)}</b>Cacho verde %</span>
                <span><b>{formatPercent(row.cachoMaduroPct)}</b>Cacho maduro %</span>
              </div>
            </div>
          ))}
          {!visibleRows.length && <div className="empty-panel">Nenhum avaliador encontrado nos filtros atuais.</div>}
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
            <div className="empty-panel">Nenhum dado de corte encontrado para montar o grafico por dia.</div>
          )}
        </div>
      )}
    </section>
  );
}

function FieldBiBoard({
  loading,
  model,
  totals,
  quality,
  dailyBunchRows,
  periodText,
  source,
  lastRecord,
  onPresent,
  presentationMode = false,
}) {
  return (
    <div className={`field-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="field-bi-header">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="field-bi-logo" />
        <h2>Qualidade Agrícola</h2>
        {!presentationMode && (
          <button type="button" className="field-bi-present-btn" onClick={onPresent}>
            <MonitorPlay size={18} />
            Apresentar
            <Maximize2 size={15} />
          </button>
        )}
      </div>

      <div className="field-bi-filter-strip">
        <span>{periodText}</span>
        <span>{loading ? 'Carregando base' : source}</span>
        <span>{formatNumber(model.corteRecords.length)} corte / {formatNumber(model.carreamentoRecords.length)} carreamento</span>
        <span>{formatNumber(totals.total)} coletas</span>
        <span>{lastRecord ? `Última coleta: ${lastRecord.date} ${lastRecord.time}` : 'Sem dados no filtro'}</span>
      </div>

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
        <EvaluatorQualityCards rows={model.evaluatorRows} loading={loading} />
      </div>

      <DailyBunchBarChart rows={dailyBunchRows} loading={loading} />

      <div className="developer-signature">Desenvolvedor: Vinicius Dev.</div>
    </div>
  );
}

function PresentationOverlay({ loading, model, totals, quality, dailyBunchRows, periodText, source, lastRecord, onClose }) {
  return createPortal(
    <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentacao em tela cheia">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={onClose} title="Fechar apresentacao" aria-label="Fechar apresentacao">
        <X size={22} />
      </button>
      <FieldBiBoard
        loading={loading}
        model={model}
        totals={totals}
        quality={quality}
        dailyBunchRows={dailyBunchRows}
        periodText={periodText}
        source={source}
        lastRecord={lastRecord}
        presentationMode
      />
    </div>,
    document.body
  );
}

export default function Dashboard({ farmFilter, areaFilter, periodFilter, cycleFilter, evaluatorFilter, dateFrom, dateTo, searchTerm }) {
  const [presentationOpen, setPresentationOpen] = useState(false);
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
  const periodText = periodLabel(periodFilter, dateFrom, dateTo);

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
          loading={loading}
          model={model}
          totals={totals}
          quality={quality}
          dailyBunchRows={dailyBunchRows}
          periodText={periodText}
          source={source}
          lastRecord={lastRecord}
          onClose={closePresentation}
        />
      )}

      {error && (
        <div className="warning-strip">
          <AlertTriangle size={16} />
          <span>Falha ao carregar dados: {error}</span>
        </div>
      )}

      <FieldBiBoard
        loading={loading}
        model={model}
        totals={totals}
        quality={quality}
        dailyBunchRows={dailyBunchRows}
        periodText={periodText}
        source={source}
        lastRecord={lastRecord}
        onPresent={openPresentation}
      />
    </div>
  );
}
