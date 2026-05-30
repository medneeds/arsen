import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileSearch, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePatientRegistrySearch } from "@/hooks/usePatientRegistrySearch";

/**
 * Bloco compacto na sidebar para buscar prontuário de qualquer paciente
 * (ativo, alta ou óbito) e abrir o /historico-paciente correspondente.
 *
 * Escopo isolado: NÃO interfere com menus, navegação do mapa, dados clínicos
 * ou hooks já existentes. Apenas lê patient_registry e navega.
 */
export function SidebarPatientSearch({
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce 250ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  // Click fora fecha o popover
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const { data: results, isFetching } = usePatientRegistrySearch(debounced, debounced.length >= 2);
  const hits = (results ?? []).slice(0, 8);

  const goToHistorico = (registryId: string) => {
    setOpen(false);
    setTerm("");
    navigate(`/historico-paciente?patientRegistryId=${registryId}`);
    onNavigate?.();
  };

  if (isCollapsed) {
    return (
      <div className="px-0 flex justify-center py-1.5 border-b border-border/50">
        <button
          onClick={() => navigate("/historico-paciente")}
          title="Buscar prontuário"
          className="h-7 w-7 flex items-center justify-center rounded-md bg-muted/40 hover:bg-primary/10 hover:text-primary text-foreground/70 ring-1 ring-border/40 transition-colors"
        >
          <FileSearch className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b border-border/50">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
          Buscar Prontuário
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent" />
      </div>
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Nome, CPF, CNS, prontuário…"
            className="h-7 pl-7 pr-7 text-[11px] bg-muted/40 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40"
          />
          {term && (
            <button
              onClick={() => {
                setTerm("");
                setOpen(false);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Limpar"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {open && debounced.length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-lg max-h-80 overflow-y-auto">
            {isFetching && hits.length === 0 && (
              <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando…
              </div>
            )}
            {!isFetching && hits.length === 0 && (
              <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                Nenhum prontuário encontrado.
              </div>
            )}
            {hits.map((p) => {
              const name = p.is_unidentified
                ? p.unidentified_code || "NI"
                : p.social_name || p.full_name;
              const isActive = !!p.current_bed && p.current_bed !== "—";
              return (
                <button
                  key={p.id}
                  onClick={() => goToHistorico(p.id)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-primary/10 hover:text-primary transition-colors border-b border-border/40 last:border-b-0"
                >
                  <div className="flex items-center gap-1.5">
                    <FileSearch className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <span className="text-[11px] font-semibold truncate uppercase">{name}</span>
                    {isActive && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 flex-shrink-0">
                        {p.current_bed}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 ml-4 text-[9px] text-muted-foreground truncate">
                    {p.medical_record ? `PRONT. ${p.medical_record}` : "SEM Nº"}
                    {p.cpf && ` · CPF ${p.cpf}`}
                    {!isActive && " · ARQUIVADO"}
                  </div>
                </button>
              );
            })}
            <div className="px-2.5 py-1.5 border-t border-border/60 bg-muted/30">
              <button
                onClick={() => {
                  setOpen(false);
                  setTerm("");
                  navigate("/historico-paciente");
                  onNavigate?.();
                }}
                className="text-[10px] font-semibold text-primary hover:underline uppercase tracking-wide"
              >
                Abrir busca completa →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
