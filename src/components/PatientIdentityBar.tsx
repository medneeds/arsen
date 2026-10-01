import type { ReactNode } from "react";
import { useHospital } from "@/contexts/HospitalContext";
import { usePatientLive } from "@/hooks/usePatientLive";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { cn } from "@/lib/utils";

/**
 * Sub-cabecalho PADRAO de identidade do paciente, compartilhado por todos os
 * modulos do guarda-chuva clinico (Admissao, Prescricao, Evolucao, Requisicao,
 * Monitoramento, Docs, Historico, Movimentacao).
 *
 * ESQUERDA: leito, nome, SETOR (rotulo), idade, data de nascimento, prontuario.
 * DIREITA: `rightSlot` custom por modulo (ex.: "Prescricao Medica Diaria" + data).
 *
 * Fonte unica, ancorada em internacao_id (patientId):
 *  - usePatientLive  -> leito, nome, setor (= setores.nome, JA e rotulo — por isso
 *    o setor NUNCA aparece como codigo cru "red"/"yellow"/"outside" aqui), idade.
 *  - usePatientIdentifiers -> prontuario e data de nascimento.
 * Antes, cada pagina copiava esse bloco inline e divergia (campos faltando, setor
 * em codigo). Este componente centraliza e corrige de uma vez.
 */

interface PatientIdentityBarProps {
  /** internacao_id (patientId da URL). */
  patientId: string | null;
  /** Conteudo do lado direito — titulo do modulo, data, badges etc. */
  rightSlot?: ReactNode;
  className?: string;
}

function formatBirth(bd: string | null | undefined): string {
  if (!bd) return "";
  try {
    const d = new Date(`${bd}T12:00:00`);
    return isNaN(d.getTime())
      ? bd
      : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return bd;
  }
}

export function PatientIdentityBar({ patientId, rightSlot, className }: PatientIdentityBarProps) {
  const { patient } = usePatientLive(patientId || null);
  const { currentHospital } = useHospital();
  const ids = usePatientIdentifiers(patientId || null, patient?.name || null, currentHospital?.id || null);

  const bed = patient?.bedNumber || "—";
  const name = patient?.name || "Paciente não identificado";
  const sector = patient?.sector || ""; // setores.nome = rotulo
  const age = patient?.age || ids.registry?.age || "";
  const birthDate = ids.registry?.birthDate || null;
  const prontuario = ids.prontuario || null;

  return (
    <div className={cn("hidden sm:flex items-center justify-between gap-4", className)}>
      {/* ESQUERDA: identidade do paciente */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-primary/15 border border-primary/20 shrink-0">
          <span className="text-[9px] font-normal uppercase tracking-wide text-primary/60 leading-none">Leito</span>
          <span className="text-xl font-bold text-primary leading-none mt-0.5">{bed}</span>
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground uppercase tracking-wide leading-tight truncate">
            {name}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {sector && (
              <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {sector}
              </span>
            )}
            {age && (
              <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                {age}
              </span>
            )}
            {birthDate && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">{formatBirth(birthDate)}</span>
              </>
            )}
            {prontuario && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground font-mono">Pront. {prontuario}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* DIREITA: conteudo custom do modulo */}
      {rightSlot && <div className="text-right shrink-0">{rightSlot}</div>}
    </div>
  );
}

export default PatientIdentityBar;
