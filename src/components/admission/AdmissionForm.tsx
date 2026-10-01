import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CidSearchInput } from "@/components/CidSearchInput";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WizardItemQueue } from "@/components/shared/WizardItemQueue";
import { useWizardItemQueue } from "@/hooks/useWizardItemQueue";
import { calcularQSofa } from "@/lib/qsofa";
import { calculateNEWS2, news2RiskLabels, parseVitalNumber } from "@/lib/news2";
import {
  SOFA_COMPONENTES, calcularSofaTotal, componentesPreenchidos, pontosComponente,
  type SofaRespostas, type SofaComponente,
} from "@/lib/sofa";
import {
  Stethoscope, Loader2, AlertTriangle, ClipboardCheck,
  HeartPulse, Activity, FileText, Pill, CalendarDays, Hash,
  Printer, ShieldCheck, Save, Trash2, Brain, Gauge, ClipboardList, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printAdmissionNormaZero } from "@/lib/printAdmission";
import { resolveCurrentBedSector } from "@/lib/resolvePatientHeader";
import { admissionModeForSector } from "@/lib/sectorComplexity";
import { parseDiagnosesText } from "@/lib/diagnosesText";
import { toEvolucaoStatusDb } from "@/lib/evolucaoStatus";
import { PatientIdentityHeader } from "@/components/PatientIdentityHeader";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

/** MIGRAÇÃO: profissionais.id ≠ auth.uid → resolve via profissionais.user_id. */
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from("profissionais")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

/** Chave do rascunho local por prontuário — nunca por leito/linha reutilizável. */
const draftKeyFor = (registryId: string) => `admission_draft:v2:${registryId}`;

/** Label com sinalização forte de obrigatoriedade */
const ReqLabel = ({ children, missing }: { children: React.ReactNode; missing?: boolean }) => (
  <Label className={cn(
    "text-xs flex items-center gap-2",
    missing ? "text-critical-on-soft" : "text-foreground"
  )}>
    <span>{children}</span>
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-1 py-px text-xs font-semibold uppercase tracking-wider",
      missing
        ? "bg-critical-soft text-critical-on-soft ring-1 ring-critical"
        : "bg-critical-soft text-critical-on-soft ring-1 ring-critical"
    )}>
      <span className="leading-none">*</span> Obrigatório
    </span>
  </Label>
);

/** Classe utilitária pra realçar campo faltante após tentativa de submit */
const reqRing = (missing?: boolean) =>
  missing ? "ring-2 ring-critical border-critical focus-visible:ring-critical" : "";

interface AdmissionFormProps {
  patient: {
    id: string;
    name: string;
    bed: string;
    sector: string;
    age?: string | number;
    department?: string;
    patient_registry_id?: string | null;
  };
  onClose: () => void;
  onSuccess?: () => void;
  /** Modo pagina (dentro do shell ClinicalHeader): oculta o cabecalho interno de
   *  dialogo (identidade duplicada), ja provido pelo shell. Diálogo usa false. */
  embedded?: boolean;
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
  let color = "text-muted-foreground";
  if (imc < 18.5) { label = "Baixo peso"; color = "text-warning-on-soft"; }
  else if (imc < 25) { label = "Eutrófico"; color = "text-released-on-soft"; }
  else if (imc < 30) { label = "Sobrepeso"; color = "text-warning-on-soft"; }
  else if (imc < 35) { label = "Obesidade I"; color = "text-warning-on-soft"; }
  else if (imc < 40) { label = "Obesidade II"; color = "text-critical-on-soft"; }
  else { label = "Obesidade III"; color = "text-critical-on-soft"; }
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

/* ───────── Group header (divisor de seção empilhada) ───────── */

const GroupHeader = ({ step, title }: { step: number; title: string }) => (
  <div className="flex items-center gap-3 pt-2 first:pt-0">
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-released text-white text-xs font-semibold">
      {step}
    </span>
    <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground whitespace-nowrap">{title}</h3>
    <div className="h-px flex-1 bg-released-soft/40" />
  </div>
);

/* ───────── Section card ───────── */

const Section = ({
  icon: Icon, title, hint, children, tone = "slate",
}: {
  icon: any; title: string; hint?: string; children: React.ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber";
}) => {
  const tones = {
    slate: "border-border bg-muted/30",
    blue: "border-border/40 bg-muted/40",
    emerald: "border-released/20 bg-released/5",
    amber: "border-warning-border bg-warning-soft/40",
  } as const;
  const iconTones = {
    slate: "text-muted-foreground", blue: "text-foreground",
    emerald: "text-released-on-soft", amber: "text-warning-on-soft",
  } as const;
  return (
    <section className={cn("rounded-lg border p-4 space-y-3", tones[tone])}>
      <header className="flex items-center gap-2 -mt-1">
        <Icon className={cn("h-4 w-4", iconTones[tone])} />
        <h4 className="text-xs font-medium uppercase tracking-wide text-foreground">{title}</h4>
        {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
      </header>
      {children}
    </section>
  );
};

/* ───────── Secao colapsavel (modo emergencia — complementos recolhidos) ───────── */

const EmergenciaCollapsible = ({
  icon: Icon, title, children,
}: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) => (
  <Collapsible defaultOpen={false} className="rounded-lg border border-border bg-muted/20">
    <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-2.5 text-left">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium uppercase tracking-wide text-foreground">{title}</span>
      <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
    <CollapsibleContent className="px-4 pb-4 pt-1 space-y-3">
      {children}
    </CollapsibleContent>
  </Collapsible>
);

/* ───────── Glasgow (ECG) — opções reaproveitadas de RiskClassificationDialog ───────── */

const GLASGOW_EYE = [
  { v: 4, l: "Espontânea" }, { v: 3, l: "Ao comando" }, { v: 2, l: "À dor" }, { v: 1, l: "Nenhuma" },
];
const GLASGOW_VERBAL = [
  { v: 5, l: "Orientada" }, { v: 4, l: "Confusa" }, { v: 3, l: "Inapropriada" },
  { v: 2, l: "Incompreensível" }, { v: 1, l: "Nenhuma" },
];
const GLASGOW_MOTOR = [
  { v: 6, l: "Obedece" }, { v: 5, l: "Localiza dor" }, { v: 4, l: "Flexão normal" },
  { v: 3, l: "Flexão anormal" }, { v: 2, l: "Extensão" }, { v: 1, l: "Nenhuma" },
];

const GlasgowRow = ({
  label, options, value, onSelect,
}: {
  label: string; options: { v: number; l: string }[]; value: number | null; onSelect: (v: number) => void;
}) => (
  <div>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="mt-1 flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          type="button" key={o.v} onClick={() => onSelect(o.v)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            value === o.v
              ? "border-released bg-released text-white"
              : "border-border bg-background text-foreground hover:bg-muted"
          )}
        >
          <span className="font-semibold">{o.v}</span> <span className="opacity-80">{o.l}</span>
        </button>
      ))}
    </div>
  </div>
);

/* ───────── UTI — justificativa de admissão (vocabulário fixo) ───────── */

const UTI_JUSTIFICATIVAS: { codigo: string; rotulo: string }[] = [
  { codigo: "pos_operatorio", rotulo: "Pós-operatório" },
  { codigo: "pos_procedimento", rotulo: "Pós-procedimento" },
  { codigo: "pos_pcr", rotulo: "Pós-parada cardiorrespiratória" },
  { codigo: "infeccao_sepse", rotulo: "Nova infecção / sepse" },
  { codigo: "disfuncao_aguda", rotulo: "Nova disfunção orgânica aguda" },
  { codigo: "descompensacao_cronica", rotulo: "Descompensação de disfunção orgânica crônica ou doença crônica" },
  { codigo: "outro", rotulo: "Outro" },
];

const rotuloJustificativa = (codigo: string): string =>
  UTI_JUSTIFICATIVAS.find(j => j.codigo === codigo)?.rotulo ?? "";

/* ───────── SOFA — linha de pills clicáveis (segue o estilo do GlasgowRow) ───────── */

const SofaRow = ({
  comp, value, onSelect,
}: {
  comp: SofaComponente; value: string | null | undefined; onSelect: (id: string) => void;
}) => {
  const pts = pontosComponente(comp, value);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{comp.titulo}</Label>
        <span className={cn("text-xs font-semibold shrink-0", value ? "text-foreground" : "text-muted-foreground/60")}>
          {value ? `${pts} pt${pts === 1 ? "" : "s"}` : "—"}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {comp.faixas.map(f => (
          <button
            type="button" key={f.id} onClick={() => onSelect(f.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              value === f.id
                ? "border-released bg-released text-white"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            <span>{f.rotulo}</span> <span className="opacity-70">({f.pontos})</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ───────── Component ───────── */

export function AdmissionForm({ patient, onClose, onSuccess, embedded = false }: AdmissionFormProps) {
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { user } = useAuth();
  // Modo de admissao derivado do setor. isUti preserva byte-a-byte o antigo
  // UTI_SECTORS.includes(patient.sector) (mesma lista, correspondencia exata).
  const admissionMode = useMemo(() => admissionModeForSector(patient.sector), [patient.sector]);
  const isUti = admissionMode === "uti";
  const isEmergencia = admissionMode === "emergencia";
  const identifiers = usePatientIdentifiers(patient.id, patient.name, currentHospital?.id || null);
  const registryId = identifiers.registry?.id ?? patient.patient_registry_id ?? null;
  const draftKey = useMemo(() => registryId ? draftKeyFor(registryId) : null, [registryId]);

  // SAPS 3 acknowledgement (apenas UTI/UCI)
  const [sapsAck, setSapsAck] = useState(false);

  // Common fields
  const [hda, setHda] = useState("");
  const [muc, setMuc] = useState("");
  const [allergies, setAllergies] = useState("");
  // Alergias: UI por toggle Sim/Nao — "nao" grava "Nega" em `allergies`, "sim" abre input.
  const [allergyMode, setAllergyMode] = useState<"nao" | "sim" | null>(null);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  // PA separada em sistolica/diastolica (antes era um unico campo `pa`).
  const [paSys, setPaSys] = useState("");
  const [paDia, setPaDia] = useState("");
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

  // Glasgow (ECG) — Ocular/Verbal/Motora; null = ainda nao avaliado.
  const [glasgowEye, setGlasgowEye] = useState<number | null>(null);
  const [glasgowVerbal, setGlasgowVerbal] = useState<number | null>(null);
  const [glasgowMotor, setGlasgowMotor] = useState<number | null>(null);

  // Antecedentes morbidos pessoais — lista incremental (padrao WizardItemQueue).
  const antQueue = useWizardItemQueue<string>();
  const [antInput, setAntInput] = useState("");

  // Discharge prediction — sincronização dias <-> data
  const [noPrediction, setNoPrediction] = useState(false);
  const [predictionDate, setPredictionDate] = useState<string>(() => toIsoDate(daysFromToday(5)));
  const [predictionDays, setPredictionDays] = useState<string>("5");

  // UTI extras
  // admissionReason: estado legado (texto livre) — preservado como fallback do
  // campo "outro" ao hidratar rascunho antigo; não tem mais UI própria.
  const [admissionReason, setAdmissionReason] = useState("");
  const [originSector, setOriginSector] = useState("");
  const [devices, setDevices] = useState("");
  const [culturesAtb, setCulturesAtb] = useState("");
  const [specialties, setSpecialties] = useState("");

  // UTI estruturado (novos widgets)
  const [utiJustificativa, setUtiJustificativa] = useState("");        // código do vocabulário
  const [utiJustificativaOutro, setUtiJustificativaOutro] = useState(""); // texto quando "outro"
  const [utiVasoativo, setUtiVasoativo] = useState<boolean | null>(null);
  const [utiComDispositivos, setUtiComDispositivos] = useState<boolean | null>(null);
  const [sofaRespostas, setSofaRespostas] = useState<SofaRespostas>({});

  const [submitting, setSubmitting] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  // ── D0 persistido no banco nesta sessão? ──────────────────────────────
  // CRÍTICO (correção de segurança de prontuário): a impressão NÃO pode gerar
  // um documento D0 oficial sem que a admissão exista no banco. Antes desta
  // trava, o médico conseguia imprimir a partir do formulário em memória sem
  // nunca clicar em "Assinar e Admitir" — gerando papel assinado sem registro
  // digital (documento fantasma). `isSaved` só vira true após handleSubmit
  // persistir clinical_evolutions + admission_histories com sucesso.
  const [isSaved, setIsSaved] = useState(false);

  // Confirmação ao tentar fechar com conteúdo preenchido e admissão não salva
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const imc = useMemo(() => computeImc(weight, height), [weight, height]);

  // ── Derivados (mantem compat com o esquema de persistencia atual) ──────────
  // `amp` continua sendo a string que vai pro soap; agora vem da lista.
  const amp = antQueue.items.map(i => i.snapshot).join("\n");
  // `pa` continua sendo a string "sys/dia" que o print e o soap consomem.
  const pa = [paSys.trim(), paDia.trim()].filter(Boolean).join("/");
  const glasgowTotal =
    glasgowEye != null && glasgowVerbal != null && glasgowMotor != null
      ? glasgowEye + glasgowVerbal + glasgowMotor
      : null;

  // ── SOFA (admissão UTI) — total e preenchidos derivados das respostas ──────
  const sofaTotal = useMemo(() => calcularSofaTotal(sofaRespostas), [sofaRespostas]);
  const sofaPreenchidos = useMemo(() => componentesPreenchidos(sofaRespostas), [sofaRespostas]);

  // Rótulo da justificativa para o SOAP/impresso: quando "outro", usa o texto
  // digitado (ou o valor legado de admissionReason como fallback).
  const utiJustificativaTexto = utiJustificativaOutro.trim() || admissionReason.trim();
  const utiJustificativaLabel = !utiJustificativa
    ? "—"
    : utiJustificativa === "outro"
      ? `Outro${utiJustificativaTexto ? ` — ${utiJustificativaTexto}` : ""}`
      : rotuloJustificativa(utiJustificativa);
  const simNao = (v: boolean | null) => (v == null ? "—" : v ? "Sim" : "Não");

  // Escores ao vivo — recalculados a cada mudanca de vitais/Glasgow.
  const qsofa = useMemo(
    () => calcularQSofa({
      pasSistolica: parseVitalNumber(paSys),
      freqRespiratoria: parseVitalNumber(fr),
      glasgowTotal: glasgowTotal ?? undefined,
    }),
    [paSys, fr, glasgowTotal]
  );
  const news2 = useMemo(() => {
    const anyVital = [paSys, paDia, fc, fr, tax, spo2].some(v => v.trim());
    if (!anyVital) return null;
    return calculateNEWS2({
      respiratoryRate: parseVitalNumber(fr),
      spo2: parseVitalNumber(spo2),
      temperature: parseVitalNumber(tax),
      systolicBp: parseVitalNumber(paSys),
      heartRate: parseVitalNumber(fc),
    });
  }, [paSys, paDia, fc, fr, tax, spo2]);

  // Alergias — toggle Sim/Nao controla o estado `allergies` (persistencia inalterada).
  const handleAllergyMode = (mode: "nao" | "sim") => {
    setAllergyMode(mode);
    if (mode === "nao") setAllergies("Nega");
    else if (allergies.trim().toLowerCase() === "nega") setAllergies("");
  };

  // Antecedentes — acrescentar/salvar e editar itens da fila.
  const commitAntecedente = () => {
    const v = antInput.trim();
    if (!v) return;
    if (antQueue.editingUid) {
      antQueue.update(antQueue.editingUid, v, v);
      antQueue.stopEditing();
    } else {
      antQueue.push(v, v);
    }
    setAntInput("");
  };
  const editAntecedente = (uid: string) => {
    const it = antQueue.items.find(i => i.uid === uid);
    if (!it) return;
    setAntInput(it.snapshot);
    antQueue.startEditing(uid);
  };

  const resetForm = () => {
    setHda(""); setMuc(""); setAllergies(""); setAllergyMode(null);
    antQueue.clear(); setAntInput("");
    setWeight(""); setHeight("");
    setPaSys(""); setPaDia(""); setFc(""); setFr(""); setSpo2(""); setTax(""); setDx("");
    setGlasgowEye(null); setGlasgowVerbal(null); setGlasgowMotor(null);
    setPhysGeneral(""); setPhysCv(""); setPhysResp(""); setPhysAbd(""); setPhysExt(""); setPhysNeuro("");
    setPlan(""); setCidPrimary(""); setCidSecondary(""); setDiagnosticHypotheses("");
    setAdmissionReason(""); setOriginSector(""); setDevices(""); setCulturesAtb(""); setSpecialties("");
    setUtiJustificativa(""); setUtiJustificativaOutro(""); setUtiVasoativo(null);
    setUtiComDispositivos(null); setSofaRespostas({});
    setNoPrediction(false);
    setPredictionDate(toIsoDate(daysFromToday(5))); setPredictionDays("5");
    setIsSaved(false);
  };

  /* ───────── Rascunho automático (localStorage) ───────── */
  // Restaura ao montar (a página está sempre "aberta")
  useEffect(() => {
    // Toda vez que o formulário monta, a admissão ainda não foi salva NESTA sessão.
    setIsSaved(false);
    try {
      if (!draftKey) {
        resetForm();
        setDraftSavedAt(null);
        setDraftHydrated(true);
        return;
      }
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        setHda(d.hda ?? ""); setMuc(d.muc ?? "");
        // Antecedentes: formato novo (array) ou legado (`amp` string multilinha).
        antQueue.clear();
        const antList: string[] = Array.isArray(d.antecedentes)
          ? d.antecedentes
          : (typeof d.amp === "string" && d.amp.trim()
              ? d.amp.split("\n").map((s: string) => s.trim()).filter(Boolean)
              : []);
        antList.forEach(a => antQueue.push(a, a));
        setAntInput("");
        setAllergies(d.allergies ?? "");
        // Modo da alergia derivado do valor salvo (compat com rascunho antigo).
        {
          const alg = (d.allergies ?? "").trim();
          setAllergyMode(alg === "" ? null : (alg.toLowerCase() === "nega" ? "nao" : "sim"));
        }
        setWeight(d.weight ?? ""); setHeight(d.height ?? "");
        // PA: formato novo (paSys/paDia) ou legado (`pa` "120/80").
        if (d.paSys != null || d.paDia != null) {
          setPaSys(d.paSys ?? ""); setPaDia(d.paDia ?? "");
        } else if (typeof d.pa === "string" && d.pa) {
          const [s, di] = d.pa.split("/");
          setPaSys((s ?? "").trim()); setPaDia((di ?? "").trim());
        } else {
          setPaSys(""); setPaDia("");
        }
        setFc(d.fc ?? ""); setFr(d.fr ?? ""); setSpo2(d.spo2 ?? "");
        setTax(d.tax ?? ""); setDx(d.dx ?? "");
        setGlasgowEye(typeof d.glasgowEye === "number" ? d.glasgowEye : null);
        setGlasgowVerbal(typeof d.glasgowVerbal === "number" ? d.glasgowVerbal : null);
        setGlasgowMotor(typeof d.glasgowMotor === "number" ? d.glasgowMotor : null);
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
        // UTI estruturado — retrocompat: rascunho antigo só tem admissionReason
        // (texto) e devices (texto). admissionReason -> campo "outro" da
        // justificativa; devices preenchido -> utiComDispositivos inferido = true.
        {
          const legacyReason = (d.admissionReason ?? "").trim();
          if (d.utiJustificativa) {
            setUtiJustificativa(d.utiJustificativa);
            setUtiJustificativaOutro(d.utiJustificativaOutro ?? "");
          } else if (legacyReason) {
            setUtiJustificativa("outro");
            setUtiJustificativaOutro(legacyReason);
          } else {
            setUtiJustificativa(""); setUtiJustificativaOutro("");
          }
        }
        setUtiVasoativo(typeof d.utiVasoativo === "boolean" ? d.utiVasoativo : null);
        if (typeof d.utiComDispositivos === "boolean") {
          setUtiComDispositivos(d.utiComDispositivos);
        } else {
          setUtiComDispositivos((d.devices ?? "").trim() ? true : null);
        }
        setSofaRespostas(d.sofaRespostas && typeof d.sofaRespostas === "object" ? d.sofaRespostas : {});
        if (d.savedAt) setDraftSavedAt(new Date(d.savedAt));
      } else {
        resetForm();
        setDraftSavedAt(null);
      }
    } catch {}
    setDraftHydrated(true);
    return () => { setDraftHydrated(false); setAttempted(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Salva (debounced) a cada mudança
  useEffect(() => {
    if (!draftHydrated || !draftKey) return;
    const t = setTimeout(() => {
      try {
        const payload = {
          hda, amp, antecedentes: amp ? amp.split("\n") : [], muc, allergies,
          weight, height, paSys, paDia, pa, fc, fr, spo2, tax, dx,
          glasgowEye, glasgowVerbal, glasgowMotor,
          physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
          plan, cidPrimary, cidSecondary, diagnosticHypotheses,
          noPrediction, predictionDate, predictionDays,
          admissionReason, originSector, devices, culturesAtb, specialties,
          utiJustificativa, utiJustificativaOutro, utiVasoativo, utiComDispositivos, sofaRespostas,
          savedAt: new Date().toISOString(),
        };
        // só persiste se houver algum conteúdo
        const hasContent = Object.values(payload).some(v => typeof v === "string" && v.trim().length > 0);
        if (hasContent) {
          localStorage.setItem(draftKey, JSON.stringify(payload));
          setDraftSavedAt(new Date());
        }
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [
    draftHydrated, draftKey,
    hda, amp, muc, allergies, weight, height, paSys, paDia, pa, fc, fr, spo2, tax, dx,
    glasgowEye, glasgowVerbal, glasgowMotor,
    physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
    plan, cidPrimary, cidSecondary, diagnosticHypotheses,
    noPrediction, predictionDate, predictionDays,
    admissionReason, originSector, devices, culturesAtb, specialties,
    utiJustificativa, utiJustificativaOutro, utiVasoativo, utiComDispositivos, sofaRespostas,
  ]);

  // Qualquer edição depois de salvo invalida o "isSaved" (o que está impresso
  // deixaria de refletir o banco). Só o conteúdo clínico conta.
  useEffect(() => {
    if (isSaved) setIsSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hda, amp, muc, allergies, weight, height, paSys, paDia, pa, fc, fr, spo2, tax, dx,
    glasgowEye, glasgowVerbal, glasgowMotor,
    physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
    plan, cidPrimary, cidSecondary, diagnosticHypotheses,
    noPrediction, predictionDate, predictionDays,
    admissionReason, originSector, devices, culturesAtb, specialties,
    utiJustificativa, utiJustificativaOutro, utiVasoativo, utiComDispositivos, sofaRespostas,
  ]);

  const discardDraft = () => {
    try { if (draftKey) localStorage.removeItem(draftKey); } catch {}
    setDraftSavedAt(null);
    resetForm();
    toast.success("Rascunho descartado");
  };

  // Há conteúdo clínico preenchido? (usado para decidir se avisamos ao sair)
  const hasAnyContent = [
    hda, amp, muc, allergies, weight, height, pa, fc, fr, spo2, tax, dx,
    physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
    plan, cidPrimary, cidSecondary, diagnosticHypotheses,
    admissionReason, originSector, devices, culturesAtb, specialties,
    utiJustificativaOutro,
  ].some(v => typeof v === "string" && v.trim().length > 0)
    || glasgowTotal != null
    || !!utiJustificativa || utiVasoativo != null || utiComDispositivos != null
    || sofaPreenchidos > 0;

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
  //
  // Modo EMERGENCIA (Sala Vermelha): obrigatorios reduzidos ao minimo do paciente
  // em estabilizacao — HDA + CID primario + Conduta. "Estado geral" do exame fisico
  // NAO bloqueia. Nos modos uti/enfermaria os obrigatorios atuais permanecem
  // (HDA + Estado geral + Conduta).
  const missingList = (isEmergencia
    ? [
        missing.hda && "HDA",
        missing.cidPrimary && "CID primário",
        missing.plan && "Conduta inicial",
      ]
    : [
        missing.hda && "HDA",
        missing.examGeneral && "Estado geral (exame físico)",
        missing.plan && "Conduta inicial",
      ]
  ).filter(Boolean) as string[];

  const validate = (): string | null => {
    if (missing.hda) return "História da Doença Atual (HDA) é obrigatória";
    if (isEmergencia) {
      if (missing.cidPrimary) return "CID primário é obrigatório";
    } else {
      if (missing.examGeneral) return "Estado geral (exame físico) é obrigatório";
    }
    if (missing.plan) return "Conduta inicial é obrigatória";
    return null;
  };

  const canValidate = isEmergencia
    ? !missing.hda && !missing.cidPrimary && !missing.plan
    : !missing.hda && !missing.examGeneral && !missing.plan;

  const handleSaveDraft = () => {
    try {
      if (!draftKey) {
        toast.error("Aguarde a identificação do prontuário antes de salvar o rascunho");
        return;
      }
      const payload = {
        hda, amp, antecedentes: amp ? amp.split("\n") : [], muc, allergies,
        weight, height, paSys, paDia, pa, fc, fr, spo2, tax, dx,
        glasgowEye, glasgowVerbal, glasgowMotor,
        physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
        plan, cidPrimary, cidSecondary, diagnosticHypotheses,
        noPrediction, predictionDate, predictionDays,
        admissionReason, originSector, devices, culturesAtb, specialties,
        utiJustificativa, utiJustificativaOutro, utiVasoativo, utiComDispositivos, sofaRespostas,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
      setDraftSavedAt(new Date());
      toast.success("Rascunho salvo", {
        description: "Você pode prosseguir com evolução, prescrição, requisições e demais módulos.",
      });
      onClose();
    } catch {
      toast.error("Não foi possível salvar o rascunho");
    }
  };


  const buildPrintPayload = async () => {
    // Leito/setor ATUAIS (após relocações), com fallback para snapshot da prop.
    const live = await resolveCurrentBedSector(patient.id);
    return {
      patient: {
        name: patient.name,
        bed: live.bed || patient.bed,
        sector: live.sector || patient.sector,
        age: identifiers.registry?.age || patient.age,
      },
      identifiers: {
        prontuario: identifiers.prontuario,
        atendimento: identifiers.atendimento,
        socialName: identifiers.registry?.socialName || null,
        cpf: identifiers.registry?.cpf || null,
        cns: identifiers.registry?.cns || null,
        birthDate: identifiers.registry?.birthDate || null,
        sex: identifiers.registry?.sex || null,
        motherName: identifiers.registry?.motherName || null,
        address: [
          identifiers.registry?.address,
          identifiers.registry?.neighborhood,
          identifiers.registry?.city && identifiers.registry?.state
            ? `${identifiers.registry.city}/${identifiers.registry.state}`
            : identifiers.registry?.city || identifiers.registry?.state,
        ].filter(Boolean).join(" — ") || null,
        phone: identifiers.registry?.phone || null,
      },
      hospitalName: currentHospital?.name,
      doctorName: user?.user_metadata?.full_name || user?.email || "Médico Assistente",
      isUti,
      hda, amp, muc, allergies, weight, height, imc,
      vitals: { pa, fc, fr, spo2, tax, dx },
      exam: { general: physGeneral, cv: physCv, resp: physResp, abd: physAbd, ext: physExt, neuro: physNeuro },
      plan, cidPrimary, cidSecondary,
      dischargePredictionLabel,
      // Mapeia os widgets novos para os 5 campos que o template do impresso ja
      // consome (admissionReason/devices), sem alterar o template. Vasoativo e
      // SOFA ficam no SOAP/JSON (sem linha propria no impresso por ora).
      uti: isUti ? {
        admissionReason: utiJustificativa ? utiJustificativaLabel : "",
        originSector,
        devices: utiComDispositivos
          ? (devices.trim() || "Sim (sem detalhamento)")
          : (utiComDispositivos === false ? "Nega dispositivos" : ""),
        culturesAtb,
        specialties,
      } : undefined,
      sapsPending: isUti, // SAPS 3 sempre pendente em UTI/UCI até finalizar na página /saps3
    };
  };

  // Impressão isolada. Só é chamada quando a admissão JÁ está persistida
  // (após handleSubmit), garantindo que o papel reflete um registro real.
  const doPrint = async () => {
    const payload = await buildPrintPayload();
    void printAdmissionNormaZero(payload);
  };

  // Handler do botão "Imprimir". Bloqueia impressão de admissão não salva —
  // impede documento D0 fantasma (papel assinado sem registro no banco).
  const handlePrint = async () => {
    if (!isSaved) {
      setAttempted(true);
      const err = validate();
      if (err) {
        toast.error(err, {
          description: "Preencha os campos obrigatórios e valide a admissão antes de imprimir.",
        });
        return;
      }
      toast.error("Valide a admissão antes de imprimir", {
        description:
          "A impressão só é liberada após clicar em “Validar admissão (D0)”. " +
          "Isso garante que o documento impresso corresponda a um registro salvo no sistema.",
      });
      return;
    }
    await doPrint();
  };

  const handleSubmit = async () => {
    setAttempted(true);
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!user) { toast.error("Contexto não disponível"); return; }

    setSubmitting(true);
    try {
      const doctorName = user.user_metadata?.full_name || user.email || "Médico Assistente";
      const now = new Date().toISOString();
      // MIGRAÇÃO: profissional_id ≠ auth.uid.
      const profissionalId = await resolveProfissionalId(user.id);

      // MIGRAÇÃO: admission_histories morto → a admissão É a internação
      // (patient.id === internacoes.id). Gravamos os campos clínicos direto em
      // `internacoes` e marcamos status='admitido'. CID primário/secundário,
      // macro_diagnosis, department, hospital_unit_id, state_id, encounter_id,
      // patient_registry_id NÃO têm coluna → degradados (só ficam no impresso e
      // no JSON da evolução). parseDiagnosesText mantido para normalizar hipóteses.
      const parsedDiagnoses = parseDiagnosesText(diagnosticHypotheses);
      const { error: interErr } = await supabase
        .from("internacoes")
        .update({
          queixa_principal: hda.split("\n")[0]?.slice(0, 200) || null,
          historia_clinica: hda || null,
          hipotese_diagnostica:
            parsedDiagnoses.length > 0
              ? parsedDiagnoses.join("\n")
              : (diagnosticHypotheses.trim() || cidPrimary || null),
          conduta_inicial: plan || null,
          status: "ativa",
        } as any)
        .eq("id", patient.id);
      if (interErr) {
        console.error("internacoes update failed:", interErr);
        throw new Error(`Falha ao gravar admissão na internação: ${interErr.message}`);
      }

      const imcLine = imc ? ` | IMC ${imc.value} (${imc.label})` : "";
      const glasgowLine = glasgowTotal != null
        ? `\nGlasgow: ${glasgowTotal} (O${glasgowEye} V${glasgowVerbal} M${glasgowMotor})`
        : "";
      const antecedentesList = amp ? amp.split("\n") : [];
      const soapAdmission = {
        subjective: `HDA:\n${hda}\n\nAMP: ${amp || "—"}\nMUC: ${muc || "—"}\nAlergias: ${allergies || "Nega"}`,
        objective: `Antropometria: peso ${weight || "—"} kg, altura ${height || "—"} m${imcLine}\n` +
                   `SSVV admissionais: PA ${pa || "—"} | FC ${fc || "—"} | FR ${fr || "—"} | SpO₂ ${spo2 || "—"} | Tax ${tax || "—"} | Dx ${dx || "—"}${glasgowLine}`,
        assessment: `CID primário: ${cidPrimary}${cidSecondary ? `\nCID secundário: ${cidSecondary}` : ""}` +
                    (diagnosticHypotheses.trim() ? `\n\nHipóteses diagnósticas:\n${diagnosticHypotheses.trim()}` : "") +
                    (isUti ? `\n\nJustificativa de admissão UTI: ${utiJustificativaLabel}` +
                      `\nDroga vasoativa: ${simNao(utiVasoativo)}` +
                      `\nVeio com dispositivos: ${simNao(utiComDispositivos)}${utiComDispositivos && devices.trim() ? ` — ${devices.trim()}` : ""}` +
                      `\nOrigem: ${originSector || "—"}\nCulturas/ATB: ${culturesAtb || "—"}\nEspecialidades em conjunto: ${specialties || "—"}` +
                      `\nSOFA: ${sofaTotal} (${sofaPreenchidos}/${SOFA_COMPONENTES.length} componentes)` : ""),
        plan: `${plan}\n\nPrevisão de alta: ${dischargePredictionLabel}`,
      };

      const physicalExam = {
        general: physGeneral, cardiovascular: physCv, respiratory: physResp,
        abdomen: physAbd, neurological: physNeuro, extremities: physExt, skin: "", other: "",
      };

      // MIGRAÇÃO: clinical_evolutions → evolucoes. Colunas dedicadas do modelo
      // antigo (patient_name/bed/sector, vital_signs, cid_*, validated_*,
      // created_by*, evolution_type, diagnostic_hypotheses) preservadas dentro do
      // JSON `soap` (prefixo `__`, convenção de useEvolutions.mapEvolution).
      // Sem profissional resolvido não é possível gravar (FK obrigatória) → a
      // admissão fica só em `internacoes` (a timeline sintetiza a evolução virtual).
      if (profissionalId) {
        const soapPayload = {
          ...soapAdmission,
          antecedentes: antecedentesList,
          __patient_name: patient.name,
          __patient_bed: patient.bed,
          __patient_sector: patient.sector,
          __vital_signs: {
            pa, fc, fr, temp: tax, spo2,
            glasgow: glasgowTotal != null ? String(glasgowTotal) : "",
            glasgow_ovm: { ocular: glasgowEye, verbal: glasgowVerbal, motora: glasgowMotor, total: glasgowTotal },
            diurese: "", dor: "",
          },
          __diagnostic_hypotheses: diagnosticHypotheses.trim() || null,
          __cid_primary: cidPrimary || null,
          __cid_secondary: cidSecondary || null,
          __validated_at: now,
          __validated_by: user.id,
          __validated_by_name: doctorName,
          __created_by: user.id,
          __created_by_name: doctorName,
          __evolution_type: "admission",
          // Modo de admissao (uti/enfermaria/emergencia) — chave ADITIVA, sempre presente.
          __admission_mode: admissionMode,
          // UTI estruturado — chaves ADITIVAS (não substituem nada do schema).
          ...(isUti ? {
            __uti_justificativa: { codigo: utiJustificativa || null, outro: utiJustificativaOutro.trim() || admissionReason.trim() || null },
            __uti_vasoativo: utiVasoativo,
            __uti_dispositivos: { veioCom: utiComDispositivos, detalhe: devices },
            __uti_sofa: { respostas: sofaRespostas, total: sofaTotal },
          } : {}),
        };
        const { error: evError } = await supabase
          .from("evolucoes")
          .insert({
            internacao_id: patient.id,
            profissional_id: profissionalId,
            data_hora: now,
            soap: soapPayload,
            exame_fisico: physicalExam,
            status: toEvolucaoStatusDb("validated"),
          } as any);
        if (evError) throw evError;
      } else {
        console.warn("[AdmissionDialog] profissional não resolvido — evolução de admissão não gravada");
      }

      // MIGRAÇÃO: bloco patients.update DEGRADADO por completo — admission_status/
      // admitted_at/uti_*/saps_*/uti_discharge_prediction/admission_history/diagnoses
      // não têm coluna no schema novo. O estado da admissão vive em
      // internacoes.status='admitido'; previsão de alta/UTI só no impresso e no
      // JSON `soap`. A busca de patients.created_at para o cronômetro SAPS caiu.
      //
      // AUDITORIA 18/09/2026 (herdada do staging, já corrigida acima): o bug de
      // update com erro descartado silenciosamente existia neste bloco antigo.
      // A correção (checar erro e lançar exceção) já está aplicada no update de
      // `internacoes` logo acima — não há update em `patients` para repetir aqui.

      // Admissão persistida com sucesso — agora a impressão é segura.
      setIsSaved(true);
      try { if (draftKey) localStorage.removeItem(draftKey); } catch {}
      setDraftSavedAt(null);

      // Imprime automaticamente após salvar: o fluxo natural do médico é
      // "assinar → imprimir", e agora o papel sempre reflete um registro real.
      // Se a impressão falhar, a admissão já está salva — o médico pode
      // reimprimir pela consulta da admissão (AdmissionConsultDialog).
      try {
        await doPrint();
        toast.success("ADMISSÃO REGISTRADA (D0) — documento enviado para impressão");
      } catch (printErr) {
        console.error("Falha ao imprimir após salvar:", printErr);
        toast.success("ADMISSÃO REGISTRADA (D0)", {
          description: "A admissão foi salva. Reimprima pela consulta da admissão, se necessário.",
        });
      }

      onClose();
      onSuccess?.();
    } catch (e: any) {
      toast.error("Não foi possível registrar admissão: " + (e.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  // Intercepta o fechamento. Se há conteúdo clínico preenchido e a admissão
  // ainda NÃO foi salva no banco, pede confirmação — evita que o médico saia
  // achando que admitiu quando só imprimiu/rascunhou.
  const requestClose = (next: boolean) => {
    if (!next && hasAnyContent && !isSaved) {
      setConfirmCloseOpen(true);
      return;
    }
    if (!next) onClose();
  };

  return (
    <>
      {/* Cabeçalho elegante — identidade unificada */}
      <header className={cn("flex flex-col space-y-2 text-center sm:text-left px-6 pt-4 pb-4 border-b space-y-3", !embedded && "bg-released-soft/10")}>
        {!embedded && (
          <>
            <h2 className="text-lg font-medium leading-none tracking-tight flex items-center gap-2 uppercase tracking-wider text-foreground">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-released/15 text-released-on-soft">
                <Stethoscope className="h-4 w-4" />
              </span>
              Admissão Hospitalar
              <Badge variant="outline" className="ml-2 border-released/40 bg-released/10 text-released-on-soft">
                {isUti ? "UTI / UCI" : isEmergencia ? "EMERGÊNCIA — SALA VERMELHA" : "ENFERMARIA"}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground text-xs">
              Esta admissão será registrada como <strong>D0</strong> e aparecerá como primeira entrada na linha do tempo (ADMISSÃO HOSPITALAR). Após assinada, só pode ser editada via adendo ou suspensa com justificativa.
            </p>

            {/* Identificação do paciente — fonte única (mesmo cabeçalho do Painel Clínico) */}
            <div className="rounded-md border border-released/20 bg-released/5 p-3">
              <PatientIdentityHeader
                patientId={patient.id}
                fallbackName={patient.name}
                fallbackBed={patient.bed}
                fallbackSector={patient.sector}
                fallbackAge={patient.age}
                variant="dialog"
              />
            </div>
          </>
        )}

        {/* Faixa de status: rascunho automático + pendências */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-muted border border-border px-3 py-1 text-xs text-foreground">
            <Save className="h-3 w-3" />
            {draftSavedAt
              ? <>Rascunho salvo automaticamente às <strong>{draftSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong> — você pode sair e continuar depois</>
              : <>O preenchimento é salvo automaticamente como <strong>rascunho</strong> — só vira admissão após validação</>}
          </span>
          {draftSavedAt && (
            <button type="button" onClick={discardDraft}
              className="inline-flex items-center gap-1 text-xs text-critical-on-soft hover:text-critical-on-soft hover:underline">
              <Trash2 className="h-3 w-3" /> Descartar rascunho
            </button>
          )}
          {attempted && missingList.length > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full bg-critical-soft border border-critical-border px-3 py-1 text-xs text-critical-on-soft">
              <AlertTriangle className="h-3 w-3" />
              Faltam: <strong>{missingList.join(" • ")}</strong>
            </span>
          )}
          {/* Aviso persistente: enquanto não assinar, a admissão NÃO existe no sistema */}
          {!isSaved && (
            <span className="inline-flex items-center gap-2 rounded-full bg-warning-soft border border-warning-border px-3 py-1 text-xs text-warning-on-soft">
              <AlertTriangle className="h-3 w-3" />
              Admissão <strong>ainda não registrada</strong> — clique em “Validar admissão (D0)” para salvar e liberar a impressão
            </span>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 min-w-0 overflow-x-hidden">
        {isEmergencia ? (
        /* ═══════════ MODO EMERGENCIA (Sala Vermelha) — layout enxuto ═══════════
           Nada e removido: o essencial fica aberto no topo; o resto vai para
           secoes colapsadas por padrao (Collapsible defaultOpen=false). */
        <div className="w-full min-w-0 space-y-4">
          {/* Faixa de contexto do modo */}
          <div className="rounded-lg border border-critical-border bg-critical-soft/40 px-4 py-2.5 flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-critical-on-soft" />
            <span className="text-xs font-semibold uppercase tracking-wide text-critical-on-soft">Modo emergência — Sala Vermelha</span>
            <span className="ml-auto text-xs text-muted-foreground">Estabilização: essencial aberto, complementos recolhidos</span>
          </div>

          {/* ───── ESSENCIAL (sempre aberto) ───── */}
          <Section icon={FileText} title="História admissional (HDA)" tone="slate">
            <ReqLabel missing={attempted && missing.hda}>HDA — História da Doença Atual (curta)</ReqLabel>
            <Textarea value={hda} onChange={e => setHda(e.target.value)} rows={3}
              placeholder="Paciente admitido com..." className={cn("mt-1", reqRing(attempted && missing.hda))} />
          </Section>

          <Section icon={FileText} title="Diagnóstico (CID-10)" hint="Busca por código ou descrição" tone="blue">
            <ReqLabel missing={attempted && missing.cidPrimary}>CID primário</ReqLabel>
            <CidSearchInput value={cidPrimary} onChange={setCidPrimary}
              placeholder="Ex.: J18, pneumonia..." className={cn("mt-1", reqRing(attempted && missing.cidPrimary))} />
          </Section>

          <Section icon={Pill} title="Conduta inicial" tone="slate">
            <ReqLabel missing={attempted && missing.plan}>Conduta inicial</ReqLabel>
            <Textarea value={plan} onChange={e => setPlan(e.target.value)} rows={4}
              placeholder={"• Monitorização\n• Suporte clínico\n• ..."} className={cn("mt-1", reqRing(attempted && missing.plan))} />
          </Section>

          <Section icon={HeartPulse} title="Sinais vitais" tone="emerald">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><Label className="text-xs">PA sistólica</Label><Input value={paSys} onChange={e => setPaSys(e.target.value)} placeholder="120" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">PA diastólica</Label><Input value={paDia} onChange={e => setPaDia(e.target.value)} placeholder="80" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">FC (bpm)</Label><Input value={fc} onChange={e => setFc(e.target.value)} placeholder="bpm" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">FR (irpm)</Label><Input value={fr} onChange={e => setFr(e.target.value)} placeholder="irpm" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">SpO₂ (%)</Label><Input value={spo2} onChange={e => setSpo2(e.target.value)} placeholder="%" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">Temperatura (°C)</Label><Input value={tax} onChange={e => setTax(e.target.value)} placeholder="°C" className="mt-1" inputMode="decimal" /></div>
            </div>
          </Section>

          <Section icon={Brain} title="Glasgow + escores ao vivo"
            hint={glasgowTotal != null ? `Glasgow ${glasgowTotal} / 15` : "Selecione O / V / M"} tone="slate">
            <div className="space-y-3">
              <GlasgowRow label="Abertura ocular (1-4)" options={GLASGOW_EYE} value={glasgowEye} onSelect={setGlasgowEye} />
              <GlasgowRow label="Resposta verbal (1-5)" options={GLASGOW_VERBAL} value={glasgowVerbal} onSelect={setGlasgowVerbal} />
              <GlasgowRow label="Resposta motora (1-6)" options={GLASGOW_MOTOR} value={glasgowMotor} onSelect={setGlasgowMotor} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Glasgow</span>
                  <span className={cn(
                    "text-lg font-semibold",
                    glasgowTotal == null ? "text-muted-foreground"
                      : glasgowTotal <= 8 ? "text-critical-on-soft"
                      : glasgowTotal <= 12 ? "text-warning-on-soft"
                      : "text-released-on-soft"
                  )}>
                    {glasgowTotal != null ? `${glasgowTotal} / 15` : "— / 15"}
                  </span>
                </div>
                <div className="rounded-md border border-border bg-background px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">qSOFA</p>
                  <p className="mt-1 flex items-baseline gap-2">
                    <span className={cn("text-lg font-semibold", qsofa.alto ? "text-critical-on-soft" : "text-foreground")}>{qsofa.score}</span>
                    <span className="text-xs text-muted-foreground">/ 3 {qsofa.alto && <strong className="text-critical-on-soft">alto risco</strong>}</span>
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">NEWS2</p>
                  {news2 ? (
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-foreground">{news2.score}</span>
                      <span className={cn("text-xs rounded px-1.5 py-0.5", news2RiskLabels[news2.risk].className)}>{news2RiskLabels[news2.risk].label}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Preencha os sinais vitais.</p>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* ───── COMPLEMENTOS (colapsados por padrão) ───── */}
          <EmergenciaCollapsible icon={CalendarDays} title="Previsão de alta">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <Label className="text-xs flex items-center gap-1"><Hash className="h-3 w-3" /> Dias previstos</Label>
                <Input type="number" min={0} value={predictionDays} onChange={e => handleDaysChange(e.target.value)} disabled={noPrediction} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Data prevista</Label>
                <Input type="date" value={predictionDate} onChange={e => handleDateChange(e.target.value)} disabled={noPrediction} className="mt-1" />
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground pb-2 select-none">
                <Checkbox checked={noPrediction} onCheckedChange={v => setNoPrediction(v === true)} />
                Sem previsão
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Resultado: <strong className="text-foreground">{dischargePredictionLabel}</strong></p>
          </EmergenciaCollapsible>

          <EmergenciaCollapsible icon={ClipboardList} title="Antecedentes mórbidos pessoais">
            <div className="flex gap-2">
              <Input
                value={antInput}
                onChange={e => setAntInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitAntecedente(); } }}
                placeholder="Ex.: HAS, DM2, tabagismo, ex-etilista..."
                className="flex-1"
              />
            </div>
            <WizardItemQueue
              items={antQueue.items}
              editingUid={antQueue.editingUid}
              onEdit={editAntecedente}
              onRemove={antQueue.remove}
              onAddCurrent={commitAntecedente}
              onSaveCurrent={commitAntecedente}
              addLabel="Acrescentar antecedente"
              accentClassName="border-border bg-muted/40 text-foreground"
              hint="Digite um antecedente e clique em Acrescentar (ou Enter). Repita para adicionar vários."
              disableAdd={!antInput.trim()}
            />
          </EmergenciaCollapsible>

          <EmergenciaCollapsible icon={Pill} title="MUC — Medicações de uso contínuo">
            <Textarea value={muc} onChange={e => setMuc(e.target.value)} rows={3} className="mt-1" placeholder="Uma medicação por linha..." />
          </EmergenciaCollapsible>

          <EmergenciaCollapsible icon={AlertTriangle} title="Alergias medicamentosas">
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup type="single" value={allergyMode ?? ""} onValueChange={v => { if (v === "nao" || v === "sim") handleAllergyMode(v); }}>
                <ToggleGroupItem value="nao" className="data-[state=on]:bg-released data-[state=on]:text-white">Nega</ToggleGroupItem>
                <ToggleGroupItem value="sim" className="data-[state=on]:bg-critical data-[state=on]:text-white">Sim</ToggleGroupItem>
              </ToggleGroup>
              {allergyMode === "sim" && (
                <Input value={allergies === "Nega" ? "" : allergies} onChange={e => setAllergies(e.target.value)} placeholder="Especificar alergia(s)..." className="flex-1 min-w-[12rem]" />
              )}
            </div>
          </EmergenciaCollapsible>

          <EmergenciaCollapsible icon={Activity} title="Antropometria e dextro">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><Label className="text-xs">Peso (kg)</Label><Input value={weight} onChange={e => setWeight(e.target.value)} placeholder="kg" className="mt-1" inputMode="decimal" /></div>
              <div><Label className="text-xs">Altura (m ou cm)</Label><Input value={height} onChange={e => setHeight(e.target.value)} placeholder="1,70 ou 170" className="mt-1" inputMode="decimal" /></div>
              <div>
                <Label className="text-xs">IMC</Label>
                <div className={cn("mt-1 h-10 rounded-md border bg-background px-3 flex items-center justify-between text-sm", imc ? "border-border/40" : "border-border text-muted-foreground/60")}>
                  {imc ? (<><span className="font-medium text-foreground">{imc.value}</span><span className={cn("text-xs uppercase tracking-wide", imc.color)}>{imc.label}</span></>) : (<span className="text-xs">Peso + altura</span>)}
                </div>
              </div>
              <div><Label className="text-xs">Dextro (mg/dL)</Label><Input value={dx} onChange={e => setDx(e.target.value)} placeholder="mg/dL" className="mt-1" inputMode="numeric" /></div>
            </div>
          </EmergenciaCollapsible>

          <EmergenciaCollapsible icon={Stethoscope} title="Exame físico segmentar">
            <div>
              <Label className="text-xs">Estado geral</Label>
              <Textarea value={physGeneral} onChange={e => setPhysGeneral(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Cardiovascular</Label><Textarea value={physCv} onChange={e => setPhysCv(e.target.value)} rows={2} className="mt-1" /></div>
              <div><Label className="text-xs">Respiratório</Label><Textarea value={physResp} onChange={e => setPhysResp(e.target.value)} rows={2} className="mt-1" /></div>
              <div><Label className="text-xs">Abdome</Label><Textarea value={physAbd} onChange={e => setPhysAbd(e.target.value)} rows={2} className="mt-1" /></div>
              <div><Label className="text-xs">Extremidades</Label><Textarea value={physExt} onChange={e => setPhysExt(e.target.value)} rows={2} className="mt-1" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Neurológico</Label><Textarea value={physNeuro} onChange={e => setPhysNeuro(e.target.value)} rows={2} className="mt-1" placeholder="Glasgow, pupilas, força, sensibilidade, reflexos, sinais focais..." /></div>
            </div>
          </EmergenciaCollapsible>

          <EmergenciaCollapsible icon={Stethoscope} title="Hipóteses diagnósticas (texto livre)">
            <Textarea
              value={diagnosticHypotheses}
              onChange={(e) => setDiagnosticHypotheses(e.target.value)}
              rows={4}
              placeholder={"Ex.:\nSepse de foco pulmonar\nSuspeita de TEP associado\nDM2 descompensado"}
              className="mt-1 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">Cada linha vira uma hipótese no card do paciente.</p>
          </EmergenciaCollapsible>

          <EmergenciaCollapsible icon={FileText} title="CID secundário">
            <CidSearchInput value={cidSecondary} onChange={setCidSecondary} placeholder="Opcional" className="mt-1" />
          </EmergenciaCollapsible>
        </div>
        ) : (
        <div className="w-full min-w-0 space-y-6">

          {/* ───── Diagnóstico e previsão ───── */}
          <GroupHeader step={1} title="Diagnóstico e previsão" />
          <div className="space-y-4">
            <Section icon={FileText} title="Diagnóstico (CID-10)" hint="Busca por código ou descrição" tone="blue">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <Section icon={CalendarDays} title="Previsão de alta" hint="Dias e data sincronizados" tone="amber">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
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
                <label className="flex items-center gap-2 text-xs text-foreground pb-2 select-none">
                  <Checkbox checked={noPrediction} onCheckedChange={v => setNoPrediction(v === true)} />
                  Sem previsão
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Resultado: <strong className="text-foreground">{dischargePredictionLabel}</strong>
              </p>
            </Section>
          </div>

          {/* ───── Anamnese ───── */}
          <GroupHeader step={2} title="Anamnese" />
          <div className="space-y-4">
            <Section icon={FileText} title="História admissional (HDA)" tone="slate">
              <ReqLabel missing={attempted && missing.hda}>HDA — História da Doença Atual</ReqLabel>
              <Textarea value={hda} onChange={e => setHda(e.target.value)} rows={4}
                placeholder="Paciente admitido com..." className={cn("mt-1", reqRing(attempted && missing.hda))} />
            </Section>

            <Section icon={ClipboardList} title="Antecedentes mórbidos pessoais" hint="Acrescente um a um" tone="blue">
              <div className="flex gap-2">
                <Input
                  value={antInput}
                  onChange={e => setAntInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitAntecedente(); } }}
                  placeholder="Ex.: HAS, DM2, tabagismo, ex-etilista..."
                  className="flex-1"
                />
              </div>
              <WizardItemQueue
                items={antQueue.items}
                editingUid={antQueue.editingUid}
                onEdit={editAntecedente}
                onRemove={antQueue.remove}
                onAddCurrent={commitAntecedente}
                onSaveCurrent={commitAntecedente}
                addLabel="Acrescentar antecedente"
                accentClassName="border-border bg-muted/40 text-foreground"
                hint="Digite um antecedente e clique em Acrescentar (ou Enter). Repita para adicionar vários."
                disableAdd={!antInput.trim()}
              />
            </Section>

            <Section icon={Pill} title="MUC — Medicações de Uso Contínuo" tone="slate">
              <Textarea value={muc} onChange={e => setMuc(e.target.value)} rows={3} className="mt-1"
                placeholder="Uma medicação por linha..." />
            </Section>

            <Section icon={AlertTriangle} title="Alergias medicamentosas" tone="amber">
              <div className="flex flex-wrap items-center gap-3">
                <ToggleGroup
                  type="single"
                  value={allergyMode ?? ""}
                  onValueChange={v => { if (v === "nao" || v === "sim") handleAllergyMode(v); }}
                >
                  <ToggleGroupItem value="nao" className="data-[state=on]:bg-released data-[state=on]:text-white">Nega</ToggleGroupItem>
                  <ToggleGroupItem value="sim" className="data-[state=on]:bg-critical data-[state=on]:text-white">Sim</ToggleGroupItem>
                </ToggleGroup>
                {allergyMode === "sim" && (
                  <Input
                    value={allergies === "Nega" ? "" : allergies}
                    onChange={e => setAllergies(e.target.value)}
                    placeholder="Especificar alergia(s)..."
                    className="flex-1 min-w-[12rem]"
                  />
                )}
              </div>
            </Section>
          </div>

          {/* ───── Avaliação à beira do leito ───── */}
          <GroupHeader step={3} title="Avaliação à beira do leito" />
          <div className="space-y-4">
            <Section
              icon={Brain}
              title="Escala de Coma de Glasgow"
              hint={glasgowTotal != null ? `Total ${glasgowTotal} / 15` : "Selecione O / V / M"}
              tone="slate"
            >
              <div className="space-y-3">
                <GlasgowRow label="Abertura ocular (1-4)" options={GLASGOW_EYE} value={glasgowEye} onSelect={setGlasgowEye} />
                <GlasgowRow label="Resposta verbal (1-5)" options={GLASGOW_VERBAL} value={glasgowVerbal} onSelect={setGlasgowVerbal} />
                <GlasgowRow label="Resposta motora (1-6)" options={GLASGOW_MOTOR} value={glasgowMotor} onSelect={setGlasgowMotor} />
                <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Total de Glasgow</span>
                  <span className={cn(
                    "text-lg font-semibold",
                    glasgowTotal == null ? "text-muted-foreground"
                      : glasgowTotal <= 8 ? "text-critical-on-soft"
                      : glasgowTotal <= 12 ? "text-warning-on-soft"
                      : "text-released-on-soft"
                  )}>
                    {glasgowTotal != null ? `${glasgowTotal} / 15` : "— / 15"}
                  </span>
                </div>
              </div>
            </Section>

            <Section icon={HeartPulse} title="Sinais vitais admissionais" tone="emerald">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><Label className="text-xs">FC (bpm)</Label><Input value={fc} onChange={e => setFc(e.target.value)} placeholder="bpm" className="mt-1" inputMode="numeric" /></div>
                <div><Label className="text-xs">PA sistólica</Label><Input value={paSys} onChange={e => setPaSys(e.target.value)} placeholder="120" className="mt-1" inputMode="numeric" /></div>
                <div><Label className="text-xs">PA diastólica</Label><Input value={paDia} onChange={e => setPaDia(e.target.value)} placeholder="80" className="mt-1" inputMode="numeric" /></div>
                <div><Label className="text-xs">FR (irpm)</Label><Input value={fr} onChange={e => setFr(e.target.value)} placeholder="irpm" className="mt-1" inputMode="numeric" /></div>
                <div><Label className="text-xs">Temperatura (°C)</Label><Input value={tax} onChange={e => setTax(e.target.value)} placeholder="°C" className="mt-1" inputMode="decimal" /></div>
                <div><Label className="text-xs">SpO₂ (%)</Label><Input value={spo2} onChange={e => setSpo2(e.target.value)} placeholder="%" className="mt-1" inputMode="numeric" /></div>
                <div><Label className="text-xs">Peso (kg)</Label><Input value={weight} onChange={e => setWeight(e.target.value)} placeholder="kg" className="mt-1" inputMode="decimal" /></div>
                <div><Label className="text-xs">Dextro (mg/dL)</Label><Input value={dx} onChange={e => setDx(e.target.value)} placeholder="mg/dL" className="mt-1" inputMode="numeric" /></div>
              </div>
            </Section>

            <Section icon={Activity} title="Antropometria" hint="IMC calculado automaticamente" tone="blue">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Altura (m ou cm)</Label>
                  <Input value={height} onChange={e => setHeight(e.target.value)} placeholder="1,70 ou 170" className="mt-1" inputMode="decimal" />
                </div>
                <div>
                  <Label className="text-xs">IMC</Label>
                  <div className={cn(
                    "mt-1 h-10 rounded-md border bg-background px-3 flex items-center justify-between text-sm",
                    imc ? "border-border/40" : "border-border text-muted-foreground/60"
                  )}>
                    {imc ? (
                      <>
                        <span className="font-medium text-foreground">{imc.value}</span>
                        <span className={cn("text-xs uppercase tracking-wide", imc.color)}>{imc.label}</span>
                      </>
                    ) : (
                      <span className="text-xs">Preencha peso e altura</span>
                    )}
                  </div>
                </div>
              </div>
            </Section>

            {/* Painel de escores ao vivo — qSOFA + NEWS2 */}
            <Section icon={Gauge} title="Escores ao vivo" hint="Recalculados a cada mudança" tone="slate">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">qSOFA</p>
                  <p className="mt-1 flex items-baseline gap-2">
                    <span className={cn("text-2xl font-semibold", qsofa.alto ? "text-critical-on-soft" : "text-foreground")}>{qsofa.score}</span>
                    <span className="text-xs text-muted-foreground">
                      / 3 {qsofa.alto && <strong className="text-critical-on-soft">— alto risco</strong>}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PAS ≤100, FR ≥22, Glasgow &lt;15 ({qsofa.avaliados}/3 avaliados)
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">NEWS2</p>
                  {news2 ? (
                    <>
                      <p className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-semibold text-foreground">{news2.score}</span>
                        <span className={cn("text-xs rounded px-1.5 py-0.5", news2RiskLabels[news2.risk].className)}>
                          {news2RiskLabels[news2.risk].label}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        FR, SpO₂, Temp, PAS e FC. Glasgow não compõe o escore.
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Preencha os sinais vitais.</p>
                  )}
                </div>
              </div>
            </Section>
          </div>

          {/* ───── Exame Físico ───── */}
          <GroupHeader step={4} title="Exame Físico" />
          <div className="space-y-4">
            <Section icon={Stethoscope} title="Exame físico segmentar" tone="slate">
              <div>
                <ReqLabel missing={attempted && missing.examGeneral}>Estado geral</ReqLabel>
                <Textarea value={physGeneral} onChange={e => setPhysGeneral(e.target.value)} rows={2} className={cn("mt-1", reqRing(attempted && missing.examGeneral))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Cardiovascular</Label><Textarea value={physCv} onChange={e => setPhysCv(e.target.value)} rows={2} className="mt-1" /></div>
                <div><Label className="text-xs">Respiratório</Label><Textarea value={physResp} onChange={e => setPhysResp(e.target.value)} rows={2} className="mt-1" /></div>
                <div><Label className="text-xs">Abdome</Label><Textarea value={physAbd} onChange={e => setPhysAbd(e.target.value)} rows={2} className="mt-1" /></div>
                <div><Label className="text-xs">Extremidades</Label><Textarea value={physExt} onChange={e => setPhysExt(e.target.value)} rows={2} className="mt-1" /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Neurológico</Label><Textarea value={physNeuro} onChange={e => setPhysNeuro(e.target.value)} rows={2} className="mt-1" placeholder="Glasgow, pupilas, força, sensibilidade, reflexos, sinais focais..." /></div>
              </div>
            </Section>
          </div>

          {/* ───── Conduta e hipóteses ───── */}
          <GroupHeader step={5} title="Conduta e hipóteses" />
          <div className="space-y-4">
            <Section icon={Pill} title="Plano terapêutico" tone="slate">
              <ReqLabel missing={attempted && missing.plan}>Conduta inicial</ReqLabel>
              <Textarea value={plan} onChange={e => setPlan(e.target.value)} rows={5}
                placeholder={"• Monitorização\n• Suporte clínico\n• Antibioticoterapia\n• ..."}
                className={cn("mt-1", reqRing(attempted && missing.plan))} />
            </Section>

            <Section icon={Stethoscope} title="Hipóteses Diagnósticas (texto livre)" hint="Uma hipótese por linha — sincroniza automaticamente com o painel clínico" tone="blue">
              <Textarea
                value={diagnosticHypotheses}
                onChange={(e) => setDiagnosticHypotheses(e.target.value)}
                rows={4}
                placeholder={"Ex.:\nSepse de foco pulmonar\nSuspeita de TEP associado\nDM2 descompensado"}
                className="mt-1 font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cada linha vira uma hipótese no card do paciente. Esse campo passa a ser <strong>somente leitura no painel</strong> e só é atualizado por nova evolução clínica.
              </p>
            </Section>
          </div>

          {/* ───── UTI ───── */}
          {isUti && (
            <>
            <GroupHeader step={6} title="UTI / UCI" />
            <div className="space-y-4">
              <Section icon={AlertTriangle} title="Justificativa de admissão na UTI" tone="amber">
                <div className="flex flex-wrap gap-1.5">
                  {UTI_JUSTIFICATIVAS.map(j => (
                    <button
                      type="button" key={j.codigo}
                      onClick={() => setUtiJustificativa(prev => prev === j.codigo ? "" : j.codigo)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        utiJustificativa === j.codigo
                          ? "border-released bg-released text-white"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      {j.rotulo}
                    </button>
                  ))}
                </div>
                {utiJustificativa === "outro" && (
                  <Input
                    value={utiJustificativaOutro}
                    onChange={e => setUtiJustificativaOutro(e.target.value)}
                    placeholder="Delimitar justificativa..."
                    className="mt-2"
                  />
                )}
              </Section>

              <Section icon={HeartPulse} title="Droga vasoativa" tone="slate">
                <div className="flex flex-wrap items-center gap-3">
                  <ToggleGroup
                    type="single"
                    value={utiVasoativo == null ? "" : utiVasoativo ? "sim" : "nao"}
                    onValueChange={v => { if (v === "sim") setUtiVasoativo(true); else if (v === "nao") setUtiVasoativo(false); }}
                  >
                    <ToggleGroupItem value="nao" className="data-[state=on]:bg-released data-[state=on]:text-white">Não</ToggleGroupItem>
                    <ToggleGroupItem value="sim" className="data-[state=on]:bg-critical data-[state=on]:text-white">Sim</ToggleGroupItem>
                  </ToggleGroup>
                  <span className="text-xs text-muted-foreground">Em uso de droga vasoativa na admissão?</span>
                </div>
              </Section>

              <Section icon={Activity} title="Dispositivos na admissão" tone="slate">
                <div className="flex flex-wrap items-center gap-3">
                  <ToggleGroup
                    type="single"
                    value={utiComDispositivos == null ? "" : utiComDispositivos ? "sim" : "nao"}
                    onValueChange={v => { if (v === "sim") setUtiComDispositivos(true); else if (v === "nao") setUtiComDispositivos(false); }}
                  >
                    <ToggleGroupItem value="nao" className="data-[state=on]:bg-released data-[state=on]:text-white">Não</ToggleGroupItem>
                    <ToggleGroupItem value="sim" className="data-[state=on]:bg-critical data-[state=on]:text-white">Sim</ToggleGroupItem>
                  </ToggleGroup>
                  <span className="text-xs text-muted-foreground">Veio com dispositivos?</span>
                </div>
                {utiComDispositivos && (
                  <div className="mt-2">
                    <Label className="text-xs">Detalhar dispositivos</Label>
                    <Textarea value={devices} onChange={e => setDevices(e.target.value)} rows={2} placeholder="IOT, CVC, SVD, ..." className="mt-1" />
                  </div>
                )}
              </Section>

              <Section
                icon={Gauge}
                title="SOFA — admissão"
                hint={`Total ${sofaTotal} / 24 • ${sofaPreenchidos}/${SOFA_COMPONENTES.length} componentes`}
                tone="slate"
              >
                <div className="space-y-3">
                  {SOFA_COMPONENTES.map(comp => (
                    <SofaRow
                      key={comp.key}
                      comp={comp}
                      value={sofaRespostas[comp.key]}
                      onSelect={id => setSofaRespostas(prev => ({ ...prev, [comp.key]: prev[comp.key] === id ? null : id }))}
                    />
                  ))}
                  <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total SOFA {sofaPreenchidos < SOFA_COMPONENTES.length && <span className="normal-case">(parcial — {sofaPreenchidos}/{SOFA_COMPONENTES.length})</span>}
                    </span>
                    <span className={cn(
                      "text-lg font-semibold",
                      sofaPreenchidos === 0 ? "text-muted-foreground"
                        : sofaTotal >= 11 ? "text-critical-on-soft"
                        : sofaTotal >= 6 ? "text-warning-on-soft"
                        : "text-released-on-soft"
                    )}>
                      {sofaTotal} / 24
                    </span>
                  </div>
                </div>
              </Section>

              <Section icon={ClipboardList} title="Dados complementares UTI" tone="amber">
                <div><Label className="text-xs">Origem (setor anterior)</Label><Input value={originSector} onChange={e => setOriginSector(e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Culturas pendentes / ATB em curso</Label><Textarea value={culturesAtb} onChange={e => setCulturesAtb(e.target.value)} rows={2} className="mt-1" /></div>
                <div><Label className="text-xs">Especialidades em conjunto</Label><Input value={specialties} onChange={e => setSpecialties(e.target.value)} className="mt-1" /></div>
              </Section>

              <Section icon={ShieldCheck} title="Ficha SAPS 3 — Aviso" tone="amber">
                <p className="text-xs text-foreground leading-relaxed">
                  A admissão UTI/UCI gera automaticamente uma <strong>Ficha SAPS 3 pendente</strong>, com prazo de{" "}
                  <strong className="text-warning-on-soft">24 horas</strong> a partir da pré-admissão (janela operacional / AMIB).
                  A admissão pode ser <strong>validada e impressa normalmente</strong>; a SAPS 3 segue como tarefa paralela
                  no Painel Clínico até ser finalizada em <code>/saps3</code>.
                </p>
                <label className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-soft/70 p-3 cursor-pointer select-none">
                  <Checkbox checked={sapsAck} onCheckedChange={v => setSapsAck(v === true)} className="mt-1" />
                  <span className="text-xs text-foreground">
                    <strong className="uppercase tracking-wide text-warning-on-soft">Ciência (opcional)</strong> — declaro estar
                    ciente de que a ficha SAPS 3 está pendente e deve ser finalizada em até 24 h.
                  </span>
                </label>
              </Section>
            </div>
            </>
          )}
        </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-4 sm:px-6 py-4 border-t bg-muted/60 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={handlePrint}
          disabled={submitting || !isSaved}
          className="w-full sm:w-auto gap-2"
          title={isSaved
            ? "Imprimir o documento de admissão"
            : "Disponível após validar a admissão (D0). A impressão só é liberada quando a admissão estiver salva no sistema."}
        >
          <Printer className="h-4 w-4" /> Imprimir Admissão
        </Button>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
          <Button variant="ghost" onClick={() => requestClose(false)} disabled={submitting} className="w-full sm:w-auto order-last sm:order-none">Cancelar</Button>
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={submitting}
            className="w-full sm:w-auto gap-2 border-warning text-warning-on-soft hover:bg-warning-soft uppercase tracking-wider"
            title="Salva o rascunho e libera os módulos clínicos (evolução, prescrição, requisições, docs e histórico) para preenchimento posterior."
          >
            Salvar Rascunho
          </Button>
          <Button
            onClick={() => setPasswordConfirmOpen(true)}
            disabled={submitting || !canValidate}
            className="w-full sm:w-auto gap-2 bg-released hover:bg-released text-white uppercase tracking-wider"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Validar admissão (D0)
          </Button>
        </div>
      </div>

      {/* Confirmação ao sair com admissão preenchida mas NÃO salva no banco */}
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning-on-soft">
              <AlertTriangle className="h-5 w-5 text-warning-on-soft" /> Admissão não registrada
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm space-y-2">
              <span className="block">
                Você preencheu a admissão mas <strong>ainda não a validou</strong>. Se sair agora, ela
                <strong> não ficará registrada no sistema</strong> — nenhum documento D0 será gerado no prontuário.
              </span>
              <span className="block text-xs text-muted-foreground">
                O conteúdo permanece salvo como <strong>rascunho local</strong> neste navegador e pode ser retomado depois.
                Para registrar a admissão de fato, volte e clique em “Validar admissão (D0)”.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e validar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmCloseOpen(false); onClose(); }}
              className="bg-warning hover:bg-warning text-white"
            >
              Sair sem registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de identidade antes de assinar a admissão clínica */}
      <PasswordConfirmDialog
        open={passwordConfirmOpen}
        onOpenChange={setPasswordConfirmOpen}
        title="Validar admissão (D0)"
        description="Confirme sua identidade para registrar a admissão clínica do paciente. Após validada, o documento D0 será gerado no prontuário."
        actionLabel="Validar admissão"
        onConfirmed={handleSubmit}
      />
    </>
  );
}
