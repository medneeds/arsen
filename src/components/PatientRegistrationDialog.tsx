import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useMedicalRecordMode } from "@/hooks/useMedicalRecordMode";
import { Camera, Upload, User, MapPin, Loader2, Sparkles, AlertCircle, ShieldAlert, UserX, FileUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PisImportDialog, ExtractedPisData } from "./PisImportDialog";
import { UnidentifiedSuggestionDialog } from "./UnidentifiedSuggestionDialog";
import {
  detectUnidentified,
  shouldEscalateToAi,
  type NiDetection,
} from "@/lib/unidentifiedDetector";

interface PatientRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Pre-fill destination sector (e.g. when opening from a sector map). Auto-routes to "aguardando_leito". */
  defaultDestinationSector?: string;
}

interface PatientFormData {
  patient_name: string;
  social_name: string;
  mother_name: string;
  birth_date: string;
  sex: string;
  cpf: string;
  cns: string;
  medical_record: string;
  phone: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  destination_sector: string;
  notes: string;
  // NI fields
  is_unidentified: boolean;
  ni_estimated_age: string;
  ni_apparent_sex: string;
  ni_skin_color: string;
  ni_distinctive_marks: string;
  ni_arrival_circumstance: string;
}

const EMPTY_FORM: PatientFormData = {
  patient_name: "",
  social_name: "",
  mother_name: "",
  birth_date: "",
  sex: "",
  cpf: "",
  cns: "",
  medical_record: "",
  phone: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  destination_sector: "",
  notes: "",
  is_unidentified: false,
  ni_estimated_age: "",
  ni_apparent_sex: "",
  ni_skin_color: "",
  ni_distinctive_marks: "",
  ni_arrival_circumstance: "",
};

const SECTORS = [
  "UTI 1", "UTI 2",
  "UCI 1", "UCI 2",
  "UCC",
  "Neuro 01", "Neuro 02",
  "Clínica Cirúrgica",
  "Enf. Transição",
  "Enf. Vascular",
  "RIV",
];

// Format CPF: 000.000.000-00
const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

// CPF validation (algoritmo)
const isValidCPF = (cpf: string) => {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let dv1 = 11 - (sum % 11);
  if (dv1 >= 10) dv1 = 0;
  if (dv1 !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  let dv2 = 11 - (sum % 11);
  if (dv2 >= 10) dv2 = 0;
  return dv2 === parseInt(c[10]);
};

export function PatientRegistrationDialog({ open, onOpenChange, onSuccess, defaultDestinationSector }: PatientRegistrationDialogProps) {
  const [activeTab, setActiveTab] = useState("dados");
  const [form, setForm] = useState<PatientFormData>(() => ({ ...EMPTY_FORM, destination_sector: defaultDestinationSector || "" }));
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<{ id: string; full_name: string; medical_record: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pisDialogOpen, setPisDialogOpen] = useState(false);

  // Detecção inteligente de paciente NI (heurística + IA)
  const [niSuggestion, setNiSuggestion] = useState<NiDetection | null>(null);
  const [niSuggestionOpen, setNiSuggestionOpen] = useState(false);
  const [userOverroteNiSuggestion, setUserOverroteNiSuggestion] = useState(false);
  const lastDetectedNameRef = useRef<string>("");

  const formatCPFLocal = (s: string) => s.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2}).*/, "$1.$2.$3-$4");
  const applyPisData = (data: ExtractedPisData) => {
    // Detecta paciente "Não Identificado" vindo do PIS (variações: NAO IDENTIFICADO, N/I, S/N, DESCONHECIDO, em branco mas com outros dados)
    const rawName = (data.patient_name || "").trim();
    const normalizedName = rawName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    const looksUnidentified =
      !!rawName &&
      (/^N[\s.\-/]*A[\s.\-/]*O\s+IDENTIFICAD[OA]/.test(normalizedName) ||
        /^(N\s*\/\s*I|S\s*\/\s*N|S\s*\/\s*I)\b/.test(normalizedName) ||
        /\b(DESCONHECID[OA]|IGNORAD[OA]|NAO\s+INFORMAD[OA])\b/.test(normalizedName) ||
        normalizedName === "NI");

    setForm(prev => {
      const becomingNI = looksUnidentified || prev.is_unidentified;
      // Mapeia sexo do PIS para o campo "sexo aparente" quando NI
      const sexFromPis = (data.sex || "").toString().toUpperCase();
      const apparentSex = sexFromPis.startsWith("M")
        ? "Masculino"
        : sexFromPis.startsWith("F")
        ? "Feminino"
        : prev.ni_apparent_sex;

      return {
        ...prev,
        is_unidentified: becomingNI,
        // Se for NI: não preenche nome real, mãe, CPF, CNS, data de nascimento — mas mantém demais dados úteis
        patient_name: becomingNI ? "" : (data.patient_name || prev.patient_name).toUpperCase(),
        mother_name: becomingNI ? "" : (data.mother_name || prev.mother_name).toUpperCase(),
        birth_date: becomingNI ? "" : (data.birth_date || prev.birth_date),
        sex: becomingNI ? "" : (data.sex || prev.sex),
        cpf: becomingNI ? "" : (data.cpf ? formatCPFLocal(data.cpf) : prev.cpf),
        cns: becomingNI ? "" : (data.cns || prev.cns),
        // Características NI herdadas do PIS quando aplicável
        ni_apparent_sex: becomingNI ? apparentSex : prev.ni_apparent_sex,
        // Dados de contato/endereço/prontuário são preservados em ambos os fluxos
        phone: data.phone || prev.phone,
        address: (data.address || prev.address).toUpperCase(),
        neighborhood: (data.neighborhood || prev.neighborhood).toUpperCase(),
        city: (data.city || prev.city).toUpperCase(),
        state: data.state ? data.state.toUpperCase().slice(0, 2) : prev.state,
        medical_record: (data.medical_record || prev.medical_record || "").toString().trim(),
      };
    });
    if (looksUnidentified) {
      toast({
        title: "Paciente NÃO IDENTIFICADO detectado",
        description: "Modo NI ativado automaticamente. Endereço, contato e prontuário do PIS foram preservados.",
      });
    }
    setActiveTab("dados");
  };
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { mode: mrMode } = useMedicalRecordMode(currentHospital?.id);

  const updateField = (field: keyof PatientFormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value as never }));
  };

  // Garante que, ao reabrir o diálogo a partir de uma seção de setor, o destino fique pré-preenchido
  useEffect(() => {
    if (open && defaultDestinationSector) {
      setForm(prev => prev.destination_sector ? prev : { ...prev, destination_sector: defaultDestinationSector });
    }
  }, [open, defaultDestinationSector]);

  // Reset detection state when dialog closes
  useEffect(() => {
    if (!open) {
      setNiSuggestion(null);
      setNiSuggestionOpen(false);
      setUserOverroteNiSuggestion(false);
      lastDetectedNameRef.current = "";
    }
  }, [open]);

  // Detector inteligente debounced para o nome digitado/importado
  useEffect(() => {
    if (!open) return;
    if (form.is_unidentified) return;
    if (userOverroteNiSuggestion) return;
    const name = form.patient_name.trim();
    if (!name) {
      setNiSuggestion(null);
      return;
    }
    if (name === lastDetectedNameRef.current) return;

    const handle = setTimeout(async () => {
      lastDetectedNameRef.current = name;
      const heuristic = detectUnidentified(name, {
        arrivalMode: form.ni_arrival_circumstance,
      });
      if (heuristic.isUnidentified && heuristic.confidence >= 0.7) {
        setNiSuggestion(heuristic);
        setNiSuggestionOpen(true);
        return;
      }
      if (!shouldEscalateToAi(name, { arrivalMode: form.ni_arrival_circumstance })) {
        setNiSuggestion(null);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke(
          "detect-unidentified-patient",
          { body: { name, arrivalMode: form.ni_arrival_circumstance } }
        );
        if (error) {
          console.debug("[ni-detector] AI call failed", error);
          return;
        }
        if (data?.isUnidentified && (data.confidence ?? 0) >= 0.7) {
          setNiSuggestion({
            isUnidentified: true,
            confidence: data.confidence,
            reason: data.reason,
            source: "ai",
            suggestedSex: data.suggestedSex ?? null,
          });
          setNiSuggestionOpen(true);
        }
      } catch (err) {
        console.debug("[ni-detector] AI exception", err);
      }
    }, 450);

    return () => clearTimeout(handle);
  }, [open, form.patient_name, form.is_unidentified, form.ni_arrival_circumstance, userOverroteNiSuggestion]);

  // Caminho 1: NI puro — limpa tudo, gera só código institucional
  const handleAcceptNiSuggestion = () => {
    setNiSuggestionOpen(false);
    const sex = niSuggestion?.suggestedSex;
    setForm(prev => ({
      ...prev,
      is_unidentified: true,
      patient_name: "",
      social_name: "",
      mother_name: "",
      cpf: "",
      cns: "",
      birth_date: "",
      sex: "",
      medical_record: "",
      ni_apparent_sex: sex === "M" ? "Masculino" : sex === "F" ? "Feminino" : prev.ni_apparent_sex,
    }));
    toast({
      title: "Fluxo NI puro ativado",
      description: "Código NI-AAAA-NNNNNN será gerado ao salvar. Preencha apenas características aparentes.",
    });
  };

  // Caminho 2: NI + dados do PIN — mantém NI mas preserva nº de prontuário do PIN, sexo, observações
  const handleAcceptNiWithPin = () => {
    setNiSuggestionOpen(false);
    const sex = niSuggestion?.suggestedSex;
    setForm(prev => ({
      ...prev,
      is_unidentified: true,
      // Limpa identificação pessoal mas mantém prontuário PIN, sexo, idade aparente, origem, observações
      patient_name: "",
      social_name: "",
      mother_name: "",
      cpf: "",
      cns: "",
      birth_date: "",
      sex: "",
      // Preserva: medical_record (PIN), phone, address, neighborhood, city, state, notes
      ni_apparent_sex: sex === "M" ? "Masculino" : sex === "F" ? "Feminino" : prev.ni_apparent_sex,
    }));
    toast({
      title: "Fluxo NI + dados do PIN ativado",
      description: "Marcado como Não Identificado. O nº de prontuário PIN, origem e observações ficam disponíveis para edição.",
    });
  };

  const handleRejectNiSuggestion = () => {
    setNiSuggestionOpen(false);
    setUserOverroteNiSuggestion(true);
    toast({
      title: "Mantido como nome real",
      description: "Cadastro segue normalmente. Marque NI manualmente se mudar de ideia.",
    });
  };

  const handleCancelNiSuggestion = () => {
    setNiSuggestionOpen(false);
  };

  // Toggle NI: limpa campos sensíveis e força sexo='ignorado' inicial
  const toggleUnidentified = (checked: boolean) => {
    setForm(prev => ({
      ...prev,
      is_unidentified: checked,
      patient_name: checked ? "" : prev.patient_name,
      social_name: checked ? "" : prev.social_name,
      mother_name: checked ? "" : prev.mother_name,
      cpf: checked ? "" : prev.cpf,
      cns: checked ? "" : prev.cns,
      birth_date: checked ? "" : prev.birth_date,
      sex: checked ? "" : prev.sex,
      phone: checked ? "" : prev.phone,
      address: checked ? "" : prev.address,
      neighborhood: checked ? "" : prev.neighborhood,
      city: checked ? "" : prev.city,
    }));
    if (checked) setActiveTab("dados");
  };

  // Live duplicate check on CPF blur
  const checkDuplicateCPF = async () => {
    setDuplicateMatch(null);
    const c = form.cpf.replace(/\D/g, "");
    if (c.length !== 11) return;
    if (!isValidCPF(c)) {
      toast({ title: "CPF inválido", description: "Verifique os dígitos digitados.", variant: "destructive" });
      return;
    }
    const { data, error } = await (supabase.rpc as any)("check_patient_duplicate", { p_cpf: c, p_cns: null });
    if (error) return;
    if (data && data.length > 0) {
      setDuplicateMatch(data[0]);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewImage('pdf');
    }
    setIsExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const response = await supabase.functions.invoke("extract-patient-data", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (response.error) throw new Error(response.error.message);
      const { data } = response.data;
      if (data) {
        setForm(prev => ({
          ...prev,
          patient_name: (data.patient_name || prev.patient_name).toUpperCase(),
          mother_name: (data.mother_name || prev.mother_name).toUpperCase(),
          birth_date: data.birth_date || prev.birth_date,
          sex: data.sex || prev.sex,
          cpf: data.cpf ? formatCPF(data.cpf) : prev.cpf,
          cns: data.cns || prev.cns,
          phone: data.phone || prev.phone,
          address: (data.address || prev.address).toUpperCase(),
          neighborhood: (data.neighborhood || prev.neighborhood).toUpperCase(),
          city: (data.city || prev.city).toUpperCase(),
          medical_record: (data.medical_record || prev.medical_record || "").toString().trim(),
        }));
        setActiveTab("dados");
        toast({ title: "✅ Dados extraídos com sucesso!", description: "Revise os campos preenchidos pela IA" });
      }
    } catch (err) {
      console.error("AI extraction error:", err);
      toast({ title: "Erro na extração", description: "Não foi possível extrair dados. Preencha manualmente.", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!currentHospital?.id || !currentState?.id) {
      toast({ title: "Selecione um hospital", variant: "destructive" });
      return;
    }

    // Validations differ for NI
    if (!form.is_unidentified) {
      if (!form.patient_name.trim()) {
        toast({ title: "Nome obrigatório", variant: "destructive" });
        return;
      }
      if (!form.birth_date) {
        toast({ title: "Data de nascimento obrigatória", variant: "destructive" });
        return;
      }
      if (!form.sex) {
        toast({ title: "Sexo obrigatório", variant: "destructive" });
        return;
      }
      if (form.cpf && !isValidCPF(form.cpf)) {
        toast({ title: "CPF inválido", description: "Verifique os dígitos.", variant: "destructive" });
        return;
      }
      if (duplicateMatch) {
        toast({
          title: "🚫 Cadastro bloqueado",
          description: `CPF já cadastrado: ${duplicateMatch.full_name} (${duplicateMatch.medical_record || "sem prontuário"})`,
          variant: "destructive",
        });
        return;
      }
    }

    // Modo legacy: número do prontuário é obrigatório (digitado manualmente do sistema antigo)
    if (mrMode === "legacy" && !form.is_unidentified && !form.medical_record.trim()) {
      toast({
        title: "Prontuário obrigatório",
        description: "Esta unidade está em modo legado: informe o número do sistema antigo.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      // Fallback: se o usuário não escolheu setor mas o diálogo foi aberto a partir de uma
      // seção de setor (defaultDestinationSector), assume esse setor.
      const effectiveDestination = (form.destination_sector || defaultDestinationSector || "").trim();
      const selectedSectors = effectiveDestination.split(", ").filter(Boolean);
      const isUtiDestination = selectedSectors.some(s => s.startsWith("UTI"));
      const hasDestinationSector = selectedSectors.length > 0;
      // Sempre que houver setor de destino definido (seja vindo do mapa ou escolhido na recepção),
      // o paciente entra direto em "aguardando_leito" daquele setor.
      // Classificação de risco fica pendente e pode ser feita depois pelo médico.
      const status = isUtiDestination
        ? "aguardando_leito_uti"
        : hasDestinationSector
          ? "aguardando_leito"
          : "pre_admissao";

      // Generate NI code if unidentified
      let niCode: string | null = null;
      let finalName = form.patient_name.trim().toUpperCase();
      if (form.is_unidentified) {
        const { data: ni, error: niErr } = await (supabase.rpc as any)("generate_ni_code");
        if (niErr) throw niErr;
        niCode = ni as string;
        finalName = niCode; // Nome temporário = código NI
      }

      // Generate medical record number
      // Preserva o prontuário vindo do PIS para auditoria, mas em modo auto+NI
      // sempre gera um novo número oficial interno (PIS vai para unidentified_features).
      let prontuario = form.medical_record?.trim() || null;
      const pisProntuario = prontuario;
      if (form.is_unidentified && mrMode === "auto") {
        prontuario = null;
      }
      if (!prontuario) {
        const { data: unitRow, error: unitErr } = await supabase
          .from("hospital_units").select("unit_code").eq("id", currentHospital.id).maybeSingle();
        if (unitErr) throw unitErr;
        const unitCode = (unitRow as any)?.unit_code;
        if (!unitCode || !/^[0-9]{3}$/.test(unitCode)) {
          throw new Error("Unidade sem código de 3 dígitos configurado. Contate o administrador.");
        }
        const { data: gen, error: genErr } = await (supabase.rpc as any)(
          "generate_medical_record_number",
          { p_codigo_unidade: unitCode, p_data_criacao: new Date().toISOString(), p_patient_registry_id: null, p_patient_id: null }
        );
        if (genErr) throw genErr;
        prontuario = gen as string;
      }

      // Create patient_registry record (single source of truth)
      const niFeatures = form.is_unidentified ? {
        estimated_age: form.ni_estimated_age || null,
        apparent_sex: form.ni_apparent_sex || null,
        skin_color: form.ni_skin_color || null,
        distinctive_marks: form.ni_distinctive_marks || null,
        arrival_circumstance: form.ni_arrival_circumstance || null,
        // Rastreabilidade: prontuário e nome originais do PIS quando importado
        pis_medical_record: pisProntuario || null,
        pis_raw_name: form.medical_record && pisProntuario ? "NÃO IDENTIFICADO (PIS)" : null,
      } : null;

      const { data: registry, error: regErr } = await supabase
        .from("patient_registry")
        .insert({
          full_name: finalName,
          social_name: form.social_name?.trim() || null,
          mother_name: form.mother_name?.trim() || null,
          birth_date: form.birth_date || null,
          sex: form.sex || null,
          cpf: form.cpf?.replace(/\D/g, "") || null,
          cns: form.cns?.replace(/\D/g, "") || null,
          medical_record: prontuario,
          phone: form.phone?.trim() || null,
          address: form.address?.trim() || null,
          neighborhood: form.neighborhood?.trim() || null,
          city: form.city?.trim() || null,
          state: form.state?.trim() || null,
          notes: form.notes?.trim() || null,
          hospital_unit_id: currentHospital.id,
          state_id: currentState.id,
          created_by: userData?.user?.id || null,
          is_unidentified: form.is_unidentified,
          unidentified_code: niCode,
          unidentified_features: niFeatures,
        } as any)
        .select("id")
        .single();
      if (regErr) {
        // Friendly message for unique violation on CPF
        if ((regErr as any).code === "23505") {
          throw new Error("CPF já cadastrado em outro paciente. Não é possível duplicar.");
        }
        throw regErr;
      }

      const { error: paErr } = await supabase.from("pre_admissions").insert({
        patient_name: finalName,
        social_name: form.social_name?.trim() || null,
        mother_name: form.mother_name?.trim() || null,
        birth_date: form.birth_date || null,
        sex: form.sex || null,
        cpf: form.cpf?.replace(/\D/g, "") || null,
        cns: form.cns?.replace(/\D/g, "") || null,
        medical_record: prontuario,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        neighborhood: form.neighborhood?.trim() || null,
        city: form.city?.trim() || null,
        state: form.state?.trim() || null,
        destination_sector: effectiveDestination || null,
        notes: form.notes?.trim() || null,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        department: currentDepartment,
        created_by: userData?.user?.id || null,
        status,
        patient_registry_id: registry?.id || null,
      } as any);
      if (paErr) throw paErr;

      const successMessage = form.is_unidentified
        ? `${niCode} • Prontuário ${prontuario} • Não Identificado`
        : isUtiDestination
        ? `Prontuário ${prontuario} • Solicitação de leito UTI enviada`
        : hasDestinationSector
        ? `Prontuário ${prontuario} • Aguardando leito em ${form.destination_sector} (classificação de risco pendente)`
        : `Prontuário ${prontuario} • Aguardando classificação de risco`;

      toast({ title: "✅ Paciente cadastrado!", description: successMessage });
      setForm(EMPTY_FORM);
      setPreviewImage(null);
      setDuplicateMatch(null);
      setActiveTab("dados");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setPreviewImage(null);
    setDuplicateMatch(null);
    setActiveTab("dados");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Cadastrar Paciente (Pré-Admissão)
          </DialogTitle>
          {defaultDestinationSector && (
            <div className="mt-1 flex items-center gap-2 text-xs">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Pré-cadastro direcionado para:</span>
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold uppercase tracking-wide">
                {defaultDestinationSector}
              </span>
            </div>
          )}
        </DialogHeader>

        {/* NI toggle - sempre visível no topo */}
        <Card className={cn(
          "border-2 transition-colors",
          form.is_unidentified ? "border-amber-500 bg-amber-500/10" : "border-dashed border-muted"
        )}>
          <CardContent className="p-3 flex items-center gap-3">
            <Checkbox
              id="ni-toggle"
              checked={form.is_unidentified}
              onCheckedChange={(c) => toggleUnidentified(!!c)}
            />
            <label htmlFor="ni-toggle" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <UserX className="h-4 w-4 text-amber-600" />
                Paciente NÃO IDENTIFICADO
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Será gerado código NI-AAAA-NNNNNN. Demais campos ficam vazios e podem ser preenchidos depois.
              </p>
            </label>
          </CardContent>
        </Card>

        {/* Botão discreto sempre visível: importar do sistema legado PIS */}
        {!form.is_unidentified && (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPisDialogOpen(true)}
              className="h-7 px-2.5 text-[11px] gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
              title="Importar dados do sistema PIS — anexe PDF/imagem ou cole o texto"
            >
              <FileUp className="h-3 w-3" />
              Importar do PIS
            </Button>
          </div>
        )}

        <PisImportDialog open={pisDialogOpen} onOpenChange={setPisDialogOpen} onExtracted={applyPisData} />

        <UnidentifiedSuggestionDialog
          open={niSuggestionOpen}
          detection={niSuggestion}
          onConfirmPure={handleAcceptNiSuggestion}
          onConfirmWithPin={handleAcceptNiWithPin}
          onReject={handleRejectNiSuggestion}
          onCancel={handleCancelNiSuggestion}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={cn("grid w-full", defaultDestinationSector ? "grid-cols-1" : "grid-cols-2")}>
            <TabsTrigger value="dados" className="text-xs gap-1">
              <User className="h-3.5 w-3.5" />
              {form.is_unidentified ? "Características NI" : "Dados do Paciente"}
            </TabsTrigger>
            {!defaultDestinationSector && (
              <TabsTrigger value="destino" className="text-xs gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Pedido de Leito
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab 2: Patient Data */}
          <TabsContent value="dados" className="space-y-3 mt-4">
            {form.is_unidentified ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Modo Não Identificado:</strong> ao salvar, será gerado um código <code>NI-AAAA-NNNNNN</code> + prontuário oficial.
                    Preencha apenas as características visíveis para auxiliar identificação posterior.
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Idade Estimada</Label>
                  <Input value={form.ni_estimated_age} onChange={e => updateField("ni_estimated_age", e.target.value)} placeholder="Ex: ~40 anos" />
                </div>
                <div>
                  <Label className="text-xs">Sexo Aparente</Label>
                  <Select value={form.ni_apparent_sex} onValueChange={v => updateField("ni_apparent_sex", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="I">Indeterminado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Cor / Etnia Aparente</Label>
                  <Input value={form.ni_skin_color} onChange={e => updateField("ni_skin_color", e.target.value)} placeholder="Ex: Pardo, Branco, Negro" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Sinais Distintivos</Label>
                  <Textarea value={form.ni_distinctive_marks} onChange={e => updateField("ni_distinctive_marks", e.target.value)}
                    placeholder="Tatuagens, cicatrizes, vestimenta, objetos pessoais..." rows={2} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Circunstância de Chegada</Label>
                  <Textarea value={form.ni_arrival_circumstance} onChange={e => updateField("ni_arrival_circumstance", e.target.value)}
                    placeholder="Ex: SAMU – encontrado em via pública; trazido pela polícia..." rows={2} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-semibold">Nome Completo *</Label>
                  <Input
                    value={form.patient_name}
                    onChange={e => updateField("patient_name", e.target.value.toUpperCase())}
                    placeholder="NOME COMPLETO COMO NO DOCUMENTO"
                    className="uppercase font-semibold tracking-wide"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Armazenado em CAIXA ALTA. Acentos preservados; busca ignora acentuação.
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Nome Social</Label>
                  <Input value={form.social_name} onChange={e => updateField("social_name", e.target.value.toUpperCase())} className="uppercase" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Nome da Mãe</Label>
                  <Input value={form.mother_name} onChange={e => updateField("mother_name", e.target.value.toUpperCase())} className="uppercase" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Data de Nascimento *</Label>
                  <Input type="date" value={form.birth_date} onChange={e => updateField("birth_date", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Sexo *</Label>
                  <Select value={form.sex} onValueChange={v => updateField("sex", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={e => { updateField("cpf", formatCPF(e.target.value)); setDuplicateMatch(null); }}
                    onBlur={checkDuplicateCPF}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                  {duplicateMatch && (
                    <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> CPF já existe: {duplicateMatch.full_name}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">CNS</Label>
                  <Input value={form.cns} onChange={e => updateField("cns", e.target.value)} placeholder="Cartão Nacional de Saúde" />
                </div>
                <div>
                  <Label className="text-xs">
                    Prontuário {mrMode === "legacy" && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    value={form.medical_record}
                    onChange={e => updateField("medical_record", e.target.value)}
                    placeholder={mrMode === "legacy" ? "Obrigatório — nº do sistema antigo" : "Auto: AA-UUU-SSSSSS-DV"}
                    className={cn(mrMode === "legacy" && !form.medical_record.trim() && "border-amber-500/60")}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {mrMode === "legacy"
                      ? "⚠ Unidade em modo legado: informe o número do sistema antigo."
                      : "Vazio → será gerado automaticamente no formato seguro."}
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Endereço</Label>
                  <Input value={form.address} onChange={e => updateField("address", e.target.value.toUpperCase())} className="uppercase" />
                </div>
                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input value={form.neighborhood} onChange={e => updateField("neighborhood", e.target.value.toUpperCase())} className="uppercase" />
                </div>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <div>
                    <Label className="text-xs">Cidade</Label>
                    <Input value={form.city} onChange={e => updateField("city", e.target.value.toUpperCase())} className="uppercase" />
                  </div>
                  <div>
                    <Label className="text-xs">Estado (UF)</Label>
                    <Input
                      value={form.state}
                      onChange={e => updateField("state", e.target.value.toUpperCase().slice(0, 2))}
                      maxLength={2}
                      placeholder="UF"
                      className="uppercase"
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Destination */}
          <TabsContent value="destino" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs font-semibold">Pedido de Leito (selecione um ou mais setores)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SECTORS.map(s => {
                  const selected = form.destination_sector.split(", ").filter(Boolean);
                  const isChecked = selected.includes(s);
                  return (
                    <label key={s} className={cn(
                      "flex items-center gap-2 p-2 rounded-md border cursor-pointer text-sm transition-colors",
                      isChecked ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted/50"
                    )}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          const current = form.destination_sector.split(", ").filter(Boolean);
                          const updated = checked ? [...current, s] : current.filter(x => x !== s);
                          updateField("destination_sector", updated.join(", "));
                        }}
                      />
                      {s}
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.notes} onChange={e => updateField("notes", e.target.value)} rows={3} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || !!duplicateMatch}>
            {isSaving ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>)
                      : form.is_unidentified ? "Gerar Cadastro NI" : "Cadastrar Paciente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
