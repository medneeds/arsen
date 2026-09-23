import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MoreVertical, Printer, Copy, RotateCw, Loader2 } from "lucide-react";
import { printWristband } from "./PatientWristband";

interface PatientRow {
  id: string;
  medical_record: string | null;
  full_name: string;
  birth_date?: string | null;
  sex?: string | null;
  mother_name?: string | null;
}

interface Props {
  patient: PatientRow;
  /** Reabre/seleciona um atendimento existente em vez de criar novo */
  onReopenEncounter: (encounterCode: string, registryId: string, patientName: string) => void;
}

/**
 * Menu de ações rápidas para cada linha da lista de prontuários.
 * - Imprimir pulseira
 * - Copiar nº prontuário
 * - Reabrir último atendimento (se ativo OU criado nas últimas 4h)
 */
export function PatientRowActions({ patient, onReopenEncounter }: Props) {
  const [checking, setChecking] = useState(false);

  const handleCopy = async () => {
    if (!patient.medical_record) {
      toast.error("Sem número de prontuário");
      return;
    }
    try {
      await navigator.clipboard.writeText(patient.medical_record);
      toast.success("Prontuário copiado", { description: patient.medical_record });
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handlePrintWristband = () => {
    printWristband({
      patientName: patient.full_name,
      medicalRecord: patient.medical_record,
      birthDate: patient.birth_date,
      sex: patient.sex,
      motherName: patient.mother_name,
    });
  };

  const handleReopen = async () => {
    setChecking(true);
    try {
      // MIGRAÇÃO: patient_encounters→internacoes. registry_id→paciente_id,
      // created_at→criado_em. Não há hospital_unit_id em internacoes (filtro
      // removido) nem encounter_code (o código do atendimento é degradado para
      // string vazia — o callback em MedicalRecordsList ignora esse argumento).
      const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("internacoes")
        .select("id, status, criado_em")
        .eq("paciente_id", patient.id)
        .gte("criado_em", fourHoursAgo)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.info("Nenhum atendimento recente (últimas 4h)", {
          description: "Abra um novo atendimento normalmente",
        });
        return;
      }
      onReopenEncounter("", patient.id, patient.full_name);
      toast.success("Atendimento reaberto");
    } catch (err: any) {
      toast.error("Não foi possível verificar atendimento", { description: err?.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Mais ações">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreVertical className="h-3.5 w-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={handlePrintWristband}>
          <Printer className="h-3.5 w-3.5 mr-2" />
          Imprimir pulseira
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy} disabled={!patient.medical_record}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copiar nº prontuário
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleReopen}>
          <RotateCw className="h-3.5 w-3.5 mr-2" />
          Reabrir atendimento (4h)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
