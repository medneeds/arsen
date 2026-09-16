import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { User, Hash, Loader2, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { detectUnidentified } from "@/lib/unidentifiedDetector";

interface RegistryHit {
  id: string;
  full_name: string;
  medical_record: string | null;
  cpf: string | null;
  birth_date: string | null;
  is_unidentified: boolean;
}

interface EncounterHit {
  id: string;
  encounter_code: string;
  patient_name: string;
  registry_id: string | null;
  destination_sector: string | null;
  status: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Selecionar registro de prontuário (abre detalhe/atendimento) */
  onPickRegistry: (registryId: string, patientName: string) => void;
  /** Selecionar atendimento existente (reabre/foca) */
  onPickEncounter: (encounterCode: string, registryId: string | null, patientName: string) => void;
}

/**
 * Busca global da recepção (Ctrl+K / Cmd+K).
 * Busca instantânea (debounce 250ms) por:
 *  - Nome / CPF / CNS / nº prontuário (pacientes)
 *
 * MIGRAÇÃO: patient_registry→pacientes; sem hospital_unit_id em pacientes (o
 * escopo por hospital foi removido do filtro). O grupo "Atendimentos" dependia de
 * `patient_encounters.encounter_code`, que não existe em `internacoes` — a busca
 * por código de atendimento foi degradada (retorna sempre vazio). O shape
 * EncounterHit e o callback onPickEncounter são mantidos estáveis.
 */
export function ReceptionGlobalSearch({ open, onOpenChange, onPickRegistry, onPickEncounter }: Props) {
  const { currentHospital } = useHospital();
  const [query, setQuery] = useState("");
  const [registries, setRegistries] = useState<RegistryHit[]>([]);
  const [encounters, setEncounters] = useState<EncounterHit[]>([]);
  const [loading, setLoading] = useState(false);
  const tRef = useRef<number | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setRegistries([]);
      setEncounters([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (tRef.current) window.clearTimeout(tRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setRegistries([]);
      setEncounters([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    tRef.current = window.setTimeout(async () => {
      try {
        const cleaned = q.replace(/\D/g, "");
        const isNumeric = cleaned.length >= 4 && /^[\d\s.\-/]+$/.test(q);

        // Registry search: nome/cpf/cns/prontuário.
        // MIGRAÇÃO: pacientes não tem merged_into_registry_id nem hospital_unit_id.
        let regQuery = supabase
          .from("pacientes")
          .select("id, nome_completo, prontuario, cpf, cns, data_nascimento")
          .limit(8);

        if (isNumeric) {
          regQuery = regQuery.or(
            `cpf.ilike.%${cleaned}%,cns.ilike.%${cleaned}%,prontuario.ilike.%${cleaned}%`,
          );
        } else {
          regQuery = regQuery.ilike("nome_completo", `%${q}%`);
        }

        // MIGRAÇÃO: internacoes não tem encounter_code — busca de atendimento por
        // código degradada para vazio (grupo "Atendimentos" nunca aparece).
        const regRes = await regQuery;

        if (!regRes.error) {
          setRegistries(
            ((regRes.data as any[]) || []).map((r) => ({
              id: r.id,
              full_name: r.nome_completo,
              medical_record: r.prontuario,
              cpf: r.cpf,
              birth_date: r.data_nascimento,
              is_unidentified: detectUnidentified(r.nome_completo || "").isUnidentified,
            })),
          );
        }
        setEncounters([]);
      } catch (err) {
        console.warn("Busca global:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [query, currentHospital?.id]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar por nome, CPF, CNS, prontuário ou código de atendimento…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            Buscando…
          </div>
        )}

        {!loading && query.trim().length >= 2 && registries.length === 0 && encounters.length === 0 && (
          <CommandEmpty>Nenhum resultado para "{query}"</CommandEmpty>
        )}

        {!loading && query.trim().length < 2 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <Hash className="h-6 w-6 mx-auto mb-2 opacity-30" />
            Digite ao menos 2 caracteres
            <p className="mt-1 text-[10px]">Atalho: <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[9px]">Ctrl + K</kbd></p>
          </div>
        )}

        {encounters.length > 0 && (
          <CommandGroup heading={`Atendimentos (${encounters.length})`}>
            {encounters.map((e) => (
              <CommandItem
                key={e.id}
                value={`enc-${e.id}-${e.encounter_code}-${e.patient_name}`}
                onSelect={() => {
                  onPickEncounter(e.encounter_code, e.registry_id, e.patient_name);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2"
              >
                <Activity className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{e.encounter_code}</span>
                    <span className="text-xs truncate">{e.patient_name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    {e.destination_sector && ` • ${e.destination_sector.replace(/_/g, " ")}`}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 shrink-0 capitalize"
                >
                  {e.status}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {encounters.length > 0 && registries.length > 0 && <CommandSeparator />}

        {registries.length > 0 && (
          <CommandGroup heading={`Pacientes (${registries.length})`}>
            {registries.map((r) => (
              <CommandItem
                key={r.id}
                value={`reg-${r.id}-${r.full_name}-${r.medical_record || ""}-${r.cpf || ""}`}
                onSelect={() => {
                  onPickRegistry(r.id, r.full_name);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2"
              >
                {r.is_unidentified ? (
                  <Hash className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                ) : (
                  <User className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs truncate font-medium">{r.full_name}</div>
                  <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1.5">
                    {r.medical_record && <span className="font-mono">{r.medical_record}</span>}
                    {r.cpf && <span>• CPF {r.cpf}</span>}
                    {r.birth_date && <span>• DN {format(new Date(r.birth_date + "T00:00:00"), "dd/MM/yyyy")}</span>}
                  </div>
                </div>
                {r.is_unidentified && (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] h-4">
                    NI
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
