import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useDepartment, type Department } from "@/contexts/DepartmentContext";
import { isDepartmentLocked } from "@/config/lockedSectors";
import { SECTOR_ROUTES } from "@/config/clinicalSectors";
import type { PacienteEncontrado } from "@/components/PatientQuickSearch";
import { montarUrlPaciente } from "@/lib/patientSearchUrl";

interface Options {
  /** Avisa qual setor esta sendo aberto (a tela inicial usa para marcar o card). */
  onEntrarSetor?: (setor: Department) => void;
  /** Chamado depois de disparar a navegacao (ex.: fechar dialogo ou menu mobile). */
  onNavegar?: () => void;
}

/**
 * Navegacao a partir do resultado do PatientQuickSearch. Fonte unica para a
 * tela inicial e para a busca da sidebar — as duas precisam se comportar igual.
 *
 * O setor e ajustado ANTES de navegar: sem isso a tela abriria com o contexto
 * do setor anterior e as telas em volta mostrariam a lista de outro lugar.
 * O atraso de 120ms deixa o contexto assentar antes da troca de rota.
 */
export function usePatientSearchNavigation({ onEntrarSetor, onNavegar }: Options = {}) {
  const navigate = useNavigate();
  const { setCurrentDepartment } = useDepartment();

  /** Entrar no setor do paciente, sem abrir o painel dele. */
  const irParaSetorDoPaciente = useCallback(
    (p: PacienteEncontrado) => {
      if (!p.department) return;
      if (isDepartmentLocked(p.department)) return;
      onEntrarSetor?.(p.department);
      setCurrentDepartment(p.department);
      window.setTimeout(() => navigate(SECTOR_ROUTES[p.department] ?? "/"), 120);
      onNavegar?.();
    },
    [navigate, setCurrentDepartment, onEntrarSetor, onNavegar],
  );

  /** Entrar direto no painel clinico daquele paciente. */
  const irParaPaciente = useCallback(
    (p: PacienteEncontrado) => {
      if (p.department) setCurrentDepartment(p.department);
      window.setTimeout(() => navigate(montarUrlPaciente(p)), 120);
      onNavegar?.();
    },
    [navigate, setCurrentDepartment, onNavegar],
  );

  return { irParaSetorDoPaciente, irParaPaciente };
}
