import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Leaf,
  MapPin,
  Rows3,
  Scissors,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Truck,
  Weight,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { aggregateRecords, buildCharts, filterRecords, useCqoData } from '../utils/cqoData';

function fmt(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function pct(num, den) {
  if (!den || den === 0) return '0,0%';
  return `${((num / den) * 100).toFixed(1).replace('.', ',')}%`;
}

function KpiCard({ title, value, subtitle, icon: Icon, tone = 'green', loading = false, trend = null }) {
  const toneMap = {
    green: 'kpi-icon-green',
    orange: 'kpi-icon-orange',
    info: 'kpi-icon-info',
    danger: 'kpi-icon-danger',
    warning: 'kpi-icon-orange',
  };
  return (
    <div className="card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper ${toneMap[tone] || 'kpi-icon-green'}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-body">
        <span className={`kpi-value ${loading ? 'skeleton-text' : ''}`}>
          {loading ? '\u00A0' : value}
        </span>
        {trend !== null && !loading && (
          <span style={{ fontSize: '0.72rem', color: trend >= 0 ? 'var(--status-success)' : 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: 2 }}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <span className={`kpi-footer ${loading ? 'skeleton-text skeleton-sm' : ''}`}>
        {loading ? '\u00A0' : subtitle}
      </span>
    </div>
  );
}

function SectionHeader({ eyebrow, title, color = 'var(--green-institutional)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 14px' }}>
      <div style={{ width: 4, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{eyebrow}</span>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
      </div>
    </div>
  );
}

function QualityBar({ label, value, max, color, loading = false }) {
  const pctVal = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="quality-line">
      <div className="quality-line-top">
        <span>{label}</span>
        <strong className={loading ? 'skeleton-text' : ''}>{loading ? '\u00A0' : fmt(value)}</strong>
      </div>
      <div className={`quality-track ${loading ? 'skeleton-chart' : ''}`} style={{ height: 8, minHeight: 8 }}>
        {!loading && (
          <div className="quality-bar" style={{ width: `${Math.max(pctVal, value > 0 ? 3 : 0)}%`, background: color }} />
        )}
      </div>
    </div>
  );
}

function StatusBadgeRow({ label, value, total, color, loading }) {
  const p = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className={`${loading ? 'skeleton-text skeleton-sm' : ''}`} style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {loading ? '\u00A0' : `${p}%`}
        </span>
        <strong className={`${loading ? 'skeleton-text skeleton-sm' : ''}`} style={{ fontSize: '0.9rem', color, minWidth: 28, textAlign: 'right' }}>
          {loading ? '\u00A0' : fmt(value)}
        </strong>
      </div>
    </div>
  );
}

export default function Analytics({ farmFilter, areaFilter, periodFilter, dateFrom, dateTo }) {
  const { loading, error, records: allRecords, source } = useCqoData();
  const [activeTab, setActiveTab] = useState('geral');

  const filtered = filterRecords(allRecords, { farmFilter, areaFilter, periodFilter, dateFrom, dateTo });
  const corteRecords = filtered.filter((r) => r.type === 'corte');
  const carreamentoRecords = filtered.filter((r) => r.type === 'carreamento');

  const totalsGeral = aggregateRecords(filtered);
  const totalsCorte = aggregateRecords(corteRecords);
  const totalsCarreamento = aggregateRecords(carreamentoRecords);

  const chartsGeral = buildCharts(filtered);
  const chartsCorte = buildCharts(corteRecords);
  const chartsCarreamento = buildCharts(carreamentoRecords);

  // Corte-specific computed indicators
  const taxaPerda = totalsCorte.cachosObservados > 0
    ? ((totalsCorte.cachoEsquecido / totalsCorte.cachosObservados) * 100).toFixed(1)
    : '0,0';
  const taxaMaturacao = totalsCorte.cachosObservados > 0
    ? ((totalsCorte.cachoMaduro / totalsCorte.cachosObservados) * 100).toFixed(1)
    : '0,0';
  const taxaVerde = totalsCorte.cachosObservados > 0
    ? ((totalsCorte.cachoVerde / totalsCorte.cachosObservados) * 100).toFixed(1)
    : '0,0';
  const taxaPassado = totalsCorte.cachosObservados > 0
    ? ((totalsCorte.cachoPassado / totalsCorte.cachosObservados) * 100).toFixed(1)
    : '0,0';
  const mediaLinhasCorte = corteRecords.length > 0
    ? (totalsCorte.linhas / corteRecords.length).toFixed(1)
    : '0';
  const mediaPlantasPorLinha = totalsCorte.linhas > 0
    ? (totalsCorte.plantasObservadas / totalsCorte.linhas).toFixed(1)
    : '0';

  // Carreamento-specific
  const taxaMalPos = totalsCarreamento.plantasObservadas > 0
    ? ((totalsCarreamento.cachoMalPosicionado / totalsCarreamento.plantasObservadas) * 100).toFixed(1)
    : '0,0';
  const taxaNaoCarreado = totalsCarreamento.plantasObservadas > 0
    ? ((totalsCarreamento.cachoNaoCarreado / totalsCarreamento.plantasObservadas) * 100).toFixed(1)
    : '0,0';
  const mediaPeso = carreamentoRecords.length > 0
    ? (totalsCarreamento.pesoMedio / carreamentoRecords.length).toFixed(1)
    : '0';

  const availableTabs = [
    { id: 'geral', label: 'Visão Geral' },
    ...(areaFilter !== 'carreamento' ? [{ id: 'corte', label: 'CQO Corte' }] : []),
    ...(areaFilter !== 'corte' ? [{ id: 'carreamento', label: 'CQO Carreamento' }] : []),
  ];

  const currentTab = availableTabs.some((t) => t.id === activeTab) ? activeTab : 'geral';

  return (
    <div className="fade-in page-shell">
      <div className="page-header">
        <div className="page-title-block">
          <span className="page-eyebrow">Indicadores CQO</span>
          <h2>Painel de Indicadores por Tipo de Formulário</h2>
          <p>Dados calculados em tempo real a partir das respostas sincronizadas pelo aplicativo Android.</p>
        </div>
        <div className="source-card compact">
          <span>Fonte</span>
          <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : source}</strong>
        </div>
      </div>

      {error && (
        <div className="warning-strip">
          <AlertTriangle size={16} />
          <span>Falha ao carregar indicadores: {error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border-color)', paddingBottom: 0 }}>
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: currentTab === tab.id ? 700 : 500,
              color: currentTab === tab.id ? 'var(--green-institutional)' : 'var(--text-secondary)',
              borderBottom: currentTab === tab.id ? '2px solid var(--green-institutional)' : '2px solid transparent',
              marginBottom: -2,
              fontSize: '0.9rem',
              transition: 'all 0.18s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ VISÃO GERAL ============ */}
      {currentTab === 'geral' && (
        <>
          <SectionHeader eyebrow="Indicadores de Conformidade" title="Avaliação Geral da Qualidade Operacional" color="var(--green-institutional)" />
          <div className={`grid-container ${areaFilter === 'all' ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <KpiCard
              title="Nota Geral CQO"
              value={`${totalsGeral.generalScore} / 100`}
              subtitle="Média consolidada de qualidade"
              icon={Award}
              tone={totalsGeral.generalScore >= 90 ? 'green' : totalsGeral.generalScore >= 80 ? 'warning' : 'danger'}
              loading={loading}
            />
            {areaFilter !== 'carreamento' && (
              <KpiCard
                title="Nota CQO Corte"
                value={`${totalsGeral.corteScore} / 100`}
                subtitle={`${fmt(totalsGeral.corte)} coletas de colheita`}
                icon={Scissors}
                tone={totalsGeral.corteScore >= 90 ? 'green' : totalsGeral.corteScore >= 80 ? 'warning' : 'danger'}
                loading={loading}
              />
            )}
            {areaFilter !== 'corte' && (
              <KpiCard
                title="Nota CQO Carreamento"
                value={`${totalsGeral.carreamentoScore} / 100`}
                subtitle={`${fmt(totalsGeral.carreamento)} coletas de transporte`}
                icon={Truck}
                tone={totalsGeral.carreamentoScore >= 90 ? 'green' : totalsGeral.carreamentoScore >= 80 ? 'warning' : 'danger'}
                loading={loading}
              />
            )}
            <KpiCard
              title="Taxa de Sincronização"
              value={`${totalsGeral.syncRate}%`}
              subtitle={`${fmt(totalsGeral.sincronizados)} coletas concluídas`}
              icon={TrendingUp}
              tone="info"
              loading={loading}
            />
          </div>

          <SectionHeader eyebrow="Volumes e Amostragem" title="Escopo do Monitoramento de Campo" color="var(--orange-institutional)" />
          <div className={`grid-container ${areaFilter === 'carreamento' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <KpiCard title="Coletas Recebidas" value={fmt(totalsGeral.total)} subtitle="Total de fichas no banco de dados" icon={ClipboardCheck} tone="green" loading={loading} />
            {areaFilter !== 'carreamento' && (
              <KpiCard title="Cachos Observados" value={fmt(totalsGeral.cachosObservados)} subtitle="Cachos auditados nas linhas" icon={CheckCircle2} tone="info" loading={loading} />
            )}
            <KpiCard title="Linhas Avaliadas" value={fmt(totalsGeral.linhas)} subtitle={`${fmt(totalsGeral.gpsPoints)} pontos GPS no trajeto`} icon={Rows3} tone="orange" loading={loading} />
            <KpiCard title="Plantas Observadas" value={fmt(totalsGeral.plantasObservadas)} subtitle="Base para cálculo de perdas" icon={Sprout} tone="green" loading={loading} />
          </div>

          <SectionHeader eyebrow="Desperdício de Matéria-Prima" title="Estimativa Física de Perdas no Campo" color="var(--status-danger)" />
          <div className="grid-container grid-cols-3" style={{ marginBottom: '24px' }}>
            <KpiCard
              title={areaFilter === 'corte' ? "Cachos Perdidos (Corte)" : areaFilter === 'carreamento' ? "Cachos Perdidos (Logística)" : "Cachos Perdidos (Corte/Logística)"}
              value={`${fmt(totalsGeral.lostCachosQty)} cachos`}
              subtitle={
                areaFilter === 'corte'
                  ? 'Apenas cachos esquecidos'
                  : areaFilter === 'carreamento'
                  ? 'Apenas cachos não carreados'
                  : 'Esquecidos ou não carreados'
              }
              icon={AlertTriangle}
              tone="danger"
              loading={loading}
            />
            <KpiCard
              title="Massa de Frutos Perdida"
              value={`${fmt(totalsGeral.lostFrutosTon, 2)} Toneladas`}
              subtitle="Estimativa física acumulada (20kg/cacho)"
              icon={Weight}
              tone="danger"
              loading={loading}
            />
            <KpiCard
              title="Óleo de Palma (CPO) Perdido"
              value={`${fmt(totalsGeral.lostOilTon, 2)} Ton. de Óleo`}
              subtitle="Rendimento médio estimado de 20%"
              icon={Leaf}
              tone="danger"
              loading={loading}
            />
          </div>

          <div className="grid-container grid-cols-1">
            <CustomChart loading={loading} type="bar" data={chartsGeral.byFarm} title="Coletas por fazenda" />
            {areaFilter === 'all' && (
              <CustomChart loading={loading} type="donut" data={chartsGeral.byForm} title="Participação por formulário" />
            )}
          </div>
          <div className="grid-container grid-cols-1">
            <CustomChart loading={loading} type="line" data={chartsGeral.byDay} title="Evolução diária de coletas" />
            <CustomChart loading={loading} type="bar" data={chartsGeral.byEvaluator} title="Coletas por avaliador" />
          </div>
        </>
      )}

      {/* ============ CQO CORTE ============ */}
      {currentTab === 'corte' && (
        <>
          <SectionHeader eyebrow="Formulário CQO Corte" title="Indicadores de qualidade no corte" color="var(--green-institutional)" />

          {/* KPIs volumétricos com Nota de Qualidade */}
          <div className="grid-container grid-cols-4">
            <KpiCard
              title="Nota CQO Corte"
              value={`${totalsCorte.corteScore} / 100`}
              subtitle="Score geral de qualidade no corte"
              icon={Award}
              tone={totalsCorte.corteScore >= 90 ? 'green' : totalsCorte.corteScore >= 80 ? 'warning' : 'danger'}
              loading={loading}
            />
            <KpiCard title="Fichas de corte" value={fmt(corteRecords.length)} subtitle={`${mediaLinhasCorte} linhas por ficha (média)`} icon={Scissors} tone="green" loading={loading} />
            <KpiCard title="Plantas observadas" value={fmt(totalsCorte.plantasObservadas)} subtitle={`${mediaPlantasPorLinha} plantas/linha (média)`} icon={Sprout} tone="green" loading={loading} />
            <KpiCard title="Cachos observados" value={fmt(totalsCorte.cachosObservados)} subtitle="Total registrado nas linhas" icon={ClipboardCheck} tone="orange" loading={loading} />
          </div>

          {/* KPIs de qualidade */}
          <SectionHeader eyebrow="Qualidade dos cachos" title="Maturação e perdas no corte" color="var(--orange-institutional)" />
          <div className="grid-container grid-cols-4" style={{ marginBottom: '18px' }}>
            <KpiCard
              title="Taxa de maturação"
              value={`${taxaMaturacao.replace('.', ',')}%`}
              subtitle={`${fmt(totalsCorte.cachoMaduro)} cachos maduros`}
              icon={ThumbsUp}
              tone="green"
              loading={loading}
            />
            <KpiCard
              title="Perda no corte"
              value={`${taxaPerda.replace('.', ',')}%`}
              subtitle={`${fmt(totalsCorte.cachoEsquecido)} cachos esquecidos`}
              icon={AlertTriangle}
              tone={Number(totalsCorte.perdaCorteRate) > 1.5 ? 'danger' : 'green'}
              loading={loading}
            />
            <KpiCard
              title="Cachos verdes"
              value={`${totalsCorte.cachoVerdeRate.toFixed(1).replace('.', ',')}%`}
              subtitle={`${fmt(totalsCorte.cachoVerde)} unidades colhidas`}
              icon={Leaf}
              tone={totalsCorte.cachoVerdeRate > 3.0 ? 'danger' : 'warning'}
              loading={loading}
            />
            <KpiCard
              title="Cachos passados"
              value={`${totalsCorte.cachoPassadoRate.toFixed(1).replace('.', ',')}%`}
              subtitle={`${fmt(totalsCorte.cachoPassado)} unidades colhidas`}
              icon={TrendingDown}
              tone={totalsCorte.cachoPassadoRate > 5.0 ? 'danger' : 'warning'}
              loading={loading}
            />
          </div>

          {/* Farol de Alertas e Fitossanitário */}
          <div className="grid-container grid-cols-2" style={{ marginBottom: '24px' }}>
            {/* Card 1: Farol de Alertas */}
            <div className="card" style={{ padding: '16px' }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h3 className="card-title">Farol de Alertas e Tolerâncias</h3>
                  <span className="card-subtitle">Limites estabelecidos pelo controle de qualidade</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Farol 1: Cachos Esquecidos */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', borderLeft: `5px solid ${Number(totalsCorte.perdaCorteRate) > 1.5 ? 'var(--status-danger)' : 'var(--status-success)'}` }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>Perda no Corte (Cachos Esquecidos)</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Meta: &lt; 1,5% de perda</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '1rem', color: Number(totalsCorte.perdaCorteRate) > 1.5 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                      {totalsCorte.perdaCorteRate.replace('.', ',')}%
                    </strong>
                    <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)' }}>
                      {Number(totalsCorte.perdaCorteRate) > 1.5 ? 'Fora da Meta 🔴' : 'Conforme 🟢'}
                    </span>
                  </div>
                </div>

                {/* Farol 2: Cachos Verdes */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', borderLeft: `5px solid ${totalsCorte.cachoVerdeRate > 3.0 ? 'var(--status-danger)' : 'var(--status-success)'}` }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>Colheita de Cachos Verdes</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Meta: &lt; 3,0% de verdes</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '1rem', color: totalsCorte.cachoVerdeRate > 3.0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                      {totalsCorte.cachoVerdeRate.toFixed(1).replace('.', ',')}%
                    </strong>
                    <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)' }}>
                      {totalsCorte.cachoVerdeRate > 3.0 ? 'Fora da Meta 🔴' : 'Conforme 🟢'}
                    </span>
                  </div>
                </div>

                {/* Farol 3: Talo Comprido */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', borderLeft: `5px solid ${totalsCorte.taloCompridoRate > 5.0 ? 'var(--status-warning)' : 'var(--status-success)'}` }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>Incidência de Talo Comprido</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Meta: &lt; 5,0% das plantas</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '1rem', color: totalsCorte.taloCompridoRate > 5.0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                      {totalsCorte.taloCompridoRate.toFixed(1).replace('.', ',')}%
                    </strong>
                    <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)' }}>
                      {totalsCorte.taloCompridoRate > 5.0 ? 'Atenção 🟡' : 'Conforme 🟢'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Monitoramento Fitossanitário */}
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="card-header" style={{ marginBottom: 10 }}>
                <div>
                  <h3 className="card-title">Monitoramento Fitossanitário (Pragas)</h3>
                  <span className="card-subtitle">Incidência de ataque de broca na colheita (cachos brocados)</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: 'auto' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Taxa de Infestação por Broca</span>
                <strong style={{ fontSize: '2.2rem', color: totalsCorte.pragasRate > 1.0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                  {totalsCorte.pragasRate.toFixed(1).replace('.', ',')}%
                </strong>
                <span className={`badge ${totalsCorte.pragasRate > 1.0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '4px' }}>
                  {totalsCorte.pragasRate > 1.0 ? 'Risco Fitossanitário Alto ⚠️' : 'Sob Controle 🟢'}
                </span>
              </div>
              <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Quantidade afetada:</span>
                <strong>{fmt(totalsCorte.cachoBrocado)} cachos brocados</strong>
              </div>
            </div>
          </div>

          {/* Detalhe qualitativo */}
          <div className="grid-container grid-cols-2">
            <div className="card">
              <div className="card-header">
                <div>
                   <h3 className="card-title">Distribuição dos cachos no corte</h3>
                  <span className="card-subtitle">Proporção de cada categoria sobre o total observado</span>
                </div>
              </div>
              <div className="quality-stack">
                <QualityBar label="Cachos maduros" value={totalsCorte.cachoMaduro} max={Math.max(totalsCorte.cachosObservados, 1)} color="var(--green-institutional)" loading={loading} />
                <QualityBar label="Cachos verdes" value={totalsCorte.cachoVerde} max={Math.max(totalsCorte.cachosObservados, 1)} color="#F59E0B" loading={loading} />
                <QualityBar label="Cachos passados" value={totalsCorte.cachoPassado} max={Math.max(totalsCorte.cachosObservados, 1)} color="#EF4444" loading={loading} />
                <QualityBar label="Cachos esquecidos" value={totalsCorte.cachoEsquecido} max={Math.max(totalsCorte.cachosObservados, 1)} color="var(--orange-institutional)" loading={loading} />
                <QualityBar label="Cachos estrela" value={totalsCorte.cachoEstrela || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#8B5CF6" loading={loading} />
                <QualityBar label="Cachos brocados" value={totalsCorte.cachoBrocado || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#DC2626" loading={loading} />
                <QualityBar label="Cachos avermelhados" value={totalsCorte.cachoAvermelhado || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#B45309" loading={loading} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                   <h3 className="card-title">Falhas e ocorrências no corte</h3>
                  <span className="card-subtitle">Irregularidades técnicas por categoria</span>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                <StatusBadgeRow label="Cachos mal posicionados" value={totalsCorte.cachoMalPosicionado || 0} total={totalsCorte.plantasObservadas} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Folha cortada indevida" value={totalsCorte.folhaCortada || 0} total={totalsCorte.plantasObservadas} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Folha mamando" value={totalsCorte.folhaMamando || 0} total={totalsCorte.plantasObservadas} color="#8B5CF6" loading={loading} />
                <StatusBadgeRow label="Talo comprido" value={totalsCorte.taloComprido || 0} total={totalsCorte.plantasObservadas} color="var(--orange-institutional)" loading={loading} />
                <StatusBadgeRow label="Cachos brocados" value={totalsCorte.cachoBrocado || 0} total={totalsCorte.plantasObservadas} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Com acompanhamento" value={corteRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} total={corteRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Com registro GPS" value={corteRecords.filter((r) => r.gps).length} total={corteRecords.length} color="var(--status-info)" loading={loading} />
              </div>
            </div>
          </div>

          <div className="grid-container grid-cols-1">
            <CustomChart loading={loading} type="bar" data={chartsCorte.byFarm} title="Cortes por fazenda" />
            <CustomChart loading={loading} type="bar" data={chartsCorte.byEvaluator} title="Cortes por avaliador" />
          </div>
          <div className="grid-container grid-cols-1">
             <CustomChart loading={loading} type="line" data={chartsCorte.byDay} title="Evolução diária — CQO Corte" />
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Resumo de status — CQO Corte</h3>
                  <span className="card-subtitle">Distribuição dos registros por status de transmissão</span>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                 <StatusBadgeRow label="Sincronizados" value={corteRecords.filter((r) => r.status === 'Sincronizado').length} total={corteRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Aprovados" value={corteRecords.filter((r) => r.status === 'Aprovado').length} total={corteRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Reprovados" value={corteRecords.filter((r) => r.status === 'Reprovado').length} total={corteRecords.length} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Pendente validação" value={corteRecords.filter((r) => r.status === 'Pendente validação').length} total={corteRecords.length} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Falha de sincronização" value={corteRecords.filter((r) => r.status === 'Falha').length} total={corteRecords.length} color="var(--status-danger)" loading={loading} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============ CQO CARREAMENTO ============ */}
      {currentTab === 'carreamento' && (
        <>
          <SectionHeader eyebrow="Formulário CQO Carreamento e Fruto Solto" title="Indicadores de transporte e rastreio" color="var(--orange-institutional)" />

          <div className="grid-container grid-cols-4">
            <KpiCard
              title="Nota CQO Carreamento"
              value={`${totalsCarreamento.carreamentoScore} / 100`}
              subtitle="Score geral de qualidade do carreamento"
              icon={Award}
              tone={totalsCarreamento.carreamentoScore >= 90 ? 'green' : totalsCarreamento.carreamentoScore >= 80 ? 'warning' : 'danger'}
              loading={loading}
            />
            <KpiCard title="Fichas carreamento" value={fmt(carreamentoRecords.length)} subtitle={`${fmt(totalsCarreamento.linhas)} linhas registradas`} icon={Truck} tone="orange" loading={loading} />
            <KpiCard title="Plantas observadas" value={fmt(totalsCarreamento.plantasObservadas)} subtitle="Base de cálculo por linha" icon={Sprout} tone="green" loading={loading} />
            <KpiCard title="Peso total frutos" value={`${fmt(totalsCarreamento.pesoMedio, 1)} kg`} subtitle={`Média de ${mediaPeso} kg/ficha`} icon={Weight} tone="info" loading={loading} />
          </div>

          <SectionHeader eyebrow="Irregularidades de transporte" title="Perdas e falhas no carreamento" color="var(--orange-institutional)" />
          <div className="grid-container grid-cols-4" style={{ marginBottom: '18px' }}>
            <KpiCard
              title="Mal posicionados"
              value={`${taxaMalPos.replace('.', ',')}%`}
              subtitle={`${fmt(totalsCarreamento.cachoMalPosicionado)} cachos`}
              icon={AlertTriangle}
              tone={totalsCarreamento.cachoMalPosicionadoRate > 5.0 ? 'danger' : 'warning'}
              loading={loading}
            />
            <KpiCard
              title="Não carreados"
              value={`${taxaNaoCarreado.replace('.', ',')}%`}
              subtitle={`${fmt(totalsCarreamento.cachoNaoCarreado)} cachos`}
              icon={ThumbsDown}
              tone={totalsCarreamento.cachoNaoCarreadoRate > 2.0 ? 'danger' : 'green'}
              loading={loading}
            />
            <KpiCard
              title="Com acompanhamento"
              value={pct(carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length, carreamentoRecords.length)}
              subtitle={`${carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} fichas supervisionadas`}
              icon={CheckCircle2}
              tone="info"
              loading={loading}
            />
            <KpiCard
              title="Aprovação"
              value={pct(carreamentoRecords.filter((r) => r.status === 'Aprovado').length, carreamentoRecords.length)}
              subtitle={`${carreamentoRecords.filter((r) => r.status === 'Aprovado').length} fichas aprovadas`}
              icon={ThumbsUp}
              tone="green"
              loading={loading}
            />
          </div>

          {/* Farol de Alertas e Desperdício Físico */}
          <div className="grid-container grid-cols-2" style={{ marginBottom: '24px' }}>
            {/* Card 1: Farol de Alertas Logísticos */}
            <div className="card" style={{ padding: '16px' }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h3 className="card-title">Farol de Alertas e Tolerâncias Logísticas</h3>
                  <span className="card-subtitle">Limites estabelecidos pelo controle de qualidade de transporte</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Farol 1: Cachos Não Carreados */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', borderLeft: `5px solid ${totalsCarreamento.cachoNaoCarreadoRate > 2.0 ? 'var(--status-danger)' : 'var(--status-success)'}` }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>Perda Logística (Cachos Não Carreados)</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Meta: &lt; 2,0% de perda</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '1rem', color: totalsCarreamento.cachoNaoCarreadoRate > 2.0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                      {totalsCarreamento.cachoNaoCarreadoRate.toFixed(1).replace('.', ',')}%
                    </strong>
                    <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)' }}>
                      {totalsCarreamento.cachoNaoCarreadoRate > 2.0 ? 'Fora da Meta 🔴' : 'Conforme 🟢'}
                    </span>
                  </div>
                </div>

                {/* Farol 2: Cachos Mal Posicionados */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', borderLeft: `5px solid ${totalsCarreamento.cachoMalPosicionadoRate > 5.0 ? 'var(--status-danger)' : 'var(--status-success)'}` }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>Cachos Mal Posicionados na Linha</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Meta: &lt; 5,0% de desvio</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '1rem', color: totalsCarreamento.cachoMalPosicionadoRate > 5.0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                      {totalsCarreamento.cachoMalPosicionadoRate.toFixed(1).replace('.', ',')}%
                    </strong>
                    <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)' }}>
                      {totalsCarreamento.cachoMalPosicionadoRate > 5.0 ? 'Fora da Meta 🔴' : 'Conforme 🟢'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Desperdício Logístico no Campo */}
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="card-header" style={{ marginBottom: 10 }}>
                <div>
                  <h3 className="card-title">Desperdício Físico Estimado (Logística)</h3>
                  <span className="card-subtitle">Estimativa de perdas físicas apenas por cachos não carreados</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: 'auto' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Frutos Deixados no Campo</span>
                <strong style={{ fontSize: '2.2rem', color: totalsCarreamento.cachoNaoCarreado > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                  {fmt((totalsCarreamento.cachoNaoCarreado * 20) / 1000, 2)} Ton.
                </strong>
                <span className={`badge ${totalsCarreamento.cachoNaoCarreado > 0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '4px' }}>
                  {totalsCarreamento.cachoNaoCarreado > 0 ? 'Perda de Matéria-Prima ⚠️' : 'Eficiência Total 🟢'}
                </span>
              </div>
              <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Cachos não carreados:</span>
                <strong>{fmt(totalsCarreamento.cachoNaoCarreado)} cachos</strong>
              </div>
            </div>
          </div>

          <div className="grid-container grid-cols-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Indicadores por linha — Carreamento</h3>
                  <span className="card-subtitle">Proporção sobre total de plantas observadas</span>
                </div>
              </div>
              <div className="quality-stack">
                 <QualityBar label="Plantas observadas" value={totalsCarreamento.plantasObservadas} max={Math.max(totalsCarreamento.plantasObservadas, 1)} color="var(--green-institutional)" loading={loading} />
                <QualityBar label="Cachos mal posicionados" value={totalsCarreamento.cachoMalPosicionado} max={Math.max(totalsCarreamento.plantasObservadas, 1)} color="var(--status-warning)" loading={loading} />
                <QualityBar label="Cachos não carreados" value={totalsCarreamento.cachoNaoCarreado} max={Math.max(totalsCarreamento.plantasObservadas, 1)} color="var(--status-danger)" loading={loading} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Status e rastreabilidade</h3>
                   <span className="card-subtitle">Distribuição por status de transmissão</span>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                 <StatusBadgeRow label="Sincronizados" value={carreamentoRecords.filter((r) => r.status === 'Sincronizado').length} total={carreamentoRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Aprovados" value={carreamentoRecords.filter((r) => r.status === 'Aprovado').length} total={carreamentoRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Reprovados" value={carreamentoRecords.filter((r) => r.status === 'Reprovado').length} total={carreamentoRecords.length} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Pendente validação" value={carreamentoRecords.filter((r) => r.status === 'Pendente validação').length} total={carreamentoRecords.length} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Falha de sincronização" value={carreamentoRecords.filter((r) => r.status === 'Falha').length} total={carreamentoRecords.length} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Com GPS" value={carreamentoRecords.filter((r) => r.gps).length} total={carreamentoRecords.length} color="var(--status-info)" loading={loading} />
                <StatusBadgeRow label="Com acompanhamento" value={carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} total={carreamentoRecords.length} color="var(--status-info)" loading={loading} />
              </div>
            </div>
          </div>

          <div className="grid-container grid-cols-1">
            <CustomChart loading={loading} type="bar" data={chartsCarreamento.byFarm} title="Carreamentos por fazenda" />
            <CustomChart loading={loading} type="bar" data={chartsCarreamento.byEvaluator} title="Carreamentos por avaliador" />
          </div>
          <CustomChart loading={loading} type="line" data={chartsCarreamento.byDay} title="Evolução diária — CQO Carreamento" />
        </>
      )}
    </div>
  );
}
