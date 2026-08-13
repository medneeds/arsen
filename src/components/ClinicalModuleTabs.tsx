import React, { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Pill, NotebookPen, FileText, FolderOpen, Clock, Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnsavedPrescription } from "@/contexts/UnsavedPrescriptionContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MODULE_TABS = [
  { label: "Prescrição", path: "/prescricao", icon: Pill },
  { label: "Evolução", path: "/evolucao", icon: NotebookPen },
  { label: "Requisições", path: "/requisicoes", icon: FileText },
  { label: "Monitoramento", path: "/monitoramento", icon: Activity },
  { label: "Docs", path: "/documentos", icon: FolderOpen },
  { label: "Histórico", path: "/historico-paciente", icon: Clock },
];

interface ClinicalModuleTabsProps {
  variant?: "default" | "dark";
}

/**
 * Tabs for switching between clinical modules (Prescrição, Evolução, Requisições, Docs)
 * while preserving patient context via URL search params.
 * Intercepta navegação quando há alterações não salvas na prescrição.
 */
export function ClinicalModuleTabs({ variant = "dark" }: ClinicalModuleTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDirty, onSaveDraft } = useUnsavedPrescription();
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
    if (isDirty && location.pathname === "/prescricao") {
      setPendingUrl(url);
    } else {
      navigate(url);
    }
  };

  return (
    <>
      <div className={cn(
        "flex gap-1 rounded-lg p-1 border",
        variant === "dark"
          ? "bg-white/10 border-white/30 shadow-inner"
          : "bg-muted border-border/60"
      )}>
        {MODULE_TABS.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => handleTabClick(tab.path)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide transition-all duration-150",
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
          );
        })}
      </div>

      {/* Pop-up de alterações não salvas */}
      <AlertDialog open={!!pendingUrl} onOpenChange={(open) => { if (!open) setPendingUrl(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              Prescrição com alterações não salvas
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Você tem alterações na prescrição que ainda não foram salvas. Deseja salvar um rascunho antes de sair?
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
