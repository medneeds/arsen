import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
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
  Phone,
  MapPin,
  Heart,
  AlertTriangle,
  Hash,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Plus,
  Send,
  Clock,
  UserX,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { MedicalRecordsList } from "@/components/MedicalRecordsList";
import { ReceptionDailyDashboard } from "@/components/reception/ReceptionDailyDashboard";
import { DuplicatePatientWarning } from "@/components/reception/DuplicatePatientWarning";

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
  isTriage?: boolean;
};

const DESTINATION_SECTORS: DestinationSector[] = [
  // Triagem (recomendado para casos sem definição prévia)
  { value: "triagem", label: "Triagem", group: "Triagem / Urgência", color: "bg-emerald-500", isTriage: true },
  // Urgência e Emergência (admissão direta sem leito clínico fixo)
  { value: "sala_vermelha", label: "Sala Vermelha", group: "Triagem / Urgência", color: "bg-red-700", sectorKey: "sala_vermelha" },
  { value: "sala_laranja", label: "Sala Laranja", group: "Triagem / Urgência", color: "bg-orange-500", sectorKey: "sala_laranja" },
  { value: "ue_vertical", label: "UE Vertical", group: "Triagem / Urgência", color: "bg-purple-500", sectorKey: "ue_vertical" },
  { value: "ue_horizontal", label: "UE Horizontal", group: "Triagem / Urgência", color: "bg-indigo-500", sectorKey: "ue_horizontal" },
  { value: "observacao_clinica", label: "Observação Clínica", group: "Triagem / Urgência", color: "bg-sky-500", sectorKey: "observacao_clinica" },
  { value: "internacao_ue", label: "Internação UE", group: "Triagem / Urgência", color: "bg-indigo-600", sectorKey: "internacao_ue" },
  // UTIs
  { value: "red", label: "UTI 1", group: "Terapia Intensiva", color: "bg-red-500", sectorKey: "red" },
  { value: "yellow", label: "UTI 2", group: "Terapia Intensiva", color: "bg-yellow-500", sectorKey: "yellow" },
  // UCIs
  { value: "blue", label: "UCI 1", group: "Cuidados Intermediários", color: "bg-blue-500", sectorKey: "blue" },
  { value: "outside", label: "UCI 2", group: "Cuidados Intermediários", color: "bg-emerald-500", sectorKey: "outside" },
  // UCC
  { value: "ucc", label: "UCC — Unidade Cuidados Clínicos", group: "Cuidados Intermediários", color: "bg-violet-500", sectorKey: "ucc" },
  // Enfermarias
  { value: "neuro_01", label: "Enfermaria Neuro 01", group: "Enfermarias", color: "bg-cyan-500", sectorKey: "neuro_01" },
  { value: "neuro_02", label: "Enfermaria Neuro 02", group: "Enfermarias", color: "bg-cyan-600", sectorKey: "neuro_02" },
  { value: "clinica_cirurgica", label: "Clínica Cirúrgica", group: "Enfermarias", color: "bg-teal-500", sectorKey: "clinica_cirurgica" },
  { value: "enfermaria_transicao", label: "Enfermaria de Transição", group: "Enfermarias", color: "bg-amber-500", sectorKey: "enfermaria_transicao" },
  { value: "enfermaria_vascular", label: "Enfermaria Vascular", group: "Enfermarias", color: "bg-pink-500", sectorKey: "enfermaria_vascular" },
  // RIV / Centro Cirúrgico
  { value: "riv", label: "RIV — Ref. Internação Vascular", group: "Centro Cirúrgico / RIV", color: "bg-rose-500", sectorKey: "riv" },
  { value: "cc_preparo", label: "CC — Preparo", group: "Centro Cirúrgico / RIV", color: "bg-slate-500", sectorKey: "cc_preparo" },
  { value: "cc_bloco", label: "CC — Bloco Cirúrgico", group: "Centro Cirúrgico / RIV", color: "bg-slate-600", sectorKey: "cc_bloco" },
  { value: "cc_rpa", label: "CC — RPA", group: "Centro Cirúrgico / RIV", color: "bg-slate-700", sectorKey: "cc_rpa" },
];

const DESTINATION_GROUPS = Array.from(new Set(DESTINATION_SECTORS.map(s => s.group)));

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

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const selectedHospitalId = currentHospital?.id;
  const { currentDepartment } = useDepartment();

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

  // Load recent encounters
  useEffect(() => {
    if (selectedHospitalId) {
      loadRecentEncounters();
    }
  }, [selectedHospitalId]);

  const loadRecentEncounters = async () => {
    if (!selectedHospitalId) return;
    setIsLoadingEncounters(true);
    try {
      const { data, error } = await supabase
        .from("patient_encounters")
        .select("id, encounter_code, patient_name, registry_id, destination_sector, triage_status, status, created_at")
        .eq("hospital_unit_id", selectedHospitalId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentEncounters((data as any[]) || []);
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
      const query = searchQuery.trim().toLowerCase();
      const { data, error } = await supabase
        .from("patient_registry")
        .select("*")
        .or(`full_name.ilike.%${query}%,cpf.ilike.%${query}%,cns.ilike.%${query}%,medical_record.ilike.%${query}%`)
        .order("full_name")
        .limit(20);

      if (error) throw error;
      setSearchResults((data as any[]) || []);
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

    setIsRegistering(true);
    try {
      const stateId = localStorage.getItem("selected_state_id");

      // Gera código NI quando paciente não identificado
      let niCode: string | null = null;
      let finalName = registerForm.full_name.trim().toUpperCase();
      const niFeatures = registerForm.is_unidentified
        ? {
            estimated_age: registerForm.ni_estimated_age || null,
            apparent_sex: registerForm.ni_apparent_sex || null,
            skin_color: registerForm.ni_skin_color || null,
            distinctive_marks: registerForm.ni_distinctive_marks || null,
            arrival_circumstance: registerForm.ni_arrival_circumstance || null,
          }
        : null;

      if (registerForm.is_unidentified) {
        const { data: ni, error: niErr } = await (supabase.rpc as any)("generate_ni_code");
        if (niErr) throw niErr;
        niCode = ni as string;
        // Padronização universal: "NÃO IDENTIFICADO (NI-AAAA-NNNNNN)"
        finalName = `NÃO IDENTIFICADO (${niCode})`;
      }

      const { data, error } = await supabase
        .from("patient_registry")
        .insert({
          full_name: finalName,
          social_name: registerForm.social_name.trim() || null,
          cpf: registerForm.cpf.replace(/\D/g, "") || null,
          cns: registerForm.cns.replace(/\D/g, "") || null,
          birth_date: registerForm.birth_date || null,
          sex: registerForm.sex || null,
          mother_name: registerForm.mother_name.trim() || null,
          phone: registerForm.phone.trim() || null,
          address: registerForm.address.trim() || null,
          neighborhood: registerForm.neighborhood.trim() || null,
          city: registerForm.city.trim() || null,
          blood_type: registerForm.blood_type || null,
          allergies: registerForm.allergies.trim() || null,
          comorbidities: registerForm.comorbidities.trim() || null,
          is_unidentified: registerForm.is_unidentified,
          unidentified_code: niCode,
          unidentified_features: niFeatures,
          created_by: user?.id,
          hospital_unit_id: selectedHospitalId,
          state_id: stateId,
        } as any)
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

      // Padronização AA-UUU-SSSSSS-DV: gera prontuário oficial e atualiza o cadastro
      let officialMr: string | null = (data as any).medical_record;
      try {
        const { data: unit } = await supabase
          .from("hospital_units")
          .select("unit_code")
          .eq("id", selectedHospitalId)
          .maybeSingle();
        const unitCode = (unit as any)?.unit_code && /^[0-9]{3}$/.test((unit as any).unit_code)
          ? (unit as any).unit_code
          : "117";
        const { data: gen, error: genErr } = await (supabase.rpc as any)(
          "generate_medical_record_number",
          {
            p_codigo_unidade: unitCode,
            p_data_criacao: new Date().toISOString(),
            p_patient_registry_id: (data as any).id,
            p_patient_id: null,
          }
        );
        if (!genErr && gen) {
          officialMr = gen as string;
          await supabase
            .from("patient_registry")
            .update({ medical_record: officialMr })
            .eq("id", (data as any).id);
        }
      } catch (e) {
        console.warn("Falha ao gerar prontuário oficial (mantém fallback):", e);
      }

      toast.success(
        registerForm.is_unidentified ? "Paciente NÃO IDENTIFICADO cadastrado!" : "Prontuário criado com sucesso!",
        { description: `Nº ${officialMr}${niCode ? ` • ${niCode}` : ""}` }
      );
      setShowRegisterDialog(false);
      setRegisterForm({
        full_name: "", social_name: "", cpf: "", cns: "", birth_date: "",
        sex: "", mother_name: "", phone: "", address: "", neighborhood: "",
        city: "", blood_type: "", allergies: "", comorbidities: "",
        is_unidentified: false, ni_estimated_age: "", ni_apparent_sex: "",
        ni_skin_color: "", ni_distinctive_marks: "", ni_arrival_circumstance: "",
      });
      setSelectedPatient({ ...(data as any), medical_record: officialMr });
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
      const stateId = localStorage.getItem("selected_state_id");

      // 1) Cria o atendimento (encounter) — vincula ao prontuário oficial e
      //    pré-gera o código de atendimento via generate_encounter_code_v2 (12 dígitos sequencial)
      let preGeneratedCode: string | null = null;
      let medicalRecordId: string | null = null;
      try {
        const { data: mr } = await supabase
          .from("medical_records")
          .select("id")
          .eq("patient_registry_id", selectedPatient.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        medicalRecordId = (mr as any)?.id ?? null;
        if (medicalRecordId) {
          const { data: code } = await (supabase.rpc as any)(
            "generate_encounter_code_v2",
            { p_medical_record_id: medicalRecordId, p_data_hora_admissao: new Date().toISOString() }
          );
          preGeneratedCode = (code as string) || null;
        }
      } catch (e) {
        console.warn("Falha ao pré-gerar código de atendimento (usa trigger):", e);
      }

      const { data: enc, error: encErr } = await supabase
        .from("patient_encounters")
        .insert({
          patient_name: selectedPatient.full_name,
          registry_id: selectedPatient.id,
          medical_record_id: medicalRecordId,
          encounter_code: preGeneratedCode || undefined,
          hospital_unit_id: selectedHospitalId,
          state_id: stateId,
          department: currentDepartment,
          destination_sector: destinationSector,
          triage_status: sectorDef.isTriage ? "aguardando_chamada" : "encaminhado",
          status: "active",
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (encErr) throw encErr;

      // 2) Se for setor clínico (não triagem), cria pré-admissão "aguardando_leito"
      //    para aparecer no card "Aguardando Admissão" do setor escolhido.
      if (!sectorDef.isTriage && sectorDef.sectorKey) {
        const { error: paErr } = await supabase
          .from("pre_admissions")
          .insert({
            patient_name: selectedPatient.full_name,
            social_name: selectedPatient.social_name || null,
            mother_name: selectedPatient.mother_name || null,
            birth_date: selectedPatient.birth_date || null,
            sex: selectedPatient.sex || null,
            cpf: selectedPatient.cpf || null,
            cns: selectedPatient.cns || null,
            medical_record: selectedPatient.medical_record || null,
            phone: selectedPatient.phone || null,
            patient_registry_id: selectedPatient.id,
            destination_sector: sectorDef.label,
            status: "aguardando_leito",
            hospital_unit_id: selectedHospitalId,
            state_id: stateId,
            department: currentDepartment,
            created_by: user?.id,
            notes: `Direcionado pela Recepção • Atendimento ${(enc as any).encounter_code}`,
          } as any);
        if (paErr) {
          console.error("Erro ao criar pré-admissão:", paErr);
          toast.warning("Atendimento criado, mas falha ao notificar setor", {
            description: paErr.message,
          });
        }
      }

      toast.success("Atendimento iniciado!", {
        description: `Código: ${(enc as any).encounter_code} → ${sectorDef.label}`,
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

  // ── Triagem Express: cria NI + atendimento direcionado para Triagem em 1 clique ──
  const handleTriageExpress = async () => {
    if (!selectedHospitalId) {
      toast.error("Unidade hospitalar não selecionada");
      return;
    }
    setIsCreatingEncounter(true);
    try {
      const stateId = localStorage.getItem("selected_state_id");
      // 1) Gera NI code + cria registry mínimo
      const { data: niCode, error: niErr } = await (supabase.rpc as any)("generate_ni_code");
      if (niErr) throw niErr;
      const finalName = `NÃO IDENTIFICADO (${niCode})`;
      const { data: registry, error: regErr } = await supabase
        .from("patient_registry")
        .insert({
          full_name: finalName,
          sex: "I",
          is_unidentified: true,
          unidentified_code: niCode,
          unidentified_features: { arrival_circumstance: "Triagem Express" },
          created_by: user?.id,
          hospital_unit_id: selectedHospitalId,
          state_id: stateId,
        } as any)
        .select()
        .single();
      if (regErr) throw regErr;

      // 2) Gera prontuário oficial
      let officialMr: string | null = (registry as any).medical_record;
      try {
        const { data: unit } = await supabase
          .from("hospital_units").select("unit_code").eq("id", selectedHospitalId).maybeSingle();
        const unitCode = (unit as any)?.unit_code && /^[0-9]{3}$/.test((unit as any).unit_code) ? (unit as any).unit_code : "117";
        const { data: gen } = await (supabase.rpc as any)("generate_medical_record_number", {
          p_codigo_unidade: unitCode,
          p_data_criacao: new Date().toISOString(),
          p_patient_registry_id: (registry as any).id,
          p_patient_id: null,
        });
        if (gen) {
          officialMr = gen as string;
          await supabase.from("patient_registry").update({ medical_record: officialMr }).eq("id", (registry as any).id);
        }
      } catch (e) { console.warn("MR gen falhou:", e); }

      // 3) Gera código de atendimento e cria encounter direto pra Triagem
      let preGenCode: string | null = null;
      let mrId: string | null = null;
      try {
        const { data: mr } = await supabase
          .from("medical_records")
          .select("id")
          .eq("patient_registry_id", (registry as any).id)
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        mrId = (mr as any)?.id ?? null;
        if (mrId) {
          const { data: code } = await (supabase.rpc as any)(
            "generate_encounter_code_v2",
            { p_medical_record_id: mrId, p_data_hora_admissao: new Date().toISOString() }
          );
          preGenCode = (code as string) || null;
        }
      } catch (e) { console.warn("Encounter code falhou:", e); }

      const { data: enc, error: encErr } = await supabase
        .from("patient_encounters")
        .insert({
          patient_name: finalName,
          registry_id: (registry as any).id,
          medical_record_id: mrId,
          encounter_code: preGenCode || undefined,
          hospital_unit_id: selectedHospitalId,
          state_id: stateId,
          department: currentDepartment,
          destination_sector: "triagem",
          triage_status: "aguardando_chamada",
          status: "active",
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (encErr) throw encErr;

      toast.success("Triagem Express criada!", {
        description: `${niCode} • Atd ${(enc as any).encounter_code}`,
      });
      loadRecentEncounters();
    } catch (err: any) {
      console.error("Erro Triagem Express:", err);
      toast.error("Falha na Triagem Express", { description: err?.message });
    } finally {
      setIsCreatingEncounter(false);
    }
  };

  // Pega paciente do dashboard daily (por registry_id) para reatender
  const handlePickRegistryFromDashboard = async (registryId: string, _patientName: string) => {
    try {
      const { data, error } = await supabase
        .from("patient_registry")
        .select("*")
        .eq("id", registryId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSelectedPatient(data as any);
        setShowNewEncounter(true);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar paciente", { description: err?.message });
    }
  };

  const getTriageStatusBadge = (status?: string) => {
    switch (status) {
      case "aguardando_chamada":
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">Aguardando chamada</Badge>;
      case "chamado":
        return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30">Chamado</Badge>;
      case "em_triagem":
        return <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950/30">Em triagem</Badge>;
      case "triado":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">Triado</Badge>;
      case "encaminhado":
        return <Badge variant="outline" className="text-sky-600 border-sky-300 bg-sky-50 dark:bg-sky-950/30">Encaminhado direto</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
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
        <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Recepção / Administrativo</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {recentEncounters.filter(e => e.status === "active").length} atendimentos ativos
            </Badge>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-6xl mx-auto space-y-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="inicio" className="gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Início
                </TabsTrigger>
                <TabsTrigger value="dia" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Atendimentos do Dia
                </TabsTrigger>
                <TabsTrigger value="aguardando" className="gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Aguardando Admissão
                </TabsTrigger>
                <TabsTrigger value="prontuarios" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Prontuários
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inicio" className="space-y-6 mt-0">

            {/* Painel diário da recepção (KPIs + Triagem Express + sub-tabs) */}
            <ReceptionDailyDashboard
              onPickRegistry={handlePickRegistryFromDashboard}
              onTriageExpress={handleTriageExpress}
              onNewRegistration={() => setShowRegisterDialog(true)}
            />

            {/* Search & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Search Card */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Consultar Prontuário
                  </CardTitle>
                  <CardDescription>
                    Busque por nome, CPF, CNS ou número do prontuário
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite o nome, CPF, CNS ou nº do prontuário..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="flex-1"
                    />
                    <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      <span className="ml-2 hidden sm:inline">Buscar</span>
                    </Button>
                  </div>

                  {/* Search Results */}
                  <AnimatePresence>
                    {hasSearched && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4"
                      >
                        {searchResults.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <XCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
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
                                <motion.div
                                  key={patient.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedPatient(patient);
                                    setShowPatientDetail(true);
                                  }}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm truncate">{patient.full_name}</p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Hash className="h-3 w-3" />
                                          {patient.medical_record}
                                        </span>
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
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPatient(patient);
                                        setShowNewEncounter(true);
                                      }}
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      Novo Atendimento
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPatient(patient);
                                        setShowPatientDetail(true);
                                      }}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    Ações Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setShowRegisterDialog(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2 text-emerald-500" />
                    Novo Prontuário
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    disabled={!selectedPatient}
                    onClick={() => selectedPatient && setShowNewEncounter(true)}
                  >
                    <Play className="h-4 w-4 mr-2 text-blue-500" />
                    Iniciar Atendimento
                  </Button>
                  {selectedPatient && (
                    <div className="p-2 rounded-md bg-primary/5 border border-primary/10">
                      <p className="text-xs text-muted-foreground">Paciente selecionado:</p>
                      <p className="text-sm font-medium truncate">{selectedPatient.full_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedPatient.medical_record}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

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
                            {enc.destination_sector === "triagem" && getTriageStatusBadge(enc.triage_status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
              </TabsContent>

              <TabsContent value="dia" className="mt-0">
                <ReceptionDailyDashboard
                  onPickRegistry={handlePickRegistryFromDashboard}
                  onTriageExpress={handleTriageExpress}
                  onNewRegistration={() => setShowRegisterDialog(true)}
                  defaultSubTab="dia"
                />
              </TabsContent>

              <TabsContent value="aguardando" className="mt-0">
                <ReceptionDailyDashboard
                  onPickRegistry={handlePickRegistryFromDashboard}
                  onTriageExpress={handleTriageExpress}
                  onNewRegistration={() => setShowRegisterDialog(true)}
                  defaultSubTab="aguardando"
                />
              </TabsContent>

              <TabsContent value="prontuarios" className="mt-0">
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
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
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
              disabled={isRegistering || (!registerForm.is_unidentified && !registerForm.full_name.trim())}
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
                  Selecione um setor clínico para que o paciente apareça automaticamente
                  em <span className="font-semibold">"Aguardando Admissão"</span> daquele setor,
                  ou envie para <span className="font-semibold">Triagem</span> para classificação de risco.
                </p>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {DESTINATION_GROUPS.map((group) => (
                    <div key={group}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {group}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {DESTINATION_SECTORS.filter(s => s.group === group).map((sector) => (
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
                            {sector.isTriage && (
                              <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 h-4">
                                Recomendado
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {destinationSector && (() => {
                  const def = DESTINATION_SECTORS.find(s => s.value === destinationSector);
                  if (!def || def.isTriage) return null;
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
    </MainLayout>
  );
};

export default AdminDashboardPage;
