import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PlatformHeader } from "@/components/layout/PlatformHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toSexoDb } from "@/lib/sexo";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useMedicalRecordMode } from "@/hooks/useMedicalRecordMode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  UserPlus,
  FileText,
  Play,
  ArrowRight,
  ClipboardList,
  User,
  Calendar,
  AlertTriangle,
  Hash,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Clock,
  UserX,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { MedicalRecordsList } from "@/components/MedicalRecordsList";
import { ReceptionDailyDashboard } from "@/components/reception/ReceptionDailyDashboard";
import { DuplicatePatientWarning } from "@/components/reception/DuplicatePatientWarning";
import { ReceptionGlobalSearch } from "@/components/reception/ReceptionGlobalSearch";
import { TriageExpressDialog, type TriageExpressPayload } from "@/components/reception/TriageExpressDialog";
import { useReceptionPost } from "@/hooks/useReceptionPost";

// Destination sectors for encounter routing — agrupados por categoria
type DestinationSector = {
  value: string;
  label: string;
  group: string;
  color: string;
  // sectorKey: chave do SectorType usada em PreAdmissionSection (Index.tsx)
  // Quando definida, gera também uma pre_admissions com destination_sector=label
  // para que o paciente apareça em "Aguardando Admissão" do setor clínico.
  sectorKey?: string;
  /**
   * true = não oferecido como NOVO destino na recepção; entrada mantida só
   * para resolver encaminhamentos legados. Aqui apenas riv (fora do escopo de
   * internação) e ue_horizontal (agrupamento — o destino é Sala Vermelha,
   * Sala Laranja ou Posto de Internação), alem de UE Vertical e Observação
   * Clínica, que ficaram fora do escopo de internação.
   */
  legacyOnly?: boolean;
};

const DESTINATION_SECTORS: DestinationSector[] = [
  // A triagem foi removida: a plataforma cobre internacao, e o primeiro
  // atendimento fica fora do sistema. O paciente e encaminhado direto ao setor
  // de internacao de destino.
  // Urgência e Emergência (admissão direta sem leito clínico fixo)
  { value: "sala_vermelha", label: "Sala Vermelha", group: "Urgência e Emergência (Horizontal)", color: "bg-red-700", sectorKey: "sala_vermelha" },
  { value: "sala_laranja", label: "Sala Laranja", group: "Urgência e Emergência (Horizontal)", color: "bg-orange-500", sectorKey: "sala_laranja" },
  { value: "ue_vertical", label: "UE Vertical", group: "Legado", color: "bg-purple-500", sectorKey: "ue_vertical", legacyOnly: true },
  { value: "ue_horizontal", label: "UE Horizontal", group: "Legado", color: "bg-indigo-500", sectorKey: "ue_horizontal", legacyOnly: true },
  { value: "observacao_clinica", label: "Observação Clínica", group: "Legado", color: "bg-sky-500", sectorKey: "observacao_clinica", legacyOnly: true },
  { value: "internacao_ue", label: "Posto de Internação", group: "Urgência e Emergência (Horizontal)", color: "bg-indigo-600", sectorKey: "internacao_ue" },
  // UTI/UCI num bloco so, como no menu de setores
  { value: "red", label: "UTI 1", group: "UTI/UCI", color: "bg-red-500", sectorKey: "red" },
  { value: "yellow", label: "UTI 2", group: "UTI/UCI", color: "bg-yellow-500", sectorKey: "yellow" },
  { value: "blue", label: "UCI 1", group: "UTI/UCI", color: "bg-blue-500", sectorKey: "blue" },
  { value: "outside", label: "UCI 2", group: "UTI/UCI", color: "bg-emerald-500", sectorKey: "outside" },
  // Enfermarias — inclui a UCC (Unidade de Cuidados CLÍNICOS): bloco de
  // enfermarias por definição institucional (Direção Clínica, 19/08/2026).
  { value: "ucc", label: "UCC — Unidade Cuidados Clínicos", group: "Enfermarias", color: "bg-violet-500", sectorKey: "ucc" },
  { value: "neuro_01", label: "Enfermaria Neuro 01", group: "Enfermarias", color: "bg-cyan-500", sectorKey: "neuro_01" },
  { value: "neuro_02", label: "Enfermaria Neuro 02", group: "Enfermarias", color: "bg-cyan-600", sectorKey: "neuro_02" },
  { value: "clinica_cirurgica", label: "Clínica Cirúrgica", group: "Enfermarias", color: "bg-teal-500", sectorKey: "clinica_cirurgica" },
  { value: "enfermaria_transicao", label: "Enfermaria de Transição", group: "Enfermarias", color: "bg-amber-500", sectorKey: "enfermaria_transicao" },
  { value: "enfermaria_vascular", label: "Enfermaria Vascular", group: "Enfermarias", color: "bg-pink-500", sectorKey: "enfermaria_vascular" },
  // Centro Cirúrgico
  { value: "cc_preparo", label: "CC — Preparo", group: "Centro Cirúrgico", color: "bg-slate-500", sectorKey: "cc_preparo" },
  { value: "cc_bloco", label: "CC — Bloco Cirúrgico", group: "Centro Cirúrgico", color: "bg-slate-600", sectorKey: "cc_bloco" },
  { value: "cc_rpa", label: "CC — RPA", group: "Centro Cirúrgico", color: "bg-slate-700", sectorKey: "cc_rpa" },
  // RIV: fora do escopo de internação — mantido só para dado legado.
  { value: "riv", label: "RIV — Ref. Internação Vascular", group: "Centro Cirúrgico", color: "bg-rose-500", sectorKey: "riv", legacyOnly: true },
];

// Mapa sectorKey → título EXATO usado no mapa de leitos (Index.tsx SECTOR_VISUAL.title).
// Necessário porque o PreAdmissionSection filtra por destination_sector === título do setor;
// se gravarmos a label longa da recepção, o paciente nunca aparece em "Aguardando Admissão".
const SECTOR_KEY_TO_MAP_TITLE: Record<string, string> = {
  red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2", ucc: "UCC",
  neuro_01: "Neuro 01", neuro_02: "Neuro 02",
  clinica_cirurgica: "Clínica Cirúrgica",
  enfermaria_transicao: "Enf. Transição",
  enfermaria_vascular: "Enf. Vascular",
  sala_vermelha: "Sala Vermelha", sala_laranja: "Sala Laranja",
  observacao_clinica: "Obs. Clínica",
  internacao_ue: "Posto de Internação",
  ue_vertical: "UE Vertical", ue_horizontal: "UE Horizontal",
  riv: "RIV",
  cc_preparo: "CC Preparo", cc_bloco: "CC Bloco Cirúrgico", cc_rpa: "CC RPA",
};

const DESTINATION_GROUPS = Array.from(new Set(DESTINATION_SECTORS.filter(s => !s.legacyOnly).map(s => s.group)));

interface PatientRegistry {
  id: string;
  medical_record: string;
  full_name: string;
  social_name?: string;
  cpf?: string;
  cns?: string;
  birth_date?: string;
  sex?: string;
  mother_name?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  blood_type?: string;
  allergies?: string;
  comorbidities?: string;
  created_at: string;
}

interface Encounter {
  id: string;
  encounter_code: string;
  patient_name: string;
  registry_id?: string;
  destination_sector?: string;
  triage_status?: string;
  status: string;
  created_at: string;
}

// MIGRAÇÃO: patient_registry→pacientes. Mapeia colunas pt-BR para PatientRegistry.
// Sem coluna no schema novo (degradados): neighborhood/city (pacientes.endereco é
// campo único).
const mapPaciente = (p: any): PatientRegistry => ({
  id: p.id,
  medical_record: p.prontuario ?? "",
  full_name: p.nome_completo ?? "",
  social_name: p.nome_social ?? undefined,
  cpf: p.cpf ?? undefined,
  cns: p.cns ?? undefined,
  birth_date: p.data_nascimento ?? undefined,
  sex: p.sexo ?? undefined,
  mother_name: p.nome_mae ?? undefined,
  phone: p.telefone ?? undefined,
  address: p.endereco ?? undefined,
  neighborhood: undefined,
  city: undefined,
  blood_type: p.tipo_sanguineo ?? undefined,
  allergies: p.alergias ?? undefined,
  comorbidities: p.comorbidades ?? undefined,
  created_at: p.criado_em,
});

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const selectedHospitalId = currentHospital?.id;
  const { currentDepartment } = useDepartment();
  const { point: receptionPoint } = useReceptionPost();
  const { mode: mrMode } = useMedicalRecordMode(selectedHospitalId);

  // Tab state synced with URL (?tab=inicio|dia|aguardando|prontuarios) — sincroniza com sidebar
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const validTabs = ["inicio", "dia", "aguardando", "prontuarios"] as const;
  const activeTab = (validTabs as readonly string[]).includes(tabParam || "")
    ? (tabParam as (typeof validTabs)[number])
    : "inicio";
  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  /*
    Compatibilidade com os links antigos do menu lateral: ?tab=dia e
    ?tab=aguardando eram abas proprias e agora sao sub-abas do painel.
    Em vez de quebrar o link, resolve-se para o painel com a sub-aba certa.
  */
  const LEGACY_SUBTABS = ["dia", "aguardando", "minhas", "equipe"] as const;
  const legacySubTab = (LEGACY_SUBTABS as readonly string[]).includes(activeTab)
    ? (activeTab as (typeof LEGACY_SUBTABS)[number])
    : "dia";
  const effectiveTab = (LEGACY_SUBTABS as readonly string[]).includes(activeTab)
    ? "inicio"
    : activeTab;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientRegistry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Registration dialog
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: "",
    social_name: "",
    cpf: "",
    cns: "",
    medical_record: "",
    birth_date: "",
    sex: "",
    mother_name: "",
    phone: "",
    address: "",
    neighborhood: "",
    city: "",
    blood_type: "",
    allergies: "",
    comorbidities: "",
    is_unidentified: false,
    ni_estimated_age: "",
    ni_apparent_sex: "",
    ni_skin_color: "",
    ni_distinctive_marks: "",
    ni_arrival_circumstance: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);
  // Alta confiança de duplicata: nome + data de nascimento coincidem com registro existente.
  // Bloqueia o cadastro até o usuário decidir explicitamente (usar existente ou confirmar diferente).
  const [isHighConfidenceDuplicate, setIsHighConfidenceDuplicate] = useState(false);

  const toggleUnidentified = (checked: boolean) => {
    setRegisterForm(prev => ({
      ...prev,
      is_unidentified: checked,
      // Limpa campos sensíveis quando ativa NI
      full_name: checked ? "" : prev.full_name,
      social_name: checked ? "" : prev.social_name,
      mother_name: checked ? "" : prev.mother_name,
      cpf: checked ? "" : prev.cpf,
      cns: checked ? "" : prev.cns,
      birth_date: checked ? "" : prev.birth_date,
      sex: checked ? "I" : prev.sex,
      phone: checked ? "" : prev.phone,
      address: checked ? "" : prev.address,
      neighborhood: checked ? "" : prev.neighborhood,
      city: checked ? "" : prev.city,
    }));
  };

  // Selected patient & encounter
  const [selectedPatient, setSelectedPatient] = useState<PatientRegistry | null>(null);
  const [showPatientDetail, setShowPatientDetail] = useState(false);
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const [destinationSector, setDestinationSector] = useState("");
  const [isCreatingEncounter, setIsCreatingEncounter] = useState(false);

  // Recent encounters
  const [recentEncounters, setRecentEncounters] = useState<Encounter[]>([]);
  const [isLoadingEncounters, setIsLoadingEncounters] = useState(false);

  // Busca global Ctrl+K
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  // Cadastro Express (paciente sem identificacao) dialog
  const [showTriageExpress, setShowTriageExpress] = useState(false);

  // Load recent encounters
  useEffect(() => {
    if (selectedHospitalId) {
      loadRecentEncounters();
    }
  }, [selectedHospitalId]);

  // Atalho global Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setGlobalSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadRecentEncounters = async () => {
    if (!selectedHospitalId) return;
    setIsLoadingEncounters(true);
    try {
      // MIGRAÇÃO: patient_encounters→internacoes. Sem encounter_code/registry_id/
      // triage_status/hospital_unit_id no schema novo → degradados. encounter_code
      // usa um id curto; destino via setores.tipo (setor_classificacao_id).
      const { data, error } = await supabase
        .from("internacoes")
        .select(`id, status, criado_em, paciente_id,
          paciente:pacientes(nome_completo, nome_social),
          setor:setores(tipo)`)
        .order("criado_em", { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentEncounters(
        (data as any[] || []).map((r: any) => ({
          id: r.id,
          encounter_code: String(r.id).slice(0, 8),
          patient_name: r.paciente?.nome_social || r.paciente?.nome_completo || "",
          registry_id: r.paciente_id,
          destination_sector: r.setor?.tipo || undefined,
          triage_status: undefined,
          status: r.status,
          created_at: r.criado_em,
        }))
      );
    } catch (err) {
      console.error("Error loading encounters:", err);
    } finally {
      setIsLoadingEncounters(false);
    }
  };

  // Search patients
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      // MIGRAÇÃO: patient_registry→pacientes (full_name→nome_completo,
      // medical_record→prontuario).
      const query = searchQuery.trim().toLowerCase();
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .or(`nome_completo.ilike.%${query}%,cpf.ilike.%${query}%,cns.ilike.%${query}%,prontuario.ilike.%${query}%`)
        .order("nome_completo")
        .limit(20);

      if (error) throw error;
      setSearchResults((data || []).map(mapPaciente));
    } catch (err) {
      console.error("Error searching:", err);
      toast.error("Erro ao buscar pacientes");
    } finally {
      setIsSearching(false);
    }
  };

  // Register new patient
  const handleRegister = async () => {
    if (!selectedHospitalId) {
      toast.error("Unidade hospitalar não selecionada");
      return;
    }

    if (!registerForm.is_unidentified && !registerForm.full_name.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }

    // Bloqueia quando nome + data de nascimento coincidem com registro existente.
    // O usuário deve decidir: usar o paciente existente ou confirmar que são pessoas diferentes.
    if (isHighConfidenceDuplicate && !registerForm.is_unidentified) {
      toast.error("Cadastro bloqueado — paciente já existe", {
        description: "Use o paciente existente para novo atendimento, ou confirme que são pessoas diferentes.",
        duration: 6000,
      });
      return;
    }

    // Modo legacy: prontuário do sistema antigo é obrigatório
    if (mrMode === "legacy" && !registerForm.is_unidentified && !registerForm.medical_record.trim()) {
      toast.error("Prontuário obrigatório", {
        description: "Unidade em modo legado: informe o número do sistema antigo.",
      });
      return;
    }

    setIsRegistering(true);
    try {
      // MIGRAÇÃO: patient_registry→pacientes. Colunas sem equivalente (degradadas):
      // neighborhood/city (endereco é campo único), is_unidentified/unidentified_code/
      // unidentified_features (bloco NI), created_by, hospital_unit_id, state_id.
      let niCode: string | null = null;
      let finalName = registerForm.full_name.trim().toUpperCase();

      if (registerForm.is_unidentified) {
        // MIGRAÇÃO: RPC generate_ni_code pode não existir no backend novo → fallback local.
        try {
          const { data: ni, error: niErr } = await (supabase.rpc as any)("generate_ni_code");
          if (niErr) throw niErr;
          niCode = ni as string;
        } catch {
          niCode = `NI-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        }
        finalName = `NÃO IDENTIFICADO (${niCode})`;
      }

      // MIGRAÇÃO: pacientes.prontuario é NOT NULL e a geração oficial
      // (generate_medical_record_number + hospital_units.unit_code) não existe no
      // schema novo → usa o número informado ou um fallback local (degradado).
      const manualMr = registerForm.medical_record.trim() || null;
      const prontuario = manualMr || niCode || `PR-${Date.now()}`;

      const insertPayload: any = {
        nome_completo: finalName,
        nome_social: registerForm.social_name.trim() || null,
        cpf: registerForm.cpf.replace(/\D/g, "") || null,
        cns: registerForm.cns.replace(/\D/g, "") || null,
        data_nascimento: registerForm.birth_date || null,
        sexo: toSexoDb(registerForm.sex),
        nome_mae: registerForm.mother_name.trim() || null,
        telefone: registerForm.phone.trim() || null,
        endereco: registerForm.address.trim() || null,
        tipo_sanguineo: registerForm.blood_type || null,
        alergias: registerForm.allergies.trim() || null,
        comorbidades: registerForm.comorbidities.trim() || null,
        prontuario,
      };

      const { data, error } = await supabase
        .from("pacientes")
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        if (error.message.includes("duplicate key") && error.message.includes("cpf")) {
          toast.error("CPF já cadastrado no sistema");
        } else {
          throw error;
        }
        return;
      }

      // MIGRAÇÃO: geração de prontuário oficial (RPC generate_medical_record_number
      // + hospital_units.unit_code) DEGRADADA — sem RPC/coluna no schema novo. O
      // número usado é o definido no insert (informado ou fallback local).
      const officialMr: string = (data as any).prontuario;

      toast.success(
        registerForm.is_unidentified ? "Paciente NÃO IDENTIFICADO cadastrado!" : "Prontuário criado com sucesso!",
        { description: `Nº ${officialMr}${niCode ? ` • ${niCode}` : ""}` }
      );
      setShowRegisterDialog(false);
      setRegisterForm({
        full_name: "", social_name: "", cpf: "", cns: "", medical_record: "", birth_date: "",
        sex: "", mother_name: "", phone: "", address: "", neighborhood: "",
        city: "", blood_type: "", allergies: "", comorbidities: "",
        is_unidentified: false, ni_estimated_age: "", ni_apparent_sex: "",
        ni_skin_color: "", ni_distinctive_marks: "", ni_arrival_circumstance: "",
      });
      setSelectedPatient(mapPaciente(data));
      setShowPatientDetail(true);
    } catch (err: any) {
      console.error("Error registering:", err);
      toast.error("Erro ao cadastrar paciente");
    } finally {
      setIsRegistering(false);
    }
  };

  // Create new encounter — opcionalmente cria pré-admissão no setor clínico de destino
  const handleCreateEncounter = async () => {
    if (!selectedPatient || !destinationSector) {
      toast.error("Selecione o setor de destino");
      return;
    }
    if (!selectedHospitalId) return;

    const sectorDef = DESTINATION_SECTORS.find(s => s.value === destinationSector);
    if (!sectorDef) {
      toast.error("Setor de destino inválido");
      return;
    }

    setIsCreatingEncounter(true);
    try {
      // MIGRAÇÃO: patient_encounters/medical_records não existem no schema novo e
      // internacoes exige um leito (que a recepção ainda não atribuiu). O
      // "atendimento" da recepção passa a ser modelado apenas como pré-admissão
      // (pre_admissions→pre_admissoes) aguardando leito. DEGRADADO: o guard
      // anti-duplicação por encounter aberto, a geração de encounter_code
      // (generate_encounter_code_v2 + medical_records) e as colunas denormalizadas
      // de pre_admissoes (social_name, mother_name, sex, medical_record, phone,
      // patient_registry_id, destination_sector-título, hospital_unit_id, state_id,
      // department, created_by, notes) — sem equivalente — foram removidos. O destino
      // vira setor_destino_id (UUID) resolvido por setores.tipo.
      let setorDestinoId: string | null = null;
      if (sectorDef.sectorKey) {
        const { data: setor } = await supabase
          .from("setores").select("id").eq("tipo", sectorDef.sectorKey).limit(1).maybeSingle();
        setorDestinoId = (setor as any)?.id ?? null;
      }

      const { error: paErr } = await supabase
        .from("pre_admissoes")
        .insert({
          nome_paciente: selectedPatient.full_name,
          cpf: selectedPatient.cpf || null,
          cns: selectedPatient.cns || null,
          data_nascimento: selectedPatient.birth_date || null,
          setor_destino_id: setorDestinoId,
          status: "classificado",
        } as any);
      if (paErr) throw paErr;

      toast.success("Encaminhamento registrado!", {
        description: `${selectedPatient.full_name} → ${sectorDef.label}`,
      });
      setShowNewEncounter(false);
      setDestinationSector("");
      loadRecentEncounters();
    } catch (err: any) {
      console.error("Error creating encounter:", err);
      toast.error("Erro ao criar atendimento", { description: err?.message });
    } finally {
      setIsCreatingEncounter(false);
    }
  };

  // ── Cadastro Express: coleta dados parciais do paciente sem identificacao ──
  const openTriageExpress = () => {
    if (!selectedHospitalId) {
      toast.error("Unidade hospitalar não selecionada");
      return;
    }
    setShowTriageExpress(true);
  };

  // Recebe payload do dialog e cria registry parcial + atendimento direcionado
  const handleTriageExpressConfirm = async (payload: TriageExpressPayload) => {
    if (!selectedHospitalId) return;
    setIsCreatingEncounter(true);
    try {
      const stateId = localStorage.getItem("selected_state_id");
      const sectorDef = DESTINATION_SECTORS.find((s) => s.value === payload.destinationValue);
      if (!sectorDef) {
        toast.error("Setor de destino inválido");
        return;
      }

      // Flag explícita "Não identificado" tem prioridade sobre o nome
      const forcedNI = payload.isUnidentified === true;
      const hasName = !forcedNI && payload.partialName.length > 0;
      const isPartial =
        !forcedNI && (!hasName || payload.partialName.split(/\s+/).filter(Boolean).length < 2);

      // 1) Gera NI code se: marcou NI explicitamente OU não digitou nome
      // MIGRAÇÃO: RPC generate_ni_code pode não existir no backend novo → fallback local.
      let niCode: string | null = null;
      if (forcedNI || !hasName) {
        try {
          const { data: code, error: niErr } = await (supabase.rpc as any)("generate_ni_code");
          if (niErr) throw niErr;
          niCode = code as string;
        } catch {
          niCode = `NI-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        }
      }

      const finalName = hasName
        ? payload.partialName
        : `NÃO IDENTIFICADO (${niCode})`;

      // 2) Cria o paciente (patient_registry→pacientes). DEGRADADO: is_unidentified,
      //    unidentified_code/features, notes, created_by, hospital_unit_id, state_id
      //    sem coluna no schema novo. prontuario é NOT NULL → fallback local (a RPC
      //    generate_medical_record_number + hospital_units.unit_code não existem).
      const prontuario = niCode || `PR-${Date.now()}`;
      const { data: registry, error: regErr } = await supabase
        .from("pacientes")
        .insert({
          nome_completo: finalName,
          sexo: toSexoDb(payload.sex),
          telefone: payload.contactPhone || null,
          data_nascimento: payload.birthDate || null,
          prontuario,
        } as any)
        .select()
        .single();
      if (regErr) throw regErr;

      // 3) Cria pré-admissão no setor de destino (pre_admissions→pre_admissoes).
      //    DEGRADADO: patient_encounters/medical_records/encounter_code não existem
      //    no schema novo — o encaminhamento é apenas a pré-admissão. Colunas
      //    denormalizadas (patient_age/sex, phone, patient_registry_id, notes,
      //    destination_sector-título, hospital_unit_id/state_id/department/created_by)
      //    sem equivalente. Destino vira setor_destino_id (UUID) via setores.tipo.
      let setorDestinoId: string | null = null;
      if (sectorDef.sectorKey) {
        const { data: setor } = await supabase
          .from("setores").select("id").eq("tipo", sectorDef.sectorKey).limit(1).maybeSingle();
        setorDestinoId = (setor as any)?.id ?? null;
      }
      const { error: paErr } = await supabase
        .from("pre_admissoes")
        .insert({
          nome_paciente: finalName,
          data_nascimento: payload.birthDate || null,
          setor_destino_id: setorDestinoId,
          status: "classificado",
        } as any);
      if (paErr) console.warn("Pre-admissão falhou:", paErr);

      toast.success("Cadastro Express criado!", {
        description: `${niCode || "Identificado"} • ${finalName} → ${sectorDef.label}`,
      });
      setShowTriageExpress(false);
      loadRecentEncounters();
    } catch (err: any) {
      console.error("Erro Cadastro Express:", err);
      toast.error("Falha no Cadastro Express", { description: err?.message });
    } finally {
      setIsCreatingEncounter(false);
    }
  };

  // Pega paciente do dashboard daily (por registry_id) para reatender
  const handlePickRegistryFromDashboard = async (registryId: string, _patientName: string) => {
    try {
      // MIGRAÇÃO: patient_registry→pacientes.
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", registryId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSelectedPatient(mapPaciente(data));
        setShowNewEncounter(true);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar paciente", { description: err?.message });
    }
  };


  const getSectorBadge = (sector?: string) => {
    const s = DESTINATION_SECTORS.find(d => d.value === sector);
    if (!s) return null;
    return (
      <Badge className={cn("text-white text-xs", s.color)}>
        {s.label}
      </Badge>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <PlatformHeader
          variant="institutional"
          eyebrow="Internação · Registro de Entrada"
          title="Administrativo"
          icon={ClipboardList}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGlobalSearchOpen(true)}
                className="gap-2 text-xs h-9 bg-white/95 text-foreground border-border hover:bg-white hover:text-foreground dark:bg-background dark:text-foreground"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Buscar paciente / atendimento</span>
                <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
                  <span className="text-[10px]">⌘</span>K
                </kbd>
              </Button>
              <Badge variant="secondary" className="text-xs bg-white/15 text-primary-foreground border-white/20">
                {recentEncounters.filter(e => e.status === "active").length} ativos
              </Badge>
            </>
          }
        />

        {/* Main content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* HERO superior — ações primárias e consulta de prontuário (sempre visível, acima das tabs) */}
            <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-rose-500/5 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-stretch">
                  {/* Novo Cadastro Completo — prevalente (col-span-2) */}
                  <Button
                    onClick={() => setShowRegisterDialog(true)}
                    className="sm:col-span-2 h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold"
                  >
                    <UserPlus className="h-4 w-4" />
                    Novo Cadastro Completo
                    <span className="hidden md:inline text-[11px] opacity-80 font-normal ml-1">· prontuário + dados completos</span>
                  </Button>
                  {/* Cadastro Express — paciente sem identificação (NI) */}
                  <Button
                    variant="outline"
                    onClick={openTriageExpress}
                    className="h-12 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 font-medium"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Cadastro Express
                  </Button>
                </div>

                <div className="flex gap-2 items-center">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Consultar prontuário — nome, CPF, CNS ou nº..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1 h-9 bg-background"
                  />
                  <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} size="sm" className="h-9">
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-1 hidden sm:inline">Buscar</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs value={effectiveTab} onValueChange={handleTabChange} className="w-full">
              {/*
                UM nivel de abas.

                Havia dois: "Atendimentos do Dia" e "Aguardando Admissao" aqui
                em cima renderizavam o MESMO ReceptionDailyDashboard, mudando
                so a sub-aba inicial — e o componente exibe as proprias abas
                com os mesmos rotulos. O usuario via "Aguardando Admissao"
                duas vezes na tela e nao sabia qual clicar.

                Agora o topo separa o que e de fato diferente: o PAINEL do dia
                e a BUSCA de prontuarios. A navegacao dentro do painel fica com
                o painel. Os links antigos (?tab=dia, ?tab=aguardando) seguem
                funcionando — ver handleTabChange.
              */}
              <TabsList className="mb-4">
                <TabsTrigger value="inicio" className="gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Painel do Dia
                </TabsTrigger>
                <TabsTrigger value="prontuarios" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Prontuários
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inicio" className="space-y-6 mt-0">

            {/* Painel diário da recepção (KPIs + sub-tabs) */}
            <ReceptionDailyDashboard
              onPickRegistry={handlePickRegistryFromDashboard}
              onTriageExpress={openTriageExpress}
              onNewRegistration={() => setShowRegisterDialog(true)}
              defaultSubTab={legacySubTab}
              hideQuickActions
            />

            {/* Resultados da busca (compacto) */}
            <AnimatePresence>
              {hasSearched && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-primary" />
                        Resultados da busca
                        <Badge variant="secondary" className="text-[10px]">{searchResults.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {searchResults.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <XCircle className="h-7 w-7 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">Nenhum prontuário encontrado</p>
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-1"
                            onClick={() => {
                              setRegisterForm(prev => ({ ...prev, full_name: searchQuery.trim() }));
                              setShowRegisterDialog(true);
                            }}
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            Cadastrar novo paciente
                          </Button>
                        </div>
                      ) : (
                        <ScrollArea className="max-h-[320px]">
                          <div className="space-y-2">
                            {searchResults.map((patient) => (
                              <div
                                key={patient.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                                onClick={() => { setSelectedPatient(patient); setShowPatientDetail(true); }}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <User className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{patient.full_name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{patient.medical_record}</span>
                                      {patient.cpf && <span>CPF: {patient.cpf}</span>}
                                      {patient.birth_date && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {format(new Date(patient.birth_date + 'T00:00:00'), "dd/MM/yyyy")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); setShowNewEncounter(true); }}>
                                    <Play className="h-3 w-3 mr-1" />Novo Atendimento
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); setShowPatientDetail(true); }}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {selectedPatient && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Paciente selecionado</p>
                    <p className="text-sm font-semibold truncate">{selectedPatient.full_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedPatient.medical_record}</p>
                  </div>
                  <Button size="sm" onClick={() => setShowNewEncounter(true)}>
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Iniciar Atendimento
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Recent Encounters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Atendimentos Recentes
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadRecentEncounters}>
                    <Loader2 className={cn("h-3 w-3", isLoadingEncounters && "animate-spin")} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentEncounters.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum atendimento registrado</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {recentEncounters.map((enc) => (
                        <div
                          key={enc.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{enc.patient_name}</p>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {enc.encounter_code}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>{format(new Date(enc.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {getSectorBadge(enc.destination_sector)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
              </TabsContent>



              <TabsContent value="prontuarios" className="mt-0 space-y-2">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/mesclar-prontuarios">Mesclar prontuários duplicados</a>
                  </Button>
                </div>
                <MedicalRecordsList
                  onStartEncounter={(p) => {
                    setSelectedPatient(p as any);
                    setShowNewEncounter(true);
                  }}
                  onViewPatient={(p) => {
                    setSelectedPatient(p as any);
                    setShowPatientDetail(true);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Registration Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={(v) => { setShowRegisterDialog(v); if (!v) setIsHighConfidenceDuplicate(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Novo Prontuário
            </DialogTitle>
            <DialogDescription>
              Cadastre um novo paciente no sistema. O número do prontuário será gerado automaticamente.
            </DialogDescription>
          </DialogHeader>

          {/* Detecção de duplicatas em tempo real (só quando NÃO é NI) */}
          {!registerForm.is_unidentified && (
            <DuplicatePatientWarning
              fullName={registerForm.full_name}
              birthDate={registerForm.birth_date}
              cpf={registerForm.cpf}
              onHighConfidenceFound={setIsHighConfidenceDuplicate}
              onUseExisting={(p) => {
                setIsHighConfidenceDuplicate(false);
                setShowRegisterDialog(false);
                setSelectedPatient(p as any);
                setShowPatientDetail(true);
                toast.info("Paciente existente selecionado", { description: p.full_name });
              }}
            />
          )}

          {/* Toggle Paciente Não Identificado — sempre visível no topo */}
          <Card className={cn(
            "border-2 transition-colors",
            registerForm.is_unidentified ? "border-amber-500 bg-amber-500/10" : "border-dashed border-muted"
          )}>
            <CardContent className="p-3 flex items-center gap-3">
              <Checkbox
                id="ni-toggle-recepcao"
                checked={registerForm.is_unidentified}
                onCheckedChange={(c) => toggleUnidentified(!!c)}
              />
              <label htmlFor="ni-toggle-recepcao" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <UserX className="h-4 w-4 text-amber-600" />
                  Paciente NÃO IDENTIFICADO
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Gera código padronizado (NI-AAAA-NNNNNN) e cadastra como
                  <span className="font-mono font-semibold"> &nbsp;NÃO IDENTIFICADO (NI-...) </span>
                  para evitar variações de digitação.
                </p>
              </label>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {registerForm.is_unidentified ? (
              <>
                <div className="md:col-span-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    O nome será cadastrado automaticamente como
                    <span className="font-mono font-semibold"> NÃO IDENTIFICADO (NI-AAAA-NNNNNN)</span>.
                    Preencha as características físicas para auxiliar a identificação posterior.
                  </div>
                </div>
                <div>
                  <Label>Idade estimada</Label>
                  <Input
                    placeholder="Ex.: 40-50 anos"
                    value={registerForm.ni_estimated_age}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, ni_estimated_age: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Sexo aparente</Label>
                  <Select
                    value={registerForm.ni_apparent_sex}
                    onValueChange={(v) => setRegisterForm(prev => ({ ...prev, ni_apparent_sex: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="indeterminado">Indeterminado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cor da pele</Label>
                  <Input
                    placeholder="Ex.: Parda, Negra, Branca"
                    value={registerForm.ni_skin_color}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, ni_skin_color: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Circunstância de chegada</Label>
                  <Input
                    placeholder="SAMU / Bombeiros / Trazido por terceiros..."
                    value={registerForm.ni_arrival_circumstance}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, ni_arrival_circumstance: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Sinais distintivos</Label>
                  <Input
                    placeholder="Tatuagens, cicatrizes, piercings, vestimenta..."
                    value={registerForm.ni_distinctive_marks}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, ni_distinctive_marks: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    placeholder="Nome completo do paciente"
                    value={registerForm.full_name}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, full_name: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <Label>Nome Social</Label>
                  <Input
                    placeholder="Nome social (se aplicável)"
                    value={registerForm.social_name}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, social_name: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={registerForm.cpf}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, cpf: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>CNS (Cartão SUS)</Label>
                  <Input
                    placeholder="Número do cartão SUS"
                    value={registerForm.cns}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, cns: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>
                    Prontuário {mrMode === "legacy" && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    placeholder={mrMode === "legacy" ? "Obrigatório — nº do sistema antigo" : "Auto: AA-UUU-SSSSSS-DV (deixe vazio para gerar)"}
                    value={registerForm.medical_record}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, medical_record: e.target.value }))}
                    className={cn(mrMode === "legacy" && !registerForm.medical_record.trim() && "border-amber-500/60")}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {mrMode === "legacy"
                      ? "⚠ Unidade em modo legado: informe o número do sistema antigo. Será preservado em numero_prontuario_legado."
                      : "Vazio → será gerado automaticamente no formato seguro."}
                  </p>
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={registerForm.birth_date}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, birth_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Sexo</Label>
                  <Select value={registerForm.sex} onValueChange={(v) => setRegisterForm(prev => ({ ...prev, sex: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="I">Indeterminado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome da Mãe</Label>
                  <Input
                    placeholder="Nome da mãe"
                    value={registerForm.mother_name}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, mother_name: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    placeholder="Rua, número"
                    value={registerForm.address}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, address: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    placeholder="Bairro"
                    value={registerForm.neighborhood}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, neighborhood: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    placeholder="Cidade"
                    value={registerForm.city}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, city: e.target.value.toUpperCase() }))}
                  />
                </div>
              </>
            )}

            {!registerForm.is_unidentified && (
              <>
                <Separator className="md:col-span-2" />

                <div>
                  <Label>Tipo Sanguíneo</Label>
                  <Select value={registerForm.blood_type} onValueChange={(v) => setRegisterForm(prev => ({ ...prev, blood_type: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bt => (
                        <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alergias</Label>
                  <Input
                    placeholder="Alergias conhecidas"
                    value={registerForm.allergies}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, allergies: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Comorbidades</Label>
                  <Input
                    placeholder="Comorbidades conhecidas"
                    value={registerForm.comorbidities}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, comorbidities: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegister}
              disabled={isRegistering || (!registerForm.is_unidentified && !registerForm.full_name.trim()) || isHighConfidenceDuplicate}
              className={cn(registerForm.is_unidentified && "bg-amber-600 hover:bg-amber-700 text-white")}
            >
              {isRegistering
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : registerForm.is_unidentified
                  ? <UserX className="h-4 w-4 mr-2" />
                  : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {registerForm.is_unidentified ? "Cadastrar Paciente NI" : "Criar Prontuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Patient Detail Dialog */}
      <Dialog open={showPatientDetail} onOpenChange={setShowPatientDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Prontuário do Paciente
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold">{selectedPatient.full_name}</p>
                  {selectedPatient.social_name && (
                    <p className="text-sm text-muted-foreground">Nome social: {selectedPatient.social_name}</p>
                  )}
                  <Badge variant="outline" className="font-mono mt-1">{selectedPatient.medical_record}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedPatient.cpf && (
                  <div>
                    <span className="text-muted-foreground">CPF:</span>
                    <p className="font-medium">{selectedPatient.cpf}</p>
                  </div>
                )}
                {selectedPatient.cns && (
                  <div>
                    <span className="text-muted-foreground">CNS:</span>
                    <p className="font-medium">{selectedPatient.cns}</p>
                  </div>
                )}
                {selectedPatient.birth_date && (
                  <div>
                    <span className="text-muted-foreground">Nascimento:</span>
                    <p className="font-medium">{format(new Date(selectedPatient.birth_date + 'T00:00:00'), "dd/MM/yyyy")}</p>
                  </div>
                )}
                {selectedPatient.sex && (
                  <div>
                    <span className="text-muted-foreground">Sexo:</span>
                    <p className="font-medium">{selectedPatient.sex === "M" ? "Masculino" : selectedPatient.sex === "F" ? "Feminino" : "Indeterminado"}</p>
                  </div>
                )}
                {selectedPatient.blood_type && (
                  <div>
                    <span className="text-muted-foreground">Tipo Sanguíneo:</span>
                    <p className="font-medium">{selectedPatient.blood_type}</p>
                  </div>
                )}
                {selectedPatient.phone && (
                  <div>
                    <span className="text-muted-foreground">Telefone:</span>
                    <p className="font-medium">{selectedPatient.phone}</p>
                  </div>
                )}
              </div>

              {selectedPatient.allergies && (
                <div className="p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs font-medium text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Alergias
                  </p>
                  <p className="text-sm">{selectedPatient.allergies}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPatientDetail(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setShowPatientDetail(false);
              setShowNewEncounter(true);
            }}>
              <Play className="h-4 w-4 mr-2" />
              Novo Atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Encounter Dialog */}
      <Dialog open={showNewEncounter} onOpenChange={setShowNewEncounter}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Novo Atendimento
            </DialogTitle>
            <DialogDescription>
              Inicie um novo atendimento e direcione para o setor de destino.
            </DialogDescription>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{selectedPatient.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedPatient.medical_record}</p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Setor de Destino *</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Selecione o setor de internação de destino. O paciente aparece
                  em <span className="font-semibold">"Aguardando Admissão"</span> daquele setor,
                  onde o NIR ou o médico efetiva a admissão no leito.
                </p>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {DESTINATION_GROUPS.map((group) => (
                    <div key={group}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {group}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {DESTINATION_SECTORS.filter(s => s.group === group && !s.legacyOnly).map((sector) => (
                          <button
                            key={sector.value}
                            onClick={() => setDestinationSector(sector.value)}
                            className={cn(
                              "flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all hover:bg-accent/50 cursor-pointer",
                              destinationSector === sector.value && "ring-2 ring-primary bg-primary/5 border-primary/30"
                            )}
                          >
                            <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", sector.color)} />
                            <span className="text-xs font-medium flex-1 truncate">{sector.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {destinationSector && (() => {
                  const def = DESTINATION_SECTORS.find(s => s.value === destinationSector);
                  if (!def) return null;
                  return (
                    <div className="mt-3 p-2.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-700 dark:text-blue-300">
                      ✓ Paciente entrará em <strong>"Aguardando Admissão"</strong> de{" "}
                      <strong>{def.label}</strong>. NIR ou médico do setor poderá efetivar a admissão no leito.
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEncounter(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateEncounter}
              disabled={isCreatingEncounter || !destinationSector}
            >
              {isCreatingEncounter ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Iniciar Atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Busca global Ctrl+K */}
      <ReceptionGlobalSearch
        open={globalSearchOpen}
        onOpenChange={setGlobalSearchOpen}
        onPickRegistry={(id, name) => {
          handlePickRegistryFromDashboard(id, name);
        }}
        onPickEncounter={(code, regId, name) => {
          if (regId) {
            handlePickRegistryFromDashboard(regId, name);
          } else {
            toast.info("Atendimento sem prontuário vinculado", { description: code });
          }
        }}
      />

      {/* Cadastro Express — paciente sem identificacao (NI) */}
      <TriageExpressDialog
        open={showTriageExpress}
        onOpenChange={setShowTriageExpress}
        sectors={DESTINATION_SECTORS}
        groups={DESTINATION_GROUPS}
        onConfirm={handleTriageExpressConfirm}
        loading={isCreatingEncounter}
        receptionPoint={receptionPoint}
      />
    </MainLayout>
  );
};

export default AdminDashboardPage;
