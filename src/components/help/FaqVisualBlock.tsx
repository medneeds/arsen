/**
 * Renderiza as "telas didáticas" sintéticas usadas dentro de cada slide do
 * HelpSlideshowDialog. Reproduz visualmente padrões reais da plataforma
 * (card de leito, menu de movimentação, abas do cockpit, etc.) sem depender
 * de screenshots estáticos — assim continua refletindo o design tokens atual.
 */
import { ArrowLeftRight, LogOut, FileSignature } from "lucide-react";
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
      ? { text: "TRANSF. INT", className: "bg-warning/15 text-warning-on-soft border-warning/30" }
      : status === "dischargePending"
        ? { text: "ALTA SINALIZADA", className: "bg-released/15 text-released-on-soft border-released/30" }
        : null;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {tarja && (
          <div className={cn("text-xs font-medium tracking-wider px-3 py-1 border-b", tarja.className)}>
            {tarja.text}
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-released" />
            <span className="font-medium text-sm">{bedLabel}</span>
            <span className="text-xs text-muted-foreground">UTI 1</span>
          </div>
          <button
            type="button"
            className={cn(
              "h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-background transition-all",
              highlightMenu && "ring-2 ring-ring ring-offset-2 ring-offset-background animate-pulse",
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-foreground" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          <div className="text-sm font-medium">JOÃO DA SILVA</div>
          <div className="text-xs text-muted-foreground">PRONT. 26-001-000142-7 · ADMITIDO HÁ 3 DIAS</div>
          <div className="flex gap-2 pt-1">
            <span className="text-xs px-2 py-1 rounded-md bg-primary/15 text-foreground">ADMITIDO</span>
            <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">SOFA 4</span>
          </div>
        </div>
      </div>
      {highlightMenu && (
        <p className="text-xs text-center text-muted-foreground mt-2">
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
    <div className="mx-auto w-full max-w-xs rounded-lg border border-border bg-popover shadow-md p-2">
      <div className="px-2 py-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
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
                "flex items-center gap-3 rounded-md px-3 py-2 border border-transparent transition-all",
                item.emphasis &&
                  (color === "emerald"
                    ? "border-released-border/60 bg-released-soft/60 ring-2 ring-released/40"
                    : "border-border/60 bg-muted/60 ring-2 ring-ring/40"),
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md",
                  color === "indigo"
                    ? "bg-muted"
                    : "bg-released-soft",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    color === "indigo" ? "text-foreground" : "text-released-on-soft",
                  )}
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium leading-tight">{item.label}</span>
                {item.sub && (
                  <span className="text-xs text-muted-foreground leading-tight">{item.sub}</span>
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
    <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border/60 bg-muted/30">
        <div className="text-xs font-medium">COCKPIT DO PACIENTE</div>
        <div className="text-xs text-muted-foreground">JOÃO DA SILVA · L05 · UTI 1</div>
      </div>
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border/60 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t === activeTab;
          const isHighlight = t === highlight;
          return (
            <div
              key={t}
              className={cn(
                "text-xs px-3 py-1 rounded-md whitespace-nowrap transition-all",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted",
                isHighlight && !isActive && "ring-2 ring-released/50",
                isHighlight && "shadow-sm",
              )}
            >
              {t}
            </div>
          );
        })}
      </div>
      <div className="p-4 text-xs text-muted-foreground">
        Conteúdo da aba <span className="font-medium text-foreground">{activeTab}</span>…
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
      ? "border-warning/40 bg-warning/5"
      : tone === "danger"
        ? "border-critical/40 bg-critical/5"
        : tone === "success"
          ? "border-released/40 bg-released/5"
          : "border-border bg-card";
  const primaryColor =
    tone === "warning"
      ? "bg-warning hover:bg-warning text-white"
      : tone === "danger"
        ? "bg-critical hover:bg-critical text-white"
        : "bg-primary text-primary-foreground";

  return (
    <div className={cn("mx-auto w-full max-w-sm rounded-lg border shadow-md overflow-hidden", accent)}>
      <div className="px-4 py-3 border-b border-border/60">
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {bodyLines.map((line, i) => (
          <div key={i} className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
            {line}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 flex justify-end gap-2 border-t border-border/60">
        {secondary && (
          <button className="text-xs px-3 py-2 rounded-md border border-border bg-background hover:bg-muted">
            {secondary}
          </button>
        )}
        <button className={cn("text-xs px-3 py-2 rounded-md font-medium", primaryColor)}>
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
      <div className="rounded-lg border border-border/30 bg-primary/5 p-3 text-center">
        <div className="text-xs font-medium tracking-wider text-foreground uppercase mb-2">Mapa de Leitos</div>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={cn("aspect-square rounded-md border", i === 4 ? "bg-released/30 border-released/50" : "bg-background border-border/60")} />
          ))}
        </div>
        <div className="text-xs text-muted-foreground">Ocupação física</div>
      </div>
      <div className="rounded-lg border border-released/30 bg-released/5 p-3 text-center">
        <div className="text-xs font-medium tracking-wider text-released-on-soft uppercase mb-2">Painel Clínico</div>
        <div className="space-y-1 mb-2">
          <div className="h-1.5 rounded-md bg-released/30" />
          <div className="h-1.5 rounded-md bg-released/20" />
          <div className="h-1.5 rounded-md bg-released/30 w-2/3" />
          <div className="flex items-center justify-center pt-1">
            <FileSignature className="h-5 w-5 text-released-on-soft" />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Conduta clínica</div>
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
    <div className="mx-auto w-full max-w-sm space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2">
          <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: it.color }} />
          <div className="text-xs font-medium">{it.label}</div>
          <div className="text-xs text-muted-foreground">— {it.meaning}</div>
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
            <div className="text-xs font-semibold text-primary mb-1">{i + 1}</div>
            <div className="text-xs font-medium leading-tight">{s.label}</div>
            {s.sub && <div className="text-xs text-muted-foreground leading-tight mt-1">{s.sub}</div>}
          </div>
          {i < steps.length - 1 && <div className="text-muted-foreground">→</div>}
        </div>
      ))}
    </div>
  );
}
