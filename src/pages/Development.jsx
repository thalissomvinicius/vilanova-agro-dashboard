import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarClock,
  CheckCircle2,
  Factory,
  Layers3,
  LineChart,
  MapPinned,
  Scale,
  Sprout,
  Target,
  TrendingUp,
} from 'lucide-react';

const roadmapGroups = [
  {
    title: 'Base essencial',
    subtitle: 'Indicadores que precisam nascer junto com a alimentação oficial dos dados.',
    tone: 'success',
    items: [
      'Toneladas de CFF por hectare',
      'Cachos por hectare',
      'Peso médio do cacho',
      'Produção por fazenda, parcela, fornecedor e talhão',
      'Evolução semanal e mensal da produção',
    ],
  },
  {
    title: 'Qualidade de maturação',
    subtitle: 'Controle direto do ponto de corte e qualidade entregue à rampa.',
    tone: 'warning',
    items: [
      'Cacho maduro %, verde %, passado % e avermelhado %',
      'Cacho estrela %, talo comprido % e bucha %',
      'Qualidade por dia, fazenda, parcela e fornecedor',
      'Ranking de reincidência por origem',
      'Comparativo meta x realizado por indicador',
    ],
  },
  {
    title: 'Perdas no campo',
    subtitle: 'Camada para transformar falhas de corte e carreamento em impacto físico e financeiro.',
    tone: 'danger',
    items: [
      'Cachos não cortados',
      'Cachos cortados e não carreados',
      'Cachos mal posicionados',
      'Frutos soltos deixados no campo',
      'Perda estimada em toneladas e em R$',
    ],
  },
  {
    title: 'Eficiência operacional',
    subtitle: 'Leitura de equipe, tempo, rotina e execução de campo.',
    tone: 'info',
    items: [
      'Coletas por avaliador',
      'Produção e qualidade por equipe',
      'Tempo entre corte, carreamento e chegada na rampa',
      'Área avaliada por dia',
      'Fazendas com maior reincidência de problema',
    ],
  },
];

const futureData = [
  { icon: Sprout, title: 'Idade do plantio/parcela', text: 'Ajuda a explicar produtividade e maturação por fase da palma.' },
  { icon: Layers3, title: 'Material genético', text: 'Permite comparar desempenho por variedade ou origem de muda.' },
  { icon: Activity, title: 'Chuva por fazenda', text: 'Relaciona estresse hídrico com produtividade, peso e perdas.' },
  { icon: CheckCircle2, title: 'Adubação planejada x realizada', text: 'Conecta manejo nutricional com produção e qualidade.' },
  { icon: AlertTriangle, title: 'Pragas e doenças', text: 'Cria alertas por foco, severidade e reincidência.' },
  { icon: CalendarClock, title: 'Ciclo de colheita', text: 'Mostra dias desde a última colheita por parcela ou fazenda.' },
];

const premiumIdeas = [
  { icon: Target, title: 'IQD - Índice de Qualidade do Dendê', text: 'Nota única por fazenda/produtor: maturação correta menos penalidades de verde, passado, talo, bucha e perdas.' },
  { icon: TrendingUp, title: 'Previsão de produção', text: 'Estimativa por mês e por fazenda usando histórico, ciclo de colheita e produtividade por hectare.' },
  { icon: Scale, title: 'Impacto financeiro', text: 'Conversão automática das perdas em toneladas e valor estimado.' },
  { icon: Factory, title: 'Rendimento industrial', text: 'Ligação entre qualidade agrícola, rampa, acidez, extração de óleo e óleo por tonelada de CFF.' },
  { icon: MapPinned, title: 'Mapa de calor', text: 'Visualização por parcela das concentrações de perda, verde, passado e falhas de carreamento.' },
  { icon: Brain, title: 'Ranking de risco', text: 'Lista de fazendas com maior chance de baixa qualidade na próxima semana.' },
];

const modulePlan = [
  ['CQO Campo', 'Corte, maturação, perdas no campo, frutos soltos e qualidade por dia/fazenda/parcela.'],
  ['CQO Carreamento', 'Não carreado, mal posicionado, tempo de retirada, eficiência logística e perdas por transporte.'],
  ['CQO Rampa', 'Qualidade recebida, produtor, fornecedor, caixas sem avaliação e divergência com campo.'],
  ['Indústria', 'Extração de óleo, acidez, rendimento por tonelada e impacto da maturação no processamento.'],
];

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`development-pill development-pill-${tone}`}>{children}</span>;
}

function RoadmapCard({ group }) {
  return (
    <section className={`development-card development-card-${group.tone}`}>
      <div className="development-card-header">
        <div>
          <h3>{group.title}</h3>
          <p>{group.subtitle}</p>
        </div>
        <StatusPill tone={group.tone}>Aguardando base</StatusPill>
      </div>
      <ul>
        {group.items.map((item) => (
          <li key={item}>
            <span />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DevelopmentTile({ icon: Icon, title, text }) {
  return (
    <article className="development-tile">
      <Icon />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

export default function Development() {
  return (
    <div className="fade-in page-shell development-page">
      <div className="development-hero">
        <div>
          <span>Planejamento técnico</span>
          <h2>Desenvolvimento da Inteligência do Dendê</h2>
          <p>
            Esta aba guarda os indicadores e análises que serão finalizados conforme o sistema
            receber dados oficiais do app, Supabase, rampa e indústria.
          </p>
        </div>
        <div className="development-hero-score">
          <BarChart3 />
          <strong>Roadmap</strong>
          <small>Campo, carreamento, rampa e indústria</small>
        </div>
      </div>

      <div className="development-status-grid">
        <div>
          <span>Momento atual</span>
          <strong>Modelagem dos dados</strong>
        </div>
        <div>
          <span>Prioridade</span>
          <strong>Qualidade + perdas</strong>
        </div>
        <div>
          <span>Próxima etapa</span>
          <strong>Alimentação automática</strong>
        </div>
        <div>
          <span>Assinatura</span>
          <strong>Vinicius Dev.</strong>
        </div>
      </div>

      <div className="development-section-title">
        <LineChart />
        <div>
          <h3>Indicadores cruciais</h3>
          <p>Blocos que devem virar painéis assim que a base for padronizada.</p>
        </div>
      </div>

      <div className="development-roadmap-grid">
        {roadmapGroups.map((group) => (
          <RoadmapCard key={group.title} group={group} />
        ))}
      </div>

      <div className="development-section-title">
        <Sprout />
        <div>
          <h3>Dados futuros para enriquecer a cultura</h3>
          <p>Variáveis agronômicas que explicam produtividade, qualidade e risco.</p>
        </div>
      </div>

      <div className="development-tile-grid">
        {futureData.map((item) => (
          <DevelopmentTile key={item.title} {...item} />
        ))}
      </div>

      <div className="development-section-title">
        <Brain />
        <div>
          <h3>Camada premium de decisão</h3>
          <p>Visões executivas para quando campo, rampa e indústria estiverem conectados.</p>
        </div>
      </div>

      <div className="development-tile-grid premium">
        {premiumIdeas.map((item) => (
          <DevelopmentTile key={item.title} {...item} />
        ))}
      </div>

      <section className="development-module-map">
        <div className="development-section-title compact">
          <Layers3 />
          <div>
            <h3>Onde cada dado entra no sistema</h3>
            <p>Organização por módulo para guiar as próximas telas.</p>
          </div>
        </div>
        <div className="development-module-list">
          {modulePlan.map(([title, text]) => (
            <div key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
