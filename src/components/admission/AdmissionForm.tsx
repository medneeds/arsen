import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { seedAdmissionFromHistory } from "@/lib/seedAdmission";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor, richHtmlToPlainText } from "@/components/ui/rich-text-editor";
import { DevicesCulturesSection } from "@/components/evolution/DevicesCulturesSection";
import { formatDeviceLabel, type EvolutionDevice } from "@/lib/devicesCatalog";
import { EXAM_FIELDS } from "@/lib/examFields";
import { CidSearchInput } from "@/components/CidSearchInput";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion } from "@/components/ui/accordion";
import { AccordionSectionItem } from "@/components/shared/AccordionSectionItem";
import { calcularQSofa } from "@/lib/qsofa";
import { calculateNEWS2, news2RiskLabels, parseVitalNumber } from "@/lib/news2";
import {
  SOFA_COMPONENTES, calcularSofaTotal, componentesPreenchidos, pontosComponente,
  type SofaRespostas, type SofaComponente,
} from "@/lib/sofa";
import {
  Stethoscope, Loader2, AlertTriangle, ClipboardCheck,
  HeartPulse, Activity, FileText, Pill, CalendarDays, Hash,
  Printer, ShieldCheck, Save, Trash2, Brain, Gauge, ClipboardList,
  Plus, X, ChevronUp, ChevronDown, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printAdmissionNormaZero } from "@/lib/printAdmission";
import { resolveCurrentBedSector } from "@/lib/resolvePatientHeader";
import { admissionModeForSector, isSurgicalSector, type AdmissionMode } from "@/lib/sectorComplexity";
import { parseDiagnosesText } from "@/lib/diagnosesText";
import { calcDIH } from "@/lib/dihCalc";
import { isSemAlergia, SEM_RELATO } from "@/lib/allergyStatus";
import { SapsView, type SapsRow } from "@/components/saps3/SapsView";
import { toEvolucaoStatusDb } from "@/lib/evolucaoStatus";
import { PatientIdentityHeader } from "@/components/PatientIdentityHeader";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { useSectorNavigation } from "@/hooks/useSectorNavigation";
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

/** Label de campo obrigatorio: so um asterisco vermelho ao lado (sem a palavra
 *  "Obrigatorio"). O destaque `missing` (apos tentativa de submit) colore o texto
 *  do label, mantendo a sinalizacao de pendencia sem poluir o layout. */
const ReqLabel = ({ children, missing }: { children: React.ReactNode; missing?: boolean }) => (
  <Label className={cn(
    "text-xs flex items-center gap-1",
    missing ? "text-critical-on-soft" : "text-foreground"
  )}>
    <span>{children}</span>
    <span className="text-destructive font-semibold leading-none" aria-hidden="true">*</span>
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
  /** SAPS 3 sob a via Cuidados Intensivos: a ficha ja carregada (consulta) e um
   *  gatilho para abrir/preencher. Passados pela AdmissaoPage; o dialogo omite. */
  sapsRow?: SapsRow | null;
  onOpenSaps?: () => void;
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

/* ───────── Lista numerada simples (substitui o staging "Itens preparados") ─────────
   Componente controlado: estado de itens vive no pai (string[]); aqui só o
   rascunho do input e o índice em edição. Input + "Adicionar" (ou Enter);
   abaixo, lista NUMERADA com remover (x) e clique no item para editar. */

const ItemListField = ({
  items, onChange, placeholder, inputClassName, inputAriaLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  inputClassName?: string;
  inputAriaLabel?: string;
}) => {
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (editingIndex != null) {
      onChange(items.map((it, i) => (i === editingIndex ? v : it)));
      setEditingIndex(null);
    } else {
      onChange([...items, v]);
    }
    setDraft("");
  };

  const startEdit = (i: number) => {
    setDraft(items[i] ?? "");
    setEditingIndex(i);
  };

  const removeItem = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
    if (editingIndex === i) { setEditingIndex(null); setDraft(""); }
    else if (editingIndex != null && i < editingIndex) setEditingIndex(editingIndex - 1);
  };

  // Reordenacao entre itens (padrao universal da plataforma): troca com o vizinho.
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    if (editingIndex === i) setEditingIndex(j);
    else if (editingIndex === j) setEditingIndex(i);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          placeholder={placeholder}
          aria-label={inputAriaLabel}
          className={cn("flex-1", inputClassName)}
        />
        <Button
          type="button" variant="outline" size="sm"
          onClick={commit} disabled={!draft.trim()}
          className="shrink-0 gap-1"
        >
          <Plus className="h-3 w-3" /> {editingIndex != null ? "Salvar" : "Adicionar"}
        </Button>
      </div>
      {items.length > 0 && (
        <ol className="space-y-1">
          {items.map((it, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-md border bg-background/70 px-2 py-1.5 text-xs",
                editingIndex === i ? "border-warning ring-1 ring-warning/40" : "border-border/60"
              )}
            >
              <span className="mt-0.5 w-5 shrink-0 text-right font-semibold text-muted-foreground">{i + 1}.</span>
              <button
                type="button" onClick={() => startEdit(i)}
                className="min-w-0 flex-1 break-words text-left hover:underline"
                title="Clique para editar"
              >
                {it}
              </button>
              <div className="flex shrink-0 flex-col -my-0.5">
                <button
                  type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  aria-label="Mover para cima"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-default"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                  aria-label="Mover para baixo"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-default"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => removeItem(i)}
                className="h-5 w-5 shrink-0 p-0 text-critical-on-soft hover:text-critical-on-soft"
                aria-label="Remover item"
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

/* ───────── Pathway de admissao (toggle "Tipo de admissao", 4 vias) ─────────
   A via deixa de ser DERIVADA do setor e passa a ser ESCOLHA DO MEDICO, sempre
   disponivel. O modo efetivo do form (uti/enfermaria/emergencia) e a secao de
   dados cirurgicos DERIVAM da via escolhida — nao mais do setor. O setor apenas
   define a escolha INICIAL (coerente), que o medico pode trocar livremente. */
type AdmissionPathway = "emergencia" | "enfermaria" | "uti";

/** Modo de admissao efetivo de cada via (dirige obrigatorios, layout e persistencia). */
const PATHWAY_MODE: Record<AdmissionPathway, AdmissionMode> = {
  emergencia: "emergencia",
  enfermaria: "enfermaria",
  uti: "uti",
};

const PATHWAY_OPTIONS: { value: AdmissionPathway; label: string }[] = [
  { value: "emergencia", label: "Urgência e Emergência" },
  { value: "enfermaria", label: "Enfermaria Clínico-Cirúrgica" },
  { value: "uti", label: "Cuidados Intensivos" },
];

/** Rotulo curto para a faixa/badge do cabecalho (reflete a via escolhida). */
const PATHWAY_BADGE: Record<AdmissionPathway, string> = {
  emergencia: "URGÊNCIA E EMERGÊNCIA",
  enfermaria: "ENFERMARIA CLÍNICO-CIRÚRGICA",
  uti: "CUIDADOS INTENSIVOS",
};

const isAdmissionPathway = (v: unknown): v is AdmissionPathway =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(PATHWAY_MODE, v);

/** Normaliza vias LEGADAS (rascunhos antigos) para o conjunto atual de 3 vias:
 *  enfermaria_clinica/enfermaria_cirurgica -> enfermaria. Retorna null se invalido. */
function normalizePathway(v: unknown): AdmissionPathway | null {
  if (v === "enfermaria_clinica" || v === "enfermaria_cirurgica") return "enfermaria";
  return isAdmissionPathway(v) ? v : null;
}
/** Rascunho/legado era via cirurgica? (para reativar a secao cirurgica). */
const wasLegacySurgical = (v: unknown): boolean => v === "enfermaria_cirurgica";

/** Escolha inicial da via a partir do setor: UTI/UCI -> Cuidados Intensivos,
 *  Sala Vermelha -> Urgencia e Emergencia, setor cirurgico -> Enfermaria
 *  Cirurgica, demais -> Enfermaria Clinica. Combina admissionModeForSector com
 *  isSurgicalSector (ambos ja existentes). */
function pathwayFromSector(sector: string): AdmissionPathway {
  const mode = admissionModeForSector(sector);
  if (mode === "uti") return "uti";
  if (mode === "emergencia") return "emergencia";
  return "enfermaria";
}

/* ───────── Acordeao — secoes abertas por padrao, por modo efetivo ─────────
   Regra (Artur): na admissao, abrem por padrao APENAS os OBRIGATORIOS (CID, HDA,
   Plano); os demais ficam retraidos — para emergencia e enfermaria. A UTI mantem
   o comportamento habitual (mais secoes abertas, inclusive as especificas). */
const EMERGENCIA_OPEN_SECTIONS = ["em-cid", "em-hda", "em-conduta"];
const ENFERMARIA_OPEN_SECTIONS = ["nm-diagnostico", "nm-hda", "nm-plano"];
const UTI_OPEN_SECTIONS = [
  "nm-diagnostico", "nm-hda", "nm-glasgow", "nm-vitais",
  "nm-exame", "nm-plano", "nm-hipoteses",
  "nm-uti-justif", "nm-uti-disp",
];
const openSectionsForMode = (mode: AdmissionMode): string[] =>
  mode === "emergencia" ? EMERGENCIA_OPEN_SECTIONS
    : mode === "uti" ? UTI_OPEN_SECTIONS
    : ENFERMARIA_OPEN_SECTIONS;

/* ───────── Component ───────── */

export function AdmissionForm({ patient, onClose, onSuccess, embedded = false, sapsRow = null, onOpenSaps }: AdmissionFormProps) {
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { user } = useAuth();
  // Setores disponiveis do hospital (alas -> setores) para o SELECT de origem UTI.
  const { sectors } = useSectorNavigation();
  // Espelho em ref para a inferencia de originOutros na carga do rascunho sem
  // tornar `sectors` dependencia do effect (evita re-hidratar quando a lista chega).
  const sectorsRef = useRef(sectors);
  sectorsRef.current = sectors;
  // Via de admissao — ESCOLHA DO MEDICO (toggle "Tipo de admissao"), sempre
  // disponivel. O setor so define a escolha INICIAL; o medico troca livremente.
  const initialPathway = useMemo<AdmissionPathway>(() => pathwayFromSector(patient.sector), [patient.sector]);
  const [selectedPathway, setSelectedPathway] = useState<AdmissionPathway>(initialPathway);
  // PERMISSIONAMENTO (cadeados): a admissao so e permitida na via do SETOR atual.
  // As demais vias ficam visiveis, porem bloqueadas (cadeado). Admissoes validadas
  // de outros setores seguem acessiveis para CONSULTA (AdmissaoReadOnlyView), nunca
  // para edicao de outra via. allowedPathway deriva do setor do paciente.
  const allowedPathway = initialPathway;
  // Ordena as vias com a LIBERADA (do setor atual) primeiro, a esquerda — as
  // bloqueadas vem depois. Evita falsa sinalizacao (ex.: paciente em CI com a
  // via Cuidados Intensivos aparecendo por ultimo, a direita).
  const orderedPathwayOptions = useMemo(() => [
    ...PATHWAY_OPTIONS.filter(o => o.value === allowedPathway),
    ...PATHWAY_OPTIONS.filter(o => o.value !== allowedPathway),
  ], [allowedPathway]);
  // Via unica "Enfermaria Clinico-Cirurgica": o recorte cirurgico vira um toggle
  // OPCIONAL (paciente cirurgico). Inicia ligado quando o setor ja e cirurgico.
  const [surgicalPatient, setSurgicalPatient] = useState<boolean>(() => isSurgicalSector(patient.sector));
  // Modo efetivo do form DERIVA da via escolhida (nao mais do setor). isUti/
  // isEmergencia dirigem layout, obrigatorios e persistencia; isCirurgica habilita
  // a secao aditiva "Dados cirurgicos" (agora a via "Enfermaria Cirurgica").
  const admissionMode: AdmissionMode = PATHWAY_MODE[selectedPathway];
  const isUti = selectedPathway === "uti";
  const isEmergencia = selectedPathway === "emergencia";
  const isEnfermaria = selectedPathway === "enfermaria";
  // Dados cirurgicos: secao OPCIONAL da via enfermaria, habilitada pelo toggle
  // "paciente cirurgico" (nao mais uma via propria).
  const isCirurgica = isEnfermaria && surgicalPatient;
  // Secoes abertas do acordeao (mesma identidade visual da evolucao). Essenciais
  // abertas por padrao; complementares recolhidas. No modo emergencia o essencial
  // de estabilizacao fica aberto e os complementos, recolhidos — preservando o
  // comportamento anterior (complementos recolhidos por padrao).
  const [openSections, setOpenSections] = useState<string[]>(
    () => openSectionsForMode(PATHWAY_MODE[initialPathway]),
  );
  // Ao trocar de via entre emergencia <-> demais, o conjunto de secoes do acordeao
  // muda (ids em-* vs nm-*). Reabre as secoes essenciais do modo destino. Nao roda
  // na montagem (ref inicia igual); so em troca real — preserva abrir/fechar manual
  // dentro do mesmo modo.
  const prevModeEmergRef = useRef(isEmergencia);
  useEffect(() => {
    if (prevModeEmergRef.current === isEmergencia) return;
    prevModeEmergRef.current = isEmergencia;
    setOpenSections(openSectionsForMode(admissionMode));
  }, [isEmergencia, admissionMode]);
  const identifiers = usePatientIdentifiers(patient.id, patient.name, currentHospital?.id || null);
  const registryId = identifiers.registry?.id ?? patient.patient_registry_id ?? null;
  const draftKey = useMemo(() => registryId ? draftKeyFor(registryId) : null, [registryId]);

  // SAPS 3 acknowledgement (apenas UTI/UCI)
  const [sapsAck, setSapsAck] = useState(false);
  // Sub-modo da via Urgencia e Emergencia: "padrao" (completo) ou "express"
  // (objetivo, otimizado para a Sala Vermelha). Analogo ao SAPS que so aparece
  // na via UTI — fica sob o guarda-chuva da propria via de emergencia.
  const [emergMode, setEmergMode] = useState<"padrao" | "express">("padrao");
  // Sub-aba da via Cuidados Intensivos: "saps" (ficha SAPS 3) a esquerda ou
  // "intensivos" (corpo da admissao). SAPS pendente abre no preenchimento;
  // validada pula para Cuidados Intensivos.
  const [utiTab, setUtiTab] = useState<"saps" | "intensivos">(
    () => (sapsRow?.status === "validada" ? "intensivos" : "saps"),
  );
  // Quando a ficha passa a validada (carrega/valida), pula para Cuidados Intensivos.
  useEffect(() => {
    if (sapsRow?.status === "validada") setUtiTab("intensivos");
  }, [sapsRow?.status]);

  // Rotulo do dia da admissao (D0/Dn): DERIVADO da data de admissao HOSPITALAR
  // (internacoes.data_entrada), igual a timeline de evolucoes. So e D0 quando a
  // admissao e registrada no mesmo dia de calendario da entrada hospitalar; uma
  // admissao de setor novo (ex: transferencia para a UTI no 10o dia) sai como
  // D10 e NAO reseta — o fluxo temporal e unico, ancorado na internacao. Leitura
  // tolerante: qualquer falha mantem o fallback "D0".
  const [admissionDayLabel, setAdmissionDayLabel] = useState("D0");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!patient.id) return;
      try {
        const { data } = await supabase
          .from("internacoes")
          .select("data_entrada")
          .eq("id", patient.id)
          .maybeSingle();
        const entrada = data?.data_entrada;
        if (cancelled || !entrada) return;
        const dih = calcDIH(entrada);
        if (dih != null) setAdmissionDayLabel(`D${dih}`);
      } catch {
        /* best-effort — mantem o fallback D0 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patient.id]);

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
  // Exame fisico — campos alinhados com a evolucao (EXAM_FIELDS): pele e outros.
  const [physSkin, setPhysSkin] = useState("");
  const [physOther, setPhysOther] = useState("");
  // Exames complementares (RichText) — persistido em internacoes.exames_relevantes.
  const [complementares, setComplementares] = useState("");
  // Conduta e hipoteses como ITENS (arrays). As strings `plan` e
  // `diagnosticHypotheses` que o banco/impresso consomem sao DERIVADAS (join "\n")
  // mais abaixo — nada muda no shape persistido. Arrays facilitam o futuro
  // copiar-para-evolucao (planItems[]/diagnosticHypotheses[]).
  const [planItems, setPlanItems] = useState<string[]>([]);
  const [cidPrimary, setCidPrimary] = useState("");
  const [cidSecondary, setCidSecondary] = useState("");
  const [hypothesesItems, setHypothesesItems] = useState<string[]>([]);

  // Glasgow (ECG) — Ocular/Verbal/Motora; null = ainda nao avaliado.
  const [glasgowEye, setGlasgowEye] = useState<number | null>(null);
  const [glasgowVerbal, setGlasgowVerbal] = useState<number | null>(null);
  const [glasgowMotor, setGlasgowMotor] = useState<number | null>(null);

  // Antecedentes morbidos pessoais — lista incremental simples (string[]).
  const [antecedentesItems, setAntecedentesItems] = useState<string[]>([]);

  // Discharge prediction — sincronização dias <-> data
  const [noPrediction, setNoPrediction] = useState(false);
  const [predictionDate, setPredictionDate] = useState<string>(() => toIsoDate(daysFromToday(5)));
  const [predictionDays, setPredictionDays] = useState<string>("5");

  // UTI extras
  // admissionReason: estado legado (texto livre) — preservado como fallback do
  // campo "outro" ao hidratar rascunho antigo; não tem mais UI própria.
  const [admissionReason, setAdmissionReason] = useState("");
  const [originSector, setOriginSector] = useState("");
  // Dispositivos, Culturas e Antibioticos — componente compartilhado com a
  // evolucao. Persistidos nas MESMAS chaves do soap (devices / culturesHtml /
  // antibioticos), ancorados em internacao_id — sincronizam admissao<->evolucao.
  const [admDevices, setAdmDevices] = useState<EvolutionDevice[]>([]);
  const [culturesHtml, setCulturesHtml] = useState("");
  const [antibioticosHtml, setAntibioticosHtml] = useState("");
  // originOutros: estado só de UI. Controla se o setor de origem foi informado
  // como texto livre ("Outros"); originSector continua sendo a string persistida.
  const [originOutros, setOriginOutros] = useState(false);

  // UTI estruturado (novos widgets)
  const [utiJustificativa, setUtiJustificativa] = useState("");        // código do vocabulário
  const [utiJustificativaOutro, setUtiJustificativaOutro] = useState(""); // texto quando "outro"
  const [utiVasoativo, setUtiVasoativo] = useState<boolean | null>(null);
  const [sofaRespostas, setSofaRespostas] = useState<SofaRespostas>({});

  // Dados cirurgicos (setores cirurgicos) — campos aditivos, nenhum obrigatorio.
  const [surgProcedimento, setSurgProcedimento] = useState("");
  const [surgEspecialidade, setSurgEspecialidade] = useState("");
  const [surgCirurgiao, setSurgCirurgiao] = useState("");
  const [surgDataHora, setSurgDataHora] = useState("");   // datetime-local
  const [surgAnestesia, setSurgAnestesia] = useState("");
  const [surgCarater, setSurgCarater] = useState("");      // eletivo/urgencia/emergencia

  const [submitting, setSubmitting] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  // SEED a partir da historia ja persistida na internacao (transferencia em
  // cadeia): preenchido APENAS quando nao ha rascunho. `seededFromHistory` e so
  // UX; `seededKeyRef` garante que o seed roda uma unica vez por prontuario.
  const [seededFromHistory, setSeededFromHistory] = useState(false);
  const seededKeyRef = useRef<string | null>(null);

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
  // `amp`/`plan`/`diagnosticHypotheses` continuam sendo as strings que vao pro
  // soap/internacoes/impresso; agora derivam das listas (itens unidos por "\n").
  const amp = antecedentesItems.join("\n");
  const plan = planItems.join("\n");
  const diagnosticHypotheses = hypothesesItems.join("\n");
  // `pa` continua sendo a string "sys/dia" que o print e o soap consomem.
  const pa = [paSys.trim(), paDia.trim()].filter(Boolean).join("/");
  const glasgowTotal =
    glasgowEye != null && glasgowVerbal != null && glasgowMotor != null
      ? glasgowEye + glasgowVerbal + glasgowMotor
      : null;

  // Exame fisico — mapeia cada campo compartilhado (EXAM_FIELDS, identico ao da
  // evolucao) ao seu estado local. Permite renderizar a lista por .map, com
  // campos/rotulos/ordem iguais aos da evolucao, sem trocar a persistencia.
  const examFieldState: Record<string, { value: string; set: (v: string) => void }> = {
    general: { value: physGeneral, set: setPhysGeneral },
    cardiovascular: { value: physCv, set: setPhysCv },
    respiratory: { value: physResp, set: setPhysResp },
    abdomen: { value: physAbd, set: setPhysAbd },
    neurological: { value: physNeuro, set: setPhysNeuro },
    extremities: { value: physExt, set: setPhysExt },
    skin: { value: physSkin, set: setPhysSkin },
    other: { value: physOther, set: setPhysOther },
  };

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

  // Rotulo legivel do carater cirurgico para o SOAP.
  const surgCaraterLabel =
    surgCarater === "eletivo" ? "Eletivo"
      : surgCarater === "urgencia" ? "Urgência"
      : surgCarater === "emergencia" ? "Emergência"
      : "";

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
    if (mode === "nao") setAllergies(SEM_RELATO);
    else if (isSemAlergia(allergies)) setAllergies("");
  };

  const resetForm = () => {
    setHda(""); setMuc(""); setAllergies(""); setAllergyMode(null);
    setAntecedentesItems([]);
    setWeight(""); setHeight("");
    setPaSys(""); setPaDia(""); setFc(""); setFr(""); setSpo2(""); setTax(""); setDx("");
    setGlasgowEye(null); setGlasgowVerbal(null); setGlasgowMotor(null);
    setPhysGeneral(""); setPhysCv(""); setPhysResp(""); setPhysAbd(""); setPhysExt(""); setPhysNeuro("");
    setPhysSkin(""); setPhysOther(""); setComplementares("");
    setPlanItems([]); setCidPrimary(""); setCidSecondary(""); setHypothesesItems([]);
    setAdmissionReason(""); setOriginSector(""); setOriginOutros(false);
    setAdmDevices([]); setCulturesHtml(""); setAntibioticosHtml("");
    setUtiJustificativa(""); setUtiJustificativaOutro(""); setUtiVasoativo(null);
    setSofaRespostas({});
    setSurgProcedimento(""); setSurgEspecialidade(""); setSurgCirurgiao("");
    setSurgDataHora(""); setSurgAnestesia(""); setSurgCarater("");
    setNoPrediction(false);
    setPredictionDate(toIsoDate(daysFromToday(5))); setPredictionDays("5");
    // Via volta ao default coerente do setor (editavel pelo medico).
    setSelectedPathway(initialPathway);
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
        // Via escolhida no rascunho (quando ausente/invalida, mantem o default do
        // setor). Preserva a escolha do medico e os campos so visiveis naquela via
        // (UTI/cirurgicos) no round-trip do rascunho.
        // Via: normaliza legado (enfermaria_clinica/cirurgica -> enfermaria) e,
        // se o rascunho era cirurgico, reativa o toggle de paciente cirurgico.
        const hydratedPathway = normalizePathway(d.selectedPathway);
        if (hydratedPathway) setSelectedPathway(hydratedPathway);
        if (typeof d.surgicalPatient === "boolean") setSurgicalPatient(d.surgicalPatient);
        else if (wasLegacySurgical(d.selectedPathway)) setSurgicalPatient(true);
        setHda(d.hda ?? ""); setMuc(d.muc ?? "");
        // Antecedentes: formato novo (array) ou legado (`amp` string multilinha).
        setAntecedentesItems(
          Array.isArray(d.antecedentes)
            ? d.antecedentes
            : (typeof d.amp === "string" && d.amp.trim()
                ? d.amp.split("\n").map((s: string) => s.trim()).filter(Boolean)
                : [])
        );
        setAllergies(d.allergies ?? "");
        // Modo da alergia derivado do valor salvo (compat com rascunho antigo).
        {
          const alg = (d.allergies ?? "").trim();
          setAllergyMode(alg === "" ? null : (isSemAlergia(alg) ? "nao" : "sim"));
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
        setPhysSkin(d.physSkin ?? ""); setPhysOther(d.physOther ?? "");
        setComplementares(d.complementares ?? "");
        // Conduta: formato novo (array planItems) ou legado (`plan` string multilinha).
        setPlanItems(
          Array.isArray(d.planItems)
            ? d.planItems
            : (typeof d.plan === "string" && d.plan.trim()
                ? d.plan.split("\n").map((s: string) => s.trim()).filter(Boolean)
                : [])
        );
        setCidPrimary(d.cidPrimary ?? ""); setCidSecondary(d.cidSecondary ?? "");
        // Hipoteses: formato novo (array) ou legado (string multilinha).
        setHypothesesItems(
          Array.isArray(d.diagnosticHypothesesItems)
            ? d.diagnosticHypothesesItems
            : (typeof d.diagnosticHypotheses === "string" && d.diagnosticHypotheses.trim()
                ? d.diagnosticHypotheses.split("\n").map((s: string) => s.trim()).filter(Boolean)
                : [])
        );
        setNoPrediction(!!d.noPrediction);
        if (d.predictionDate) setPredictionDate(d.predictionDate);
        if (d.predictionDays) setPredictionDays(d.predictionDays);
        setAdmissionReason(d.admissionReason ?? "");
        const loadedOrigin = d.originSector ?? "";
        setOriginSector(loadedOrigin);
        // originOutros: usa o booleano salvo quando presente; senao infere
        // (best-effort). Origem nao vazia, != "Externo" e (quando os setores ja
        // carregaram) ausente da lista -> texto livre "Outros". Tolerante a lista
        // ainda nao carregada (sectors vazio -> mantem false).
        if (typeof d.originOutros === "boolean") {
          setOriginOutros(d.originOutros);
        } else {
          const t = loadedOrigin.trim();
          const loadedSectors = sectorsRef.current;
          const known = t === "Externo" || loadedSectors.some(s => s.nome === t);
          setOriginOutros(!!t && !known && loadedSectors.length > 0);
        }
        // Dispositivos/Culturas/Antibioticos — formato novo (compartilhado com a
        // evolucao). Retrocompat: rascunho antigo tinha `devices` (texto) e
        // `culturesAtb` (texto); o texto de culturas migra para o editor; os
        // dispositivos em texto livre nao sao convertidos para estruturado.
        setAdmDevices(Array.isArray(d.admDevices) ? d.admDevices : []);
        setCulturesHtml(typeof d.culturesHtml === "string" ? d.culturesHtml : (d.culturesAtb ?? ""));
        setAntibioticosHtml(typeof d.antibioticosHtml === "string" ? d.antibioticosHtml : "");
        // UTI estruturado — retrocompat: rascunho antigo só tem admissionReason
        // (texto). admissionReason -> campo "outro" da justificativa.
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
        setSofaRespostas(d.sofaRespostas && typeof d.sofaRespostas === "object" ? d.sofaRespostas : {});
        // Dados cirurgicos — retrocompat: rascunho antigo nao tem a chave -> vazio.
        setSurgProcedimento(d.surgProcedimento ?? "");
        setSurgEspecialidade(d.surgEspecialidade ?? "");
        setSurgCirurgiao(d.surgCirurgiao ?? "");
        setSurgDataHora(d.surgDataHora ?? "");
        setSurgAnestesia(d.surgAnestesia ?? "");
        setSurgCarater(d.surgCarater ?? "");
        if (d.savedAt) setDraftSavedAt(new Date(d.savedAt));
      } else {
        resetForm();
        setDraftSavedAt(null);
      }
    } catch {}
    setDraftHydrated(true);
    return () => { setDraftHydrated(false); setAttempted(false); };
    // Hidrata apenas quando muda o prontuario/rascunho (draftKey); resetForm e
    // estaveis o suficiente — nao e dep intencional (evita re-hidratar a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  /* ───────── SEED a partir da historia (prioridade rascunho > seed > vazio) ─────────
     Roda UMA vez por prontuario, depois que a decisao de rascunho ja aconteceu
     (draftHydrated). Regras:
       - Exige draftKey (prontuario identificado) e patient.id (internacao_id).
       - Se EXISTE rascunho no localStorage, NAO semeia (rascunho vence).
       - Caso contrario, le a historia e preenche SOMENTE campos ainda vazios,
         via setState funcional — nunca sobrescreve o que o usuario ja digitou
         (o seed e assincrono; o medico pode comecar a digitar antes de resolver).
       - O helper e tolerante: qualquer erro -> objeto vazio, nunca lanca. */
  useEffect(() => {
    if (!draftHydrated || !draftKey || !patient.id) return;
    if (seededKeyRef.current === draftKey) return; // ja tentou para este prontuario
    seededKeyRef.current = draftKey;

    // PRIORIDADE rascunho > seed: havendo rascunho, os demais campos NAO sao
    // semeados (rascunho vence). EXCECAO: a HDA e recuperada mesmo havendo
    // rascunho. A chave do rascunho e por pessoa (registryId) e persiste entre
    // sessoes; um rascunho antigo salvo SEM HDA (anterior a historia existir)
    // bloqueava o seed inteiro e deixava a historia admissional vazia para
    // sempre. O guard por campo (prev.trim()) preserva HDA ja digitada.
    let hasDraft = false;
    try { hasDraft = !!localStorage.getItem(draftKey); } catch { /* localStorage indisponivel */ }

    let cancelled = false;
    (async () => {
      const seed = await seedAdmissionFromHistory(patient.id);
      if (cancelled || Object.keys(seed).length === 0) return;
      // Preenche so o que veio e so se o campo ainda estiver vazio.
      // HDA primeiro: e recuperada mesmo havendo rascunho (vide nota acima).
      if (seed.hda) setHda(prev => (prev.trim() ? prev : seed.hda!));
      if (hasDraft) { setSeededFromHistory(true); return; }
      if (seed.planItems?.length) setPlanItems(prev => (prev.length ? prev : seed.planItems!));
      if (seed.hypothesesItems?.length) setHypothesesItems(prev => (prev.length ? prev : seed.hypothesesItems!));
      if (seed.antecedentesItems?.length) setAntecedentesItems(prev => (prev.length ? prev : seed.antecedentesItems!));
      if (seed.cidPrimary) setCidPrimary(prev => (prev.trim() ? prev : seed.cidPrimary!));
      if (seed.cidSecondary) setCidSecondary(prev => (prev.trim() ? prev : seed.cidSecondary!));
      if (seed.paSys) setPaSys(prev => (prev.trim() ? prev : seed.paSys!));
      if (seed.paDia) setPaDia(prev => (prev.trim() ? prev : seed.paDia!));
      if (seed.fc) setFc(prev => (prev.trim() ? prev : seed.fc!));
      if (seed.fr) setFr(prev => (prev.trim() ? prev : seed.fr!));
      if (seed.tax) setTax(prev => (prev.trim() ? prev : seed.tax!));
      if (seed.spo2) setSpo2(prev => (prev.trim() ? prev : seed.spo2!));
      if (seed.glasgowEye != null) setGlasgowEye(prev => (prev != null ? prev : seed.glasgowEye!));
      if (seed.glasgowVerbal != null) setGlasgowVerbal(prev => (prev != null ? prev : seed.glasgowVerbal!));
      if (seed.glasgowMotor != null) setGlasgowMotor(prev => (prev != null ? prev : seed.glasgowMotor!));
      // Dispositivos/Culturas/Antibioticos — chaves compartilhadas com a
      // evolucao (soap.devices / culturesHtml / antibioticos). So preenche o
      // que ainda estiver vazio, para nao sobrescrever o que o medico digitou.
      if (seed.devicesStructured?.length) setAdmDevices(prev => (prev.length ? prev : seed.devicesStructured!));
      if (seed.culturesHtml) setCulturesHtml(prev => (prev.trim() ? prev : seed.culturesHtml!));
      if (seed.antibioticos) setAntibioticosHtml(prev => (prev.trim() ? prev : seed.antibioticos!));
      setSeededFromHistory(true);
    })();

    return () => { cancelled = true; };
  }, [draftHydrated, draftKey, patient.id]);

  // Salva (debounced) a cada mudança
  useEffect(() => {
    if (!draftHydrated || !draftKey) return;
    const t = setTimeout(() => {
      try {
        const payload = {
          selectedPathway, surgicalPatient,
          hda, amp, antecedentes: antecedentesItems, muc, allergies,
          weight, height, paSys, paDia, pa, fc, fr, spo2, tax, dx,
          glasgowEye, glasgowVerbal, glasgowMotor,
          physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
          physSkin, physOther, complementares,
          plan, planItems, cidPrimary, cidSecondary,
          diagnosticHypotheses, diagnosticHypothesesItems: hypothesesItems,
          noPrediction, predictionDate, predictionDays,
          admissionReason, originSector, originOutros,
          admDevices, culturesHtml, antibioticosHtml,
          utiJustificativa, utiJustificativaOutro, utiVasoativo, sofaRespostas,
          surgProcedimento, surgEspecialidade, surgCirurgiao, surgDataHora, surgAnestesia, surgCarater,
          savedAt: new Date().toISOString(),
        };
        // só persiste se houver algum conteúdo
        const hasContent = Object.values(payload).some(v => typeof v === "string" && v.trim().length > 0)
          || admDevices.length > 0;
        if (hasContent) {
          localStorage.setItem(draftKey, JSON.stringify(payload));
          setDraftSavedAt(new Date());
        }
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [
    draftHydrated, draftKey, selectedPathway, surgicalPatient,
    hda, amp, antecedentesItems, muc, allergies, weight, height, paSys, paDia, pa, fc, fr, spo2, tax, dx,
    glasgowEye, glasgowVerbal, glasgowMotor,
    physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
    physSkin, physOther, complementares,
    plan, planItems, cidPrimary, cidSecondary, diagnosticHypotheses, hypothesesItems,
    noPrediction, predictionDate, predictionDays,
    admissionReason, originSector, originOutros, admDevices, culturesHtml, antibioticosHtml,
    utiJustificativa, utiJustificativaOutro, utiVasoativo, sofaRespostas,
    surgProcedimento, surgEspecialidade, surgCirurgiao, surgDataHora, surgAnestesia, surgCarater,
  ]);

  // Qualquer edição depois de salvo invalida o "isSaved" (o que está impresso
  // deixaria de refletir o banco). Só o conteúdo clínico conta.
  useEffect(() => {
    if (isSaved) setIsSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPathway, surgicalPatient,
    hda, amp, muc, allergies, weight, height, paSys, paDia, pa, fc, fr, spo2, tax, dx,
    glasgowEye, glasgowVerbal, glasgowMotor,
    physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
    physSkin, physOther, complementares,
    plan, cidPrimary, cidSecondary, diagnosticHypotheses,
    noPrediction, predictionDate, predictionDays,
    admissionReason, originSector, admDevices, culturesHtml, antibioticosHtml,
    utiJustificativa, utiJustificativaOutro, utiVasoativo, sofaRespostas,
    surgProcedimento, surgEspecialidade, surgCirurgiao, surgDataHora, surgAnestesia, surgCarater,
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
    physGeneral, physCv, physResp, physAbd, physExt, physNeuro, physSkin, physOther, complementares,
    plan, cidPrimary, cidSecondary, diagnosticHypotheses,
    admissionReason, originSector, culturesHtml, antibioticosHtml,
    utiJustificativaOutro,
    surgProcedimento, surgEspecialidade, surgCirurgiao, surgDataHora, surgAnestesia, surgCarater,
  ].some(v => typeof v === "string" && v.trim().length > 0)
    || admDevices.length > 0
    || glasgowTotal != null
    || !!utiJustificativa || utiVasoativo != null
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
    plan: planItems.length === 0,
    cidPrimary: !cidPrimary.trim(),
    prediction: !noPrediction && !predictionDate,
  };
  // Itens obrigatórios para VALIDAR a admissão (CID/previsão/SAPS são recomendados, não bloqueantes)
  // SAPS 3 segue como tarefa pendente paralela (cronômetro de 24 h), mas não bloqueia validar/imprimir admissão.
  //
  // Modo EMERGENCIA (Sala Vermelha): obrigatorios reduzidos ao minimo do paciente
  // em estabilizacao — HDA + CID primario + Conduta. "Estado geral" do exame fisico
  // OBRIGATORIOS UNIFICADOS em TODAS as vias (emergencia, enfermaria, UTI):
  // HDA + CID primario + Conduta/Plano. O exame fisico (Estado geral) deixa de ser
  // obrigatorio — mesma estrutura de obrigatorios do padrao da emergencia, o que
  // permite importar dados entre admissoes com os mesmos campos exigidos.
  const missingList = ([
    missing.hda && "HDA",
    missing.cidPrimary && "CID primário",
    missing.plan && "Conduta inicial",
  ]).filter(Boolean) as string[];

  const validate = (): string | null => {
    if (missing.hda) return "História da Doença Atual (HDA) é obrigatória";
    if (missing.cidPrimary) return "CID primário é obrigatório";
    if (missing.plan) return "Conduta inicial é obrigatória";
    return null;
  };

  const canValidate = !missing.hda && !missing.cidPrimary && !missing.plan;

  const handleSaveDraft = () => {
    try {
      if (!draftKey) {
        toast.error("Aguarde a identificação do prontuário antes de salvar o rascunho");
        return;
      }
      const payload = {
        selectedPathway, surgicalPatient,
        hda, amp, antecedentes: amp ? amp.split("\n") : [], muc, allergies,
        weight, height, paSys, paDia, pa, fc, fr, spo2, tax, dx,
        glasgowEye, glasgowVerbal, glasgowMotor,
        physGeneral, physCv, physResp, physAbd, physExt, physNeuro,
        physSkin, physOther, complementares,
        plan, cidPrimary, cidSecondary, diagnosticHypotheses,
        noPrediction, predictionDate, predictionDays,
        admissionReason, originSector, originOutros, admDevices, culturesHtml, antibioticosHtml,
        utiJustificativa, utiJustificativaOutro, utiVasoativo, sofaRespostas,
        surgProcedimento, surgEspecialidade, surgCirurgiao, surgDataHora, surgAnestesia, surgCarater,
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
      // Mapeia os widgets novos para os campos que o template do impresso ja
      // consome (admissionReason/devices/culturesAtb), sem alterar o template.
      // Dispositivos: rotulos estruturados em texto. Culturas/ATB: texto limpo
      // do editor (culturas + antibioticos em curso). Vasoativo e SOFA ficam no
      // SOAP/JSON (sem linha propria no impresso por ora).
      uti: isUti ? {
        admissionReason: utiJustificativa ? utiJustificativaLabel : "",
        originSector,
        devices: admDevices.map(d => formatDeviceLabel(d)).filter(Boolean).join("; "),
        culturesAtb: [
          richHtmlToPlainText(culturesHtml).trim(),
          richHtmlToPlainText(antibioticosHtml).trim()
            ? `ATB em curso: ${richHtmlToPlainText(antibioticosHtml).trim()}`
            : "",
        ].filter(Boolean).join("\n"),
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
          // Exames complementares -> internacoes.exames_relevantes (coluna
          // existente, lida como relevantExams pelo mapa/painel). Texto limpo
          // do editor, line-based como o restante de exames_relevantes.
          exames_relevantes: richHtmlToPlainText(complementares).trim() || null,
          // Previsao de alta -> coluna propria internacoes.previsao_alta (lida pelo
          // mapa como utiDischargePrediction e exibida no card). Antes so ia pro
          // texto do SOAP, entao o chip "Previsao de Alta" do card ficava "—".
          // Guarda a data ISO (predictionDate); "sem previsao" grava null.
          previsao_alta: noPrediction ? null : (predictionDate || null),
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
      // Resumos em texto dos campos compartilhados (dispositivos/culturas/ATB)
      // para o texto corrido do SOAP. A fonte estruturada vai no soap.devices.
      const devicesText = admDevices.map(d => formatDeviceLabel(d)).filter(Boolean).join("; ");
      const culturesText = richHtmlToPlainText(culturesHtml).trim();
      const antibioticosText = richHtmlToPlainText(antibioticosHtml).trim();
      const soapAdmission = {
        subjective: `HDA:\n${hda}\n\nAMP: ${amp || "—"}\nMUC: ${muc || "—"}\nAlergias: ${allergies || SEM_RELATO}`,
        objective: `Antropometria: peso ${weight || "—"} kg, altura ${height || "—"} m${imcLine}\n` +
                   `SSVV admissionais: PA ${pa || "—"} | FC ${fc || "—"} | FR ${fr || "—"} | SpO₂ ${spo2 || "—"} | Tax ${tax || "—"} | Dx ${dx || "—"}${glasgowLine}`,
        assessment: `CID primário: ${cidPrimary}${cidSecondary ? `\nCID secundário: ${cidSecondary}` : ""}` +
                    (diagnosticHypotheses.trim() ? `\n\nHipóteses diagnósticas:\n${diagnosticHypotheses.trim()}` : "") +
                    (isUti ? `\n\nJustificativa de admissão UTI: ${utiJustificativaLabel}` +
                      `\nDroga vasoativa: ${simNao(utiVasoativo)}` +
                      `\nDispositivos invasivos: ${devicesText || "—"}` +
                      `\nOrigem: ${originSector || "—"}\nCulturas: ${culturesText || "—"}` +
                      `\nAntibióticos em curso: ${antibioticosText || "—"}` +
                      `\nSOFA: ${sofaTotal} (${sofaPreenchidos}/${SOFA_COMPONENTES.length} componentes)` : "") +
                    (isCirurgica
                      ? `\n\nDados cirúrgicos: procedimento ${surgProcedimento.trim() || "—"}` +
                        ` | especialidade ${surgEspecialidade.trim() || "—"}` +
                        ` | cirurgião ${surgCirurgiao.trim() || "—"}` +
                        ` | data/hora ${surgDataHora.trim() || "—"}` +
                        ` | anestesia ${surgAnestesia.trim() || "—"}` +
                        ` | caráter ${surgCaraterLabel || "—"}`
                      : ""),
        plan: `${plan}\n\nPrevisão de alta: ${dischargePredictionLabel}`,
      };

      const physicalExam = {
        general: physGeneral, cardiovascular: physCv, respiratory: physResp,
        abdomen: physAbd, neurological: physNeuro, extremities: physExt,
        skin: physSkin, other: physOther,
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
          // Dispositivos / Culturas / Antibioticos — MESMAS chaves da evolucao
          // (soap.devices / soap.culturesHtml / soap.antibioticos). Ancoradas em
          // internacao_id, sincronizam admissao<->evolucao (lidas por
          // useLatestEvolution, timeline e impressos).
          devices: admDevices,
          culturesHtml,
          antibioticos: antibioticosHtml,
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
          // Via de admissao escolhida no toggle — chave ADITIVA, sempre presente.
          // Passa a refletir a VIA (emergencia/enfermaria_clinica/
          // enfermaria_cirurgica/uti), nao mais o modo derivado do setor.
          __admission_mode: selectedPathway,
          // UTI estruturado — chaves ADITIVAS (não substituem nada do schema).
          ...(isUti ? {
            __uti_justificativa: { codigo: utiJustificativa || null, outro: utiJustificativaOutro.trim() || admissionReason.trim() || null },
            __uti_vasoativo: utiVasoativo,
            // __uti_dispositivos DESCONTINUADO em favor de soap.devices (fonte
            // unica estruturada, compartilhada com a evolucao).
            __uti_sofa: { respostas: sofaRespostas, total: sofaTotal },
          } : {}),
          // Dados cirurgicos — chave ADITIVA, so em setores cirurgicos.
          ...(isCirurgica ? {
            __surgical: {
              procedimento: surgProcedimento,
              especialidade: surgEspecialidade,
              cirurgiao: surgCirurgiao,
              dataHora: surgDataHora,
              anestesia: surgAnestesia,
              carater: surgCarater,
            },
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
        toast.success(`ADMISSÃO REGISTRADA (${admissionDayLabel}) — documento enviado para impressão`);
      } catch (printErr) {
        console.error("Falha ao imprimir após salvar:", printErr);
        toast.success(`ADMISSÃO REGISTRADA (${admissionDayLabel})`, {
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
                {PATHWAY_BADGE[selectedPathway]}
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
          {seededFromHistory && (
            <span className="inline-flex items-center gap-2 rounded-full bg-released-soft border border-released/30 px-3 py-1 text-xs text-released-on-soft">
              <ClipboardCheck className="h-3 w-3" />
              Pré-preenchido a partir do atendimento anterior — revise antes de validar
            </span>
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
        {/* ───── Toggle "Tipo de admissao" — PERMISSIONADO POR SETOR (cadeados).
            So a via do setor atual e selecionavel; as demais aparecem com cadeado
            (nao editaveis). Protege o fluxo de admissao hospitalar. ───── */}
        <div className="mb-4">
          <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tipo de admissão
          </Label>
          <ToggleGroup
            type="single"
            value={selectedPathway}
            onValueChange={v => { if (isAdmissionPathway(v) && v === allowedPathway) setSelectedPathway(v); }}
            className="flex w-full flex-wrap justify-start gap-1 rounded-lg border border-border bg-muted/40 p-1"
          >
            {orderedPathwayOptions.map(opt => {
              const locked = opt.value !== allowedPathway;
              return (
                <ToggleGroupItem
                  key={opt.value}
                  value={opt.value}
                  disabled={locked}
                  aria-label={opt.label}
                  title={locked
                    ? `Admissão disponível apenas no setor correspondente (via liberada: ${PATHWAY_BADGE[allowedPathway]})`
                    : opt.label}
                  className={cn(
                    "flex-1 min-w-[8.5rem] inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    locked
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : "text-muted-foreground hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
                  )}
                >
                  {locked && <Lock className="h-3 w-3" />}
                  {opt.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Admissão liberada apenas na via do setor atual. Admissões validadas de outros setores ficam disponíveis para consulta.
          </p>
        </div>

        {isEmergencia ? (
        /* ═══════════ MODO EMERGENCIA (Sala Vermelha) — layout enxuto ═══════════
           Nada e removido: o essencial fica aberto no topo; o resto vai para
           secoes do acordeao recolhidas por padrao (mesmo openSections). */
        <div className="w-full min-w-0 space-y-4">
          {/* Faixa de contexto do modo */}
          <div className="rounded-lg border border-critical-border bg-critical-soft/40 px-4 py-2.5 flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-critical-on-soft" />
            <span className="text-xs font-semibold uppercase tracking-wide text-critical-on-soft">Modo emergência — Sala Vermelha</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {emergMode === "express" ? "Express — admissão objetiva" : "Padrão — estabilização completa"}
            </span>
          </div>

          {/* Sub-toggle Padrao / Express — sob o guarda-chuva da via de emergencia */}
          <ToggleGroup
            type="single"
            value={emergMode}
            onValueChange={v => { if (v === "padrao" || v === "express") setEmergMode(v); }}
            className="grid grid-cols-2 gap-2"
          >
            <ToggleGroupItem value="padrao" className="border border-border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Padrão
            </ToggleGroupItem>
            <ToggleGroupItem value="express" className="border border-border data-[state=on]:bg-critical data-[state=on]:text-white">
              Express
            </ToggleGroupItem>
          </ToggleGroup>

          {emergMode === "express" ? (
          /* ═══════════ EXPRESS — objetivo (CID, descricao, plano, previsao) ═══════════ */
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <ReqLabel missing={attempted && missing.cidPrimary}>CID primário</ReqLabel>
                <CidSearchInput value={cidPrimary} onChange={setCidPrimary}
                  placeholder="Ex.: J18, pneumonia..." className={cn("mt-1", reqRing(attempted && missing.cidPrimary))} />
              </div>
              <div>
                <Label className="text-xs">CID secundário <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <CidSearchInput value={cidSecondary} onChange={setCidSecondary} placeholder="Opcional" className="mt-1" />
              </div>
            </div>
            <div>
              <ReqLabel missing={attempted && missing.hda}>Descrição clínica</ReqLabel>
              <Textarea value={hda} onChange={e => setHda(e.target.value)} rows={3}
                placeholder="Descrição objetiva do quadro na admissão..." className={cn("mt-1", reqRing(attempted && missing.hda))} />
            </div>
            <div>
              <ReqLabel missing={attempted && missing.plan}>Plano terapêutico</ReqLabel>
              <div className="mt-1">
                <ItemListField
                  items={planItems}
                  onChange={setPlanItems}
                  placeholder="Ex.: Monitorização contínua"
                  inputAriaLabel="Adicionar item de conduta"
                  inputClassName={reqRing(attempted && missing.plan)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Previsão de alta</Label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end mt-1">
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
              <p className="text-xs text-muted-foreground mt-1">Resultado: <strong className="text-foreground">{dischargePredictionLabel}</strong></p>
            </div>
          </div>
          ) : (
          /* ═══════════ PADRAO — estabilizacao completa (ordem definida) ═══════════ */
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="rounded-lg border border-border bg-card divide-y divide-border"
          >
          {/* 1. Diagnostico CID — primario (obrigatorio) + secundario ao lado (opcional) */}
          <AccordionSectionItem id="em-cid" icon={FileText} iconColor="text-foreground" label="Diagnóstico (CID-10)" hint="Primário obrigatório; secundário opcional" required>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <ReqLabel missing={attempted && missing.cidPrimary}>CID primário</ReqLabel>
                <CidSearchInput value={cidPrimary} onChange={setCidPrimary}
                  placeholder="Ex.: J18, pneumonia..." className={cn("mt-1", reqRing(attempted && missing.cidPrimary))} />
              </div>
              <div>
                <Label className="text-xs">CID secundário <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <CidSearchInput value={cidSecondary} onChange={setCidSecondary} placeholder="Opcional" className="mt-1" />
              </div>
            </div>
          </AccordionSectionItem>

          {/* 2. Hipoteses diagnosticas */}
          <AccordionSectionItem id="em-hipoteses" icon={Stethoscope} iconColor="text-muted-foreground" label="Hipóteses diagnósticas">
            <ItemListField
              items={hypothesesItems}
              onChange={setHypothesesItems}
              placeholder="Ex.: Sepse de foco pulmonar"
              inputAriaLabel="Adicionar hipótese diagnóstica"
            />
            <p className="text-xs text-muted-foreground mt-1">Cada item vira uma hipótese no card do paciente.</p>
          </AccordionSectionItem>

          {/* 3. HDA */}
          <AccordionSectionItem id="em-hda" icon={FileText} iconColor="text-muted-foreground" label="História admissional (HDA)" required>
            <ReqLabel missing={attempted && missing.hda}>HDA — História da Doença Atual</ReqLabel>
            <Textarea value={hda} onChange={e => setHda(e.target.value)} rows={3}
              placeholder="Paciente admitido com..." className={cn("mt-1", reqRing(attempted && missing.hda))} />
          </AccordionSectionItem>

          {/* 4. Antecedentes morbidos pessoais */}
          <AccordionSectionItem id="em-antecedentes" icon={ClipboardList} iconColor="text-muted-foreground" label="Antecedentes mórbidos pessoais">
            <ItemListField
              items={antecedentesItems}
              onChange={setAntecedentesItems}
              placeholder="Ex.: HAS, DM2, tabagismo, ex-etilista..."
              inputAriaLabel="Adicionar antecedente mórbido"
            />
          </AccordionSectionItem>

          {/* 5. MUC — medicacoes de uso continuo */}
          <AccordionSectionItem id="em-muc" icon={Pill} iconColor="text-muted-foreground" label="MUC — Medicações de uso contínuo">
            <Textarea value={muc} onChange={e => setMuc(e.target.value)} rows={3} className="mt-1" placeholder="Uma medicação por linha..." />
          </AccordionSectionItem>

          {/* 6. Alergias */}
          <AccordionSectionItem id="em-alergias" icon={AlertTriangle} iconColor="text-warning-on-soft" label="Alergias medicamentosas">
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup type="single" value={allergyMode ?? ""} onValueChange={v => { if (v === "nao" || v === "sim") handleAllergyMode(v); }}>
                <ToggleGroupItem value="nao" className="data-[state=on]:bg-released data-[state=on]:text-white">Sem relato</ToggleGroupItem>
                <ToggleGroupItem value="sim" className="data-[state=on]:bg-critical data-[state=on]:text-white">Sim</ToggleGroupItem>
              </ToggleGroup>
              {allergyMode === "sim" && (
                <Input value={isSemAlergia(allergies) ? "" : allergies} onChange={e => setAllergies(e.target.value)} placeholder="Especificar alergia(s)..." className="flex-1 min-w-[12rem]" />
              )}
            </div>
          </AccordionSectionItem>

          {/* 7. Sinais vitais */}
          <AccordionSectionItem id="em-vitais" icon={HeartPulse} iconColor="text-released-on-soft" label="Sinais vitais">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><Label className="text-xs">PA sistólica</Label><Input value={paSys} onChange={e => setPaSys(e.target.value)} placeholder="120" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">PA diastólica</Label><Input value={paDia} onChange={e => setPaDia(e.target.value)} placeholder="80" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">FC (bpm)</Label><Input value={fc} onChange={e => setFc(e.target.value)} placeholder="bpm" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">FR (irpm)</Label><Input value={fr} onChange={e => setFr(e.target.value)} placeholder="irpm" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">SpO₂ (%)</Label><Input value={spo2} onChange={e => setSpo2(e.target.value)} placeholder="%" className="mt-1" inputMode="numeric" /></div>
              <div><Label className="text-xs">Temperatura (°C)</Label><Input value={tax} onChange={e => setTax(e.target.value)} placeholder="°C" className="mt-1" inputMode="decimal" /></div>
            </div>
          </AccordionSectionItem>

          {/* 8. Antropometria e dextro */}
          <AccordionSectionItem id="em-antropometria" icon={Activity} iconColor="text-muted-foreground" label="Antropometria e dextro">
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
          </AccordionSectionItem>

          {/* 9. Exame fisico — mesmos campos da evolucao (EXAM_FIELDS, inclui pele/outros) */}
          <AccordionSectionItem id="em-exame" icon={Stethoscope} iconColor="text-muted-foreground" label="Exame físico" hint="Mesmos campos da evolução">
            <div>
              <Label className="text-xs">Estado geral</Label>
              <Textarea value={examFieldState.general.value} onChange={e => examFieldState.general.set(e.target.value)} rows={1} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EXAM_FIELDS.filter(f => f.key !== "general").map(f => (
                <div key={f.key} className={f.key === "neurological" ? "sm:col-span-2" : undefined}>
                  <Label className="text-xs">{f.label}</Label>
                  <Textarea
                    value={examFieldState[f.key].value}
                    onChange={e => examFieldState[f.key].set(e.target.value)}
                    rows={1}
                    className="mt-1"
                    placeholder={f.key === "neurological"
                      ? "Glasgow, pupilas, força, sensibilidade, reflexos, sinais focais..."
                      : undefined}
                  />
                </div>
              ))}
            </div>
          </AccordionSectionItem>

          {/* 10. Glasgow + escores ao vivo */}
          <AccordionSectionItem id="em-glasgow" icon={Brain} iconColor="text-muted-foreground" label="Glasgow + escores ao vivo"
            hint={glasgowTotal != null ? `Glasgow ${glasgowTotal} / 15` : "Selecione O / V / M"}>
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
          </AccordionSectionItem>

          {/* 11. Exames complementares — mesmo widget da evolucao (RichTextEditor) */}
          <AccordionSectionItem id="em-exames-comp" icon={FileText} iconColor="text-muted-foreground" label="Exames Complementares" hint="Laboratoriais e de imagem — opcional">
            <RichTextEditor
              value={complementares}
              onChange={setComplementares}
              placeholder="Cole resultados laboratoriais ou de imagem..."
              minHeight={120}
            />
          </AccordionSectionItem>

          {/* 12. Plano terapeutico */}
          <AccordionSectionItem id="em-conduta" icon={Pill} iconColor="text-muted-foreground" label="Plano terapêutico" required>
            <ReqLabel missing={attempted && missing.plan}>Conduta inicial</ReqLabel>
            <div className="mt-1">
              <ItemListField
                items={planItems}
                onChange={setPlanItems}
                placeholder="Ex.: Monitorização contínua"
                inputAriaLabel="Adicionar item de conduta"
                inputClassName={reqRing(attempted && missing.plan)}
              />
            </div>
          </AccordionSectionItem>

          {/* 13. Previsao de alta */}
          <AccordionSectionItem id="em-previsao" icon={CalendarDays} iconColor="text-muted-foreground" label="Previsão de alta">
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
          </AccordionSectionItem>
          </Accordion>
          )}
        </div>
        ) : (
        <div className="w-full min-w-0 space-y-4">
          {/* Sub-toggle SAPS | Cuidados Intensivos — so na via CI. SAPS a esquerda:
              pendente abre no preenchimento; validada pula para Cuidados Intensivos. */}
          {isUti && (
            <ToggleGroup
              type="single"
              value={utiTab}
              onValueChange={v => { if (v === "saps" || v === "intensivos") setUtiTab(v); }}
              className="grid grid-cols-2 gap-2"
            >
              <ToggleGroupItem value="saps" className="border border-border gap-1.5 data-[state=on]:bg-warning data-[state=on]:text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                SAPS 3
                {sapsRow?.status !== "validada" && <span className="text-[10px] uppercase tracking-wide opacity-80">pendente</span>}
              </ToggleGroupItem>
              <ToggleGroupItem value="intensivos" className="border border-border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Cuidados Intensivos
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {isUti && utiTab === "saps" ? (
          /* ═══════════ Aba SAPS 3 — relatorio (boxes + detalhamento) ou pendencia ═══════════ */
          <div className="rounded-lg border border-border bg-card p-4">
            {sapsRow?.status === "validada" ? (
              // Ficha validada: RESULTADO aqui mesmo (resumo dos boxes + expansao).
              <SapsView row={sapsRow} />
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-foreground leading-relaxed">
                  A admissão UTI/UCI gera automaticamente uma <strong>Ficha SAPS 3 pendente</strong>, com prazo de{" "}
                  <strong className="text-warning-on-soft">24 horas</strong> a partir da pré-admissão (janela operacional / AMIB).
                  A admissão pode ser <strong>validada e impressa normalmente</strong>; a SAPS 3 segue como tarefa paralela.
                </p>
                {onOpenSaps && (
                  <Button type="button" variant="outline" size="sm" onClick={onOpenSaps} className="gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {sapsRow ? "Abrir / completar ficha SAPS 3" : "Preencher ficha SAPS 3"}
                  </Button>
                )}
                <label className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-soft/70 p-3 cursor-pointer select-none">
                  <Checkbox checked={sapsAck} onCheckedChange={v => setSapsAck(v === true)} className="mt-1" />
                  <span className="text-xs text-foreground">
                    <strong className="uppercase tracking-wide text-warning-on-soft">Ciência (opcional)</strong> — declaro estar
                    ciente de que a ficha SAPS 3 está pendente e deve ser finalizada em até 24 h.
                  </span>
                </label>
              </div>
            )}
          </div>
          ) : (
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="rounded-lg border border-border bg-card divide-y divide-border"
          >
            {/* ORDEM UNIFICADA (igual ao padrao da emergencia), para importacao de
                dados entre admissoes aproveitar os campos na mesma sequencia. */}
            <AccordionSectionItem id="nm-diagnostico" icon={FileText} iconColor="text-foreground" label="Diagnóstico (CID-10)" hint="Busca por código ou descrição" required>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <ReqLabel missing={attempted && missing.cidPrimary}>CID primário</ReqLabel>
                  <CidSearchInput value={cidPrimary} onChange={setCidPrimary}
                    placeholder="Ex.: J18, pneumonia..." className={cn("mt-1", reqRing(attempted && missing.cidPrimary))} />
                </div>
                <div>
                  <Label className="text-xs">CID secundário <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <CidSearchInput value={cidSecondary} onChange={setCidSecondary}
                    placeholder="Opcional" className="mt-1" />
                </div>
              </div>
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-hipoteses" icon={Stethoscope} iconColor="text-foreground" label="Hipóteses Diagnósticas" hint="Um item por hipótese — sincroniza automaticamente com o painel clínico">
              <ItemListField
                items={hypothesesItems}
                onChange={setHypothesesItems}
                placeholder="Ex.: Sepse de foco pulmonar"
                inputAriaLabel="Adicionar hipótese diagnóstica"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cada item vira uma hipótese no card do paciente. Esse campo passa a ser <strong>somente leitura no painel</strong> e só é atualizado por nova evolução clínica.
              </p>
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-hda" icon={FileText} iconColor="text-muted-foreground" label="História admissional (HDA)" required>
              <ReqLabel missing={attempted && missing.hda}>HDA — História da Doença Atual</ReqLabel>
              <Textarea value={hda} onChange={e => setHda(e.target.value)} rows={4}
                placeholder="Paciente admitido com..." className={cn("mt-1", reqRing(attempted && missing.hda))} />
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-antecedentes" icon={ClipboardList} iconColor="text-foreground" label="Antecedentes mórbidos pessoais" hint="Acrescente um a um">
              <ItemListField
                items={antecedentesItems}
                onChange={setAntecedentesItems}
                placeholder="Ex.: HAS, DM2, tabagismo, ex-etilista..."
                inputAriaLabel="Adicionar antecedente mórbido"
              />
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-muc" icon={Pill} iconColor="text-muted-foreground" label="MUC — Medicações de Uso Contínuo">
              <Textarea value={muc} onChange={e => setMuc(e.target.value)} rows={3} className="mt-1"
                placeholder="Uma medicação por linha..." />
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-alergias" icon={AlertTriangle} iconColor="text-warning-on-soft" label="Alergias medicamentosas">
              <div className="flex flex-wrap items-center gap-3">
                <ToggleGroup
                  type="single"
                  value={allergyMode ?? ""}
                  onValueChange={v => { if (v === "nao" || v === "sim") handleAllergyMode(v); }}
                >
                  <ToggleGroupItem value="nao" className="data-[state=on]:bg-released data-[state=on]:text-white">Sem relato</ToggleGroupItem>
                  <ToggleGroupItem value="sim" className="data-[state=on]:bg-critical data-[state=on]:text-white">Sim</ToggleGroupItem>
                </ToggleGroup>
                {allergyMode === "sim" && (
                  <Input
                    value={isSemAlergia(allergies) ? "" : allergies}
                    onChange={e => setAllergies(e.target.value)}
                    placeholder="Especificar alergia(s)..."
                    className="flex-1 min-w-[12rem]"
                  />
                )}
              </div>
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-vitais" icon={HeartPulse} iconColor="text-released-on-soft" label="Sinais vitais admissionais">
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
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-antropometria" icon={Activity} iconColor="text-foreground" label="Antropometria" hint="IMC calculado automaticamente">
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
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-exame" icon={Stethoscope} iconColor="text-muted-foreground" label="Exame físico" hint="Mesmos campos da evolução">
              <div>
                <Label className="text-xs">Estado geral</Label>
                <Textarea
                  value={examFieldState.general.value}
                  onChange={e => examFieldState.general.set(e.target.value)}
                  rows={1}
                  className="mt-1"
                />
              </div>
              {/* Demais aparelhos — campos/rotulos/ordem IDENTICOS a evolucao. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXAM_FIELDS.filter(f => f.key !== "general").map(f => (
                  <div key={f.key} className={f.key === "neurological" ? "sm:col-span-2" : undefined}>
                    <Label className="text-xs">{f.label}</Label>
                    <Textarea
                      value={examFieldState[f.key].value}
                      onChange={e => examFieldState[f.key].set(e.target.value)}
                      rows={1}
                      className="mt-1"
                      placeholder={f.key === "neurological"
                        ? "Glasgow, pupilas, força, sensibilidade, reflexos, sinais focais..."
                        : undefined}
                    />
                  </div>
                ))}
              </div>
            </AccordionSectionItem>

            <AccordionSectionItem
              id="nm-glasgow"
              icon={Brain}
              iconColor="text-muted-foreground"
              label="Escala de Coma de Glasgow"
              hint={glasgowTotal != null ? `Total ${glasgowTotal} / 15` : "Selecione O / V / M"}
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
            </AccordionSectionItem>

            {/* Painel de escores ao vivo — qSOFA + NEWS2 */}
            <AccordionSectionItem id="nm-escores" icon={Gauge} iconColor="text-muted-foreground" label="Escores ao vivo" hint="Recalculados a cada mudança">
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
            </AccordionSectionItem>

            {/* Exames complementares — mesmo widget da evolucao (RichTextEditor).
                Persistido em internacoes.exames_relevantes no handleSubmit. */}
            <AccordionSectionItem id="nm-exames-comp" icon={FileText} iconColor="text-muted-foreground" label="Exames Complementares" hint="Laboratoriais e de imagem — opcional">
              <RichTextEditor
                value={complementares}
                onChange={setComplementares}
                placeholder="Cole resultados laboratoriais ou de imagem..."
                minHeight={120}
              />
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-plano" icon={Pill} iconColor="text-muted-foreground" label="Plano terapêutico" required>
              <ReqLabel missing={attempted && missing.plan}>Conduta inicial</ReqLabel>
              <div className="mt-1">
                <ItemListField
                  items={planItems}
                  onChange={setPlanItems}
                  placeholder="Ex.: Monitorização contínua"
                  inputAriaLabel="Adicionar item de conduta"
                  inputClassName={reqRing(attempted && missing.plan)}
                />
              </div>
            </AccordionSectionItem>

            <AccordionSectionItem id="nm-previsao" icon={CalendarDays} iconColor="text-warning-on-soft" label="Previsão de alta" hint="Dias e data sincronizados">
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
            </AccordionSectionItem>

            {/* ───── UTI ───── */}
            {isUti && (
            <>
              <AccordionSectionItem id="nm-uti-justif" icon={AlertTriangle} iconColor="text-warning-on-soft" label="Justificativa de admissão na UTI">
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
              </AccordionSectionItem>

              <AccordionSectionItem id="nm-uti-vaso" icon={HeartPulse} iconColor="text-muted-foreground" label="Droga vasoativa">
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
              </AccordionSectionItem>

              {/* Dispositivos, Culturas e Antibioticos — componente compartilhado
                  com a evolucao. Persiste nas MESMAS chaves do soap (devices /
                  culturesHtml / antibioticos), ancorado em internacao_id: o que
                  for preenchido aqui aparece na evolucao e vice-versa. */}
              <AccordionSectionItem id="nm-uti-disp" icon={Activity} iconColor="text-muted-foreground" label="Dispositivos, Culturas e Antibióticos">
                <DevicesCulturesSection
                  devices={admDevices}
                  onDevicesChange={setAdmDevices}
                  culturesHtml={culturesHtml}
                  onCulturesChange={setCulturesHtml}
                  antibioticosHtml={antibioticosHtml}
                  onAntibioticosChange={setAntibioticosHtml}
                  patientId={patient.id}
                  patientName={patient.name}
                />
              </AccordionSectionItem>

              <AccordionSectionItem
                id="nm-uti-sofa"
                icon={Gauge}
                iconColor="text-muted-foreground"
                label="SOFA — admissão"
                hint={`Total ${sofaTotal} / 24 • ${sofaPreenchidos}/${SOFA_COMPONENTES.length} componentes`}
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
              </AccordionSectionItem>

              <AccordionSectionItem id="nm-uti-comp" icon={ClipboardList} iconColor="text-warning-on-soft" label="Dados complementares UTI">
                <div>
                  <Label className="text-xs">Origem (setor anterior)</Label>
                  <Select
                    value={
                      originOutros
                        ? "Outros"
                        : (originSector === "Externo" || sectors.some(s => s.nome === originSector))
                          ? originSector
                          : ""
                    }
                    onValueChange={v => {
                      if (v === "Outros") {
                        setOriginOutros(true);
                        setOriginSector("");
                      } else {
                        setOriginOutros(false);
                        setOriginSector(v);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o setor de origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map(s => (
                        <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                      ))}
                      <SelectItem value="Externo">Externo</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  {originOutros && (
                    <Input
                      value={originSector}
                      onChange={e => setOriginSector(e.target.value)}
                      placeholder="Especifique a origem"
                      className="mt-2"
                    />
                  )}
                </div>
              </AccordionSectionItem>
            </>
            )}
          </Accordion>
          )}
        </div>
        )}

        {/* Toggle "paciente cirurgico" — via unica Enfermaria Clinico-Cirurgica.
            Marca-se quando houver recorte cirurgico, revelando os Dados cirurgicos. */}
        {isEnfermaria && (
          <label className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 cursor-pointer select-none">
            <Checkbox checked={surgicalPatient} onCheckedChange={v => setSurgicalPatient(v === true)} />
            <span className="text-sm text-foreground">
              <strong>Paciente cirúrgico</strong>
              <span className="text-xs text-muted-foreground"> — habilita os Dados cirúrgicos (procedimento, cirurgião, anestesia)</span>
            </span>
          </label>
        )}

        {/* ───── Dados cirúrgicos — secao opcional da via enfermaria (toggle acima) ───── */}
        {isCirurgica && (
          <div className="w-full min-w-0 mt-6">
            <Accordion
              type="multiple"
              defaultValue={["cirurgicos"]}
              className="rounded-lg border border-border bg-card divide-y divide-border"
            >
            <AccordionSectionItem id="cirurgicos" icon={ClipboardList} iconColor="text-foreground" label="Dados cirúrgicos" hint="Centro Cirúrgico / Clínica Cirúrgica — opcional">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Procedimento realizado / proposto</Label>
                  <Textarea value={surgProcedimento} onChange={e => setSurgProcedimento(e.target.value)} rows={2} className="mt-1" placeholder="Ex.: Colecistectomia videolaparoscópica" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Especialidade cirúrgica</Label>
                    <Input value={surgEspecialidade} onChange={e => setSurgEspecialidade(e.target.value)} className="mt-1" placeholder="Ex.: Cirurgia geral" />
                  </div>
                  <div>
                    <Label className="text-xs">Cirurgião principal</Label>
                    <Input value={surgCirurgiao} onChange={e => setSurgCirurgiao(e.target.value)} className="mt-1" placeholder="Nome do cirurgião" />
                  </div>
                  <div>
                    <Label className="text-xs">Data/hora da cirurgia</Label>
                    <Input type="datetime-local" value={surgDataHora} onChange={e => setSurgDataHora(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de anestesia</Label>
                    <Input value={surgAnestesia} onChange={e => setSurgAnestesia(e.target.value)} className="mt-1" placeholder="Ex.: Geral, raquianestesia..." />
                  </div>
                  <div>
                    <Label className="text-xs">Caráter</Label>
                    <Select value={surgCarater || undefined} onValueChange={setSurgCarater}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eletivo">Eletivo</SelectItem>
                        <SelectItem value="urgencia">Urgência</SelectItem>
                        <SelectItem value="emergencia">Emergência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </AccordionSectionItem>
            </Accordion>
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
            Validar admissão ({admissionDayLabel})
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
