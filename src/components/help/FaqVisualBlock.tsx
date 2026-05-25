/**
 * Renderiza as "telas didáticas" sintéticas usadas dentro de cada slide do
 * HelpSlideshowDialog. Reproduz visualmente padrões reais da plataforma
 * (card de leito, menu de movimentação, abas do cockpit, etc.) sem depender
 * de screenshots estáticos — assim continua refletindo o design tokens atual.
 */
import { ArrowLeftRight, LogOut, MoreHorizontal, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FaqVisual } from "@/data/faqContent";

interface Props {
  visual: FaqVisual;
}

export function FaqVisualBlock({ visual }: Props) {
  switch (visual.kind) {
    case "bedCard":
      return <BedCardMock {...visual} />;
    case "menuActions":
      return <MenuActionsMock items={visual.items} />;
    case "cockpitTabs":
      return <CockpitTabsMock {...visual} />;
    case "dialog":
      return <DialogMock {...visual} />;
    case "panelVsMap":
      return <PanelVsMapMock />;
    case "statusLegend":
      return <StatusLegendMock items={visual.items} />;
    case "stepFlow":
      return <StepFlowMock steps={visual.steps} />;
    default:
      return null;
  }
}

/* --------------------------------- Card --------------------------------- */
function BedCardMock({
  bedLabel,
  status,
  highlightMenu,
}: {
  bedLabel: string;
  status?: "ok" | "transferPending" | "dischargePending";
  highlightMenu?: boolean;
}) {
  const tarja =
    status === "transferPending"
      ? { text: "TRANSF. INT", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" }
      : status === "dischargePending"
        ? { text: "ALTA SINALIZADA", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" }
        : null;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {tarja && (
          <div className={cn("text-[10px] font-semibold tracking-wider px-3 py-1 border-b", tarja.className)}>
            {tarja.text}
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-sm">{bedLabel}</span>
            <span className="text-[10px] text-muted-foreground">UTI 1</span>
          </div>
          <button
            type="button"
            className={cn(
              "h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-background transition-all",
              highlightMenu && "ring-2 ring-indigo-400 ring-offset-2 ring-offset-background animate-pulse",
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          <div className="text-sm font-medium">JOÃO DA SILVA</div>
          <div className="text-[11px] text-muted-foreground">PRONT. 26-001-000142-7 · ADMITIDO HÁ 3 DIAS</div>
          <div className="flex gap-1.5 pt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">ADMITIDO</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">SOFA 4</span>
          </div>
        </div>
      </div>
      {highlightMenu && (
        <p className="text-[11px] text-center text-muted-foreground mt-2">
          ↑ Clique no ícone de movimentação
        </p>
      )}
    </div>
  );
}

/* ----------------------------- Menu de ações ----------------------------- */
function MenuActionsMock({
  items,
}: {
  items: { icon: "ArrowLeftRight" | "LogOut"; label: string; sub?: string; emphasis?: boolean }[];
}) {
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl border border-border bg-popover shadow-lg p-1.5">
      <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        Movimentação do leito
      </div>
      <div className="space-y-1">
        {items.map((item, i) => {
          const Icon = item.icon === "ArrowLeftRight" ? ArrowLeftRight : LogOut;
          const color = item.icon === "ArrowLeftRight" ? "indigo" : "emerald";
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 border border-transparent transition-all",
                item.emphasis &&
                  (color === "emerald"
                    ? "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-400/40"
                    : "border-indigo-300/60 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-400/40"),
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md",
                  color === "indigo"
                    ? "bg-indigo-100 dark:bg-indigo-950/60"
                    : "bg-emerald-100 dark:bg-emerald-950/60",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    color === "indigo" ? "text-indigo-700 dark:text-indigo-300" : "text-emerald-700 dark:text-emerald-300",
                  )}
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium leading-tight">{item.label}</span>
                {item.sub && (
                  <span className="text-[10px] text-muted-foreground leading-tight">{item.sub}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Cockpit tabs ----------------------------- */
function CockpitTabsMock({
  tabs,
  activeTab,
  highlight,
}: {
  tabs: string[];
  activeTab: string;
  highlight?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border/60 bg-muted/30">
        <div className="text-xs font-semibold">COCKPIT DO PACIENTE</div>
        <div className="text-[10px] text-muted-foreground">JOÃO DA SILVA · L05 · UTI 1</div>
      </div>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/60 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t === activeTab;
          const isHighlight = t === highlight;
          return (
            <div
              key={t}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-md whitespace-nowrap transition-all",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted",
                isHighlight && !isActive && "ring-2 ring-emerald-400/50",
                isHighlight && "shadow-sm",
              )}
            >
              {t}
            </div>
          );
        })}
      </div>
      <div className="p-4 text-[11px] text-muted-foreground">
        Conteúdo da aba <span className="font-semibold text-foreground">{activeTab}</span>…
      </div>
    </div>
  );
}

/* ---------------------------------- Dialog --------------------------------- */
function DialogMock({
  title,
  bodyLines,
  primary,
  secondary,
  tone,
}: {
  title: string;
  bodyLines: string[];
  primary: string;
  secondary?: string;
  tone?: "neutral" | "info" | "warning" | "success" | "danger";
}) {
  const accent =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "danger"
        ? "border-red-500/40 bg-red-500/5"
        : tone === "success"
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-card";
  const primaryColor =
    tone === "warning"
      ? "bg-amber-600 hover:bg-amber-700 text-white"
      : tone === "danger"
        ? "bg-red-600 hover:bg-red-700 text-white"
        : "bg-primary text-primary-foreground";

  return (
    <div className={cn("mx-auto w-full max-w-sm rounded-xl border shadow-lg overflow-hidden", accent)}>
      <div className="px-4 py-3 border-b border-border/60">
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {bodyLines.map((line, i) => (
          <div key={i} className="rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground">
            {line}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 flex justify-end gap-2 border-t border-border/60">
        {secondary && (
          <button className="text-[11px] px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted">
            {secondary}
          </button>
        )}
        <button className={cn("text-[11px] px-3 py-1.5 rounded-md font-medium", primaryColor)}>
          {primary}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Painel vs Mapa ----------------------------- */
function PanelVsMapMock() {
  return (
    <div className="mx-auto w-full max-w-md grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 text-center">
        <div className="text-[10px] font-semibold tracking-wider text-blue-700 dark:text-blue-300 uppercase mb-2">Mapa de Leitos</div>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={cn("aspect-square rounded border", i === 4 ? "bg-emerald-500/30 border-emerald-500/50" : "bg-background border-border/60")} />
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground">Ocupação física</div>
      </div>
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
        <div className="text-[10px] font-semibold tracking-wider text-emerald-700 dark:text-emerald-300 uppercase mb-2">Painel Clínico</div>
        <div className="space-y-1 mb-2">
          <div className="h-1.5 rounded bg-emerald-500/30" />
          <div className="h-1.5 rounded bg-emerald-500/20" />
          <div className="h-1.5 rounded bg-emerald-500/30 w-2/3" />
          <div className="flex items-center justify-center pt-1">
            <FileSignature className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">Conduta clínica</div>
      </div>
    </div>
  );
}

/* ------------------------------ Status legend ----------------------------- */
function StatusLegendMock({
  items,
}: {
  items: { color: string; label: string; meaning: string }[];
}) {
  return (
    <div className="mx-auto w-full max-w-sm space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card px-2.5 py-1.5">
          <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: it.color }} />
          <div className="text-[11px] font-semibold">{it.label}</div>
          <div className="text-[11px] text-muted-foreground">— {it.meaning}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Step flow ------------------------------- */
function StepFlowMock({ steps }: { steps: { label: string; sub?: string }[] }) {
  return (
    <div className="mx-auto w-full max-w-md flex items-center justify-between gap-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div className="flex-1 rounded-lg border border-border bg-card px-2 py-2 text-center">
            <div className="text-[10px] font-bold text-primary mb-0.5">{i + 1}</div>
            <div className="text-[11px] font-semibold leading-tight">{s.label}</div>
            {s.sub && <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.sub}</div>}
          </div>
          {i < steps.length - 1 && <div className="text-muted-foreground">→</div>}
        </div>
      ))}
    </div>
  );
}
