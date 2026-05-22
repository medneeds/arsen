import { useEffect, useMemo } from "react";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import socorraoCross from "@/assets/socorrao-cross-logo.png";

/**
 * Relatório de Implantação — Semana 1
 * Plataforma Arsen × HMDM Socorrão I
 * Rota pública: /relatorio-1
 * A4 paisagem, todos os slides com mesmo tamanho. Imprimir → Salvar como PDF.
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

// Série diária de ocupação (7 dias) — para o mini-gráfico de tendência
const tendenciaOcupacao = [
  { dia: "15/05", pct: 89 },
  { dia: "16/05", pct: 91 },
  { dia: "17/05", pct: 92 },
  { dia: "18/05", pct: 95 },
  { dia: "19/05", pct: 96 },
  { dia: "20/05", pct: 94 },
  { dia: "21/05", pct: 93 },
  { dia: "22/05", pct: Number(taxaOcup) },
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

// O que está EM IMPLANTAÇÃO ATIVA (entregue e em uso assistencial)
const ativos = [
  { titulo: "Mapa de Pacientes", desc: "Implantado em UTI 1, UTI 2, UCI 1, UCI 2, UCC e Enfermaria de Transição. 79 leitos em operação." },
  { titulo: "Painel Clínico", desc: "Prescrição estruturada, evolução SOAP, exames, cuidados e cockpit unificado nos 6 setores ativos." },
  { titulo: "Gestão executiva", desc: "Painel do Gestor com visão irrestrita dos setores ativos e 6 relatórios executivos plugáveis." },
  { titulo: "Alta, óbito e documentos", desc: "Sumários de alta, declaração de óbito, suspender alta com motivo+senha e ficha de atendimento consolidada em PDF." },
  { titulo: "Autenticação e perfis", desc: "Login por usuário/CPF/e-mail, reset por e-mail, ProfileChooser multi-perfil e aprovação de cadastros pelo gestor." },
  { titulo: "Impressão Norma Zero", desc: "Padrão A4 alinhado com o setor de Qualidade — prescrição, evolução, admissão, APAC, AIH, guia ATM e cultura." },
];

// O que a plataforma JÁ COBRE — pronto no produto, ainda não na fase de implantação assistencial
const coberturaProduto = [
  { titulo: "Recepção & Cadastro", desc: "Identificação NI, prontuário único auditável, busca por CPF/nome, triagem express e detecção de duplicatas.", c: "blue" },
  { titulo: "Farmácia Clínica", desc: "Validação farmacêutica, flag Alto Alerta, MAV/Portaria 344 com 3 categorias e catálogo HMDM 2026 (222 princípios, 322 apresentações).", c: "green" },
  { titulo: "Laboratório & Imagem", desc: "Setores dedicados, ciência médica obrigatória, gasometria com split de impressão e 4 modalidades de resultado.", c: "cyan" },
  { titulo: "NIR & Regulação", desc: "9 sub-módulos, 8 status de leito, fila de alocação com SLA ≤2h e monitoramento de gravíssimos.", c: "purple" },
  { titulo: "Urgência & Emergência", desc: "UE Vertical, UE Horizontal, Sala Vermelha, Sala Laranja, Observação Clínica e 7 presets de atendimento rápido.", c: "red" },
];

// Correções aplicadas — sem nome de paciente, agrupadas por tema
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

// Blindagens permanentes (princípios imutáveis — dados/movimentação/auditoria)
const blindagens = [
  { titulo: "Nenhum dado clínico é apagado", desc: "Toda baixa é arquivamento — o registro permanece auditável para sempre." },
  { titulo: "Edição sensível exige motivo + \"CONFIRMO\"", desc: "Data de admissão, prontuário, identidade e alta passam por confirmação tipada com trilha de auditoria." },
  { titulo: "RLS ativa em todas as tabelas", desc: "Cada perfil enxerga apenas o que lhe cabe — admin, gestor, médico, farmácia, enfermagem, recepção, NIR, qualidade." },
  { titulo: "Encounter_id por leito", desc: "Reuso de leito não vaza dados do ocupante anterior. Filtro defensivo em 6 hooks do cockpit (Fase B.3)." },
  { titulo: "Movimentação rastreada ponta a ponta", desc: "Entrada, transferência e saída registradas em tabela única com motivo, autor, timestamp e contexto clínico." },
  { titulo: "Camadas separadas no desenvolvimento", desc: "Dados, Movimentação e Auditoria nunca são tocados sem confirmação explícita. Layout permanece em otimização contínua." },
];

const desafios = [
  "Tempo de carga em máquinas mais fracas — depende de hardware das estações, fora do nosso controle direto.",
  "Adesão completa do plantonista ao fluxo da plataforma — SOAP é obrigatório apenas na evolução de rotina; as demais aceitam versão encurtada.",
  "Padronização no preenchimento de peso, alergias e prescrição — médicos relatam baixa intuitividade no fluxo atual.",
  "Adesão ao SAPS 3 na admissão de UTI/UCI 2 — escalada crítica precisa ser concluída logo após a alocação.",
  "Treinamento contínuo de todos os usuários — equipe técnica em plantão 24×7 durante os últimos 7 dias dando retaguarda.",
  "Sincronização dos dados do PIS com o registro do paciente — desafio encontrado e já solucionado com a importação assistida por IA.",
  "Comunicação clara das mudanças semanais para a equipe assistencial — release notes e treinamentos curtos.",
];

const prioridades = [
  {
    titulo: "Otimização do ato de prescrever",
    desc: "Prescrição intuitiva, rápida, sem travas e com o menor número de cliques possível. Inclui: melhoria do builder por dispositivo (oral, EV, enteral, inalatório), preenchimento facilitado de datas e doses, fluxo de assinatura e validação, salvamento de rascunho — recurso que muitas plataformas no país não oferecem. Esta é a única prioridade para a Semana 2.",
  },
];

function Slide({ children, kicker, title, n, total }: { children: React.ReactNode; kicker?: string; title?: string; n: number; total: number }) {
  return (
    <section className="slide">
      <header className="slide-header">
        <div className="brand">
          <span className="brand-arsen-wordmark">Arsen</span>
          <span className="brand-divider" />
          <img src={socorraoCross} alt="Socorrão I" className="brand-socorrao" />
          <span className="brand-sub">Relatório de Implantação · Semana 1</span>
        </div>
        <div className="page">Slide {n} / {total}</div>
      </header>
      {(kicker || title) && (
        <div className="slide-title-block">
          {kicker && <div className="kicker">{kicker}</div>}
          {title && <h2 className="title">{title}</h2>}
        </div>
      )}
      <div className="slide-body">{children}</div>
      <footer className="slide-footer">
        <span>HMDM · Socorrão I · {PERIODO}</span>
        <span>{VERSAO}</span>
      </footer>
    </section>
  );
}

function TrendChart() {
  const w = 880;
  const h = 180;
  const padX = 36;
  const padY = 22;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const max = 100;
  const min = 80;
  const points = tendenciaOcupacao.map((d, i) => {
    const x = padX + (i / (tendenciaOcupacao.length - 1)) * innerW;
    const y = padY + innerH - ((d.pct - min) / (max - min)) * innerH;
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${path} L${points[points.length - 1].x},${padY + innerH} L${points[0].x},${padY + innerH} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trend-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      {[80, 85, 90, 95, 100].map((v) => {
        const y = padY + innerH - ((v - min) / (max - min)) * innerH;
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#e2e8f0" strokeDasharray="2 4" />
            <text x={padX - 6} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">{v}%</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#trendFill)" />
      <path d={path} fill="none" stroke="url(#trendLine)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => (
        <g key={p.dia}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#2563eb" strokeWidth="2" />
          <text x={p.x} y={h - 6} fontSize="9" fill="#64748b" textAnchor="middle">{p.dia}</text>
          <text x={p.x} y={p.y - 8} fontSize="9" fill="#2563eb" fontWeight="700" textAnchor="middle">{p.pct}%</text>
        </g>
      ))}
    </svg>
  );
}

export default function Relatorio1Page() {
  useEffect(() => {
    document.title = "Relatório de Implantação — Semana 1 | Arsen × Socorrão I";
  }, []);

  const slides = useMemo(() => {
    const list: Array<{ render: (n: number, total: number) => JSX.Element }> = [];

    // 1 — CAPA
    list.push({
      render: (n, total) => (
        <section className="slide slide-cover" key="cover">
          <div className="cover-bg" />
          <div className="nz-cross-bar" aria-hidden="true">
            <span style={{ background: "#E31E24" }} />
            <span style={{ background: "#F47920" }} />
            <span style={{ background: "#FFC20E" }} />
            <span style={{ background: "#00A651" }} />
            <span style={{ background: "#0054A6" }} />
          </div>
          <header className="nz-cover-header">
            <img src={socorraoCross} alt="HMDM Socorrão I" className="nz-cover-logo" />
            <div className="nz-cover-institution">
              <span>PREFEITURA DE SÃO LUÍS</span>
              <span>SECRETARIA MUNICIPAL DE SAÚDE</span>
              <span>HOSPITAL MUNICIPAL DJALMA MARQUES — SOCORRÃO I</span>
            </div>
            <div className="nz-cover-spacer" />
          </header>
          <div className="cover-content">
            <span className="cover-wordmark cover-wordmark-hero">Arsen</span>
            <div className="kicker light">Plataforma Clínica Inteligente · Em parceria com o HMDM Socorrão I</div>
            <h1 className="cover-title">Relatório de Implantação<br /><span>Semana 1 · Trabalhando em conjunto</span></h1>
            <p className="cover-sub">{PERIODO}</p>
            <div className="cover-meta">
              <div><span>Versão</span><strong>{VERSAO}</strong></div>
              <div><span>Setores ativos</span><strong>UTI 1 · UTI 2 · UCI 1 · UCI 2 · UCC · Enf. Transição</strong></div>
              <div><span>Leitos em operação</span><strong>{totalOcup} pacientes acompanhados · {totalCap} leitos gerenciados</strong></div>
            </div>
          </div>
          <footer className="slide-footer cover-footer">
            <span>Confidencial · uso institucional · MAN.05-001</span>
            <span>Slide {n} / {total}</span>
          </footer>
        </section>
      ),
    });

    // 2 — SUMÁRIO EXECUTIVO
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="01 · Visão geral" title="Sumário executivo da semana">
          <div className="grid grid-exec">
            <div className="card">
              <h3>O que foi entregue de fato</h3>
              <ul>
                <li><strong>Mapa de Pacientes + Painel Clínico</strong> em produção assistencial em <strong>6 setores</strong>: UTI 1, UTI 2, UCI 1, UCI 2, UCC e Enfermaria de Transição.</li>
                <li><strong>Centenas de correções e ajustes finos</strong> aplicados ao longo dos 7 dias, com auditoria preservando todo o dado clínico.</li>
                <li><strong>{totalOcup} pacientes</strong> sob acompanhamento ativo nos setores em implantação.</li>
                <li><strong>{atividade[7].valor.toLocaleString("pt-BR")}</strong> eventos auditados (audit_logs) em 7 dias — uso real e contínuo da plataforma.</li>
                <li className="muted-line"><em>Predisposição em produto (ainda fora da implantação assistencial):</em> NIR, Farmácia, Urgência, Emergência, Laboratório, Imagem, Gestão.</li>
              </ul>
            </div>
            <div className="card accent kpi-card">
              <h3>Indicadores-chave</h3>
              <div className="kpis kpis-exec">
                <div className="kpi"><span>{taxaOcup}%</span><small>Taxa de ocupação dos setores ativos</small></div>
                <div className="kpi"><span>{atividade[0].valor}</span><small>Prescrições emitidas</small></div>
                <div className="kpi"><span>{atividade[1].valor}</span><small>Evoluções clínicas</small></div>
                <div className="kpi"><span>{atividade[6].valor}</span><small>Médicos e usuários ativos</small></div>
              </div>
            </div>
          </div>
        </Slide>
      ),
    });

    // 3 — OCUPAÇÃO POR SETOR + TENDÊNCIA
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="02 · Censo" title="Ocupação de leitos por setor">
          <div className="ocup-grid">
            <div className="bed-table">
              <div className="bed-row bed-head">
                <span>Setor</span><span>Cap.</span><span>Ocup.</span><span>Vagos</span><span>%</span><span>Barra</span>
              </div>
              {ocupacao.map((s) => {
                const pct = (s.ocupados / s.capacidade) * 100;
                return (
                  <div className="bed-row" key={s.setor}>
                    <span><strong>{s.setor}</strong></span>
                    <span>{s.capacidade}</span>
                    <span>{s.ocupados}</span>
                    <span>{s.capacidade - s.ocupados}</span>
                    <span>{pct.toFixed(0)}%</span>
                    <span className="bar"><span className="bar-fill" style={{ width: `${pct}%` }} /></span>
                  </div>
                );
              })}
              <div className="bed-row bed-total">
                <span><strong>TOTAL</strong></span>
                <span>{totalCap}</span>
                <span>{totalOcup}</span>
                <span>{totalCap - totalOcup}</span>
                <span>{taxaOcup}%</span>
                <span className="bar"><span className="bar-fill" style={{ width: `${taxaOcup}%` }} /></span>
              </div>
            </div>
            <div className="trend-card">
              <p className="trend-title">Taxa de ocupação · evolução diária</p>
              <TrendChart />
              <p className="trend-foot">Setores em implantação assistencial — UTI 1/2, UCI 1/2, UCC e Enf. Transição.</p>
            </div>
          </div>
          <p className="note">Setores com cadeado (sem implantação ativa): Neuro 01/02, Clínica Cirúrgica, Enf. Vascular, RIV, Centro Cirúrgico e toda a Urgência & Emergência.</p>
        </Slide>
      ),
    });

    // 4 — VOLUME OPERACIONAL
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="03 · Atividade" title="Volume operacional nos 7 dias">
          <div className="grid grid-4">
            {atividade.map((a) => (
              <div className="stat" key={a.label}>
                <strong>{a.valor.toLocaleString("pt-BR")}</strong>
                <small>{a.label}</small>
              </div>
            ))}
          </div>
          <p className="note">Pico operacional em 18/05 (segunda-feira) com 3.638 eventos auditados — convergência entre admissões pós-fim-de-semana e revisão de prescrições. Todos os números acima estão auditáveis em audit_logs.</p>
        </Slide>
      ),
    });

    // 5 — EM IMPLANTAÇÃO ATIVA
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="04 · Em implantação ativa" title="O que a plataforma já entrega no Socorrão I">
          <div className="feature-list">
            {ativos.map((f) => (
              <div className="feature on" key={f.titulo}>
                <h4>{f.titulo}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
          <p className="note">Padrão de impressão Norma Zero alinhado com o setor de Qualidade da unidade.</p>
        </Slide>
      ),
    });

    // 6 — COBERTURA DE PRODUTO (argumento comercial)
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="05 · Cobertura de produto" title="A plataforma já cobre — pronta para expandir">
          <p className="lede">Estes módulos já estão <strong>prontos no produto</strong>, mas ainda não fazem parte da fase atual de implantação assistencial. São diferenciais que ampliam o escopo do contrato a qualquer momento.</p>
          <div className="cover-grid">
            {coberturaProduto.map((c) => (
              <div key={c.titulo} className={`cover-card cover-${c.c}`}>
                <h4>{c.titulo}</h4>
                <p>{c.desc}</p>
                <span className="cover-tag">Disponível · fora da implantação atual</span>
              </div>
            ))}
          </div>
        </Slide>
      ),
    });

    // 7-9 — CORREÇÕES APLICADAS (3 slides de 5/5/4)
    const corrChunks = [correcoes.slice(0, 5), correcoes.slice(5, 10), correcoes.slice(10)];
    corrChunks.forEach((chunk, idx) => {
      list.push({
        render: (n, total) => (
          <Slide
            n={n}
            total={total}
            kicker={`06.${idx + 1} · Correções e ajustes`}
            title={idx === 0 ? "Principais correções aplicadas" : "Principais correções aplicadas (cont.)"}
          >
            <div className="feature-list">
              {chunk.map((f) => (
                <div className="feature fix" key={f.tema}>
                  <h4>{f.tema}</h4>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
            {idx === 0 && (
              <p className="note">Trabalhamos turno a turno, com suporte técnico de plantão 24×7, para dar retaguarda a médicos, farmácia, enfermagem e NIR durante a Semana 1.</p>
            )}
          </Slide>
        ),
      });
    });

    // 10 — PRINCÍPIOS IMUTÁVEIS
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="07 · Governança" title="Princípios imutáveis da plataforma">
          <div className="grid grid-2">
            <div className="card">
              <h3>3 camadas blindadas</h3>
              <ul>
                <li><strong>Dados</strong> — leitura/escrita em tabelas e RPCs.</li>
                <li><strong>Movimentação</strong> — fluxo de paciente entre leitos e setores.</li>
                <li><strong>Auditoria</strong> — logs imutáveis e histórico clínico longitudinal.</li>
              </ul>
              <p className="muted">Pedido em uma camada nunca toca a outra sem confirmação explícita. Layout permanece em otimização contínua — não é blindado, é evolutivo.</p>
            </div>
            <div className="card">
              <h3>Blindagens permanentes</h3>
              <ul>
                {blindagens.slice(0, 4).map((b) => (
                  <li key={b.titulo}><strong>{b.titulo}.</strong> {b.desc}</li>
                ))}
              </ul>
            </div>
          </div>
        </Slide>
      ),
    });

    // 11 — DESAFIOS
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="08 · Desafios" title="Desafios identificados na operação">
          <div className="challenge-list">
            {desafios.map((d, i) => (
              <div className="challenge" key={i}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </Slide>
      ),
    });

    // 12 — PRIORIDADE (única)
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="09 · Próximos passos" title="Prioridade única para a Semana 2">
          <div className="priority-card">
            <div className="priority-tag">Prioridade #1 · única</div>
            <h3>{prioridades[0].titulo}</h3>
            <p>{prioridades[0].desc}</p>
            <div className="priority-pillars">
              <div><strong>Intuitivo</strong><span>menor curva de aprendizado</span></div>
              <div><strong>Rápido</strong><span>menor número de cliques</span></div>
              <div><strong>Sem travas</strong><span>fluxo contínuo até a assinatura</span></div>
              <div><strong>Rascunho seguro</strong><span>nada se perde no caminho</span></div>
            </div>
          </div>
          <p className="note">Dashboard de gestão, liberação gradual dos setores bloqueados, relatórios PDF agendados, integração de exames, treinamento formal por perfil, app de bolso e auditoria de qualidade clínica seguem no roadmap — não são prioridade para esta semana.</p>
        </Slide>
      ),
    });

    // 13 — ENCERRAMENTO
    list.push({
      render: (n, total) => (
        <section className="slide slide-cover end" key="end">
          <div className="cover-bg end-bg" />
          <div className="nz-cross-bar" aria-hidden="true">
            <span style={{ background: "#E31E24" }} />
            <span style={{ background: "#F47920" }} />
            <span style={{ background: "#FFC20E" }} />
            <span style={{ background: "#00A651" }} />
            <span style={{ background: "#0054A6" }} />
          </div>
          <header className="nz-cover-header">
            <img src={socorraoCross} alt="HMDM Socorrão I" className="nz-cover-logo" />
            <div className="nz-cover-institution">
              <span>PREFEITURA DE SÃO LUÍS</span>
              <span>SECRETARIA MUNICIPAL DE SAÚDE</span>
              <span>HOSPITAL MUNICIPAL DJALMA MARQUES — SOCORRÃO I</span>
            </div>
            <div className="nz-cover-spacer" />
          </header>
          <div className="cover-content">
            <span className="cover-wordmark cover-wordmark-hero">Arsen</span>
            <div className="kicker light">Encerramento · Semana 1</div>
            <h1 className="cover-title">Obrigado.<br /><span>Seguimos para a Semana 2 com base sólida.</span></h1>
            <p className="cover-sub">
              {totalOcup} pacientes acompanhados · {(atividade[0].valor + atividade[1].valor).toLocaleString("pt-BR")} documentos clínicos emitidos · centenas de correções aplicadas sem perda de dado.
            </p>
            <div className="cover-meta">
              <div><span>Plataforma</span><strong>Arsen</strong></div>
              <div><span>Unidade</span><strong>HMDM · Socorrão I</strong></div>
              <div><span>Relatório</span><strong>arsen.com.br/relatorio-1</strong></div>
            </div>
          </div>
          <footer className="slide-footer cover-footer">
            <span>Confidencial · uso institucional · MAN.05-001</span>
            <span>Slide {n} / {total}</span>
          </footer>
        </section>
      ),
    });

    return list;
  }, []);

  const total = slides.length;

  return (
    <div className="report-root">
      <style>{styles}</style>

      <div className="report-toolbar no-print">
        <Link to="/" className="back">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="t-title">Relatório de Implantação · Semana 1 · Arsen × Socorrão I</div>
        <div className="t-actions">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer size={16} className="mr-2" /> Imprimir
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Download size={16} className="mr-2" /> Salvar como PDF
          </Button>
        </div>
      </div>

      <div className="deck">
        {slides.map((s, i) => (
          <div key={i}>{s.render(i + 1, total)}</div>
        ))}
      </div>
    </div>
  );
}

const styles = `
.report-root {
  --bg: #0f172a;
  --bg-soft: #111c33;
  --ink: #0b1220;
  --ink-soft: #1f2937;
  --muted: #64748b;
  --line: #e2e8f0;
  --paper: #ffffff;
  --accent: #2563eb;
  --accent-2: #0ea5e9;
  --accent-soft: #eff6ff;
  --ok: #16a34a;
  --warn: #d97706;
  --bad: #dc2626;
  background: #e2e8f0;
  min-height: 100vh;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: var(--ink);
}
.report-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 12px 20px;
  background: rgba(255,255,255,.95); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}
.report-toolbar .back { display:inline-flex; align-items:center; gap:6px; color:var(--ink-soft); font-size:13px; text-decoration:none; }
.report-toolbar .t-title { font-weight: 600; font-size: 14px; color: var(--ink-soft); }
.report-toolbar .t-actions { display: flex; gap: 8px; }

.deck { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px 12px 60px; }

/* Todos os slides com mesmo tamanho — A4 paisagem */
.slide {
  width: min(1280px, 100%);
  aspect-ratio: 297 / 210;
  background: var(--paper);
  color: var(--ink);
  border-radius: 12px;
  box-shadow: 0 12px 40px -16px rgba(15,23,42,.35), 0 2px 6px rgba(15,23,42,.08);
  padding: 32px 44px 22px;
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
}
.slide-header { display:flex; align-items:center; justify-content:space-between; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.slide-header .brand { display:flex; align-items:center; gap:10px; font-size: 12px; }
.brand-arsen-wordmark {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 500;
  font-size: 20px;
  letter-spacing: 0.02em;
  color: var(--ink);
  line-height: 1;
}
.brand-socorrao { height: 22px; width: auto; object-fit: contain; }
.brand-divider { width: 1px; height: 18px; background: var(--line); }
.brand-sub { color: var(--muted); font-weight: 500; letter-spacing: .04em; margin-left: 4px; }
.slide-header .page { font-size: 11px; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
.slide-title-block { padding: 14px 0 10px; }
.slide-title-block .kicker { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
.slide-title-block .title { font-size: 28px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 700; color: var(--ink); margin: 4px 0 0; font-family: 'Georgia', serif; }
.slide-body { flex: 1; min-height: 0; padding-top: 4px; display: flex; flex-direction: column; gap: 10px; }
.slide-footer { display:flex; justify-content:space-between; border-top:1px solid var(--line); padding-top:8px; font-size:10px; color: var(--muted); letter-spacing: .04em; }

/* Cover (fundo branco, mesma identidade dos slides internos) */
/* Cover & End — branco seco + identidade Norma Zero */
.slide-cover { padding: 0; background: #ffffff; }
.cover-bg { position:absolute; inset:0; background: #ffffff; }
.end-bg { background: #ffffff; }

/* Barra cruz institucional (5 cores Socorrão) — topo absoluto */
.nz-cross-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 6px;
  display: grid; grid-template-columns: repeat(5, 1fr); z-index: 2;
}
.nz-cross-bar > span { display: block; height: 100%; }

/* Cabeçalho Norma Zero (cruz símbolo + texto institucional centralizado) */
.nz-cover-header {
  position: absolute; top: 6px; left: 0; right: 0; z-index: 2;
  display: grid; grid-template-columns: 88px 1fr 88px;
  align-items: center; gap: 16px;
  padding: 18px 44px 14px;
  border-bottom: 1px solid var(--line);
  background: #ffffff;
}
.nz-cover-logo { height: 62px; width: 62px; object-fit: contain; }
.nz-cover-institution { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
.nz-cover-institution span:nth-child(1) { font-size: 10px; letter-spacing: .22em; color: var(--muted); font-weight: 600; }
.nz-cover-institution span:nth-child(2) { font-size: 11px; letter-spacing: .18em; color: var(--ink-soft); font-weight: 600; }
.nz-cover-institution span:nth-child(3) { font-size: 13px; letter-spacing: .04em; color: var(--ink); font-weight: 700; margin-top: 2px; }
.nz-cover-spacer { width: 88px; }

.cover-content {
  position: relative; z-index: 1; color: var(--ink);
  padding: 130px 56px 70px;
  height: 100%;
  display: flex; flex-direction: column; justify-content: flex-start;
}

/* Wordmark hero — Arsen grande, no topo, com degradê azul brilhante */
.cover-wordmark-hero {
  display: block;
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 600;
  font-size: 168px;
  line-height: 0.95;
  letter-spacing: -0.02em;
  margin: 4px 0 18px;
  background: linear-gradient(135deg, #0054A6 0%, #1e3a8a 30%, #2563eb 55%, #38bdf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  filter: drop-shadow(0 4px 18px rgba(37, 99, 235, 0.18));
}

.kicker.light { color: var(--accent); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; font-weight: 600; }
.cover-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 600;
  font-size: 44px;
  line-height: 1.05;
  letter-spacing: -0.015em;
  margin: 10px 0 14px;
  color: var(--ink);
}
.cover-title span {
  font-family: 'Playfair Display', Georgia, serif;
  color: var(--accent);
  font-weight: 300;
  font-style: italic;
  font-size: 26px;
  display: inline-block;
  margin-top: 8px;
  letter-spacing: 0;
}
.cover-sub { font-size: 13px; color: var(--ink-soft); margin: 0 0 22px; }
.cover-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 920px; }
.cover-meta > div {
  background: linear-gradient(135deg, #0f1f44, #1e3a8a);
  border: 1px solid rgba(255,255,255,.08);
  padding: 14px 16px;
  border-radius: 10px;
  box-shadow: 0 10px 24px -14px rgba(15,23,42,.45);
}
.cover-meta span { display:block; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #93c5fd; font-weight: 600; }
.cover-meta strong { display:block; margin-top:6px; font-size: 13px; color: #f8fafc; font-weight: 600; line-height: 1.3; }
.cover-footer { position:absolute; bottom: 0; left:0; right:0; padding: 14px 44px; color: var(--muted); border-top:1px solid var(--line); background: #ffffff; }

/* Grids */
.grid { display: grid; gap: 14px; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

.card { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }
.card h3 { font-family: 'Georgia', serif; font-size: 17px; margin: 0 0 10px; color: var(--ink); }
.card ul { margin: 0; padding-left: 18px; }
.card li { font-size: 12.5px; line-height: 1.5; margin-bottom: 6px; color: var(--ink-soft); }
.card li.muted-line { color: var(--muted); border-top: 1px dashed var(--line); padding-top: 8px; margin-top: 10px; list-style: none; margin-left: -18px; }
.card.accent { background: linear-gradient(135deg, var(--accent-soft), #f0f9ff); border-color: #bfdbfe; }
.kpis { display:grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-top:8px; }
.kpi { background: white; border-radius: 8px; padding: 12px; border: 1px solid #dbeafe; }
.kpi span { display:block; font-family: 'Georgia', serif; font-size: 28px; font-weight: 700; color: var(--accent); line-height: 1; }
.kpi small { display:block; margin-top:4px; font-size: 10.5px; color: var(--muted); }

.stat { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
.stat strong { display:block; font-family: 'Georgia', serif; font-size: 26px; color: var(--accent); line-height: 1; }
.stat small { display:block; margin-top: 6px; font-size: 11px; color: var(--muted); line-height: 1.3; }

/* Ocupação grid (tabela + gráfico de tendência) */
.ocup-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; align-items: stretch; }
.bed-table { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #fff; }
.bed-row { display: grid; grid-template-columns: 2fr .7fr .7fr .7fr .7fr 1.8fr; gap: 8px; padding: 9px 14px; align-items: center; font-size: 12.5px; border-bottom: 1px solid var(--line); }
.bed-row:last-child { border-bottom: 0; }
.bed-head { background: #f1f5f9; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.bed-total { background: #eff6ff; font-weight: 600; }
.bar { background: #e2e8f0; height: 9px; border-radius: 6px; overflow: hidden; }
.bar-fill { display:block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }

.trend-card { background: linear-gradient(135deg, #ffffff, #f8fafc); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; }
.trend-title { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 0 0 8px; }
.trend-svg { width: 100%; height: auto; flex: 1; min-height: 0; }
.trend-foot { font-size: 10px; color: var(--muted); margin: 6px 0 0; }

.note { margin-top: 8px; font-size: 11px; color: var(--muted); line-height: 1.5; border-left: 3px solid var(--accent); padding-left: 10px; }
.lede { font-size: 13px; color: var(--ink-soft); line-height: 1.5; margin: 0 0 6px; }
.lede strong { color: var(--ink); }

/* Features */
.feature-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.feature { background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; padding: 10px 13px; border-left: 3px solid var(--accent); }
.feature h4 { font-size: 13px; margin: 0 0 4px; color: var(--ink); font-weight: 700; }
.feature p { font-size: 11.5px; margin: 0; color: var(--ink-soft); line-height: 1.45; }
.feature.fix { border-left-color: var(--warn); }
.feature.on { border-left-color: var(--ok); background: #f0fdf4; }

/* Cobertura cards (visual comercial) */
.cover-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.cover-card { position: relative; border-radius: 12px; padding: 16px 16px 36px; color: #fff; min-height: 132px; overflow: hidden; box-shadow: 0 8px 20px -10px rgba(15,23,42,.3); }
.cover-card h4 { font-size: 15px; margin: 0 0 6px; font-weight: 800; letter-spacing: -.01em; }
.cover-card p { font-size: 11.5px; margin: 0; line-height: 1.45; opacity: .95; }
.cover-card .cover-tag { position: absolute; left: 16px; bottom: 12px; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; background: rgba(255,255,255,.18); padding: 4px 8px; border-radius: 999px; }
.cover-blue   { background: linear-gradient(135deg, #1d4ed8, #3b82f6); }
.cover-green  { background: linear-gradient(135deg, #047857, #10b981); }
.cover-cyan   { background: linear-gradient(135deg, #0e7490, #06b6d4); }
.cover-purple { background: linear-gradient(135deg, #6d28d9, #8b5cf6); }
.cover-red    { background: linear-gradient(135deg, #b91c1c, #ef4444); }

/* Challenges */
.challenge-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.challenge { display: flex; gap: 12px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 13px; align-items: flex-start; }
.challenge .num { font-family: 'Georgia', serif; font-size: 18px; color: var(--warn); font-weight: 700; line-height: 1; }
.challenge p { font-size: 12px; margin: 0; color: #78350f; line-height: 1.45; }

/* Prioridade única */
.priority-card { position: relative; background: linear-gradient(135deg, #0f1f44, #1e3a8a); color: #fff; border-radius: 14px; padding: 28px 32px; box-shadow: 0 12px 30px -14px rgba(15,23,42,.5); }
.priority-tag { display: inline-block; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; background: rgba(255,255,255,.14); padding: 6px 12px; border-radius: 999px; font-weight: 700; }
.priority-card h3 { font-family: 'Georgia', serif; font-size: 30px; margin: 14px 0 10px; letter-spacing: -.02em; }
.priority-card > p { font-size: 13px; line-height: 1.55; color: #dbeafe; margin: 0 0 18px; max-width: 920px; }
.priority-pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.priority-pillars > div { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); border-radius: 10px; padding: 12px; }
.priority-pillars strong { display: block; font-size: 14px; color: #fff; }
.priority-pillars span { display: block; margin-top: 4px; font-size: 11px; color: #93c5fd; letter-spacing: .03em; }

.muted { color: var(--muted); font-size: 11.5px; margin-top: 6px; }

@media print {
  @page { size: A4 landscape; margin: 0; }
  body { background: #fff !important; }
  .report-root { background: #fff; }
  .no-print { display: none !important; }
  .deck { gap: 0; padding: 0; }
  .slide { box-shadow: none; border-radius: 0; width: 100%; max-width: none; aspect-ratio: auto; height: 100vh; page-break-after: always; break-after: page; padding: 26px 34px 20px; }
  .slide:last-child { page-break-after: auto; }
  .cover-content { padding: 48px 44px; }
  .cover-title { font-size: 44px; }
  .cover-title span { font-size: 28px; }
}
`;
