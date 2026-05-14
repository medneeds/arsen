import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useHospital } from "@/contexts/HospitalContext";
import { ArrowLeft, ArrowRight, FileText, Loader2, AlertTriangle, User, Bed, Stethoscope, MapPin, Info, ArrowRightLeft, Building2, ClipboardList, Eye, History } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOVEMENT_CATEGORIES,
  MOVEMENT_SUBTYPES,
  INTERNAL_TRANSFER_DESTINATIONS,
  EXTERNAL_TRANSFER_DESTINATIONS,
  INTERNMENT_DESTINATIONS,
  adaptLegacyType,
  getSubtypesByCategory,
  type AnyMovementType,
  type MovementCategory,
  type MovementSubtype,
  type SubtypeDef,
} from "@/data/movementFlow";
import { DischargeDocumentForm } from "@/components/DischargeDocumentForm";
import { DischargeConfirmDialog } from "@/components/DischargeConfirmDialog";
import { MovementConfirmDialog, type MovementConsequence, type MovementSummaryItem } from "@/components/MovementConfirmDialog";
import {
  type DischargeDocType,
  type DischargeDocPayload,
  printDischargeDocument,
} from "@/lib/dischargeDocuments";

interface PatientMovementDialogProps {
  patient: Patient | null;
  /** Accepts new subtype ids OR legacy values ("ALTA" | "ÓBITO" | "TRANSFERÊNCIA") for back-compat. */
  movementType: AnyMovementType | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TONE_CLASSES = {
  primary: {
    icon: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    hoverBorder: "hover:border-primary/60",
    ring: "ring-primary/40",
  },
  accent: {
    icon: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
    hoverBorder: "hover:border-accent/60",
    ring: "ring-accent/40",
  },
  destructive: {
    icon: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    hoverBorder: "hover:border-destructive/60",
    ring: "ring-destructive/40",
  },
} as const;

export function PatientMovementDialog({
  patient,
  movementType,
  isOpen,
  onClose,
  onSuccess,
}: PatientMovementDialogProps) {
  const [step, setStep] = useState<"category" | "subtype" | "form">("category");
  const [category, setCategory] = useState<MovementCategory | null>(null);
  const [subtype, setSubtype] = useState<MovementSubtype | null>(null);

  const [destination, setDestination] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [responsibleDoctor, setResponsibleDoctor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docPayload, setDocPayload] = useState<DischargeDocPayload | null>(null);
  const [docComplete, setDocComplete] = useState(false);
  const [signerProfile, setSignerProfile] = useState<{ name: string; crm: string }>({ name: "", crm: "" });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { toast } = useToast();
  const { currentState, currentHospital } = useHospital();
  const navigate = useNavigate();

  // Pre-fill when called from card with a specific type
  useEffect(() => {
    if (!isOpen) return;
    const adapted = adaptLegacyType(movementType);
    if (adapted) {
      const def = MOVEMENT_SUBTYPES.find((s) => s.id === adapted);
      if (def) {
        setCategory(def.category);
        setSubtype(adapted);
        setStep("form");
        return;
      }
    }
    setStep("category");
    setCategory(null);
    setSubtype(null);
  }, [isOpen, movementType]);

  // Sincroniza médico responsável com o usuário logado (para sumário de alta / óbito)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, crm")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const name = (data?.full_name || "").toUpperCase();
      const crm = data?.crm || "";
      setSignerProfile({ name, crm });
      setResponsibleDoctor((prev) => prev || name);
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const subtypeDef: SubtypeDef | null = useMemo(
    () => MOVEMENT_SUBTYPES.find((s) => s.id === subtype) ?? null,
    [subtype],
  );

  const destinationOptions = useMemo(() => {
    if (!subtypeDef?.needsDestination) return [];
    if (subtypeDef.id === "TRANSFERENCIA_INTERNA") return INTERNAL_TRANSFER_DESTINATIONS;
    if (subtypeDef.id === "TRANSFERENCIA_EXTERNA") return EXTERNAL_TRANSFER_DESTINATIONS;
    if (subtypeDef.id === "INTERNACAO") return INTERNMENT_DESTINATIONS;
    return [];
  }, [subtypeDef]);

  const requiredDocType: DischargeDocType | null = useMemo(() => {
    if (!subtypeDef) return null;
    if (subtypeDef.id === "ALTA_HOSPITALAR") return "alta_hospitalar";
    if (subtypeDef.id === "ALTA_PEDIDO") return "alta_pedido";
    if (subtypeDef.id === "OBITO") return "obito";
    return null;
  }, [subtypeDef]);

  const handleClose = () => {
    setStep("category");
    setCategory(null);
    setSubtype(null);
    setDestination("");
    setCustomDestination("");
    setNotes("");
    setResponsibleDoctor("");
    setDocPayload(null);
    setDocComplete(false);
    setConfirmOpen(false);
    onClose();
  };

  // Calcula pendências para o popup de confirmação (apenas docs de alta/óbito)
  const dischargeChecklist = useMemo(() => {
    if (!requiredDocType) return { blocking: [], soft: [] };
    const blocking: { label: string; reason: string }[] = [];
    const soft: { label: string }[] = [];
    const p = docPayload || ({} as Partial<DischargeDocPayload>);
    const empty = (v: any) => !String(v ?? "").trim();

    if (!responsibleDoctor.trim()) {
      blocking.push({ label: "Médico responsável", reason: "precisa estar sincronizado com o usuário logado." });
    }
    if (requiredDocType === "obito") {
      if (empty(p.death_date_time)) blocking.push({ label: "Data/hora do óbito", reason: "campo obrigatório." });
      if (empty(p.death_summary)) blocking.push({ label: "Resumo do óbito", reason: "relatório clínico obrigatório." });
    } else {
      if (empty(p.final_diagnoses)) blocking.push({ label: "Diagnósticos finais (CID)", reason: "obrigatórios para a alta." });
      if (empty(p.evolution_summary)) blocking.push({ label: "Resumo da evolução", reason: "obrigatório." });
      if (empty(p.discharge_summary)) blocking.push({ label: "Sumário de alta", reason: "síntese clínica obrigatória." });
      if (requiredDocType === "alta_hospitalar" && empty(p.orientations)) {
        blocking.push({ label: "Orientações ao paciente", reason: "obrigatórias na alta hospitalar." });
      }
    }
    if (empty(p.signed_by_name)) blocking.push({ label: "Médico assinante", reason: "nome do responsável obrigatório." });
    if (empty(p.signed_by_crm)) blocking.push({ label: "CRM", reason: "registro profissional obrigatório." });

    // Soft (opcionais — comunicação à família)
    if (empty(p.family_contact_name)) soft.push({ label: "Familiar comunicado" });
    if (empty(p.family_contact_relation)) soft.push({ label: "Grau de parentesco" });
    if (empty(p.family_contact_phone)) soft.push({ label: "Telefone do familiar" });
    if (empty(p.family_communication_mode)) soft.push({ label: "Modo de comunicação" });
    if (empty(p.family_satisfaction)) soft.push({ label: "Grau de satisfação na comunicação" });
    if (empty(p.family_communication_notes)) soft.push({ label: "Observações da comunicação" });

    return { blocking, soft };
  }, [requiredDocType, docPayload, responsibleDoctor]);

  const handleOpenConfirm = () => {
    if (!patient || !subtypeDef) return;
    if (subtypeDef.needsDestination && !destination && !customDestination) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, selecione ou especifique o destino.",
        variant: "destructive",
      });
      return;
    }
    // Sempre abrir o popup — a validação visual e o bloqueio acontecem dentro dele
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    if (!patient || !subtypeDef) return;
    // Revalida no submit (defesa em profundidade)
    if (requiredDocType && dischargeChecklist.blocking.length > 0) {
      toast({
        title: "Pendências obrigatórias",
        description: dischargeChecklist.blocking[0].label + " — " + dischargeChecklist.blocking[0].reason,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (!currentHospital || !currentState) {
        throw new Error("Hospital unit and state must be selected");
      }
      const { data: { user } } = await supabase.auth.getUser();
      const finalDestination = destination === "OUTRO" ? customDestination : destination;
      const patientDepartment = (patient as any).department || "URGÊNCIA E EMERGÊNCIA ADULTO";

      const { data: movRow, error } = await supabase.from("patient_movements").insert({
        patient_id: (patient as any).id || null,
        patient_name: patient.name,
        patient_bed: patient.bedNumber,
        patient_sector: patient.sector,
        movement_type: subtypeDef.id,
        destination: finalDestination || null,
        notes: notes || null,
        responsible_doctor: responsibleDoctor || null,
        created_by: user?.id,
        patient_snapshot: patient as any,
        department: patientDepartment,
        state_id: currentState.id,
        hospital_unit_id: currentHospital.id,
      }).select("id").single();
      if (error) throw error;

      // Persist discharge/death document linked to movement
      if (requiredDocType && docPayload) {
        const finalDoc: DischargeDocPayload = {
          ...docPayload,
          patient_name: patient.name,
          patient_bed: patient.bedNumber,
          patient_sector: patient.sector,
          signed_at: new Date().toISOString(),
        };
        const { error: docErr } = await supabase.from("discharge_documents").insert({
          document_type: requiredDocType,
          patient_id: (patient as any).id || null,
          patient_name: patient.name,
          patient_bed: patient.bedNumber,
          patient_sector: patient.sector,
          movement_id: movRow?.id ?? null,
          content: finalDoc as any,
          signed_by: user?.id,
          signed_by_name: finalDoc.signed_by_name || null,
          signed_by_crm: finalDoc.signed_by_crm || null,
          signed_at: finalDoc.signed_at,
          hospital_unit_id: currentHospital.id,
          state_id: currentState.id,
          department: patientDepartment,
          created_by: user?.id,
        });
        if (docErr) throw docErr;

        // Marca o paciente como alta/óbito (mantém no leito até liberação física)
        const newAdmissionStatus = requiredDocType === "obito" ? "obito" : "alta_dada";
        if ((patient as any).id) {
          await supabase
            .from("patients")
            .update({ admission_status: newAdmissionStatus, updated_at: new Date().toISOString() })
            .eq("id", (patient as any).id);
        }

        // Auto preview the printable Norma Zero document
        printDischargeDocument(requiredDocType, finalDoc);
      }

      toast({
        title: `${subtypeDef.label} registrado(a)`,
        description: requiredDocType
          ? "Documento salvo no histórico do paciente."
          : "Movimentação registrada no histórico.",
      });

      setConfirmOpen(false);
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error creating movement:", error);
      toast({
        title: "Erro ao registrar movimentação",
        description: "Não foi possível registrar a movimentação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!patient) return null;

  /* ───────── Step 1: Category ───────── */
  const renderCategoryStep = () => (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
        Selecione o tipo de movimentação
      </p>
      <div className="grid grid-cols-1 gap-2.5">
        {MOVEMENT_CATEGORIES.map((cat) => {
          const t = TONE_CLASSES[cat.tone];
          const Icon = cat.icon;
          const count = getSubtypesByCategory(cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategory(cat.id);
                setStep("subtype");
              }}
              className={cn(
                "group flex items-center gap-4 p-4 rounded-xl border bg-card text-left transition-all",
                t.border,
                t.hoverBorder,
                "hover:shadow-md hover:-translate-y-0.5",
              )}
            >
              <div className={cn("h-11 w-11 rounded-lg flex items-center justify-center", t.bg)}>
                <Icon className={cn("h-5 w-5", t.icon)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm uppercase tracking-wide">{cat.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/70">
                <span className="text-[10px] uppercase tracking-wider">{count} opções</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ───────── Step 2: Subtype ───────── */
  const renderSubtypeStep = () => {
    if (!category) return null;
    const cat = MOVEMENT_CATEGORIES.find((c) => c.id === category)!;
    const t = TONE_CLASSES[cat.tone];
    const items = getSubtypesByCategory(category);
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setStep("category")}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </button>
        <div className="grid grid-cols-1 gap-2">
          {items.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSubtype(s.id);
                  setStep("form");
                }}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-lg border bg-card text-left transition-all",
                  t.border,
                  t.hoverBorder,
                  "hover:shadow-sm",
                )}
              >
                <div className={cn("h-9 w-9 rounded-md flex items-center justify-center", t.bg)}>
                  <Icon className={cn("h-4 w-4", t.icon)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
                {s.linksToDischargeSummary && (
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    + Sumário
                  </span>
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ───────── Step 3: Form ───────── */
  const renderFormStep = () => {
    if (!subtypeDef) return null;
    const cat = MOVEMENT_CATEGORIES.find((c) => c.id === subtypeDef.category)!;
    const t = TONE_CLASSES[cat.tone];
    const Icon = subtypeDef.icon;
    return (
      <div className="space-y-4">
        {/* Selection summary */}
        <div className={cn("flex items-center gap-3 p-3 rounded-lg border", t.bg, t.border)}>
          <Icon className={cn("h-5 w-5", t.icon)} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {cat.label}
            </p>
            <p className="font-semibold text-sm">{subtypeDef.label}</p>
          </div>
          {/* Only allow changing if not pre-set from card */}
          {!movementType && (
            <button
              type="button"
              onClick={() => setStep("subtype")}
              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Alterar
            </button>
          )}
        </div>

        {/* Patient */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Paciente
          </Label>
          <div className="p-3 bg-muted/60 rounded-lg">
            <p className="font-medium text-sm">{patient.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Leito: {patient.bedNumber} • Setor: {patient.sector}
            </p>
          </div>
        </div>

        {/* Destination */}
        {subtypeDef.needsDestination && (
          <div className="space-y-1.5">
            <Label htmlFor="destination" className="text-xs uppercase tracking-wider">
              Destino *
            </Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger id="destination">
                <SelectValue placeholder="Selecione o destino" />
              </SelectTrigger>
              <SelectContent>
                {destinationOptions.map((dest) => (
                  <SelectItem key={dest} value={dest}>
                    {dest}
                  </SelectItem>
                ))}
                <SelectItem value="OUTRO">OUTRO (especificar)</SelectItem>
              </SelectContent>
            </Select>
            {destination === "OUTRO" && (
              <Input
                placeholder="Especifique o destino"
                value={customDestination}
                onChange={(e) => setCustomDestination(e.target.value.toUpperCase())}
                className="mt-2 uppercase"
              />
            )}
          </div>
        )}

        {/* Doctor — pré-preenchido com o usuário logado */}
        <div className="space-y-1.5">
          <Label htmlFor="responsibleDoctor" className="text-xs uppercase tracking-wider flex items-center gap-2">
            Médico Responsável
            {signerProfile.name && (
              <span className="text-[10px] normal-case text-muted-foreground">
                (sincronizado com o login{signerProfile.crm ? ` • CRM ${signerProfile.crm}` : ""})
              </span>
            )}
          </Label>
          <Input
            id="responsibleDoctor"
            placeholder="Nome do médico"
            value={responsibleDoctor}
            onChange={(e) => setResponsibleDoctor(e.target.value.toUpperCase())}
            className="uppercase"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs uppercase tracking-wider">
            Observações
          </Label>
          <Textarea
            id="notes"
            placeholder="Adicione observações sobre esta movimentação (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value.toUpperCase())}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Required document for Alta / Óbito */}
        {requiredDocType && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-[11px] text-foreground leading-relaxed">
                {requiredDocType === "obito"
                  ? "É obrigatório preencher o Relatório de Óbito antes de confirmar."
                  : "É obrigatório preencher o Sumário de Alta antes de confirmar."}{" "}
                O documento será arquivado no histórico do paciente e impresso em padrão Norma Zero.
              </p>
            </div>
            <DischargeDocumentForm
              key={`${requiredDocType}-${signerProfile.name}-${signerProfile.crm}`}
              type={requiredDocType}
              initial={{
                patient_name: patient.name,
                patient_bed: patient.bedNumber,
                patient_sector: patient.sector,
                hospital_name: currentHospital?.name,
                signed_by_name: responsibleDoctor || signerProfile.name || undefined,
                signed_by_crm: signerProfile.crm || undefined,
              }}
              onChange={(payload, complete) => { setDocPayload(payload); setDocComplete(complete); }}
            />
          </div>
        )}

        {/* Legacy hint (other linked subtypes) */}
        {!requiredDocType && subtypeDef.linksToDischargeSummary && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/60">
            <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Documento complementar disponível em <span className="font-medium text-foreground">/alta-desfecho</span>.
            </p>
          </div>
        )}
      </div>
    );
  };

  const headerCat = category ? MOVEMENT_CATEGORIES.find((c) => c.id === category) : null;
  const headerTone = headerCat ? TONE_CLASSES[headerCat.tone] : null;
  const HeaderIcon = subtypeDef?.icon ?? headerCat?.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto", requiredDocType ? "sm:max-w-[760px]" : "sm:max-w-[520px]")}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            {HeaderIcon && headerTone && (
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", headerTone.bg)}>
                <HeaderIcon className={cn("h-5 w-5", headerTone.icon)} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">
                {step === "form" && subtypeDef
                  ? subtypeDef.label
                  : step === "subtype" && headerCat
                  ? headerCat.label
                  : "Registrar Movimentação"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {step === "form" && subtypeDef
                  ? subtypeDef.description
                  : step === "subtype" && headerCat
                  ? `Escolha o subtipo de ${headerCat.label.toLowerCase()}`
                  : "Fluxo de movimentação do paciente"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          {step === "category" && renderCategoryStep()}
          {step === "subtype" && renderSubtypeStep()}
          {step === "form" && renderFormStep()}
        </div>

        {step === "form" && (
          <DialogFooter className="gap-2 sm:gap-2 sm:flex-col sm:items-stretch">
            {requiredDocType && dischargeChecklist.blocking.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-[11px] text-warning-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                <span>
                  Há {dischargeChecklist.blocking.length} pendência(s) obrigatória(s). Você poderá ver o detalhe ao clicar em <strong>Revisar e confirmar</strong>.
                </span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleOpenConfirm}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? "Registrando..."
                  : requiredDocType ? "Revisar e confirmar" : "Confirmar"}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>

      {/* Popup didático para alta/óbito (com checklist clínico do documento) */}
      {requiredDocType && (
        <DischargeConfirmDialog
          open={confirmOpen}
          onOpenChange={(o) => !isSubmitting && setConfirmOpen(o)}
          onConfirm={handleSubmit}
          isSubmitting={isSubmitting}
          docType={requiredDocType}
          payload={docPayload}
          patient={patient ? { name: patient.name, bedNumber: patient.bedNumber, sector: patient.sector } : null}
          responsibleDoctor={responsibleDoctor}
          movementLabel={subtypeDef?.label || "Movimentação"}
          destination={destination === "OUTRO" ? customDestination : destination}
          notes={notes}
          blockingMissing={dischargeChecklist.blocking}
          softMissing={dischargeChecklist.soft}
        />
      )}

      {/* Popup didático genérico para transferências e demais movimentações */}
      {!requiredDocType && subtypeDef && (
        <MovementConfirmDialog
          open={confirmOpen}
          onOpenChange={(o) => !isSubmitting && setConfirmOpen(o)}
          onConfirm={handleSubmit}
          isSubmitting={isSubmitting}
          tone={subtypeDef.id === "EVASAO" ? "destructive" : "primary"}
          title={`Confirmar ${subtypeDef.label}`}
          confirmLabel={`Confirmar ${subtypeDef.label}`}
          summary={[
            { icon: User, label: "Paciente", value: patient.name },
            { icon: Bed, label: "Leito atual / Setor", value: `${patient.bedNumber} • ${patient.sector}` },
            ...(subtypeDef.needsDestination
              ? [{ icon: MapPin, label: "Destino", value: (destination === "OUTRO" ? customDestination : destination) || "—" } as MovementSummaryItem]
              : []),
            { icon: Stethoscope, label: "Médico responsável", value: responsibleDoctor || "—" },
            ...(notes ? [{ icon: Info, label: "Observações", value: notes, fullWidth: true } as MovementSummaryItem] : []),
          ]}
          consequences={(() => {
            const base: MovementConsequence[] = [
              { icon: ClipboardList, text: <>A movimentação <strong>"{subtypeDef.label}"</strong> será gravada na <strong>linha do tempo do paciente</strong> e na auditoria do hospital, com seu usuário como responsável.</> },
            ];
            if (subtypeDef.id === "TRANSFERENCIA_INTERNA") {
              base.push(
                { icon: ArrowRightLeft, text: <>O paciente será marcado como em <strong>trânsito interno</strong> para o setor destino. O leito atual <strong>permanece reservado</strong> até a confirmação administrativa de chegada.</> },
                { icon: Bed, text: <>A liberação do leito de origem e a alocação efetiva no leito de destino são feitas em <strong>etapa separada</strong> pela equipe NIR/regulação.</> },
              );
            } else if (subtypeDef.id === "TRANSFERENCIA_EXTERNA") {
              base.push(
                { icon: Building2, text: <>O paciente será marcado como <strong>transferido para outra instituição</strong>. O censo do hospital reflete a saída assistencial, mas o registro permanece consultável.</> },
                { icon: Bed, text: <>O leito vai para <strong>limpeza/disponibilização</strong> conforme rotina do setor administrativo — não é apagado neste momento.</> },
              );
            } else if (subtypeDef.id === "EVASAO") {
              base.push(
                { icon: AlertTriangle, text: <>Esta é uma <strong>saída sem alta médica</strong>. Recomenda-se descrever nas observações o contexto (local, horário, ciência da equipe e família, se houver).</> },
                { icon: Bed, text: <>O leito será liberado pela equipe administrativa em etapa posterior. O prontuário continua disponível para auditoria.</> },
              );
            }
            base.push(
              { icon: Eye, text: <><strong>O paciente continua visível no sistema</strong> — esta ação não remove nem apaga o registro. Ele permanece em buscas, relatórios e no histórico longitudinal.</> },
              { icon: History, text: <>Você pode consultar todas as movimentações deste paciente em <strong>Histórico do Paciente</strong>.</> },
            );
            return base;
          })()}
          warnings={
            subtypeDef.needsDestination && !(destination === "OUTRO" ? customDestination : destination)
              ? []
              : !notes
              ? [{ label: "Observações em branco", detail: "recomendamos descrever o motivo da movimentação para auditoria." }]
              : []
          }
          blockers={[
            ...(subtypeDef.needsDestination && !(destination === "OUTRO" ? customDestination : destination)
              ? [{ label: "Destino", reason: "selecione o destino antes de confirmar." }]
              : []),
            ...(!responsibleDoctor.trim()
              ? [{ label: "Médico responsável", reason: "informe o profissional responsável pela movimentação." }]
              : []),
          ]}
          finalNote={<>Esta ação é <strong className="text-foreground">reversível apenas via auditoria administrativa</strong>. Confirme apenas se todos os dados estiverem corretos.</>}
        />
      )}
    </Dialog>
  );
}
