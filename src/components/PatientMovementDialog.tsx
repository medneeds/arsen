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
import { ArrowLeft, ArrowRight, FileText, Loader2, AlertTriangle } from "lucide-react";
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

  const handleClose = () => {
    setStep("category");
    setCategory(null);
    setSubtype(null);
    setDestination("");
    setCustomDestination("");
    setNotes("");
    setResponsibleDoctor("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!patient || !subtypeDef) return;

    if (subtypeDef.needsDestination && !destination && !customDestination) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, selecione ou especifique o destino.",
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

      const { error } = await supabase.from("patient_movements").insert({
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
      });
      if (error) throw error;

      toast({
        title: `${subtypeDef.label} registrado(a)`,
        description: subtypeDef.linksToDischargeSummary
          ? "Você pode complementar com o sumário de alta."
          : "Movimentação registrada no histórico.",
      });

      // Hybrid flow: offer link to discharge summary
      if (subtypeDef.linksToDischargeSummary) {
        const goSummary = window.confirm(
          "Deseja complementar agora com o Sumário de Alta detalhado?",
        );
        if (goSummary) {
          navigate(
            `/alta-desfecho?patient=${encodeURIComponent(patient.name)}&bed=${encodeURIComponent(patient.bedNumber)}`,
          );
        }
      }

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

        {/* Doctor */}
        <div className="space-y-1.5">
          <Label htmlFor="responsibleDoctor" className="text-xs uppercase tracking-wider">
            Médico Responsável
          </Label>
          <Input
            id="responsibleDoctor"
            placeholder="Nome do médico (opcional)"
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

        {/* Hint about discharge summary */}
        {subtypeDef.linksToDischargeSummary && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/60">
            <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Após confirmar, você poderá complementar este registro com o{" "}
              <span className="font-medium text-foreground">Sumário de Alta</span> detalhado
              (diagnósticos, condutas, prescrição).
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
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
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
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Registrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
