/**
 * Diálogo de Solicitação de SAT (Soro Antitetânico) ou IGHAT.
 *
 * Baseado no protocolo do Ministério da Saúde (PNI):
 *  - SAT: 5.000 UI IM (adulto) — produto heterólogo (equino).
 *  - IGHAT (imunoglobulina humana antitetânica): 250 UI IM — alternativa
 *    em pacientes com história de hipersensibilidade a soro heterólogo.
 *  - Indicação por classificação do ferimento + situação vacinal.
 *
 * Persistência: Fase 0 — registra como exam_request com category="sat" e
 * scope=especial. Na Fase 1 será migrado para tabela dedicada `sat_requests`.
 */

import { useEffect, useMemo, useState } from "react";
import { Syringe, Printer, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CollapsibleInfoCard } from "@/components/shared/CollapsibleInfoCard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { asUuidOrNull } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId?: string | null;
  patientName?: string;
  patientBed?: string;
  patientSector?: string;
}

type Product = "sat" | "ighat" | "vat";
type WoundClass = "limpo_superficial" | "outras" | "alto_risco";
type VaccinationStatus = "completa_recente" | "completa_antiga" | "incompleta_ou_desconhecida";

const PRODUCT_LABEL: Record<Product, string> = {
  sat: "SAT — Soro Antitetânico (heterólogo, 5.000 UI IM)",
  ighat: "IGHAT — Imunoglobulina Humana Antitetânica (250 UI IM)",
  vat: "Vacina dT (toxoide tetânico) — 0,5 mL IM",
};

const WOUND_LABEL: Record<WoundClass, string> = {
  limpo_superficial: "Ferimento limpo e superficial",
  outras: "Outras condições (ferimento contaminado/profundo)",
  alto_risco:
    "Alto risco (queimadura, mordedura, fratura exposta, trauma com tecido desvitalizado, corpo estranho, ferida puntiforme)",
};

const VACCINATION_LABEL: Record<VaccinationStatus, string> = {
  completa_recente: "Esquema completo, última dose < 5 anos",
  completa_antiga: "Esquema completo, última dose ≥ 5 anos",
  incompleta_ou_desconhecida: "Esquema incompleto, desconhecido ou < 3 doses",
};

/** Tabela do PNI: combina situação vacinal + tipo de ferimento → conduta. */
function recommendConduct(wound: WoundClass, vac: VaccinationStatus): {
  vat: boolean;
  sat: boolean;
  rationale: string;
} {
  // Esquema completo recente (< 5 anos): nada a fazer em maioria
  if (vac === "completa_recente") {
    if (wound === "alto_risco") {
      return { vat: false, sat: false, rationale: "Esquema completo recente — geralmente sem necessidade de reforço." };
    }
    return { vat: false, sat: false, rationale: "Esquema completo recente — sem necessidade de vacina ou soro." };
  }
  // Completo antigo (≥ 5 anos)
  if (vac === "completa_antiga") {
    if (wound === "limpo_superficial") {
      return { vat: true, sat: false, rationale: "Reforço vacinal (dT) recomendado pelo intervalo > 5 anos." };
    }
    return { vat: true, sat: false, rationale: "Reforço vacinal (dT). SAT/IGHAT geralmente não indicados se imunidade prévia." };
  }
  // Incompleto / desconhecido
  if (wound === "limpo_superficial") {
    return { vat: true, sat: false, rationale: "Iniciar/completar esquema vacinal (dT). SAT não indicado para ferimento limpo." };
  }
  return {
    vat: true,
    sat: true,
    rationale: "Esquema incompleto + ferimento de risco → indicar VAT + SAT (ou IGHAT se hipersensibilidade).",
  };
}

export function SatRequestDialog({
  open,
  onOpenChange,
  patientId,
  patientName = "",
  patientBed = "",
  patientSector = "",
}: Props) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const sectorLabel = patientSector ? (SECTOR_DISPLAY[patientSector] || patientSector) : "";

  const [wound, setWound] = useState<WoundClass>("outras");
  const [vac, setVac] = useState<VaccinationStatus>("incompleta_ou_desconhecida");
  const [product, setProduct] = useState<Product>("sat");
  const [dose, setDose] = useState<string>("5000 UI");
  const [route, setRoute] = useState<string>("IM (deltoide / ventroglútea)");
  const [allergyHistory, setAllergyHistory] = useState<"sim" | "nao" | "desconhecido">("desconhecido");
  const [woundDescription, setWoundDescription] = useState("");
  const [woundLocation, setWoundLocation] = useState("");
  const [traumaDate, setTraumaDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [traumaTime, setTraumaTime] = useState(() => format(new Date(), "HH:mm"));
  const [doctorName, setDoctorName] = useState(user?.email?.split("@")[0] || "");
  const [doctorCrm, setDoctorCrm] = useState("");
  const [observations, setObservations] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [patientRecord, setPatientRecord] = useState<string>("");
  const [patientBirth, setPatientBirth] = useState<string>("");

  // Pré-carrega dados do médico + paciente
  useEffect(() => {
    if (!open) return;
    (async () => {
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, crm")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.full_name) setDoctorName(prof.full_name);
        if (prof?.crm) setDoctorCrm(prof.crm);
      }
      const validId = asUuidOrNull(patientId);
      if (validId) {
        const { data: p } = await supabase
          .from("patients")
          .select("medical_record, patient_registry_id")
          .eq("id", validId)
          .maybeSingle();
        if (p) {
          setPatientRecord(p.medical_record || "");
          if (p.patient_registry_id) {
            const { data: r } = await supabase
              .from("patient_registry")
              .select("birth_date, medical_record")
              .eq("id", p.patient_registry_id)
              .maybeSingle();
            if (r?.birth_date) setPatientBirth(r.birth_date);
            if (r?.medical_record) setPatientRecord(r.medical_record);
          }
        }
      }
    })();
  }, [open, user?.id, patientId]);

  // Recomendação dinâmica do PNI
  const recommendation = useMemo(() => recommendConduct(wound, vac), [wound, vac]);

  // Auto-ajusta produto sugerido conforme alergia
  useEffect(() => {
    if (recommendation.sat) {
      setProduct(allergyHistory === "sim" ? "ighat" : "sat");
      setDose(allergyHistory === "sim" ? "250 UI" : "5000 UI");
    } else if (recommendation.vat) {
      setProduct("vat");
      setDose("0,5 mL");
    }
  }, [recommendation.sat, recommendation.vat, allergyHistory]);

  const handleSubmit = async () => {
    if (!patientName?.trim()) {
      toast.error("Paciente não identificado");
      return;
    }
    if (!currentHospital?.id || !currentState?.id) {
      toast.error("Selecione hospital/estado");
      return;
    }
    if (!doctorName.trim()) {
      toast.error("Informe o médico solicitante");
      return;
    }
    if (!woundDescription.trim()) {
      toast.error("Descreva o ferimento");
      return;
    }

    setSubmitting(true);
    try {
      const validId = asUuidOrNull(patientId);
      const payload: any = {
        category: "sat",
        patient_id: validId,
        patient_name: patientName,
        patient_bed: patientBed || null,
        patient_sector: patientSector || null,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        priority: recommendation.sat ? "urgente" : "rotina",
        clinical_indication:
          `${WOUND_LABEL[wound]} | Vacinação: ${VACCINATION_LABEL[vac]} | Conduta: ${recommendation.rationale}`,
        items: [
          {
            name: PRODUCT_LABEL[product],
            dose,
            route,
            wound_class: wound,
            vaccination_status: vac,
            allergy_history: allergyHistory,
            wound_description: woundDescription,
            wound_location: woundLocation,
            trauma_at: `${traumaDate}T${traumaTime || "00:00"}`,
          },
        ],
        notes: [
          `Médico: ${doctorName}${doctorCrm ? " — CRM " + doctorCrm : ""}`,
          observations.trim() && `Obs: ${observations.trim()}`,
        ]
          .filter(Boolean)
          .join("\n"),
        requested_by: user?.id || null,
        requested_by_name: doctorName,
        status: "pending",
      };

      const { error } = await supabase.from("exam_requests").insert(payload);
      if (error) throw error;

      toast.success("Solicitação de SAT registrada");
      onOpenChange(false);
    } catch (e: any) {
      console.error("[SatRequestDialog] insert error", e);
      toast.error(e?.message || "Erro ao registrar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) return;
    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const productLabel = PRODUCT_LABEL[product];
    w.document.write(`
      <html><head><title>Solicitação SAT — ${patientName}</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 32px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        h2 { font-size: 13px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .04em; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
        .row { display: flex; gap: 24px; font-size: 13px; margin-bottom: 6px; }
        .row b { min-width: 130px; display: inline-block; color: #333; }
        .box { border: 1px solid #ccc; border-radius: 6px; padding: 12px; font-size: 13px; }
        .sig { margin-top: 60px; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; text-align: center; }
      </style></head><body>
        <h1>Solicitação de Imunização — Profilaxia do Tétano</h1>
        <div class="meta">${currentHospital?.name || ""} • Emitido em ${now}</div>

        <h2>Paciente</h2>
        <div class="row"><b>Nome:</b> ${patientName}</div>
        <div class="row"><b>Setor / Leito:</b> ${patientSector || "—"} / ${patientBed || "—"}</div>

        <h2>Avaliação clínica</h2>
        <div class="row"><b>Tipo de ferimento:</b> ${WOUND_LABEL[wound]}</div>
        <div class="row"><b>Localização:</b> ${woundLocation || "—"}</div>
        <div class="row"><b>Data/hora trauma:</b> ${traumaDate} ${traumaTime}</div>
        <div class="row"><b>Descrição:</b> ${woundDescription}</div>
        <div class="row"><b>Status vacinal:</b> ${VACCINATION_LABEL[vac]}</div>
        <div class="row"><b>Alergia a soro:</b> ${allergyHistory}</div>

        <h2>Conduta indicada</h2>
        <div class="box">
          <div><b>${productLabel}</b></div>
          <div>Dose: ${dose} • Via: ${route}</div>
          <div style="margin-top:6px; color:#444">${recommendation.rationale}</div>
        </div>

        ${observations ? `<h2>Observações</h2><div class="box">${observations}</div>` : ""}

        <div class="sig">${doctorName}${doctorCrm ? " — CRM " + doctorCrm : ""}<br>Médico solicitante</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-amber-600" />
            Solicitação de SAT / Imunização Antitetânica
          </DialogTitle>
          <DialogDescription>
            Profilaxia do tétano conforme classificação do ferimento e situação vacinal (PNI/MS).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Identificação retrátil — paciente já carregado */}
          <CollapsibleInfoCard
            title="Identificação do paciente"
            summary={patientName || "—"}
            badge={[patientSector, patientBed].filter(Boolean).join(" · ") || undefined}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs">Paciente</Label>
                <Input value={patientName} readOnly className="bg-muted/40" />
              </div>
              <div>
                <Label className="text-xs">Setor</Label>
                <Input value={patientSector || "—"} readOnly className="bg-muted/40" />
              </div>
              <div>
                <Label className="text-xs">Leito</Label>
                <Input value={patientBed || "—"} readOnly className="bg-muted/40" />
              </div>
              <div>
                <Label className="text-xs">N° prontuário</Label>
                <Input value={patientRecord} readOnly className="bg-muted/40" />
              </div>
              <div>
                <Label className="text-xs">Data de nascimento</Label>
                <Input type="date" value={patientBirth} readOnly className="bg-muted/40" />
              </div>
            </div>
          </CollapsibleInfoCard>

          {/* Avaliação do ferimento */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">1. Tipo de ferimento</Label>
            <RadioGroup value={wound} onValueChange={(v) => setWound(v as WoundClass)} className="space-y-2">
              {(Object.keys(WOUND_LABEL) as WoundClass[]).map((k) => (
                <label key={k} className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border/50 hover:bg-muted/40">
                  <RadioGroupItem value={k} id={`wound-${k}`} className="mt-0.5" />
                  <span className="text-xs leading-snug">{WOUND_LABEL[k]}</span>
                </label>
              ))}
            </RadioGroup>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div>
                <Label className="text-xs">Localização</Label>
                <Input value={woundLocation} onChange={(e) => setWoundLocation(e.target.value)} placeholder="Ex: face anterior da perna D" />
              </div>
              <div>
                <Label className="text-xs">Data do trauma</Label>
                <Input type="date" value={traumaDate} onChange={(e) => setTraumaDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Hora</Label>
                <Input type="time" value={traumaTime} onChange={(e) => setTraumaTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição do ferimento</Label>
              <Textarea
                rows={2}
                value={woundDescription}
                onChange={(e) => setWoundDescription(e.target.value)}
                placeholder="Mecanismo, profundidade, contaminação, sinais de infecção..."
              />
            </div>
          </div>

          <Separator />

          {/* Status vacinal */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">2. Situação vacinal</Label>
            <RadioGroup value={vac} onValueChange={(v) => setVac(v as VaccinationStatus)} className="space-y-2">
              {(Object.keys(VACCINATION_LABEL) as VaccinationStatus[]).map((k) => (
                <label key={k} className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border/50 hover:bg-muted/40">
                  <RadioGroupItem value={k} id={`vac-${k}`} className="mt-0.5" />
                  <span className="text-xs leading-snug">{VACCINATION_LABEL[k]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Alergia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">3. História de hipersensibilidade a soro heterólogo?</Label>
              <Select value={allergyHistory} onValueChange={(v) => setAllergyHistory(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim — preferir IGHAT</SelectItem>
                  <SelectItem value="desconhecido">Desconhecido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recomendação automática */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Conduta sugerida (PNI/MS)
            </div>
            <p className="text-xs text-foreground/80">{recommendation.rationale}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {recommendation.vat && <Badge variant="outline" className="text-[10px]">Vacina dT</Badge>}
              {recommendation.sat && (
                <Badge variant="outline" className="text-[10px] border-amber-500/40">
                  {allergyHistory === "sim" ? "IGHAT 250 UI IM" : "SAT 5.000 UI IM"}
                </Badge>
              )}
              {!recommendation.vat && !recommendation.sat && (
                <Badge variant="outline" className="text-[10px]">Apenas cuidados locais</Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Produto efetivamente solicitado */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">4. Produto solicitado</Label>
            <Select value={product} onValueChange={(v) => setProduct(v as Product)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PRODUCT_LABEL) as Product[]).map((k) => (
                  <SelectItem key={k} value={k}>{PRODUCT_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dose</Label>
                <Input value={dose} onChange={(e) => setDose(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Via / sítio</Label>
                <Input value={route} onChange={(e) => setRoute(e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Médico + obs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Médico solicitante</Label>
              <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">CRM</Label>
              <Input value={doctorCrm} onChange={(e) => setDoctorCrm(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Reações prévias, comorbidades, etc." />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={submitting}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Syringe className="h-4 w-4 mr-1.5" />}
            Registrar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
