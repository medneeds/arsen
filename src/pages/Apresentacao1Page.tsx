import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, FileText, Play } from "lucide-react";
import socorraoCross from "@/assets/socorrao-cross-logo.png";

/**
 * /apresentacao-1 — Modo apresentação cinemática do Relatório Semana 1.
 * - 1 slide por vez, viewport cheio, escala 16:9.
 * - Transição cinemática (slide horizontal + fade + parallax do fundo).
 * - Cascata de entrada do conteúdo (children com [data-step]).
 * - Navegação: ← → Space PgUp PgDn Home End · F (fullscreen) · Esc.
 * - Toggle para o /relatorio-1 (modo PDF/A4 paisagem) preservado intacto.
 */

const PERIODO = "15/05/2026 — 22/05/2026 (7 dias)";
const VERSAO = "v1.1 · gerado em 22/05/2026";

const ocupacao = [
  { setor: "UTI 1", capacidade: 8, ocupados: 8 },
  { setor: "UTI 2", capacidade: 10, ocupados: 10 },
  { setor: "UCI 1", capacidade: 6, ocupados: 6 },
  { setor: "UCI 2", capacidade: 8, ocupados: 8 },
  { setor: "UCC", capacidade: 37, ocupados: 34 },
  { setor: "Enfermaria de Transição", capacidade: 10, ocupados: 9 },
];
const totalCap = ocupacao.reduce((s, x) => s + x.capacidade, 0);
const totalOcup = ocupacao.reduce((s, x) => s + x.ocupados, 0);
const taxaOcup = ((totalOcup / totalCap) * 100).toFixed(1);

const tendenciaOcupacao = [
  { dia: "15/05", pct: 89 }, { dia: "16/05", pct: 91 }, { dia: "17/05", pct: 92 },
  { dia: "18/05", pct: 95 }, { dia: "19/05", pct: 96 }, { dia: "20/05", pct: 94 },
  { dia: "21/05", pct: 93 }, { dia: "22/05", pct: Number(taxaOcup) },
];

const atividade = [
  { label: "Prescrições emitidas", valor: 459 },
  { label: "Evoluções clínicas", valor: 537 },
  { label: "Admissões registradas", valor: 51 },
  { label: "Movimentações de paciente", valor: 82 },
  { label: "Altas e óbitos documentados", valor: 15 },
  { label: "Pacientes cadastrados (PIS/Recepção)", valor: 38 },
  { label: "Usuários ativos na plataforma", valor: 56 },
  { label: "Eventos auditados (audit_logs)", valor: 18741 },
];

const ativos = [
  { titulo: "Mapa de Pacientes", desc: "Implantado em UTI 1, UTI 2, UCI 1, UCI 2, UCC e Enfermaria de Transição. 79 leitos em operação." },
  { titulo: "Painel Clínico", desc: "Prescrição estruturada, evolução SOAP, exames, cuidados e cockpit unificado nos 6 setores ativos." },
  { titulo: "Gestão executiva", desc: "Painel do Gestor com visão irrestrita dos setores ativos e 6 relatórios executivos plugáveis." },
  { titulo: "Alta, óbito e documentos", desc: "Sumários de alta, declaração de óbito, suspender alta com motivo+senha e ficha de atendimento consolidada em PDF." },
  { titulo: "Autenticação e perfis", desc: "Login por usuário/CPF/e-mail, reset por e-mail, ProfileChooser multi-perfil e aprovação de cadastros pelo gestor." },
  { titulo: "Impressão Norma Zero", desc: "Padrão A4 alinhado com o setor de Qualidade — prescrição, evolução, admissão, APAC, AIH, guia ATM e cultura." },
];

const coberturaProduto = [
  { titulo: "Recepção & Cadastro", desc: "Identificação NI, prontuário único auditável, busca por CPF/nome, triagem express e detecção de duplicatas.", c: "blue" },
  { titulo: "Farmácia Clínica", desc: "Validação farmacêutica, flag Alto Alerta, MAV/Portaria 344 com 3 categorias e catálogo HMDM 2026 (222 princípios, 322 apresentações).", c: "green" },
  { titulo: "Laboratório & Imagem", desc: "Setores dedicados, ciência médica obrigatória, gasometria com split de impressão e 4 modalidades de resultado.", c: "cyan" },
  { titulo: "NIR & Regulação", desc: "9 sub-módulos, 8 status de leito, fila de alocação com SLA ≤2h e monitoramento de gravíssimos.", c: "purple" },
  { titulo: "Urgência & Emergência", desc: "UE Vertical, UE Horizontal, Sala Vermelha, Sala Laranja, Observação Clínica e 7 presets de atendimento rápido.", c: "red" },
];

const correcoes = [
  { tema: "Cabeçalho de impressão unificado", desc: "Padronização do cabeçalho institucional em prescrição, evolução, admissão, APAC, AIH e cultura. Identidade do paciente reescrita com guarda anti-NI e helper único de resolução." },
  { tema: "Layout de prescrição", desc: "Sincronização entre tela compacta e impressão A4. Correção de volumes divergentes em itens IV. Bolus EV liberado para protocolos não-ATB. Comprimido triturável bloqueado em via enteral conforme ISMP-Brasil." },
  { tema: "Padrão de medicações na farmácia", desc: "Importação do catálogo HMDM 2026 com flags automáticas de Alto Alerta, controlados e diluição. Inalatórios com campos dedicados e autofill. Insulinoterapia assistida em 4 esquemas (SBD/ADA/AMIB)." },
  { tema: "Sincronização PIS × prontuário", desc: "Importação de PDF do PIS com leitura por inteligência artificial — o prontuário já chega pronto para admissão. Diff visual em pop-up e banner persistente em Edição Avançada, com motivo obrigatório e auditoria." },
  { tema: "Mapa de leitos × Painel Clínico", desc: "Realtime em 6 hooks com blindagem por encounter_id (Fase B.3). Reuso de leito não vaza mais dados do ocupante anterior. Evolução não some após transferência." },
  { tema: "Autolink de pacientes legados", desc: "Trigger BEFORE INSERT/UPDATE em patients vincula automaticamente patient_registry_id e medical_record via pré-admissão (leito + unidade) ou CPF — sanou pacientes órfãos antigos." },
  { tema: "Validação de prescrição revista", desc: "Sólido oral por VO/SL/enteral aceita quantity como satisfação do dose. Banner âmbar bloqueia assinar/validar/imprimir até peso e alergias estarem preenchidos." },
  { tema: "Edição sensível auditada", desc: "Data de admissão, número de prontuário e identidade do paciente com tabelas imutáveis de histórico, motivo obrigatório e confirmação tipada (\"CONFIRMO\")." },
  { tema: "Arquivamento de rascunhos órfãos", desc: "Rotina pg_cron a cada 30 minutos move rascunhos com mais de 24h, sem assinatura e fora do dia clínico para tabela de arquivo — sem perda de dado." },
  { tema: "Cadeado em setores sem implantação", desc: "UE, Anexo Vascular, CC, Neuro e Clínica Cirúrgica bloqueados com cleanup automático em 24h, preservando todo o prontuário." },
  { tema: "Suspender alta sem perder o documento", desc: "Botão dedicado no cockpit com motivo ≥10 caracteres e confirmação por senha. O documento original permanece auditável." },
  { tema: "Transferência interna unificada", desc: "Mesmo número de atendimento preservado, escalada crítica UTI/UCI 2 dispara SAPS 3 pendente automático após a alocação." },
  { tema: "Suporte 24×7 durante a Semana 1", desc: "Equipe técnica de plantão acompanhando turno a turno, dando retaguarda a médicos, farmácia, enfermagem e NIR no preenchimento e nas dúvidas operacionais." },
  { tema: "Sincronizações estruturais de banco", desc: "Repointing cirúrgico de encounters desalinhados por reuso de leito. View patient_timeline e auditoria em 15 tabelas garantindo histórico longitudinal íntegro." },
];

const blindagens = [
  { titulo: "Nenhum dado clínico é apagado", desc: "Toda baixa é arquivamento — o registro permanece auditável para sempre." },
  { titulo: "Edição sensível exige motivo + \"CONFIRMO\"", desc: "Data de admissão, prontuário, identidade e alta passam por confirmação tipada com trilha de auditoria." },
  { titulo: "RLS ativa em todas as tabelas", desc: "Cada perfil enxerga apenas o que lhe cabe — admin, gestor, médico, farmácia, enfermagem, recepção, NIR, qualidade." },
  { titulo: "Encounter_id por leito", desc: "Reuso de leito não vaza dados do ocupante anterior. Filtro defensivo em 6 hooks do cockpit (Fase B.3)." },
];

const desafios = [
  "Tempo de carga em máquinas mais fracas — depende de hardware das estações, fora do nosso controle direto.",
  "Adesão completa do plantonista ao fluxo da plataforma — SOAP é obrigatório apenas na evolução de rotina.",
  "Padronização no preenchimento de peso, alergias e prescrição — médicos relatam baixa intuitividade no fluxo atual.",
  "Adesão ao SAPS 3 na admissão de UTI/UCI 2 — escalada crítica precisa ser concluída logo após a alocação.",
  "Treinamento contínuo de todos os usuários — equipe técnica em plantão 24×7 durante os últimos 7 dias.",
  "Sincronização dos dados do PIS com o registro do paciente — desafio encontrado e já solucionado com IA.",
  "Comunicação clara das mudanças semanais — release notes e treinamentos curtos.",
];

const prioridade = {
  titulo: "Otimização do ato de prescrever",
  desc: "Prescrição intuitiva, rápida, sem travas e com o menor número de cliques possível. Inclui melhoria do builder por dispositivo (oral, EV, enteral, inalatório), preenchimento facilitado de datas e doses, fluxo de assinatura e validação, e salvamento de rascunho — recurso que muitas plataformas no país não oferecem. Esta é a única prioridade para a Semana 2.",
};

// ---------------------------------------------------------------- Trend chart
function TrendChart() {
  const w = 880, h = 200, padX = 40, padY = 28;
  const innerW = w - padX * 2, innerH = h - padY * 2;
  const max = 100, min = 80;
  const points = tendenciaOcupacao.map((d, i) => ({
    x: padX + (i / (tendenciaOcupacao.length - 1)) * innerW,
    y: padY + innerH - ((d.pct - min) / (max - min)) * innerH,
    ...d,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${path} L${points[points.length - 1].x},${padY + innerH} L${points[0].x},${padY + innerH} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trend-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="apTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="apTrendLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {[80, 85, 90, 95, 100].map((v) => {
        const y = padY + innerH - ((v - min) / (max - min)) * innerH;
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#dbeafe" strokeDasharray="2 5" />
            <text x={padX - 8} y={y + 4} fontSize="11" fill="#94a3b8" textAnchor="end">{v}%</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#apTrendFill)" />
      <path d={path} fill="none" stroke="url(#apTrendLine)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => (
        <g key={p.dia}>
          <circle cx={p.x} cy={p.y} r="4.5" fill="#fff" stroke="#2563eb" strokeWidth="2.5" />
          <text x={p.x} y={h - 8} fontSize="11" fill="#64748b" textAnchor="middle">{p.dia}</text>
          <text x={p.x} y={p.y - 11} fontSize="11" fill="#2563eb" fontWeight="700" textAnchor="middle">{p.pct}%</text>
        </g>
      ))}
    </svg>
  );
}

// ----------------------------------------------------------- Slide chrome
function CoverHeader() {
  return (
    <>
      <div className="ap-cross-bar" aria-hidden="true">
        <span style={{ background: "#E31E24" }} />
        <span style={{ background: "#F47920" }} />
        <span style={{ background: "#FFC20E" }} />
        <span style={{ background: "#00A651" }} />
        <span style={{ background: "#0054A6" }} />
      </div>
      <header className="ap-cover-header">
        <img src={socorraoCross} alt="HMDM Socorrão I" className="ap-cover-logo" />
        <div className="ap-cover-institution">
          <span>PREFEITURA DE SÃO LUÍS</span>
          <span>SECRETARIA MUNICIPAL DE SAÚDE</span>
          <span>HOSPITAL MUNICIPAL DJALMA MARQUES — SOCORRÃO I</span>
        </div>
        <div className="ap-cover-spacer" />
      </header>
    </>
  );
}

function SlideShell({ children, kicker, title, n, total }: {
  children: React.ReactNode; kicker?: string; title?: string; n: number; total: number;
}) {
  return (
    <div className="ap-slide">
      <header className="ap-header" data-step="0">
        <div className="ap-brand">
          <span className="ap-brand-arsen">Arsen</span>
          <span className="ap-brand-divider" />
          <img src={socorraoCross} alt="Socorrão I" className="ap-brand-logo" />
          <span className="ap-brand-sub">Relatório de Implantação · Semana 1</span>
        </div>
        <div className="ap-page">{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</div>
      </header>
      {(kicker || title) && (
        <div className="ap-title-block">
          {kicker && <div className="ap-kicker" data-step="1">{kicker}</div>}
          {title && <h2 className="ap-title" data-step="2">{title}</h2>}
        </div>
      )}
      <div className="ap-body">{children}</div>
      <footer className="ap-footer" data-step="0">
        <span>HMDM · Socorrão I · {PERIODO}</span>
        <span>{VERSAO}</span>
      </footer>
    </div>
  );
}

// ============================================================== Page
export default function Apresentacao1Page() {
  useEffect(() => {
    document.title = "Apresentação — Semana 1 | Arsen × Socorrão I";
  }, []);

  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [scale, setScale] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Build slide renderers
  const slides = useMemo<Array<(n: number, total: number) => JSX.Element>>(() => [
    // 1 — CAPA
    (n, total) => (
      <div className="ap-slide ap-cover">
        <CoverHeader />
        <div className="ap-cover-content">
          <span className="ap-wordmark-hero" data-step="1">Arsen</span>
          <div className="ap-kicker light" data-step="2">Plataforma Clínica Inteligente · Em parceria com o HMDM Socorrão I</div>
          <h1 className="ap-cover-title" data-step="3">Relatório de Implantação<br /><span>Semana 1 · Trabalhando em conjunto</span></h1>
          <p className="ap-cover-sub" data-step="4">{PERIODO}</p>
          <div className="ap-cover-meta">
            <div data-step="5"><span>Versão</span><strong>{VERSAO}</strong></div>
            <div data-step="6"><span>Setores ativos</span><strong>UTI 1 · UTI 2 · UCI 1 · UCI 2 · UCC · Enf. Transição</strong></div>
            <div data-step="7"><span>Leitos em operação</span><strong>{totalOcup} pacientes · {totalCap} leitos</strong></div>
          </div>
        </div>
        <footer className="ap-footer ap-cover-footer">
          <span>Confidencial · uso institucional · MAN.05-001</span>
          <span>{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </footer>
      </div>
    ),

    // 2 — SUMÁRIO EXECUTIVO
    (n, total) => (
      <SlideShell n={n} total={total} kicker="01 · Visão geral" title="Sumário executivo da semana">
        <div className="ap-grid ap-grid-exec">
          <div className="ap-card" data-step="3">
            <h3>O que foi entregue de fato</h3>
            <ul>
              <li><strong>Mapa de Pacientes + Painel Clínico</strong> em produção assistencial em <strong>6 setores</strong>: UTI 1, UTI 2, UCI 1, UCI 2, UCC e Enfermaria de Transição.</li>
              <li><strong>Centenas de correções e ajustes finos</strong> aplicados ao longo dos 7 dias, com auditoria preservando todo o dado clínico.</li>
              <li><strong>{totalOcup} pacientes</strong> sob acompanhamento ativo nos setores em implantação.</li>
              <li><strong>{atividade[7].valor.toLocaleString("pt-BR")}</strong> eventos auditados em 7 dias — uso real e contínuo da plataforma.</li>
            </ul>
          </div>
          <div className="ap-card ap-card-accent" data-step="4">
            <h3>Indicadores-chave</h3>
            <div className="ap-kpis">
              <div className="ap-kpi"><span>{taxaOcup}%</span><small>Taxa de ocupação dos setores ativos</small></div>
              <div className="ap-kpi"><span>{atividade[0].valor}</span><small>Prescrições emitidas</small></div>
              <div className="ap-kpi"><span>{atividade[1].valor}</span><small>Evoluções clínicas</small></div>
              <div className="ap-kpi"><span>{atividade[6].valor}</span><small>Usuários ativos</small></div>
            </div>
          </div>
        </div>
      </SlideShell>
    ),

    // 3 — OCUPAÇÃO
    (n, total) => (
      <SlideShell n={n} total={total} kicker="02 · Censo" title="Ocupação de leitos por setor">
        <div className="ap-ocup-grid">
          <div className="ap-bed-table" data-step="3">
            <div className="ap-bed-row ap-bed-head">
              <span>Setor</span><span>Cap.</span><span>Ocup.</span><span>Vagos</span><span>%</span><span>Barra</span>
            </div>
            {ocupacao.map((s) => {
              const pct = (s.ocupados / s.capacidade) * 100;
              return (
                <div className="ap-bed-row" key={s.setor}>
                  <span><strong>{s.setor}</strong></span>
                  <span>{s.capacidade}</span>
                  <span>{s.ocupados}</span>
                  <span>{s.capacidade - s.ocupados}</span>
                  <span>{pct.toFixed(0)}%</span>
                  <span className="ap-bar"><span className="ap-bar-fill" style={{ width: `${pct}%` }} /></span>
                </div>
              );
            })}
            <div className="ap-bed-row ap-bed-total">
              <span><strong>TOTAL</strong></span>
              <span>{totalCap}</span><span>{totalOcup}</span><span>{totalCap - totalOcup}</span><span>{taxaOcup}%</span>
              <span className="ap-bar"><span className="ap-bar-fill" style={{ width: `${taxaOcup}%` }} /></span>
            </div>
          </div>
          <div className="ap-trend-card" data-step="4">
            <p className="ap-trend-title">Taxa de ocupação · evolução diária</p>
            <TrendChart />
            <p className="ap-trend-foot">Setores em implantação assistencial — UTI 1/2, UCI 1/2, UCC e Enf. Transição.</p>
          </div>
        </div>
      </SlideShell>
    ),

    // 4 — VOLUME
    (n, total) => (
      <SlideShell n={n} total={total} kicker="03 · Atividade" title="Volume operacional nos 7 dias">
        <div className="ap-grid ap-grid-4">
          {atividade.map((a, i) => (
            <div className="ap-stat" key={a.label} data-step={3 + Math.floor(i / 2)}>
              <strong>{a.valor.toLocaleString("pt-BR")}</strong>
              <small>{a.label}</small>
            </div>
          ))}
        </div>
        <p className="ap-note" data-step="8">Pico operacional em 18/05 com 3.638 eventos auditados. Todos os números acima estão auditáveis em audit_logs.</p>
      </SlideShell>
    ),

    // 5 — EM IMPLANTAÇÃO ATIVA
    (n, total) => (
      <SlideShell n={n} total={total} kicker="04 · Em implantação ativa" title="O que a plataforma já entrega no Socorrão I">
        <div className="ap-feature-grid">
          {ativos.map((f, i) => (
            <div className="ap-feature ap-feature-on" key={f.titulo} data-step={3 + i}>
              <h4>{f.titulo}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </SlideShell>
    ),

    // 6 — COBERTURA
    (n, total) => (
      <SlideShell n={n} total={total} kicker="05 · Cobertura de produto" title="A plataforma já cobre — pronta para expandir">
        <p className="ap-lede" data-step="3">Estes módulos já estão <strong>prontos no produto</strong>, ainda não na fase atual de implantação. Diferenciais que ampliam o escopo a qualquer momento.</p>
        <div className="ap-cover-grid">
          {coberturaProduto.map((c, i) => (
            <div key={c.titulo} className={`ap-cover-card ap-cover-${c.c}`} data-step={4 + i}>
              <h4>{c.titulo}</h4>
              <p>{c.desc}</p>
              <span className="ap-cover-tag">Disponível · fora da implantação atual</span>
            </div>
          ))}
        </div>
      </SlideShell>
    ),

    // 7-9 — CORREÇÕES (5/5/4)
    ...([correcoes.slice(0, 5), correcoes.slice(5, 10), correcoes.slice(10)].map((chunk, ci) =>
      (n: number, total: number) => (
        <SlideShell
          key={`corr-${ci}`}
          n={n}
          total={total}
          kicker={`06.${ci + 1} · Correções e ajustes`}
          title={ci === 0 ? "Principais correções aplicadas" : "Principais correções aplicadas (cont.)"}
        >
          <div className="ap-feature-grid">
            {chunk.map((f, i) => (
              <div className="ap-feature ap-feature-fix" key={f.tema} data-step={3 + i}>
                <h4>{f.tema}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </SlideShell>
      )
    )),

    // 10 — PRINCÍPIOS
    (n, total) => (
      <SlideShell n={n} total={total} kicker="07 · Governança" title="Princípios imutáveis da plataforma">
        <div className="ap-grid ap-grid-2">
          <div className="ap-card" data-step="3">
            <h3>3 camadas blindadas</h3>
            <ul>
              <li><strong>Dados</strong> — leitura/escrita em tabelas e RPCs.</li>
              <li><strong>Movimentação</strong> — fluxo de paciente entre leitos e setores.</li>
              <li><strong>Auditoria</strong> — logs imutáveis e histórico longitudinal.</li>
            </ul>
            <p className="ap-muted">Pedido em uma camada nunca toca a outra sem confirmação explícita. Layout permanece evolutivo.</p>
          </div>
          <div className="ap-card" data-step="4">
            <h3>Blindagens permanentes</h3>
            <ul>
              {blindagens.map((b) => (
                <li key={b.titulo}><strong>{b.titulo}.</strong> {b.desc}</li>
              ))}
            </ul>
          </div>
        </div>
      </SlideShell>
    ),

    // 11 — DESAFIOS
    (n, total) => (
      <SlideShell n={n} total={total} kicker="08 · Desafios" title="Desafios identificados na operação">
        <div className="ap-challenge-grid">
          {desafios.map((d, i) => (
            <div className="ap-challenge" key={i} data-step={3 + i}>
              <span className="ap-num">{String(i + 1).padStart(2, "0")}</span>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </SlideShell>
    ),

    // 12 — PRIORIDADE
    (n, total) => (
      <SlideShell n={n} total={total} kicker="09 · Próximos passos" title="Prioridade única para a Semana 2">
        <div className="ap-priority" data-step="3">
          <div className="ap-priority-tag">Prioridade #1 · única</div>
          <h3>{prioridade.titulo}</h3>
          <p>{prioridade.desc}</p>
          <div className="ap-priority-pillars">
            <div data-step="4"><strong>Intuitivo</strong><span>menor curva de aprendizado</span></div>
            <div data-step="5"><strong>Rápido</strong><span>menor número de cliques</span></div>
            <div data-step="6"><strong>Sem travas</strong><span>fluxo contínuo até a assinatura</span></div>
            <div data-step="7"><strong>Rascunho seguro</strong><span>nada se perde no caminho</span></div>
          </div>
        </div>
      </SlideShell>
    ),

    // 13 — ENCERRAMENTO
    (n, total) => (
      <div className="ap-slide ap-cover ap-cover-end">
        <CoverHeader />
        <div className="ap-cover-content">
          <span className="ap-wordmark-hero" data-step="1">Arsen</span>
          <div className="ap-kicker light" data-step="2">Encerramento · Semana 1</div>
          <h1 className="ap-cover-title" data-step="3">Obrigado.<br /><span>Seguimos para a Semana 2 com base sólida.</span></h1>
          <p className="ap-cover-sub" data-step="4">
            {totalOcup} pacientes acompanhados · {(atividade[0].valor + atividade[1].valor).toLocaleString("pt-BR")} documentos clínicos emitidos · centenas de correções sem perda de dado.
          </p>
          <div className="ap-cover-meta">
            <div data-step="5"><span>Plataforma</span><strong>Arsen</strong></div>
            <div data-step="6"><span>Unidade</span><strong>HMDM · Socorrão I</strong></div>
            <div data-step="7"><span>Relatório</span><strong>arsen.com.br/relatorio-1</strong></div>
          </div>
        </div>
        <footer className="ap-footer ap-cover-footer">
          <span>Confidencial · uso institucional · MAN.05-001</span>
          <span>{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </footer>
      </div>
    ),
  ], []);

  const total = slides.length;

  // --- Scale to viewport (16:9 base 1920×1080)
  useEffect(() => {
    const compute = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const s = Math.min(W / 1920, H / 1080);
      setScale(s);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // --- Navigation
  const go = useCallback((next: number) => {
    setIdx((cur) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === cur) return cur;
      setDir(clamped > cur ? 1 : -1);
      setAnimKey((k) => k + 1);
      return clamped;
    });
  }, [total]);

  const goNext = useCallback(() => go(idx + 1), [go, idx]);
  const goPrev = useCallback(() => go(idx - 1), [go, idx]);

  // --- Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goPrev(); }
      else if (e.key === "Home") { e.preventDefault(); go(0); }
      else if (e.key === "End") { e.preventDefault(); go(total - 1); }
      else if (e.key.toLowerCase() === "f") { toggleFullscreen(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, go, total]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // --- Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) { dx < 0 ? goNext() : goPrev(); }
    touchStartX.current = null;
  };

  const render = slides[idx];

  return (
    <div className="ap-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <style>{styles}</style>

      {/* Parallax background */}
      <div className="ap-bg" aria-hidden="true" key={`bg-${animKey}`}>
        <div className="ap-bg-grad" />
        <div className="ap-bg-orb ap-bg-orb-1" />
        <div className="ap-bg-orb ap-bg-orb-2" />
      </div>

      {/* Toolbar */}
      <div className="ap-toolbar">
        <Link to="/" className="ap-tb-btn"><ArrowLeft size={14} /> <span>Voltar</span></Link>
        <Link to="/relatorio-1" className="ap-tb-btn"><FileText size={14} /> <span>Modo PDF</span></Link>
        <button className="ap-tb-btn" onClick={toggleFullscreen} title="Tela cheia (F)"><Maximize2 size={14} /> <span>Tela cheia</span></button>
      </div>

      {/* Slide stage */}
      <div className="ap-stage">
        <div
          className={`ap-canvas ap-dir-${dir > 0 ? "fwd" : "bwd"}`}
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
          key={`slide-${idx}-${animKey}`}
        >
          {render(idx + 1, total)}
        </div>
      </div>

      {/* Side click zones */}
      <button className="ap-zone ap-zone-l" onClick={goPrev} aria-label="Anterior">
        <ChevronLeft size={28} />
      </button>
      <button className="ap-zone ap-zone-r" onClick={goNext} aria-label="Próximo">
        <ChevronRight size={28} />
      </button>

      {/* Progress / dots */}
      <div className="ap-progress">
        <div className="ap-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`ap-dot ${i === idx ? "is-active" : ""} ${i < idx ? "is-past" : ""}`}
              onClick={() => go(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <div className="ap-progress-meta">
          <span>{String(idx + 1).padStart(2, "0")} <em>/ {String(total).padStart(2, "0")}</em></span>
          <span className="ap-hint"><Play size={11} /> ← → · Space · F · Esc</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================== Styles
const styles = `
.ap-root {
  position: fixed; inset: 0;
  background: #f8fafc;
  color: #0f172a;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

/* ----- Background parallax ----- */
.ap-bg { position: absolute; inset: 0; overflow: hidden; z-index: 0; }
.ap-bg-grad {
  position: absolute; inset: -10%;
  background:
    radial-gradient(ellipse at 20% 20%, #eff6ff 0%, transparent 55%),
    radial-gradient(ellipse at 80% 80%, #e0f2fe 0%, transparent 55%),
    #ffffff;
  animation: apBgDrift 900ms cubic-bezier(.22,.61,.36,1) both;
}
.ap-bg-orb {
  position: absolute; border-radius: 50%; filter: blur(80px); opacity: .35;
  animation: apOrbFloat 900ms cubic-bezier(.22,.61,.36,1) both;
}
.ap-bg-orb-1 { width: 520px; height: 520px; background: #60a5fa; top: -120px; left: -120px; }
.ap-bg-orb-2 { width: 620px; height: 620px; background: #38bdf8; bottom: -160px; right: -160px; }
@keyframes apBgDrift {
  0% { transform: translate3d(-30px, 8px, 0) scale(1.04); opacity: 0; }
  100% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
}
@keyframes apOrbFloat {
  0% { transform: translate3d(40px, 20px, 0) scale(.92); opacity: 0; }
  100% { transform: translate3d(0,0,0) scale(1); opacity: .35; }
}

/* ----- Toolbar ----- */
.ap-toolbar {
  position: absolute; top: 18px; left: 18px; z-index: 50;
  display: flex; gap: 8px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(10px);
  border: 1px solid #e2e8f0; border-radius: 999px; padding: 6px;
  box-shadow: 0 8px 22px -12px rgba(15,23,42,.15);
  opacity: 0; animation: apToolFade .4s .25s forwards;
}
@keyframes apToolFade { to { opacity: 1; } }
.ap-tb-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 999px;
  font-size: 12px; font-weight: 500; color: #334155;
  background: transparent; border: 0; cursor: pointer;
  text-decoration: none; transition: background .18s, color .18s;
}
.ap-tb-btn:hover { background: #0f172a; color: #fff; }
.ap-tb-btn span { letter-spacing: .01em; }

/* ----- Stage ----- */
.ap-stage { position: absolute; inset: 0; z-index: 10; }
.ap-canvas {
  position: absolute; top: 50%; left: 50%;
  width: 1920px; height: 1080px;
  transform-origin: center center;
  will-change: transform, opacity;
}
.ap-canvas.ap-dir-fwd { animation: apEnterFwd 620ms cubic-bezier(.22,.61,.36,1) both; }
.ap-canvas.ap-dir-bwd { animation: apEnterBwd 620ms cubic-bezier(.22,.61,.36,1) both; }
@keyframes apEnterFwd {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(var(--apScale,1)) translateX(80px); filter: blur(6px); }
  60%  { opacity: 1; filter: blur(0); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(var(--apScale,1)) translateX(0); }
}
@keyframes apEnterBwd {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(var(--apScale,1)) translateX(-80px); filter: blur(6px); }
  60%  { opacity: 1; filter: blur(0); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(var(--apScale,1)) translateX(0); }
}

/* ----- Side zones ----- */
.ap-zone {
  position: absolute; top: 0; bottom: 0; width: 14%;
  background: transparent; border: 0; cursor: pointer; color: #0f172a;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity .2s, background .2s;
  z-index: 40;
}
.ap-zone-l { left: 0; justify-content: flex-start; padding-left: 22px; }
.ap-zone-r { right: 0; justify-content: flex-end; padding-right: 22px; }
.ap-zone:hover { opacity: 1; background: linear-gradient(90deg, rgba(15,23,42,.06), transparent); }
.ap-zone-r:hover { background: linear-gradient(-90deg, rgba(15,23,42,.06), transparent); }

/* ----- Progress ----- */
.ap-progress {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  z-index: 50; display: flex; flex-direction: column; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.75); backdrop-filter: blur(10px);
  border: 1px solid #e2e8f0; border-radius: 18px; padding: 10px 18px;
  box-shadow: 0 10px 28px -16px rgba(15,23,42,.18);
  opacity: 0; animation: apToolFade .4s .35s forwards;
}
.ap-dots { display: flex; gap: 6px; }
.ap-dot {
  width: 24px; height: 5px; border-radius: 4px; border: 0; cursor: pointer;
  background: #e2e8f0; padding: 0; transition: background .25s, width .25s;
}
.ap-dot.is-past { background: #94a3b8; }
.ap-dot.is-active {
  background: linear-gradient(90deg, #0054A6, #2563eb, #38bdf8);
  width: 44px;
}
.ap-progress-meta {
  display: flex; align-items: center; gap: 14px;
  font-size: 11px; color: #64748b; font-variant-numeric: tabular-nums;
  letter-spacing: .04em; text-transform: uppercase;
}
.ap-progress-meta em { color: #94a3b8; font-style: normal; }
.ap-hint { display: inline-flex; align-items: center; gap: 5px; }

/* ====================================================== SLIDE BASE */
.ap-slide {
  position: relative;
  width: 1920px; height: 1080px;
  background: #ffffff;
  display: flex; flex-direction: column;
  padding: 96px 120px 80px;
  box-shadow: 0 40px 120px -40px rgba(15,23,42,.25), 0 0 0 1px #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

/* Header */
.ap-header {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 28px; border-bottom: 1px solid #e2e8f0;
}
.ap-brand { display: flex; align-items: center; gap: 18px; }
.ap-brand-arsen {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 44px; font-weight: 700; line-height: 1;
  background: linear-gradient(135deg, #0054A6 0%, #1e3a8a 35%, #2563eb 65%, #38bdf8 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 6px rgba(37,99,235,.18));
}
.ap-brand-divider { width: 1px; height: 38px; background: #cbd5e1; }
.ap-brand-logo { height: 44px; width: auto; }
.ap-brand-sub { font-size: 20px; color: #64748b; letter-spacing: .02em; }
.ap-page {
  font-size: 18px; font-weight: 600; color: #94a3b8;
  font-variant-numeric: tabular-nums; letter-spacing: .12em;
}

/* Title block */
.ap-title-block { padding: 36px 0 26px; }
.ap-kicker {
  display: inline-block; font-size: 18px; font-weight: 700;
  color: #2563eb; letter-spacing: .22em; text-transform: uppercase;
  padding: 6px 14px; background: #eff6ff; border-radius: 999px;
}
.ap-kicker.light {
  background: rgba(37,99,235,.08); color: #2563eb;
}
.ap-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 72px; line-height: 1.08; letter-spacing: -0.025em;
  font-weight: 700; color: #0f172a; margin: 16px 0 0;
}

/* Body */
.ap-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 24px; padding-top: 6px; }

/* Footer */
.ap-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 22px; border-top: 1px solid #e2e8f0;
  font-size: 15px; color: #94a3b8; letter-spacing: .04em;
}

/* ====================================================== ENTRY CASCADE
   Each [data-step] element fades+lifts in. CSS handles staggered delay
   automatically based on the data-step attribute. */
.ap-canvas [data-step] {
  opacity: 0;
  animation: apStep 700ms cubic-bezier(.22,.61,.36,1) forwards;
}
.ap-canvas [data-step="0"] { animation-delay: 200ms; }
.ap-canvas [data-step="1"] { animation-delay: 340ms; }
.ap-canvas [data-step="2"] { animation-delay: 460ms; }
.ap-canvas [data-step="3"] { animation-delay: 580ms; }
.ap-canvas [data-step="4"] { animation-delay: 690ms; }
.ap-canvas [data-step="5"] { animation-delay: 790ms; }
.ap-canvas [data-step="6"] { animation-delay: 880ms; }
.ap-canvas [data-step="7"] { animation-delay: 970ms; }
.ap-canvas [data-step="8"] { animation-delay: 1060ms; }
@keyframes apStep {
  0%   { opacity: 0; transform: translateY(22px); filter: blur(4px); }
  60%  { filter: blur(0); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}

/* ====================================================== COVER (1 / 13) */
.ap-cover {
  padding: 0;
  display: flex; flex-direction: column;
  background: #ffffff;
}
.ap-cross-bar {
  position: absolute; top: 0; left: 0; right: 0;
  height: 10px; display: flex; z-index: 2;
}
.ap-cross-bar > span { flex: 1; }
.ap-cover-header {
  display: grid; grid-template-columns: auto 1fr auto;
  align-items: center; gap: 32px;
  padding: 56px 96px 0;
}
.ap-cover-logo { height: 96px; width: auto; }
.ap-cover-institution {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  text-align: center;
}
.ap-cover-institution span:nth-child(1) { font-size: 18px; color: #64748b; letter-spacing: .18em; text-transform: uppercase; }
.ap-cover-institution span:nth-child(2) { font-size: 22px; color: #334155; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.ap-cover-institution span:nth-child(3) { font-size: 28px; color: #0f172a; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.ap-cover-spacer { width: 96px; }

.ap-cover-content {
  flex: 1; padding: 80px 120px 40px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.ap-wordmark-hero {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 220px; font-weight: 700; line-height: .95;
  background: linear-gradient(135deg, #0054A6 0%, #1e3a8a 30%, #2563eb 60%, #38bdf8 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 8px 28px rgba(37,99,235,.22));
  margin: 0 0 24px; letter-spacing: -0.04em;
}
.ap-cover-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 60px; line-height: 1.12; letter-spacing: -0.02em;
  font-weight: 700; color: #0f172a; margin: 14px 0 18px;
}
.ap-cover-title span { font-weight: 400; color: #475569; font-style: italic; font-size: 42px; }
.ap-cover-sub {
  font-size: 22px; color: #64748b; margin: 0 0 36px; letter-spacing: .02em;
}
.ap-cover-meta {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
  width: 100%; max-width: 1200px;
}
.ap-cover-meta > div {
  background: linear-gradient(135deg, #0054A6 0%, #1e3a8a 50%, #2563eb 100%);
  color: #fff; padding: 22px 26px; border-radius: 16px;
  display: flex; flex-direction: column; gap: 6px; text-align: left;
  box-shadow: 0 20px 40px -22px rgba(37,99,235,.45);
}
.ap-cover-meta span {
  font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255,255,255,.7);
}
.ap-cover-meta strong { font-size: 18px; font-weight: 600; line-height: 1.35; }

.ap-cover-footer {
  padding: 22px 96px 32px; border-top: 1px solid #e2e8f0;
  background: #fff; z-index: 3;
}
.ap-cover-end .ap-cover-title { font-size: 56px; }
.ap-cover-end .ap-wordmark-hero { font-size: 180px; }

/* ====================================================== GRIDS */
.ap-grid { display: grid; gap: 24px; }
.ap-grid-2 { grid-template-columns: 1fr 1fr; }
.ap-grid-4 { grid-template-columns: repeat(4, 1fr); }
.ap-grid-exec { grid-template-columns: 1.35fr 1fr; align-items: stretch; }

/* Cards */
.ap-card {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 18px;
  padding: 32px 34px; display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 8px 24px -16px rgba(15,23,42,.08);
}
.ap-card h3 {
  font-size: 26px; font-weight: 700; color: #0f172a;
  margin: 0; letter-spacing: -.01em;
}
.ap-card ul { margin: 0; padding: 0 0 0 22px; display: flex; flex-direction: column; gap: 12px; }
.ap-card li { font-size: 19px; line-height: 1.5; color: #334155; }
.ap-card strong { color: #0f172a; font-weight: 700; }
.ap-card-accent {
  background: linear-gradient(135deg, #0054A6 0%, #1e3a8a 50%, #2563eb 100%);
  color: #fff; border: 0;
  box-shadow: 0 24px 60px -28px rgba(37,99,235,.55);
}
.ap-card-accent h3 { color: #fff; }
.ap-muted { font-size: 16px; color: #64748b; font-style: italic; margin: 8px 0 0; }

/* KPIs */
.ap-kpis {
  display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr;
  gap: 16px; flex: 1; margin-top: 8px;
}
.ap-kpi {
  background: rgba(255,255,255,.13); border-radius: 14px; padding: 22px;
  display: flex; flex-direction: column; justify-content: center;
  border: 1px solid rgba(255,255,255,.18);
}
.ap-kpi span {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 60px; font-weight: 700; line-height: 1; color: #fff;
}
.ap-kpi small {
  font-size: 14px; color: rgba(255,255,255,.78); margin-top: 10px; line-height: 1.4;
  letter-spacing: .02em;
}

/* Stats (volume) */
.ap-stat {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 18px;
  padding: 28px 26px; display: flex; flex-direction: column; gap: 8px;
  box-shadow: 0 8px 24px -16px rgba(15,23,42,.08);
  min-height: 180px; justify-content: center;
}
.ap-stat strong {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 56px; font-weight: 700; line-height: 1;
  background: linear-gradient(135deg, #0054A6 0%, #2563eb 70%, #38bdf8 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.ap-stat small { font-size: 16px; color: #475569; line-height: 1.4; }

.ap-note {
  font-size: 16px; color: #64748b; font-style: italic;
  padding: 14px 18px; background: #f1f5f9; border-radius: 10px;
  border-left: 3px solid #2563eb;
}

/* ====================================================== Ocupação */
.ap-ocup-grid {
  display: grid; grid-template-columns: 1.25fr 1fr; gap: 28px; flex: 1; min-height: 0;
}
.ap-bed-table {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 22px 26px;
  display: flex; flex-direction: column; gap: 6px;
  box-shadow: 0 8px 24px -16px rgba(15,23,42,.08);
}
.ap-bed-row {
  display: grid; grid-template-columns: 2.6fr .6fr .6fr .6fr .6fr 2fr;
  align-items: center; gap: 12px; padding: 12px 0;
  border-bottom: 1px solid #f1f5f9; font-size: 17px; color: #334155;
}
.ap-bed-head {
  font-size: 12px; color: #94a3b8; letter-spacing: .12em; text-transform: uppercase;
  padding-bottom: 10px;
}
.ap-bed-total {
  border-top: 2px solid #0f172a; border-bottom: 0;
  margin-top: 6px; padding-top: 14px; font-weight: 700; color: #0f172a;
}
.ap-bar { background: #e2e8f0; height: 8px; border-radius: 6px; overflow: hidden; }
.ap-bar-fill {
  display: block; height: 100%;
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}
.ap-trend-card {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 18px;
  padding: 26px 28px; display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 8px 24px -16px rgba(15,23,42,.08);
}
.ap-trend-title { font-size: 18px; font-weight: 600; color: #0f172a; margin: 0; }
.ap-trend-foot { font-size: 14px; color: #64748b; margin: 0; }
.trend-svg { width: 100%; height: 240px; }

/* ====================================================== Features */
.ap-feature-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 20px; flex: 1; align-content: start;
}
.ap-feature {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
  padding: 24px 24px; display: flex; flex-direction: column; gap: 8px;
  box-shadow: 0 8px 24px -16px rgba(15,23,42,.08);
  position: relative;
}
.ap-feature h4 { font-size: 19px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.3; }
.ap-feature p { font-size: 15px; color: #475569; line-height: 1.5; margin: 0; }
.ap-feature-on { border-left: 4px solid #16a34a; }
.ap-feature-fix { border-left: 4px solid #2563eb; }

/* ====================================================== Cobertura */
.ap-lede {
  font-size: 22px; color: #334155; line-height: 1.45; margin: 0 0 8px;
  max-width: 1300px;
}
.ap-cover-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; flex: 1; align-content: start; }
.ap-cover-card {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
  padding: 22px 24px; display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 8px 24px -16px rgba(15,23,42,.08);
}
.ap-cover-card h4 { font-size: 20px; font-weight: 700; margin: 0; }
.ap-cover-card p { font-size: 15px; color: #475569; line-height: 1.5; margin: 0; flex: 1; }
.ap-cover-tag {
  font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
  color: #475569; padding: 6px 10px; background: #f1f5f9; border-radius: 999px; align-self: flex-start;
}
.ap-cover-blue { border-top: 4px solid #2563eb; }
.ap-cover-green { border-top: 4px solid #16a34a; }
.ap-cover-cyan { border-top: 4px solid #0891b2; }
.ap-cover-purple { border-top: 4px solid #9333ea; }
.ap-cover-red { border-top: 4px solid #dc2626; }

/* ====================================================== Desafios */
.ap-challenge-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; flex: 1; align-content: start;
}
.ap-challenge {
  display: flex; gap: 18px; align-items: flex-start;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
  padding: 20px 22px; box-shadow: 0 8px 24px -16px rgba(15,23,42,.08);
}
.ap-num {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 32px; font-weight: 700;
  background: linear-gradient(135deg, #0054A6, #38bdf8);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  flex-shrink: 0; min-width: 48px;
}
.ap-challenge p { font-size: 16px; color: #334155; line-height: 1.55; margin: 0; }

/* ====================================================== Prioridade */
.ap-priority {
  background: linear-gradient(135deg, #0054A6 0%, #1e3a8a 50%, #2563eb 100%);
  color: #fff; border-radius: 22px; padding: 44px 52px;
  display: flex; flex-direction: column; gap: 18px;
  box-shadow: 0 28px 60px -30px rgba(37,99,235,.55);
  flex: 1;
}
.ap-priority-tag {
  align-self: flex-start; font-size: 13px; font-weight: 700;
  letter-spacing: .16em; text-transform: uppercase;
  padding: 7px 14px; background: rgba(255,255,255,.18); border-radius: 999px;
  border: 1px solid rgba(255,255,255,.25);
}
.ap-priority h3 {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 52px; font-weight: 700; margin: 0; line-height: 1.1;
}
.ap-priority p { font-size: 20px; line-height: 1.55; margin: 0; color: rgba(255,255,255,.92); max-width: 1500px; }
.ap-priority-pillars {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 14px;
}
.ap-priority-pillars > div {
  background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
  border-radius: 14px; padding: 18px 20px;
  display: flex; flex-direction: column; gap: 4px;
}
.ap-priority-pillars strong { font-size: 20px; font-weight: 700; }
.ap-priority-pillars span { font-size: 14px; color: rgba(255,255,255,.78); }
`;
