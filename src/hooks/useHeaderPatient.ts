/**
 * Identificacao do paciente para o cabecalho padronizado das previas em tela.
 * Comeca com o que a tela ja tem e completa, a partir do cadastro, o que faltar
 * (sexo, atendimento, alergias...) — a mesma fonte usada na impressao
 * (lib/headerPatient.ts), para a previa e o papel nao divergirem.
 */
import { useEffect, useMemo, useState } from "react";
import type { HeaderPatient } from "@/lib/documentHeaderLayout";
import { resolveHeaderPatient } from "@/lib/headerPatient";

export function useHeaderPatient(patientId: string | null | undefined, base: HeaderPatient): HeaderPatient {
  const [resolved, setResolved] = useState<{ key: string; value: HeaderPatient } | null>(null);
  const key = useMemo(() => `${patientId ?? ""}|${JSON.stringify(base)}`, [patientId, base]);

  useEffect(() => {
    if (!patientId) return;
    let alive = true;
    resolveHeaderPatient(patientId, base).then((value) => {
      if (alive) setResolved({ key, value });
    });
    return () => {
      alive = false;
    };
    // `base` entra via `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, key]);

  return resolved && resolved.key === key ? resolved.value : base;
}
