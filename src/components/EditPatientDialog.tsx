import { useState, useEffect } from "react";
import { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BedDouble,
  IdCard,
  ClipboardList,
  Stethoscope,
  CalendarCheck,
  ArrowRightLeft,
  UserCog,
  RefreshCw,
} from "lucide-react";
import { useDepartment } from "@/contexts/DepartmentContext";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { MedicalResponsibilityDialog } from "./MedicalResponsibilityDialog";
import { InternmentStatusDialog } from "./InternmentStatusDialog";
import { AdmissionDateEditor } from "./AdmissionDateEditor";
import { MedicalRecordEditDialog } from "./MedicalRecordEditDialog";
import { OperationalRelocationDialog } from "./OperationalRelocationDialog";
import { DateBRPicker } from "./ui/DateBRPicker";
import { FileText } from "lucide-react";
import { PisRegistrySyncDialog, computePisDiff, type PisSourceRow } from "./PisRegistrySyncDialog";
import { supabase } from "@/integrations/supabase/client";
import { PatientIdentityHeader } from "./PatientIdentityHeader";

interface EditPatientDialogProps {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedPatient: Patient) => void;
}

const CLINICAL_STATUS_OPTIONS = [
  { value: "gravissimo", label: "GRAVÍSSIMO" },
  { value: "grave", label: "GRAVE" },
  { value: "grave_estavel", label: "GRAVE, PORÉM ESTÁVEL" },
  { value: "potencialmente_grave", label: "POTENCIALMENTE GRAVE" },
  { value: "regular", label: "REGULAR" },
  { value: "paliativado", label: "CUIDADOS PALIATIVOS" },
  { value: "protocolo_me", label: "EM PROTOCOLO DE ME" },
] as const;

export function EditPatientDialog({
  patient,
  open,
  onOpenChange,
  onSave,
}: EditPatientDialogProps) {
  const [formData, setFormData] = useState(patient);
  const { currentDepartment } = useDepartment();
  const isUti = currentDepartment === "UTI";

  // Sub-dialog states
  const [responsibilityOpen, setResponsibilityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [recordEditOpen, setRecordEditOpen] = useState(false);
  const [operationalRelocOpen, setOperationalRelocOpen] = useState(false);

  // Sincronização PIS → patient_registry (banner persistente)
  const [pisSyncOpen, setPisSyncOpen] = useState(false);
  const [pisSource, setPisSource] = useState<PisSourceRow | null>(null);
  const [registryId, setRegistryId] = useState<string | null>(null);
  const [pisDiffCount, setPisDiffCount] = useState(0);
  const [checkNonce, setCheckNonce] = useState(0);

  useEffect(() => {
    if (open) setFormData(patient);
  }, [open, patient]);

  // Detecta divergências PIS × patient_registry (não-bloqueante)
  useEffect(() => {
    if (!open || !patient?.id) {
      setPisDiffCount(0);
      setPisSource(null);
      setRegistryId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // 1) Descobre o patient_registry_id deste paciente
        const { data: pat } = await supabase
          .from("patients")
          .select("patient_registry_id")
          .eq("id", patient.id)
          .maybeSingle();
        const regId = (pat as any)?.patient_registry_id ?? null;
        if (!regId) {
          if (!cancelled) { setPisDiffCount(0); setRegistryId(null); setPisSource(null); }
          return;
        }
        // 2) Busca a pré-admissão mais recente vinculada (fonte PIS)
        const { data: preAdm } = await supabase
          .from("pre_admissions")
          .select("patient_name, social_name, mother_name, birth_date, sex, cpf, cns, phone, address, neighborhood, city, state, medical_record")
          .eq("patient_registry_id", regId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        // 3) Busca registry atual
        const { data: reg } = await supabase
          .from("patient_registry")
          .select("id, full_name, social_name, mother_name, birth_date, sex, cpf, cns, phone, address, neighborhood, city, state, medical_record")
          .eq("id", regId)
          .maybeSingle();
        const src: PisSourceRow | null = preAdm ? (preAdm as any) : null;
        const diff = computePisDiff(reg as any, src);
        if (!cancelled) {
          setRegistryId(regId);
          setPisSource(src);
          setPisDiffCount(diff.length);
        }
      } catch (e) {
        console.warn("[edit-pis-check] ignorado:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [open, patient?.id, checkNonce]);

  const sectorLabel = getSectorDisplayLabel(patient.sector) || patient.sector;

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  const utiAdmissionDate = (formData.utiAdmissionDate || [])[0] || "";
  const utiDischargePrediction = (formData.utiDischargePrediction || [])[0] || "";
  const utiOriginSector = (formData.utiOriginSector || [])[0] || "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-primary" />
              Edição Avançada — Leito {patient.bedNumber}
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Metadados administrativos e atalhos de movimentação. Os campos
              clínicos são editados diretamente no card.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1 -mx-1">
            <div className="space-y-4 py-3">
              {/* Banner: PIS divergente (sincronização pendente) */}
              {pisDiffCount > 0 && registryId && pisSource && (
                <section className="p-3 rounded-lg border border-amber-400/70 bg-amber-50/80 dark:bg-amber-950/30">
                  <div className="flex items-start gap-2.5">
                    <RefreshCw className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                        {pisDiffCount} campo(s) do PIS pendentes de sincronização
                      </p>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80 mt-0.5 leading-snug">
                        Os dados vindos da pré-admissão (PIS) divergem do prontuário central.
                        Revise e sincronize para manter o cadastro 100% alinhado.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setPisSyncOpen(true)}
                      className="h-8 text-[11px] gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Revisar e sincronizar
                    </Button>
                  </div>
                </section>
              )}

              {/* Bloco 1: Identificação (somente leitura) — painel cadastral completo sincronizado com o Cockpit */}
              <section className="space-y-3 px-3 py-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <IdCard className="h-4 w-4 text-primary" />
                    Identificação do Paciente
                  </div>
                  {patient.name && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRecordEditOpen(true)}
                      className="h-8 text-[11px] gap-1.5 shrink-0"
                    >
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Editar Prontuário
                    </Button>
                  )}
                </div>

                <PatientIdentityHeader
                  patientId={patient.id}
                  fallbackName={patient.name}
                  fallbackBed={patient.bedNumber}
                  fallbackSector={patient.sector}
                  fallbackClinicalStatus={patient.clinicalStatus}
                  variant="dialog"
                  alwaysExpanded
                  showFullDetailsToggle={false}
                />

                <p className="text-[10px] text-muted-foreground italic leading-snug">
                  Nome e código de atendimento são definidos no fluxo de admissão. O número do prontuário
                  pode ser editado pelo botão acima (auditado). Use este painel para conferir se o cadastro
                  está completo antes de prescrever ou evoluir.
                </p>
              </section>

              {/* Bloco 2: Dados Administrativos */}
              <section className="space-y-3 p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Dados Administrativos
                </div>

                {/* Responsável médico */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                    Responsável Médico
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setResponsibilityOpen(true)}
                    className="w-full h-9 justify-start text-xs"
                  >
                    {formData.medicalResponsibility?.type
                      ? `Definido: ${formData.medicalResponsibility.type.toUpperCase()}`
                      : "Definir responsabilidade médica"}
                  </Button>
                </div>

                {/* Status clínico */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                    Status Clínico (Severidade)
                  </Label>
                  <Select
                    value={formData.clinicalStatus || ""}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        clinicalStatus: (v || null) as Patient["clinicalStatus"],
                      })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINICAL_STATUS_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-xs"
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Datas administrativas — unificado para todos os setores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <AdmissionDateEditor
                    patientId={patient.id}
                    value={isUti ? utiAdmissionDate : (formData.admissionDate || "")}
                    onChange={(newValue) =>
                      setFormData(
                        isUti
                          ? { ...formData, utiAdmissionDate: [newValue] }
                          : { ...formData, admissionDate: newValue }
                      )
                    }
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      Previsão de Alta
                    </Label>
                    <DateBRPicker
                      value={utiDischargePrediction}
                      onChange={(v) =>
                        setFormData({
                          ...formData,
                          utiDischargePrediction: [v],
                        })
                      }
                      baseDate={isUti ? utiAdmissionDate : (formData.admissionDate || "")}
                      presets={[3, 5, 7, 10]}
                      placeholder="DD/MM/AAAA"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Calendário e atalhos (+3d / +5d / +7d / +10d) a partir da admissão no setor.
                      Sincroniza com o card e com a Evolução Médica.
                    </p>
                  </div>
                </div>

                {isUti && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Setor de Origem
                    </Label>
                    <Input
                      value={utiOriginSector}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          utiOriginSector: [e.target.value],
                        })
                      }
                      placeholder="Ex: EMERGÊNCIA"
                      className="h-9 text-xs uppercase"
                    />
                  </div>
                )}
              </section>

              {/* Bloco 3: Remanejamento operacional (administrativo, sem decisão clínica) */}
              {patient.name && (
                <section className="space-y-2 p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                    Remanejamento Operacional
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Use somente para <strong>mudança de leito por motivo operacional</strong>
                    (reforma, manutenção, isolamento, conforto) — sem decisão clínica.
                    O histórico do paciente é preservado integralmente.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOperationalRelocOpen(true)}
                    className="w-full h-9 text-xs gap-1.5 justify-start"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                    Remanejar para outro leito (operacional)
                  </Button>
                </section>
              )}

              {/* Banner: decisões clínicas migraram para o Painel Clínico */}
              {patient.name && (
                <section className="space-y-2 p-3 rounded-lg border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2 text-xs leading-relaxed">
                    <ClipboardList className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        Decisões clínicas migraram para o Painel Clínico
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        <strong>Alta médica</strong>, <strong>transferências</strong>,
                        <strong> óbito</strong> e <strong>evasão</strong> agora são
                        registrados pelo botão <em>"Abrir alta, movimentações e desfechos"</em>
                        no Painel Clínico do paciente. Após a sinalização, qualquer perfil
                        habilitado (recepção, enfermagem, médico) libera o leito por aqui.
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t flex-shrink-0 bg-background/95 backdrop-blur-sm">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9"
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} className="h-9">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      <MedicalResponsibilityDialog
        open={responsibilityOpen}
        onOpenChange={setResponsibilityOpen}
        currentResponsibility={formData.medicalResponsibility}
        sectorColor="primary"
        onSave={(responsibility) => {
          setFormData({ ...formData, medicalResponsibility: responsibility });
          setResponsibilityOpen(false);
        }}
      />

      <InternmentStatusDialog
        isOpen={statusOpen}
        onClose={() => setStatusOpen(false)}
        patientId={patient.id}
        patientName={patient.name}
        currentStatus={formData.internmentStatus || null}
        currentNotes={formData.internmentNotes || null}
        onSuccess={() => setStatusOpen(false)}
      />

      <MedicalRecordEditDialog
        open={recordEditOpen}
        onOpenChange={setRecordEditOpen}
        patientId={patient.id}
        patientName={patient.name}
      />
      <OperationalRelocationDialog
        patient={patient}
        open={operationalRelocOpen}
        onOpenChange={setOperationalRelocOpen}
        onSuccess={() => {
          setOperationalRelocOpen(false);
          onOpenChange(false);
        }}
      />
      <PisRegistrySyncDialog
        open={pisSyncOpen}
        onOpenChange={setPisSyncOpen}
        registryId={registryId}
        patientId={patient.id}
        pisSource={pisSource}
        contextLabel="Edição Avançada"
        onResolved={() => {
          // Re-checa para esconder o banner se tudo foi sincronizado
          setCheckNonce((n) => n + 1);
        }}
      />
    </>
  );
}
