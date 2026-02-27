import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { Search, ArrowRight, History, BedDouble, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface SearchPatient {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  department: string;
  diagnoses: string | null;
}

interface SearchMovement {
  id: string;
  patient_name: string;
  movement_type: string;
  destination: string | null;
  patient_sector: string | null;
  patient_bed: string | null;
  created_at: string;
}

const sectorLabel: Record<string, string> = {
  red: "Sala Vermelha",
  yellow: "Obs. Amarela",
  blue: "Obs. Azul",
  outside: "Fora das Alas",
};

const movementTypeLabel: Record<string, string> = {
  admission: "Admissão",
  discharge: "Alta",
  transfer: "Transferência",
  death: "Óbito",
  evasion: "Evasão",
};

const SearchSkeleton = () => (
  <div className="p-2 space-y-1">
    <div className="px-2 py-1.5">
      <Skeleton className="h-3 w-28 rounded-sm" />
    </div>
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-2 py-2.5"
        style={{ animationDelay: `${i * 100}ms` }}
      >
        <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-[50%] rounded-sm" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-[35%] rounded-sm" />
        </div>
        <Skeleton className="h-3 w-3 rounded-sm flex-shrink-0" />
      </div>
    ))}
  </div>
);

export interface GlobalSearchHandle {
  open: () => void;
}

interface GlobalSearchDialogProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export const GlobalSearchDialog = forwardRef<GlobalSearchHandle, GlobalSearchDialogProps>(
  function GlobalSearchDialog({ externalOpen, onExternalOpenChange }, ref) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = (val: boolean) => {
      setInternalOpen(val);
      onExternalOpenChange?.(val);
    };

    const [query, setQuery] = useState("");
    const [patients, setPatients] = useState<SearchPatient[]>([]);
    const [movements, setMovements] = useState<SearchMovement[]>([]);
    const [loading, setLoading] = useState(false);
    const searchIdRef = useRef(0);
    const navigate = useNavigate();
    const { currentHospital, currentState } = useHospital();

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
    }));

    // Cmd+K / Ctrl+K to open
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          setOpen(!open);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open]);

    const [hasSearched, setHasSearched] = useState(false);

    const performSearch = useCallback(async () => {
      if (!query.trim() || !currentHospital || !currentState) return;

      setLoading(true);
      setHasSearched(true);
      const currentSearchId = ++searchIdRef.current;

      try {
        const term = query.trim();

        const [patientsResult, movementsResult] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.rpc as any)('search_patients_global', {
            p_search_term: term,
            p_hospital_unit_id: currentHospital.id,
            p_state_id: currentState.id,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.rpc as any)('search_movements_global', {
            p_search_term: term,
            p_hospital_unit_id: currentHospital.id,
            p_state_id: currentState.id,
          }),
        ]);

        if (currentSearchId !== searchIdRef.current) return;

        if (patientsResult.error || movementsResult.error) {
          console.error("Search RPC error:", patientsResult.error || movementsResult.error);
          const searchTerm = `%${term}%`;
          const [fallbackP, fallbackM] = await Promise.all([
            supabase
              .from("patients")
              .select("id, name, bed_number, sector, department, diagnoses")
              .eq("hospital_unit_id", currentHospital.id)
              .eq("state_id", currentState.id)
              .or(`name.ilike.${searchTerm},bed_number.ilike.${searchTerm},diagnoses.ilike.${searchTerm}`)
              .limit(8),
            supabase
              .from("patient_movements")
              .select("id, patient_name, movement_type, destination, patient_sector, patient_bed, created_at")
              .eq("hospital_unit_id", currentHospital.id)
              .eq("state_id", currentState.id)
              .or(`patient_name.ilike.${searchTerm},destination.ilike.${searchTerm},patient_bed.ilike.${searchTerm}`)
              .order("created_at", { ascending: false })
              .limit(6),
          ]);

          if (currentSearchId !== searchIdRef.current) return;
          setPatients((fallbackP.data || []).filter((p) => p.name && p.name.trim() !== ""));
          setMovements(fallbackM.data || []);
        } else {
          setPatients((patientsResult.data || []) as SearchPatient[]);
          setMovements((movementsResult.data || []) as SearchMovement[]);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        if (currentSearchId === searchIdRef.current) {
          setLoading(false);
        }
      }
    }, [query, currentHospital, currentState]);

    // Reset on close
    useEffect(() => {
      if (!open) {
        setQuery("");
        setPatients([]);
        setMovements([]);
        setLoading(false);
        setHasSearched(false);
        searchIdRef.current = 0;
      }
    }, [open]);

    const handleSelectPatient = (patient: SearchPatient) => {
      setOpen(false);
      navigate("/");
      setTimeout(() => {
        const el = document.querySelector(`[data-patient-id="${patient.id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 3000);
        }
      }, 300);
    };

    const handleSelectMovement = () => {
      setOpen(false);
      navigate("/movements");
    };

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    };

    const hasResults = patients.length > 0 || movements.length > 0;

    return (
      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-3 border-b border-border">
          <CommandInput
            placeholder="Buscar paciente por nome, leito ou diagnóstico..."
            value={query}
            onValueChange={(val) => {
              setQuery(val);
              if (!val.trim()) {
                setPatients([]);
                setMovements([]);
                setHasSearched(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                e.preventDefault();
                performSearch();
              }
            }}
            className="border-0 focus:ring-0"
          />
          {query.trim() && (
            <Button
              size="sm"
              onClick={performSearch}
              disabled={loading}
              className="h-8 px-4 gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm transition-all duration-200"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              <span className="text-xs font-medium">Buscar</span>
            </Button>
          )}
        </div>
        <CommandList>
          <CommandEmpty>
            {loading ? (
              <div className="text-left -mx-2 -my-4">
                <SearchSkeleton />
              </div>
            ) : hasSearched && query.trim() ? (
              "Nenhum resultado encontrado."
            ) : (
              <div className="text-center py-2 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Digite o nome e clique em <strong>Buscar</strong> ou pressione <strong>Enter</strong></p>
                <p className="text-xs mt-1.5 opacity-70">
                  ✨ Busca inteligente: ignora acentos, ç e ~
                </p>
                <p className="text-xs mt-2 opacity-50">
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Ctrl</kbd>
                  {" + "}
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">K</kbd>
                  {" para abrir a qualquer momento"}
                </p>
              </div>
            )}
          </CommandEmpty>

          {patients.length > 0 && (
            <CommandGroup heading="Pacientes Alocados">
              {patients.map((p) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => handleSelectPatient(p)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <BedDouble className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{p.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                        {p.bed_number}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {sectorLabel[p.sector] || p.sector} • {p.department}
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {patients.length > 0 && movements.length > 0 && <CommandSeparator />}

          {movements.length > 0 && (
            <CommandGroup heading="Histórico de Movimentações">
              {movements.map((m) => (
                <CommandItem
                  key={m.id}
                  onSelect={handleSelectMovement}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <History className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{m.patient_name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                        {movementTypeLabel[m.movement_type] || m.movement_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.destination && `→ ${m.destination} • `}{formatDate(m.created_at)}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Subtle loading indicator during incremental search */}
          {loading && hasResults && (
            <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground border-t border-border">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs">Atualizando resultados...</span>
            </div>
          )}
        </CommandList>
      </CommandDialog>
    );
  }
);
