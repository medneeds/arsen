import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, ArrowRight, BedDouble } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import {
  SECTOR_TO_DEPARTMENT,
  SECTOR_DISPLAY,
  type Department,
} from "@/contexts/DepartmentContext";
import { formatBedDisplay } from "@/utils/bedNaming";

export interface PacienteEncontrado {
  id: string;
  name: string;
  bedNumber: string;
  sectorCode: string;
  sectorLabel: string;
  department: Department;
  medicalRecord: string | null;
  age: string | null;
}

interface Props {
  /** Entrar no setor do paciente, sem abrir o painel dele. */
  onIrParaSetor: (paciente: PacienteEncontrado) => void;
  /** Entrar direto no painel clinico daquele paciente. */
  onIrParaPaciente: (paciente: PacienteEncontrado) => void;
}

/**
 * Busca de paciente internado a partir da tela de entrada.
 *
 * Existe porque a pergunta real do plantonista muitas vezes nao e "em que setor
 * eu vou atuar", e sim "onde esta o paciente X". Sem isso ele teria de adivinhar
 * o setor, entrar, procurar no mapa e sair de novo se errasse.
 *
 * Consulta so dispara a partir de 3 caracteres e com debounce: a tela abre
 * instantanea e o banco so e consultado quando alguem realmente digita.
 *
 * Busca apenas LEITOS OCUPADOS. Um paciente que ja teve alta nao tem setor para
 * onde direcionar, e oferecer um destino invalido seria pior que nao achar.
 */
export function PatientQuickSearch({ onIrParaSetor, onIrParaPaciente }: Props) {
  const { currentHospital, currentState } = useHospital();
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PacienteEncontrado[]>([]);
  const [buscou, setBuscou] = useState(false);
  const pedidoRef = useRef(0);

  const termoLimpo = termo.trim();
  const ativo = termoLimpo.length >= 3;

  useEffect(() => {
    if (!ativo || !currentHospital || !currentState) {
      setResultados([]);
      setBuscou(false);
      return;
    }

    const meuPedido = ++pedidoRef.current;
    setBuscando(true);

    const timer = window.setTimeout(async () => {
      // Escapa os curingas do LIKE para que "%" digitado nao vire busca ampla.
      const escapado = termoLimpo.replace(/[%_]/g, "\\$&");
      const padrao = `%${escapado}%`;

      const { data, error } = await supabase
        .from("patients")
        .select("id, name, bed_number, sector, medical_record, age, is_vacant")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .eq("is_vacant", false)
        .or(`name.ilike.${padrao},medical_record.ilike.${padrao}`)
        .order("name")
        .limit(8);

      // Resposta atrasada de uma busca antiga nao pode sobrescrever a atual.
      if (meuPedido !== pedidoRef.current) return;

      if (error) {
        console.error("[PatientQuickSearch] falha na busca:", error);
        setResultados([]);
      } else {
        setResultados(
          (data ?? []).map((p) => {
            const codigo = (p.sector as string) ?? "";
            return {
              id: p.id as string,
              name: (p.name as string) || "Sem nome",
              bedNumber: (p.bed_number as string) ?? "",
              sectorCode: codigo,
              sectorLabel: SECTOR_DISPLAY[codigo] ?? codigo,
              department: (SECTOR_TO_DEPARTMENT[codigo] ?? "") as Department,
              medicalRecord: (p.medical_record as string) ?? null,
              age: p.age ? String(p.age) : null,
            };
          }),
        );
      }
      setBuscando(false);
      setBuscou(true);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [termoLimpo, ativo, currentHospital, currentState]);

  const dica = useMemo(() => {
    if (!termoLimpo) return "Busque por nome ou número do prontuário";
    if (!ativo) return "Digite ao menos 3 caracteres";
    return null;
  }, [termoLimpo, ativo]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <label htmlFor="busca-paciente" className="preserve-case block text-sm font-medium text-foreground">
        Procurar um paciente
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        Encontre em qual setor o paciente está internado e vá direto para ele.
      </p>

      <div className="relative mt-3">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="busca-paciente"
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome ou prontuário"
          autoComplete="off"
          className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {buscando && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Buscando"
          />
        )}
      </div>

      {dica && <p className="mt-2 text-xs text-muted-foreground">{dica}</p>}

      {ativo && buscou && resultados.length === 0 && !buscando && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum paciente internado com esse nome ou prontuário. A busca cobre
          apenas leitos ocupados.
        </p>
      )}

      {resultados.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {resultados.map((p) => (
            <li key={p.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="preserve-case truncate text-sm font-medium text-foreground">
                    {p.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" aria-hidden />
                      {formatBedDisplay(p.bedNumber)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{p.sectorLabel}</span>
                    {p.medicalRecord && (
                      <>
                        <span aria-hidden>·</span>
                        <span>Prontuário {p.medicalRecord}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onIrParaSetor(p)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Abrir {p.sectorLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => onIrParaPaciente(p)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Painel do paciente
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
