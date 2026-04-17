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
}

/**
 * Detecção de duplicatas em tempo real durante o cadastro.
 * Dispara após 600ms de inatividade quando há nome+DN ou CPF parcial significativo.
 * Mostra até 3 pacientes similares.
 */
export function DuplicatePatientWarning({ fullName, birthDate, cpf, onUseExisting }: Props) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const name = fullName.trim();
    const cpfClean = (cpf || "").replace(/\D/g, "");
    // Disparo: nome com 3+ palavras OU CPF com 6+ dígitos
    const nameWords = name.split(/\s+/).filter(Boolean);
    const enoughName = nameWords.length >= 3;
    const enoughCpf = cpfClean.length >= 6;
    if (!enoughName && !enoughCpf) {
      setMatches([]);
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
          // Busca por primeiro + último nome
          const first = nameWords[0];
          const last = nameWords[nameWords.length - 1];
          query = query.or(`full_name.ilike.%${first}%,full_name.ilike.%${last}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (controller.signal.aborted) return;

        // Pós-filtro client-side por DN se fornecida
        let filtered = (data as DuplicateMatch[]) || [];
        if (birthDate && filtered.length > 0) {
          const birthMatch = filtered.filter((p) => p.birth_date === birthDate);
          if (birthMatch.length > 0) filtered = birthMatch;
        }
        setMatches(filtered);
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

  return (
    <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          {matches.length === 1
            ? "Existe um paciente similar já cadastrado:"
            : `Existem ${matches.length} pacientes similares já cadastrados:`}
        </p>
      </div>
      <div className="space-y-1.5">
        {matches.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border bg-card p-2",
              "hover:border-amber-500/60 transition-colors"
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
              variant="outline"
              className="h-7 text-[10px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10 shrink-0"
              type="button"
              onClick={() => onUseExisting(m)}
            >
              Usar este
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
