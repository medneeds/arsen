import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, BedDouble, FileClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePatientRegistrySearch, type PatientRegistryHit } from "@/hooks/usePatientRegistrySearch";
import { formatAge } from "@/lib/patientAge";
import { cn } from "@/lib/utils";

interface Props {
  /** Chamado ao navegar (ex.: fechar o dialog/menu). */
  onNavigate?: () => void;
}

/**
 * Busca de paciente por PESSOA (pacientes): nome, prontuário, CPF ou CNS —
 * inclui quem NÃO tem atendimento ativo. Ao clicar:
 *  - COM atendimento ativo  → hub do paciente no setor (/paciente).
 *  - SEM atendimento ativo  → Histórico por registry (/historico-paciente),
 *    consulta read-only de todas as internações encerradas da pessoa.
 */
export function PatientRegistrySearch({ onNavigate }: Props) {
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const { data: hits = [], isFetching } = usePatientRegistrySearch(term);

  const go = (hit: PatientRegistryHit) => {
    const name = (hit.social_name && hit.social_name.trim()) || hit.full_name || "Paciente";
    if (hit.active_internacao_id) {
      const params = new URLSearchParams({ patientId: hit.active_internacao_id, patientName: name });
      if (hit.current_bed) params.set("patientBed", hit.current_bed);
      if (hit.current_sector) params.set("patientSector", hit.current_sector);
      navigate(`/paciente?${params.toString()}`);
    } else {
      const params = new URLSearchParams({ patientRegistryId: hit.id, patientName: name });
      navigate(`/historico-paciente?${params.toString()}`);
    }
    onNavigate?.();
  };

  const showHint = term.trim().length < 2;
  const showEmpty = !showHint && !isFetching && hits.length === 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Nome, prontuário, CPF ou CNS…"
          className="pl-8 pr-8"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="max-h-[52vh] overflow-y-auto space-y-1">
        {showHint && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Digite ao menos 2 caracteres para buscar.
          </p>
        )}
        {showEmpty && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Nenhum paciente encontrado para “{term.trim()}”.
          </p>
        )}
        {hits.map((hit) => {
          const name = (hit.social_name && hit.social_name.trim()) || hit.full_name;
          const active = !!hit.active_internacao_id;
          const age = formatAge(hit.birth_date);
          return (
            <button
              key={hit.id}
              type="button"
              onClick={() => go(hit)}
              className="w-full text-left rounded-md border border-border bg-card hover:bg-accent transition-colors px-3 py-2 flex items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-muted-foreground">
                  {hit.medical_record && <span className="font-mono">Pront. {hit.medical_record}</span>}
                  {age && <span>· {age}</span>}
                  {hit.cpf && <span className="font-mono">· CPF {hit.cpf}</span>}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border whitespace-nowrap",
                  active
                    ? "bg-released-soft/60 text-released-on-soft border-released-border"
                    : "bg-muted text-muted-foreground border-border",
                )}
              >
                {active ? (
                  <>
                    <BedDouble className="h-3 w-3" />
                    {hit.current_sector || "Internado"}
                    {hit.current_bed && hit.current_bed !== "—" ? ` · ${hit.current_bed}` : ""}
                  </>
                ) : (
                  <>
                    <FileClock className="h-3 w-3" />
                    Consultar prontuário
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
