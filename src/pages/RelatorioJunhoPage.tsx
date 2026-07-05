import { useEffect, useMemo } from "react";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import socorraoCross from "@/assets/socorrao-cross-logo.png";

/**
 * Relatório Mensal — Junho/2026
 * Plataforma Arsen × HMDM Socorrão I
 * Rota: /relatorio-junho
 * Linguagem simples, foco em produtividade, volume de ajustes e resultados.
 * Números reais extraídos do banco (01/06 a 30/06/2026).
 */

const PERIODO = "01/06/2026 — 30/06/2026 (30 dias)";
const VERSAO = "v1.0 · gerado em 05/07/2026";

// KPIs REAIS (banco, 01-30/jun/2026)
const kpis = {
  atendimentos: 167,
  altas: 68,
  obitos: 40,
  prescricoes: 4012,
  evolucoes: 2882,
  exames: 2384,
  movimentacoes: 480,
  preAdmissoes: 185,
  pacientesNovos: 138,
  usuariosAtivos: 42,
  eventosAuditados: 90447,
  transferenciasInternas: 55,
  validacoesFarm: 8,
};

const producaoSetor = [
  { setor: "UTI 2", prescricoes: 1278 },
  { setor: "UCC", prescricoes: 965 },
  { setor: "UTI 1", prescricoes: 597 },
  { setor: "UCI 2", prescricoes: 560 },
  { setor: "UCI 1", prescricoes: 383 },
  { setor: "Enfermaria de Transição", prescricoes: 229 },
];
const totalPrescSetores = producaoSetor.reduce((s, x) => s + x.prescricoes, 0);

// Volume operacional — cartões grandes (linguagem simples)
const volume = [
  { label: "Atendimentos abertos no mês", valor: kpis.atendimentos },
  { label: "Altas hospitalares documentadas", valor: kpis.altas },
  { label: "Óbitos documentados", valor: kpis.obitos },
  { label: "Prescrições emitidas", valor: kpis.prescricoes },
  { label: "Evoluções clínicas registradas", valor: kpis.evolucoes },
  { label: "Exames solicitados", valor: kpis.exames },
  { label: "Movimentações de paciente", valor: kpis.movimentacoes },
  { label: "Eventos auditados na plataforma", valor: kpis.eventosAuditados },
];

// Ajustes e melhorias entregues em junho — linguagem para a direção
const ajustes = [
  {
    tema: "Padronização das impressões",
    desc: "Todos os documentos clínicos (prescrição, evolução, admissão, alta, óbito, APAC, AIH, guia de antibiótico e cultura) passaram a seguir o mesmo padrão institucional exigido pela Qualidade — Norma Zero.",
  },
  {
    tema: "Prescrição mais segura",
    desc: "Bloqueio automático para triturar comprimidos que não podem ser triturados (lista ISMP-Brasil). Insulinoterapia assistida em 4 esquemas (basal-bolus, sliding, NPH fixa e EV contínua). Aviso obrigatório para preencher peso e alergias antes de assinar.",
  },
  {
    tema: "Farmácia com catálogo oficial",
    desc: "Catálogo HMDM 2026 completo importado — 222 princípios ativos e 322 apresentações — com sinalização automática de medicamentos de Alto Alerta, controlados e que exigem diluição.",
  },
  {
    tema: "Cadastro do paciente mais confiável",
    desc: "Importação do PDF do PIS com leitura por inteligência artificial — o prontuário já chega pronto para a admissão. Toda edição sensível (data de admissão, número de prontuário, identidade) exige motivo e fica registrada.",
  },
  {
    tema: "Transferência interna sem perda de histórico",
    desc: "O paciente mantém o mesmo número de atendimento ao trocar de leito ou setor. Evoluções, prescrições e exames continuam disponíveis. Escalada crítica para UTI/UCI 2 dispara SAPS 3 automaticamente após a alocação.",
  },
  {
    tema: "Mapa de leitos × prontuário sincronizados em tempo real",
    desc: "Reuso de leito não expõe mais dados do paciente anterior. Blindagem por atendimento aplicada em todo o cockpit clínico.",
  },
  {
    tema: "Suspender alta sem apagar o documento",
    desc: "Botão dedicado no cockpit exige motivo e confirmação por senha. O documento original permanece auditável — nada se perde.",
  },
  {
    tema: "Login mais flexível e recuperação de senha",
    desc: "Acesso por usuário, CPF ou e-mail. Reset de senha por e-mail. Escolha entre múltiplos perfis quando o usuário tem mais de um vínculo.",
  },
  {
    tema: "Suporte técnico presente turno a turno",
    desc: "Plantão 24×7 acompanhando médicos, farmácia, enfermagem e NIR durante todo o mês.",
  },
];

// Resultados concretos — o que a direção enxerga
const resultados = [
  {
    titulo: "6 setores em operação assistencial contínua",
    desc: "UTI 1, UTI 2, UCI 1, UCI 2, UCC e Enfermaria de Transição usando a plataforma como ferramenta principal do dia a dia — sem retorno ao papel.",
  },
  {
    titulo: "Documentação clínica 100% rastreável",
    desc: `${kpis.eventosAuditados.toLocaleString("pt-BR")} eventos auditados no mês. Toda ação sensível (edição, exclusão, movimentação, assinatura) fica registrada em trilha imutável.`,
  },
  {
    titulo: "Nenhum dado clínico apagado",
    desc: "Toda baixa é arquivamento. Prontuário longitudinal preservado mesmo em reuso de leito, transferência interna ou correção administrativa.",
  },
  {
    titulo: "Padrão institucional consolidado",
    desc: "Impressões seguindo o padrão da Qualidade da unidade. Cabeçalho unificado com identificação correta do paciente e proteção contra troca acidental de identidade.",
  },
  {
    titulo: "Farmácia clínica com base oficial",
    desc: "Catálogo HMDM 2026 substituindo listas manuais. Sinalização automática de risco em cada prescrição.",
  },
  {
    titulo: "Adesão real da equipe assistencial",
    desc: `${kpis.usuariosAtivos} usuários ativos no mês (médicos, enfermagem, farmácia, NIR e recepção). ${kpis.prescricoes.toLocaleString("pt-BR")} prescrições e ${kpis.evolucoes.toLocaleString("pt-BR")} evoluções emitidas na plataforma.`,
  },
];

// O que a plataforma cobre além do que já está em operação — argumento para a direção
const coberturaProduto = [
  { titulo: "Recepção & Cadastro", desc: "Cadastro auditável, identificação NI, triagem express e detecção de duplicatas.", c: "blue" },
  { titulo: "Farmácia Clínica", desc: "Validação farmacêutica, Alto Alerta, MAV/Portaria 344 e catálogo HMDM 2026.", c: "green" },
  { titulo: "Laboratório & Imagem", desc: "Setores dedicados, ciência médica obrigatória e 4 modalidades de resultado.", c: "cyan" },
  { titulo: "NIR & Regulação", desc: "9 sub-módulos, 8 status de leito e monitoramento de gravíssimos com SLA.", c: "purple" },
  { titulo: "Urgência & Emergência", desc: "Vertical, Horizontal, Sala Vermelha, Sala Laranja, Observação e 7 presets rápidos.", c: "red" },
];

// Compromissos com a direção e Qualidade — governança em linguagem simples
const compromissos = [
  { titulo: "Nada de dado clínico é apagado", desc: "Toda baixa vira arquivamento auditável." },
  { titulo: "Edição sensível exige motivo e confirmação", desc: "Data de admissão, prontuário, identidade e alta com trilha completa." },
  { titulo: "Cada perfil vê apenas o que lhe cabe", desc: "Segurança por perfil aplicada em todas as tabelas." },
  { titulo: "Reuso de leito não vaza dados", desc: "Blindagem por atendimento em todo o cockpit clínico." },
  { titulo: "Movimentação sempre rastreada", desc: "Entrada, transferência e saída com autor, motivo e horário." },
  { titulo: "Camadas separadas no desenvolvimento", desc: "Dados, movimentação e auditoria não são tocados sem confirmação explícita." },
];

function Slide({ children, kicker, title, n, total }: { children: React.ReactNode; kicker?: string; title?: string; n: number; total: number }) {
  return (
    <section className="slide">
      <header className="slide-header">
        <div className="brand">
          <span className="brand-arsen-wordmark">Arsen</span>
          <span className="brand-divider" />
          <img src={socorraoCross} alt="Socorrão I" className="brand-socorrao" />
          <span className="brand-sub">Relatório Mensal · Junho/2026</span>
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

export default function RelatorioJunhoPage() {
  useEffect(() => {
    document.title = "Relatório Mensal — Junho/2026 | Arsen × Socorrão I";
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
            <div className="kicker light">Plataforma Clínica · em parceria com o HMDM Socorrão I</div>
            <h1 className="cover-title">Relatório Mensal<br /><span>Junho de 2026 · produtividade, ajustes e resultados</span></h1>
            <p className="cover-sub">{PERIODO}</p>
            <div className="cover-meta">
              <div><span>Destinatário</span><strong>Direção · Qualidade</strong></div>
              <div><span>Setores em operação</span><strong>UTI 1 · UTI 2 · UCI 1 · UCI 2 · UCC · Enf. Transição</strong></div>
              <div><span>Versão</span><strong>{VERSAO}</strong></div>
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
        <Slide n={n} total={total} kicker="01 · Visão geral" title="O mês em uma página">
          <div className="grid grid-exec">
            <div className="card">
              <h3>O que aconteceu em junho</h3>
              <ul>
                <li><strong>6 setores</strong> operando com a plataforma como ferramenta principal (UTI 1, UTI 2, UCI 1, UCI 2, UCC e Enf. de Transição).</li>
                <li><strong>{kpis.prescricoes.toLocaleString("pt-BR")} prescrições</strong> e <strong>{kpis.evolucoes.toLocaleString("pt-BR")} evoluções</strong> clínicas registradas no mês.</li>
                <li><strong>{kpis.atendimentos} atendimentos</strong> abertos, <strong>{kpis.altas} altas</strong> e <strong>{kpis.obitos} óbitos</strong> documentados dentro do sistema.</li>
                <li><strong>{kpis.eventosAuditados.toLocaleString("pt-BR")} eventos auditados</strong> — cada ação sensível fica registrada para conferência.</li>
                <li><strong>{ajustes.length} frentes de melhoria</strong> entregues no mês, sem interromper a rotina assistencial.</li>
                <li className="muted-line"><em>Suporte técnico em plantão 24×7 durante todo o mês, dando retaguarda a médicos, farmácia, enfermagem e NIR.</em></li>
              </ul>
            </div>
            <div className="card accent kpi-card">
              <h3>Indicadores do mês</h3>
              <div className="kpis kpis-exec">
                <div className="kpi"><span>{kpis.prescricoes.toLocaleString("pt-BR")}</span><small>Prescrições emitidas</small></div>
                <div className="kpi"><span>{kpis.evolucoes.toLocaleString("pt-BR")}</span><small>Evoluções clínicas</small></div>
                <div className="kpi"><span>{kpis.atendimentos}</span><small>Atendimentos abertos</small></div>
                <div className="kpi"><span>{kpis.usuariosAtivos}</span><small>Usuários ativos</small></div>
              </div>
            </div>
          </div>
        </Slide>
      ),
    });

    // 3 — PRODUÇÃO POR SETOR
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="02 · Produtividade" title="Produção por setor · prescrições emitidas">
          <div className="bed-table">
            <div className="bed-row bed-head">
              <span>Setor</span><span>Prescrições</span><span>Participação</span><span>Distribuição visual</span>
            </div>
            {producaoSetor.map((s) => {
              const pct = (s.prescricoes / totalPrescSetores) * 100;
              return (
                <div className="bed-row bed-row-4" key={s.setor}>
                  <span><strong>{s.setor}</strong></span>
                  <span>{s.prescricoes.toLocaleString("pt-BR")}</span>
                  <span>{pct.toFixed(1)}%</span>
                  <span className="bar"><span className="bar-fill" style={{ width: `${pct}%` }} /></span>
                </div>
              );
            })}
            <div className="bed-row bed-row-4 bed-total">
              <span><strong>TOTAL</strong></span>
              <span>{totalPrescSetores.toLocaleString("pt-BR")}</span>
              <span>100%</span>
              <span className="bar"><span className="bar-fill" style={{ width: "100%" }} /></span>
            </div>
          </div>
          <p className="note">UTI 2 concentra a maior produção do mês, seguida por UCC — reflexo direto do porte assistencial e do fluxo cirúrgico da unidade. Números somam apenas os setores em operação com a plataforma.</p>
        </Slide>
      ),
    });

    // 4 — VOLUME OPERACIONAL
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="03 · Volume" title="Volume operacional no mês">
          <div className="grid grid-4">
            {volume.map((a) => (
              <div className="stat" key={a.label}>
                <strong>{a.valor.toLocaleString("pt-BR")}</strong>
                <small>{a.label}</small>
              </div>
            ))}
          </div>
          <p className="note">Além disso: <strong>{kpis.pacientesNovos} pacientes</strong> novos cadastrados, <strong>{kpis.preAdmissoes} pré-admissões</strong> registradas e <strong>{kpis.transferenciasInternas} transferências internas</strong> concluídas sem perder o histórico clínico.</p>
        </Slide>
      ),
    });

    // 5 e 6 — AJUSTES E MELHORIAS ENTREGUES (2 slides)
    const ajustesChunks = [ajustes.slice(0, 5), ajustes.slice(5)];
    ajustesChunks.forEach((chunk, idx) => {
      list.push({
        render: (n, total) => (
          <Slide
            n={n}
            total={total}
            kicker={`04.${idx + 1} · Ajustes e melhorias`}
            title={idx === 0 ? "O que foi ajustado e entregue no mês" : "O que foi ajustado e entregue no mês (cont.)"}
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
              <p className="note">Todos os ajustes foram aplicados sem interromper a rotina assistencial — nenhum dado clínico foi perdido no processo.</p>
            )}
          </Slide>
        ),
      });
    });

    // 7 — RESULTADOS
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="05 · Resultados" title="Resultados que a direção enxerga">
          <div className="feature-list">
            {resultados.map((r) => (
              <div className="feature on" key={r.titulo}>
                <h4>{r.titulo}</h4>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
        </Slide>
      ),
    });

    // 8 — COBERTURA DE PRODUTO (o que ainda pode ser expandido)
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="06 · Cobertura de produto" title="O que a plataforma já cobre — pronto para expandir">
          <p className="lede">Estes módulos já estão <strong>prontos no produto</strong> e podem ser incorporados à operação a qualquer momento, ampliando o escopo do que a plataforma entrega para a unidade.</p>
          <div className="cover-grid">
            {coberturaProduto.map((c) => (
              <div key={c.titulo} className={`cover-card cover-${c.c}`}>
                <h4>{c.titulo}</h4>
                <p>{c.desc}</p>
                <span className="cover-tag">Disponível · fora da operação atual</span>
              </div>
            ))}
          </div>
        </Slide>
      ),
    });

    // 9 — GOVERNANÇA / COMPROMISSOS
    list.push({
      render: (n, total) => (
        <Slide n={n} total={total} kicker="07 · Governança" title="Compromissos com a direção e a Qualidade">
          <div className="grid grid-2">
            <div className="card">
              <h3>Princípios que orientam a plataforma</h3>
              <ul>
                {compromissos.slice(0, 3).map((b) => (
                  <li key={b.titulo}><strong>{b.titulo}.</strong> {b.desc}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3>Segurança e rastreabilidade</h3>
              <ul>
                {compromissos.slice(3).map((b) => (
                  <li key={b.titulo}><strong>{b.titulo}.</strong> {b.desc}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="note">Todos os documentos clínicos seguem o padrão de impressão alinhado com o setor de Qualidade da unidade (Norma Zero).</p>
        </Slide>
      ),
    });

    // 10 — ENCERRAMENTO
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
            <div className="kicker light">Encerramento · Junho/2026</div>
            <h1 className="cover-title">Obrigado.<br /><span>Junho consolidou a operação — seguimos evoluindo em julho.</span></h1>
            <p className="cover-sub">
              {kpis.prescricoes.toLocaleString("pt-BR")} prescrições · {kpis.evolucoes.toLocaleString("pt-BR")} evoluções · {kpis.atendimentos} atendimentos · {ajustes.length} frentes de melhoria entregues.
            </p>
            <div className="cover-meta">
              <div><span>Plataforma</span><strong>Arsen</strong></div>
              <div><span>Unidade</span><strong>HMDM · Socorrão I</strong></div>
              <div><span>Relatório</span><strong>arsen.com.br/relatorio-junho</strong></div>
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
        <div className="t-title">Relatório Mensal · Junho/2026 · Arsen × Socorrão I</div>
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
  font-weight: 600;
  font-size: 22px;
  letter-spacing: 0.01em;
  line-height: 1;
  background: linear-gradient(135deg, #0054A6 0%, #1e3a8a 30%, #2563eb 55%, #38bdf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  filter: drop-shadow(0 1px 4px rgba(37, 99, 235, 0.18));
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

.slide-cover { padding: 0; background: #ffffff; }
.cover-bg { position:absolute; inset:0; background: #ffffff; }
.end-bg { background: #ffffff; }

.nz-cross-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; display: grid; grid-template-columns: repeat(5, 1fr); z-index: 2; }
.nz-cross-bar > span { display: block; height: 100%; }

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

.cover-content { position: relative; z-index: 1; color: var(--ink); padding: 130px 56px 70px; height: 100%; display: flex; flex-direction: column; justify-content: flex-start; }

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
.cover-title { font-family: 'Playfair Display', Georgia, serif; font-weight: 600; font-size: 44px; line-height: 1.05; letter-spacing: -0.015em; margin: 10px 0 14px; color: var(--ink); }
.cover-title span { font-family: 'Playfair Display', Georgia, serif; color: var(--accent); font-weight: 300; font-style: italic; font-size: 26px; display: inline-block; margin-top: 8px; letter-spacing: 0; }
.cover-sub { font-size: 13px; color: var(--ink-soft); margin: 0 0 22px; }
.cover-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 920px; }
.cover-meta > div { background: linear-gradient(135deg, #0f1f44, #1e3a8a); border: 1px solid rgba(255,255,255,.08); padding: 14px 16px; border-radius: 10px; box-shadow: 0 10px 24px -14px rgba(15,23,42,.45); }
.cover-meta span { display:block; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #93c5fd; font-weight: 600; }
.cover-meta strong { display:block; margin-top:6px; font-size: 13px; color: #f8fafc; font-weight: 600; line-height: 1.3; }
.cover-footer { position:absolute; bottom: 0; left:0; right:0; padding: 14px 44px; color: var(--muted); border-top:1px solid var(--line); background: #ffffff; z-index: 3; }

.slide-cover.end .cover-content { padding: 124px 56px 96px; }
.slide-cover.end .cover-wordmark-hero { font-size: 132px; margin: 0 0 14px; }
.slide-cover.end .cover-title { font-size: 38px; margin: 8px 0 12px; }
.slide-cover.end .cover-sub { margin-bottom: 18px; }
.slide-cover.end .cover-meta { margin-bottom: 8px; }

.grid { display: grid; gap: 14px; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.grid-exec { grid-template-columns: 1.35fr 1fr; align-items: stretch; }
.grid-exec > .card { display: flex; flex-direction: column; }
.grid-exec > .card ul { flex: 1; }
.kpi-card { display: flex; flex-direction: column; }
.kpis-exec { flex: 1; grid-auto-rows: 1fr; margin-top: 12px; gap: 12px; }
.kpis-exec .kpi { display: flex; flex-direction: column; justify-content: center; padding: 16px 14px; }
.kpis-exec .kpi span { font-size: 30px; }
.kpis-exec .kpi small { font-size: 11px; margin-top: 6px; line-height: 1.35; }

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

.bed-table { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #fff; }
.bed-row { display: grid; grid-template-columns: 2fr .7fr .7fr .7fr .7fr 1.8fr; gap: 8px; padding: 9px 14px; align-items: center; font-size: 12.5px; border-bottom: 1px solid var(--line); }
.bed-row-4 { grid-template-columns: 2fr 1fr 1fr 2.4fr; }
.bed-row:last-child { border-bottom: 0; }
.bed-head { background: #f1f5f9; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.bed-total { background: #eff6ff; font-weight: 600; }
.bar { background: #e2e8f0; height: 9px; border-radius: 6px; overflow: hidden; }
.bar-fill { display:block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }

.note { margin-top: 8px; font-size: 11px; color: var(--muted); line-height: 1.5; border-left: 3px solid var(--accent); padding-left: 10px; }
.lede { font-size: 13px; color: var(--ink-soft); line-height: 1.5; margin: 0 0 6px; }
.lede strong { color: var(--ink); }

.feature-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.feature { background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; padding: 10px 13px; border-left: 3px solid var(--accent); }
.feature h4 { font-size: 13px; margin: 0 0 4px; color: var(--ink); font-weight: 700; }
.feature p { font-size: 11.5px; margin: 0; color: var(--ink-soft); line-height: 1.45; }
.feature.fix { border-left-color: var(--warn); }
.feature.on { border-left-color: var(--ok); background: #f0fdf4; }

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
