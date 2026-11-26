import React, { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Pill, Pencil, FileText, FolderOpen, Clock, Activity, AlertTriangle, Stethoscope, ArrowLeftRight, Apple, Wind, ClipboardCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnsavedPrescription } from "@/contexts/UnsavedPrescriptionContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { visibleMultiModules, MULTI_NEW_BADGE_UNTIL, type MultiModuleKey } from "@/config/multiModules";

const MODULE_TABS = [
  { label: "Admissão", path: "/admissao", icon: Stethoscope },
  { label: "Prescrição", path: "/prescricao", icon: Pill },
  { label: "Evolução", path: "/evolucao", icon: Pencil },
  { label: "Requisições", path: "/requisicoes", icon: FileText },
  { label: "Monitoramento", path: "/monitoramento", icon: Activity },
  { label: "Docs", path: "/documentos", icon: FolderOpen },
  { label: "Movimentação", path: "/movimentar", icon: ArrowLeftRight },
  { label: "Histórico", path: "/historico-paciente", icon: Clock },
];

/** Icones dos modulos multiprofissionais (definicao dos modulos em config/multiModules). */
const MULTI_ICONS: Record<MultiModuleKey, LucideIcon> = {
  nutricao: Apple,
  fisioterapia: Wind,
  enfermagem: ClipboardCheck,
};

interface TabDef { label: string; path: string; icon: LucideIcon; multi?: boolean; firstMulti?: boolean }

interface ClinicalModuleTabsProps {
  variant?: "default" | "dark";
  /** "pill" = botoes agrupados (padrao); "bar" = linha de largura total com sublinhado na aba ativa. */
  layout?: "pill" | "bar";
}

/**
 * Tabs for switching between clinical modules (Prescrição, Evolução, Requisições, Docs)
 * while preserving patient context via URL search params.
 * Intercepta navegação quando há alterações não salvas na prescrição.
 */
export function ClinicalModuleTabs({ variant = "dark", layout = "pill" }: ClinicalModuleTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDirty, onSaveDraft, dirtyLabel } = useUnsavedPrescription();
  const { role } = useAuth();
  // Modulos multiprofissionais: so com a chave ligada e para os papeis do modulo.
  // Desligada, a lista e EXATAMENTE a de antes (cabecalho da prescricao inalterado).
  const multiTabs: TabDef[] = visibleMultiModules(role).map((m, i) => ({
    label: m.label, path: m.path, icon: MULTI_ICONS[m.key], multi: true, firstMulti: i === 0,
  }));
  const tabs: TabDef[] = [...MODULE_TABS, ...multiTabs];
  const showNewBadge = Date.now() < MULTI_NEW_BADGE_UNTIL.getTime();
  const isActivePath = (p: string) => location.pathname === p || location.pathname.startsWith(`${p}/`);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Build query string preserving patient context
  const patientParams = new URLSearchParams();
  const keysToPreserve = ["patientId", "patientName", "patientBed", "patientSector"];
  keysToPreserve.forEach(key => {
    const val = searchParams.get(key);
    if (val) patientParams.set(key, val);
  });
  const queryString = patientParams.toString();
  const hasPatient = !!searchParams.get("patientName");

  // Only show when we have patient context
  if (!hasPatient) return null;

  const handleTabClick = (path: string) => {
    const url = `${path}${queryString ? `?${queryString}` : ""}`;
    // Intercepta se isDirty em qualquer página clínica (prescrição ou evolução)
    if (isDirty) {
      setPendingUrl(url);
    } else {
      navigate(url);
    }
  };

  return (
    <>
      {layout === "bar" ? (
        <div
          role="tablist"
          className={cn(
            "flex w-full border-t",
            variant === "dark" ? "border-white/25" : "border-border/60"
          )}
        >
          {tabs.map((tab, i) => {
            const isActive = isActivePath(tab.path);
            return (
              <button
                key={tab.path}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabClick(tab.path)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 px-3 py-3.5 text-[11px] font-semibold tracking-wide border-b-[3px] transition-colors duration-150",
                  // divisoria discreta e CURTA (inset, centrada) entre as abas — nao full-height.
                  i > 0 && "before:absolute before:left-0 before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2",
                  i > 0 && (variant === "dark" ? "before:bg-white/15" : "before:bg-border/50"),
                  // divisor mais marcado antes do primeiro modulo multiprofissional
                  tab.firstMulti && "before:h-6 before:w-0.5",
                  tab.firstMulti && (variant === "dark" ? "before:bg-white/40" : "before:bg-border"),
                  variant === "dark"
                    ? isActive
                      ? "bg-white/15 text-white border-white"
                      : "text-white/85 border-transparent hover:bg-white/10 hover:text-white"
                    : isActive
                      ? "bg-primary/10 text-primary border-primary"
                      : "text-foreground/75 border-transparent hover:bg-muted hover:text-foreground"
                )}
              >
                <tab.icon className="h-[13px] w-[13px] shrink-0" />
                <span>{tab.label}</span>
                {tab.multi && showNewBadge && (
                  <span className={cn(
                    "rounded px-1 py-px text-[9px] font-bold leading-none tracking-wider",
                    variant === "dark" ? "bg-white/25 text-white" : "bg-accent text-accent-foreground",
                  )}>NOVO</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
      <div className={cn(
        "flex gap-1 rounded-lg p-1 border",
        variant === "dark"
          ? "bg-white/10 border-white/30 shadow-inner"
          : "bg-muted border-border/60"
      )}>
        {tabs.map(tab => {
          const isActive = isActivePath(tab.path);
          return (
            <React.Fragment key={tab.path}>
            {tab.firstMulti && <span aria-hidden className={cn("mx-0.5 w-px self-stretch", variant === "dark" ? "bg-white/40" : "bg-border")} />}
            <button
              key={tab.path}
              onClick={() => handleTabClick(tab.path)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium tracking-wide transition-all duration-150",
                variant === "dark"
                  ? isActive
                    ? "bg-white text-primary shadow-md ring-2 ring-white/50"
                    : "bg-white/22 text-white shadow-sm ring-1 ring-white/40 hover:bg-white/35 hover:ring-white/60 hover:shadow-md"
                  : isActive
                    ? "bg-background text-primary shadow-sm ring-1 ring-primary/20"
                    : "bg-background/80 text-foreground hover:bg-background hover:text-primary ring-1 ring-border/60"
              )}
            >
              <tab.icon className={cn("h-3.5 w-3.5 shrink-0", variant === "dark" && !isActive && "text-white/90")} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
            </React.Fragment>
          );
        })}
      </div>
      )}

      {/* Pop-up de alterações não salvas */}
      <AlertDialog open={!!pendingUrl} onOpenChange={(open) => { if (!open) setPendingUrl(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              {cap(dirtyLabel)} com alterações não salvas
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Você tem alterações na {dirtyLabel} que ainda não foram salvas. Deseja salvar um rascunho antes de sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <AlertDialogAction
              className="w-full"
              onClick={async () => {
                if (onSaveDraft) {
                  try {
                    await onSaveDraft();
                    toast.success("Rascunho salvo");
                  } catch {
                    toast.error("Não foi possível salvar o rascunho");
                  }
                }
                if (pendingUrl) navigate(pendingUrl);
                setPendingUrl(null);
              }}
            >
              Salvar rascunho e sair
            </AlertDialogAction>
            <AlertDialogCancel
              className="w-full"
              onClick={() => {
                if (pendingUrl) navigate(pendingUrl);
                setPendingUrl(null);
              }}
            >
              Sair sem salvar
            </AlertDialogCancel>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => setPendingUrl(null)}
            >
              Cancelar — continuar editando
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
