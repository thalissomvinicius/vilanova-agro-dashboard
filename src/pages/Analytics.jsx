/* eslint-disable no-unused-vars -- a tela de poda mantém variantes de apresentação antigas para alternância rápida durante a reunião. */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  Filter,
  Gauge,
  Leaf,
  MapPinned,
  Maximize2,
  MonitorPlay,
  RefreshCw,
  RotateCcw,
  Rows3,
  Scissors,
  SlidersHorizontal,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Weight,
  X,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import StatusBanner from '../components/ui/StatusBanner';
import { aggregateRecords, buildCharts, filterRecords, useCqoData } from '../utils/cqoData';

const OPEN_CARREAMENTO_PRESENTATION_EVENT = 'vilanova:open-carreamento-presentation';
const OPEN_PODA_PRESENTATION_EVENT = 'vilanova:open-poda-presentation';
const LeafletMap = lazy(() => import('../components/LeafletMap'));

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

// ─── SectionHeader ────────────────────────────────────────────────────────────
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

// ─── QualityBar ───────────────────────────────────────────────────────────────
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

// ─── StatusBadgeRow ───────────────────────────────────────────────────────────
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

// ─── AlertFarol ───────────────────────────────────────────────────────────────
function AlertFarol({ label, meta, value, danger, warning = false }) {
  const numVal = Number(value);
  const isAlert = numVal > danger;
  const isWarn = !isAlert && warning !== false && numVal > warning;
  const color = isAlert ? 'var(--status-danger)' : isWarn ? 'var(--status-warning)' : 'var(--status-success)';
  const borderColor = isAlert ? 'var(--status-danger)' : isWarn ? 'var(--status-warning)' : 'var(--status-success)';
  const label2 = isAlert ? 'Fora da Meta 🔴' : isWarn ? 'Atenção 🟡' : 'Conforme 🟢';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', borderLeft: `5px solid ${borderColor}` }}>
      <div>
        <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>{label}</strong>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{meta}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <strong style={{ fontSize: '1rem', color }}>{String(value).replace('.', ',')}%</strong>
        <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)' }}>{label2}</span>
      </div>
    </div>
  );
}

// ─── RankingAvaliadores ────────────────────────────────────────────────────────
function RankingAvaliadores({ records, loading }) {
  const ranking = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const key = r.evaluator || r.evaluatorMatricula || 'Desconhecido';
      if (!map.has(key)) {
        map.set(key, { nome: key, total: 0, aprovados: 0, gpsEligible: 0, comGps: 0 });
      }
      const entry = map.get(key);
      entry.total += 1;
      if (r.status === 'Aprovado') entry.aprovados += 1;
      if (r.gpsApplicable !== false) {
        entry.gpsEligible += 1;
        if (r.gps) entry.comGps += 1;
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [records]);

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Ranking de Avaliadores</h3>
          <span className="card-subtitle">Performance individual de campo</span>
        </div>
        <div className="skeleton-chart" style={{ height: 160 }} />
      </div>
    );
  }

  if (ranking.length === 0) {
    return null;
  }

  const maxTotal = ranking[0]?.total || 1;

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} color="var(--green-institutional)" />
          <div>
            <h3 className="card-title">Ranking de Avaliadores</h3>
            <span className="card-subtitle">Performance individual de campo no período selecionado</span>
          </div>
        </div>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: 8, backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Avaliador</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Coletas</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Aprovação</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>GPS</span>
      </div>

      {ranking.map((item, idx) => {
        const barPct = (item.total / maxTotal) * 100;
        const aprPct = item.total > 0 ? ((item.aprovados / item.total) * 100).toFixed(0) : 0;
        const gpsPct = item.gpsEligible > 0 ? ((item.comGps / item.gpsEligible) * 100).toFixed(0) : null;
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span style={{display: 'inline-block', width: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600}}>{idx + 1}º</span>;
        
        return (
          <div key={item.nome} className="ranking-row" style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', gap: 12, padding: '10px 12px', alignItems: 'center', borderBottom: '1px dashed var(--border-color)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>{medal}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.nome}</span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', width: 'calc(100% - 28px)', marginLeft: '28px' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: idx < 3 ? 'var(--orange-institutional)' : 'var(--status-neutral)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
              </div>
            </div>
            <span style={{ textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.total}</span>
            <span style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: Number(aprPct) >= 80 ? 'var(--status-success)' : Number(aprPct) >= 50 ? 'var(--status-warning)' : 'var(--status-danger)' }}>{aprPct}%</span>
            <span style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: gpsPct !== null && Number(gpsPct) >= 80 ? 'var(--status-info)' : 'var(--text-muted)' }}>{gpsPct === null ? 'N/D' : `${gpsPct}%`}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ areaFilter }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16, color: 'var(--text-muted)' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ClipboardCheck size={32} color="var(--text-muted)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Nenhuma coleta no período</h3>
        <p style={{ margin: '6px 0 0', fontSize: '0.87rem' }}>
          {areaFilter !== 'all'
            ? 'Tente ampliar o período ou trocar o filtro de formulário.'
            : 'Nenhuma ficha foi sincronizada no intervalo selecionado.'}
        </p>
      </div>
    </div>
  );
}

function formatPercentValue(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/D';
  return `${Number(value || 0).toFixed(digits).replace('.', ',')}%`;
}

function resolveRecordDate(record) {
  const candidates = [
    record?.raw?.data_avaliacao,
    record?.raw?.data,
    record?.raw?.Data,
    record?.sentAt,
    record?.createdAt,
    record?.date,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (!text) continue;
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const parsed = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      const parsed = new Date(`${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function latestCollectionLabel(records) {
  const latest = (records || []).reduce((latestDate, record) => {
    const date = resolveRecordDate(record);
    if (!date) return latestDate;
    return !latestDate || date > latestDate ? date : latestDate;
  }, null);

  return latest ? new Intl.DateTimeFormat('pt-BR').format(latest) : '--';
}

function formatMonthYear(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return 'Todos os tempos';
  if (!dateFrom || !dateTo) return 'Período filtrado';
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 'Período filtrado';
  const isFullYear = from.getMonth() === 0 && from.getDate() === 1 && to.getMonth() === 11 && to.getDate() === 31;
  if (isFullYear) return String(from.getFullYear());
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(from);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${from.getFullYear()}`;
}

const PODA_PRESENTATION_DEMO_ENABLED = false;

const PODA_DEMO_SPECS = [
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


function demoDateFromRange(dayOffset, dateFrom, dateTo) {
  const fallback = new Date('2026-06-01T00:00:00');
  const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : fallback;
  const end = dateTo ? new Date(`${dateTo}T00:00:00`) : new Date(start);
  if (Number.isNaN(start.getTime())) return fallback;
  if (Number.isNaN(end.getTime()) || end < start) return start;

  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const date = new Date(start);
  date.setDate(start.getDate() + Math.min(dayOffset, spanDays));
  return date;
}

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

function buildPodaDemoRecords() {
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



function podaIndicatorDefinitions(totals) {
  return [
    { key: 'plantaSemPodar', label: 'Planta sem podar', count: totals.plantaSemPodar, projected: totals.plantaSemPodarProjetada, rate: totals.plantaSemPodarRate, danger: 1 },
    { key: 'cachoExposto', label: 'Cacho exposto', count: totals.cachoExposto, projected: totals.cachoExpostoProjetado, rate: totals.cachoExpostoRate, danger: 2 },
    { key: 'podaMeiaCoroa', label: 'Poda meia coroa', count: totals.podaMeiaCoroa, projected: totals.podaMeiaCoroaProjetada, rate: totals.podaMeiaCoroaRate, danger: 2 },
    { key: 'podaMaiorUmParaUm', label: 'Poda maior que 1:1', count: totals.podaMaiorUmParaUm, projected: totals.podaMaiorUmParaUmProjetada, rate: totals.podaMaiorUmParaUmRate, danger: 2 },
    { key: 'bicoGaita', label: 'Bico de gaita', count: totals.bicoGaita, projected: totals.bicoGaitaProjetado, rate: totals.bicoGaitaRate, danger: 2 },
    { key: 'cachoPodrePlanta', label: 'Cacho podre na planta', count: totals.cachoPodrePlanta, projected: totals.cachoPodrePlantaProjetado, rate: totals.cachoPodrePlantaRate, danger: 1 },
    { key: 'folhaMamando', label: 'Folha mamando', count: totals.folhaMamando, projected: totals.folhaMamandoProjetada, rate: totals.folhaMamandoPodaRate, danger: 2 },
    { key: 'palhaMalEmpilhada', label: 'Palha mal empilhada', count: totals.palhaMalEmpilhada, projected: totals.palhaMalEmpilhadaProjetada, rate: totals.palhaMalEmpilhadaRate, danger: 2 },
  ].map((row) => {
    const rawRate = Number(row.rate || 0);
    const displayRate = Number(rawRate.toFixed(1));
    const dangerLimit = row.danger;
    const warningLimit = row.danger * 0.8;
    return {
      ...row,
      count: Number(row.count || 0),
      projected: Number(row.projected || 0),
      rate: rawRate,
      status: displayRate >= dangerLimit ? 'Crítico' : displayRate >= warningLimit ? 'Atenção' : 'Dentro da meta',
    };
  });
}

function buildPodaIndicatorRows(totals) {
  return podaIndicatorDefinitions(totals).sort((a, b) => b.rate - a.rate);
}

function buildPodaGroupedRows(records, keyGetter) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = keyGetter(record);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(record);
  });

  return Array.from(buckets.entries())
    .map(([label, recs]) => {
      const totals = aggregateRecords(recs);
      const indicators = buildPodaIndicatorRows(totals);
      const topIssue = indicators.find((row) => row.count > 0) || indicators[0];
      return {
        label,
        total: recs.length,
        plantas: totals.podaPlantasObservadas,
        value: topIssue?.rate || 0,
        issue: topIssue?.label || 'Sem falha',
        issueRate: topIssue?.rate || 0,
        count: topIssue?.count || 0,
        projected: topIssue?.projected || 0,
      };
    })
    .sort((a, b) => b.value - a.value);
}

function parsePodaRecordDate(record) {
  const raw = record?.raw?.data_avaliacao || record?.createdAt || record?.date || '';
  const text = String(raw).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const parsed = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const parsed = new Date(`${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function podaWeekLabel(record) {
  const date = parsePodaRecordDate(record);
  if (!date) return 'Semana N/D';

  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - firstDay) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + firstDay.getDay()) / 7);
  return `Semana ${String(week).padStart(2, '0')}/${date.getFullYear()}`;
}

function podaMonthLabel(record) {
  const date = parsePodaRecordDate(record);
  if (!date) return 'Mês N/D';
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date);
  return month.replace('.', '').replace(/\s+de\s+/i, '/');
}

function formatPodaChartLabel(label) {
  const text = String(label || '');
  const week = text.match(/Semana\s+(\d+)/i);
  if (week) return `Sem. ${week[1]}`;

  const date = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/);
  if (date) return `${date[1].padStart(2, '0')}/${date[2].padStart(2, '0')}`;

  return text.length > 10 ? `${text.slice(0, 9)}...` : text;
}

function podaDateLabel(record) {
  const date = parsePodaRecordDate(record);
  if (!date) return record?.date || 'Sem data';
  return String(date.getDate()).padStart(2, '0');
}

function podaIndicatorFromTotals(totals, indicatorKey) {
  return podaIndicatorDefinitions(totals).find((row) => row.key === indicatorKey)
    || podaIndicatorDefinitions(totals)[0];
}

function buildPodaSpecificBreakdown(records, indicatorKey, keyGetter) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = keyGetter(record) || 'N/D';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(record);
  });

  return Array.from(buckets.entries())
    .map(([label, recs]) => {
      const totals = aggregateRecords(recs);
      const indicator = podaIndicatorFromTotals(totals, indicatorKey);
      return {
        label,
        total: recs.length,
        plantas: totals.podaPlantasObservadas,
        score: totals.podaScore,
        count: indicator?.count || 0,
        projected: indicator?.projected || 0,
        rate: indicator?.rate || 0,
        status: indicator?.status || 'Dentro da meta',
        value: indicator?.rate || 0,
      };
    })
    .sort((a, b) => (b.rate - a.rate) || (b.count - a.count) || String(a.label).localeCompare(String(b.label)));
}

function buildPodaSpecificDayRows(records, indicatorKey) {
  return buildPodaSpecificBreakdown(records, indicatorKey, podaDateLabel)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
    .map((row) => ({
      label: row.label,
      rate: row.rate,
      falhas: row.count,
    }))
    .slice(-12);
}

function buildPodaSpecificChartRows(records, indicatorKey, keyGetter, limit = 8) {
  return buildPodaSpecificBreakdown(records, indicatorKey, keyGetter)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
    .slice(-limit)
    .map((row) => ({
      label: row.label,
      rate: row.rate,
      falhas: row.count,
    }));
}

function initialsFromName(name) {
  const parts = String(name || 'EQ').split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'EQ';
}

const PODA_MAP_METRIC_BY_KEY = {
  plantaSemPodar: 'poda_planta_sem_podar',
  cachoExposto: 'poda_cacho_exposto',
  podaMeiaCoroa: 'poda_meia_coroa',
  podaMaiorUmParaUm: 'poda_maior_1_1',
  bicoGaita: 'poda_bico_gaita',
  cachoPodrePlanta: 'poda_cacho_podre',
  folhaMamando: 'poda_folha_mamando',
  palhaMalEmpilhada: 'poda_palha_mal_empilhada',
};

function readableFilter(value, fallback) {
  if (!value || value === 'all') return fallback;
  return String(value);
}

function periodParts(periodText) {
  const text = String(periodText || 'Todos os períodos');
  const year = text.match(/\b(20\d{2})\b/)?.[1] || 'Todos';
  return { month: text, year };
}

function PodaFilterBar({
  filters = {},
  periodText,
  selectedIndicator,
  selectedKey,
  onQuickFilter,
  source,
  recordsCount = 0,
  totals = {},
  demoActive = false,
}) {
  const { year } = periodParts(periodText);
  const chips = [
    periodText || 'Todos os períodos',
    demoActive ? 'Dados manuais temporários' : source || 'Base atual',
    `${fmt(recordsCount)} coletas`,
    `${fmt(totals.linhas)} linhas`,
    `${fmt(totals.podaPlantasObservadas)} plantas`,
    `Fazenda: ${readableFilter(filters.farmFilter, 'Todas')}`,
    `Fiscal equipe: ${readableFilter(filters.evaluatorFilter, 'Todos')}`,
    `Ano: ${year}`,
    `Foco: ${selectedIndicator?.label || 'Todas as falhas'}`,
  ];

  return (
    <section className="carreamento-bi-filter-strip poda-context-strip" aria-label="Contexto do painel CQO Poda">
      <div className="poda-context-chips">
        {chips.map((chip) => <span key={chip}>{chip}</span>)}
      </div>
      <div className="poda-context-actions" aria-label="Filtros rápidos">
        <button
          type="button"
          className={selectedKey === 'cachoExposto' ? 'active' : ''}
          onClick={() => onQuickFilter('cachoExposto')}
        >
          Apenas Cacho Exposto
        </button>
        <button
          type="button"
          className={selectedKey === 'palhaMalEmpilhada' ? 'active' : ''}
          onClick={() => onQuickFilter('palhaMalEmpilhada')}
        >
          Apenas Palha Mal Empilhada
        </button>
      </div>
    </section>
  );
}

function PodaPrimaryAlertCard({ topIssue, topParcel }) {
  return (
    <section className="poda-exec-card poda-alert-card">
      <div>
        <span className="poda-card-eyebrow">Alerta principal</span>
        <h3>{topIssue?.label || 'Sem falha crítica'}</h3>
      </div>
      <div className="poda-alert-metric">
        <strong>{topIssue ? formatPercentValue(topIssue.rate) : '0,0%'}</strong>
        <span>da amostra</span>
      </div>
      <div className="poda-alert-details">
        <div>
          <span>Ocorrências</span>
          <strong>{fmt(topIssue?.count || 0)}</strong>
        </div>
        <div>
          <span>Projetadas</span>
          <strong>{fmt(topIssue?.projected || 0)}</strong>
        </div>
      </div>
      <p>Parcela crítica: <strong>{topParcel?.label || 'Sem parcela no filtro'}</strong></p>
    </section>
  );
}

function PodaFaultRankingPanel({ indicators, selectedKey, onSelect }) {
  const max = Math.max(...indicators.map((row) => row.rate), 1);
  return (
    <section className="poda-exec-card poda-fault-panel">
      <div className="poda-section-title">
        <div>
          <span className="poda-card-eyebrow">Principais falhas - % da amostra</span>
          <h3>Ranking de indicadores</h3>
        </div>
        <div className="poda-fault-tabs" aria-label="Filtros visuais de falhas">
          {['Todas', 'Críticas', 'Atenção', 'Poda', 'Cacho', 'Planta'].map((tab, index) => (
            <button type="button" className={index === 0 ? 'active' : ''} key={tab}>{tab}</button>
          ))}
        </div>
      </div>
      <div className="poda-fault-strip">
        {indicators.map((row) => (
          <button
            type="button"
            className={`poda-fault-row poda-fault-${row.status === 'Crítico' ? 'danger' : row.status === 'Atenção' ? 'warning' : 'ok'} ${selectedKey === row.key ? 'active' : ''}`}
            key={row.key}
            onClick={() => onSelect?.(row.key)}
            style={{ '--fault-color': row.color }}
          >
            <span>{row.label}</span>
            <strong>{formatPercentValue(row.rate)}</strong>
            <em>{row.status === 'Dentro da meta' ? '↓' : '↑'}</em>
            <div className="poda-fault-track">
              <i style={{ width: `${Math.max((row.rate / max) * 100, row.rate > 0 ? 3 : 0)}%`, background: row.color }} />
            </div>
            <small>{fmt(row.count)} ocorr. · {fmt(row.projected)} proj.</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function PodaTeamStatsPanel({ rows, indicator }) {
  const visibleRows = rows.slice(0, 10);
  const colors = ['#0B6B3A', '#F28C00', '#7C3AED', '#2563EB', '#DC2626'];

  return (
    <section className="poda-exec-card poda-team-stats-card">
      <div className="poda-section-title compact">
        <div>
          <span className="poda-card-eyebrow">Estatísticas por equipe</span>
          <h3>{indicator?.label || 'Falhas'} por fiscal responsável</h3>
        </div>
      </div>
      <div className="poda-team-stats-list">
        {visibleRows.length ? visibleRows.map((row, index) => (
          <div className="poda-team-stat-row" key={row.label}>
            <div className="poda-team-stat-info">
              <span style={{ background: colors[index % colors.length] }}>{initialsFromName(row.label)}</span>
              <strong>{row.label}</strong>
            </div>
            <div className="poda-team-stat-metrics">
              <div className="poda-team-stat-rate">
                <strong>{formatPercentValue(row.rate)}</strong>
                <em className={row.status === 'Dentro da meta' ? 'good' : 'bad'}>{row.status === 'Dentro da meta' ? '↓' : '↑'}</em>
              </div>
              <div className="poda-team-stat-counts">
                <span>{fmt(row.count)} ocorr.</span>
                <span>{fmt(row.projected)} proj.</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="poda-team-empty">Sem fiscais no filtro atual.</div>
        )}
      </div>
    </section>
  );
}

function PodaTopIndicators({ indicators, selectedKey, onSelect }) {
  const sorted = [...indicators].sort((a, b) => {
    const statusVal = (s) => (s === 'Crítico' ? 3 : s === 'Atenção' ? 2 : 1);
    return statusVal(b.status) - statusVal(a.status);
  });
  const visible = sorted.slice(0, 8);
  return (
    <div className="poda-top-indicators">
      {visible.map((ind) => {
        const statusClass = ind.status === 'Crítico' ? 'danger' : ind.status === 'Atenção' ? 'warning' : 'ok';
        return (
          <button
            key={ind.key}
            type="button"
            className={`poda-top-kpi-card ${statusClass} ${selectedKey === ind.key ? 'active' : ''}`}
            onClick={() => onSelect?.(ind.key)}
          >
            <div className="poda-top-kpi-header">
              <h4>{ind.label}</h4>
              <span className={`poda-kpi-badge ${statusClass}`}>
                {ind.status === 'Crítico' ? '🔴' : ind.status === 'Atenção' ? '🟡' : '🟢'}
              </span>
            </div>
            <div className="poda-top-kpi-body">
              <strong className={`poda-kpi-rate ${statusClass}`}>{formatPercentValue(ind.rate)}</strong>
            </div>
            <div className="poda-top-kpi-footer">
              <div className="poda-kpi-track">
                <i style={{ width: `${Math.min((ind.rate / (ind.danger || 2)) * 100, 100)}%`, background: statusClass === 'danger' ? 'var(--danger-color)' : statusClass === 'warning' ? 'var(--warning-color)' : 'var(--green-institutional)' }} />
              </div>
              <small>Meta: &lt; {formatPercentValue(ind.danger)}</small>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PodaBreakdownList({ title, rows, limit = 5 }) {
  const visibleRows = rows.slice(0, limit);
  return (
    <section className="poda-breakdown-card">
      <div className="poda-breakdown-header">
        <h3>{title}</h3>
      </div>
      <div className="poda-breakdown-list">
        {visibleRows.length ? visibleRows.map((row) => (
          <div className={`poda-breakdown-row status-${row.status === 'Crítico' ? 'danger' : row.status === 'Atenção' ? 'warning' : 'ok'}`} key={row.label}>
            <div className="poda-breakdown-info">
              <strong>{row.label}</strong>
              <span>{fmt(row.total)} coletas</span>
            </div>
            <div className="poda-breakdown-metrics">
              <strong className="rate">{formatPercentValue(row.rate)}</strong>
              <small>{fmt(row.count)} ocorr.</small>
            </div>
          </div>
        )) : (
          <div className="poda-breakdown-empty">Nenhum dado</div>
        )}
      </div>
    </section>
  );
}

function PodaDrilldownPanel({ indicator, activeBreakdown, onBreakdownChange, breakdowns }) {
  const tabs = [
    { id: 'parcel', label: 'Parcelas' },
    { id: 'farm', label: 'Fazendas' },
    { id: 'fiscal', label: 'Fiscais' },
    { id: 'week', label: 'Semanas' },
    { id: 'month', label: 'Meses' },
  ];
  const rows = breakdowns[activeBreakdown] || [];
  const visibleRows = rows.slice(0, 4);
  const max = Math.max(...visibleRows.map((row) => Number(row.rate || 0)), 1);

  return (
    <section className="poda-exec-card poda-drill-panel">
      <div className="poda-section-title">
        <div>
          <span className="poda-card-eyebrow">Análise interativa</span>
          <h3>{indicator?.label || 'Indicador'}</h3>
          <span>Clique em outra falha no ranking para trocar toda a leitura.</span>
        </div>
        <div className="poda-drill-status">
          <strong>{formatPercentValue(indicator?.rate || 0)}</strong>
          <span>{indicator?.status || 'Dentro da meta'}</span>
        </div>
      </div>

      <div className="poda-drill-kpis">
        <div><span>Ocorrências</span><strong>{fmt(indicator?.count || 0)}</strong></div>
        <div><span>Projetadas</span><strong>{fmt(indicator?.projected || 0)}</strong></div>
        <div><span>Meta</span><strong>{indicator ? `< ${formatPercentValue(indicator.danger)}` : '-'}</strong></div>
      </div>

      <div className="poda-drill-tabs" aria-label="Dimensão da análise">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={activeBreakdown === tab.id ? 'active' : ''}
            onClick={() => onBreakdownChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="poda-drill-table">
        {visibleRows.length ? visibleRows.map((row) => (
          <div className={`poda-drill-row poda-drill-${row.status === 'Crítico' ? 'danger' : row.status === 'Atenção' ? 'warning' : 'ok'}`} key={row.label}>
            <div>
              <strong>{row.label}</strong>
              <span>{fmt(row.total)} coleta(s) · {fmt(row.plantas)} plantas analisadas</span>
            </div>
            <em>{formatPercentValue(row.rate)}</em>
            <small>{fmt(row.count)} / {fmt(row.projected)} proj.</small>
            <div className="poda-drill-track">
              <i style={{ width: `${Math.max((Number(row.rate || 0) / max) * 100, row.rate > 0 ? 3 : 0)}%` }} />
            </div>
          </div>
        )) : (
          <div className="poda-drill-empty">Sem dados para este indicador no filtro atual.</div>
        )}
      </div>
    </section>
  );
}

function PodaMiniBars({ title, subtitle, rows, valueLabel = 'risco', maxRows = 3, className = '' }) {
  const visibleRows = rows.slice(0, maxRows);
  const max = Math.max(...visibleRows.map((row) => Number(row.value || 0)), 1);

  return (
    <section className={`poda-exec-card poda-mini-panel ${className}`.trim()}>
      <div className="poda-section-title compact">
        <div>
          <h3>{title}</h3>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="poda-bi-bars">
        {visibleRows.map((row) => (
          <div className="poda-bi-bar-row" key={row.label}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.issue} · {fmt(row.total)} coleta(s)</span>
            </div>
            <div className="poda-bi-bar-track">
              <i style={{ width: `${Math.max((Number(row.value || 0) / max) * 100, row.value > 0 ? 3 : 0)}%` }} />
            </div>
            <small>{valueLabel === 'score' ? fmt(row.score) : formatPercentValue(row.issueRate)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function PodaMapPanel({ mapProps, selectedIndicator, mapMetricId }) {
  return (
    <section className="poda-exec-card poda-map-panel">
      <div className="poda-map-panel-head">
        <div>
          <span className="poda-card-eyebrow">Mapa das parcelas</span>
          <h3>Onde estão ocorrendo os problemas</h3>
          <p>Shapes das parcelas coloridos conforme o índice de {selectedIndicator?.label?.toLowerCase() || 'falha'}.</p>
        </div>
        <div className="poda-map-legend">
          <span><i className="good" />Dentro da meta</span>
          <span><i className="attention" />Atenção</span>
          <span><i className="critical" />Crítico</span>
        </div>
      </div>
      <div className="poda-map-frame">
        <Suspense
          fallback={(
            <div className="poda-map-loading">
              <div className="gps-map-loading-spinner" />
              <strong>Carregando mapa das parcelas</strong>
              <span>Preparando shapefiles e indicador selecionado.</span>
            </div>
          )}
        >
          <LeafletMap
            key={`poda-map-${mapMetricId}`}
            {...mapProps}
            areaFilter="poda"
            initialOperation="poda"
            initialMetricId={mapMetricId}
            presentationMode
          />
        </Suspense>
      </div>
    </section>
  );
}

function PodaTrendPanel({ rows, issueLabel = 'Falhas', title = 'Evolução no período', subtitle }) {
  const visibleRows = rows.slice(-10);
  const chartHeight = 280;
  const padding = { top: 50, right: 24, bottom: 48, left: 52 };
  const colWidth = 80;
  const barWidth = 44;
  const width = Math.max(480, padding.left + padding.right + visibleRows.length * colWidth);
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const maxFailure = Math.max(...visibleRows.map((row) => Number(row.falhas || 0)), 1) * 1.2;
  const maxRate = Math.max(...visibleRows.map((row) => Number(row.rate || 0)), 0.1) * 1.2;

  const ratePoints = visibleRows.map((row, index) => {
    const colCenter = padding.left + index * colWidth + colWidth / 2;
    const y = padding.top + graphHeight - (Number(row.rate || 0) / maxRate) * graphHeight;
    return { x: colCenter, y: Math.max(padding.top + 4, y), row };
  });
  const ratePath = ratePoints.length > 1
    ? ratePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : null;

  // gradient area under line
  const areaPath = ratePoints.length > 1
    ? `${ratePath} L ${ratePoints[ratePoints.length - 1].x} ${padding.top + graphHeight} L ${ratePoints[0].x} ${padding.top + graphHeight} Z`
    : null;

  return (
    <section className="poda-trend-panel-v2">
      <div className="poda-trend-panel-header">
        <div>
          <h3>{title}</h3>
          <span>{subtitle || `% da amostra de ${issueLabel.toLowerCase()} por período`}</span>
        </div>
        <div className="poda-bi-legend">
          <span><i style={{ background: 'var(--green-institutional)' }} />% Falha</span>
          <span><i style={{ background: 'var(--orange-institutional)' }} />Ocorrências</span>
        </div>
      </div>
      <div className="poda-trend-chart-scroll">
        {visibleRows.length === 0 ? (
          <div className="poda-trend-empty">Sem dados no período</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight} className="poda-trend-svg">
            <defs>
              <linearGradient id="poda-rate-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--green-institutional)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--green-institutional)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + graphHeight * (1 - ratio);
              return (
                <g key={ratio}>
                  <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#E5E7EB" strokeWidth="1" strokeDasharray={ratio === 0 ? 'none' : '4 3'} />
                  <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text" fontSize="10">
                    {formatPercentValue(maxRate * ratio, 1)}
                  </text>
                </g>
              );
            })}

            {/* Bars (occurrences) */}
            {visibleRows.map((row, index) => {
              const colCenter = padding.left + index * colWidth + colWidth / 2;
              const bx = colCenter - barWidth / 2;
              const barH = Math.max((Number(row.falhas || 0) / maxFailure) * (graphHeight * 0.65), Number(row.falhas || 0) > 0 ? 3 : 0);
              const by = padding.top + graphHeight - barH;
              return (
                <g key={row.label}>
                  <rect x={bx} y={by} width={barWidth} height={barH} rx="5" fill="var(--orange-institutional)" opacity="0.75">
                    <title>{`${row.label}: ${fmt(row.falhas)} ocorrências`}</title>
                  </rect>
                  {Number(row.falhas || 0) > 0 && barH > 18 && (
                    <text x={colCenter} y={by + barH / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
                      {fmt(row.falhas)}
                    </text>
                  )}
                  <text x={colCenter} y={chartHeight - 12} textAnchor="middle" className="chart-axis-text" fontSize="11" fontWeight="600">
                    {formatPodaChartLabel(row.label)}
                  </text>
                </g>
              );
            })}

            {/* Area under line */}
            {areaPath && <path d={areaPath} fill="url(#poda-rate-grad)" />}

            {/* Rate line */}
            {ratePath && (
              <path d={ratePath} fill="none" stroke="var(--green-institutional)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Rate dots + labels */}
            {ratePoints.map((point, idx) => {
              const labelText = formatPercentValue(point.row.rate);
              const labelAbove = idx % 2 === 0;
              const labelY = labelAbove
                ? Math.max(padding.top + 6, point.y - 14)
                : Math.min(padding.top + graphHeight - 4, point.y + 18);
              const textWidth = labelText.length * 6.5 + 8;
              return (
                <g key={`dot-${point.row.label}`}>
                  <circle cx={point.x} cy={point.y} r="5" fill="var(--green-institutional)" stroke="white" strokeWidth="2.5">
                    <title>{`${point.row.label}: ${labelText}`}</title>
                  </circle>
                  <rect
                    x={point.x - textWidth / 2}
                    y={labelY - 9}
                    width={textWidth}
                    height={14}
                    rx="3"
                    fill="white"
                    fillOpacity="0.9"
                  />
                  <text x={point.x} y={labelY} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--green-institutional)">
                    {labelText}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </section>
  );
}



function PodaFarmsComparisonChart({ records, selectedKey, selectedFarm, onSelectFarm }) {
  const farmNames = ['FÉ EM DEUS', 'VILA NOVA', 'SANTA MARIA'];
  const data = farmNames.map(farm => {
    const farmRecords = records.filter(r => r.farm === farm);
    const totals = aggregateRecords(farmRecords);
    const indicators = podaIndicatorDefinitions(totals);
    const ind = indicators.find(i => i.key === selectedKey) || { rate: 0, count: 0, status: 'Dentro da meta' };
    return {
      farm,
      rate: ind.rate,
      count: ind.count,
      total: farmRecords.length,
      status: ind.status
    };
  });

  const chartData = data.map(d => ({
    label: d.farm,
    value: Number(d.rate.toFixed(1)),
    fill: d.farm === selectedFarm ? 'var(--orange-highlight)' : 'var(--green-institutional)',
    originalFarm: d.farm
  }));

  return (
    <section className="poda-breakdown-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="poda-breakdown-header">
        <div>
          <h3>Gráfico por Fazenda</h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>% de falha do indicador selecionado</span>
        </div>
      </div>
      <div style={{ padding: '0 16px', flex: 1, display: 'flex', alignItems: 'stretch', minHeight: 240 }}>
        <CustomChart type="bar" data={chartData} height={240} hideCard title="Comparação de Fazendas" />
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {data.map(d => (
          <button 
            key={d.farm}
            onClick={() => onSelectFarm(d.farm)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: `1px solid ${selectedFarm === d.farm ? 'var(--orange-institutional)' : 'var(--border-color)'}`,
              background: selectedFarm === d.farm ? 'var(--orange-light)' : 'transparent',
              color: selectedFarm === d.farm ? 'var(--orange-institutional)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {d.farm}
          </button>
        ))}
      </div>
    </section>
  );
}

function PodaFarmParcelsChart({ records, selectedKey, selectedFarm, onSelectFarm }) {
  const farmRecords = records.filter(r => r.farm === selectedFarm);
  const buckets = new Map();
  farmRecords.forEach(r => {
    const p = r.parcel || 'Sem parcela';
    if (!buckets.has(p)) buckets.set(p, []);
    buckets.get(p).push(r);
  });
  const data = Array.from(buckets.entries()).map(([parcel, recs]) => {
    const totals = aggregateRecords(recs);
    const indicators = podaIndicatorDefinitions(totals);
    const ind = indicators.find(i => i.key === selectedKey) || { rate: 0, count: 0, status: 'Dentro da meta' };
    return {
      parcel,
      rate: ind.rate,
      count: ind.count,
    };
  }).sort((a, b) => b.rate - a.rate);

  const chartData = data.slice(0, 8).map(d => ({
    label: d.parcel,
    value: Number(d.rate.toFixed(1)),
    fill: 'var(--green-institutional)'
  }));

  return (
    <section className="poda-breakdown-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="poda-breakdown-header">
        <div>
          <h3>Gráfico por Parcelas</h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Top parcelas da fazenda selecionada</span>
        </div>
        <select 
          value={selectedFarm} 
          onChange={(e) => onSelectFarm(e.target.value)}
          className="poda-period-select"
        >
          <option value="FÉ EM DEUS">Fé em Deus</option>
          <option value="VILA NOVA">Vila Nova</option>
          <option value="SANTA MARIA">Santa Maria</option>
        </select>
      </div>
      <div style={{ padding: '0 16px', flex: 1, display: 'flex', alignItems: 'stretch', minHeight: 240, overflowX: 'auto', overflowY: 'hidden' }}>
        {chartData.length > 0 ? (
          <CustomChart type="bar" data={chartData} height={240} hideCard title="Parcelas Ofensoras" />
        ) : (
          <div className="empty-panel smart-empty-panel" style={{ width: '100%', height: 240, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <strong>Sem parcelas</strong>
            <span>Nenhuma parcela registrada para esta fazenda no período.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function PodaMultiFarmTrendPanel({ records, selectedKey }) {
  const farmNames = ['FÉ EM DEUS', 'VILA NOVA', 'SANTA MARIA'];
  const colors = ['#3B82F6', '#10B981', '#F59E0B'];
  
  const buckets = new Map();
  records.forEach((r) => {
    const k = podaWeekLabel(r);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(r);
  });
  
  const sortedWeeks = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b)).slice(-8);
  
  const series = farmNames.map((farm, idx) => {
    const points = sortedWeeks.map(week => {
      const recs = (buckets.get(week) || []).filter(r => r.farm === farm);
      const totals = aggregateRecords(recs);
      const indicators = podaIndicatorDefinitions(totals);
      const ind = indicators.find(i => i.key === selectedKey) || { rate: 0 };
      return { week, rate: Number(ind.rate || 0) };
    });
    return { farm, color: colors[idx], points };
  });

  const maxRate = Math.max(0.1, ...series.flatMap(s => s.points.map(p => p.rate))) * 1.2;

  const chartHeight = 280;
  const padding = { top: 30, right: 24, bottom: 48, left: 52 };
  const width = Math.max(480, padding.left + padding.right + sortedWeeks.length * 80);
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const stepX = sortedWeeks.length > 1 ? graphWidth / (sortedWeeks.length - 1) : graphWidth;

  return (
    <section className="poda-trend-panel-v2" style={{ marginTop: 16 }}>
      <div className="poda-trend-panel-header">
        <div>
          <h3>Comparação das 3 Fazendas</h3>
          <span>Evolução da taxa de falha por semana</span>
        </div>
        <div className="poda-bi-legend">
          {series.map(s => (
            <span key={s.farm}><i style={{ background: s.color }} />{s.farm}</span>
          ))}
        </div>
      </div>
      <div className="poda-trend-chart-scroll">
        {sortedWeeks.length === 0 ? (
          <div className="poda-trend-empty">Sem dados no período</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight} className="poda-trend-svg">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + graphHeight * (1 - ratio);
              return (
                <g key={ratio}>
                  <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#E5E7EB" strokeWidth="1" strokeDasharray={ratio === 0 ? 'none' : '4 3'} />
                  <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text" fontSize="10">
                    {formatPercentValue(maxRate * ratio, 1)}
                  </text>
                </g>
              );
            })}

            {/* X Axis Labels */}
            {sortedWeeks.map((week, index) => {
              const x = padding.left + index * stepX;
              return (
                <text key={week} x={x} y={chartHeight - 16} textAnchor="middle" className="chart-axis-text" fontSize="11" fontWeight="600">
                  {formatPodaChartLabel(week)}
                </text>
              );
            })}

            {/* Lines and Points */}
            {series.map(s => {
              const pts = s.points.map((p, index) => {
                const x = padding.left + index * stepX;
                const y = padding.top + graphHeight - (p.rate / maxRate) * graphHeight;
                return { x, y, rate: p.rate };
              });
              const pathData = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              return (
                <g key={s.farm}>
                  <path d={pathData} fill="none" stroke={s.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={s.color} strokeWidth="2" />
                      {p.rate > 0 && (
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill={s.color}>
                          {formatPercentValue(p.rate, 1)}
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </section>
  );
}


const PODA_BI_SERIES = [
  { key: 'plantaSemPodar', sourceKey: 'plantaSemPodarRate', label: 'PSP %', fullLabel: 'Planta sem podar %', color: 'var(--status-danger)', meta: 1 },
  { key: 'cachoExposto', sourceKey: 'cachoExpostoRate', label: 'CE %', fullLabel: 'Cacho exposto %', color: 'var(--orange-institutional)', meta: 2 },
  { key: 'podaMeiaCoroa', sourceKey: 'podaMeiaCoroaRate', label: 'PMC %', fullLabel: 'Poda meia coroa %', color: 'var(--text-primary)', meta: 2 },
  { key: 'cachoPodrePlanta', sourceKey: 'cachoPodrePlantaRate', label: 'CP %', fullLabel: 'Cacho podre %', color: 'var(--status-danger)', meta: 1 },
];

const PODA_TOTAL_SECTION_OPTIONS = [
  { id: 'qualidade', label: 'Qualidade' },
  { id: 'falhas', label: 'Falhas' },
  { id: 'amostragem', label: 'Amostragem' },
  { id: 'todos', label: 'Tudo' },
];

function formatPercent(value, digits = 2) {
  return `${fmt(value, digits)}%`;
}

function podaRatesFromTotals(totals) {
  return {
    plantaSemPodar: Number(totals.plantaSemPodarRate || 0),
    cachoExposto: Number(totals.cachoExpostoRate || 0),
    podaMeiaCoroa: Number(totals.podaMeiaCoroaRate || 0),
    cachoPodrePlanta: Number(totals.cachoPodrePlantaRate || 0),
    podaMaiorUmParaUm: Number(totals.podaMaiorUmParaUmRate || 0),
    bicoGaita: Number(totals.bicoGaitaRate || 0),
    folhaMamando: Number(totals.folhaMamandoPodaRate || 0),
    palhaMalEmpilhada: Number(totals.palhaMalEmpilhadaRate || 0),
    samples: Number(totals.podaPlantasObservadas || 0),
  };
}

function buildPodaFarmRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.farm || 'Sem fazenda';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(record);
  });

  return Array.from(buckets.entries())
    .map(([label, recs]) => ({
      label,
      recordsCount: recs.length,
      ...podaRatesFromTotals(aggregateRecords(recs)),
    }))
    .sort((a, b) => (b.cachoExposto + b.plantaSemPodar) - (a.cachoExposto + a.plantaSemPodar));
}

function buildPodaWeekRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const label = podaWeekLabel(record);
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label).push(record);
  });

  return Array.from(buckets.entries())
    .map(([label, recs]) => ({
      label,
      recordsCount: recs.length,
      ...podaRatesFromTotals(aggregateRecords(recs)),
    }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function buildPodaEvaluatorRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.evaluator || record.fiscal || 'Sem fiscal';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(record);
  });

  return Array.from(buckets.entries())
    .map(([label, recs]) => {
      const rates = podaRatesFromTotals(aggregateRecords(recs));
      const risk = rates.plantaSemPodar + rates.cachoExposto + rates.cachoPodrePlanta + rates.podaMeiaCoroa;
      return {
        label,
        recordsCount: recs.length,
        risk,
        ...rates,
      };
    });
}

function buildPodaDailyRows(records) {
  const buckets = new Map();

  records.forEach((record) => {
    const date = parsePodaRecordDate(record);
    const sortKey = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : `sem-data-${record.id}`;
    const label = date
      ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
      : 'Sem data';

    if (!buckets.has(sortKey)) {
      buckets.set(sortKey, { sortKey, label, records: [] });
    }
    buckets.get(sortKey).records.push(record);
  });

  return Array.from(buckets.values())
    .map((bucket) => ({
      sortKey: bucket.sortKey,
      label: bucket.label,
      ...podaRatesFromTotals(aggregateRecords(bucket.records)),
    }))
    .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
}

function podaQualityTone(value, meta, goodWhen = 'low') {
  const numeric = Number(value || 0);
  if (goodWhen === 'high') {
    if (numeric >= meta) return { tone: 'green', status: 'Dentro da meta' };
    return { tone: 'danger', status: 'Fora da meta' };
  }
  if (numeric <= meta) return { tone: 'green', status: 'Dentro da meta' };
  return { tone: 'danger', status: 'Fora da meta' };
}

function PodaBiKpiCard({ label, value, meta, goodWhen = 'low', loading = false }) {
  const tone = podaQualityTone(value, meta, goodWhen);
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

function PodaBiLegend() {
  return (
    <div className="field-bi-legend">
      {PODA_BI_SERIES.map((item) => (
        <span key={item.key}><i style={{ background: item.color }} />{item.fullLabel}</span>
      ))}
    </div>
  );
}

function PodaBiFarmChart({ rows, loading = false }) {
  const visibleRows = rows.slice(0, 5);

  return (
    <section className="field-bi-panel">
      <h3>Qualidade por Fazenda</h3>
      <PodaBiLegend />
      {loading ? (
        <div className="skeleton-chart" style={{ height: 180 }} />
      ) : (
        <div className="field-bi-farm-chart">
          {visibleRows.map((row) => (
            <div className="field-bi-farm-row" key={row.label}>
              <strong>{row.label}</strong>
              <div className="field-bi-farm-bars">
                {PODA_BI_SERIES.map((item, index) => {
                  const value = row[item.key];
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
          ))}
          {!visibleRows.length && (
            <div className="empty-panel smart-empty-panel">
              <strong>Sem dados de fazenda</strong>
              <span>Troque o mês, ano ou fazenda para localizar coletas já sincronizadas.</span>
            </div>
          )}
        </div>
      )}
      <div className="field-bi-axis"><span>0%</span><span>50%</span><span>100%</span></div>
    </section>
  );
}

function PodaBiWeekChart({ rows, loading = false }) {
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
      <PodaBiLegend />
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
                const groupX = padding.left + rowIndex * weekWidth + (weekWidth - barWidth) / 2;
                let stackedHeight = 0;
                return (
                  <g key={row.label}>
                    {PODA_BI_SERIES.map((item) => {
                      const pct = Math.max(0, Math.min(row[item.key], 100));
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
                    <text x={groupX + barWidth / 2} y={chartHeight - 12} textAnchor="middle" className="chart-axis-text">
                      {formatPodaChartLabel(row.label)}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="empty-panel smart-empty-panel">
              <strong>Sem semanas no filtro</strong>
              <span>A visão semanal aparece quando houver coletas dentro do período selecionado.</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PodaFiscalCards({ rows, loading = false }) {
  const visibleRows = rows
    .map((row) => ({
      ...row,
      tone: row.risk > 8 ? 'danger' : row.risk > 4 ? 'warning' : 'success',
    }))
    .sort((a, b) => b.risk - a.risk || b.recordsCount - a.recordsCount)
    .slice(0, 4);

  return (
    <section className="field-bi-panel field-bi-evaluators">
      {loading ? (
        <div className="skeleton-chart" style={{ height: 196 }} />
      ) : (
        <>
          <div className="field-bi-evaluator-head">
            <h3>Fiscal resp. equipe</h3>
            <span>ranking por risco de qualidade da poda</span>
          </div>
          {visibleRows.map((row) => (
            <div className={`field-bi-evaluator-card field-bi-evaluator-${row.tone}`} key={row.label}>
              <strong>
                <span>{row.label}</span>
                <em>{formatPercent(row.risk)} risco</em>
              </strong>
              <div>
                <span><b>{formatPercent(row.plantaSemPodar)}</b>Planta sem podar %</span>
                <span><b>{formatPercent(row.cachoExposto)}</b>Cacho exposto %</span>
                <span><b>{formatPercent(row.podaMeiaCoroa)}</b>Poda meia coroa %</span>
              </div>
              <small>
                {fmt(row.recordsCount)} coleta(s) · {row.tone === 'danger' ? 'prioridade alta' : row.tone === 'warning' ? 'acompanhar' : 'controlado'}
              </small>
            </div>
          ))}
          {!visibleRows.length && (
            <div className="empty-panel smart-empty-panel">
              <strong>Sem fiscais</strong>
              <span>Nenhuma coleta do período trouxe fiscal responsável da equipe válido.</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PodaDailyBarChart({ rows, loading = false }) {
  const series = [
    { key: 'plantaSemPodar', label: 'Planta sem podar %', color: 'var(--status-danger)' },
    { key: 'cachoExposto', label: 'Cacho exposto %', color: 'var(--orange-institutional)' },
    { key: 'podaMeiaCoroa', label: 'Poda meia coroa %', color: 'var(--text-primary)' },
    { key: 'cachoPodrePlanta', label: 'Cacho podre %', color: 'var(--status-danger)' },
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
                          <title>{`${row.label} - ${item.label}: ${formatPercent(value)}`}</title>
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
            <div className="empty-panel smart-empty-panel">
              <strong>Sem barras diárias</strong>
              <span>O gráfico por dia será montado quando houver plantas avaliadas no mês selecionado.</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PodaTotalMetricCard({ label, value, detail, tone = 'neutral', loading = false }) {
  return (
    <div className={`field-total-metric field-total-metric-${tone}`}>
      <span>{label}</span>
      <strong className={loading ? 'skeleton-text' : ''}>{loading ? '\u00A0' : value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function buildPodaTotalMetricGroups(totals, records) {
  return [
    {
      id: 'qualidade',
      title: 'Indicadores de qualidade da poda',
      cards: [
        { label: 'Planta sem podar', value: formatPercent(totals.plantaSemPodarRate), detail: `${fmt(totals.plantaSemPodar)} plantas`, tone: totals.plantaSemPodarRate > 1 ? 'danger' : 'success' },
        { label: 'Cacho exposto', value: formatPercent(totals.cachoExpostoRate), detail: `${fmt(totals.cachoExposto)} ocorrências`, tone: totals.cachoExpostoRate > 2 ? 'danger' : 'neutral' },
        { label: 'Poda meia coroa', value: formatPercent(totals.podaMeiaCoroaRate), detail: `${fmt(totals.podaMeiaCoroa)} ocorrências`, tone: totals.podaMeiaCoroaRate > 2 ? 'warning' : 'neutral' },
        { label: 'Poda maior que 1:1', value: formatPercent(totals.podaMaiorUmParaUmRate), detail: `${fmt(totals.podaMaiorUmParaUm)} ocorrências`, tone: totals.podaMaiorUmParaUmRate > 2 ? 'warning' : 'neutral' },
        { label: 'Bico de gaita', value: formatPercent(totals.bicoGaitaRate), detail: `${fmt(totals.bicoGaita)} ocorrências`, tone: totals.bicoGaitaRate > 2 ? 'warning' : 'neutral' },
        { label: 'Cacho podre na planta', value: formatPercent(totals.cachoPodrePlantaRate), detail: `${fmt(totals.cachoPodrePlanta)} ocorrências`, tone: totals.cachoPodrePlantaRate > 1 ? 'danger' : 'neutral' },
        { label: 'Folha mamando', value: formatPercent(totals.folhaMamandoPodaRate), detail: `${fmt(totals.folhaMamando)} ocorrências`, tone: 'warning' },
        { label: 'Palha mal empilhada', value: formatPercent(totals.palhaMalEmpilhadaRate), detail: `${fmt(totals.palhaMalEmpilhada)} ocorrências`, tone: 'warning' },
      ],
    },
    {
      id: 'falhas',
      title: 'Projeções e ocorrências',
      cards: [
        { label: 'Planta sem podar (proj.)', value: fmt(totals.plantaSemPodarProjetada), detail: `${formatPercent(totals.plantaSemPodarRate)} da amostra`, tone: 'danger' },
        { label: 'Cacho exposto (proj.)', value: fmt(totals.cachoExpostoProjetado), detail: `${formatPercent(totals.cachoExpostoRate)} da amostra`, tone: 'warning' },
        { label: 'Poda meia coroa (proj.)', value: fmt(totals.podaMeiaCoroaProjetada), detail: `${formatPercent(totals.podaMeiaCoroaRate)} da amostra`, tone: 'warning' },
        { label: 'Total projetado', value: fmt(totals.ocorrenciasPodaProjetadas), detail: 'soma das projeções', tone: 'neutral' },
        { label: 'Plantas projetadas', value: fmt(totals.plantasProjetadas), detail: 'base da projeção', tone: 'neutral' },
        { label: 'Fichas com projeção', value: fmt(totals.podaComProjecao), detail: 'coletas com total de plantas', tone: 'neutral' },
      ],
    },
    {
      id: 'amostragem',
      title: 'Amostragem e auditoria',
      cards: [
        { label: 'Fichas de poda', value: fmt(records.length), detail: 'coletas no filtro', tone: 'success' },
        { label: 'Linhas avaliadas', value: fmt(totals.linhas), detail: 'linhas/ruas amostradas', tone: 'neutral' },
        { label: 'Plantas observadas', value: fmt(totals.podaPlantasObservadas), detail: 'base da auditoria', tone: 'neutral' },
        {
          label: 'Registros com GPS',
          value: `${fmt(totals.gps)} / ${fmt(totals.gpsEligible)}`,
          detail: totals.gpsEligible === totals.total ? `${formatPercent(totals.gpsRate)}% das fichas` : `${formatPercent(totals.gpsRate)}% das coletas do app`,
          tone: 'success',
        },
        { label: 'Pontos GPS', value: fmt(totals.gpsPoints), detail: `${fmt(totals.gpsOccurrences)} ocorrências`, tone: 'neutral' },
        { label: 'Score poda', value: fmt(totals.podaScore), detail: 'nota técnica da poda', tone: totals.podaScore >= 85 ? 'success' : 'warning' },
      ],
    },
  ];
}

function PodaTotalDataPanel({ totals, records, selectedSection, loading = false }) {
  const groups = buildPodaTotalMetricGroups(totals, records)
    .filter((group) => selectedSection === 'todos' || group.id === selectedSection);
  const farmRows = buildPodaFarmRows(records).slice(0, 8);

  return (
    <div className={`field-total-panel ${groups.length === 1 ? 'is-single-section' : ''}`}>
      {groups.map((group) => (
        <section className="field-total-section" key={group.id}>
          <h3>{group.title}</h3>
          <div className="field-total-metric-grid">
            {group.cards.map((card) => (
              <PodaTotalMetricCard
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
                <th>Sem podar</th>
                <th>Cacho exposto</th>
                <th>Meia coroa</th>
                <th>Cacho podre</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {farmRows.map((row) => {
                const farmTotals = aggregateRecords(records.filter((record) => (record.farm || 'Sem fazenda') === row.label));
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{fmt(row.recordsCount)}</td>
                    <td>{formatPercent(row.plantaSemPodar)}</td>
                    <td>{formatPercent(row.cachoExposto)}</td>
                    <td>{formatPercent(row.podaMeiaCoroa)}</td>
                    <td>{formatPercent(row.cachoPodrePlanta)}</td>
                    <td>{fmt(farmTotals.podaScore)}</td>
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

function PodaDataHealthPanel({ records, allRecords, loading, source, periodText }) {
  const podaAll = allRecords.filter((record) => record.type === 'poda');
  const visibleCount = records.length;
  const transformedRecords = podaAll.length;
  const hiddenByFilters = Math.max(transformedRecords - visibleCount, 0);

  let tone = 'success';
  let status = 'Dados disponíveis';
  let message = 'O pipeline carregou os dados e há registros visíveis nos filtros atuais.';

  if (transformedRecords > 0 && visibleCount === 0) {
    tone = 'warning';
    status = 'Filtros sem resultado';
    message = `${fmt(transformedRecords)} registro(s) de poda existem na base, mas nenhum passou pelos filtros atuais.`;
  } else if (transformedRecords === 0) {
    tone = 'warning';
    status = 'Sem carga de poda';
    message = 'Nenhuma coleta CQO Poda foi encontrada para montar o dashboard.';
  }

  const cards = [
    { label: 'Base poda', value: transformedRecords, icon: Database },
    { label: 'No filtro', value: visibleCount, icon: Filter },
    { label: 'Ocultos', value: hiddenByFilters, icon: FileSpreadsheet },
  ];

  return (
    <section className={`field-data-health field-data-health-${tone}`}>
      <div className="field-data-health-status">
        <Database size={18} />
        <div>
          <span>Integridade dos dados</span>
          <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : status}</strong>
          {!loading ? <p>{message}</p> : null}
        </div>
      </div>

      <div className="field-data-health-metrics">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon size={16} />
            <span>{label}</span>
            <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : fmt(value)}</strong>
          </div>
        ))}
      </div>

      {!loading ? (
        <div className="field-data-health-meta">
          <span>{source || 'Fonte não informada'}</span>
          <strong>{periodText || 'Todos os tempos'}</strong>
        </div>
      ) : null}
    </section>
  );
}

function PodaBiEmptyState({ recordCount, allPodaCount, onResetFilters }) {
  const hasDataOutsideFilters = allPodaCount > 0;

  return (
    <div className={`field-bi-empty-state field-bi-empty-${hasDataOutsideFilters ? 'warning' : 'danger'}`}>
      <div className="field-bi-empty-icon">
        <AlertTriangle size={30} />
      </div>
      <div>
        <span>{hasDataOutsideFilters ? 'Filtros sem resultado' : 'Sem carga de poda'}</span>
        <h3>{hasDataOutsideFilters ? 'Há dados na base, mas não neste recorte' : 'Nenhum dado CQO Poda disponível'}</h3>
        <p>
          {hasDataOutsideFilters
            ? 'Amplie o período ou limpe os filtros para visualizar as coletas já sincronizadas.'
            : 'Aguarde novas coletas de poda sincronizadas pelo aplicativo.'}
        </p>
        {hasDataOutsideFilters && onResetFilters ? (
          <button type="button" className="btn btn-primary field-bi-empty-action" onClick={onResetFilters}>
            <RotateCcw size={15} />
            Limpar filtros
          </button>
        ) : null}
      </div>
      <div className="field-bi-empty-grid">
        <div><span>Registros na base</span><strong>{fmt(allPodaCount)}</strong></div>
        <div><span>Visíveis no filtro</span><strong>{fmt(recordCount)}</strong></div>
        <div><span>Formulário</span><strong>CQO Poda</strong></div>
      </div>
    </div>
  );
}

function PodaGeoQualityOverlay({ mapProps, periodText, updateText, latestCollectionText, onClose }) {
  return createPortal(
    <div className="field-map-overlay" role="dialog" aria-modal="true" aria-label="Qualidade por parcela no mapa">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={onClose} title="Fechar mapa" aria-label="Fechar mapa">
        <X size={22} />
      </button>
      <section className="field-map-dialog">
        <header className="field-map-header">
          <img src="/logo.png" alt="Vila Nova Agroindustrial" />
          <div>
            <span>Georreferenciamento CQO Poda</span>
            <h2>Qualidade por parcela</h2>
            <p>Shapes das parcelas com semáforo de qualidade da poda, filtros atuais e detalhe por fazenda, parcela, fiscal e período.</p>
          </div>
          <div className="field-map-context">
            <span>{periodText}</span>
            <span>Atualizado: {updateText}</span>
            <span>Última coleta: {latestCollectionText}</span>
          </div>
        </header>
        <div className="field-map-frame">
          <Suspense
            fallback={(
              <div className="field-map-suspense">
                <div className="gps-map-loading-spinner" />
                <strong>Carregando mapa das parcelas</strong>
                <span>Preparando shapefiles e indicadores de poda.</span>
              </div>
            )}
          >
            <LeafletMap
              {...mapProps}
              areaFilter="poda"
              initialOperation="poda"
              initialMetricId="poda_planta_sem_podar"
            />
          </Suspense>
        </div>
      </section>
    </div>,
    document.body
  );
}

function PodaBiBoard({
  totals,
  records,
  allRecords = [],
  periodText,
  demoActive,
  source,
  onPresent,
  onOpenGeoQuality,
  presentationMode = false,
  mapProps = {},
  lastSyncTime,
  loading,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  boardMode,
  setBoardMode,
  totalSection,
  setTotalSection,
  onResetFilters,
}) {
  const farmRows = useMemo(() => buildPodaFarmRows(records), [records]);
  const weekRows = useMemo(() => buildPodaWeekRows(records), [records]);
  const evaluatorRows = useMemo(() => buildPodaEvaluatorRows(records), [records]);
  const dailyRows = useMemo(() => buildPodaDailyRows(records), [records]);
  const allPodaCount = useMemo(() => allRecords.filter((record) => record.type === 'poda').length, [allRecords]);

  const updateText = lastSyncTime
    ? `${new Intl.DateTimeFormat('pt-BR').format(new Date())} ${lastSyncTime}`
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  const latestCollectionText = loading ? 'Carregando...' : latestCollectionLabel(records);
  const isTotalMode = !presentationMode && boardMode === 'total';

  return (
    <div className={`field-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      <div className="field-bi-header">
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="field-bi-logo" />
        <div className="field-bi-title-block">
          <h2>Qualidade Agrícola — Poda</h2>
          <div className="field-bi-meta-line">
            <span><CalendarDays size={14} />{periodText || 'Todos os tempos'}</span>
            <span><RefreshCw size={14} />Atualizado: {updateText}</span>
            <span><CalendarDays size={14} />Última coleta: {latestCollectionText}</span>
          </div>
        </div>
        {!presentationMode && (
          <div className="field-bi-header-actions">
            {onOpenGeoQuality ? (
              <button type="button" className="field-bi-map-btn" onClick={onOpenGeoQuality}>
                <MapPinned size={17} />
                Qualidade por parcela
              </button>
            ) : null}
            {onPresent ? (
              <button type="button" className="field-bi-present-btn" onClick={onPresent}>
                <MonitorPlay size={18} />
                Apresentar
                <Maximize2 size={15} />
              </button>
            ) : null}
          </div>
        )}
      </div>

      {!presentationMode ? (
        <div className="field-bi-control-bar">
          <div className="field-bi-mode-switch" role="group" aria-label="Modo de visualização CQO Poda">
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
                  {PODA_TOTAL_SECTION_OPTIONS.map((option) => (
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

      {demoActive ? (
        <div className="field-bi-filter-strip">
          <span>Demonstração ativa</span>
          <span>Dados simulados para apresentação</span>
        </div>
      ) : null}

      {!loading && records.length === 0 ? (
        <PodaBiEmptyState recordCount={records.length} allPodaCount={allPodaCount} onResetFilters={onResetFilters} />
      ) : !isTotalMode ? (
        <>
          <div className="field-bi-kpi-grid">
            <PodaBiKpiCard loading={loading} label="Planta sem podar %" value={totals.plantaSemPodarRate} meta={0} />
            <PodaBiKpiCard loading={loading} label="Cacho exposto %" value={totals.cachoExpostoRate} meta={1} />
            <PodaBiKpiCard loading={loading} label="Poda meia coroa %" value={totals.podaMeiaCoroaRate} meta={2} />
            <PodaBiKpiCard loading={loading} label="Poda maior 1:1 %" value={totals.podaMaiorUmParaUmRate} meta={2} />
            <PodaBiKpiCard loading={loading} label="Bico de gaita %" value={totals.bicoGaitaRate} meta={2} />
            <PodaBiKpiCard loading={loading} label="Cacho podre %" value={totals.cachoPodrePlantaRate} meta={2} />
          </div>

          <div className="field-bi-main-grid">
            <PodaBiFarmChart rows={farmRows} loading={loading} />
            <PodaBiWeekChart rows={weekRows} loading={loading} />
            <PodaFiscalCards rows={evaluatorRows} loading={loading} />
          </div>

          <PodaDailyBarChart rows={dailyRows} loading={loading} />
        </>
      ) : (
        <PodaTotalDataPanel totals={totals} records={records} selectedSection={totalSection} loading={loading} />
      )}
    </div>
  );
}

function PodaPresentationOverlay({ onClose, ...boardProps }) {
  return createPortal(
    <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentação CQO Poda">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={onClose} title="Fechar apresentação" aria-label="Fechar apresentação">
        <X size={22} />
      </button>
      <div className="presentation-scroll">
        <PodaBiBoard {...boardProps} presentationMode />
      </div>
    </div>,
    document.body
  );
}

function CarreamentoBiKpi({ label, value, meta, tone = 'green', icon: Icon }) {
  return (
    <div className={`carreamento-bi-kpi carreamento-bi-kpi-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>
      <Icon size={20} />
    </div>
  );
}

function CarreamentoMiniBars({ title, subtitle, rows, color = 'var(--orange-institutional)' }) {
  const visibleRows = rows.slice(0, 8);
  const max = Math.max(...visibleRows.map((row) => Number(row.value || 0)), 1);

  return (
    <section className="carreamento-bi-panel">
      <div className="carreamento-bi-panel-title">
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>
      <div className="carreamento-bi-bars">
        {visibleRows.map((row) => (
          <div className="carreamento-bi-bar-row" key={row.label}>
            <strong>{row.label}</strong>
            <div>
              <span style={{ width: `${Math.max((Number(row.value || 0) / max) * 100, row.value > 0 ? 3 : 0)}%`, background: color }} />
            </div>
            <small>{fmt(row.value, 1)}</small>
          </div>
        ))}
        {!visibleRows.length && (
          <div className="empty-panel smart-empty-panel">
            <strong>Sem dados no filtro</strong>
            <span>O gráfico será exibido quando houver coletas de carreamento no período.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function buildCarreamentoDayRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.date || 'Sem data';
    const current = buckets.get(key) || {
      label: key,
      plantas: 0,
      malPosicionado: 0,
      naoCarreado: 0,
    };
    current.plantas += Number(record.totals?.plantasObservadas || 0);
    current.malPosicionado += Number(record.totals?.cachoMalPosicionado || 0);
    current.naoCarreado += Number(record.totals?.cachoNaoCarreado || 0);
    buckets.set(key, current);
  });

  return Array.from(buckets.values())
    .map((row) => ({
      ...row,
      malPosicionadoPct: row.plantas ? (row.malPosicionado / row.plantas) * 100 : 0,
      naoCarreadoPct: row.plantas ? (row.naoCarreado / row.plantas) * 100 : 0,
    }))
    .slice(-10);
}

function CarreamentoDailyChart({ rows }) {
  const chartHeight = 220;
  const padding = { top: 18, right: 18, bottom: 32, left: 42 };
  const dayWidth = 82;
  const width = Math.max(760, padding.left + padding.right + rows.length * dayWidth);
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = 24;

  return (
    <section className="carreamento-bi-panel carreamento-bi-daily">
      <div className="carreamento-bi-panel-title">
        <h3>Falhas por Dia</h3>
        <span>Cachos não carreados e mal posicionados sobre plantas observadas.</span>
      </div>
      <div className="carreamento-bi-legend">
        <span><i style={{ background: 'var(--status-danger)' }} />Não carreado %</span>
        <span><i style={{ background: 'var(--orange-institutional)' }} />Mal posicionado %</span>
      </div>
      <div className="carreamento-bi-chart-scroll">
        {rows.length ? (
          <svg className="carreamento-bi-svg" viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight}>
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + graphHeight * (1 - ratio);
              return (
                <g key={ratio}>
                  <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />
                  <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">{Math.round(ratio * 10)}%</text>
                </g>
              );
            })}
            {rows.map((row, index) => {
              const x = padding.left + index * dayWidth + 18;
              const naoHeight = Math.min((row.naoCarreadoPct / 10) * graphHeight, graphHeight);
              const malHeight = Math.min((row.malPosicionadoPct / 10) * graphHeight, graphHeight);
              return (
                <g key={row.label}>
                  <rect x={x} y={padding.top + graphHeight - naoHeight} width={barWidth} height={Math.max(naoHeight, row.naoCarreadoPct > 0 ? 2 : 0)} fill="var(--status-danger)" rx="3">
                    <title>{`${row.label} - Não carreado: ${formatPercentValue(row.naoCarreadoPct)}`}</title>
                  </rect>
                  <rect x={x + barWidth + 6} y={padding.top + graphHeight - malHeight} width={barWidth} height={Math.max(malHeight, row.malPosicionadoPct > 0 ? 2 : 0)} fill="var(--orange-institutional)" rx="3">
                    <title>{`${row.label} - Mal posicionado: ${formatPercentValue(row.malPosicionadoPct)}`}</title>
                  </rect>
                  <text x={x + barWidth + 3} y={chartHeight - 10} textAnchor="middle" className="chart-axis-text">{row.label}</text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="empty-panel smart-empty-panel">
            <strong>Sem dias no período</strong>
            <span>Selecione outro mês ou aguarde novas coletas sincronizadas.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function buildCarreamentoFarmRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.farm || 'Sem fazenda';
    const current = buckets.get(key) || { label: key, plantas: 0, naoCarreado: 0, malPosicionado: 0, total: 0 };
    current.plantas += Number(record.totals?.plantasObservadas || 0);
    current.naoCarreado += Number(record.totals?.cachoNaoCarreado || 0);
    current.malPosicionado += Number(record.totals?.cachoMalPosicionado || 0);
    current.total += 1;
    buckets.set(key, current);
  });
  return Array.from(buckets.values())
    .map((row) => ({
      ...row,
      value: row.plantas ? ((row.naoCarreado + row.malPosicionado) / row.plantas) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildCarreamentoEvaluatorRows(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.evaluator || 'Sem avaliador';
    const current = buckets.get(key) || { label: key, total: 0, aprovados: 0, gpsEligible: 0, gps: 0 };
    current.total += 1;
    if (record.status === 'Aprovado') current.aprovados += 1;
    if (record.gpsApplicable !== false) {
      current.gpsEligible += 1;
      if (record.gps) current.gps += 1;
    }
    buckets.set(key, current);
  });
  return Array.from(buckets.values())
    .map((row) => ({
      ...row,
      value: row.total,
      aprovacaoPct: row.total ? (row.aprovados / row.total) * 100 : 0,
      gpsPct: row.gpsEligible ? (row.gps / row.gpsEligible) * 100 : null,
    }))
    .sort((a, b) => b.total - a.total);
}

function CarreamentoBiBoard({
  loading,
  source,
  totals,
  records,
  periodText,
  onPresent,
  presentationMode = false,
  lastSyncTime,
}) {
  const taxaMalPos = totals.plantasObservadas ? (totals.cachoMalPosicionado / totals.plantasObservadas) * 100 : 0;
  const taxaNaoCarreado = totals.plantasObservadas ? (totals.cachoNaoCarreado / totals.plantasObservadas) * 100 : 0;
  const acompanhamentoPct = records.length ? (records.filter((r) => r.acompanhamento?.teve === 'sim').length / records.length) * 100 : 0;
  const aprovacaoPct = records.length ? (records.filter((r) => r.status === 'Aprovado').length / records.length) * 100 : 0;
  const gpsEligibleRecords = records.filter((r) => r.gpsApplicable !== false);
  const gpsPct = gpsEligibleRecords.length ? (gpsEligibleRecords.filter((r) => r.gps).length / gpsEligibleRecords.length) * 100 : null;
  const gpsMeta = gpsEligibleRecords.length ? 'Rastreabilidade app' : 'Excel sem GPS';
  const perdaTon = (totals.cachoNaoCarreado * 20) / 1000;
  const dailyRows = buildCarreamentoDayRows(records);
  const farmRows = buildCarreamentoFarmRows(records);
  const evaluatorRows = buildCarreamentoEvaluatorRows(records);
  const farol = taxaNaoCarreado > 2 || taxaMalPos > 5
    ? 'Atenção logística: indicador fora da tolerância.'
    : records.length
      ? 'Carreamento dentro das tolerâncias principais.'
      : 'Sem coletas de carreamento no período.';

  const updateText = lastSyncTime ? `${new Intl.DateTimeFormat('pt-BR').format(new Date())} ${lastSyncTime}` : new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  const latestCollectionText = loading ? 'Carregando...' : latestCollectionLabel(records);

  return (
    <div className={`carreamento-bi-board ${presentationMode ? 'is-presentation' : ''}`}>
      {/* Header / Filter Bar */}
      <header className="field-bi-header" style={{ marginBottom: 16 }}>
        <img src="/logo.png" alt="Vila Nova Agroindustrial" className="field-bi-logo" />
        <div className="field-bi-title-block">
          <h2>CQO Carreamento</h2>
          <div className="field-bi-meta-line">
            <span><CalendarDays size={14} />{periodText || 'Todos os tempos'}</span>
            <span><RefreshCw size={14} />Atualizado: {updateText}</span>
            <span><CalendarDays size={14} />Última coleta: {latestCollectionText}</span>
          </div>
        </div>
        {!presentationMode && onPresent && (
          <div className="field-bi-header-actions">
            <button type="button" className="field-bi-present-btn" onClick={onPresent}>
              <MonitorPlay size={18} />
              Apresentar
              <Maximize2 size={15} />
            </button>
          </div>
        )}
      </header>

      <div className="carreamento-bi-filter-strip">
        <span>{periodText}</span>
        <span>{loading ? 'Carregando base' : source}</span>
        <span>{fmt(records.length)} coletas</span>
        <span>{fmt(totals.linhas)} linhas</span>
        <span>{farol}</span>
      </div>

      <div className="carreamento-bi-kpi-grid">
        <CarreamentoBiKpi label="Nota CQO" value={loading ? '--' : fmt(totals.carreamentoScore)} meta="Score do carreamento" tone="green" icon={Gauge} />
        <CarreamentoBiKpi label="Não carreado" value={loading ? '--' : formatPercentValue(taxaNaoCarreado)} meta="Meta máx. 2,00%" tone={taxaNaoCarreado > 2 ? 'danger' : 'green'} icon={ThumbsDown} />
        <CarreamentoBiKpi label="Mal posicionado" value={loading ? '--' : formatPercentValue(taxaMalPos)} meta="Meta máx. 5,00%" tone={taxaMalPos > 5 ? 'danger' : 'orange'} icon={AlertTriangle} />
        <CarreamentoBiKpi label="Perda estimada" value={loading ? '--' : `${fmt(perdaTon, 2)} t`} meta={`${fmt(totals.cachoNaoCarreado)} cachos`} tone={perdaTon > 0 ? 'danger' : 'green'} icon={Weight} />
        <CarreamentoBiKpi label="Acompanhamento" value={loading ? '--' : formatPercentValue(acompanhamentoPct)} meta="Fichas supervisionadas" tone="info" icon={CheckCircle2} />
        <CarreamentoBiKpi label="GPS" value={loading ? '--' : formatPercentValue(gpsPct)} meta={gpsMeta} tone="green" icon={BarChart3} />
      </div>

      <div className="carreamento-bi-main-grid">
        <CarreamentoMiniBars
          title="Risco por Fazenda"
          subtitle="Soma de não carreado e mal posicionado."
          rows={farmRows}
          color="var(--status-danger)"
        />
        <CarreamentoDailyChart rows={dailyRows} />
        <section className="carreamento-bi-panel carreamento-bi-status-panel">
          <div className="carreamento-bi-panel-title">
            <h3>Rastreabilidade</h3>
            <span>Status e acompanhamento das fichas.</span>
          </div>
          <div className="carreamento-bi-status-list">
            <div><span>Aprovação</span><strong>{formatPercentValue(aprovacaoPct)}</strong></div>
            <div><span>GPS</span><strong>{formatPercentValue(gpsPct)}</strong></div>
            <div><span>Acompanhamento</span><strong>{formatPercentValue(acompanhamentoPct)}</strong></div>
            <div><span>Pendências</span><strong>{fmt(records.filter((r) => r.status === 'Pendente validação').length)}</strong></div>
          </div>
        </section>
      </div>

      <div className="carreamento-bi-bottom-grid">
        <CarreamentoMiniBars
          title="Ranking de Avaliadores"
          subtitle="Volume de fichas no período."
          rows={evaluatorRows}
          color="var(--green-institutional)"
        />
        <section className="carreamento-bi-panel">
          <div className="carreamento-bi-panel-title">
            <h3>Resumo Logístico</h3>
            <span>Base calculada pela coleta sincronizada no app.</span>
          </div>
          <div className="carreamento-bi-summary">
            <div><span>Plantas observadas</span><strong>{fmt(totals.plantasObservadas)}</strong></div>
            <div><span>Cachos não carreados</span><strong>{fmt(totals.cachoNaoCarreado)}</strong></div>
            <div><span>Cachos mal posicionados</span><strong>{fmt(totals.cachoMalPosicionado)}</strong></div>
            <div><span>Peso acumulado</span><strong>{fmt(totals.pesoMedio, 1)} kg</strong></div>
          </div>
        </section>
      </div>

    </div>
  );
}

function CarreamentoPresentationOverlay(props) {
  return createPortal(
    <div className="presentation-overlay carreamento-presentation-overlay" role="dialog" aria-modal="true" aria-label="Apresentação CQO Carreamento">
      <button type="button" className="presentation-close-btn field-bi-close-btn" onClick={props.onClose} title="Fechar apresentação" aria-label="Fechar apresentação">
        <X size={22} />
      </button>
      <div className="presentation-scroll">
        <CarreamentoBiBoard {...props} presentationMode />
      </div>
    </div>,
    document.body
  );
}

// ─── Analytics Page ────────────────────────────────────────────────────────────
export default function Analytics({
  theme,
  farmFilter,
  areaFilter,
  periodFilter,
  cycleFilter,
  evaluatorFilter,
  sourceFilter = 'all',
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  lastSyncTime,
  onResetFilters,
}) {
  const { loading, error, records: allRecords, source } = useCqoData();
  const [activeTab, setActiveTab] = useState('geral');
  const [carreamentoPresentationOpen, setCarreamentoPresentationOpen] = useState(false);
  const [podaPresentationOpen, setPodaPresentationOpen] = useState(false);
  const [podaBoardMode, setPodaBoardMode] = useState('meeting');
  const [podaTotalSection, setPodaTotalSection] = useState('qualidade');
  const [podaGeoQualityOpen, setPodaGeoQualityOpen] = useState(false);

  const filtered = filterRecords(allRecords, {
    farmFilter,
    areaFilter,
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    approvedOnly: true,
  });
  const corteRecords = filtered.filter((r) => r.type === 'corte');
  const carreamentoRecords = filtered.filter((r) => r.type === 'carreamento');
  const podaRealRecords = filtered.filter((r) => r.type === 'poda');
  const podaDemoRecords = areaFilter === 'poda' ? buildPodaDemoRecords() : [];
  const podaRecords = areaFilter === 'poda' ? [...podaDemoRecords, ...podaRealRecords] : podaRealRecords;
  const podaDemoActive = podaDemoRecords.length > 0;

  const totalsGeral = aggregateRecords(filtered);
  const totalsCorte = aggregateRecords(corteRecords);
  const totalsCarreamento = aggregateRecords(carreamentoRecords);
  const totalsPoda = aggregateRecords(podaRecords);

  const chartsGeral = buildCharts(filtered);
  const chartsCorte = buildCharts(corteRecords);
  const chartsCarreamento = buildCharts(carreamentoRecords);
  const chartsPoda = buildCharts(podaRecords);

  // Corte computed
  const taxaPerda = totalsCorte.cachosObservados > 0
    ? ((totalsCorte.cachoEsquecido / totalsCorte.cachosObservados) * 100).toFixed(1)
    : '0.0';
  const taxaMaturacao = totalsCorte.cachosObservados > 0
    ? ((totalsCorte.cachoMaduro / totalsCorte.cachosObservados) * 100).toFixed(1)
    : '0.0';
  const mediaLinhasCorte = corteRecords.length > 0
    ? (totalsCorte.linhas / corteRecords.length).toFixed(1)
    : '0';
  const mediaPlantasPorLinha = totalsCorte.linhas > 0
    ? (totalsCorte.plantasObservadas / totalsCorte.linhas).toFixed(1)
    : '0';

  // Carreamento computed
  const taxaMalPos = totalsCarreamento.plantasObservadas > 0
    ? ((totalsCarreamento.cachoMalPosicionado / totalsCarreamento.plantasObservadas) * 100).toFixed(1)
    : '0.0';
  const taxaNaoCarreado = totalsCarreamento.plantasObservadas > 0
    ? ((totalsCarreamento.cachoNaoCarreado / totalsCarreamento.plantasObservadas) * 100).toFixed(1)
    : '0.0';
  const mediaPesoFicha = carreamentoRecords.length > 0
    ? (totalsCarreamento.pesoMedio / carreamentoRecords.length).toFixed(1)
    : '0';

  const taxaPlantaSemPodar = totalsPoda.plantaSemPodarRate.toFixed(1);
  const taxaCachoExposto = totalsPoda.cachoExpostoRate.toFixed(1);
  const taxaPodaMeiaCoroa = totalsPoda.podaMeiaCoroaRate.toFixed(1);
  const taxaPodaMaior = totalsPoda.podaMaiorUmParaUmRate.toFixed(1);
  const taxaBicoGaita = totalsPoda.bicoGaitaRate.toFixed(1);
  const taxaCachoPodre = totalsPoda.cachoPodrePlantaRate.toFixed(1);
  const taxaPalhaPoda = totalsPoda.palhaMalEmpilhadaRate.toFixed(1);
  const taxaFolhaMamandoPoda = totalsPoda.folhaMamandoPodaRate.toFixed(1);
  const mediaLinhasPoda = podaRecords.length > 0
    ? (totalsPoda.linhas / podaRecords.length).toFixed(1)
    : '0';
  const mediaPlantasPoda = totalsPoda.linhas > 0
    ? (totalsPoda.plantasObservadas / totalsPoda.linhas).toFixed(1)
    : '0';

  const availableTabs = [
    { id: 'geral', label: 'Visão Geral' },
    ...(areaFilter !== 'carreamento' && areaFilter !== 'poda' ? [{ id: 'corte', label: 'CQO Corte' }] : []),
    ...(areaFilter !== 'corte' && areaFilter !== 'poda' ? [{ id: 'carreamento', label: 'CQO Carreamento' }] : []),
    ...(areaFilter !== 'corte' && areaFilter !== 'carreamento' ? [{ id: 'poda', label: 'CQO Poda' }] : []),
  ];

  const currentTab = availableTabs.some((t) => t.id === activeTab) ? activeTab : 'geral';
  const periodText = formatMonthYear(dateFrom, dateTo);
  const podaFilterContext = {
    farmFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
  };
  const podaMapProps = {
    farmFilter,
    areaFilter: 'poda',
    periodFilter,
    cycleFilter,
    evaluatorFilter,
    sourceFilter,
    dateFrom,
    dateTo,
  };

  useEffect(() => {
    if (!carreamentoPresentationOpen) return undefined;

    document.body.classList.add('presentation-active');

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setCarreamentoPresentationOpen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.body.classList.remove('presentation-active');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [carreamentoPresentationOpen]);

  useEffect(() => {
    if (!podaPresentationOpen) return undefined;

    document.body.classList.add('presentation-active');

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setPodaPresentationOpen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.body.classList.remove('presentation-active');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [podaPresentationOpen]);

  useEffect(() => {
    if (!podaGeoQualityOpen) return undefined;

    document.body.classList.add('field-map-active');
    return () => {
      document.body.classList.remove('field-map-active');
    };
  }, [podaGeoQualityOpen]);

  const openCarreamentoPresentation = useCallback(() => {
    setCarreamentoPresentationOpen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const closeCarreamentoPresentation = useCallback(() => {
    setCarreamentoPresentationOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const openPodaPresentation = useCallback(() => {
    setPodaPresentationOpen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const closePodaPresentation = useCallback(() => {
    setPodaPresentationOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (areaFilter !== 'carreamento') return undefined;
    window.addEventListener(OPEN_CARREAMENTO_PRESENTATION_EVENT, openCarreamentoPresentation);
    return () => window.removeEventListener(OPEN_CARREAMENTO_PRESENTATION_EVENT, openCarreamentoPresentation);
  }, [areaFilter, openCarreamentoPresentation]);

  useEffect(() => {
    if (areaFilter !== 'poda') return undefined;
    window.addEventListener(OPEN_PODA_PRESENTATION_EVENT, openPodaPresentation);
    return () => window.removeEventListener(OPEN_PODA_PRESENTATION_EVENT, openPodaPresentation);
  }, [areaFilter, openPodaPresentation]);

  if (areaFilter === 'carreamento') {
    return (
      <div className="fade-in page-shell carreamento-bi-page">
        {carreamentoPresentationOpen && (
          <CarreamentoPresentationOverlay
            loading={loading}
            source={source}
            totals={totalsCarreamento}
            records={carreamentoRecords}
            periodText={periodText}
            onClose={closeCarreamentoPresentation}
            lastSyncTime={lastSyncTime}
          />
        )}

        {error && (
          <StatusBanner tone="danger" icon={AlertTriangle}>
            {error}
          </StatusBanner>
        )}

        <CarreamentoBiBoard
          loading={loading}
          source={source}
          totals={totalsCarreamento}
          records={carreamentoRecords}
          periodText={periodText}
          onPresent={openCarreamentoPresentation}
          lastSyncTime={lastSyncTime}
        />
      </div>
    );
  }

  if (areaFilter === 'poda') {
    const podaUpdateText = lastSyncTime
      ? `${new Intl.DateTimeFormat('pt-BR').format(new Date())} ${lastSyncTime}`
      : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    const podaLatestCollectionText = loading ? 'Carregando...' : latestCollectionLabel(podaRecords);
    const podaBoardProps = {
      loading,
      source,
      totals: totalsPoda,
      records: podaRecords,
      allRecords,
      periodText,
      demoActive: podaDemoActive,
      mapProps: { theme, ...podaMapProps },
      lastSyncTime,
      dateFrom,
      dateTo,
      setDateFrom,
      setDateTo,
      boardMode: podaBoardMode,
      setBoardMode: setPodaBoardMode,
      totalSection: podaTotalSection,
      setTotalSection: setPodaTotalSection,
      onResetFilters,
      onOpenGeoQuality: () => setPodaGeoQualityOpen(true),
    };

    return (
      <div className="fade-in page-shell field-bi-page">
        {podaPresentationOpen && (
          <PodaPresentationOverlay
            {...podaBoardProps}
            onClose={closePodaPresentation}
          />
        )}

        {podaGeoQualityOpen && (
          <PodaGeoQualityOverlay
            mapProps={podaBoardProps.mapProps}
            periodText={periodText}
            updateText={podaUpdateText}
            latestCollectionText={podaLatestCollectionText}
            onClose={() => setPodaGeoQualityOpen(false)}
          />
        )}

        {error && !podaDemoActive && (
          <StatusBanner tone="danger" icon={AlertTriangle}>
            Falha ao carregar indicadores: {error}
          </StatusBanner>
        )}

        <PodaDataHealthPanel
          records={podaRecords}
          allRecords={allRecords}
          loading={loading}
          source={source}
          periodText={periodText}
        />

        <PodaBiBoard
          {...podaBoardProps}
          onPresent={openPodaPresentation}
        />
      </div>
    );
  }

  return (
    <div className="fade-in page-shell">
      {carreamentoPresentationOpen && (
        <CarreamentoPresentationOverlay
          loading={loading}
          source={source}
          totals={totalsCarreamento}
          records={carreamentoRecords}
          periodText={periodText}
          onClose={closeCarreamentoPresentation}
        />
      )}

      <PageHeader
        eyebrow={areaFilter === 'carreamento' ? 'CQO Carreamento' : 'CQO Campo'}
        title={areaFilter === 'carreamento' ? 'Painel de Indicadores de Carreamento' : areaFilter === 'poda' ? 'Painel de Indicadores de Poda' : 'Painel de Indicadores de Campo'}
        description={areaFilter === 'carreamento' ? 'Modulo dedicado ao acompanhamento das respostas de carreamento sincronizadas pelo aplicativo.' : areaFilter === 'poda' ? 'Modulo dedicado ao controle de qualidade da poda por amostragem de ruas.' : 'Dados calculados em tempo real a partir das respostas sincronizadas pelo aplicativo Android. A rampa é tratada em uma visão separada.'}
      >
        <div className="page-actions field-presentation-actions">
          {areaFilter === 'carreamento' && (
            <button type="button" className="btn btn-primary" onClick={openCarreamentoPresentation}>
              <MonitorPlay size={18} />
              Apresentar
              <Maximize2 size={15} />
            </button>
          )}
          <div className="source-card compact">
            <span>Fonte</span>
            <strong className={loading ? 'skeleton-text skeleton-sm' : ''}>{loading ? '\u00A0' : source}</strong>
          </div>
        </div>
      </PageHeader>

      {error && (
        <StatusBanner tone="danger" icon={AlertTriangle}>
          Falha ao carregar indicadores: {error}
        </StatusBanner>
      )}

      {/* Tab Navigation */}
      <SegmentedTabs tabs={availableTabs} activeId={currentTab} onChange={setActiveTab} />

      {/* Empty state */}
      {!loading && filtered.length === 0 && <EmptyState areaFilter={areaFilter} />}

      {/* ============ VISÃO GERAL ============ */}
      {currentTab === 'geral' && (loading || filtered.length > 0) && (
        <>
          <SectionHeader eyebrow="Indicadores de Conformidade" title="Avaliação Geral da Qualidade Operacional de Campo" color="var(--green-institutional)" />

          {/* Gauge scores */}
          <div className={`grid-container ${areaFilter === 'all' ? 'grid-cols-4' : 'grid-cols-2'}`} style={{ marginBottom: 4 }}>
            <CustomChart
              type="gauge"
              title="Nota Geral CQO"
              data={[{ label: 'Média consolidada de qualidade', value: totalsGeral.generalScore }]}
              loading={loading}
            />
            {areaFilter !== 'carreamento' && areaFilter !== 'poda' && (
              <CustomChart
                type="gauge"
                title="Nota CQO Corte"
                data={[{ label: `${fmt(totalsGeral.corte)} coletas de colheita`, value: totalsGeral.corteScore }]}
                loading={loading}
              />
            )}
            {areaFilter !== 'corte' && areaFilter !== 'poda' && (
              <CustomChart
                type="gauge"
                title="Nota CQO Carreamento"
                data={[{ label: `${fmt(totalsGeral.carreamento)} coletas de transporte`, value: totalsGeral.carreamentoScore }]}
                loading={loading}
              />
            )}
            {areaFilter !== 'corte' && areaFilter !== 'carreamento' && (
              <CustomChart
                type="gauge"
                title="Nota CQO Poda"
                data={[{ label: `${fmt(totalsGeral.poda)} coletas de poda`, value: totalsGeral.podaScore }]}
                loading={loading}
              />
            )}
          </div>

          <SectionHeader eyebrow="Volumes e Amostragem" title="Escopo do Monitoramento de Campo" color="var(--orange-institutional)" />
          <div className={`grid-container ${areaFilter === 'carreamento' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <MetricCard variant="kpi" title="Coletas Recebidas" value={fmt(totalsGeral.total)} footer="Total de fichas no banco de dados" icon={ClipboardCheck} tone="green" loading={loading} />
            {areaFilter !== 'carreamento' && areaFilter !== 'poda' && (
              <MetricCard variant="kpi" title="Cachos Observados" value={fmt(totalsGeral.cachosObservados)} footer="Cachos auditados nas linhas" icon={CheckCircle2} tone="info" loading={loading} />
            )}
            <MetricCard variant="kpi" title="Linhas Avaliadas" value={fmt(totalsGeral.linhas)} footer={totalsGeral.gpsEligible ? `${fmt(totalsGeral.gpsPoints)} pontos GPS no trajeto` : 'Excel sem GPS'} icon={Rows3} tone="orange" loading={loading} />
            <MetricCard variant="kpi" title="Plantas Observadas" value={fmt(totalsGeral.plantasObservadas)} footer="Base para cálculo de perdas" icon={Sprout} tone="green" loading={loading} />
          </div>

          {areaFilter !== 'poda' && (
          <>
            <SectionHeader eyebrow="Desperdício de Matéria-Prima" title="Estimativa Física de Perdas no Campo" color="var(--status-danger)" />
            <div className="grid-container grid-cols-3" style={{ marginBottom: '24px' }}>
            <MetricCard
              variant="kpi"
              title={areaFilter === 'corte' ? "Cachos Perdidos (Corte)" : areaFilter === 'carreamento' ? "Cachos Perdidos (Logística)" : "Cachos Perdidos (Corte/Logística)"}
              value={`${fmt(totalsGeral.lostCachosQty)} cachos`}
              footer={areaFilter === 'corte' ? 'Apenas cachos esquecidos' : areaFilter === 'carreamento' ? 'Apenas cachos não carreados' : 'Esquecidos ou não carreados'}
              icon={AlertTriangle}
              tone="danger"
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Massa de Frutos Perdida"
              value={`${fmt(totalsGeral.lostFrutosTon, 2)} Toneladas`}
              footer="Estimativa física acumulada (20kg/cacho)"
              icon={Weight}
              tone="danger"
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Óleo de Palma (CPO) Perdido"
              value={`${fmt(totalsGeral.lostOilTon, 2)} Ton. de Óleo`}
              footer="Rendimento médio estimado de 20%"
              icon={Leaf}
              tone="danger"
              loading={loading}
            />
            </div>
          </>
          )}

          {/* Charts */}
          {/* Charts */}
          <div className="grid-container grid-cols-3" style={{ marginBottom: '16px' }}>
            <CustomChart loading={loading} type="line" data={chartsGeral.byWeekOfMonth} title="Evolução por semana do mês" />
            <CustomChart loading={loading} type="line" data={chartsGeral.byDayOfMonth} title="Evolução por dia do mês" />
            <CustomChart loading={loading} type="line" data={chartsGeral.ytdLoss} title="Evolução Acumulada de Perdas (YTD Toneladas)" />
          </div>

          <div className="grid-container grid-cols-3">
            <CustomChart loading={loading} type="bar" data={chartsGeral.byCycle} title="Comparativo por Ciclo (Nota CQO)" />
            <CustomChart loading={loading} type="bar" data={chartsGeral.byFarm} title="Nota CQO por Fazenda" />
            <CustomChart loading={loading} type="bar" data={chartsGeral.byEvaluator} title="Nota CQO por Avaliador" />
          </div>

          {/* Ranking avaliadores */}
          <SectionHeader eyebrow="Performance Individual" title="Ranking de Avaliadores de Campo" color="var(--green-institutional)" />
          <RankingAvaliadores records={filtered} loading={loading} />
        </>
      )}

      {/* ============ CQO CORTE ============ */}
      {currentTab === 'corte' && (loading || corteRecords.length > 0) && (
        <>
          <SectionHeader eyebrow="Formulário CQO Corte" title="Indicadores de qualidade no corte" color="var(--green-institutional)" />

          {/* Gauge da Nota */}
          <div className="grid-container grid-cols-3">
            <CustomChart
              type="gauge"
              title="Nota CQO Corte"
              data={[{ label: 'Score geral de qualidade no corte', value: totalsCorte.corteScore }]}
              loading={loading}
            />
            <MetricCard variant="kpi" title="Fichas de corte" value={fmt(corteRecords.length)} footer={`${mediaLinhasCorte} linhas por ficha (média)`} icon={Scissors} tone="green" loading={loading} />
            <MetricCard variant="kpi" title="Plantas observadas" value={fmt(totalsCorte.plantasObservadas)} footer={`${mediaPlantasPorLinha} plantas/linha (média)`} icon={Sprout} tone="green" loading={loading} />
          </div>

          <SectionHeader eyebrow="Qualidade dos cachos" title="Maturação e perdas no corte" color="var(--orange-institutional)" />
          <div className="grid-container grid-cols-4" style={{ marginBottom: '18px' }}>
            <MetricCard
              variant="kpi"
              title="Taxa de maturação"
              value={`${taxaMaturacao.replace('.', ',')}%`}
              footer={`${fmt(totalsCorte.cachoMaduro)} cachos maduros`}
              icon={ThumbsUp}
              tone="green"
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Perda no corte"
              value={`${taxaPerda.replace('.', ',')}%`}
              footer={`${fmt(totalsCorte.cachoEsquecido)} cachos esquecidos`}
              icon={AlertTriangle}
              tone={Number(taxaPerda) > 1.5 ? 'danger' : 'green'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Cachos verdes"
              value={`${totalsCorte.cachoVerdeRate.toFixed(2).replace('.', ',')}%`}
              footer={`${fmt(totalsCorte.cachoVerde)} unidades colhidas`}
              icon={Leaf}
              tone={totalsCorte.cachoVerdeRate > 3.0 ? 'danger' : 'warning'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Cachos passados"
              value={`${totalsCorte.cachoPassadoRate.toFixed(2).replace('.', ',')}%`}
              footer={`${fmt(totalsCorte.cachoPassado)} unidades colhidas`}
              icon={TrendingDown}
              tone={totalsCorte.cachoPassadoRate > 5.0 ? 'danger' : 'warning'}
              loading={loading}
            />
          </div>

          {/* Farol e Fitossanitário */}
          <div className="grid-container grid-cols-2" style={{ marginBottom: '24px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h3 className="card-title">Farol de Alertas e Tolerâncias</h3>
                  <span className="card-subtitle">Limites estabelecidos pelo controle de qualidade</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AlertFarol
                  label="Perda no Corte (Cachos Esquecidos)"
                  meta="Meta: < 1,5% de perda"
                  value={taxaPerda}
                  danger={1.5}
                />
                <AlertFarol
                  label="Colheita de Cachos Verdes"
                  meta="Meta: < 3,0% de verdes"
                  value={totalsCorte.cachoVerdeRate.toFixed(2).replace('.', ',')}
                  danger={3.0}
                />
                <AlertFarol
                  label="Incidência de Talo Comprido"
                  meta="Meta: < 5,0% das plantas"
                  value={totalsCorte.taloCompridoRate.toFixed(2).replace('.', ',')}
                  danger={5.0}
                  warning={3.0}
                />
              </div>
            </div>

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
                  {totalsCorte.pragasRate.toFixed(2).replace('.', ',')}%
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

          {/* Qualitative detail */}
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
                <QualityBar label="Cachos infermos" value={totalsCorte.cachoInfermo || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#EF4444" loading={loading} />
                <QualityBar label="Bucha" value={totalsCorte.bucha || 0} max={Math.max(totalsCorte.cachosObservados, 1)} color="#64748B" loading={loading} />
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
                <StatusBadgeRow label="Palha mal empilhada" value={totalsCorte.cachoMalPosicionado || 0} total={totalsCorte.plantasObservadas} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Folha cortada indevida" value={totalsCorte.folhaCortada || 0} total={totalsCorte.plantasObservadas} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Folha mamando" value={totalsCorte.folhaMamando || 0} total={totalsCorte.plantasObservadas} color="#8B5CF6" loading={loading} />
                <StatusBadgeRow label="Talo comprido" value={totalsCorte.taloComprido || 0} total={totalsCorte.plantasObservadas} color="var(--orange-institutional)" loading={loading} />
                <StatusBadgeRow label="Cachos brocados" value={totalsCorte.cachoBrocado || 0} total={totalsCorte.plantasObservadas} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Com acompanhamento" value={corteRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} total={corteRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Com registro GPS app" value={corteRecords.filter((r) => r.gpsApplicable !== false && r.gps).length} total={corteRecords.filter((r) => r.gpsApplicable !== false).length} color="var(--status-info)" loading={loading} />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid-container grid-cols-2" style={{ marginBottom: '16px' }}>
            <CustomChart loading={loading} type="line" data={chartsCorte.byDayOfMonth} title="Evolução por dia do mês — Nota CQO Corte" />
            <CustomChart
              loading={loading}
              type="bar"
              data={chartsCorte.lossRateByWeekOfMonth}
              title="Perda no Corte por Semana do mês (%)"
              targetValue={2.0}
              targetLabel="Limite Tolerável"
            />
          </div>
          <div className="grid-container grid-cols-2">
            <CustomChart loading={loading} type="bar" data={chartsCorte.byFarm} title="Nota CQO Corte por Fazenda" />
            <CustomChart loading={loading} type="bar" data={chartsCorte.byEvaluator} title="Nota CQO Corte por Avaliador" />
          </div>

          {/* Status resumo */}
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

          {/* Ranking */}
          <SectionHeader eyebrow="Performance Individual" title="Ranking de Avaliadores — Corte" color="var(--green-institutional)" />
          <RankingAvaliadores records={corteRecords} loading={loading} />
        </>
      )}

      {/* ============ CQO CARREAMENTO ============ */}
      {currentTab === 'carreamento' && (loading || carreamentoRecords.length > 0) && (
        <>
          <SectionHeader eyebrow="Formulário CQO Carreamento e Fruto Solto" title="Indicadores de transporte e rastreio" color="var(--orange-institutional)" />

          {/* Gauge + KPIs */}
          <div className="grid-container grid-cols-3">
            <CustomChart
              type="gauge"
              title="Nota CQO Carreamento"
              data={[{ label: 'Score geral de qualidade do carreamento', value: totalsCarreamento.carreamentoScore }]}
              loading={loading}
            />
            <MetricCard variant="kpi" title="Fichas carreamento" value={fmt(carreamentoRecords.length)} footer={`${fmt(totalsCarreamento.linhas)} linhas registradas`} icon={Truck} tone="orange" loading={loading} />
            <MetricCard variant="kpi" title="Plantas observadas" value={fmt(totalsCarreamento.plantasObservadas)} footer="Base de cálculo por linha" icon={Sprout} tone="green" loading={loading} />
          </div>

          <div className="grid-container grid-cols-2" style={{ marginTop: 12 }}>
            <MetricCard
              variant="kpi"
              title="Acúmulo de Peso Observado"
              value={`${fmt(totalsCarreamento.pesoMedio, 1)} kg`}
              footer={`Média de ${mediaPesoFicha} kg/ficha`}
              icon={Weight}
              tone="info"
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Taxa de Sincronização"
              value={pct(carreamentoRecords.filter((r) => r.status === 'Sincronizado').length, carreamentoRecords.length)}
              footer={`${carreamentoRecords.filter((r) => r.status === 'Sincronizado').length} fichas concluídas`}
              icon={TrendingUp}
              tone="info"
              loading={loading}
            />
          </div>

          <SectionHeader eyebrow="Irregularidades de transporte" title="Perdas e falhas no carreamento" color="var(--orange-institutional)" />
          <div className="grid-container grid-cols-4" style={{ marginBottom: '18px' }}>
            <MetricCard
              variant="kpi"
              title="Mal posicionados"
              value={`${taxaMalPos.replace('.', ',')}%`}
              footer={`${fmt(totalsCarreamento.cachoMalPosicionado)} cachos`}
              icon={AlertTriangle}
              tone={totalsCarreamento.cachoMalPosicionadoRate > 5.0 ? 'danger' : 'warning'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Não carreados"
              value={`${taxaNaoCarreado.replace('.', ',')}%`}
              footer={`${fmt(totalsCarreamento.cachoNaoCarreado)} cachos`}
              icon={ThumbsDown}
              tone={totalsCarreamento.cachoNaoCarreadoRate > 2.0 ? 'danger' : 'green'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Com acompanhamento"
              value={pct(carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length, carreamentoRecords.length)}
              footer={`${carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} fichas supervisionadas`}
              icon={CheckCircle2}
              tone="info"
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Aprovação"
              value={pct(carreamentoRecords.filter((r) => r.status === 'Aprovado').length, carreamentoRecords.length)}
              footer={`${carreamentoRecords.filter((r) => r.status === 'Aprovado').length} fichas aprovadas`}
              icon={ThumbsUp}
              tone="green"
              loading={loading}
            />
          </div>

          {/* Farol logístico */}
          <div className="grid-container grid-cols-2" style={{ marginBottom: '24px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h3 className="card-title">Farol de Alertas e Tolerâncias Logísticas</h3>
                  <span className="card-subtitle">Limites estabelecidos pelo controle de qualidade de transporte</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AlertFarol
                  label="Perda Logística (Cachos Não Carreados)"
                  meta="Meta: < 2,0% de perda"
                  value={taxaNaoCarreado}
                  danger={2.0}
                />
                <AlertFarol
                  label="Cachos Mal Posicionados na Linha"
                  meta="Meta: < 5,0% de desvio"
                  value={taxaMalPos}
                  danger={5.0}
                  warning={3.0}
                />
              </div>
            </div>

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
                <StatusBadgeRow label="Com GPS app" value={carreamentoRecords.filter((r) => r.gpsApplicable !== false && r.gps).length} total={carreamentoRecords.filter((r) => r.gpsApplicable !== false).length} color="var(--status-info)" loading={loading} />
                <StatusBadgeRow label="Com acompanhamento" value={carreamentoRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} total={carreamentoRecords.length} color="var(--status-info)" loading={loading} />
              </div>
            </div>
          </div>

          {/* Charts */}
          <CustomChart loading={loading} type="line" data={chartsCarreamento.byDayOfMonth} title="Evolução por dia do mês — Nota CQO Carreamento" />
          <div className="grid-container grid-cols-2">
            <CustomChart loading={loading} type="bar" data={chartsCarreamento.byFarm} title="Nota CQO Carreamento por Fazenda" />
            <CustomChart loading={loading} type="bar" data={chartsCarreamento.byEvaluator} title="Nota CQO Carreamento por Avaliador" />
          </div>

          {/* Ranking */}
          <SectionHeader eyebrow="Performance Individual" title="Ranking de Avaliadores — Carreamento" color="var(--orange-institutional)" />
          <RankingAvaliadores records={carreamentoRecords} loading={loading} />
        </>
      )}

      {/* ============ CQO PODA ============ */}
      {currentTab === 'poda' && (loading || podaRecords.length > 0) && (
        <>
          <SectionHeader eyebrow="Formulário CQO Poda" title="Indicadores de qualidade da poda" color="var(--green-institutional)" />

          <div className="grid-container grid-cols-4">
            <CustomChart
              type="gauge"
              title="Nota CQO Poda"
              data={[{ label: 'Score geral de conformidade da poda', value: totalsPoda.podaScore }]}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Fichas de poda"
              value={fmt(podaRecords.length)}
              footer={`${mediaLinhasPoda} linhas por ficha (média)`}
              icon={Scissors}
              tone="green"
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Plantas amostradas"
              value={fmt(totalsPoda.plantasObservadas)}
              footer={`${mediaPlantasPoda} plantas por linha (média)`}
              icon={Sprout}
              tone="green"
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Base projetada"
              value={fmt(totalsPoda.plantasProjetadas || totalsPoda.plantasObservadas)}
              footer={totalsPoda.podaComProjecao ? `${fmt(totalsPoda.podaComProjecao)} ficha(s) com total da parcela` : 'Sem total informado; usando amostra'}
              icon={BarChart3}
              tone="info"
              loading={loading}
            />
          </div>

          <SectionHeader eyebrow="Falhas de poda" title="Ocorrências sobre a amostragem da parcela" color="var(--orange-institutional)" />
          <div className="grid-container grid-cols-4" style={{ marginBottom: '18px' }}>
            <MetricCard
              variant="kpi"
              title="Planta sem podar"
              value={`${taxaPlantaSemPodar.replace('.', ',')}%`}
              footer={`${fmt(totalsPoda.plantaSemPodar)} ocorrência(s)`}
              icon={AlertTriangle}
              tone={totalsPoda.plantaSemPodarRate > 1 ? 'danger' : totalsPoda.plantaSemPodarRate > 0.5 ? 'warning' : 'green'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Cacho exposto"
              value={`${taxaCachoExposto.replace('.', ',')}%`}
              footer={`${fmt(totalsPoda.cachoExposto)} ocorrência(s)`}
              icon={Leaf}
              tone={totalsPoda.cachoExpostoRate > 2 ? 'danger' : totalsPoda.cachoExpostoRate > 1 ? 'warning' : 'green'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Poda meia coroa"
              value={`${taxaPodaMeiaCoroa.replace('.', ',')}%`}
              footer={`${fmt(totalsPoda.podaMeiaCoroa)} ocorrência(s)`}
              icon={Gauge}
              tone={totalsPoda.podaMeiaCoroaRate > 2 ? 'danger' : totalsPoda.podaMeiaCoroaRate > 1 ? 'warning' : 'green'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Cacho podre na planta"
              value={`${taxaCachoPodre.replace('.', ',')}%`}
              footer={`${fmt(totalsPoda.cachoPodrePlanta)} ocorrência(s)`}
              icon={ThumbsDown}
              tone={totalsPoda.cachoPodrePlantaRate > 1 ? 'danger' : totalsPoda.cachoPodrePlantaRate > 0.5 ? 'warning' : 'green'}
              loading={loading}
            />
          </div>

          <div className="grid-container grid-cols-4" style={{ marginBottom: '18px' }}>
            <MetricCard
              variant="kpi"
              title="Poda maior que 1:1"
              value={`${taxaPodaMaior.replace('.', ',')}%`}
              footer={`${fmt(totalsPoda.podaMaiorUmParaUm)} ocorrência(s)`}
              icon={TrendingUp}
              tone={totalsPoda.podaMaiorUmParaUmRate > 2 ? 'danger' : totalsPoda.podaMaiorUmParaUmRate > 1 ? 'warning' : 'green'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Bico de gaita"
              value={`${taxaBicoGaita.replace('.', ',')}%`}
              footer={`${fmt(totalsPoda.bicoGaita)} ocorrência(s)`}
              icon={BarChart3}
              tone={totalsPoda.bicoGaitaRate > 2 ? 'danger' : totalsPoda.bicoGaitaRate > 1 ? 'warning' : 'green'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Folha mamando"
              value={`${taxaFolhaMamandoPoda.replace('.', ',')}%`}
              footer={`${fmt(totalsPoda.folhaMamando)} ocorrência(s)`}
              icon={Leaf}
              tone={totalsPoda.folhaMamandoPodaRate > 2 ? 'danger' : totalsPoda.folhaMamandoPodaRate > 1 ? 'warning' : 'green'}
              loading={loading}
            />
            <MetricCard
              variant="kpi"
              title="Palha mal empilhada"
              value={`${taxaPalhaPoda.replace('.', ',')}%`}
              footer={`${fmt(totalsPoda.palhaMalEmpilhada)} ocorrência(s)`}
              icon={Rows3}
              tone={totalsPoda.palhaMalEmpilhadaRate > 2 ? 'danger' : totalsPoda.palhaMalEmpilhadaRate > 1 ? 'warning' : 'green'}
              loading={loading}
            />
          </div>

          <div className="grid-container grid-cols-2" style={{ marginBottom: '24px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h3 className="card-title">Farol de Alertas de Poda</h3>
                  <span className="card-subtitle">Metas provisórias até definição operacional final</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AlertFarol label="Plantas sem podar" meta="Meta provisória: < 1,0%" value={taxaPlantaSemPodar} danger={1} warning={0.5} />
                <AlertFarol label="Cachos podres na planta" meta="Meta provisória: < 1,0%" value={taxaCachoPodre} danger={1} warning={0.5} />
                <AlertFarol label="Cachos expostos" meta="Meta provisória: < 2,0%" value={taxaCachoExposto} danger={2} warning={1} />
                <AlertFarol label="Poda em meia coroa" meta="Meta provisória: < 2,0%" value={taxaPodaMeiaCoroa} danger={2} warning={1} />
                <AlertFarol label="Palha mal empilhada" meta="Meta provisória: < 2,0%" value={taxaPalhaPoda} danger={2} warning={1} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Composição das ocorrências</h3>
                  <span className="card-subtitle">Quantidade registrada em cada tipo de falha</span>
                </div>
              </div>
              <div className="quality-stack">
                <QualityBar label="Planta sem podar" value={totalsPoda.plantaSemPodar} max={Math.max(totalsPoda.plantasObservadas, 1)} color="var(--status-danger)" loading={loading} />
                <QualityBar label="Cacho exposto" value={totalsPoda.cachoExposto} max={Math.max(totalsPoda.plantasObservadas, 1)} color="var(--orange-institutional)" loading={loading} />
                <QualityBar label="Poda meia coroa" value={totalsPoda.podaMeiaCoroa} max={Math.max(totalsPoda.plantasObservadas, 1)} color="#F59E0B" loading={loading} />
                <QualityBar label="Poda maior que 1:1" value={totalsPoda.podaMaiorUmParaUm} max={Math.max(totalsPoda.plantasObservadas, 1)} color="#B45309" loading={loading} />
                <QualityBar label="Bico de gaita" value={totalsPoda.bicoGaita} max={Math.max(totalsPoda.plantasObservadas, 1)} color="#8B5CF6" loading={loading} />
                <QualityBar label="Cacho podre na planta" value={totalsPoda.cachoPodrePlanta} max={Math.max(totalsPoda.plantasObservadas, 1)} color="#DC2626" loading={loading} />
                <QualityBar label="Folha mamando" value={totalsPoda.folhaMamando} max={Math.max(totalsPoda.plantasObservadas, 1)} color="#64748B" loading={loading} />
                <QualityBar label="Palha mal empilhada" value={totalsPoda.palhaMalEmpilhada} max={Math.max(totalsPoda.plantasObservadas, 1)} color="var(--status-warning)" loading={loading} />
              </div>
            </div>
          </div>

          <div className="grid-container grid-cols-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Rastreabilidade e aprovação</h3>
                  <span className="card-subtitle">Distribuição por status e registros de campo</span>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                <StatusBadgeRow label="Sincronizados" value={podaRecords.filter((r) => r.status === 'Sincronizado').length} total={podaRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Aprovados" value={podaRecords.filter((r) => r.status === 'Aprovado').length} total={podaRecords.length} color="var(--status-success)" loading={loading} />
                <StatusBadgeRow label="Reprovados" value={podaRecords.filter((r) => r.status === 'Reprovado').length} total={podaRecords.length} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Pendente validação" value={podaRecords.filter((r) => r.status === 'Pendente validação').length} total={podaRecords.length} color="var(--status-warning)" loading={loading} />
                <StatusBadgeRow label="Com GPS app" value={podaRecords.filter((r) => r.gpsApplicable !== false && r.gps).length} total={podaRecords.filter((r) => r.gpsApplicable !== false).length} color="var(--status-info)" loading={loading} />
                <StatusBadgeRow label="Com acompanhamento" value={podaRecords.filter((r) => r.acompanhamento?.teve === 'sim').length} total={podaRecords.length} color="var(--status-info)" loading={loading} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Amostragem operacional</h3>
                  <span className="card-subtitle">Base usada para estimar a qualidade da parcela</span>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                <StatusBadgeRow label="Linhas avaliadas" value={totalsPoda.linhas} total={Math.max(totalsPoda.linhas, 1)} color="var(--green-institutional)" loading={loading} />
                <StatusBadgeRow label="Plantas amostradas" value={totalsPoda.plantasObservadas} total={Math.max(totalsPoda.plantasObservadas, 1)} color="var(--green-institutional)" loading={loading} />
                <StatusBadgeRow label="Plantas projetadas" value={totalsPoda.plantasProjetadas || totalsPoda.plantasObservadas} total={Math.max(totalsPoda.plantasProjetadas || totalsPoda.plantasObservadas, 1)} color="var(--status-info)" loading={loading} />
                <StatusBadgeRow label="Ocorrências críticas" value={totalsPoda.plantaSemPodar + totalsPoda.cachoPodrePlanta} total={Math.max(totalsPoda.plantasObservadas, 1)} color="var(--status-danger)" loading={loading} />
                <StatusBadgeRow label="Ocorrências operacionais" value={totalsPoda.cachoExposto + totalsPoda.podaMeiaCoroa + totalsPoda.podaMaiorUmParaUm + totalsPoda.bicoGaita + totalsPoda.folhaMamando + totalsPoda.palhaMalEmpilhada} total={Math.max(totalsPoda.plantasObservadas, 1)} color="var(--orange-institutional)" loading={loading} />
                <StatusBadgeRow label="Ocorrências projetadas" value={totalsPoda.ocorrenciasPodaProjetadas || 0} total={Math.max(totalsPoda.plantasProjetadas || totalsPoda.plantasObservadas, 1)} color="var(--status-warning)" loading={loading} />
              </div>
            </div>
          </div>

          <div className="grid-container grid-cols-2" style={{ marginTop: '16px' }}>
            <CustomChart loading={loading} type="line" data={chartsPoda.byDayOfMonth} title="Evolução por dia do mês — Nota CQO Poda" />
            <CustomChart loading={loading} type="bar" data={chartsPoda.byFarm} title="Nota CQO Poda por Fazenda" />
          </div>
          <div className="grid-container grid-cols-2">
            <CustomChart loading={loading} type="bar" data={chartsPoda.byEvaluator} title="Nota CQO Poda por Avaliador" />
            <CustomChart loading={loading} type="bar" data={chartsPoda.byCycle} title="Nota CQO Poda por ciclo" />
          </div>

          <SectionHeader eyebrow="Performance Individual" title="Ranking de Avaliadores — Poda" color="var(--green-institutional)" />
          <RankingAvaliadores records={podaRecords} loading={loading} />
        </>
      )}
    </div>
  );
}
