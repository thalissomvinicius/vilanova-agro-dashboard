import React, { useCallback, useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardList,
  Database,
  Filter,
  Map,
  Scale,
  Sprout,
  Trees,
  Weight,
  X,
} from 'lucide-react';
import BunchWeightMap from '../components/BunchWeightMap';
import {
  filterRecords,
  useCqoData,
} from '../utils/cqoData';
import {
  buildFieldBunchWeightSummary,
  normalizeBunchWeightParcel,
} from '../utils/bunchWeightData';

const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const formatKg = (value, digits = 2) => `${formatNumber(value, digits)} kg`;
const formatPercent = (value, digits = 1) => `${formatNumber(value, digits)}%`;

function normalizeEntity(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return '--';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function periodLabel(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return 'Todos os períodos';
  return `${formatDate(dateFrom) === '--' ? 'Início' : formatDate(dateFrom)} a ${
    formatDate(dateTo) === '--' ? 'Hoje' : formatDate(dateTo)
  }`;
}

function KpiCard({ icon: Icon, label, value, detail, tone = 'neutral' }) {
  return (
    <article className={`bunch-weight-kpi is-${tone}`}>
      <span className="bunch-weight-kpi-icon"><Icon size={19} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function EmptyPanel({ title, description }) {
  return (
    <div className="bunch-weight-empty">
      <Scale size={28} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function WeightTrend({ rows = [] }) {
  if (!rows.length) {
    return (
      <EmptyPanel
        title="Sem evolução no período"
        description="Não há pesagens de cacho maduro para desenhar a série."
      />
    );
  }

  const width = Math.max(760, rows.length * 92);
  const height = 290;
  const padding = { top: 34, right: 34, bottom: 54, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxAverage = Math.max(...rows.map((row) => row.averageKg), 1);
  const maxCount = Math.max(...rows.map((row) => row.weightCount), 1);
  const yMax = maxAverage * 1.18;
  const step = rows.length > 1 ? chartWidth / (rows.length - 1) : chartWidth;
  const pointX = (index) => padding.left + (rows.length > 1 ? index * step : chartWidth / 2);
  const pointY = (value) => padding.top + chartHeight - (value / yMax) * chartHeight;
  const averagePath = rows
    .map((row, index) => `${index ? 'L' : 'M'} ${pointX(index)} ${pointY(row.averageKg)}`)
    .join(' ');

  return (
    <div className="bunch-weight-trend-scroll" data-horizontal-scroll>
      <svg
        className="bunch-weight-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: width }}
        role="img"
        aria-label="Evolução diária do peso médio e quantidade de cachos pesados"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="trend-grid-line" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="trend-axis-label">
                {formatNumber(yMax * ratio, 0)}
              </text>
            </g>
          );
        })}

        {rows.map((row, index) => {
          const x = pointX(index);
          const barHeight = Math.max(4, (row.weightCount / maxCount) * (chartHeight * 0.52));
          return (
            <g key={row.date}>
              <rect
                x={x - 15}
                y={padding.top + chartHeight - barHeight}
                width="30"
                height={barHeight}
                rx="3"
                className="trend-volume-bar"
              >
                <title>{`${formatDate(row.date)}: ${row.weightCount} cacho(s) pesado(s)`}</title>
              </rect>
              <text x={x} y={height - 22} textAnchor="middle" className="trend-date-label">
                {formatDate(row.date).slice(0, 5)}
              </text>
            </g>
          );
        })}

        <path d={averagePath} className="trend-average-line" />
        {rows.map((row, index) => (
          <g key={`point-${row.date}`}>
            <circle cx={pointX(index)} cy={pointY(row.averageKg)} r="5" className="trend-average-point">
              <title>{`${formatDate(row.date)}: ${formatKg(row.averageKg)} · ${row.weightCount} pesagem(ns)`}</title>
            </circle>
            <text
              x={pointX(index)}
              y={Math.max(16, pointY(row.averageKg) - 11)}
              textAnchor="middle"
              className="trend-value-label"
            >
              {formatNumber(row.averageKg, 1)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function FarmTable({ rows = [], overallAverage = 0 }) {
  if (!rows.length) {
    return <EmptyPanel title="Sem fazendas" description="Nenhuma fazenda possui pesagem no filtro." />;
  }

  return (
    <div className="bunch-weight-table-wrap">
      <table className="bunch-weight-table">
        <thead>
          <tr>
            <th>Fazenda</th>
            <th>Média</th>
            <th>Cachos pesados</th>
            <th>Coletas</th>
            <th>Parcelas</th>
            <th>Cobertura</th>
            <th>Faixa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const delta = overallAverage > 0 ? ((row.averageKg / overallAverage) - 1) * 100 : 0;
            return (
              <tr key={row.key}>
                <td><strong>{row.farm}</strong></td>
                <td><strong>{formatKg(row.averageKg)}</strong><small>{`${delta >= 0 ? '+' : ''}${formatPercent(delta)}`}</small></td>
                <td>{formatNumber(row.weightCount)}</td>
                <td>{formatNumber(row.collectionCount)}</td>
                <td>{formatNumber(row.parcelCount)}</td>
                <td>{formatPercent(row.coveragePercent)}</td>
                <td>{`${formatNumber(row.minKg, 1)}–${formatNumber(row.maxKg, 1)} kg`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ParcelTable({ rows = [], selectedKey = '', onSelect }) {
  if (!rows.length) {
    return <EmptyPanel title="Sem parcelas" description="Nenhuma parcela possui pesagem no filtro." />;
  }

  return (
    <div className="bunch-weight-table-wrap">
      <table className="bunch-weight-table is-clickable">
        <thead>
          <tr>
            <th>Fazenda / parcela</th>
            <th>Média</th>
            <th>Mediana</th>
            <th>Pesagens</th>
            <th>Coletas</th>
            <th>Peso somado</th>
            <th>Última coleta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={selectedKey === row.key ? 'is-selected' : ''}
              onClick={() => onSelect(selectedKey === row.key ? null : {
                key: row.key,
                farmId: row.farmId,
                farm: row.farm,
                parcel: row.parcel,
              })}
            >
              <td><strong>{row.farm}</strong><small>{row.parcel}</small></td>
              <td><strong>{formatKg(row.averageKg)}</strong></td>
              <td>{formatKg(row.medianKg)}</td>
              <td>{formatNumber(row.weightCount)}</td>
              <td>{formatNumber(row.collectionCount)}</td>
              <td>{formatKg(row.totalWeightKg, 1)}</td>
              <td>{formatDate(row.latestDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectionTable({ rows = [] }) {
  if (!rows.length) {
    return <EmptyPanel title="Sem coletas" description="Nenhuma ficha com pesagem foi localizada." />;
  }

  return (
    <div className="bunch-weight-table-wrap">
      <table className="bunch-weight-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Fazenda / parcela</th>
            <th>Avaliador</th>
            <th>Pesagens</th>
            <th>Média</th>
            <th>Peso somado</th>
            <th>Faixa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><strong>{formatDate(row.date)}</strong><small>{row.time || '--'}</small></td>
              <td><strong>{row.farm}</strong><small>{row.parcel}</small></td>
              <td><strong>{row.evaluator}</strong><small>{row.evaluatorMatricula ? `Mat. ${row.evaluatorMatricula}` : ''}</small></td>
              <td>{formatNumber(row.weightCount)}</td>
              <td><strong>{formatKg(row.averageKg)}</strong></td>
              <td>{formatKg(row.totalWeightKg, 1)}</td>
              <td>{`${formatNumber(row.minKg, 1)}–${formatNumber(row.maxKg, 1)} kg`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BunchWeightDashboard({
  theme = 'light',
  farmFilter = 'all',
  periodFilter = 'custom',
  cycleFilter = 'all',
  evaluatorFilter = 'all',
  dateFrom = '',
  dateTo = '',
  lastSyncTime = '',
}) {
  const { records = [], loading, error } = useCqoData();
  const [selectedParcel, setSelectedParcel] = useState(null);

  const filteredRecords = useMemo(() => filterRecords(records, {
    farmFilter,
    areaFilter: 'corte',
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter: 'app',
    dateFrom,
    dateTo,
    approvedOnly: false,
  }), [
    records,
    farmFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    dateFrom,
    dateTo,
  ]);

  const baseSummary = useMemo(() => buildFieldBunchWeightSummary(filteredRecords, {
    approvalStatus: 'all',
  }), [filteredRecords]);

  const activeSelectedParcel = useMemo(() => {
    if (!selectedParcel) return null;
    return baseSummary.parcels.some((row) => row.key === selectedParcel.key)
      ? selectedParcel
      : null;
  }, [baseSummary.parcels, selectedParcel]);

  const focusedRecords = useMemo(() => {
    if (!activeSelectedParcel) return filteredRecords;
    const selectedFarm = normalizeEntity(activeSelectedParcel.farm);
    const selectedParcelCode = normalizeBunchWeightParcel(activeSelectedParcel.parcel);
    return filteredRecords.filter((record) => (
      (
        record.farmId === activeSelectedParcel.farmId
        || normalizeEntity(record.farm) === selectedFarm
      )
      && normalizeBunchWeightParcel(record.parcel) === selectedParcelCode
    ));
  }, [activeSelectedParcel, filteredRecords]);

  const summary = useMemo(() => buildFieldBunchWeightSummary(focusedRecords, {
    approvalStatus: 'all',
  }), [focusedRecords]);

  const handleParcelSelect = useCallback((parcel) => {
    setSelectedParcel(parcel);
  }, []);

  const handleParcelDropdown = (event) => {
    const key = event.target.value;
    if (!key) {
      setSelectedParcel(null);
      return;
    }
    const row = baseSummary.parcels.find((parcel) => parcel.key === key);
    if (row) {
      setSelectedParcel({
        key: row.key,
        farmId: row.farmId,
        farm: row.farm,
        parcel: row.parcel,
      });
    }
  };

  const updatedLabel = lastSyncTime || new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  return (
    <div className="fade-in page-shell bunch-weight-page">
      <header className="bunch-weight-commandbar">
        <div className="bunch-weight-title">
          <span className="page-eyebrow">CQO Campo · análise de pesagem</span>
          <h1>Peso médio do cacho maduro</h1>
          <p>Leitura por fazenda, parcela, período e coleta a partir das pesagens individuais do CQO Corte.</p>
        </div>
        <div className="bunch-weight-context">
          <span><CalendarDays size={15} /> {periodLabel(dateFrom, dateTo)}</span>
          <span><Database size={15} /> APP · aprovadas + pendentes</span>
          <span><Filter size={15} /> Atualizado {updatedLabel}</span>
        </div>
      </header>

      <section className="bunch-weight-filterbar" aria-label="Filtro de parcela">
        <div>
          <label htmlFor="bunch-weight-parcel">Detalhar parcela</label>
          <select
            id="bunch-weight-parcel"
            value={activeSelectedParcel?.key || ''}
            onChange={handleParcelDropdown}
          >
            <option value="">Todas as parcelas com pesagem</option>
            {baseSummary.parcels.map((row) => (
              <option key={row.key} value={row.key}>{`${row.farm} / ${row.parcel}`}</option>
            ))}
          </select>
        </div>
        <p>
          Os filtros de fazenda, ciclo, fiscal e data permanecem no topo da tela.
          Reprovadas e excluídas não entram no cálculo.
        </p>
        {activeSelectedParcel && (
          <button type="button" onClick={() => setSelectedParcel(null)}>
            <X size={16} /> Limpar parcela
          </button>
        )}
      </section>

      {error && (
        <div className="bunch-weight-error">
          A base apresentou uma falha de atualização. Os dados disponíveis em cache continuam exibidos.
        </div>
      )}

      <section className="bunch-weight-kpi-grid">
        <KpiCard
          icon={Scale}
          label="Peso médio"
          value={formatKg(summary.averageKg)}
          detail="média das pesagens individuais"
          tone="primary"
        />
        <KpiCard
          icon={Weight}
          label="Mediana"
          value={formatKg(summary.medianKg)}
          detail={`faixa ${formatNumber(summary.minKg, 1)}–${formatNumber(summary.maxKg, 1)} kg`}
        />
        <KpiCard
          icon={Sprout}
          label="Cachos pesados"
          value={formatNumber(summary.weightCount)}
          detail={`${formatKg(summary.totalWeightKg, 1)} somados`}
          tone="blue"
        />
        <KpiCard
          icon={ClipboardList}
          label="Coletas"
          value={formatNumber(summary.collectionCount)}
          detail={`${formatNumber(summary.withoutWeightsCount)} ficha(s) sem pesagem`}
        />
        <KpiCard
          icon={Map}
          label="Parcelas"
          value={formatNumber(summary.parcelCount)}
          detail={`${formatNumber(summary.farmCount)} fazenda(s)`}
        />
        <KpiCard
          icon={Trees}
          label="Cobertura"
          value={formatPercent(summary.coveragePercent)}
          detail={`${formatNumber(summary.weightCount)} de ${formatNumber(summary.declaredMatureCount)} maduros`}
          tone={summary.coveragePercent >= 10 ? 'green' : 'amber'}
        />
      </section>

      <section className="bunch-weight-main-grid">
        <article className="bunch-weight-section">
          <div className="bunch-weight-section-head">
            <div>
              <span>Evolução operacional</span>
              <h2>Peso médio por dia</h2>
              <p>Linha: média em kg. Barras: quantidade de cachos pesados.</p>
            </div>
            <div className="bunch-weight-chart-legend">
              <span className="is-line">Média kg</span>
              <span className="is-bar">Cachos pesados</span>
            </div>
          </div>
          <WeightTrend rows={summary.daily} />
        </article>

        <article className="bunch-weight-section bunch-weight-map-section">
          <div className="bunch-weight-section-head">
            <div>
              <span>Distribuição espacial</span>
              <h2>Peso médio por parcela</h2>
              <p>Clique no shape para aplicar ou remover o recorte da parcela.</p>
            </div>
          </div>
          <BunchWeightMap
            theme={theme}
            farmFilter={farmFilter}
            parcelRows={baseSummary.parcels}
            referenceAverageKg={baseSummary.averageKg}
            selectedParcelKey={activeSelectedParcel?.key || ''}
            onParcelSelect={handleParcelSelect}
          />
          <div className="bunch-weight-map-legend">
            <span><i className="is-below" /> Mais de 10% abaixo da média</span>
            <span><i className="is-central" /> Dentro de ±10% da média</span>
            <span><i className="is-above" /> Mais de 10% acima da média</span>
            <span><i className="is-empty" /> Sem pesagem</span>
          </div>
        </article>
      </section>

      {!loading && !summary.available ? (
        <section className="bunch-weight-section">
          <EmptyPanel
            title="Nenhuma pesagem encontrada"
            description="Ajuste os filtros ou registre pesos individuais de cacho maduro no CQO Corte."
          />
        </section>
      ) : (
        <>
          <section className="bunch-weight-section">
            <div className="bunch-weight-section-head">
              <div>
                <span>Comparação consolidada</span>
                <h2>Peso médio por fazenda</h2>
                <p>Média ponderada pelo número real de pesagens, sem média de médias.</p>
              </div>
            </div>
            <FarmTable rows={summary.farms} overallAverage={summary.averageKg} />
          </section>

          <section className="bunch-weight-section">
            <div className="bunch-weight-section-head">
              <div>
                <span>Ranking operacional</span>
                <h2>Desempenho por parcela</h2>
                <p>Selecione uma linha para sincronizar a leitura com o mapa e todos os indicadores.</p>
              </div>
              <strong>{formatNumber(summary.parcelCount)} parcela(s)</strong>
            </div>
            <ParcelTable
              rows={summary.parcels}
              selectedKey={activeSelectedParcel?.key || ''}
              onSelect={handleParcelSelect}
            />
          </section>

          <section className="bunch-weight-section">
            <div className="bunch-weight-section-head">
              <div>
                <span>Rastreabilidade</span>
                <h2>Coletas que formam a média</h2>
                <p>Cada ficha contribui com seus pesos individuais, mantendo avaliador, data e local.</p>
              </div>
              <strong>{formatNumber(summary.collectionCount)} coleta(s)</strong>
            </div>
            <CollectionTable rows={summary.collections} />
          </section>
        </>
      )}
    </div>
  );
}
