import { useEffect, useState, useCallback, useMemo } from "react";
import { whitelabel } from "@/config/whitelabel";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Hospital,
  Map as MapIcon,
  Activity,
  Brain,
  Pill,
  ShieldCheck,
  Users,
  ClipboardList,
  TrendingUp,
  Network,
  Lock,
  Stethoscope,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

/* ============================================================
 * APRESENTAÇÃO INSTITUCIONAL — HMDM / Socorrão I
 * Padrão Norma Zero • Híbrido (capa/encerramento escuros + conteúdo claro)
 * Rota pública: /apresentacao
 * Navegação: ← → Espaço (avança) • Esc (sai do fullscreen) • F (fullscreen)
 * ============================================================ */

const COLORS = whitelabel.theme.institutionalColors;

type Slide = {
  id: number;
  variant: "dark" | "light";
  render: () => JSX.Element;
};

// --- Componentes auxiliares ---------------------------------

function InstitutionalHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const isDark = tone === "dark";
  return (
    <div
      className={`flex items-center gap-4 border-b pb-4 ${
        isDark ? "border-white/15" : "border-slate-200"
      }`}
    >
      <img
        src={whitelabel.logos.hospital}
        alt={whitelabel.institution.hospitalLogoAlt}
        className="h-14 w-auto max-w-[80px] object-contain"
      />
      <div className="flex-1 leading-tight">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
            isDark ? "text-white/60" : "text-slate-500"
          }`}
        >
          {whitelabel.print.institutionalHeader.line1}
        </p>
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
            isDark ? "text-white/80" : "text-slate-700"
          }`}
        >
          {whitelabel.print.institutionalHeader.line2}
        </p>
        <p
          className={`text-base font-bold uppercase tracking-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {whitelabel.print.institutionalHeader.line3}
        </p>
      </div>
      <div className="flex h-12 items-center gap-1">
        <span className="block h-12 w-2.5 rounded-sm" style={{ background: COLORS.red }} />
        <span className="block h-12 w-2.5 rounded-sm" style={{ background: COLORS.orange }} />
        <span className="block h-12 w-2.5 rounded-sm" style={{ background: COLORS.yellow }} />
        <span className="block h-12 w-2.5 rounded-sm" style={{ background: COLORS.green }} />
        <span className="block h-12 w-2.5 rounded-sm" style={{ background: COLORS.blue }} />
      </div>
    </div>
  );
}

function SectionTag({ children, color = COLORS.blue }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border-l-4 bg-white p-5 shadow-sm"
      style={{ borderLeftColor: color }}
    >
      <p className="text-4xl font-black tracking-tight" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </p>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  desc,
  color,
}: {
  icon: any;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="flex gap-4">
      <div
        className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-white shadow-sm"
        style={{ background: color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{desc}</p>
      </div>
    </div>
  );
}

// --- Slides ------------------------------------------------

const slides: Slide[] = [
  // 1 — CAPA
  {
    id: 1,
    variant: "dark",
    render: () => (
      <div className="relative flex h-full flex-col justify-between p-16 text-white">
        <div className="flex items-center gap-4">
          <img
            src={whitelabel.logos.hospital}
            alt="Socorrão I"
            className="h-16 w-16 rounded-md object-cover ring-1 ring-white/20"
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              {whitelabel.print.institutionalHeader.line1}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
              {whitelabel.print.institutionalHeader.line2}
            </p>
          </div>
        </div>

        <div className="max-w-3xl">
          <SectionTag color={COLORS.yellow}>Apresentação Institucional</SectionTag>
          <h1 className="mt-6 text-6xl font-black leading-[1.05] tracking-tight">
            Hospital Municipal
            <br />
            Djalma Marques
            <br />
            <span style={{ color: COLORS.yellow }}>— Socorrão I</span>
          </h1>
          <p className="mt-6 max-w-2xl text-xl font-light leading-relaxed text-white/80">
            Plataforma digital de gestão clínica e regulação hospitalar — proposta
            de homologação oficial.
          </p>
          <div className="mt-8 flex items-center gap-1">
            <span className="block h-2 w-16 rounded-full" style={{ background: COLORS.red }} />
            <span className="block h-2 w-16 rounded-full" style={{ background: COLORS.orange }} />
            <span className="block h-2 w-16 rounded-full" style={{ background: COLORS.yellow }} />
            <span className="block h-2 w-16 rounded-full" style={{ background: COLORS.green }} />
            <span className="block h-2 w-16 rounded-full" style={{ background: COLORS.blue }} />
          </div>
        </div>

        <div className="flex items-end justify-between text-xs uppercase tracking-widest text-white/50">
          <div>
            <p>Coordenações & Direção Médica e Hospitalar</p>
            <p className="text-white/30">São Luís — Maranhão</p>
          </div>
          <p className="text-white/30">{whitelabel.compliance.normaZeroCode} • v{whitelabel.compliance.normaZeroVersion}</p>
        </div>
      </div>
    ),
  },

  // 2 — CONTEXTO / PROPÓSITO
  {
    id: 2,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div className="grid flex-1 grid-cols-12 gap-10">
          <div className="col-span-7 flex flex-col justify-center">
            <SectionTag color={COLORS.blue}>Contexto</SectionTag>
            <h2 className="mt-4 text-5xl font-black leading-tight tracking-tight text-slate-900">
              Por que digitalizar a operação clínica do Socorrão I?
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              O Socorrão I é referência em urgência e emergência em São Luís.
              Uma operação dessa complexidade exige <strong>visibilidade em
              tempo real</strong>, <strong>padronização de cuidado</strong> e{" "}
              <strong>rastreabilidade</strong> — pilares da Norma Zero (MAN.05-001).
            </p>
            <ul className="mt-6 space-y-3 text-base text-slate-700">
              {[
                "Gestão de leitos descentralizada e dependente de planilhas paralelas",
                "Prescrições e evoluções em papel, sem trilha auditável",
                "Falta de visão consolidada para a Direção e o NIR",
                "Dificuldade em mensurar produção, ocupação e desfechos",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span
                    className="mt-2 block h-2 w-2 flex-none rounded-full"
                    style={{ background: COLORS.red }}
                  />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-5 flex flex-col justify-center gap-4">
            <StatCard value="245" label="Leitos mapeados" color={COLORS.blue} />
            <StatCard value="9" label="Setores integrados" color={COLORS.green} />
            <StatCard value="24/7" label="Operação contínua" color={COLORS.orange} />
            <StatCard value="100%" label="Conformidade Norma Zero" color={COLORS.red} />
          </div>
        </div>
      </div>
    ),
  },

  // 3 — VISÃO GERAL DA PLATAFORMA
  {
    id: 3,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.green}>Visão Geral</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            Uma plataforma única para toda a jornada do paciente
          </h2>
          <p className="mt-2 text-lg text-slate-600">
            Da recepção à alta — passando por triagem, emergência, UTI, exames e regulação.
          </p>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-5">
          {[
            { icon: Users, t: "Recepção & Cadastro", d: "Identificação NI, prontuário único, busca por CPF/nome.", c: COLORS.blue },
            { icon: Activity, t: "Triagem Manchester", d: "Classificação de risco com fila visível e monitor TV.", c: COLORS.yellow },
            { icon: Stethoscope, t: "Emergência (UE)", d: "Vertical, Horizontal, Sala Vermelha e Observação.", c: COLORS.red },
            { icon: Hospital, t: "UTI & Enfermarias", d: "Mapa de leitos, prescrição estruturada e evoluções SOAP.", c: COLORS.orange },
            { icon: ClipboardList, t: "Exames & Resultados", d: "Laboratório e imagem com fluxo de ciência médica.", c: COLORS.green },
            { icon: Network, t: "NIR & Regulação", d: "Solicitações, aceites e desfechos auditáveis.", c: COLORS.blue },
            { icon: Pill, t: "Farmácia Clínica", d: "Validação farmacêutica e catálogo HMDM 2026.", c: COLORS.green },
            { icon: ShieldCheck, t: "CCIH", d: "Vigilância de infecções e culturas em tempo real.", c: COLORS.red },
            { icon: TrendingUp, t: "Gestão Executiva", d: "47 relatórios, KPIs e painel do gestor.", c: COLORS.orange },
          ].map((m) => (
            <div
              key={m.t}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white"
                style={{ background: m.c }}
              >
                <m.icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-900">{m.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{m.d}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // 4 — FOCO MÉDICO
  {
    id: 4,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div className="grid flex-1 grid-cols-12 gap-10">
          <div className="col-span-7 flex flex-col justify-center">
            <SectionTag color={COLORS.red}>Foco do Acesso Médico</SectionTag>
            <h2 className="mt-4 text-5xl font-black leading-tight tracking-tight text-slate-900">
              Dois instrumentos no centro da prática clínica
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              O médico do Socorrão I encontra na plataforma duas ferramentas
              que organizam toda a sua rotina:
            </p>
            <div className="mt-8 space-y-5">
              <FeatureRow
                icon={MapIcon}
                title="Mapa de Pacientes"
                desc="Visão imediata de todos os leitos, gravidade, dispositivos e pendências por setor."
                color={COLORS.blue}
              />
              <FeatureRow
                icon={Activity}
                title="Painel Clínico"
                desc="Prontuário unificado, prescrição estruturada, evolução SOAP, exames e cuidados."
                color={COLORS.green}
              />
            </div>
          </div>
          <div className="col-span-5 rounded-2xl bg-slate-900 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              O que muda na prática
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed">
              {[
                "Tudo do paciente em uma tela — sem trocar sistema",
                "Prescrição com cálculo de dose, diluição e tempo de infusão",
                "Alertas de interação medicamentosa por IA",
                "Histórico longitudinal completo, auditável",
                "Impressão padronizada Norma Zero (A4)",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 flex-none" style={{ color: COLORS.yellow }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    ),
  },

  // 5 — MAPA DE LEITOS (detalhe)
  {
    id: 5,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.blue}>Módulo 01 • Mapa de Pacientes</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            A operação inteira em uma única tela
          </h2>
        </div>
        <div className="grid flex-1 grid-cols-12 gap-8">
          <div className="col-span-5 space-y-4">
            <FeatureRow
              icon={MapIcon}
              title="245 leitos visíveis"
              desc="UTI 1 e 2, UCI, UE Vertical/Horizontal, Sala Vermelha, Observação Laranja, enfermarias."
              color={COLORS.blue}
            />
            <FeatureRow
              icon={Activity}
              title="Status clínico em cores"
              desc="7 status (estável, crítico, gravíssimo, alta, etc.) com ponto colorido por leito."
              color={COLORS.green}
            />
            <FeatureRow
              icon={ShieldCheck}
              title="Capacidade & Maca Extra"
              desc="Regras automáticas de capacidade e suporte a leitos de extensão."
              color={COLORS.orange}
            />
            <FeatureRow
              icon={ClipboardList}
              title="Impressão A4 Norma Zero"
              desc="Mapa institucional pronto para passagem de plantão."
              color={COLORS.red}
            />
          </div>
          <div className="col-span-7 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-6 shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Pré-visualização — UTI 2 (Setor Amarelo)
            </p>
            <div className="mt-4 grid grid-cols-5 gap-2.5">
              {Array.from({ length: 10 }).map((_, i) => {
                const bed = `L${String(i + 9).padStart(2, "0")}`;
                const occupied = ![10, 12].includes(i + 9);
                const dotColors = [COLORS.green, COLORS.orange, COLORS.red, COLORS.yellow];
                const dot = occupied ? dotColors[i % dotColors.length] : "#cbd5e1";
                return (
                  <div
                    key={bed}
                    className={`rounded-lg border bg-white p-3 shadow-sm ${
                      occupied ? "border-slate-200" : "border-dashed border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                      <span className="text-xs font-bold text-slate-800">{bed}</span>
                    </div>
                    <p className="mt-2 truncate text-[10px] font-semibold uppercase text-slate-700">
                      {occupied ? "Paciente Real" : "Vago"}
                    </p>
                    <p className="text-[9px] text-slate-500">{occupied ? "TOT • SVD • SNE" : "—"}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
              <span>● Estável  ● Crítico  ● Gravíssimo  ● Alta programada</span>
              <span>8 / 10 ocupação</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // 6 — PAINEL CLÍNICO (detalhe)
  {
    id: 6,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.green}>Módulo 02 • Painel Clínico</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            Prontuário unificado — tudo do paciente em um só lugar
          </h2>
        </div>
        <div className="grid flex-1 grid-cols-12 gap-8">
          <div className="col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">UTI 2 • Leito L14</p>
                <p className="text-lg font-black text-slate-900">PACIENTE — 67 ANOS • SEPSE PULMONAR</p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-[10px] font-bold uppercase text-white"
                style={{ background: COLORS.red }}
              >
                Crítico
              </span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wider">
              {["Resumo", "Prescrição", "Evolução", "Exames", "Cuidados", "Documentos", "Histórico", "Cockpit"].map(
                (t, i) => (
                  <div
                    key={t}
                    className={`rounded-md px-2 py-2 text-center ${
                      i === 1
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {t}
                  </div>
                )
              )}
            </div>
            <div className="mt-5 space-y-2.5 text-sm">
              {[
                ["1", "CEFTRIAXONA 2g EV 12/12h", "D3 • Antibiótico"],
                ["2", "NORADRENALINA 16mg + SF 250mL BIC", "0,3 mcg/kg/min"],
                ["3", "OMEPRAZOL 40mg EV 1x/dia", "Profilaxia TEV"],
                ["4", "ENOXAPARINA 40mg SC 1x/dia", "Profilaxia TEV"],
              ].map(([n, m, t]) => (
                <div
                  key={n}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-white">
                    {n}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-slate-800">{m}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-5 flex flex-col justify-center gap-4">
            <FeatureRow
              icon={Pill}
              title="Prescrição estruturada"
              desc="Catálogo HMDM 2026 com diluição, dose máx. e tempo de infusão pré-validados."
              color={COLORS.green}
            />
            <FeatureRow
              icon={Brain}
              title="Sugestões com IA"
              desc="Posologia sugerida com fonte (UpToDate, AMIB, KDIGO) — sem alucinação."
              color={COLORS.blue}
            />
            <FeatureRow
              icon={ShieldCheck}
              title="Validação farmacêutica"
              desc="Revisão antes da dispensação, com flag de Alto Alerta."
              color={COLORS.orange}
            />
            <FeatureRow
              icon={ClipboardList}
              title="Evolução SOAP + SAPS 3"
              desc="Padronização clínica com escore de gravidade integrado."
              color={COLORS.red}
            />
          </div>
        </div>
      </div>
    ),
  },

  // 7 — INTELIGÊNCIA CLÍNICA (IA)
  {
    id: 7,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.blue}>Inteligência Clínica</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            IA assistiva — apoio à decisão, sem substituir o médico
          </h2>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-6">
          {[
            { i: Brain, t: "Interações medicamentosas", d: "Análise automática de toda a prescrição com base em fontes clínicas reconhecidas.", c: COLORS.blue },
            { i: Sparkles, t: "Sugestões posológicas", d: "2-3 opções com rationale e fonte (UpToDate, AMIB, KDIGO, ACLS).", c: COLORS.green },
            { i: Stethoscope, t: "Protocolos clínicos", d: "25 guias UTI: sepse, choque séptico, neurocrítico, paliativos.", c: COLORS.orange },
            { i: Activity, t: "Escores integrados", d: "SAPS 3, NEWS2, Manchester — calculados em tempo real.", c: COLORS.red },
            { i: ClipboardList, t: "Templates terapêuticos", d: "Modelos por especialidade, editáveis pelo corpo clínico.", c: COLORS.yellow },
            { i: ShieldCheck, t: "Alertas clínicos", d: "Vigilância automática de pendências, gravíssimo e tempo de internação.", c: COLORS.blue },
          ].map((m) => (
            <div key={m.t} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-white"
                style={{ background: m.c }}
              >
                <m.i className="h-6 w-6" />
              </div>
              <p className="text-base font-bold uppercase tracking-wide text-slate-900">{m.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.d}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // 8 — NIR — DESTAQUE
  {
    id: 8,
    variant: "dark",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-16 text-white">
        <div className="flex items-center justify-between">
          <SectionTag color={COLORS.yellow}>Destaque Estratégico</SectionTag>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
            Núcleo Interno de Regulação
          </p>
        </div>
        <div>
          <h2 className="text-6xl font-black leading-[1.05] tracking-tight">
            NIR — o cérebro
            <br />
            regulatório do <span style={{ color: COLORS.yellow }}>Socorrão I</span>
          </h2>
          <p className="mt-5 max-w-3xl text-xl font-light leading-relaxed text-white/75">
            Um módulo desenhado para dar à regulação o mesmo nível de
            visibilidade e controle que a assistência já tem.
          </p>
        </div>
        <div className="grid flex-1 grid-cols-3 items-end gap-6">
          {[
            { v: "9", l: "Sub-módulos integrados" },
            { v: "8", l: "Status de leito rastreáveis" },
            { v: "100%", l: "Trilha de auditoria" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur">
              <p className="text-6xl font-black tracking-tight" style={{ color: COLORS.yellow }}>
                {s.v}
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                {s.l}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // 9 — NIR — POTENCIAL DE EXPANSÃO
  {
    id: 9,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.blue}>NIR • Potencial de Expansão</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            De controle de leitos a hub regulatório do município
          </h2>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-8">
          <div className="rounded-2xl border-2 border-slate-200 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Hoje</p>
            <p className="mt-2 text-2xl font-black text-slate-900">Regulação interna</p>
            <ul className="mt-5 space-y-3 text-sm text-slate-700">
              {[
                "Mapa de leitos integrado em tempo real",
                "Solicitações UE → UTI com SLA",
                "Controle de altas e desfechos",
                "Auditoria completa de movimentações",
                "KPIs de ocupação, LOS e produção",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" style={{ color: COLORS.green }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div
            className="rounded-2xl p-6 text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${COLORS.blue}, #021f4d)` }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Roadmap</p>
            <p className="mt-2 text-2xl font-black">Hub regulatório municipal</p>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                "Integração com Central de Regulação SES/SMS",
                "Fila única municipal de UTI e enfermaria",
                "Transferências interhospitalares rastreadas",
                "Painel de governança para a Secretaria",
                "API pública para SAMU, UPAs e UBSs",
                "Cuidados continuados e contra-referência",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4 flex-none" style={{ color: COLORS.yellow }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    ),
  },

  // 10 — GESTÃO EXECUTIVA
  {
    id: 10,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div className="grid flex-1 grid-cols-12 gap-10">
          <div className="col-span-6 flex flex-col justify-center">
            <SectionTag color={COLORS.orange}>Gestão Executiva</SectionTag>
            <h2 className="mt-4 text-5xl font-black leading-tight tracking-tight text-slate-900">
              Visão de comando para a Direção
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              Painéis executivos consolidados sobre todos os setores — sem
              esperar relatórios mensais ou planilhas paralelas.
            </p>
            <ul className="mt-6 space-y-3 text-base text-slate-700">
              {[
                "Ocupação por setor em tempo real",
                "Produção médica individualizada",
                "Tempo médio de permanência (LOS)",
                "Mortalidade, alta e desfechos",
                "Fila NIR e SLA de triagem",
                "Indicadores CCIH e cultura microbiológica",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 flex-none" style={{ color: COLORS.green }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-6 grid grid-cols-2 gap-4 self-center">
            <StatCard value="47" label="Tipos de relatórios" color={COLORS.blue} />
            <StatCard value="6" label="Painéis executivos" color={COLORS.orange} />
            <StatCard value="11" label="Perfis de acesso" color={COLORS.green} />
            <StatCard value="0" label="Planilhas paralelas" color={COLORS.red} />
          </div>
        </div>
      </div>
    ),
  },

  // 11 — CONFORMIDADE & SEGURANÇA
  {
    id: 11,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.red}>Conformidade & Segurança</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            Construído para auditoria, LGPD e Norma Zero
          </h2>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-6">
          <div className="space-y-5">
            <FeatureRow
              icon={ShieldCheck}
              title="Norma Zero MAN.05-001"
              desc="Identidade visual, codificação e impressão padronizadas."
              color={COLORS.red}
            />
            <FeatureRow
              icon={Lock}
              title="LGPD (Lei 13.709/2018)"
              desc="Consentimento, exportação e exclusão de dados do paciente."
              color={COLORS.blue}
            />
            <FeatureRow
              icon={ClipboardList}
              title="CFM 1.821/2007"
              desc="Prontuário eletrônico com integridade, autenticidade e rastreabilidade."
              color={COLORS.green}
            />
            <FeatureRow
              icon={Users}
              title="Perfis & permissões"
              desc="11 perfis de acesso, com escopo por setor e unidade hospitalar."
              color={COLORS.orange}
            />
          </div>
          <div className="rounded-2xl bg-slate-900 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Trilha de auditoria
            </p>
            <p className="mt-3 text-3xl font-black leading-tight">
              Cada clique, cada prescrição, cada movimentação <span style={{ color: COLORS.yellow }}>fica registrada</span>.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              {[
                ["15", "tabelas auditadas"],
                ["100%", "RLS ativo"],
                ["JSONB", "versionamento"],
                ["A4", "impressão Norma Zero"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-black" style={{ color: COLORS.yellow }}>{v}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-white/60">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // 12 — INTEGRAÇÃO ENTRE SETORES
  {
    id: 12,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.green}>Jornada Integrada</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            Da porta de entrada à alta — sem rupturas
          </h2>
        </div>
        <div className="flex flex-1 items-center">
          <div className="grid w-full grid-cols-7 items-center gap-2">
            {[
              { t: "Recepção", c: COLORS.blue, i: Users },
              { t: "Triagem", c: COLORS.yellow, i: Activity },
              { t: "Emergência", c: COLORS.red, i: Stethoscope },
              { t: "UTI / Enf.", c: COLORS.orange, i: Hospital },
              { t: "Exames", c: COLORS.green, i: ClipboardList },
              { t: "NIR", c: COLORS.blue, i: Network },
              { t: "Alta / Desfecho", c: COLORS.green, i: CheckCircle2 },
            ].map((step, i, arr) => (
              <div key={step.t} className="flex items-center">
                <div className="flex flex-1 flex-col items-center gap-3">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-2xl text-white shadow-lg"
                    style={{ background: step.c }}
                  >
                    <step.i className="h-9 w-9" />
                  </div>
                  <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-700">
                    {step.t}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="h-5 w-5 flex-none text-slate-300" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-700">
          O <strong>histórico longitudinal do paciente</strong> acompanha toda a jornada — do
          primeiro atendimento à alta — em um único prontuário auditável.
        </div>
      </div>
    ),
  },

  // 13 — BENEFÍCIOS POR PERFIL
  {
    id: 13,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.blue}>Benefícios por Perfil</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            Cada papel, uma experiência sob medida
          </h2>
        </div>
        <div className="grid flex-1 grid-cols-4 gap-5">
          {[
            { t: "Médicos", c: COLORS.red, items: ["Painel clínico unificado", "Prescrição com IA", "Evolução SOAP", "Atalhos de teclado"] },
            { t: "Enfermagem", c: COLORS.green, items: ["Round multiprofissional", "Cuidados padronizados", "Sinais vitais & NEWS2", "Aprazamento"] },
            { t: "Farmácia", c: COLORS.orange, items: ["Validação farmacêutica", "Catálogo HMDM 2026", "Alto Alerta", "Visão por leito"] },
            { t: "Direção / NIR", c: COLORS.blue, items: ["Painel do gestor", "47 relatórios", "KPIs em tempo real", "Auditoria total"] },
          ].map((p) => (
            <div key={p.t} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div
                className="mb-3 inline-flex rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ background: p.c }}
              >
                {p.t}
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" style={{ color: p.c }} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // 14 — ROADMAP DE IMPLANTAÇÃO
  {
    id: 14,
    variant: "light",
    render: () => (
      <div className="flex h-full flex-col gap-8 p-14">
        <InstitutionalHeader />
        <div>
          <SectionTag color={COLORS.orange}>Roadmap de Implantação</SectionTag>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            De um setor-piloto à operação completa
          </h2>
        </div>
        <div className="grid flex-1 grid-cols-4 gap-5">
          {[
            { f: "Fase 1", t: "Piloto UTI 2", d: "Implantação real com pacientes ativos. Em curso.", c: COLORS.green, on: true },
            { f: "Fase 2", t: "UTI 1 + UCI", d: "Expansão para todos os leitos críticos.", c: COLORS.orange, on: false },
            { f: "Fase 3", t: "Emergência + NIR", d: "Triagem, UE Vertical/Horizontal e regulação interna.", c: COLORS.blue, on: false },
            { f: "Fase 4", t: "Hospital completo", d: "Enfermarias, farmácia, CCIH, exames e gestão.", c: COLORS.red, on: false },
          ].map((p, i) => (
            <div
              key={p.f}
              className={`flex flex-col rounded-2xl border-2 p-5 ${
                p.on ? "shadow-lg" : "border-slate-200 bg-white"
              }`}
              style={p.on ? { borderColor: p.c, background: `${p.c}10` } : {}}
            >
              <div className="flex items-center justify-between">
                <span
                  className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ background: p.c }}
                >
                  {p.f}
                </span>
                <span className="text-3xl font-black text-slate-300">0{i + 1}</span>
              </div>
              <p className="mt-4 text-lg font-bold text-slate-900">{p.t}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{p.d}</p>
              {p.on && (
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: p.c }}>
                  ● Em andamento
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // 15 — ENCERRAMENTO
  {
    id: 15,
    variant: "dark",
    render: () => (
      <div className="relative flex h-full flex-col justify-between p-16 text-white">
        <div className="flex items-center gap-4">
          <img
            src={whitelabel.logos.hospital}
            alt="Socorrão I"
            className="h-14 w-14 rounded-md object-cover ring-1 ring-white/20"
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              {whitelabel.print.institutionalHeader.line2}
            </p>
            <p className="text-sm font-bold uppercase tracking-wide text-white">
              {whitelabel.institution.hospitalShortName}
            </p>
          </div>
        </div>

        <div className="max-w-4xl">
          <SectionTag color={COLORS.yellow}>Próximo passo</SectionTag>
          <h2 className="mt-6 text-7xl font-black leading-[1.02] tracking-tight">
            Pronto para
            <br />
            <span style={{ color: COLORS.yellow }}>homologação oficial</span>.
          </h2>
          <p className="mt-6 max-w-3xl text-xl font-light leading-relaxed text-white/80">
            A plataforma já está implantada no piloto da UTI 2 com pacientes
            reais. Solicitamos o aval das coordenações e da Direção para
            seguir com a expansão institucional.
          </p>
          <div className="mt-10 flex items-center gap-1">
            <span className="block h-2 w-20 rounded-full" style={{ background: COLORS.red }} />
            <span className="block h-2 w-20 rounded-full" style={{ background: COLORS.orange }} />
            <span className="block h-2 w-20 rounded-full" style={{ background: COLORS.yellow }} />
            <span className="block h-2 w-20 rounded-full" style={{ background: COLORS.green }} />
            <span className="block h-2 w-20 rounded-full" style={{ background: COLORS.blue }} />
          </div>
        </div>

        <div className="flex items-end justify-between text-xs uppercase tracking-widest text-white/50">
          <div>
            <p className="text-white/70">Direção Geral: {whitelabel.institution.directorGeneral}</p>
            <p>Qualidade: {whitelabel.institution.qualityCoordinator}</p>
          </div>
          <div className="text-right">
            <p className="text-white/40">Plataforma desenvolvida em parceria</p>
            <p className="text-sm font-bold tracking-[0.2em] text-white/80">
              ARSEN × HMDM
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

// --- Página principal ---------------------------------------

export default function ApresentacaoPage() {
  const [index, setIndex] = useState(0);
  const [isFs, setIsFs] = useState(false);

  const total = slides.length;
  const slide = slides[index];

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  const toggleFs = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key.toLowerCase() === "f") {
        toggleFs();
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(total - 1);
      }
    };
    const onFs = () => setIsFs(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [next, prev, toggleFs, total]);

  const bg = useMemo(
    () =>
      slide.variant === "dark"
        ? whitelabel.theme.bgGradient
        : "bg-gradient-to-br from-slate-50 via-white to-blue-50",
    [slide.variant]
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Slide canvas — proporção 16:9 */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div
          className={`relative aspect-[16/9] w-full max-w-[1600px] overflow-hidden rounded-none shadow-2xl ${bg}`}
          style={{ maxHeight: "calc(100vh - 64px)" }}
        >
          {slide.render()}

          {/* Rodapé Arsen discreto */}
          <div
            className={`absolute bottom-3 left-6 text-[9px] font-semibold uppercase tracking-[0.22em] ${
              slide.variant === "dark" ? "text-white/30" : "text-slate-400"
            }`}
          >
            Plataforma Arsen • desenvolvida para o {whitelabel.institution.hospitalAbbreviation}
          </div>
          <div
            className={`absolute bottom-3 right-6 text-[10px] font-bold tracking-widest ${
              slide.variant === "dark" ? "text-white/40" : "text-slate-500"
            }`}
          >
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* Barra de controles */}
      <div className="flex h-16 items-center justify-between border-t border-white/10 bg-black px-6 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            disabled={index === 0}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 transition hover:bg-white/10 disabled:opacity-30"
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            disabled={index === total - 1}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 transition hover:bg-white/10 disabled:opacity-30"
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="ml-3 text-xs uppercase tracking-[0.2em] text-white/50">
            ← → ESPAÇO  •  F fullscreen
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center gap-1.5 px-8">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-8 bg-white" : "w-3 bg-white/25 hover:bg-white/45"
              }`}
              aria-label={`Ir para slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={toggleFs}
          className="flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 text-xs font-semibold uppercase tracking-wider transition hover:bg-white/10"
        >
          {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isFs ? "Sair" : "Tela cheia"}
        </button>
      </div>
    </div>
  );
}
