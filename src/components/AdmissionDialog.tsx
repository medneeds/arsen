import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CidSearchInput } from "@/components/CidSearchInput";
import {
  Stethoscope, Loader2, AlertTriangle, ClipboardCheck,
  HeartPulse, Activity, FileText, Pill, CalendarDays, Hash,
  Printer, ShieldCheck, Save, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printAdmissionNormaZero } from "@/lib/printAdmission";
import { parseDiagnosesText } from "@/lib/diagnosesText";

const UTI_SECTORS = ["red", "yellow", "outside", "uti_01", "uti_02", "uci_02"];

/** Chave do rascunho local por paciente */
const draftKeyFor = (patientId: string) => `admission_draft:v1:${patientId}`;

/** Label com sinalização forte de obrigatoriedade */
const ReqLabel = ({ children, missing }: { children: React.ReactNode; missing?: boolean }) => (
  <Label className={cn(
    "text-xs flex items-center gap-1.5",
    missing ? "text-rose-700" : "text-slate-700"
  )}>
    <span>{children}</span>
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wider",
      missing
        ? "bg-rose-100 text-rose-700 ring-1 ring-rose-300"
        : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
    )}>
      <span className="leading-none">*</span> Obrigatório
    </span>
  </Label>
);

/** Classe utilitária pra realçar campo faltante após tentativa de submit */
const reqRing = (missing?: boolean) =>
  missing ? "ring-2 ring-rose-300 border-rose-400 focus-visible:ring-rose-400" : "";

interface AdmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    name: string;
    bed: string;
    sector: string;
    age?: string | number;
    department?: string;
  };
  onSuccess?: () => void;
}

/* ───────── Helpers ───────── */

const parseLocale = (v: string): number => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const computeImc = (weightStr: string, heightStr: string) => {
  const w = parseLocale(weightStr);
  let h = parseLocale(heightStr);
  if (!w || !h) return null;
  // accept altura em cm (ex: 170) ou m (ex: 1.70)
  if (h > 3) h = h / 100;
  const imc = w / (h * h);
  if (!Number.isFinite(imc) || imc <= 0) return null;
  let label = "";
  let color = "text-slate-600";
  if (imc < 18.5) { label = "Baixo peso"; color = "text-amber-600"; }
  else if (imc < 25) { label = "Eutrófico"; color = "text-emerald-600"; }
  else if (imc < 30) { label = "Sobrepeso"; color = "text-amber-600"; }
  else if (imc < 35) { label = "Obesidade I"; color = "text-orange-600"; }
  else if (imc < 40) { label = "Obesidade II"; color = "text-red-600"; }
  else { label = "Obesidade III"; color = "text-red-700"; }
  return { value: imc.toFixed(1), label, color };
};

const toIsoDate = (d: Date) => {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const daysFromToday = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

const diffDaysFromToday = (iso: string) => {
  if (!iso) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86400000);
};

const formatBr = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/* ───────── Section card ───────── */

const Section = ({
  icon: Icon, title, hint, children, tone = "slate",
}: {
  icon: any; title: string; hint?: string; children: React.ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber";
}) => {
  const tones = {
    slate: "border-slate-200 bg-slate-50/40",
    blue: "border-blue-200 bg-blue-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
    amber: "border-amber-200 bg-amber-50/40",
  } as const;
  const iconTones = {
    slate: "text-slate-500", blue: "text-blue-600",
    emerald: "text-emerald-600", amber: "text-amber-600",
  } as const;
  return (
    <section className={cn("rounded-lg border p-4 space-y-3", tones[tone])}>
      <header className="flex items-center gap-2 -mt-1">
        <Icon className={cn("h-4 w-4", iconTones[tone])} />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</h4>
        {hint && <span className="ml-auto text-[10px] text-slate-500">{hint}</span>}
      </header>
      {children}
    </section>
  );
};

/* ───────── Component ───────── */

export function AdmissionDialog({ open, onOpenChange, patient, onSuccess }: AdmissionDialogProps) {
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { user } = useAuth();
  const isUti = useMemo(() => UTI_SECTORS.includes(patient.sector), [patient.sector]);

  // SAPS 3 acknowledgement (apenas UTI/UCI)
  const [sapsAck, setSapsAck] = useState(false);

  // Common fields
  const [hda, setHda] = useState("");
  const [amp, setAmp] = useState("");
  const [muc, setMuc] = useState("");
  const [allergies, setAllergies] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [pa, setPa] = useState("");
  const [fc, setFc] = useState("");
  const [fr, setFr] = useState("");
  const [spo2, setSpo2] = useState("");
  const [tax, setTax] = useState("");
  const [dx, setDx] = useState("");
  const [physGeneral, setPhysGeneral] = useState("");
  const [physCv, setPhysCv] = useState("");
  const [physResp, setPhysResp] = useState("");
  const [physAbd, setPhysAbd] = useState("");
  const [physExt, setPhysExt] = useState("");
  const [physNeuro, setPhysNeuro] = useState("");
  const [plan, setPlan] = useState("");
  const [cidPrimary, setCidPrimary] = useState("");
  const [cidSecondary, setCidSecondary] = useState("");
  const [diagnosticHypotheses, setDiagnosticHypotheses] = useState("");

  // Discharge prediction — sincronização dias <-> data
  const [noPrediction, setNoPrediction] = useState(false);
  const [predictionDate, setPredictionDate] = useState<string>(() => toIsoDate(daysFromToday(5)));
  const [predictionDays, setPredictionDays] = useState<string>("5");

  // UTI extras
  const [admissionReason, setAdmissionReason] = useState("");
  const [originSector, setOriginSector] = useState("");
  const [devices, setDevices] = useState("");
  const [culturesAtb, setCulturesAtb] = useState("");
  const [specialties, setSpecialties] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const imc = useMemo(() => computeImc(weight, height), [weight, height]);

  /* ───────── Rascunho automático (localStorage) ───────── */
  // Restaura ao abrir
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(draftKeyFor(patient.id));
      if (raw) {
        const d = JSON.parse(raw);
        setHda(d.hda ?? ""); setAmp(d.amp ?? ""); setMuc(d.muc ?? "");
        setAllergies(d.allergies ?? ""); setWeight(d.weight ?? ""); setHeight(d.height ?? "");
        setPa(d.pa ?? ""); setFc(d.fc ?? ""); setFr(d.fr ?? ""); setSpo2(d.spo2 ?? "");
        setTax(d.tax ?? ""); setDx(d.dx ?? "");
        setPhysGeneral(d.physGeneral ?? ""); setPhysCv(d.physCv ?? "");
        setPhysResp(d.physResp ?? ""); setPhysAbd(d.physAbd ?? ""); setPhysExt(d.physExt ?? ""); setPhysNeuro(d.physNeuro ?? "");
        setPlan(d.plan ?? ""); setCidPrimary(d.cidPrimary ?? ""); setCidSecondary(d.cidSecondary ?? "");
        setDiagnosticHypotheses(d.diagnosticHypotheses ?? "");
        setNoPrediction(!!d.noPrediction);
        if (d.predictionDate) setPredictionDate(d.predictionDate);
        if (d.predictionDays) setPredictionDays(d.predictionDays);
        setAdmissionReason(d.admissionReason ?? ""); setOriginSector(d.originSector ?? "");
        setDevices(d.devices ?? ""); setCulturesAtb(d.culturesAtb ?? "");
        setSpecialties(d.specialties ?? "");
        if (d.savedAt) setDraftSavedAt(new Date(d.savedAt));
      }
    } catch {}
    setDraftHydrated(true);
    return () => { setDraftHydrated(false); setAttempted(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient.id]);

  // Salva (debounced) a cada mudança
  useEffect(() => {
    if (!open || !draftHydrated) return;
    const t = setTimeout(() => {
      try {
        const payload = {
          hda, amp, muc, allergies, weight, height, pa, fc, fr, spo2, tax, dx,
          physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
          plan, cidPrimary, cidSecondary, diagnosticHypotheses,
          noPrediction, predictionDate, predictionDays,
          admissionReason, originSector, devices, culturesAtb, specialties,
          savedAt: new Date().toISOString(),
        };
        // só persiste se houver algum conteúdo
        const hasContent = Object.values(payload).some(v => typeof v === "string" && v.trim().length > 0);
        if (hasContent) {
          localStorage.setItem(draftKeyFor(patient.id), JSON.stringify(payload));
          setDraftSavedAt(new Date());
        }
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [
    open, draftHydrated, patient.id,
    hda, amp, muc, allergies, weight, height, pa, fc, fr, spo2, tax, dx,
    physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
    plan, cidPrimary, cidSecondary, diagnosticHypotheses,
    noPrediction, predictionDate, predictionDays,
    admissionReason, originSector, devices, culturesAtb, specialties,
  ]);

  const discardDraft = () => {
    try { localStorage.removeItem(draftKeyFor(patient.id)); } catch {}
    setDraftSavedAt(null);
    setHda(""); setAmp(""); setMuc(""); setAllergies(""); setWeight(""); setHeight("");
    setPa(""); setFc(""); setFr(""); setSpo2(""); setTax(""); setDx("");
    setPhysGeneral(""); setPhysCv(""); setPhysResp(""); setPhysAbd(""); setPhysExt("");
    setPlan(""); setCidPrimary(""); setCidSecondary("");
    setAdmissionReason(""); setOriginSector(""); setDevices(""); setCulturesAtb(""); setSpecialties("");
    setNoPrediction(false);
    setPredictionDate(toIsoDate(daysFromToday(5))); setPredictionDays("5");
    toast.success("Rascunho descartado");
  };

  // Sincronização dias -> data
  const handleDaysChange = (v: string) => {
    setPredictionDays(v);
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) {
      setPredictionDate(toIsoDate(daysFromToday(n)));
    }
  };

  // Sincronização data -> dias
  const handleDateChange = (v: string) => {
    setPredictionDate(v);
    const n = diffDaysFromToday(v);
    setPredictionDays(String(Math.max(n, 0)));
  };

  const dischargePredictionLabel = noPrediction
    ? "Sem previsão"
    : `${formatBr(predictionDate)} (D+${predictionDays})`;

  // Mapa de campos obrigatórios (para realce visual)
  const missing = {
    hda: !hda.trim(),
    exam: !physGeneral.trim() && !physCv.trim() && !physResp.trim(),
    examGeneral: !physGeneral.trim(),
    plan: !plan.trim(),
    cidPrimary: !cidPrimary.trim(),
    prediction: !noPrediction && !predictionDate,
  };
  // Itens obrigatórios para VALIDAR a admissão (CID/previsão/SAPS são recomendados, não bloqueantes)
  // SAPS 3 segue como tarefa pendente paralela (cronômetro de 24 h), mas não bloqueia validar/imprimir admissão.
  const missingList = [
    missing.hda && "HDA",
    missing.examGeneral && "Estado geral (exame físico)",
    missing.plan && "Conduta inicial",
  ].filter(Boolean) as string[];

  const validate = (): string | null => {
    if (missing.hda) return "História da Doença Atual (HDA) é obrigatória";
    if (missing.examGeneral) return "Estado geral (exame físico) é obrigatório";
    if (missing.plan) return "Conduta inicial é obrigatória";
    return null;
  };

  const canValidate = !missing.hda && !missing.examGeneral && !missing.plan;

  const handleSaveDraft = () => {
    try {
      const payload = {
        hda, amp, muc, allergies, weight, height, pa, fc, fr, spo2, tax, dx,
        physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
        plan, cidPrimary, cidSecondary,
        noPrediction, predictionDate, predictionDays,
        admissionReason, originSector, devices, culturesAtb, specialties,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKeyFor(patient.id), JSON.stringify(payload));
      setDraftSavedAt(new Date());
      toast.success("Rascunho salvo", {
        description: "Você pode prosseguir com evolução, prescrição, requisições e demais módulos.",
      });
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o rascunho");
    }
  };


  const buildPrintPayload = () => ({
    patient: { name: patient.name, bed: patient.bed, sector: patient.sector, age: patient.age },
    hospitalName: currentHospital?.name,
    doctorName: user?.user_metadata?.full_name || user?.email || "Médico Assistente",
    isUti,
    hda, amp, muc, allergies, weight, height, imc,
    vitals: { pa, fc, fr, spo2, tax, dx },
    exam: { general: physGeneral, cv: physCv, resp: physResp, abd: physAbd, ext: physExt, neuro: physNeuro },
    plan, cidPrimary, cidSecondary,
    dischargePredictionLabel,
    uti: isUti ? { admissionReason, originSector, devices, culturesAtb, specialties } : undefined,
    sapsPending: isUti, // SAPS 3 sempre pendente em UTI/UCI até finalizar na página /saps3
  });

  const handlePrint = () => {
    void printAdmissionNormaZero(buildPrintPayload());
  };

  const handleSubmit = async () => {
    setAttempted(true);
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!currentHospital || !currentState || !user) { toast.error("Contexto não disponível"); return; }

    setSubmitting(true);
    try {
      const doctorName = user.user_metadata?.full_name || user.email || "Médico Assistente";
      const now = new Date().toISOString();

      const admissionPayload = {
        clinical_history: hda,
        chief_complaint: hda.split("\n")[0]?.slice(0, 200) || null,
        diagnostic_hypothesis: cidPrimary,
        cid_primary: cidPrimary,
        cid_secondary: cidSecondary || null,
        macro_diagnosis: cidPrimary,
        initial_conduct: plan,
        department: currentDepartment || patient.department || "URGÊNCIA E EMERGÊNCIA ADULTO",
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        patient_id: patient.id,
        created_by: user.id,
      };

      const { error: ahError } = await supabase
        .from("admission_histories")
        .insert(admissionPayload as any);
      if (ahError) console.warn("admission_histories:", ahError);

      const imcLine = imc ? ` | IMC ${imc.value} (${imc.label})` : "";
      const admissionHistoryText = [
        `QUEIXA PRINCIPAL: ${hda.split("\n")[0]?.slice(0, 200) || "—"}`,
        `HISTÓRIA CLÍNICA: ${hda}`,
        cidPrimary && `HIPÓTESE DIAGNÓSTICA: ${cidPrimary}`,
        `CONDUTA INICIAL: ${plan}`,
      ].filter(Boolean).join("\n");

      const soapAdmission = {
        subjective: `HDA:\n${hda}\n\nAMP: ${amp || "—"}\nMUC: ${muc || "—"}\nAlergias: ${allergies || "Nega"}`,
        objective: `Antropometria: peso ${weight || "—"} kg, altura ${height || "—"} m${imcLine}\n` +
                   `SSVV admissionais: PA ${pa || "—"} | FC ${fc || "—"} | FR ${fr || "—"} | SpO₂ ${spo2 || "—"} | Tax ${tax || "—"} | Dx ${dx || "—"}`,
        assessment: `CID primário: ${cidPrimary}${cidSecondary ? `\nCID secundário: ${cidSecondary}` : ""}` +
                    (diagnosticHypotheses.trim() ? `\n\nHipóteses diagnósticas:\n${diagnosticHypotheses.trim()}` : "") +
                    (isUti ? `\n\nMotivo internação UTI: ${admissionReason || "—"}\nOrigem: ${originSector || "—"}\nDispositivos: ${devices || "—"}\nCulturas/ATB: ${culturesAtb || "—"}\nEspecialidades em conjunto: ${specialties || "—"}` : ""),
        plan: `${plan}\n\nPrevisão de alta: ${dischargePredictionLabel}`,
      };

      const physicalExam = {
        general: physGeneral, cardiovascular: physCv, respiratory: physResp,
        abdomen: physAbd, neurological: physNeuro, extremities: physExt, skin: "", other: "",
      };

      const { error: evError } = await supabase
        .from("clinical_evolutions")
        .insert({
          patient_id: patient.id,
          patient_name: patient.name,
          patient_bed: patient.bed,
          patient_sector: patient.sector,
          soap_data: soapAdmission,
          vital_signs: { pa, fc, fr, temp: tax, spo2, glasgow: "", diurese: "", dor: "" },
          physical_exam: physicalExam,
          status: "validated",
          validated_at: now,
          validated_by: user.id,
          validated_by_name: doctorName,
          created_by: user.id,
          created_by_name: doctorName,
          hospital_unit_id: currentHospital.id,
          state_id: currentState.id,
          department: currentDepartment || patient.department || "URGÊNCIA E EMERGÊNCIA ADULTO",
          evolution_type: "admission",
        } as any);
      if (evError) throw evError;

      // Busca o início da pré-admissão para cravar o cronômetro do SAPS
      let sapsStart: string = now;
      if (isUti) {
        const { data: pRow } = await supabase
          .from("patients")
          .select("created_at")
          .eq("id", patient.id)
          .maybeSingle();
        sapsStart = (pRow as any)?.created_at || now;
      }

      const parsedDiagnoses = parseDiagnosesText(diagnosticHypotheses);
      const baseUpdate: Record<string, any> = {
        admission_status: "admitido",
        admitted_at: now,
        uti_discharge_prediction: dischargePredictionLabel,
        admission_history: admissionHistoryText,
        ...(parsedDiagnoses.length > 0 ? { diagnoses: parsedDiagnoses } : {}),
      };
      if (isUti) {
        Object.assign(baseUpdate, {
          uti_admission_reason: admissionReason || null,
          uti_origin_sector: originSector || null,
          uti_devices: devices || null,
          uti_cultures_antibiotics: culturesAtb || null,
          uti_specialties: specialties || null,
          uti_allergies: allergies || null,
          saps_pending: true,
          saps_pending_since: sapsStart,
          saps_acknowledged_by: user.id,
          saps_acknowledged_at: now,
          saps_completed_at: null,
        });
      } else {
        baseUpdate.hospital_discharge_prediction = null;
      }
      await supabase.from("patients").update(baseUpdate as any).eq("id", patient.id);

      toast.success("ADMISSÃO HOSPITALAR REGISTRADA — paciente ADMITIDO (D0)");
      try { localStorage.removeItem(draftKeyFor(patient.id)); } catch {}
      setDraftSavedAt(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error("Erro ao registrar admissão: " + (e.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Cabeçalho elegante */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-emerald-50/70 via-white to-white">
          <DialogTitle className="flex items-center gap-2 uppercase text-slate-800">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <Stethoscope className="h-4 w-4" />
            </span>
            Admissão Hospitalar — {patient.name}
            <Badge variant="outline" className="ml-2 border-emerald-300 bg-emerald-50 text-emerald-700">
              {isUti ? "UTI / UCI" : "ENFERMARIA"}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            Leito <strong>{patient.bed}</strong> • Esta admissão será registrada como <strong>D0</strong> e aparecerá como primeira entrada na linha do tempo (ADMISSÃO HOSPITALAR). Após assinada, só pode ser editada via adendo ou suspensa com justificativa.
          </DialogDescription>

          {/* Faixa de status: rascunho automático + pendências */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] text-sky-700">
              <Save className="h-3 w-3" />
              {draftSavedAt
                ? <>Rascunho salvo automaticamente às <strong>{draftSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong> — você pode sair e continuar depois</>
                : <>O preenchimento é salvo automaticamente como <strong>rascunho</strong> — só vira admissão após validação</>}
            </span>
            {draftSavedAt && (
              <button type="button" onClick={discardDraft}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 hover:underline">
                <Trash2 className="h-3 w-3" /> Descartar rascunho
              </button>
            )}
            {attempted && missingList.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] text-rose-700">
                <AlertTriangle className="h-3 w-3" />
                Faltam: <strong>{missingList.join(" • ")}</strong>
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 py-5">
          <Tabs defaultValue="anamnese" className="w-full">
            <TabsList className="grid grid-cols-4 w-full bg-slate-100">
              <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
              <TabsTrigger value="exame">Exame Físico</TabsTrigger>
              <TabsTrigger value="plano">Plano / CID</TabsTrigger>
              {isUti
                ? <TabsTrigger value="uti">UTI</TabsTrigger>
                : <TabsTrigger value="extras" disabled>—</TabsTrigger>}
            </TabsList>

            {/* ───── Anamnese ───── */}
            <TabsContent value="anamnese" className="space-y-4 mt-4">
              <Section icon={FileText} title="História clínica" tone="slate">
                <div>
                  <ReqLabel missing={attempted && missing.hda}>HDA — História da Doença Atual</ReqLabel>
                  <Textarea value={hda} onChange={e => setHda(e.target.value)} rows={4}
                    placeholder="Paciente admitido com..." className={cn("mt-1", reqRing(attempted && missing.hda))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">AMP — Antecedentes</Label>
                    <Textarea value={amp} onChange={e => setAmp(e.target.value)} rows={2} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">MUC — Medicações de Uso Contínuo</Label>
                    <Textarea value={muc} onChange={e => setMuc(e.target.value)} rows={2} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Alergias medicamentosas</Label>
                  <Input value={allergies} onChange={e => setAllergies(e.target.value)}
                    placeholder="Nega / Especificar" className="mt-1" />
                </div>
              </Section>

              <Section icon={Activity} title="Antropometria" hint="IMC calculado automaticamente" tone="blue">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input value={weight} onChange={e => setWeight(e.target.value)} placeholder="Ex.: 72" className="mt-1" inputMode="decimal" />
                  </div>
                  <div>
                    <Label className="text-xs">Altura (m ou cm)</Label>
                    <Input value={height} onChange={e => setHeight(e.target.value)} placeholder="1,70 ou 170" className="mt-1" inputMode="decimal" />
                  </div>
                  <div>
                    <Label className="text-xs">IMC</Label>
                    <div className={cn(
                      "mt-1 h-10 rounded-md border bg-white px-3 flex items-center justify-between text-sm",
                      imc ? "border-blue-200" : "border-slate-200 text-slate-400"
                    )}>
                      {imc ? (
                        <>
                          <span className="font-semibold text-slate-800">{imc.value}</span>
                          <span className={cn("text-[11px] uppercase tracking-wide", imc.color)}>{imc.label}</span>
                        </>
                      ) : (
                        <span className="text-xs">Preencha peso e altura</span>
                      )}
                    </div>
                  </div>
                </div>
              </Section>

              <Section icon={HeartPulse} title="Sinais vitais admissionais" tone="emerald">
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="PA mmHg" value={pa} onChange={e => setPa(e.target.value)} />
                  <Input placeholder="FC bpm" value={fc} onChange={e => setFc(e.target.value)} />
                  <Input placeholder="FR irpm" value={fr} onChange={e => setFr(e.target.value)} />
                  <Input placeholder="SpO₂ %" value={spo2} onChange={e => setSpo2(e.target.value)} />
                  <Input placeholder="Tax °C" value={tax} onChange={e => setTax(e.target.value)} />
                  <Input placeholder="Dx mg/dL" value={dx} onChange={e => setDx(e.target.value)} />
                </div>
              </Section>
            </TabsContent>

            {/* ───── Exame Físico ───── */}
            <TabsContent value="exame" className="space-y-4 mt-4">
              <Section icon={Stethoscope} title="Exame físico segmentar" tone="slate">
                <div>
                  <ReqLabel missing={attempted && missing.examGeneral}>Estado geral</ReqLabel>
                  <Textarea value={physGeneral} onChange={e => setPhysGeneral(e.target.value)} rows={2} className={cn("mt-1", reqRing(attempted && missing.examGeneral))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Cardiovascular</Label><Textarea value={physCv} onChange={e => setPhysCv(e.target.value)} rows={2} className="mt-1" /></div>
                  <div><Label className="text-xs">Respiratório</Label><Textarea value={physResp} onChange={e => setPhysResp(e.target.value)} rows={2} className="mt-1" /></div>
                  <div><Label className="text-xs">Abdome</Label><Textarea value={physAbd} onChange={e => setPhysAbd(e.target.value)} rows={2} className="mt-1" /></div>
                  <div><Label className="text-xs">Extremidades</Label><Textarea value={physExt} onChange={e => setPhysExt(e.target.value)} rows={2} className="mt-1" /></div>
                  <div className="col-span-2"><Label className="text-xs">Neurológico</Label><Textarea value={physNeuro} onChange={e => setPhysNeuro(e.target.value)} rows={2} className="mt-1" placeholder="Glasgow, pupilas, força, sensibilidade, reflexos, sinais focais..." /></div>
                </div>
              </Section>
            </TabsContent>

            {/* ───── Plano / CID ───── */}
            <TabsContent value="plano" className="space-y-4 mt-4">
              <Section icon={Pill} title="Plano terapêutico" tone="slate">
                <ReqLabel missing={attempted && missing.plan}>Conduta inicial</ReqLabel>
                <Textarea value={plan} onChange={e => setPlan(e.target.value)} rows={5}
                  placeholder={"• Monitorização\n• Suporte clínico\n• Antibioticoterapia\n• ..."}
                  className={cn("mt-1", reqRing(attempted && missing.plan))} />
              </Section>

              <Section icon={FileText} title="Diagnóstico (CID-10)" hint="Busca por código ou descrição" tone="blue">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <ReqLabel missing={attempted && missing.cidPrimary}>CID primário</ReqLabel>
                    <CidSearchInput value={cidPrimary} onChange={setCidPrimary}
                      placeholder="Ex.: J18, pneumonia..." className={cn("mt-1", reqRing(attempted && missing.cidPrimary))} />
                  </div>
                  <div>
                    <Label className="text-xs">CID secundário</Label>
                    <CidSearchInput value={cidSecondary} onChange={setCidSecondary}
                      placeholder="Opcional" className="mt-1" />
                  </div>
                </div>
              </Section>

              <Section icon={Stethoscope} title="Hipóteses Diagnósticas (texto livre)" hint="Uma hipótese por linha — sincroniza automaticamente com o mapa de leitos" tone="blue">
                <Textarea
                  value={diagnosticHypotheses}
                  onChange={(e) => setDiagnosticHypotheses(e.target.value)}
                  rows={4}
                  placeholder={"Ex.:\nSepse de foco pulmonar\nSuspeita de TEP associado\nDM2 descompensado"}
                  className="mt-1 font-mono text-xs"
                />
                <p className="text-[11px] text-slate-600 mt-1">
                  📝 Cada linha vira uma hipótese no card do paciente. Esse campo passa a ser <strong>somente leitura no mapa</strong> e só é atualizado por nova evolução clínica.
                </p>
              </Section>

              <Section icon={CalendarDays} title="Previsão de alta" hint="Dias e data sincronizados" tone="amber">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Hash className="h-3 w-3" /> Dias de internação previstos</Label>
                    <Input
                      type="number" min={0} value={predictionDays}
                      onChange={e => handleDaysChange(e.target.value)}
                      disabled={noPrediction}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Data prevista</Label>
                    <Input
                      type="date" value={predictionDate}
                      onChange={e => handleDateChange(e.target.value)}
                      disabled={noPrediction}
                      className="mt-1"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 pb-2 select-none">
                    <Checkbox checked={noPrediction} onCheckedChange={v => setNoPrediction(v === true)} />
                    Sem previsão
                  </label>
                </div>
                <p className="text-[11px] text-slate-600">
                  Resultado: <strong className="text-slate-800">{dischargePredictionLabel}</strong>
                </p>
              </Section>
            </TabsContent>

            {/* ───── UTI ───── */}
            {isUti && (
              <TabsContent value="uti" className="space-y-4 mt-4">
                <Section icon={AlertTriangle} title="Dados específicos da UTI" tone="amber">
                  <div><Label className="text-xs">Motivo de internação UTI</Label><Textarea value={admissionReason} onChange={e => setAdmissionReason(e.target.value)} rows={2} className="mt-1" /></div>
                  <div><Label className="text-xs">Origem (setor anterior)</Label><Input value={originSector} onChange={e => setOriginSector(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">Dispositivos invasivos</Label><Textarea value={devices} onChange={e => setDevices(e.target.value)} rows={2} placeholder="IOT, CVC, SVD, ..." className="mt-1" /></div>
                  <div><Label className="text-xs">Culturas pendentes / ATB em curso</Label><Textarea value={culturesAtb} onChange={e => setCulturesAtb(e.target.value)} rows={2} className="mt-1" /></div>
                  <div><Label className="text-xs">Especialidades em conjunto</Label><Input value={specialties} onChange={e => setSpecialties(e.target.value)} className="mt-1" /></div>
                </Section>

                <Section icon={ShieldCheck} title="Ficha SAPS 3 — Aviso" tone="amber">
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    A admissão UTI/UCI gera automaticamente uma <strong>Ficha SAPS 3 pendente</strong>, com prazo de{" "}
                    <strong className="text-amber-700">24 horas</strong> a partir da pré-admissão (janela operacional / AMIB).
                    A admissão pode ser <strong>validada e impressa normalmente</strong>; a SAPS 3 segue como tarefa paralela
                    no Painel Clínico até ser finalizada em <code>/saps3</code>.
                  </p>
                  <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/70 p-3 cursor-pointer select-none">
                    <Checkbox checked={sapsAck} onCheckedChange={v => setSapsAck(v === true)} className="mt-0.5" />
                    <span className="text-xs text-slate-800">
                      <strong className="uppercase tracking-wide text-amber-800">Ciência (opcional)</strong> — declaro estar
                      ciente de que a ficha SAPS 3 está pendente e deve ser finalizada em até 24 h.
                    </span>
                  </label>
                </Section>
              </TabsContent>
            )}
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50/60 gap-2 sm:justify-between">
          <Button variant="outline" onClick={handlePrint} disabled={submitting} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir Admissão (Norma Zero)
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={submitting}
              className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50 uppercase"
              title="Salva o rascunho e libera os módulos clínicos (evolução, prescrição, requisições, docs e histórico) para preenchimento posterior."
            >
              Salvar Rascunho
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canValidate}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white uppercase"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Assinar e Admitir (D0)
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
