import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, MapPin, Rows3, Sprout, ThumbsUp, TrendingUp } from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { useCqoDashboard } from '../utils/cqoData';

export default function Analytics({ farmFilter, areaFilter, periodFilter, dateFrom, dateTo }) {
  const { loading, error, records, totals, charts, source } = useCqoDashboard({
    farmFilter,
    areaFilter,
    periodFilter,
    dateFrom,
    dateTo,
  });

  const typeRows = [
    { label: 'CQO Corte', value: totals.corte, color: 'var(--green-institutional)' },
    { label: 'CQO Carreamento', value: totals.carreamento, color: 'var(--orange-institutional)' },
  ];

  const qualityRows = [
    { label: 'Cachos esquecidos', value: totals.cachoEsquecido },
    { label: 'Cachos verdes', value: totals.cachoVerde },
    { label: 'Cachos passados', value: totals.cachoPassado },
    { label: 'Mal posicionados', value: totals.cachoMalPosicionado },
    { label: 'Nao carreados', value: totals.cachoNaoCarreado },
  ];

  const maxQuality = Math.max(...qualityRows.map((row) => row.value), 1);
  const qualityColors = ['#D98C10', '#22C55E', '#F59E0B', '#3B82F6', '#EF4444'];

  return (
    <div className="fade-in page-shell">
      <div className="page-header">
        <div className="page-title-block">
          <span className="page-eyebrow">Indicadores CQO</span>
          <h2>Analise operacional das coletas recebidas</h2>
          <p>Dados calculados diretamente das respostas sincronizadas pelo aplicativo.</p>
        </div>
      </div>

      {error ? (
        <div className="auth-error">
          Falha ao carregar indicadores: {error}
        </div>
      ) : null}

      <div className="grid-container grid-cols-4">
        <div className="card metric-card">
          <div className="kpi-icon-wrapper kpi-icon-green">
            <ClipboardCheck size={20} />
          </div>
          <div>
            <span className="metric-label">Coletas recebidas</span>
            <strong className="metric-value">{loading ? '--' : totals.total}</strong>
          </div>
        </div>

        <div className="card metric-card">
          <div className="kpi-icon-wrapper kpi-icon-info">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="metric-label">Taxa sincronizada</span>
            <strong className="metric-value">{loading ? '--' : `${totals.syncRate}%`}</strong>
          </div>
        </div>

        <div className="card metric-card">
          <div className="kpi-icon-wrapper kpi-icon-orange">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="metric-label">Perda corte</span>
            <strong className="metric-value">{loading ? '--' : `${totals.perdaCorteRate}%`}</strong>
          </div>
        </div>

        <div className="card metric-card">
          <div className="kpi-icon-wrapper kpi-icon-green">
            <MapPin size={20} />
          </div>
          <div>
            <span className="metric-label">Registros com GPS</span>
            <strong className="metric-value">{loading ? '--' : `${totals.gpsRate}%`}</strong>
          </div>
        </div>
      </div>

      <div className="grid-container grid-cols-4">
        <div className="card metric-card">
          <div className="kpi-icon-wrapper kpi-icon-info">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="metric-label">Validados</span>
            <strong className="metric-value">{loading ? '--' : `${totals.validationRate}%`}</strong>
            <small className="metric-subtitle">{totals.aprovados} aprov. / {totals.reprovados} reprov.</small>
          </div>
        </div>

        <div className="card metric-card">
          <div className="kpi-icon-wrapper kpi-icon-green">
            <ThumbsUp size={20} />
          </div>
          <div>
            <span className="metric-label">Taxa de aprovacao</span>
            <strong className="metric-value">{loading ? '--' : `${totals.approvalRate}%`}</strong>
            <small className="metric-subtitle">{totals.pendentesValidacao} pendente(s) de analise</small>
          </div>
        </div>

        <div className="card metric-card">
          <div className="kpi-icon-wrapper kpi-icon-orange">
            <Rows3 size={20} />
          </div>
          <div>
            <span className="metric-label">Linhas avaliadas</span>
            <strong className="metric-value">{loading ? '--' : totals.linhas}</strong>
            <small className="metric-subtitle">{totals.gpsPoints} ponto(s) GPS capturados</small>
          </div>
        </div>

        <div className="card metric-card">
          <div className="kpi-icon-wrapper kpi-icon-green">
            <Sprout size={20} />
          </div>
          <div>
            <span className="metric-label">Plantas observadas</span>
            <strong className="metric-value">{loading ? '--' : totals.plantasObservadas}</strong>
            <small className="metric-subtitle">Base para perdas e carreamento</small>
          </div>
        </div>
      </div>

      {records.length === 0 && !loading ? (
        <div className="empty-state">
          <ClipboardCheck size={32} />
          <h3>Nenhuma coleta sincronizada ainda</h3>
          <p>Quando o app enviar os formularios, os indicadores aparecem automaticamente aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid-container grid-cols-2">
            <CustomChart
              type="bar"
              data={charts.byFarm}
              title="Coletas por fazenda"
            />
            <CustomChart
              type="bar"
              data={charts.byEvaluator}
              title="Coletas por avaliador"
            />
          </div>

          <div className="grid-container grid-cols-2">
            <CustomChart
              type="line"
              data={charts.byDay}
              title="Evolucao diaria de coletas"
            />
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Distribuicao e qualidade</h3>
                  <span className="card-subtitle">{source}</span>
                </div>
              </div>

              <div className="settings-list">
                {typeRows.map((row) => (
                  <div className="settings-row" key={row.label}>
                    <span>{row.label}</span>
                    <strong style={{ color: row.color }}>{row.value}</strong>
                  </div>
                ))}
              </div>

              <div className="quality-stack">
                {qualityRows.map((row, index) => (
                  <div className="quality-line" key={row.label}>
                    <div className="quality-line-top">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                    <div className="quality-track">
                      <div
                        className="quality-bar"
                        style={{
                          width: `${Math.max(4, (row.value / maxQuality) * 100)}%`,
                          background: qualityColors[index],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
