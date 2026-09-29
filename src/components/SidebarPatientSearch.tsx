import { useState } from "react";
import { Search, FileSearch } from "lucide-react";
import { PatientSearchDialog } from "@/components/PatientSearchDialog";

/**
 * Atalho de busca de paciente na sidebar. Só abre o PatientSearchDialog, que
 * reusa a busca da tela inicial — a sidebar não tem consulta própria, então não
 * pode divergir dela.
 */
export function SidebarPatientSearch({
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {isCollapsed ? (
        <div className="px-0 flex justify-center py-2 border-b border-border/50">
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Procurar paciente"
            aria-label="Procurar paciente"
            className="h-7 w-7 flex items-center justify-center rounded-md bg-muted/40 hover:bg-primary/10 hover:text-primary text-foreground/70 ring-1 ring-border/40 transition-colors"
          >
            <FileSearch className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Buscar Paciente
            </span>
            <div className="flex-1 h-px bg-primary/30" />
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Procurar paciente"
            className="w-full h-7 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 text-xs text-muted-foreground hover:bg-primary/5 hover:text-foreground transition-colors"
          >
            <Search className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            <span className="truncate">Nome ou prontuário…</span>
          </button>
        </div>
      )}

      <PatientSearchDialog open={open} onOpenChange={setOpen} onNavigate={onNavigate} />
    </>
  );
}
