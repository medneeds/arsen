import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DuplicateMatch {
  id: string;
  full_name: string;
  birth_date: string | null;
  cpf: string | null;
  medical_record: string | null;
}

interface Props {
  /** Nome digitado pelo usuário (campo full_name) */
  fullName: string;
  /** Data de nascimento opcional para casamento mais preciso */
  birthDate?: string;
  /** CPF parcial (sem máscara) */
  cpf?: string;
  /** Callback quando usuário escolhe usar paciente existente */
  onUseExisting: (patient: DuplicateMatch) => void;
  /**
   * Callback de alta confiança: dispara quando nome + data de nascimento
   * coincidem com um registro existente. O pai deve bloquear o cadastro.
   * false = sem match de alta confiança ou match resolvido.
   */
  onHighConfidenceFound?: (found: boolean) => void;
}

/**
 * Detecção de duplicatas em tempo real durante o cadastro.
 * Dispara após 600ms de inatividade quando há nome+DN ou CPF parcial significativo.
 * Mostra até 3 pacientes similares.
 */
export function DuplicatePatientWarning({ fullName, birthDate, cpf, onUseExisting, onHighConfidenceFound }: Props) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [highConfidenceMatches, setHighConfidenceMatches] = useState<DuplicateMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const name = fullName.trim();
    const cpfClean = (cpf || "").replace(/\D/g, "");
    const nameWords = name.split(/\s+/).filter(Boolean);
    const enoughName = nameWords.length >= 3;
    const enoughCpf = cpfClean.length >= 6;
    if (!enoughName && !enoughCpf) {
      setMatches([]);
      setHighConfidenceMatches([]);
      onHighConfidenceFound?.(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("patient_registry")
          .select("id, full_name, birth_date, cpf, medical_record")
          .is("merged_into_registry_id", null)
          .eq("is_unidentified", false)
          .limit(3);

        if (enoughCpf) {
          query = query.ilike("cpf", `%${cpfClean}%`);
        } else if (enoughName) {
          const first = nameWords[0];
          const last = nameWords[nameWords.length - 1];
          query = query.or(`full_name.ilike.%${first}%,full_name.ilike.%${last}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (controller.signal.aborted) return;

        let filtered = (data as DuplicateMatch[]) || [];

        // Alta confiança: nome + data de nascimento coincidem — causa real das duplicatas.
        // Bloqueia o cadastro e exige decisão explícita do usuário.
        let highConf: DuplicateMatch[] = [];
        if (birthDate && filtered.length > 0) {
          highConf = filtered.filter((p) => p.birth_date === birthDate);
          if (highConf.length > 0) filtered = highConf;
        }

        setMatches(filtered);
        setHighConfidenceMatches(highConf);
        onHighConfidenceFound?.(highConf.length > 0);
      } catch (err) {
        console.warn("Falha na detecção de duplicatas:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 600);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [fullName, birthDate, cpf]);

  if (loading || matches.length === 0) return null;

  const isHighConfidence = highConfidenceMatches.length > 0;

  return (
    <div className={cn(
      "rounded-lg border-2 p-3 space-y-2",
      isHighConfidence
        ? "border-destructive/50 bg-destructive/5"
        : "border-amber-500/40 bg-amber-500/5"
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn("h-4 w-4 shrink-0", isHighConfidence ? "text-destructive" : "text-amber-600")} />
        <p className={cn(
          "text-xs font-semibold",
          isHighConfidence ? "text-destructive" : "text-amber-700 dark:text-amber-400"
        )}>
          {isHighConfidence
            ? "Cadastro bloqueado — paciente já existe com mesmo nome e data de nascimento"
            : matches.length === 1
              ? "Existe um paciente similar já cadastrado:"
              : `Existem ${matches.length} pacientes similares já cadastrados:`
          }
        </p>
      </div>

      {isHighConfidence && (
        <p className="text-[11px] text-muted-foreground">
          Para evitar duplicatas, use o paciente existente ou confirme que são pessoas diferentes.
        </p>
      )}

      <div className="space-y-1.5">
        {matches.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border bg-card p-2 transition-colors",
              isHighConfidence
                ? "hover:border-destructive/40"
                : "hover:border-amber-500/60"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{m.full_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {m.medical_record && <span className="font-mono mr-1.5">{m.medical_record}</span>}
                  {m.birth_date && <span>DN: {format(new Date(m.birth_date + "T00:00:00"), "dd/MM/yyyy")}</span>}
                  {m.cpf && <span className="ml-1.5">CPF: {m.cpf}</span>}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={isHighConfidence ? "default" : "outline"}
              className={cn(
                "h-7 text-[10px] shrink-0",
                isHighConfidence
                  ? ""
                  : "border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
              )}
              type="button"
              onClick={() => {
                onHighConfidenceFound?.(false);
                onUseExisting(m);
              }}
            >
              Usar este paciente
            </Button>
          </div>
        ))}
      </div>

      {isHighConfidence && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[10px] text-muted-foreground"
          type="button"
          onClick={() => {
            onHighConfidenceFound?.(false);
          }}
        >
          Confirmar que são pacientes diferentes e prosseguir
        </Button>
      )}
    </div>
  );
}
