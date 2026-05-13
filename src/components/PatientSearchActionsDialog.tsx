import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { History, FilePlus, BedDouble, ChevronRight, User } from "lucide-react";
import {
  MovementConfirmDialog,
  type MovementSummaryItem,
  type MovementConsequence,
} from "./MovementConfirmDialog";
import {
  DESTINATION_SECTORS,
  findSectorByMapTitle,
  type DestinationSectorOption,
} from "@/lib/destinationSectors";

export interface RegistryPatientLite {
  id: string;
  full_name: string;
  social_name?: string | null;
  mother_name?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  cpf?: string | null;
  cns?: string | null;
  medical_record?: string | null;
  phone?: string | null;
}

interface PatientSearchActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: RegistryPatientLite | null;
  /** Título do setor visualizado no mapa de leitos (sectorFilterLabel). */
  defaultSectorMapTitle?: string;
  hospitalUnitId: string;
  stateId: string;
  department: string;
  onSuccess?: () => void;
}

type Step = "actions" | "preadmit_question" | "confirm";

const calcAge = (b?: string | null) => {
  if (!b) return null;
  return Math.floor((Date.now() - new Date(b + "T12:00:00").getTime()) / (365.25 * 24 * 3600 * 1000));
};

export function PatientSearchActionsDialog({
  open,
  onOpenChange,
  patient,
  defaultSectorMapTitle,
  hospitalUnitId,
  stateId,
  department,
  onSuccess,
}: PatientSearchActionsDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("actions");
  const [signalPreAdmission, setSignalPreAdmission] = useState(true);
  const [selectedSectorValue, setSelectedSectorValue] = useState<string>(
    () => findSectorByMapTitle(defaultSectorMapTitle)?.value ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset interno quando reabre
  const reset = () => {
    setStep("actions");
    setSignalPreAdmission(true);
    setSelectedSectorValue(findSectorByMapTitle(defaultSectorMapTitle)?.value ?? "");
  };

  const handleClose = (next: boolean) => {
    if (isSubmitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const groupedSectors = useMemo(() => {
    const groups = new Map<string, DestinationSectorOption[]>();
    DESTINATION_SECTORS.forEach(s => {
      if (!groups.has(s.group)) groups.set(s.group, []);
      groups.get(s.group)!.push(s);
    });
    return Array.from(groups.entries());
  }, []);

  const selectedSector = DESTINATION_SECTORS.find(s => s.value === selectedSectorValue);

  if (!patient) return null;

  const age = calcAge(patient.birth_date);

  const goToHistory = () => {
    handleClose(false);
    const params = new URLSearchParams({
      patientRegistryId: patient.id,
      patientName: patient.full_name,
    });
    navigate(`/historico-paciente?${params.toString()}`);
  };

  const handleConfirmCreateEncounter = async () => {
    if (signalPreAdmission && !selectedSector) {
      toast({ title: "Selecione um setor de destino", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1) Localiza prontuário oficial vinculado ao registry
      let medicalRecordId: string | null = null;
      try {
        const { data: mr } = await supabase
          .from("medical_records")
          .select("id")
          .eq("patient_registry_id", patient.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        medicalRecordId = (mr as any)?.id ?? null;
      } catch (e) {
        console.warn("Falha ao buscar medical_record:", e);
      }

      // 2) Pré-gera o encounter_code (12 dígitos sequenciais)
      let preGeneratedCode: string | null = null;
      if (medicalRecordId) {
        try {
          const { data: code } = await (supabase.rpc as any)(
            "generate_encounter_code_v2",
            { p_medical_record_id: medicalRecordId, p_data_hora_admissao: new Date().toISOString() },
          );
          preGeneratedCode = (code as string) || null;
        } catch (e) {
          console.warn("Falha ao pré-gerar código:", e);
        }
      }

      // 3) Cria o atendimento
      const { data: enc, error: encErr } = await supabase
        .from("patient_encounters")
        .insert({
          patient_name: patient.full_name,
          registry_id: patient.id,
          medical_record_id: medicalRecordId,
          encounter_code: preGeneratedCode || undefined,
          hospital_unit_id: hospitalUnitId,
          state_id: stateId,
          department,
          destination_sector: selectedSector?.label || null,
          status: "active",
          triage_status: "encaminhado",
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (encErr) throw encErr;
      const encounterCode = (enc as any).encounter_code as string;

      // 4) Sinaliza pré-admissão (opcional)
      if (signalPreAdmission && selectedSector) {
        const { error: paErr } = await supabase
          .from("pre_admissions")
          .insert({
            patient_name: patient.full_name,
            social_name: patient.social_name || null,
            mother_name: patient.mother_name || null,
            birth_date: patient.birth_date || null,
            sex: patient.sex || null,
            cpf: patient.cpf || null,
            cns: patient.cns || null,
            medical_record: patient.medical_record || null,
            phone: patient.phone || null,
            patient_registry_id: patient.id,
            destination_sector: selectedSector.mapTitle,
            status: "aguardando_leito",
            hospital_unit_id: hospitalUnitId,
            state_id: stateId,
            department,
            created_by: user?.id,
            notes: `Aberto via busca no Mapa de Leitos • Atendimento ${encounterCode}`,
          } as any);
        if (paErr) {
          console.error("Erro ao criar pré-admissão:", paErr);
          toast({
            title: "Atendimento criado, mas falha ao sinalizar setor",
            description: paErr.message,
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Atendimento aberto",
        description: signalPreAdmission && selectedSector
          ? `Código ${encounterCode} • sinalizado em ${selectedSector.mapTitle}`
          : `Código ${encounterCode}`,
      });

      handleClose(false);
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao abrir atendimento", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ====== Card final de confirmação (MovementConfirmDialog) ======
  const summary: MovementSummaryItem[] = [
    { label: "Paciente", value: patient.full_name },
    ...(patient.medical_record ? [{ label: "Prontuário", value: patient.medical_record }] : []),
    ...(patient.cpf ? [{ label: "CPF", value: patient.cpf }] : []),
    { label: "Ação", value: "Abrir novo atendimento" },
    {
      label: "Sinalizar pré-admissão",
      value: signalPreAdmission && selectedSector
        ? `Sim → ${selectedSector.mapTitle}`
        : "Não",
    },
    { label: "Código de atendimento", value: "Gerado na confirmação (12 dígitos)" },
  ];

  const consequences: MovementConsequence[] = [
    { icon: FilePlus, text: <>Será criado um novo <b>encounter</b> vinculado ao prontuário existente.</> },
    { icon: ChevronRight, text: <>Um <b>código sequencial global de 12 dígitos</b> será emitido neste momento.</> },
    ...(signalPreAdmission && selectedSector
      ? [{
          icon: BedDouble,
          text: (
            <>O paciente entrará na fila <b>"Aguardando Pré-admissão (Alocação) em Leito"</b> do setor <b>{selectedSector.mapTitle}</b>.</>
          ),
        }] as MovementConsequence[]
      : []),
  ];

  return (
    <>
      {/* Etapas 1 e 2 — diálogo padrão */}
      <Dialog open={open && step !== "confirm"} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base uppercase truncate">{patient.full_name}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {age !== null && <span>{age}a</span>}
                  {patient.sex && <span>• {patient.sex}</span>}
                  {patient.medical_record && <span>• Pront: {patient.medical_record}</span>}
                  {patient.cpf && <span>• CPF: {patient.cpf}</span>}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {step === "actions" && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Escolha uma ação para este paciente:
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-3 justify-start gap-3"
                  onClick={goToHistory}
                >
                  <History className="h-4 w-4 text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">Consultar histórico</div>
                    <div className="text-[11px] text-muted-foreground">
                      Abre a linha do tempo longitudinal do paciente.
                    </div>
                  </div>
                </Button>

                <Button
                  className="h-auto py-3 justify-start gap-3"
                  onClick={() => setStep("preadmit_question")}
                >
                  <FilePlus className="h-4 w-4" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">Abrir novo atendimento</div>
                    <div className="text-[11px] opacity-90">
                      Gera um código único de atendimento (12 dígitos) vinculado a este prontuário.
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {step === "preadmit_question" && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Antes de confirmar, deseja <b>sinalizar pré-admissão</b> deste paciente para algum setor
                (entra em "Aguardando Pré-admissão (Alocação) em Leito")?
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={signalPreAdmission ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setSignalPreAdmission(true)}
                >
                  Sim, sinalizar
                </Button>
                <Button
                  variant={!signalPreAdmission ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setSignalPreAdmission(false)}
                >
                  Não, só abrir atendimento
                </Button>
              </div>

              {signalPreAdmission && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Setor de destino</Label>
                  <Select value={selectedSectorValue} onValueChange={setSelectedSectorValue}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupedSectors.map(([group, items]) => (
                        <SelectGroup key={group}>
                          <SelectLabel className="text-[10px] uppercase">{group}</SelectLabel>
                          {items.map(s => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {defaultSectorMapTitle && (
                    <p className="text-[10px] text-muted-foreground">
                      Padrão: setor visualizado no mapa <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{defaultSectorMapTitle}</Badge>
                    </p>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("actions")}>
                  Voltar
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStep("confirm")}
                  disabled={signalPreAdmission && !selectedSectorValue}
                >
                  Revisar e confirmar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Etapa 3 — card de confirmação reutilizando o padrão da casa */}
      <MovementConfirmDialog
        open={open && step === "confirm"}
        onOpenChange={(o) => {
          if (!o && !isSubmitting) setStep("preadmit_question");
        }}
        onConfirm={handleConfirmCreateEncounter}
        isSubmitting={isSubmitting}
        title="Abrir novo atendimento"
        description="Confirme a abertura do atendimento e, se aplicável, a sinalização de pré-admissão no setor."
        summary={summary}
        consequences={consequences}
        confirmLabel={signalPreAdmission ? "Confirmar e sinalizar setor" : "Confirmar abertura"}
        cancelLabel="Voltar"
        finalNote={
          <>O código de atendimento é <b>imutável</b> após a emissão e ficará vinculado ao prontuário do paciente.</>
        }
      />
    </>
  );
}
