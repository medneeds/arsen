import { useEffect, useMemo } from "react";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

/**
 * Relatório de Implantação — Semana 1
 * Rota pública: /relatorio-1
 * Pensado para revisão em tela e exportação em PDF (Imprimir → Salvar como PDF, A4 paisagem).
 */

const PERIODO = "15/05/2026 — 22/05/2026 (7 dias)";
const VERSAO = "v1.0 · gerado em 22/05/2026";

const ocupacao = [
  { setor: "UTI 1", codigo: "red", capacidade: 8, ocupados: 8 },
  { setor: "UTI 2", codigo: "yellow", capacidade: 10, ocupados: 10 },
  { setor: "UCI 1", codigo: "blue", capacidade: 6, ocupados: 6 },
  { setor: "UCI 2", codigo: "outside", capacidade: 8, ocupados: 8 },
  { setor: "UCC", codigo: "ucc", capacidade: 37, ocupados: 34 },
  { setor: "Enfermaria de Transição", codigo: "enfermaria_transicao", capacidade: 10, ocupados: 9 },
];

const totalCap = ocupacao.reduce((s, x) => s + x.capacidade, 0);
const totalOcup = ocupacao.reduce((s, x) => s + x.ocupados, 0);
const taxaOcup = ((totalOcup / totalCap) * 100).toFixed(1);

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

const funcionalidades = [
  { titulo: "Prescrição eletrônica completa", desc: "Catálogo HMDM 2026 (222 princípios, 322 apresentações). Cálculo bidirecional fluxo↔tempo. Validação por classe (sólido oral, EV, enteral, inalatório). Insulinoterapia assistida. Anti-microbianos com Guia ATM integrado. Bolus EV. Comprimido triturável bloqueado em via enteral (ISMP-Brasil)." },
  { titulo: "Cockpit clínico unificado", desc: "Sheet+Tabs com Resumo, Prescrição, Evolução, Exames, Documentos, Round e Sinais Vitais. Realtime em 6 hooks com blindagem por encounter_id (Fase B.3) — sem vazamento de dados de ocupante anterior do leito." },
  { titulo: "Evolução clínica SOAP + rich text", desc: "Editor com B/I/U aplicado em Evolução, Plano, Exames Complementares e Intercorrência. Sanitização DOMPurify. Painel de diagnósticos inline com sincronização de CID-10." },
  { titulo: "Movimentação de pacientes (fluxo unificado)", desc: "3 categorias (Entrada/Transferência/Saída) com 9 subtipos. Transferência interna preserva mesmo nº de atendimento. Escalada crítica UTI/UCI 2 dispara SAPS 3 pendente automático." },
  { titulo: "Prontuário longitudinal", desc: "View patient_timeline + auditoria em 15 tabelas. Página /historico-paciente. Numeração de prontuário AA-UUU-SSSSSS-DV com módulo 11. Trigger autolink corrigindo registros órfãos legados." },
  { titulo: "Recepção e cadastro de pacientes", desc: "Cadastro auditável (CAIXA ALTA, CPF único, NI-AAAA-NNNNNN). Triagem Express com pré-identificação. Painel diário com 4 KPIs, atendimentos do dia, aguardando admissão e detecção de duplicatas." },
  { titulo: "NIR / Regulação", desc: "9 sub-módulos, 8 status de leito, fila de alocação com SLA ≤2h, monitoramento gravíssimos." },
  { titulo: "Farmácia clínica", desc: "Perfil dedicado emerald. Validação farmacêutica Fase 11, flag Alto Alerta, MAV/Portaria 344 com 3 categorias. Vista compacta de board para validação." },
  { titulo: "Urgência & Emergência", desc: "UE Vertical, UE Horizontal, Sala Vermelha, Sala Laranja, Observação Clínica. 7 presets de atendimento rápido. Autonomia médica para puxar paciente da fila de triagem." },
  { titulo: "Laboratório e Imagem", desc: "Setores dedicados com filtros, Ciência obrigatória, gasometria com prompt de split de impressão, 4 modalidades de resultado (imagem/lab/texto/PDF)." },
  { titulo: "Gestão executiva", desc: "Painel do Gestor (visão irrestrita), 6 relatórios executivos plugáveis (ocupação, LOS, alta/óbito, produção médica, fila NIR, SLA triagem)." },
  { titulo: "Autenticação e perfis", desc: "11 perfis de acesso, login por usuário/CPF/email, reset por e-mail, ProfileChooser multi-perfil, pré-cadastro público com aprovação." },
  { titulo: "Alta, óbito e documentos", desc: "Sumários de alta, declaração de óbito, protocolo ME. Suspender alta com motivo+senha (sem perder o documento). Ficha de atendimento consolidada em PDF." },
  { titulo: "Impressão norma-zero", desc: "Layouts A4 via React Portal. Prescrição, evolução, admissão, APAC, AIH, guia ATM e cultura com cabeçalho unificado e padrão Medneeds." },
];

const correcoes = [
  { titulo: "Conflito de admissão L16 (Cláudio dos Santos)", desc: "patient_id reusado mostrava admissão antiga de outro paciente. Repointing cirúrgico via patient_registry_id + AdmissionConsultDialog passou a buscar a admissão mais recente." },
  { titulo: "Fenitoína VO comprimido validando indevidamente", desc: "Validação exigia campo dose mesmo com quantity preenchido. Agora sólido oral por VO/SL/enteral aceita quantity (ex.: '1 comprimido') como satisfação do dose." },
  { titulo: "Volumes divergentes na impressão de prescrição", desc: "Dois bugs corrigidos em itens IV — sincronização de volumeTotal↔diluentVolume e o branch de impressão alinhado à tela compacta." },
  { titulo: "Vazamento de dados entre ocupantes de um mesmo leito", desc: "Phase B.3: encounter_id em vital_signs, round_sessions e discharge_documents, + filtro defensivo em 6 hooks do cockpit." },
  { titulo: "Evolução sumindo após reuso de leito", desc: "Hook useActiveEncounterId passou a resolver por patient_registry_id (prioritário) com fallback ao patient_id." },
  { titulo: "Identidade do paciente desatualizada na impressão", desc: "Helper resolvePatientHeader + usePatientIdentifiers com guarda anti-NI. Remoção de mocks em Prescrição/Evolução. PrescricaoPage limpa birthDate, sex, motherName, address e city ao trocar paciente." },
  { titulo: "Trigger de autolink em pacientes legados", desc: "BEFORE INSERT/UPDATE em patients auto-vincula patient_registry_id e medical_record via pre_admissions (leito+unidade) ou CPF — sanou pacientes órfãos antigos." },
  { titulo: "Rascunhos de prescrição órfãos", desc: "Arquivamento via pg_cron a cada 30 min (>24 h, sem validação, sem assinatura, fora do dia clínico) para prescriptions_archive." },
  { titulo: "Sincronização PIS × Registro do paciente", desc: "Diff via PisRegistrySyncDialog disparado ao puxar paciente; banner âmbar persistente em Edição Avançada com motivo obrigatório e auditoria." },
  { titulo: "Peso e alergias obrigatórios na prescrição", desc: "Banner âmbar bloqueia assinar/validar/imprimir até preenchimento — sync bidirecional realtime com patients." },
  { titulo: "Edição de data de admissão e nº de prontuário auditadas", desc: "Tabelas imutáveis patient_admission_date_history e medical_record_edit_history. Motivo obrigatório, confirmação tipada." },
  { titulo: "Cadeado em setores sem implantação", desc: "UE, Anexo Vascular, CC, Neuro e Clínica Cirúrgica bloqueados com cleanup automático de sinalizações em 24 h (preservando prontuário)." },
];

const desafios = [
  "Tempo de carga em máquinas mais fracas (setores com hardware antigo).",
  "Adesão completa dos plantonistas ao fluxo de evolução SOAP em vez de texto livre.",
  "Padronização do preenchimento de peso e alergias em 100% das prescrições críticas.",
  "Reduzir cadastros NI (não-identificado) com pré-identificação Triagem Express.",
  "Aderência ao SLA de SAPS 3 nas transferências críticas para UTI/UCI 2.",
  "Sincronização de dados PIS legados com patient_registry sem retrabalho operacional.",
  "Treinamento contínuo dos 11 perfis de acesso (sobretudo farmácia clínica e NIR).",
  "Comunicação clara das mudanças semanais para a equipe assistencial.",
];

const proximaSemana = [
  { titulo: "Dashboard de gestão em tempo real", desc: "Ocupação, taxa de giro, LOS por setor e SLA de regulação consolidados em painel único para a direção." },
  { titulo: "Liberação gradual dos setores bloqueados", desc: "Iniciar implantação assistida de Neuro 01 e Clínica Cirúrgica conforme demanda da unidade." },
  { titulo: "Otimização de prescrição em hardware antigo", desc: "Profiling de PrescricaoPage e split de bundles pesados (insulinoterapia, MAV, ATM)." },
  { titulo: "Relatórios PDF agendados", desc: "Geração e envio automático dos 6 relatórios executivos por e-mail no fechamento do dia." },
  { titulo: "Integração de exames externos por API", desc: "Recebimento estruturado de laudos de imagem/laboratório de provedores externos." },
  { titulo: "App de bolso para plantonista", desc: "PWA otimizado para fluxo de evolução + prescrição rápida no leito." },
  { titulo: "Treinamento formal por perfil", desc: "Trilhas curtas (15 min) por perfil de acesso, com checklist de competências." },
  { titulo: "Auditoria de qualidade clínica", desc: "Painel CCIH com indicadores de infecção e adesão a protocolos (sepse, AVC, TEV)." },
];

function Slide({ children, kicker, title, n, total }: { children: React.ReactNode; kicker?: string; title?: string; n: number; total: number }) {
  return (
    <section className="slide">
      <header className="slide-header">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">ARSEN</span>
          <span className="brand-sub">· Relatório de Implantação</span>
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

export default function Relatorio1Page() {
  useEffect(() => {
    document.title = "Relatório de Implantação — Semana 1 | Arsen";
  }, []);

  const slides = useMemo(() => {
    const list: Array<{ render: (n: number, total: number) => JSX.Element }> = [];

    // Slide 1 — Capa
    list.push({
      render: (n, total) => (
        <section className="slide slide-cover" key="cover">
          <div className="cover-bg" />
          <div className="cover-content">
            <div className="kicker light">Hospital Municipal Djalma Marques — Socorrão I</div>
            <h1 className="cover-title">Relatório de Implantação<br /><span>Semana 1 · Plataforma Arsen</span></h1>
            <p className="cover-sub">{PERIODO}</p>
            <div className="cover-meta">
              <div><span>Versão</span><strong>{VERSAO}</strong></div>
              <div><span>Setores ativos</span><strong>UTI 1 · UTI 2 · UCI 1 · UCI 2 · UCC · Enf. Transição</strong></div>
              <div><span>Ocupação geral</span><strong>{totalOcup} / {totalCap} leitos ({taxaOcup}%)</strong></div>
            </div>
          </div>
          <footer className="slide-footer cover-footer">
            <span>Confidencial · uso institucional</span>
            <span>Slide {n} / {total}</span>
          </footer>
        </section>
      ),
    });

    // 2 — Sumário executivo
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="01 · Visão geral" title="Sumário executivo da semana">
          <div className="grid grid-2">
            <div className="card">
              <h3>O que foi entregue</h3>
              <ul>
                <li><strong>14 frentes funcionais</strong> em produção (prescrição, cockpit, NIR, farmácia, UE, lab, imagem, gestão).</li>
                <li><strong>12 correções críticas</strong> aplicadas com auditoria preservando todo o dado clínico.</li>
                <li><strong>{totalOcup} pacientes</strong> sob acompanhamento ativo distribuídos em 6 setores.</li>
                <li><strong>{atividade[7].valor.toLocaleString("pt-BR")}</strong> eventos auditados (audit_logs) em 7 dias.</li>
              </ul>
            </div>
            <div className="card accent">
              <h3>Indicadores-chave</h3>
              <div className="kpis">
                <div className="kpi"><span>{taxaOcup}%</span><small>Taxa de ocupação geral</small></div>
                <div className="kpi"><span>{atividade[0].valor}</span><small>Prescrições emitidas</small></div>
                <div className="kpi"><span>{atividade[1].valor}</span><small>Evoluções clínicas</small></div>
                <div className="kpi"><span>{atividade[6].valor}</span><small>Usuários ativos</small></div>
              </div>
            </div>
          </div>
        </Slide>
      ),
    });

    // 3 — Ocupação de leitos
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="02 · Censo" title="Ocupação de leitos por setor">
          <div className="bed-table">
            <div className="bed-row bed-head">
              <span>Setor</span><span>Capacidade</span><span>Ocupados</span><span>Vagos</span><span>Ocupação</span><span>Barra</span>
            </div>
            {ocupacao.map((s) => {
              const pct = (s.ocupados / s.capacidade) * 100;
              return (
                <div className="bed-row" key={s.codigo}>
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
          <p className="note">Setores Neuro 01, Neuro 02, Clínica Cirúrgica, Enf. Vascular, RIV, Centro Cirúrgico e toda a Urgência & Emergência estão com cadeado (sem implantação ativa nesta semana). Total de 322 leitos configurados na plataforma — 79 em operação assistencial.</p>
        </Slide>
      ),
    });

    // 4 — Atividade
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
          <p className="note">Pico operacional em 18/05 (segunda-feira) com 3.638 eventos auditados — convergência entre admissões pós-fim-de-semana e revisão de prescrições.</p>
        </Slide>
      ),
    });

    // 5-7 — Funcionalidades (3 slides)
    const chunks = [
      funcionalidades.slice(0, 5),
      funcionalidades.slice(5, 10),
      funcionalidades.slice(10),
    ];
    chunks.forEach((chunk, idx) => {
      list.push({
        render: (n, total) => (
          <Slide n={n} total={total} kicker={`04.${idx + 1} · Funcionalidades em produção`} title={idx === 0 ? "O que a plataforma já cobre" : idx === 1 ? "O que a plataforma já cobre (cont.)" : "O que a plataforma já cobre (cont.)"}>
            <div className="feature-list">
              {chunk.map((f) => (
                <div className="feature" key={f.titulo}>
                  <h4>{f.titulo}</h4>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </Slide>
        ),
      });
    });

    // 8-9 — Correções (2 slides)
    const corrChunks = [correcoes.slice(0, 6), correcoes.slice(6)];
    corrChunks.forEach((chunk, idx) => {
      list.push({
        render: (n, total) => (
          <Slide n={n} total={total} kicker={`05.${idx + 1} · Correções e ajustes`} title={idx === 0 ? "Principais correções aplicadas" : "Principais correções aplicadas (cont.)"}>
            <div className="feature-list">
              {chunk.map((f) => (
                <div className="feature fix" key={f.titulo}>
                  <h4>{f.titulo}</h4>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </Slide>
        ),
      });
    });

    // 10 — Princípios imutáveis
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="06 · Governança" title="Princípios imutáveis da plataforma">
          <div className="grid grid-2">
            <div className="card">
              <h3>4 camadas separadas</h3>
              <ul>
                <li><strong>Layout</strong> — UI, posição, cor, hierarquia visual.</li>
                <li><strong>Dados</strong> — leitura/escrita em tabelas e RPCs.</li>
                <li><strong>Movimentação</strong> — fluxo de paciente entre leitos e setores.</li>
                <li><strong>Auditoria</strong> — logs imutáveis e histórico clínico.</li>
              </ul>
              <p className="muted">Pedido em uma camada nunca toca a outra sem confirmação explícita.</p>
            </div>
            <div className="card">
              <h3>Blindagens permanentes</h3>
              <ul>
                <li>Nenhum dado clínico é apagado — arquivamento via funções dedicadas.</li>
                <li>Toda edição sensível exige motivo, confirmação tipada e auditoria.</li>
                <li>RLS ativa em todas as tabelas com perfis (admin, gestor, médico, farmácia, enfermagem, recepção…).</li>
                <li>Encounter_id (Fase B.3) impede vazamento entre ocupantes do mesmo leito.</li>
              </ul>
            </div>
          </div>
        </Slide>
      ),
    });

    // 11 — Desafios atuais
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="07 · Desafios" title="Desafios identificados na operação">
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

    // 12-13 — Próxima semana
    const proxChunks = [proximaSemana.slice(0, 4), proximaSemana.slice(4)];
    proxChunks.forEach((chunk, idx) => {
      list.push({
        render: (n, total) => (
          <Slide n={n} total={total} kicker={`08.${idx + 1} · Próximos passos`} title={idx === 0 ? "Prioridades para a Semana 2" : "Prioridades para a Semana 2 (cont.)"}>
            <div className="feature-list">
              {chunk.map((f) => (
                <div className="feature next" key={f.titulo}>
                  <h4>{f.titulo}</h4>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </Slide>
        ),
      });
    });

    // 14 — Encerramento
    list.push({
      render: (n, total) => (
        <section className="slide slide-cover end" key="end">
          <div className="cover-bg end-bg" />
          <div className="cover-content">
            <div className="kicker light">Encerramento · Semana 1</div>
            <h1 className="cover-title">Obrigado.<br /><span>Seguimos para a Semana 2 com base sólida.</span></h1>
            <p className="cover-sub">{totalOcup} pacientes acompanhados · {atividade[0].valor + atividade[1].valor} documentos clínicos emitidos · 12 correções aplicadas sem perda de dado.</p>
            <div className="cover-meta">
              <div><span>Contato técnico</span><strong>Arsen by Medneeds</strong></div>
              <div><span>Plataforma</span><strong>arsen.com.br</strong></div>
              <div><span>Relatório</span><strong>arsen.com.br/relatorio-1</strong></div>
            </div>
          </div>
          <footer className="slide-footer cover-footer">
            <span>Confidencial · uso institucional</span>
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
        <div className="t-title">Relatório de Implantação · Semana 1</div>
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

.slide {
  width: min(1280px, 100%);
  aspect-ratio: 297 / 210; /* A4 landscape */
  background: var(--paper);
  color: var(--ink);
  border-radius: 12px;
  box-shadow: 0 12px 40px -16px rgba(15,23,42,.35), 0 2px 6px rgba(15,23,42,.08);
  padding: 36px 48px 28px;
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
}
.slide-header { display:flex; align-items:center; justify-content:space-between; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.slide-header .brand { display:flex; align-items:center; gap:8px; font-size: 12px; letter-spacing: .14em; }
.brand-dot { width:10px; height:10px; border-radius:50%; background: linear-gradient(135deg,var(--accent),var(--accent-2)); }
.brand-name { font-weight: 700; color: var(--ink); }
.brand-sub { color: var(--muted); font-weight: 500; }
.slide-header .page { font-size: 11px; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
.slide-title-block { padding: 16px 0 12px; }
.slide-title-block .kicker { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
.slide-title-block .title { font-size: 30px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 700; color: var(--ink); margin: 4px 0 0; font-family: 'Georgia', serif; }
.slide-body { flex: 1; min-height: 0; padding-top: 4px; }
.slide-footer { display:flex; justify-content:space-between; border-top:1px solid var(--line); padding-top:8px; font-size:10px; color: var(--muted); letter-spacing: .04em; }

/* Cover */
.slide-cover { padding: 0; }
.cover-bg {
  position:absolute; inset:0;
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(14,165,233,.35), transparent 60%),
    radial-gradient(900px 500px at 10% 110%, rgba(37,99,235,.4), transparent 60%),
    linear-gradient(135deg, #0b1226 0%, #0f1f44 55%, #0a1a36 100%);
}
.end-bg {
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(16,185,129,.3), transparent 60%),
    radial-gradient(900px 500px at 90% 110%, rgba(14,165,233,.35), transparent 60%),
    linear-gradient(135deg, #07142b 0%, #0f2746 55%, #0a1a36 100%);
}
.cover-content { position: relative; z-index: 1; color: #f8fafc; padding: 64px 56px; height: 100%; display:flex; flex-direction:column; justify-content:center; }
.kicker.light { color: #93c5fd; }
.cover-title { font-family: 'Georgia', serif; font-weight: 700; font-size: 56px; line-height: 1.05; letter-spacing: -0.03em; margin: 12px 0 16px; }
.cover-title span { color: #bfdbfe; font-weight: 400; font-size: 36px; display: inline-block; margin-top: 8px; }
.cover-sub { font-size: 16px; color: #cbd5e1; margin: 0 0 32px; }
.cover-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 920px; }
.cover-meta > div { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); padding: 14px 16px; border-radius: 8px; }
.cover-meta span { display:block; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #93c5fd; }
.cover-meta strong { display:block; margin-top:4px; font-size: 14px; color: #f8fafc; font-weight: 600; }
.cover-footer { position:absolute; bottom: 0; left:0; right:0; padding: 16px 56px; color:#94a3b8; border-top:1px solid rgba(255,255,255,.08); }

/* Grids */
.grid { display: grid; gap: 16px; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

.card { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; }
.card h3 { font-family: 'Georgia', serif; font-size: 18px; margin: 0 0 10px; color: var(--ink); }
.card ul { margin: 0; padding-left: 18px; }
.card li { font-size: 13px; line-height: 1.5; margin-bottom: 6px; color: var(--ink-soft); }
.card.accent { background: linear-gradient(135deg, var(--accent-soft), #f0f9ff); border-color: #bfdbfe; }
.kpis { display:grid; grid-template-columns: repeat(2,1fr); gap: 12px; margin-top:8px; }
.kpi { background: white; border-radius: 8px; padding: 12px; border: 1px solid #dbeafe; }
.kpi span { display:block; font-family: 'Georgia', serif; font-size: 28px; font-weight: 700; color: var(--accent); line-height: 1; }
.kpi small { display:block; margin-top:4px; font-size: 11px; color: var(--muted); }

.stat { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
.stat strong { display:block; font-family: 'Georgia', serif; font-size: 28px; color: var(--accent); line-height: 1; }
.stat small { display:block; margin-top: 6px; font-size: 11px; color: var(--muted); line-height: 1.3; }

/* Bed table */
.bed-table { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.bed-row { display: grid; grid-template-columns: 2fr .8fr .8fr .8fr .8fr 2fr; gap: 8px; padding: 10px 16px; align-items: center; font-size: 13px; border-bottom: 1px solid var(--line); }
.bed-row:last-child { border-bottom: 0; }
.bed-head { background: #f1f5f9; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.bed-total { background: #eff6ff; font-weight: 600; }
.bar { background: #e2e8f0; height: 10px; border-radius: 6px; overflow: hidden; }
.bar-fill { display:block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }

.note { margin-top: 14px; font-size: 11px; color: var(--muted); line-height: 1.5; border-left: 3px solid var(--accent); padding-left: 10px; }

/* Features */
.feature-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.feature { background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; border-left: 3px solid var(--accent); }
.feature h4 { font-size: 14px; margin: 0 0 4px; color: var(--ink); font-weight: 700; }
.feature p { font-size: 12px; margin: 0; color: var(--ink-soft); line-height: 1.45; }
.feature.fix { border-left-color: var(--warn); }
.feature.next { border-left-color: var(--ok); }

/* Challenges */
.challenge-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.challenge { display: flex; gap: 12px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; align-items: flex-start; }
.challenge .num { font-family: 'Georgia', serif; font-size: 20px; color: var(--warn); font-weight: 700; line-height: 1; }
.challenge p { font-size: 12.5px; margin: 0; color: #78350f; line-height: 1.45; }

.muted { color: var(--muted); font-size: 12px; margin-top: 6px; }

@media print {
  @page { size: A4 landscape; margin: 0; }
  body { background: #fff !important; }
  .report-root { background: #fff; }
  .no-print { display: none !important; }
  .deck { gap: 0; padding: 0; }
  .slide { box-shadow: none; border-radius: 0; width: 100%; max-width: none; aspect-ratio: auto; height: 100vh; page-break-after: always; break-after: page; padding: 28px 36px 22px; }
  .slide:last-child { page-break-after: auto; }
  .cover-content { padding: 56px 48px; }
  .cover-title { font-size: 48px; }
  .cover-title span { font-size: 30px; }
}
`;
