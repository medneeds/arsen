import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { SapsConfirmationScreen } from "@/components/SapsConfirmationScreen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn, asUuidOrNull } from "@/lib/utils";
import { alocarPreAdmissaoNoLeito, carregarPreAdmissao } from "@/lib/alocarPreAdmissao";
import {
  BILIRRUBINA,
  COMORBIDADES,
  CREATININA,
  DIAS_ANTES_UTI,
  FC,
  GLASGOW,
  IDADE,
  INFECCAO,
  LEUCOCITOS,
  LOCAL_ANTES_UTI,
  MOTIVOS_ADMISSAO,
  OXIGENACAO,
  PAS,
  PH,
  PLANEJADA,
  PLAQUETAS,
  SITIO_CIRURGICO,
  STATUS_CIRURGICO,
  TEMPERATURA,
  VASOATIVO,
  calcularSaps3,
  contagemParaMil,
  emVentilacao,
  faixaEfetiva,
  formatarContagem,
  lerNumero,
  milParaContagem,
  motivoDoBanco,
  normalizarComorbidades,
  plaquetasParaBanco,
  somenteDigitos,
  teveCirurgia,
  type ItemFaixas,
  type RespostasSaps3,
} from "@/lib/saps3";
import { FaixaSelector, ItemCompacto } from "@/components/saps3/FaixaSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  Calculator,
  ClipboardList,
  Heart,
  Brain,
  Save,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bed,
  Clock,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
} from "lucide-react";

// ─── Tradução de erros Postgres em mensagens humanas ───
function humanizeSaveError(err: any): string {
  if (!err) return "Erro desconhecido ao salvar a ficha.";
  const code: string = err.code || err?.error?.code || "";
  const msg: string = err.message || err?.error?.message || String(err);
  if (code === "23502" || /not[-_ ]null/i.test(msg)) {
    const col = msg.match(/column "([^"]+)"/i)?.[1];
    return col
      ? `Campo obrigatório vazio no banco: "${col}". Verifique a checklist de validação acima dos botões.`
      : "Há um campo obrigatório não preenchido. Verifique a checklist de validação.";
  }
  if (code === "23514" || /check constraint/i.test(msg)) {
    return "Algum valor está fora da faixa esperada (ex.: GCS 3-15, idade ≥ 0). Revise os campos numéricos.";
  }
  if (code === "23505" || /duplicate key/i.test(msg)) {
    return "Já existe um registro idêntico para este paciente. Recarregue a página.";
  }
  if (code === "42501" || /row[-_ ]level security|permission denied/i.test(msg)) {
    return "Sem permissão para validar esta ficha. Verifique seu perfil de acesso ou contate o administrador.";
  }
  if (code === "PGRST116" || /not found/i.test(msg)) {
    return "Ficha SAPS não encontrada — pode ter sido excluída por outro usuário. Recarregue a página.";
  }
  if (/network|fetch|timeout/i.test(msg)) {
    return "Falha de rede ao salvar. Verifique sua conexão e tente novamente — o rascunho está preservado.";
  }
  return `Erro ao salvar: ${msg}`;
}
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


// ─── Types ───
interface PendingRequest {
  id: string;
  patient_name: string;
  birth_date: string | null;
  sex: string | null;
  destination_sector: string | null;
  notes: string | null;
  created_at: string;
  medical_record: string | null;
  patient_registry_id?: string | null;
  patient_id?: string | null;
  allocation_request_id?: string | null;
}

interface Saps3Record {
  id: string;
  patient_name: string;
  total_score: number | null;
  predicted_mortality: number | null;
  created_at: string;
  status: string;
  pending_since: string | null;
}



// Bed config per critical-care sector (UTI / UCI / UCC)
const UTI_SECTORS = [
  { value: "red", label: "UTI 1", prefix: "L", start: 1, max: 8, department: "UTI 1" },
  { value: "yellow", label: "UTI 2", prefix: "L", start: 9, max: 10, department: "UTI 2" },
  { value: "blue", label: "UCI 1", prefix: "L", start: 1, max: 6, department: "UCI 1" },
  { value: "outside", label: "UCI 2", prefix: "L", start: 7, max: 8, department: "UCI 2" },
  { value: "ucc", label: "UCC", prefix: "L", start: 1, max: 37, department: "UCC" },
];

// Map any incoming label/value/alias to internal sector value
function resolveSectorValue(input: string | null | undefined): string {
  if (!input) return "";
  const v = String(input).trim();
  const direct = UTI_SECTORS.find(s => s.value === v || s.label.toLowerCase() === v.toLowerCase());
  return direct?.value ?? "";
}

function resolveSectorFromContext(input: string | null | undefined, fallbackSector: string): string {
  return resolveSectorValue(input) || resolveSectorValue(fallbackSector) || "";
}

/* ───────── Draft (rascunho) — persistência local ─────────
 * Resolve o problema reportado: "fichas SAPS preenchidas ontem não ficaram
 * salvas para hoje". Antes, se o usuário fechasse o navegador sem clicar em
 * "Pré-admitir com SAPS pendente" ou "Pré-admitir no leito", todos os campos
 * digitados eram perdidos. Agora cada keystroke é serializado em localStorage. */
const SAPS_DRAFT_PREFIX = "saps3_draft:v1:";
const sapsDraftKeyFor = (key: string) => `${SAPS_DRAFT_PREFIX}${key}`;
function readSapsDraft(key: string): any | null {
  try {
    const raw = localStorage.getItem(sapsDraftKeyFor(key));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSapsDraft(key: string, payload: any) {
  try { localStorage.setItem(sapsDraftKeyFor(key), JSON.stringify(payload)); } catch {}
}
function clearSapsDraft(key: string) {
  try { localStorage.removeItem(sapsDraftKeyFor(key)); } catch {}
}

// MIGRAÇÃO: resolve profissionais.id a partir do auth user id, para criado_por
// (FK profissionais) em avaliacoes_saps3.
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase.from("profissionais").select("id").eq("user_id", userId).maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  } catch { return null; }
}

// Escala de coma de Glasgow — opcoes clicaveis com o tipo de resposta por ponto.
// So mudam a forma de escolher o numero; o estado gcsO/gcsV/gcsM segue string.
const GCS_OCULAR = [
  { v: "4", label: "Espontânea" },
  { v: "3", label: "Ao estímulo verbal" },
  { v: "2", label: "À dor" },
  { v: "1", label: "Nenhuma" },
];
const GCS_VERBAL = [
  { v: "5", label: "Orientada" },
  { v: "4", label: "Confusa" },
  { v: "3", label: "Palavras inapropriadas" },
  { v: "2", label: "Sons incompreensíveis" },
  { v: "1", label: "Nenhuma" },
];
const GCS_MOTOR = [
  { v: "6", label: "Obedece a comandos" },
  { v: "5", label: "Localiza a dor" },
  { v: "4", label: "Retirada/flexão à dor" },
  { v: "3", label: "Flexão anormal (decorticação)" },
  { v: "2", label: "Extensão anormal (descerebração)" },
  { v: "1", label: "Nenhuma" },
];

// Props opcionais para EMBUTIR a ficha dentro da aba SAPS da Admissao
// (AdmissaoPage). Sem props (= {}), o componente se comporta EXATAMENTE como a
// pagina /saps3 de hoje: todo comportamento novo fica atras de `if (embedded)`.
interface Saps3PageProps {
  embedded?: boolean;
  embedPatientId?: string;        // = internacao_id
  embedPatientName?: string;
  embedPatientBed?: string;
  embedPatientSector?: string;    // codigo do setor (red/yellow/outside...)
  embedCompleteSapsId?: string;   // id da ficha existente (sapsRow.id), se houver
  onEmbeddedDone?: () => void;    // chamado apos validar/salvar/trava
}

export default function Saps3Page({
  embedded = false,
  embedPatientId,
  embedPatientName,
  embedPatientBed,
  embedPatientSector,
  embedCompleteSapsId,
  onEmbeddedDone,
}: Saps3PageProps = {}) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment, currentSectorCode } = useDepartment();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hospitalId = currentHospital?.id;
  const stateId = currentState?.id;

  // Ref para o callback do embute: mantem o effect de contexto livre da
  // identidade de onEmbeddedDone (que o pai recria a cada render), evitando
  // re-execucao do effect e reset do formulario.
  const onEmbeddedDoneRef = useRef(onEmbeddedDone);
  useEffect(() => { onEmbeddedDoneRef.current = onEmbeddedDone; });

  // ─── State ───
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [records, setRecords] = useState<Saps3Record[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [occupiedBeds, setOccupiedBeds] = useState<string[]>([]);
  const [confirmationData, setConfirmationData] = useState<{
    patientName: string;
    bedNumber: string;
    sectorLabel: string;
    totalScore: number;
    predictedMortality: number;
    patientId?: string | null;
    sectorCode?: string;
    age?: string | null;
    mode?: "admission" | "validation";
  } | null>(null);

  // Allocation
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [selectedBed, setSelectedBed] = useState<string>("");

  // Modo "completar SAPS pendente" (paciente já admitido) — carregado via URL
  const [completingSapsId, setCompletingSapsId] = useState<string | null>(null);
  const [completingPatientId, setCompletingPatientId] = useState<string | null>(null);

  // Rascunho automático em localStorage
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Box I
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<string>("");
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [losBeforeIcu, setLosBeforeIcu] = useState<string>("");
  const [admissionSource, setAdmissionSource] = useState<string>("");
  // Respostas por faixa sem valor numérico: "" = não respondido.
  const [planejada, setPlanejada] = useState<string>("");
  const [vasoativo, setVasoativo] = useState<string>("");

  // Box II
  const [admissionReason, setAdmissionReason] = useState<string>("");
  const [surgicalStatus, setSurgicalStatus] = useState<string>("");
  const [surgeryType, setSurgeryType] = useState<string>("");
  const [infectionAtAdmission, setInfectionAtAdmission] = useState<string>("");

  // Box III — Avaliação de consciência guiada
  // sedationStatus: "" (não respondido) | "no" | "sedated" | "intubated_no_sedation"
  const [sedationStatus, setSedationStatus] = useState<"" | "no" | "sedated" | "intubated_no_sedation">("");
  const [gcsO, setGcsO] = useState<string>("");
  const [gcsV, setGcsV] = useState<string>("");
  const [gcsM, setGcsM] = useState<string>("");
  const [gcsPreSedation, setGcsPreSedation] = useState<string>("");

  // Derived GCS total ("8T" if intubated_no_sedation, numeric otherwise, "" if sedated)
  const gcsTotal = useMemo(() => {
    if (sedationStatus === "sedated") return "";
    const o = parseInt(gcsO) || 0;
    const m = parseInt(gcsM) || 0;
    if (sedationStatus === "intubated_no_sedation") {
      const sum = o + 1 + m;
      return o && m ? `${sum}T` : "";
    }
    const v = parseInt(gcsV) || 0;
    return o && v && m ? String(o + v + m) : "";
  }, [sedationStatus, gcsO, gcsV, gcsM]);
  const gcs = gcsTotal; // legacy var name kept for downstream use

  const [hrHighest, setHrHighest] = useState<string>("");
  const [sbpLowest, setSbpLowest] = useState<string>("");
  const [bilirubinHighest, setBilirubinHighest] = useState<string>("");
  const [tempLowest, setTempLowest] = useState<string>("");
  const [creatinineHighest, setCreatinineHighest] = useState<string>("");
  // Leucócitos e plaquetas: CONTAGEM COMPLETA por mm³ (só dígitos). Banco e
  // pontuação seguem em milhares — ver src/lib/saps3.ts.
  const [leukocytes, setLeukocytes] = useState<string>("");
  const [phLowest, setPhLowest] = useState<string>("");
  const [plateletsLowest, setPlateletsLowest] = useState<string>("");
  const [pao2Fio2, setPao2Fio2] = useState<string>("");
  // Faixa de oxigenação (OXIGENACAO); VM é derivada dela.
  const [oxigenacao, setOxigenacao] = useState<string>("");
  // Faixa escolhida por toque nos itens numéricos, quando o valor não foi digitado.
  const [faixas, setFaixas] = useState<Record<string, string>>({});
  const [mostrarPendentes, setMostrarPendentes] = useState(false);
  // Um item aberto por vez; ao responder, abre o próximo sem resposta.
  const [itemAberto, setItemAberto] = useState<string | null>("idade");
  // Comorbidades não são obrigatórias: "revisada" só marca que o médico passou por ela.
  const [comorbRevisada, setComorbRevisada] = useState(false);

  const [box1Open, setBox1Open] = useState(true);
  const [box2Open, setBox2Open] = useState(true);
  const [box3Open, setBox3Open] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  // ─── Respostas por faixa + escore (tabela única em src/lib/saps3.ts) ───
  const respostas = useMemo<RespostasSaps3>(() => {
    // Glasgow para o SAPS:
    //  - sedoanalgesia → GCS pré-sedação se informado, senão 15 (sem penalidade)
    //  - GCS-T (intubado sem sedação) → o numérico (parte antes do "T")
    //  - GCS normal → direto
    let gcsN: number | null = null;
    if (sedationStatus === "sedated") {
      gcsN = gcsPreSedation ? parseInt(gcsPreSedation) : 15;
    } else if (gcs) {
      gcsN = parseInt(gcs); // parseInt ignora sufixo "T"
    }
    const pf = emVentilacao(oxigenacao) ? lerNumero(pao2Fio2) : null;
    return {
      idade: faixaEfetiva(IDADE, lerNumero(age), faixas.idade),
      dias: faixaEfetiva(DIAS_ANTES_UTI, lerNumero(losBeforeIcu), faixas.dias),
      local: admissionSource || null,
      comorbidades: comorbidities,
      vasoativo: vasoativo || null,
      planejada: planejada || null,
      motivo: admissionReason || null,
      statusCirurgico: surgicalStatus || null,
      sitioCirurgico: surgeryType || null,
      infeccao: infectionAtAdmission || null,
      glasgow: gcsN != null ? GLASGOW.faixaDoValor!(gcsN) : null,
      fc: faixaEfetiva(FC, lerNumero(hrHighest), faixas.fc),
      pas: faixaEfetiva(PAS, lerNumero(sbpLowest), faixas.pas),
      temperatura: faixaEfetiva(TEMPERATURA, lerNumero(tempLowest), faixas.temperatura),
      bilirrubina: faixaEfetiva(BILIRRUBINA, lerNumero(bilirubinHighest), faixas.bilirrubina),
      creatinina: faixaEfetiva(CREATININA, lerNumero(creatinineHighest), faixas.creatinina),
      leucocitos: faixaEfetiva(LEUCOCITOS, contagemParaMil(leukocytes), faixas.leucocitos),
      plaquetas: faixaEfetiva(PLAQUETAS, contagemParaMil(plateletsLowest), faixas.plaquetas),
      ph: faixaEfetiva(PH, lerNumero(phLowest), faixas.ph),
      oxigenacao: pf != null ? OXIGENACAO.faixaDoValor!(pf) : (oxigenacao || null),
    };
  }, [age, losBeforeIcu, admissionSource, comorbidities, vasoativo, planejada, admissionReason,
    surgicalStatus, surgeryType, infectionAtAdmission, gcs, sedationStatus, gcsPreSedation,
    hrHighest, sbpLowest, tempLowest, bilirubinHighest, creatinineHighest, leukocytes,
    plateletsLowest, phLowest, oxigenacao, pao2Fio2, faixas]);

  const scores = useMemo(() => calcularSaps3(respostas), [respostas]);

  /** Toque numa faixa: descarta o valor digitado que apontava para outra faixa. */
  const escolherFaixa = (chave: string, id: string, atual: string | null, limparValor: () => void) => {
    if (id === atual) return;
    limparValor();
    setFaixas((prev) => ({ ...prev, [chave]: id }));
  };
  /** Valor digitado que não cai em nenhuma faixa plausível. */
  const fora = (item: ItemFaixas, v: number | null) => v != null && !!item.faixaDoValor && item.faixaDoValor(v) == null;
  const pend = (resposta: string | null) => mostrarPendentes && !resposta;

  const progresso = {
    box1: [respostas.idade, respostas.dias, respostas.local, respostas.vasoativo],
    box2: [respostas.planejada, respostas.motivo, respostas.statusCirurgico, respostas.infeccao,
      ...(teveCirurgia(surgicalStatus) ? [respostas.sitioCirurgico] : [])],
    box3: [respostas.glasgow, respostas.fc, respostas.pas, respostas.temperatura, respostas.bilirrubina,
      respostas.creatinina, respostas.leucocitos, respostas.plaquetas, respostas.ph, respostas.oxigenacao],
  };
  const contagem = (itens: (string | null)[]) => `${itens.filter(Boolean).length}/${itens.length} itens`;

  // Ordem de preenchimento da ficha (a mesma do formulário em papel).
  const ORDEM_ITENS = [
    "idade", "dias", "local", "comorbidades", "vasoativo",
    "planejada", "motivo", "statusCirurgico", "sitioCirurgico", "infeccao",
    "glasgow", "fc", "pas", "temperatura", "bilirrubina", "creatinina", "leucocitos", "plaquetas", "ph", "oxigenacao",
  ] as const;
  const BOX_DO_ITEM = (k: string) =>
    ["idade", "dias", "local", "comorbidades", "vasoativo"].includes(k) ? 1
      : ["planejada", "motivo", "statusCirurgico", "sitioCirurgico", "infeccao"].includes(k) ? 2 : 3;
  const abrirItem = (k: string | null) => {
    setItemAberto(k);
    if (!k) return;
    const box = BOX_DO_ITEM(k);
    if (box === 1) setBox1Open(true);
    else if (box === 2) setBox2Open(true);
    else setBox3Open(true);
  };
  const alternar = (k: string) => abrirItem(itemAberto === k ? null : k);
  /**
   * Fecha o item respondido e abre o próximo SEM resposta. `agora` traz a
   * resposta recém-dada (o estado do React ainda não atualizou neste ciclo).
   */
  const avancar = (atual: string, agora: Record<string, string | null> = {}) => {
    const r: Record<string, unknown> = { ...respostas, comorbidades: comorbRevisada ? "ok" : null, ...agora };
    const comCirurgia = teveCirurgia((r.statusCirurgico as string | null) ?? null);
    const visivel = (k: string) => k !== "sitioCirurgico" || comCirurgia;
    const semResposta = (k: string) => visivel(k) && k !== atual && !r[k];
    const i = ORDEM_ITENS.indexOf(atual as (typeof ORDEM_ITENS)[number]);
    const depois = ORDEM_ITENS.slice(i + 1).find(semResposta);
    const antes = ORDEM_ITENS.slice(0, Math.max(i, 0)).find(semResposta);
    abrirItem(depois ?? antes ?? null);
  };
  /** onSelecionar que responde e avança. */
  const responder = (k: string, set: (id: string) => void) => (id: string) => {
    set(id);
    avancar(k, { [k]: id });
  };
  /** Faixa tocada num item numérico: descarta o valor digitado e avança. */
  const responderFaixa = (k: string, atual: string | null, limparValor: () => void) => (id: string) => {
    escolherFaixa(k, id, atual, limparValor);
    avancar(k, { [k]: id });
  };

  /** Componente do Glasgow por botões: cada opção mostra o tipo de resposta. */
  const grupoGcs = (
    titulo: string,
    escala: { v: string; label: string }[],
    valor: string,
    onEscolher: (v: string) => void,
  ) => (
    <div>
      <Label className="text-xs">{titulo}</Label>
      <div className="mt-1 grid grid-cols-1 gap-1">
        {escala.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onEscolher(o.v)}
            className={`flex items-center gap-2 text-left px-2 py-1.5 rounded-md border text-sm transition-all ${
              valor === o.v
                ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {o.v}
            </span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ─── Available beds for selected sector ───
  const availableBeds = useMemo(() => {
    const sector = UTI_SECTORS.find(s => s.value === selectedSector);
    if (!sector) return [];
    const beds: { value: string; label: string; occupied: boolean }[] = [];
    for (let i = sector.start; i < sector.start + sector.max; i++) {
      const bedNum = `${sector.prefix}${String(i).padStart(2, "0")}`;
      beds.push({ value: bedNum, label: bedNum, occupied: occupiedBeds.includes(bedNum) });
    }
    return beds;
  }, [selectedSector, occupiedBeds]);

  // ─── Data Loading ───
  const loadPendingRequests = async () => {
    // MIGRAÇÃO: pre_admissions → pre_admissoes. Colunas renomeadas
    // (patient_name→nome_paciente, birth_date→data_nascimento, created_at→data_hora,
    // destination_sector→setor_destino_id[id]). Sem colunas: sex, notes,
    // medical_record, patient_registry_id, hospital_unit_id/state_id → degradados
    // (filtro por unidade removido; a RLS deve escopar por hospital do profissional).
    const { data } = await supabase
      .from("pre_admissoes")
      .select("id, nome_paciente, data_nascimento, setor_destino_id, internacao_id, data_hora")
      .eq("status", "aguardando_leito_uti")
      .order("data_hora", { ascending: true });
    if (data) {
      setPendingRequests((data as any[]).map((r) => ({
        id: r.id,
        patient_name: r.nome_paciente,
        birth_date: r.data_nascimento ?? null,
        sex: null,                              // MIGRAÇÃO: sem coluna
        destination_sector: r.setor_destino_id ?? null, // MIGRAÇÃO: id do setor (não label)
        notes: null,                            // MIGRAÇÃO: sem coluna
        created_at: r.data_hora,
        medical_record: null,                   // MIGRAÇÃO: sem coluna
        patient_registry_id: null,              // MIGRAÇÃO: sem coluna
        patient_id: r.internacao_id ?? null,
      })));
    }
  };

  const loadRecords = async () => {
    // MIGRAÇÃO: saps3_assessments → avaliacoes_saps3. Sem colunas patient_name/
    // status/pending_since e sem hospital_unit_id/state_id. Nome do paciente vem
    // do join internacao → pacientes; status/pending_since degradados. Filtro por
    // unidade removido (RLS escopa por hospital do profissional).
    const { data } = await supabase
      .from("avaliacoes_saps3")
      .select("id, escore_total, mortalidade_prevista, criado_em, internacao:internacoes(paciente:pacientes(nome_completo, nome_social))")
      .order("criado_em", { ascending: false })
      .limit(200);
    if (data) {
      setRecords((data as any[]).map((r) => {
        const pac = r.internacao?.paciente;
        return {
          id: r.id,
          patient_name: pac?.nome_social || pac?.nome_completo || "—", // MIGRAÇÃO: via join
          total_score: r.escore_total ?? null,
          predicted_mortality: r.mortalidade_prevista ?? null,
          created_at: r.criado_em,
          status: "completed",   // MIGRAÇÃO: sem coluna status → sempre "completed"
          pending_since: null,   // MIGRAÇÃO: sem coluna
        };
      }));
    }
  };

  const loadOccupiedBeds = async () => {
    // MIGRAÇÃO: a ocupação vinha de patients(sector, is_vacant). No schema novo
    // leitos usa setor_id (uuid) — não há bridge do código interno de setor
    // (red/yellow/…) para setor_id aqui. Degradado para vazio (leitos aparecem
    // todos como disponíveis no seletor).
    setOccupiedBeds([]);
  };

  useEffect(() => {
    loadPendingRequests();
    loadRecords();
  }, [hospitalId, stateId]);

  useEffect(() => { loadOccupiedBeds(); }, [hospitalId, stateId, selectedSector]);

  // ─── Pre-fill from allocation navigation / URL ───
  useEffect(() => {
    const state = location.state as any;
    // Embute (aba SAPS da Admissao): o contexto vem das props, nunca da URL/state.
    const completeSapsIdParam = embedded
      ? (embedCompleteSapsId || null)
      : (state?.completeSapsId || searchParams.get("completeSapsId"));
    const fromAllocation = embedded
      ? false
      : Boolean(state?.fromAllocation || searchParams.get("fromAllocation") === "true");
    const patientNameFromContext = embedded
      ? (embedPatientName || "")
      : (state?.patientName || searchParams.get("patientName"));

    // Não dispara se não há contexto algum
    if (!completeSapsIdParam && !fromAllocation && !patientNameFromContext) return;

    const patientAgeFromContext = embedded ? null : (state?.patientAge || searchParams.get("patientAge"));
    const destinationSectorFromContext = embedded ? null : (state?.destinationSector || searchParams.get("destinationSector"));
    const preAdmissionId = embedded ? null : (state?.preAdmissionId || searchParams.get("preAdmissionId"));
    const allocationRequestId = embedded ? null : (state?.allocationRequestId || searchParams.get("allocationRequestId"));
    const patientIdParam = embedded
      ? (embedPatientId || null)
      : (state?.patientId || searchParams.get("patientId"));
    const patientBedParam = embedded
      ? (embedPatientBed || "")
      : (state?.patientBed || searchParams.get("patientBed") || searchParams.get("selectedBed"));
    const patientSectorParam = embedded
      ? (embedPatientSector || "")
      : (state?.patientSector || searchParams.get("patientSector") || searchParams.get("selectedSector"));

    // Caminho A — Completar SAPS pendente de paciente JÁ ADMITIDO.
    // Carrega o registro SAPS existente e hidrata o formulário; não passa pelo fluxo de alocação.
    if (completeSapsIdParam) {
      setCompletingSapsId(completeSapsIdParam);
      setCompletingPatientId(patientIdParam || null);

      (async () => {
        // MIGRAÇÃO: saps3_assessments → avaliacoes_saps3 (colunas em português).
        const { data: sapsRow, error } = await supabase
          .from("avaliacoes_saps3")
          .select("*")
          .eq("id", completeSapsIdParam)
          .maybeSingle();

        if (error || !sapsRow) {
          toast.error("Não foi possível carregar a ficha SAPS pendente.");
          return;
        }

        // Regra: ficha SAPS 3 VALIDADA nao pode ser editada. Bloqueia a abertura
        // no formulario editavel e manda para a consulta read-only (aba SAPS na
        // Admissao / escore no painel).
        if ((sapsRow as { status?: string }).status === "validada") {
          toast.info("Ficha SAPS 3 já validada — não pode ser editada. Consulte pela aba SAPS na Admissão.");
          if (embedded) {
            // No embute o pai (AdmissaoPage) ja mostra a ficha validada read-only;
            // nao navega — so avisa o pai para re-buscar.
            onEmbeddedDoneRef.current?.();
            return;
          }
          const dest = patientIdParam || (sapsRow as { internacao_id?: string }).internacao_id;
          navigate(dest ? `/paciente?patientId=${dest}` : "/painel-clinico");
          return;
        }

        const r: any = sapsRow;
        // MIGRAÇÃO: avaliacoes_saps3 não tem patient_name → nome vem do contexto.
        const namePref = patientNameFromContext || "";
        // MIGRAÇÃO: patient_id → internacao_id (o "paciente" alvo é a internação).
        if (!patientIdParam && r.internacao_id) {
          setCompletingPatientId(r.internacao_id);
        }
        setSelectedRequest({
          id: completeSapsIdParam,
          patient_name: namePref,
          birth_date: null,
          sex: null,
          destination_sector: destinationSectorFromContext || patientSectorParam || null,
          notes: null,
          created_at: r.criado_em || new Date().toISOString(),
          medical_record: null,
          patient_id: patientIdParam || r.internacao_id || null,
          allocation_request_id: null,
        });

        setPatientName(namePref);
        setAge(r.idade != null ? String(r.idade) : (patientAgeFromContext ? String(patientAgeFromContext).replace(/\D/g, "") : ""));
        setComorbidities(normalizarComorbidades(Array.isArray(r.comorbidades) ? r.comorbidades : []));
        // MIGRAÇÃO: escala_consciencia NÃO tem coluna em avaliacoes_saps3 → não
        // hidrata (a avaliação de consciência volta ao estado inicial).
        setLosBeforeIcu(r.dias_hospital_antes_uti != null ? String(r.dias_hospital_antes_uti) : "");
        setAdmissionSource(r.origem_admissao || "");
        setPlanejada(r.admissao_planejada == null ? "" : r.admissao_planejada ? "sim" : "nao");
        // Vasoativo não tem coluna: volta sem resposta e precisa ser marcado de novo.
        setVasoativo("");
        setAdmissionReason(motivoDoBanco(r.motivo_admissao, r.motivo_admissao_detalhe));
        setSurgicalStatus(r.status_cirurgico || "");
        setSurgeryType(r.tipo_cirurgia || "");
        setInfectionAtAdmission(r.infeccao_na_admissao || "");

        setHrHighest(r.fc_mais_alta != null ? String(r.fc_mais_alta) : "");
        setSbpLowest(r.pas_mais_baixa != null ? String(r.pas_mais_baixa) : "");
        setBilirubinHighest(r.bilirrubina_mais_alta != null ? String(r.bilirrubina_mais_alta) : "");
        setTempLowest(r.temperatura_mais_baixa != null ? String(r.temperatura_mais_baixa) : "");
        setCreatinineHighest(r.creatinina_mais_alta != null ? String(r.creatinina_mais_alta) : "");
        setLeukocytes(milParaContagem(r.leucocitos));
        setPhLowest(r.ph_mais_baixo != null ? String(r.ph_mais_baixo) : "");
        setPlateletsLowest(milParaContagem(r.plaquetas_mais_baixas));
        setPao2Fio2(r.relacao_pao2_fio2 != null ? String(r.relacao_pao2_fio2) : "");
        // Sem VM a PaO2 não é gravada: a faixa volta sem resposta. Com VM, a
        // relação P/F gravada define a faixa.
        setOxigenacao(
          r.ventilacao_mecanica && r.relacao_pao2_fio2 != null
            ? (OXIGENACAO.faixaDoValor!(Number(r.relacao_pao2_fio2)) ?? "")
            : "",
        );
        // Faixas escolhidas sem valor não são gravadas: voltam sem resposta.
        setFaixas({});

        setSelectedSector(resolveSectorFromContext(patientSectorParam, currentSectorCode || currentDepartment));
        setSelectedBed(patientBedParam || "");
        setBox1Open(true); setBox2Open(true); setBox3Open(true);
        toast.info(`Complete a ficha SAPS 3 de ${namePref}`);
      })();
      return;
    }

    // Caminho B — Fluxo de alocação tradicional OU navegação direta com contexto de paciente
    if (!patientNameFromContext) return;

    // ─── Auto-resume: existe uma ficha SAPS 'pending' deste paciente?
    // Resolve o problema "fichas preenchidas ontem não ficaram salvas para hoje":
    // ao reabrir /saps3 com o mesmo paciente, em vez de iniciar uma ficha nova,
    // entramos automaticamente em modo "completar SAPS pendente" da ficha mais recente.
    //
    // GUARDA: só auto-resume quando há `patientIdParam` (paciente JÁ ADMITIDO).
    // No fluxo de NOVA pré-admissão (fromAllocation=true + preAdmissionId, sem patientId),
    // o paciente ainda não existe em `patients` — auto-resume sequestraria o fluxo para
    // "completar SAPS" e o handleSave cairia no early-return que só faz UPDATE no
    // saps3_assessments, sem inserir o paciente no leito nem marcar a pré-admissão.
    // MIGRAÇÃO: avaliacoes_saps3 não tem coluna `status` (nem patient_name/
    // hospital_unit_id/state_id) → não há como identificar uma ficha "pendente"
    // do paciente. O auto-resume da ficha pendente fica degradado (desativado);
    // a retomada explícita segue funcionando via ?completeSapsId=.


    setCompletingSapsId(null);
    setCompletingPatientId(null);
    setSelectedRequest({
      id: preAdmissionId || allocationRequestId || patientIdParam || patientNameFromContext,
      patient_name: patientNameFromContext,
      birth_date: null,
      sex: null,
      destination_sector: destinationSectorFromContext,
      notes: null,
      created_at: new Date().toISOString(),
      medical_record: null,
      patient_id: patientIdParam,
      allocation_request_id: allocationRequestId,
    });

    setPatientName(patientNameFromContext);
    if (patientAgeFromContext) {
      const ageStr = String(patientAgeFromContext).replace(/\D/g, "");
      if (ageStr) setAge(ageStr);
    }

    const sectorFromUrl = embedded ? null : (state?.selectedSector || searchParams.get("selectedSector"));
    const bedFromUrl = embedded ? null : (state?.selectedBed || searchParams.get("selectedBed"));
    setSelectedSector(sectorFromUrl || resolveSectorFromContext(destinationSectorFromContext || patientSectorParam, currentSectorCode || currentDepartment));
    setSelectedBed(bedFromUrl || patientBedParam || "");
    setComorbidities([]); setLosBeforeIcu(""); setAdmissionSource(""); setPlanejada(""); setVasoativo(""); setFaixas({}); setMostrarPendentes(false); setItemAberto("idade"); setComorbRevisada(false);
    setAdmissionReason(""); setSurgicalStatus(""); setSurgeryType("");
    setInfectionAtAdmission(""); setSedationStatus(""); setGcsO(""); setGcsV(""); setGcsM(""); setGcsPreSedation(""); setHrHighest(""); setSbpLowest(""); setBilirubinHighest("");
    setTempLowest(""); setCreatinineHighest(""); setLeukocytes(""); setPhLowest(""); setPlateletsLowest("");
    setPao2Fio2(""); setOxigenacao("");
    setBox1Open(true); setBox2Open(true); setBox3Open(true);
    toast.info(`Preencha o SAPS 3 para ${patientNameFromContext}`);
  }, [location.state, searchParams, currentDepartment, currentSectorCode, hospitalId, stateId, navigate,
    embedded, embedCompleteSapsId, embedPatientId, embedPatientName, embedPatientBed, embedPatientSector]);

  // ─── Chave estável do rascunho local (autosave) ───
  const draftKey = useMemo(() => {
    if (!selectedRequest) return null;
    return (
      completingSapsId ||
      selectedRequest.patient_id ||
      selectedRequest.id ||
      `name:${(selectedRequest.patient_name || patientName || "").trim().toLowerCase()}`
    );
  }, [selectedRequest, completingSapsId, patientName]);

  // ─── Restore: ao entrar no formulário, hidrata campos do rascunho local
  // (apenas para fichas novas — em modo "completar SAPS pendente" o DB é fonte da verdade)
  useEffect(() => {
    if (!draftKey || draftRestored) return;
    if (completingSapsId) { setDraftRestored(true); return; }
    const draft = readSapsDraft(draftKey);
    if (!draft) { setDraftRestored(true); return; }
    try {
      if (draft.patientName) setPatientName(draft.patientName);
      if (draft.age != null) setAge(draft.age);
      if (Array.isArray(draft.comorbidities)) setComorbidities(draft.comorbidities);
      if (draft.losBeforeIcu != null) setLosBeforeIcu(draft.losBeforeIcu);
      if (draft.admissionSource != null) setAdmissionSource(draft.admissionSource);
      if (typeof draft.planejada === "string") setPlanejada(draft.planejada);
      if (typeof draft.vasoativo === "string") setVasoativo(draft.vasoativo);
      if (draft.faixas && typeof draft.faixas === "object") setFaixas(draft.faixas);
      if (draft.admissionReason != null) setAdmissionReason(draft.admissionReason);
      if (draft.surgicalStatus != null) setSurgicalStatus(draft.surgicalStatus);
      if (draft.surgeryType != null) setSurgeryType(draft.surgeryType);
      if (draft.infectionAtAdmission != null) setInfectionAtAdmission(draft.infectionAtAdmission);
      if (draft.sedationStatus != null) setSedationStatus(draft.sedationStatus);
      if (draft.gcsO != null) setGcsO(draft.gcsO);
      if (draft.gcsV != null) setGcsV(draft.gcsV);
      if (draft.gcsM != null) setGcsM(draft.gcsM);
      if (draft.gcsPreSedation != null) setGcsPreSedation(draft.gcsPreSedation);
      if (draft.hrHighest != null) setHrHighest(draft.hrHighest);
      if (draft.sbpLowest != null) setSbpLowest(draft.sbpLowest);
      if (draft.bilirubinHighest != null) setBilirubinHighest(draft.bilirubinHighest);
      if (draft.tempLowest != null) setTempLowest(draft.tempLowest);
      if (draft.creatinineHighest != null) setCreatinineHighest(draft.creatinineHighest);
      // Rascunhos antigos guardavam leucócitos/plaquetas em milhares (chaves
      // leukocytes/plateletsLowest); são ignorados para não ler 12.5 como 12 células.
      if (draft.leucocitosMm3 != null) setLeukocytes(draft.leucocitosMm3);
      if (draft.phLowest != null) setPhLowest(draft.phLowest);
      if (draft.plaquetasMm3 != null) setPlateletsLowest(draft.plaquetasMm3);
      if (draft.pao2Fio2 != null) setPao2Fio2(draft.pao2Fio2);
      if (typeof draft.oxigenacao === "string") setOxigenacao(draft.oxigenacao);
      if (draft.selectedSector) setSelectedSector(draft.selectedSector);
      if (draft.selectedBed) setSelectedBed(draft.selectedBed);
      setDraftSavedAt(draft.savedAt ? new Date(draft.savedAt) : new Date());
      toast.info("Rascunho local restaurado — continue de onde parou");
    } catch {}
    setDraftRestored(true);
  }, [draftKey, completingSapsId, draftRestored]);

  // ─── Reset do flag de restauração quando troca de paciente/ficha ───
  useEffect(() => { setDraftRestored(false); }, [draftKey]);

  // ─── Autosave: serializa o formulário em localStorage com debounce 600 ms
  useEffect(() => {
    if (!draftKey || !draftRestored) return;
    const payload = {
      patientName, age, comorbidities,
      losBeforeIcu, admissionSource, planejada, vasoativo, faixas,
      admissionReason, surgicalStatus, surgeryType,
      infectionAtAdmission,
      sedationStatus, gcsO, gcsV, gcsM, gcsPreSedation,
      hrHighest, sbpLowest, bilirubinHighest, tempLowest, creatinineHighest,
      leucocitosMm3: leukocytes,
      phLowest, plaquetasMm3: plateletsLowest, pao2Fio2, oxigenacao,
      selectedSector, selectedBed,
      savedAt: new Date().toISOString(),
    };
    const t = setTimeout(() => {
      writeSapsDraft(draftKey, payload);
      // Evita re-render a cada tecla: só atualiza quando o minuto muda
      setDraftSavedAt((prev) => {
        const now = new Date();
        if (prev && Math.floor(prev.getTime() / 60000) === Math.floor(now.getTime() / 60000)) {
          return prev;
        }
        return now;
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [draftKey, draftRestored,
    patientName, age, comorbidities,
    losBeforeIcu, admissionSource, planejada, vasoativo, faixas,
    admissionReason, surgicalStatus, surgeryType,
    infectionAtAdmission,
    sedationStatus, gcsO, gcsV, gcsM, gcsPreSedation,
    hrHighest, sbpLowest, bilirubinHighest, tempLowest, creatinineHighest, leukocytes,
    phLowest, plateletsLowest, pao2Fio2, oxigenacao,
    selectedSector, selectedBed]);

  // ─── Helpers para limpar o rascunho após salvar/cancelar
  const discardDraft = () => {
    if (draftKey) clearSapsDraft(draftKey);
    setDraftSavedAt(null);
    toast.success("Rascunho descartado");
  };
  const clearDraftAfterSave = () => {
    if (draftKey) clearSapsDraft(draftKey);
    setDraftSavedAt(null);
  };

  // ─── Start admission from pending request ───
  const startAdmission = (req: PendingRequest) => {
    setSelectedRequest(req);
    setPatientName(req.patient_name);
    // Calculate age from birth_date
    if (req.birth_date) {
      const birth = new Date(req.birth_date + "T12:00:00");
      const ageYears = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      setAge(String(ageYears));
    }
    // Pre-select sector based on destination (supports UTI/UCI/UCC labels)
    setSelectedSector(resolveSectorFromContext(req.destination_sector, currentSectorCode || currentDepartment));
    // Reset rest
    setSelectedBed("");
    setComorbidities([]); setLosBeforeIcu(""); setAdmissionSource(""); setPlanejada(""); setVasoativo(""); setFaixas({}); setMostrarPendentes(false); setItemAberto("idade"); setComorbRevisada(false);
    setInfectionAtAdmission(""); setSedationStatus(""); setGcsO(""); setGcsV(""); setGcsM(""); setGcsPreSedation(""); setHrHighest(""); setSbpLowest(""); setBilirubinHighest("");
    setTempLowest(""); setCreatinineHighest(""); setLeukocytes(""); setPhLowest(""); setPlateletsLowest("");
    setPao2Fio2(""); setOxigenacao("");
    setBox1Open(true); setBox2Open(true); setBox3Open(true);
  };

  // ─── Build SAPS payload ───
  // MIGRAÇÃO: saps3_assessments → avaliacoes_saps3 (colunas em português).
  // Requer internacao_id. Degradados por falta de coluna: patient_name,
  // hospital_unit_id/state_id, status/pending_since (workflow "pendente" não
  // persiste), escala_consciencia, vasoativo antes da UTI (entra só no escore).
  // Motivo: grupo em motivo_admissao (vocabulário já existente) e subitem do SAPS
  // em motivo_admissao_detalhe; sem motivo escolhido o detalhe fica FORA do
  // payload para o update não apagar o que já foi gravado.
  // Números só são gravados quando DIGITADOS — faixa escolhida sem valor não
  // inventa número; a pontuação da faixa vai em escore_box*.
  const motivoSelecionado = MOTIVOS_ADMISSAO.find((m) => m.id === admissionReason) ?? null;
  const buildSapsPayload = (internacaoId: string, criadoPor: string | null) => ({
    internacao_id: internacaoId,
    criado_por: criadoPor,
    idade: age ? parseInt(age) : null,
    comorbidades: comorbidities,
    dias_hospital_antes_uti: losBeforeIcu ? parseInt(losBeforeIcu) : null,
    origem_admissao: admissionSource || null,
    admissao_planejada: planejada === "sim",
    motivo_admissao: motivoSelecionado?.grupo ?? null,
    ...(motivoSelecionado ? { motivo_admissao_detalhe: motivoSelecionado.rotulo } : {}),
    status_cirurgico: surgicalStatus || null,
    tipo_cirurgia: teveCirurgia(surgicalStatus) ? surgeryType || null : null,
    infeccao_na_admissao: infectionAtAdmission || null,
    escore_glasgow: gcs ? parseInt(gcs) : (sedationStatus === "sedated" && gcsPreSedation ? parseInt(gcsPreSedation) : null),
    fc_mais_alta: hrHighest ? parseInt(hrHighest) : null,
    pas_mais_baixa: sbpLowest ? parseInt(sbpLowest) : null,
    bilirrubina_mais_alta: lerNumero(bilirubinHighest),
    temperatura_mais_baixa: lerNumero(tempLowest),
    creatinina_mais_alta: lerNumero(creatinineHighest),
    leucocitos: contagemParaMil(leukocytes),
    ph_mais_baixo: lerNumero(phLowest),
    plaquetas_mais_baixas: plaquetasParaBanco(plateletsLowest),
    relacao_pao2_fio2: emVentilacao(oxigenacao) ? lerNumero(pao2Fio2) : null,
    ventilacao_mecanica: emVentilacao(oxigenacao),
    escore_box1: scores.box1,
    escore_box2: scores.box2,
    escore_box3: scores.box3,
    escore_total: scores.total,
    mortalidade_prevista: scores.mortality,
  });

  const nowIso = () => new Date().toISOString();

  // UMA ficha por internacao: localiza a ficha ja existente (ex.: a pendente
  // criada no momento da alocacao) para que "validar depois" ATUALIZE a mesma
  // linha em vez de inserir uma segunda. Sem isso, deferir + validar geraria
  // duas fichas SAPS para a mesma internacao.
  const findSapsIdForInternacao = async (internacaoId: string): Promise<string | null> => {
    const { data } = await supabase
      .from("avaliacoes_saps3")
      .select("id")
      .eq("internacao_id", internacaoId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };

  // ─── Checklist de validação (tempo real) ───
  type MissingItem = { id: string; label: string; anchor: string; hint?: string; chave?: string };
  const missingFields = useMemo<MissingItem[]>(() => {
    const out: MissingItem[] = [];
    if (!patientName.trim()) out.push({ id: "name", label: "Nome do paciente", anchor: "saps-banner" });
    if (!hospitalId || !stateId) out.push({ id: "hosp", label: "Hospital / Estado", anchor: "saps-banner", hint: "Selecione no topo da página" });
    // No embute o paciente JA esta alocado (leito/setor vem da internacao); nao
    // exige selecao de leito.
    if (!completingSapsId && !embedded) {
      if (!selectedSector) out.push({ id: "sector", label: "Setor da UTI", anchor: "saps-bed" });
      if (!selectedBed) out.push({ id: "bed", label: "Leito de destino", anchor: "saps-bed" });
    }
    if (!sedationStatus) {
      out.push({ chave: "glasgow", id: "sed", label: "Avaliação de consciência (sedoanalgesia/VM)", anchor: "saps-conscious", hint: "Escolha Não / Sedoanalgesia / Intubado sem sedação" });
    } else if (sedationStatus === "no" && (!gcsO || !gcsV || !gcsM)) {
      out.push({ chave: "glasgow", id: "gcs", label: "Glasgow completo (O, V, M)", anchor: "saps-conscious", hint: "Preencha as 3 componentes (faixas: O 1-4, V 1-5, M 1-6)" });
    } else if (sedationStatus === "intubated_no_sedation" && (!gcsO || !gcsM)) {
      out.push({ chave: "glasgow", id: "gcst", label: "Glasgow-T (Ocular e Motor)", anchor: "saps-conscious", hint: "V é fixo em 1T quando intubado sem sedação" });
    }
    // Item sem resposta somaria 0 em silêncio e subestimaria a mortalidade.
    const exigir = (resposta: string | null, id: string, label: string, anchor: string, chave?: string) => {
      if (!resposta) out.push({ id, label, anchor, chave });
    };
    exigir(respostas.idade, "idade", "Idade", "saps-box1", "idade");
    exigir(respostas.dias, "dias", "Dias no hospital antes da UTI", "saps-box1", "dias");
    exigir(respostas.local, "local", "Local antes da UTI", "saps-box1", "local");
    exigir(respostas.vasoativo, "vaso", "Vasoativo antes da UTI", "saps-box1", "vasoativo");
    exigir(respostas.planejada, "plan", "Admissão planejada ou não", "saps-box2", "planejada");
    exigir(respostas.motivo, "motivo", "Motivo da admissão", "saps-box2", "motivo");
    exigir(respostas.statusCirurgico, "cir", "Status cirúrgico", "saps-box2", "statusCirurgico");
    if (teveCirurgia(respostas.statusCirurgico)) exigir(respostas.sitioCirurgico, "sitio", "Sítio cirúrgico", "saps-box2", "sitioCirurgico");
    exigir(respostas.infeccao, "inf", "Infecção na admissão", "saps-box2", "infeccao");
    exigir(respostas.fc, "fc", "Frequência cardíaca", "saps-box3", "fc");
    exigir(respostas.pas, "pas", "Pressão sistólica", "saps-box3", "pas");
    exigir(respostas.temperatura, "temp", "Temperatura", "saps-box3", "temperatura");
    exigir(respostas.bilirrubina, "bili", "Bilirrubina", "saps-box3", "bilirrubina");
    exigir(respostas.creatinina, "cr", "Creatinina", "saps-box3", "creatinina");
    exigir(respostas.leucocitos, "leuco", "Leucócitos", "saps-box3", "leucocitos");
    exigir(respostas.plaquetas, "plaq", "Plaquetas", "saps-box3", "plaquetas");
    exigir(respostas.ph, "ph", "pH", "saps-box3", "ph");
    exigir(respostas.oxigenacao, "oxi", "Oxigenação / ventilação", "saps-box3", "oxigenacao");
    return out;
  }, [patientName, hospitalId, stateId, completingSapsId, embedded, selectedSector, selectedBed, sedationStatus, gcsO, gcsV, gcsM, respostas]);

  const focusAnchor = (anchor: string) => {
    if (typeof document === "undefined") return;
    const el = document.querySelector(`[data-saps-anchor="${anchor}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-destructive", "ring-offset-2", "transition-all");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-destructive", "ring-offset-2");
    }, 2400);
  };

  // ─── Save: SAPS3 + finalize allocation/admission ───
  const handleSave = async (asPending = false) => {
    // Validação unificada — pendente exige apenas identidade + leito; finalização exige checklist completa.
    if (!patientName.trim()) { toast.error("Nome do paciente é obrigatório"); focusAnchor("saps-banner"); return; }
    if (!hospitalId || !stateId) { toast.error("Hospital / Estado não selecionado"); focusAnchor("saps-banner"); return; }
    if (!completingSapsId && !embedded) {
      if (!selectedSector) { toast.error("Selecione o setor da UTI"); focusAnchor("saps-bed"); return; }
      if (!selectedBed) { toast.error("Selecione o leito"); focusAnchor("saps-bed"); return; }
    }
    if (!asPending && missingFields.length > 0) {
      setMostrarPendentes(true);
      const first = missingFields[0];
      toast.error(`Faltam ${missingFields.length} ${(missingFields.length) === 1 ? 'item' : 'items'} para validar: ${missingFields.map(f => f.label).join(" · ")}`, { duration: 6000 });
      focusAnchor(first.anchor);
      return;
    }

    // ─── Caminho "Completar SAPS pendente" — apenas atualiza a ficha existente ───
    if (completingSapsId) {
      setSaving(true);
      try {
        // MIGRAÇÃO: update em avaliacoes_saps3. internacao_id e criado_por são
        // preservados (removidos do payload de update).
        const validadoPor = await resolveProfissionalId(user?.id);
        const sapsPayload: any = buildSapsPayload(completingPatientId || "", null);
        delete sapsPayload.internacao_id;
        delete sapsPayload.criado_por;
        if (asPending) {
          // Mantem pendente: nao carimba validado_* e nao mexe em pending_since
          // (o cronometro segue do inicio). So garante o status.
          sapsPayload.status = "pendente";
        } else {
          // Validacao: gera o desfecho da ficha — status validada, quem validou
          // e quando, e guarda o snapshot das respostas (auditoria/reedicao).
          sapsPayload.status = "validada";
          sapsPayload.validado_por = validadoPor;
          sapsPayload.validado_em = nowIso();
          sapsPayload.respostas = respostas;
        }
        const { error: updErr } = await supabase
          .from("avaliacoes_saps3")
          .update(sapsPayload)
          .eq("id", completingSapsId);
        if (updErr) throw updErr;

        // MIGRAÇÃO: o "gate clínico SAPS pendente" vivia em patients.saps_pending /
        // saps_completed_at — colunas inexistentes no schema novo (patients é
        // tabela morta). Sem coluna de destino, a liberação do gate é degradada
        // (não há o que atualizar); a ficha validada já reflete a conclusão.

        const sectorLabel = UTI_SECTORS.find(s => s.value === selectedSector)?.label || selectedSector || "—";

        if (asPending) {
          // Manter pendente: NÃO mostra animação de validação. Apenas atualiza e volta para a lista.
          clearDraftAfterSave();
          toast.success("Ficha SAPS 3 mantida como pendente. Cronômetro segue ativo até a validação.");
          // Embute: nao navega nem mexe na lista — o pai (AdmissaoPage) re-busca.
          if (embedded) { onEmbeddedDone?.(); return; }
          setSelectedRequest(null);
          setCompletingSapsId(null);
          setCompletingPatientId(null);
          loadRecords();
          // Redireciona de volta para o painel clínico do paciente preservando contexto
          if (completingPatientId) {
            navigate(`/paciente?patientId=${completingPatientId}`);
          }
          return;
        }

        clearDraftAfterSave();
        toast.success("Ficha SAPS 3 validada com sucesso.");
        // Embute: sem animacao de confirmacao (tela cheia); avisa o pai para
        // re-buscar a sapsRow (que passa a 'validada' e vira read-only no pai).
        if (embedded) { onEmbeddedDone?.(); return; }
        setConfirmationData({
          patientName,
          bedNumber: selectedBed || "—",
          sectorLabel,
          totalScore: scores.total,
          predictedMortality: scores.mortality,
          patientId: completingPatientId,
          sectorCode: selectedSector,
          age: age ? `${age} anos` : null,
          mode: "validation",
        });
        setSelectedRequest(null);
        setCompletingSapsId(null);
        setCompletingPatientId(null);
        loadRecords();
      } catch (err: any) {
        toast.error(humanizeSaveError(err), { duration: 7000 });
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    let createdSapsId: string | null = null;
    let alocadoAgora = false;
    let internacaoCriada: string | null = null;
    try {
      // MIGRAÇÃO: avaliacoes_saps3 exige internacao_id (uuid real). No schema novo
      // a ficha SAPS pendura na internação — não há mais a criação da "linha de
      // paciente no leito" (patients é tabela morta; leitos/internacoes/setores
      // formam outro fluxo). Resolve a internação a partir do contexto.
      let internacaoId =
        asUuidOrNull(selectedRequest?.patient_id) ||
        asUuidOrNull(searchParams.get("patientId"));
      const criadoPor = await resolveProfissionalId(user?.id);

      // Pré-admissão vinda do AdmitPatientDialog (UTI 1, UTI 2, UCI 2) ou da
      // lista de solicitações desta tela: ainda não há internação. Antes
      // (28/09/2026) esta tela abortava aqui com "Sem internação vinculada" e
      // nenhum paciente entrava nesses setores. Agora aloca pela MESMA função
      // do diálogo, e só então a ficha pendura na internação criada.
      if (!internacaoId) {
        // Embute: o paciente JA tem internacao (embedPatientId). Se chegou aqui
        // sem internacao resolvida, aborta — o embute NUNCA aloca leito nem cria
        // internacao (isso e responsabilidade do fluxo de alocacao/admissao).
        if (embedded) {
          toast.error("Sem internação vinculada para esta ficha SAPS. Reabra a admissão do paciente.", { duration: 8000 });
          return;
        }
        const preId = !selectedRequest?.allocation_request_id ? asUuidOrNull(selectedRequest?.id) : null;
        const preAdmissao = preId ? await carregarPreAdmissao(preId) : null;
        if (!preAdmissao) {
          toast.error(
            "Sem internação nem pré-admissão vinculada. Abra a admissão pela lista de pré-admissões.",
            { duration: 8000 },
          );
          return;
        }
        // Data/hora da internação escolhida no diálogo de alocação — só vale para
        // a MESMA pré-admissão do endereço, e nunca no futuro.
        const dataParam = searchParams.get("preAdmissionId") === preId ? searchParams.get("admissionDate") : null;
        const dataMs = dataParam ? Date.parse(dataParam) : NaN;
        const dataEntrada = Number.isFinite(dataMs) && dataMs <= Date.now() ? new Date(dataMs) : new Date();
        const alocacao = await alocarPreAdmissaoNoLeito({
          preAdmissao,
          sectorCode: selectedSector,
          bed: selectedBed,
          dataEntrada,
          pendencias: null,
          registradoPor: criadoPor,
        });
        internacaoId = alocacao.internacaoId;
        if (alocacao.avisoLeito) toast.warning(alocacao.avisoLeito, { duration: 12000 });
        internacaoCriada = alocacao.internacaoId;
        alocadoAgora = true;
      }

      // UMA ficha por internacao: se ja existe (ex.: pendente criada num defer
      // anterior), reaproveita a linha em vez de duplicar.
      const existingSapsId = internacaoId ? await findSapsIdForInternacao(internacaoId) : null;

      // SAPS pendente: agora GRAVA a ficha pendente ancorada na internacao
      // (status='pendente', pending_since=agora). Antes nao gravava nada e o
      // pendente ficava orfao — painel e hub nao tinham o que mostrar nem
      // cronometro. Agora o cronometro de 24h nasce aqui.
      if (asPending) {
        const sectorLabelPend = UTI_SECTORS.find(s => s.value === selectedSector)?.label || selectedSector;
        if (existingSapsId) {
          const { error: pendErr } = await supabase
            .from("avaliacoes_saps3")
            .update({ status: "pendente" })
            .eq("id", existingSapsId);
          if (pendErr) throw pendErr;
        } else {
          const { error: pendErr } = await supabase
            .from("avaliacoes_saps3")
            .insert({
              internacao_id: internacaoId,
              criado_por: criadoPor,
              status: "pendente",
              pending_since: nowIso(),
            });
          if (pendErr) throw pendErr;
        }
        toast.success(
          alocadoAgora
            ? `${patientName} alocado no ${selectedBed} (${sectorLabelPend}). SAPS 3 registrado como pendente — cronometro de 24h ativo.`
            : "SAPS 3 registrado como pendente. Cronometro de 24h ativo ate a validacao.",
          { duration: 7000 },
        );
        clearDraftAfterSave();
        // Embute: nao navega nem mexe nas listas — o pai (AdmissaoPage) re-busca.
        if (embedded) { onEmbeddedDone?.(); return; }
        setSelectedRequest(null);
        loadPendingRequests();
        loadRecords();
        loadOccupiedBeds();
        navigate(`/paciente?patientId=${internacaoId}`);
        return;
      }

      // Mesmo cast do insert original (os tipos gerados rejeitam o payload rico
      // do SAPS em insert/update) — feito UMA vez na construcao, para nao
      // multiplicar `as any` nos dois ramos.
      const sapsPayload: any = {
        ...buildSapsPayload(internacaoId, criadoPor),
        status: "validada",
        validado_por: criadoPor,
        validado_em: nowIso(),
        respostas,
      };
      if (existingSapsId) {
        // Ja havia ficha (defer -> validar): atualiza a MESMA linha, nao duplica.
        // createdSapsId fica null de proposito: o rollback nao deve apagar uma
        // linha preexistente que nao foi criada por este save. Preserva
        // internacao_id/criado_por (o criador original) — validado_por carrega
        // quem validou; por isso ambos saem do payload de update.
        const upd = { ...sapsPayload };
        delete upd.internacao_id;
        delete upd.criado_por;
        const { error: sapsError } = await supabase
          .from("avaliacoes_saps3")
          .update(upd)
          .eq("id", existingSapsId);
        if (sapsError) throw sapsError;
      } else {
        const { data: sapsRecord, error: sapsError } = await supabase
          .from("avaliacoes_saps3")
          .insert(sapsPayload)
          .select("id")
          .single();
        if (sapsError) throw sapsError;
        createdSapsId = (sapsRecord as any)?.id || null;
      }

      // MIGRAÇÃO: alocação física do paciente no leito REMOVIDA (degradada) —
      // dependia de patients(bed rows)/bed_allocation_requests, tabelas mortas.
      // A movimentação para o leito é responsabilidade de outro fluxo (leitos/
      // solicitacoes_leito/internacoes). Aqui grava-se apenas a ficha SAPS.

      // Origem: pré-admissão → marca como admitida (pre_admissions → pre_admissoes).
      // MIGRAÇÃO: destination_bed/destination_sector não existem em pre_admissoes;
      // apenas o status é atualizado.
      // Quando a alocação acabou de ser feita acima, a pré-admissão já foi marcada.
      if (!alocadoAgora && !embedded && selectedRequest?.id && !selectedRequest.allocation_request_id) {
        const preId = asUuidOrNull(selectedRequest.id);
        if (preId) {
          const { error: updatePreAdmissionError } = await supabase
            .from("pre_admissoes")
            .update({ status: "admitido" })
            .eq("id", preId);
          if (updatePreAdmissionError) throw updatePreAdmissionError;
        }
      }

      clearDraftAfterSave();
      // Embute: sem animacao de confirmacao; avisa o pai para re-buscar a sapsRow.
      if (embedded) {
        toast.success("Ficha SAPS 3 validada com sucesso.");
        onEmbeddedDone?.();
        return;
      }
      const sectorLabel = UTI_SECTORS.find(s => s.value === selectedSector)?.label || selectedSector;
      setConfirmationData({
        patientName,
        bedNumber: selectedBed,
        sectorLabel,
        totalScore: scores.total,
        predictedMortality: scores.mortality,
        patientId: internacaoId,
        sectorCode: selectedSector,
        age: age ? `${age} anos` : null,
      });
      setSelectedRequest(null);
      loadPendingRequests();
      loadRecords();
      loadOccupiedBeds();
    } catch (err: any) {
      if (createdSapsId) {
        // Compensacao: apaga a avaliacao ja criada. O resultado era descartado,
        // entao um rollback que falha deixava avaliacao SAPS orfa no banco sem
        // nenhum registro de que isso aconteceu.
        const { error: erroRollback } = await supabase.from("avaliacoes_saps3").delete().eq("id", createdSapsId);
        if (erroRollback) {
          console.error("[Saps3Page] ROLLBACK FALHOU — avaliacao SAPS orfa:", createdSapsId, erroRollback);
        }
      }
      if (alocadoAgora) {
        // A internação JÁ foi criada e o leito ocupado; só a ficha falhou. Não
        // desfazemos a alocação automaticamente — desalocar paciente sozinho é
        // mais perigoso que um SAPS pendente. O aviso diz exatamente o estado.
        toast.error(
          `${patientName} FOI alocado no ${selectedBed}, mas a ficha SAPS 3 não foi gravada: ${humanizeSaveError(err)}. Preencha o SAPS pela internação.`,
          { duration: 12000 },
        );
        // Nova tentativa grava a ficha nesta internação, sem tentar alocar de novo.
        setSelectedRequest((prev) => (prev ? { ...prev, patient_id: internacaoCriada } : prev));
        loadPendingRequests();
        loadOccupiedBeds();
        return;
      }
      toast.error(humanizeSaveError(err), { duration: 7000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("avaliacoes_saps3").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Registro excluído"); loadRecords(); }
    setDeleteId(null);
  };

  const getMortalityColor = (m: number | null) => {
    if (!m) return "text-muted-foreground";
    if (m < 10) return "text-released-on-soft";
    if (m < 25) return "text-warning-on-soft";
    if (m < 50) return "text-warning-on-soft";
    return "text-critical-on-soft";
  };

  const getMortalityBadge = (m: number) => {
    if (m < 10) return "bg-released-soft text-released-on-soft";
    if (m < 25) return "bg-warning-soft text-warning-on-soft";
    if (m < 50) return "bg-warning-soft text-warning-on-soft";
    return "bg-critical-soft text-critical-on-soft";
  };

  const isFormMode = !!selectedRequest;

  const currentSectorLabel = UTI_SECTORS.find(s => s.value === selectedSector)?.label;
  const headerSectorLabel = currentSectorLabel || selectedRequest?.destination_sector || "UTI";

  return (
    // Embute (aba SAPS da Admissao): so o bloco do formulario, sem o chrome de
    // pagina (container max-w, header, listas, confirmacao de tela cheia).
    <div className={embedded ? "space-y-6" : "mx-auto w-full max-w-6xl px-4 md:px-8 lg:px-8 py-6 space-y-6"}>
      {!embedded && confirmationData && (
        <SapsConfirmationScreen
          patientName={confirmationData.patientName}
          bedNumber={confirmationData.bedNumber}
          sectorLabel={confirmationData.sectorLabel}
          totalScore={confirmationData.totalScore}
          predictedMortality={confirmationData.predictedMortality}
          patientId={confirmationData.patientId}
          sectorCode={confirmationData.sectorCode}
          age={confirmationData.age}
          mode={confirmationData.mode}
          onComplete={() => setConfirmationData(null)}
        />
      )}
      {/* Header */}
      {!embedded && (
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Admissão {headerSectorLabel} — SAPS 3
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fluxo admissional: Solicitação → Avaliação médica → Alocação de leito + SAPS 3
        </p>
      </div>
      )}

      {/* ─── Step 1: Pending UTI Bed Requests ─── */}
      {!embedded && !isFormMode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Solicitações de Leito UTI Pendentes
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{pendingRequests.length}</Badge>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma solicitação de leito UTI pendente.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="patient-id font-medium text-foreground truncate">{req.patient_name}</p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {req.destination_sector}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {req.birth_date && (
                          <span>Nasc: {new Date(req.birth_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                        )}
                        {req.sex && <span>Sexo: {req.sex === "M" ? "Masc" : "Fem"}</span>}
                        {req.medical_record && <span>Prontuário: {req.medical_record}</span>}
                        <span>Solicitado: {format(new Date(req.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                      </div>
                      {req.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">Obs: {req.notes}</p>
                      )}
                    </div>
                    <Button size="sm" onClick={() => startAdmission(req)} className="gap-2 ml-3 shrink-0">
                      <UserCheck className="h-4 w-4" /> Pré-admitir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Step 2: Admission Form (Bed Selection + SAPS 3) ─── */}
      {isFormMode && (
        <div className="space-y-4">
          {/* Patient info banner */}
          {/* ── Guia "Como preencher" — recolhido por padrão, zero impacto no layout ── */}
          <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
            <Card className="border-border bg-muted/50">
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/60 transition-colors rounded-lg">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <HelpCircle className="h-4 w-4" />
                    Como preencher a ficha SAPS 3 sem travar a validação
                  </span>
                  {helpOpen ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 text-xs text-foreground space-y-3">
                  <div>
                    <p className="font-medium mb-1">Mínimo obrigatório para <u>validar</u> (status “concluído”)</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><b>Nome do paciente</b>, <b>Hospital/Estado</b> e <b>Leito</b> (este último só quando ainda não houver alocação).</li>
                      <li><b>Avaliação de consciência</b>: escolha um dos 3 caminhos e preencha as componentes correspondentes.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Quando usar cada caminho de consciência</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><b>Não (GCS completo)</b> — paciente acordado/colaborativo. Faixas: Ocular 1-4, Verbal 1-5, Motor 1-6.</li>
                      <li><b>Sedoanalgesia ± VM</b> — paciente sedado. Informe o GCS pré-sedação; sem ele, o cálculo assume 15.</li>
                      <li><b>Intubado sem sedação (GCS-T)</b> — IOT sem sedação contínua. Preencha apenas Ocular e Motor; Verbal vira <b>1T</b> automaticamente.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Os 5 erros que mais bloqueiam a finalização</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Esquecer de marcar o caminho de consciência (botão cinza no topo da Box III).</li>
                      <li>Reabrir uma ficha pendente e clicar “Validar” antes de revisar — o sistema agora rehidrata os campos automaticamente, mas confira a checklist abaixo.</li>
                      <li>Tentar validar com hospital/estado vazio no seletor superior (toca a sessão).</li>
                      <li>Leito que ficou ocupado por outro fluxo desde que você abriu a tela — o sistema avisa e basta escolher outro.</li>
                      <li>Valores fora da faixa (GCS &gt; 15, idade negativa). O banco bloqueia e a mensagem agora aparece traduzida.</li>
                    </ul>
                  </div>
                  <div className="rounded-md bg-muted/50 border border-border p-3">
                    <p className="font-medium flex items-center gap-2 mb-1"><Info className="h-3.5 w-3.5" /> Pré-admitir com SAPS pendente</p>
                    <p>Use quando os exames laboratoriais (gasometria, hemograma, creatinina, bilirrubina) ainda não chegaram. O paciente é alocado e um cronômetro fica ativo até a validação. Para essa via, basta nome + leito.</p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Patient info banner */}
          {/* Paciente + alocação de leito num só cartão (antes eram dois cartões,
              com setor, leito e confirmação repetindo a mesma informação). */}
          <Card data-saps-anchor="saps-banner" className={completingSapsId ? "border-released-border bg-released-soft/60" : "border-primary/30 bg-primary/5"}>
            <CardContent className="py-3 px-4 space-y-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {completingSapsId ? "Validando ficha SAPS — paciente já alocado" : "Admitindo paciente"}
                  </p>
                  <p className="patient-id text-lg font-semibold text-foreground truncate">{patientName}</p>
                  {!completingSapsId && selectedRequest?.destination_sector && (
                    <p className="text-xs text-muted-foreground">Pedido: {selectedRequest.destination_sector}</p>
                  )}
                </div>

                <div data-saps-anchor="saps-bed" className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-background px-3 text-sm font-medium"
                    title={completingSapsId ? "Setor atual do paciente" : "Setor definido pela origem do pedido"}
                  >
                    <Bed className="h-4 w-4 text-primary" />
                    {currentSectorLabel || "Setor —"}
                  </span>
                  {completingSapsId ? (
                    <span className="inline-flex h-9 items-center gap-2 rounded-md border border-released-border bg-released-soft px-3 text-sm font-medium text-released-on-soft">
                      Leito {selectedBed || "—"}
                      <span className="text-xs uppercase tracking-wider">ocupado</span>
                    </span>
                  ) : (
                    <Select value={selectedBed} onValueChange={setSelectedBed} disabled={!selectedSector}>
                      <SelectTrigger
                        className={cn("h-9 w-40", !selectedBed && "border-warning-border")}
                        aria-label="Leito de destino"
                      >
                        <SelectValue placeholder={selectedSector ? "Escolha o leito" : "Setor não definido"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBeds.map(b => (
                          <SelectItem key={b.value} value={b.value} disabled={b.occupied}>
                            {b.label} {b.occupied ? " (ocupado)" : " livre"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setSelectedRequest(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
              {draftSavedAt && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-warning-border/60 bg-warning-soft px-3 py-1.5">
                  <span className="text-xs text-warning-on-soft">
                    Rascunho salvo às {format(draftSavedAt, "HH:mm", { locale: ptBR })} — será restaurado automaticamente
                  </span>
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="text-xs font-medium text-warning-on-soft underline underline-offset-2 hover:text-warning-on-soft"
                  >
                    Descartar
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score Panel */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Box I</p>
                  <p className="text-2xl font-semibold text-foreground">{scores.box1}</p>
                  <p className="text-xs text-muted-foreground">Pré-admissão</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Box II</p>
                  <p className="text-2xl font-semibold text-foreground">{scores.box2}</p>
                  <p className="text-xs text-muted-foreground">Circunstâncias</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Box III</p>
                  <p className="text-2xl font-semibold text-foreground">{scores.box3}</p>
                  <p className="text-xs text-muted-foreground">Fisiológicas</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-3xl font-semibold text-primary">{scores.total}</p>
                  <p className="text-xs text-muted-foreground">Score total</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Mortalidade</p>
                  <p className={`text-3xl font-semibold ${getMortalityColor(scores.mortality)}`}>
                    {scores.mortality}%
                  </p>
                  <p className="text-xs text-muted-foreground">Predita</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Box I */}
          <Collapsible open={box1Open} onOpenChange={setBox1Open}>
            <Card data-saps-anchor="saps-box1">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2 flex-wrap">
                      <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      Box I — Antes da admissão na UTI
                      <Badge variant="outline" className="ml-2">{scores.box1} pts</Badge>
                      <span className="text-xs font-normal text-muted-foreground">{contagem(progresso.box1)}</span>
                    </span>
                    {box1Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-0 items-start">
                  <p className="text-xs text-muted-foreground normal-case lg:col-span-2">
                    Toque no item para ver as faixas; ao escolher, o próximo abre sozinho. Box I inclui 16 pontos de base.
                  </p>
                  <FaixaSelector
                    titulo="Idade"
                    faixas={IDADE.faixas}
                    selecionada={respostas.idade}
                    pendente={pend(respostas.idade)}
                    aberto={itemAberto === "idade"}
                    onAlternar={() => alternar("idade")}
                    onSelecionar={responderFaixa("idade", respostas.idade, () => setAge(""))}
                    onConcluir={() => avancar("idade")}
                    valor={{ texto: age, onChange: (t) => setAge(somenteDigitos(t)), unidade: "anos", inputMode: "numeric", placeholder: "Ex: 65", foraDaFaixa: fora(IDADE, lerNumero(age)) }}
                  />
                  <FaixaSelector
                    titulo="Dias no hospital antes da UTI"
                    faixas={DIAS_ANTES_UTI.faixas}
                    selecionada={respostas.dias}
                    pendente={pend(respostas.dias)}
                    aberto={itemAberto === "dias"}
                    onAlternar={() => alternar("dias")}
                    onSelecionar={responderFaixa("dias", respostas.dias, () => setLosBeforeIcu(""))}
                    onConcluir={() => avancar("dias")}
                    valor={{ texto: losBeforeIcu, onChange: (t) => setLosBeforeIcu(somenteDigitos(t)), unidade: "dias", inputMode: "numeric", placeholder: "Ex: 3", foraDaFaixa: false }}
                  />
                  <FaixaSelector
                    titulo="Local antes da UTI"
                    faixas={LOCAL_ANTES_UTI.faixas}
                    selecionada={respostas.local}
                    pendente={pend(respostas.local)}
                    aberto={itemAberto === "local"}
                    onAlternar={() => alternar("local")}
                    onSelecionar={responder("local", setAdmissionSource)}
                    vertical
                  />
                  <ItemCompacto
                    titulo="Comorbidades"
                    dica="Marque todas que se aplicam. Nenhuma marcada = sem comorbidade do SAPS 3."
                    resumo={comorbidities.length
                      ? COMORBIDADES.filter((c) => comorbidities.includes(c.id)).map((c) => c.rotulo).join(", ")
                      : comorbRevisada ? "Nenhuma" : null}
                    pontos={comorbidities.length || comorbRevisada
                      ? COMORBIDADES.filter((c) => comorbidities.includes(c.id)).reduce((t, c) => t + c.pontos, 0)
                      : null}
                    aberto={itemAberto === "comorbidades"}
                    onAlternar={() => alternar("comorbidades")}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {COMORBIDADES.map((c) => {
                        const ativa = comorbidities.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={ativa}
                            onClick={() => {
                              setComorbRevisada(true);
                              setComorbidities((prev) => (ativa ? prev.filter((x) => x !== c.id) : [...prev, c.id]));
                            }}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                              ativa ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border bg-card hover:bg-muted/50",
                            )}
                          >
                            <span className="flex items-center gap-2 normal-case">
                              <Checkbox checked={ativa} tabIndex={-1} aria-hidden className="pointer-events-none" />
                              {c.rotulo}
                            </span>
                            <span className={cn("shrink-0 font-mono text-xs font-medium", ativa ? "text-primary" : "text-muted-foreground")}>+{c.pontos}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-end gap-2">
                      {comorbidities.length === 0 && (
                        <Button type="button" size="sm" variant="outline" onClick={() => { setComorbRevisada(true); avancar("comorbidades", { comorbidades: "ok" }); }}>
                          Nenhuma
                        </Button>
                      )}
                      {comorbidities.length > 0 && (
                        <Button type="button" size="sm" onClick={() => { setComorbRevisada(true); avancar("comorbidades", { comorbidades: "ok" }); }}>
                          Concluir
                        </Button>
                      )}
                    </div>
                  </ItemCompacto>
                  <FaixaSelector
                    titulo="Vasoativo antes da UTI"
                    faixas={VASOATIVO.faixas}
                    selecionada={respostas.vasoativo}
                    pendente={pend(respostas.vasoativo)}
                    aberto={itemAberto === "vasoativo"}
                    onAlternar={() => alternar("vasoativo")}
                    onSelecionar={responder("vasoativo", setVasoativo)}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Box II */}
          <Collapsible open={box2Open} onOpenChange={setBox2Open}>
            <Card data-saps-anchor="saps-box2">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2 flex-wrap">
                      <Activity className="h-5 w-5 text-warning" />
                      Box II — Circunstâncias da admissão
                      <Badge variant="outline" className="ml-2">{scores.box2} pts</Badge>
                      <span className="text-xs font-normal text-muted-foreground">{contagem(progresso.box2)}</span>
                    </span>
                    {box2Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-0 items-start">
                  <FaixaSelector
                    titulo="Admissão na UTI"
                    faixas={PLANEJADA.faixas}
                    selecionada={respostas.planejada}
                    pendente={pend(respostas.planejada)}
                    aberto={itemAberto === "planejada"}
                    onAlternar={() => alternar("planejada")}
                    onSelecionar={responder("planejada", setPlanejada)}
                  />
                  <FaixaSelector
                    titulo="Motivo da admissão"
                    faixas={MOTIVOS_ADMISSAO}
                    selecionada={respostas.motivo}
                    pendente={pend(respostas.motivo)}
                    aberto={itemAberto === "motivo"}
                    onAlternar={() => alternar("motivo")}
                    onSelecionar={responder("motivo", setAdmissionReason)}
                    dica="Escolha o motivo principal."
                    vertical
                  />
                  <FaixaSelector
                    titulo="Status cirúrgico"
                    faixas={STATUS_CIRURGICO.faixas}
                    selecionada={respostas.statusCirurgico}
                    pendente={pend(respostas.statusCirurgico)}
                    aberto={itemAberto === "statusCirurgico"}
                    onAlternar={() => alternar("statusCirurgico")}
                    onSelecionar={(id) => { setSurgicalStatus(id); if (!teveCirurgia(id)) setSurgeryType(""); avancar("statusCirurgico", { statusCirurgico: id }); }}
                  />
                  {teveCirurgia(surgicalStatus) && (
                  <FaixaSelector
                    titulo="Sítio cirúrgico"
                    faixas={SITIO_CIRURGICO.faixas}
                    selecionada={respostas.sitioCirurgico}
                    pendente={pend(respostas.sitioCirurgico)}
                    aberto={itemAberto === "sitioCirurgico"}
                    onAlternar={() => alternar("sitioCirurgico")}
                    onSelecionar={responder("sitioCirurgico", setSurgeryType)}
                    vertical
                  />
                  )}
                  <FaixaSelector
                    titulo="Infecção aguda na admissão"
                    faixas={INFECCAO.faixas}
                    selecionada={respostas.infeccao}
                    pendente={pend(respostas.infeccao)}
                    aberto={itemAberto === "infeccao"}
                    onAlternar={() => alternar("infeccao")}
                    onSelecionar={responder("infeccao", setInfectionAtAdmission)}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Box III */}
          <Collapsible open={box3Open} onOpenChange={setBox3Open}>
            <Card data-saps-anchor="saps-box3">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2 flex-wrap">
                      <Heart className="h-5 w-5 text-critical" />
                      Box III — Fisiologia (pior valor na 1ª hora)
                      <Badge variant="outline" className="ml-2">{scores.box3} pts</Badge>
                      <span className="text-xs font-normal text-muted-foreground">{contagem(progresso.box3)}</span>
                    </span>
                    {box3Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-0 items-start">
                  <ItemCompacto
                    titulo="Glasgow (consciência)"
                    ancora="saps-conscious"
                    resumo={respostas.glasgow
                      ? `${gcsTotal || (sedationStatus === "sedated" ? `pré-sedação ${gcsPreSedation || "15 (assumido)"}` : "")} · ${GLASGOW.faixas.find((f) => f.id === respostas.glasgow)?.rotulo}`
                      : null}
                    pontos={respostas.glasgow ? (GLASGOW.faixas.find((f) => f.id === respostas.glasgow)?.pontos ?? null) : null}
                    aberto={itemAberto === "glasgow"}
                    onAlternar={() => alternar("glasgow")}
                    pendente={mostrarPendentes && !respostas.glasgow}
                  >
                  {/* ── Avaliação de consciência guiada (GCS / GCS-T / GCS pré-sedação) ── */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-2">
                      <Brain className="h-4 w-4 text-primary mt-1" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Avaliação de consciência</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          O paciente está sob sedoanalgesia contínua e/ou ventilação mecânica?
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { v: "no", label: "Não", hint: "Aplicar GCS completo" },
                        { v: "sedated", label: "Sim — sedoanalgesia ± VM", hint: "Informe o GCS pré-sedação" },
                        { v: "intubated_no_sedation", label: "Intubado sem sedação", hint: "GCS com V = 1T" },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setSedationStatus(opt.v)}
                          className={`text-left p-3 rounded-md border transition-all ${
                            sedationStatus === opt.v
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                              : "border-border bg-card hover:bg-muted/50"
                          }`}
                        >
                          <p className="text-sm font-medium text-foreground">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{opt.hint}</p>
                        </button>
                      ))}
                    </div>

                    {/* Caminho 1: GCS completo */}
                    {sedationStatus === "no" && (
                      <div className="pt-2 border-t border-primary/20 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {grupoGcs("Abertura ocular", GCS_OCULAR, gcsO, setGcsO)}
                          {grupoGcs("Resposta verbal", GCS_VERBAL, gcsV, setGcsV)}
                          {grupoGcs("Resposta motora", GCS_MOTOR, gcsM, setGcsM)}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Label className="text-xs">GCS total</Label>
                          <div className="h-10 min-w-[3rem] px-3 rounded-md border bg-background flex items-center justify-center text-lg font-semibold text-primary">
                            {gcsTotal || "—"}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Caminho 2: Sedoanalgesia → GCS pré-sedação */}
                    {sedationStatus === "sedated" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-primary/20">
                        <div>
                          <Label className="text-xs">GCS pré-sedação (opcional)</Label>
                          <Input type="number" value={gcsPreSedation} onChange={e => setGcsPreSedation(e.target.value)} min={3} max={15} placeholder="3-15" />
                        </div>
                        <p className="sm:col-span-3 text-xs text-muted-foreground">
                          GCS não será aplicado. Pontuação SAPS usa o GCS pré-sedação se informado; caso contrário assume 15.
                        </p>
                      </div>
                    )}

                    {/* Caminho 3: Intubado sem sedação → GCS-T */}
                    {sedationStatus === "intubated_no_sedation" && (
                      <div className="pt-2 border-t border-primary/20 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {grupoGcs("Abertura ocular", GCS_OCULAR, gcsO, setGcsO)}
                          <div>
                            <Label className="text-xs">Resposta verbal</Label>
                            <div className="mt-1 h-10 px-3 rounded-md border border-dashed border-warning bg-warning-soft flex items-center justify-center text-sm font-semibold text-warning-on-soft">
                              1T — via aérea artificial
                            </div>
                          </div>
                          {grupoGcs("Resposta motora", GCS_MOTOR, gcsM, setGcsM)}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Label className="text-xs">GCS total</Label>
                          <div className="h-10 min-w-[3rem] px-3 rounded-md border bg-background flex items-center justify-center text-lg font-semibold text-primary">
                            {gcsTotal || "—"}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Verbal travado em 1T (via aérea artificial). Score exibido com sufixo T.
                        </p>
                      </div>
                    )}
                  </div>

                    <div className="flex justify-end">
                      <Button type="button" size="sm" onClick={() => avancar("glasgow")} disabled={!respostas.glasgow}>
                        Concluir
                      </Button>
                    </div>
                  </ItemCompacto>
                  <FaixaSelector
                    titulo="Frequência cardíaca — mais alta"
                    faixas={FC.faixas}
                    selecionada={respostas.fc}
                    pendente={pend(respostas.fc)}
                    aberto={itemAberto === "fc"}
                    onAlternar={() => alternar("fc")}
                    onSelecionar={responderFaixa("fc", respostas.fc, () => setHrHighest(""))}
                    onConcluir={() => avancar("fc")}
                    valor={{ texto: hrHighest, onChange: (t) => setHrHighest(somenteDigitos(t)), unidade: "bpm", inputMode: "numeric", placeholder: "Ex: 110", foraDaFaixa: fora(FC, lerNumero(hrHighest)) }}
                  />
                  <FaixaSelector
                    titulo="Pressão sistólica"
                    faixas={PAS.faixas}
                    selecionada={respostas.pas}
                    pendente={pend(respostas.pas)}
                    aberto={itemAberto === "pas"}
                    onAlternar={() => alternar("pas")}
                    onSelecionar={responderFaixa("pas", respostas.pas, () => setSbpLowest(""))}
                    onConcluir={() => avancar("pas")}
                    valor={{ texto: sbpLowest, onChange: (t) => setSbpLowest(somenteDigitos(t)), unidade: "mmHg", inputMode: "numeric", placeholder: "Ex: 90", foraDaFaixa: fora(PAS, lerNumero(sbpLowest)) }}
                  />
                  <FaixaSelector
                    titulo="Temperatura — mais baixa"
                    faixas={TEMPERATURA.faixas}
                    selecionada={respostas.temperatura}
                    pendente={pend(respostas.temperatura)}
                    aberto={itemAberto === "temperatura"}
                    onAlternar={() => alternar("temperatura")}
                    onSelecionar={responderFaixa("temperatura", respostas.temperatura, () => setTempLowest(""))}
                    onConcluir={() => avancar("temperatura")}
                    valor={{ texto: tempLowest, onChange: setTempLowest, unidade: "°C", inputMode: "decimal", placeholder: "Ex: 36,5", foraDaFaixa: fora(TEMPERATURA, lerNumero(tempLowest)) }}
                  />
                  <FaixaSelector
                    titulo="Bilirrubina total — mais alta"
                    faixas={BILIRRUBINA.faixas}
                    selecionada={respostas.bilirrubina}
                    pendente={pend(respostas.bilirrubina)}
                    aberto={itemAberto === "bilirrubina"}
                    onAlternar={() => alternar("bilirrubina")}
                    onSelecionar={responderFaixa("bilirrubina", respostas.bilirrubina, () => setBilirubinHighest(""))}
                    onConcluir={() => avancar("bilirrubina")}
                    valor={{ texto: bilirubinHighest, onChange: setBilirubinHighest, unidade: "mg/dL", inputMode: "decimal", placeholder: "Ex: 1,2", foraDaFaixa: fora(BILIRRUBINA, lerNumero(bilirubinHighest)) }}
                  />
                  <FaixaSelector
                    titulo="Creatinina — mais alta"
                    faixas={CREATININA.faixas}
                    selecionada={respostas.creatinina}
                    pendente={pend(respostas.creatinina)}
                    aberto={itemAberto === "creatinina"}
                    onAlternar={() => alternar("creatinina")}
                    onSelecionar={responderFaixa("creatinina", respostas.creatinina, () => setCreatinineHighest(""))}
                    onConcluir={() => avancar("creatinina")}
                    valor={{ texto: creatinineHighest, onChange: setCreatinineHighest, unidade: "mg/dL", inputMode: "decimal", placeholder: "Ex: 1,5", foraDaFaixa: fora(CREATININA, lerNumero(creatinineHighest)) }}
                  />
                  <FaixaSelector
                    titulo="Leucócitos — mais alto"
                    faixas={LEUCOCITOS.faixas}
                    selecionada={respostas.leucocitos}
                    pendente={pend(respostas.leucocitos)}
                    aberto={itemAberto === "leucocitos"}
                    onAlternar={() => alternar("leucocitos")}
                    onSelecionar={responderFaixa("leucocitos", respostas.leucocitos, () => setLeukocytes(""))}
                    onConcluir={() => avancar("leucocitos")}
                    valor={{ texto: formatarContagem(leukocytes), onChange: (t) => setLeukocytes(somenteDigitos(t)), unidade: "/mm³", inputMode: "numeric", placeholder: "Ex: 12.500", foraDaFaixa: fora(LEUCOCITOS, contagemParaMil(leukocytes)) }}
                  />
                  <FaixaSelector
                    titulo="Plaquetas — mais baixa"
                    faixas={PLAQUETAS.faixas}
                    selecionada={respostas.plaquetas}
                    pendente={pend(respostas.plaquetas)}
                    aberto={itemAberto === "plaquetas"}
                    onAlternar={() => alternar("plaquetas")}
                    onSelecionar={responderFaixa("plaquetas", respostas.plaquetas, () => setPlateletsLowest(""))}
                    onConcluir={() => avancar("plaquetas")}
                    valor={{ texto: formatarContagem(plateletsLowest), onChange: (t) => setPlateletsLowest(somenteDigitos(t)), unidade: "/mm³", inputMode: "numeric", placeholder: "Ex: 150.000", foraDaFaixa: fora(PLAQUETAS, contagemParaMil(plateletsLowest)) }}
                  />
                  <FaixaSelector
                    titulo="pH — mais baixo"
                    faixas={PH.faixas}
                    selecionada={respostas.ph}
                    pendente={pend(respostas.ph)}
                    aberto={itemAberto === "ph"}
                    onAlternar={() => alternar("ph")}
                    onSelecionar={responderFaixa("ph", respostas.ph, () => setPhLowest(""))}
                    onConcluir={() => avancar("ph")}
                    valor={{ texto: phLowest, onChange: setPhLowest, inputMode: "decimal", placeholder: "Ex: 7,32", foraDaFaixa: fora(PH, lerNumero(phLowest)) }}
                  />
                  <FaixaSelector
                    titulo="Oxigenação e ventilação"
                    dica={emVentilacao(oxigenacao) ? "Com VM: digite a PaO₂/FiO₂ se tiver a gasometria." : "Sem VM vale a PaO₂; com VM, a relação PaO₂/FiO₂."}
                    faixas={OXIGENACAO.faixas}
                    selecionada={respostas.oxigenacao}
                    pendente={pend(respostas.oxigenacao)}
                    aberto={itemAberto === "oxigenacao"}
                    onAlternar={() => alternar("oxigenacao")}
                    onConcluir={() => avancar("oxigenacao")}
                    onSelecionar={(id) => {
                      if (id === respostas.oxigenacao) return;
                      setPao2Fio2("");
                      setOxigenacao(id);
                      // Com VM o médico pode querer digitar a P/F: mantém aberto.
                      if (!emVentilacao(id)) avancar("oxigenacao", { oxigenacao: id });
                    }}
                    valor={emVentilacao(oxigenacao)
                      ? { texto: pao2Fio2, onChange: (t) => setPao2Fio2(somenteDigitos(t)), unidade: "P/F", inputMode: "numeric", placeholder: "Ex: 180", foraDaFaixa: fora(OXIGENACAO, lerNumero(pao2Fio2)) }
                      : undefined}
                    vertical
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ── Checklist de validação em tempo real ── */}
          <Card className={missingFields.length === 0
            ? "border-released-border bg-released-soft/60"
            : "border-warning-border bg-warning-soft/60"}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                  {missingFields.length === 0 ? (
                    <><CheckCircle2 className="h-4 w-4 text-released-on-soft" /><span className="text-released-on-soft">Pronto para validar — todos os itens preenchidos</span></>
                  ) : (
                    <><AlertTriangle className="h-4 w-4 text-warning-on-soft" /><span className="text-warning-on-soft">Faltam {missingFields.length} item(s) para validar</span></>
                  )}
                </p>
                <span className="text-xs text-muted-foreground">A "Pré-admitir com SAPS pendente" exige apenas nome + leito.</span>
              </div>
              {missingFields.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {missingFields.map(f => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => { if (f.chave) abrirItem(f.chave); window.setTimeout(() => focusAnchor(f.anchor), 60); }}
                        className="w-full text-left flex items-start gap-2 rounded-md border border-warning-border bg-card px-3 py-2 hover:bg-warning-soft transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5 text-warning-on-soft mt-1 shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-medium text-warning-on-soft">{f.label}</span>
                          {f.hint && <span className="block text-xs text-warning-on-soft">{f.hint}</span>}
                        </span>
                        <span className="text-xs font-medium text-warning-on-soft shrink-0">Ir →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex gap-3 justify-end flex-wrap">
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={saving || (!completingSapsId && !embedded && !selectedBed)}
              className="gap-2 border-warning-border text-warning-on-soft hover:bg-warning-soft"
            >
              <Clock className="h-4 w-4" />
              {saving
                ? (completingSapsId ? "Salvando..." : "Pré-admitindo...")
                : (completingSapsId ? "Manter como pendente" : "Pré-admitir com SAPS pendente")}
            </Button>
            <Button onClick={() => handleSave(false)} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving
                ? (completingSapsId ? "Validando..." : "Pré-admitindo...")
                : (completingSapsId ? "Validar ficha SAPS" : `Pré-admitir no ${selectedBed || "leito"}`)}
            </Button>
          </div>
          <div className={`${completingSapsId ? "bg-released-soft border-released-border text-released-on-soft" : "bg-warning-soft border-warning-border text-warning-on-soft"} border rounded-lg p-3 text-sm`}>
            <p className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {completingSapsId ? "Validação atualiza a ficha e libera o gate clínico" : "Exames laboratoriais ainda pendentes?"}
            </p>
            <p className={`text-xs mt-1 ${completingSapsId ? "text-released-on-soft" : "text-warning-on-soft"}`}>
              {completingSapsId
                ? "Ao validar, o cálculo SAPS 3 é recalculado com os valores atuais, a flag de pendência é removida do paciente e você é redirecionado para o painel clínico do leito correspondente para seguir com HDA, exame físico e plano."
                : "Utilize \"Pré-admitir com SAPS pendente\" para alocar o paciente no leito agora e completar a ficha SAPS 3 quando os resultados de gasometria, hemograma, função renal e demais exames admissionais estiverem disponíveis. Um cronômetro será ativado para rastrear o tempo de pendência."}
            </p>
          </div>
        </div>
      )}

      {/* ─── Pending SAPS ─── */}
      {!embedded && !isFormMode && records.some(r => r.status === 'pending') && (
        <Card className="border-warning-border bg-warning-soft/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-warning-on-soft">
              <Clock className="h-5 w-5 animate-pulse" />
              SAPS 3 Pendentes — Aguardando Exames Laboratoriais
              <Badge variant="destructive" className="ml-1">
                {records.filter(r => r.status === 'pending').length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {records.filter(r => r.status === 'pending').map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-warning-border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{r.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Admitido: {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SapsPendingTimer pendingSince={r.pending_since} />
                    <Button 
                      size="sm" 
                      className="gap-2"
                      onClick={() => navigate(`/saps3?completeSapsId=${r.id}&patientName=${encodeURIComponent(r.patient_name)}`)}
                    >
                      <ClipboardList className="h-3.5 w-3.5" /> Completar SAPS
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} className="text-destructive/60 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── History ─── */}
      {!embedded && !isFormMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" /> Admissões Realizadas (SAPS 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.filter(r => r.status !== 'pending').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma admissão com SAPS 3 completada.
              </p>
            ) : (
              <div className="space-y-2">
                {records.filter(r => r.status !== 'pending').map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{r.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-primary">{r.total_score ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                      <div className="text-right">
                        <Badge className={getMortalityBadge(r.predicted_mortality ?? 0)}>
                          {r.predicted_mortality != null ? `${r.predicted_mortality}%` : "—"}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Mortalidade</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} className="text-destructive/60 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      {!embedded && (
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro SAPS 3?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
    </div>
  );
}

// Timer component for pending SAPS
function SapsPendingTimer({ pendingSince }: { pendingSince: string | null }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!pendingSince) return;
    const update = () => {
      const diff = Date.now() - new Date(pendingSince).getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pendingSince]);

  if (!pendingSince) return null;

  return (
    <div className="flex items-center gap-2 bg-warning-soft text-warning-on-soft px-3 py-1 rounded-md border border-warning-border">
      <Clock className="h-3.5 w-3.5 animate-pulse" />
      <span className="font-mono font-semibold text-sm">{elapsed}</span>
    </div>
  );
}

export { SapsPendingTimer };
