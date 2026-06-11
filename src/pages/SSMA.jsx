import React from 'react';
import { ShieldCheck, AlertOctagon, Heart, Eye, Award, CheckSquare, AlertTriangle } from 'lucide-react';
import CustomChart from '../components/CustomChart';
import { SSMA_MOCK, getChartData } from '../utils/mockData';

export default function SSMA({ farmFilter }) {
  const chartData = getChartData(farmFilter, 'all');
  const data = SSMA_MOCK;

  // Filter occurrences matching active farm filter if specified
  const filteredOcorrencias = data.ocorrenciasRecentes.filter(o => {
    if (farmFilter === 'all') return true;
    const farmNameMap = {
      'rio-capim': 'Fazenda Rio Capim',
      'uraim': 'Fazenda Uraim',
      'condor': 'Fazenda Condor',
      'vila-nova': 'Fazenda Vila Nova'
    };
    return o.farm === farmNameMap[farmFilter];
  });

  const getGravidadeColor = (grav) => {
    switch (grav) {
      case 'Crítica': return 'var(--status-danger)';
      case 'Moderada': return 'var(--status-warning)';
      case 'Leve': return 'var(--status-info)';
      default: return 'var(--text-primary)';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Fechada': return 'badge-success';
      case 'Em Análise': return 'badge-warning';
      case 'Aberta': return 'badge-danger';
      default: return 'badge-info';
    }
  };

  return (
    <div className="fade-in page-shell">
      {/* Title section */}
      <div className="page-header">
        <div className="page-title-block">
          <h2>
            SSMA — Saúde, Segurança e Meio Ambiente (ESG)
          </h2>
          <p>
            Monitoramento de conformidade de segurança e metas de sustentabilidade agrícola.
          </p>
        </div>
        <div
          className="card ssma-goal-card"
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--status-success-bg)',
            borderColor: 'var(--status-success)',
            color: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '800',
            fontSize: '0.9rem'
          }}
        >
          <ShieldCheck size={20} />
          <span>Meta Zero Acidentes: ATINGIDA</span>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid-container grid-cols-4">
        {/* Card 1: Acidentes (Always 0, Meta Zero!) */}
        <div className="card" style={{ borderLeft: '4px solid var(--status-success)', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>
              <span>ACIDENTES GRAVES</span>
              <Heart size={16} style={{ color: 'var(--status-danger)' }} />
            </div>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--status-success)', display: 'block', marginTop: '10px' }}>
              {data.acidentes}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--status-success)', fontWeight: '700' }}>Meta Zero preservada em 2026</span>
        </div>

        {/* Card 2: Incidentes & Quase Acidentes */}
        <div className="card" style={{ borderLeft: '4px solid var(--status-warning)', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>
              <span>INCIDENTES / QUASE ACIDENTES</span>
              <AlertOctagon size={16} style={{ color: 'var(--status-warning)' }} />
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', marginTop: '10px' }}>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)' }}>{data.incidentes}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>/</span>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-secondary)' }}>{data.quaseAcidentes}</span>
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Triados e controlados preventivamente</span>
        </div>

        {/* Card 3: Auditorias & Inspeções */}
        <div className="card" style={{ borderLeft: '4px solid var(--green-institutional)', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>
              <span>AUDITORIAS / INSPEÇÕES</span>
              <Eye size={16} style={{ color: 'var(--green-institutional)' }} />
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', marginTop: '10px' }}>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)' }}>{data.auditorias}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>/</span>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-secondary)' }}>{data.inspecoes}</span>
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--green-institutional)', fontWeight: '700' }}>Meta semestral atingida</span>
        </div>

        {/* Card 4: Treinamentos e Certificados */}
        <div className="card" style={{ borderLeft: '4px solid var(--status-info)', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>
              <span>TREINAMENTOS DE SEGURANÇA</span>
              <Award size={16} style={{ color: 'var(--status-info)' }} />
            </div>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', display: 'block', marginTop: '10px' }}>
              {data.treinamentos}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{data.treinamentosConcluidos} de {data.totalColaboradores} colaboradores aptos</span>
        </div>
      </div>

      {/* Grid: Charts & Compliance Checklists */}
      <div className="grid-container grid-cols-7-5">
        
        {/* Compliance Progress checklist card */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <h3 className="card-title">Checklist de Auditoria e Conformidade</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <CheckSquare size={18} style={{ color: 'var(--green-institutional)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Uso correto de EPIs em tomadas de coleta</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Média amostral de 96.8% de conformidade nas frentes de trabalho de Tomé-Açu.</p>
              </div>
              <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Conforme</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <CheckSquare size={18} style={{ color: 'var(--green-institutional)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Treinamento da NR-31 (Trabalho na Agricultura)</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Todos os operadores ativos de colheita passaram por reciclagem anual.</p>
              </div>
              <span className="badge badge-success" style={{ marginLeft: 'auto' }}>98%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <CheckSquare size={18} style={{ color: 'var(--green-institutional)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Licenciamento de Recursos Hídricos e Resíduos</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outorga estadual válida para o processamento de dendê na unidade industrial.</p>
              </div>
              <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Regular</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Lubrificação de Maquinários e Descarte de Embalagens</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ajuste pendente no abrigo temporário de óleo usado na Fazenda Rio Capim.</p>
              </div>
              <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>Ajustar</span>
            </div>
          </div>
        </div>

        {/* Incidents categories chart */}
        <CustomChart
          type="bar"
          data={chartData.ssmaCategories}
          title="Ocorrências SSMA por Categoria (Quantidade)"
        />
      </div>

      {/* Recente Occurrences Board */}
      <div className="card page-card">
        <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Painel Integrado de Ocorrências e Não Conformidades</span>
          <span className="badge badge-danger">{filteredOcorrencias.length} registradas</span>
        </div>
        <div className="table-wrapper">
          <table className="custom-table" style={{ fontSize: '0.825rem' }}>
            <thead>
              <tr>
                <th>Cód. Ocorrência</th>
                <th>Data</th>
                <th>Fazenda</th>
                <th>Categoria</th>
                <th>Gravidade</th>
                <th>Descrição Técnica</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOcorrencias.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 'bold' }}>#{o.id}</td>
                  <td>{o.data}</td>
                  <td>{o.farm}</td>
                  <td>{o.categoria}</td>
                  <td style={{ color: getGravidadeColor(o.gravidade), fontWeight: '700' }}>
                    {o.gravidade}
                  </td>
                  <td>{o.desc}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
