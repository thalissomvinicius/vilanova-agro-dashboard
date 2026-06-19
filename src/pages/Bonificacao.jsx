import React from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Scale,
  Truck,
  Warehouse,
} from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { BONIFICACAO_SOURCE, useBonificacaoData } from '../utils/bonificacaoData';

function fmt(value, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function KpiCard({ title, value, subtitle, icon: Icon, tone = 'green' }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper kpi-icon-${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-body">
        <span className="kpi-value">{value}</span>
      </div>
      <span className="kpi-footer">{subtitle}</span>
    </div>
  );
}

function DataBox({ title, value, subtitle }) {
  return (
    <div className="mini-metric">
      <span>{title}</span>
      <strong>{value}</strong>
      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{subtitle}</small>
    </div>
  );
}

function SourceChip({ label, value }) {
  return (
    <div className="compact-row">
      <div>
        <strong>{label}</strong>
        <span>Fonte Excel mapeada</span>
      </div>
      <div>
        <strong>{value}</strong>
        <span>registros</span>
      </div>
    </div>
  );
}

export default function Bonificacao() {
  const data = useBonificacaoData();
  const counts = BONIFICACAO_SOURCE.workbookCounts;

  return (
    <div className="fade-in page-shell">
      <div className="page-header">
        <div className="page-title-block">
          <span className="page-eyebrow">Bonificacao e Qualidade</span>
          <h2>Base Qualidade CFF</h2>
          <p>Consolidacao do workbook de rampa, faturamento e entrada de CFF. O painel busca primeiro o snapshot online no Supabase e usa a base local apenas como fallback.</p>
        </div>
        <div className="source-card compact">
          <span>Fonte</span>
          <strong>{data.sourceLabel || 'Excel / Supabase'}</strong>
          <small>{data.workbook}</small>
        </div>
      </div>

      <div className="grid-container grid-cols-4">
        <KpiCard title="Entrada de CFF" value={fmt(data.entradaDeCff?.totalRegistros ?? counts.entradaDeCff)} subtitle="f_Balanca / tickets recebidos" icon={Scale} tone="info" />
        <KpiCard title="CQO - Rampa" value={fmt(data.cqoRampa?.totalRegistros ?? counts.cqoRampa)} subtitle="f_CQO / avaliacao de rampa" icon={Truck} tone="orange" />
        <KpiCard title="Faturamento" value={fmt(data.faturamento?.totalRegistros ?? counts.faturamento)} subtitle="f_Faturamento / saidas contabilizadas" icon={Warehouse} tone="green" />
        <KpiCard title="Fornecedores" value={fmt(counts.tipoFornecedor)} subtitle="tabela de tipo e preco" icon={Building2} tone="info" />
      </div>

      <div className="grid-container grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Mapa das fontes</h3>
              <span className="card-subtitle">Tabelas e arquivos que sustentam o BI.</span>
            </div>
            <ClipboardCheck size={20} style={{ color: 'var(--green-institutional)' }} />
          </div>
          <div className="compact-list">
            <SourceChip label="Entrada de CFF" value={counts.entradaDeCff} />
            <SourceChip label="CQO - Rampa" value={counts.cqoRampa} />
            <SourceChip label="Faturamento" value={counts.faturamento} />
            <SourceChip label="Tipo Fornecedor" value={counts.tipoFornecedor} />
            <SourceChip label="Preco Fornecedor" value={counts.precoFornecedor} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Estrutura interna</h3>
              <span className="card-subtitle">Modelo identificado no workbook base.</span>
            </div>
            <FileSpreadsheet size={20} style={{ color: 'var(--orange-institutional)' }} />
          </div>
          <div className="grid-container grid-cols-2" style={{ marginBottom: 0 }}>
            <DataBox title="Tabela" value="f_Balanca" subtitle="Entrada de CFF / balanca" />
            <DataBox title="Tabela" value="f_CQO" subtitle="avaliacao de rampa" />
            <DataBox title="Tabela" value="f_Faturamento" subtitle="pesagem e saidas" />
            <DataBox title="Status" value={data.online ? 'Online' : data.available ? 'Local' : 'Base'} subtitle={data.online ? 'bonificacao_import_snapshots' : data.available ? 'fallback JSON local' : 'aguardando snapshot'} />
          </div>
        </div>
      </div>

      <div className="grid-container grid-cols-2">
        <CustomChart
          loading={false}
          type="bar"
          data={data.charts.entradaPorMes.length ? data.charts.entradaPorMes : [
            { label: 'Entrada', value: counts.entradaDeCff, fill: '#234F2A' },
            { label: 'Rampa', value: counts.cqoRampa, fill: '#D98C10' },
            { label: 'Faturamento', value: counts.faturamento, fill: '#B45309' },
          ]}
          title="Volume por fonte"
        />
        <CustomChart
          loading={false}
          type="bar"
          data={data.charts.fornecedores.length ? data.charts.fornecedores : [
            { label: 'Tipo Fornecedor', value: counts.tipoFornecedor, fill: '#234F2A' },
            { label: 'Preco Fornecedor', value: counts.precoFornecedor, fill: '#D98C10' },
          ]}
          title="Base de fornecedores"
        />
      </div>

      <div className="grid-container grid-cols-2">
        <div className="card">
          <div className="card-header table-card-header">
            <div>
              <h3 className="card-title">Resumo operacional</h3>
              <span className="card-subtitle">Indicadores de cobertura da base estudada.</span>
            </div>
            <CheckCircle2 size={20} style={{ color: 'var(--green-institutional)' }} />
          </div>
          <div className="grid-container grid-cols-2" style={{ marginBottom: 0 }}>
            <DataBox title="Arquivo" value={BONIFICACAO_SOURCE.workbookUpdatedAt} subtitle="ultima referencia local estudada" />
            <DataBox title="Tabelas" value={BONIFICACAO_SOURCE.tables.length} subtitle="modelo interno identificado" />
            <DataBox title="Arquivos" value={BONIFICACAO_SOURCE.files.length} subtitle="fontes principais mapeadas" />
            <DataBox title="Status" value={data.online ? 'Online' : 'Local'} subtitle={data.online ? 'snapshot Supabase ativo' : 'fallback local'} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Notas de uso</h3>
              <span className="card-subtitle">O painel usa `bonificacao_import_snapshots` quando disponivel e preserva o JSON local como contingencia.</span>
            </div>
            <BarChart3 size={20} style={{ color: 'var(--status-info)' }} />
          </div>
          <div className="compact-list">
            <div className="compact-row">
              <div>
                <strong>Entrada de CFF</strong>
                <span>peso bruto, liquido, tara e cachos</span>
              </div>
              <div>
                <strong>{fmt(counts.entradaDeCff)}</strong>
                <span>linhas base</span>
              </div>
            </div>
            <div className="compact-row">
              <div>
                <strong>CQO - Rampa</strong>
                <span>TCA, CV, CM, CP e TC</span>
              </div>
              <div>
                <strong>{fmt(counts.cqoRampa)}</strong>
                <span>avaliacoes</span>
              </div>
            </div>
            <div className="compact-row">
              <div>
                <strong>Faturamento</strong>
                <span>peso liquido e bruto por ticket</span>
              </div>
              <div>
                <strong>{fmt(counts.faturamento)}</strong>
                <span>movimentos</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
