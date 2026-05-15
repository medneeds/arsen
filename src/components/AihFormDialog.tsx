import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FileText, Printer, RotateCcw, Loader2, ClipboardList, Search,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolvePatientHeader } from "@/lib/resolvePatientHeader";

const AIH_INSTITUTION = {
  solicitante: "HOSPITAL MUNICIPAL DJALMA MARQUES",
  cnesSolicitante: "2308762",
  executante: "HOSPITAL MUNICIPAL DJALMA MARQUES",
  cnesExecutante: "2308762",
};

// Common internment procedure codes (SIGTAP)
const AIH_PROCEDURES = [
  { code: "03.03.06.019-0", name: "TRATAMENTO DE PNEUMONIA OU INFLUENZA (GRIPE)" },
  { code: "03.03.04.014-9", name: "TRATAMENTO DE ACIDENTE VASCULAR CEREBRAL (AVC) ISQUÊMICO OU HEMORRÁGICO AGUDO" },
  { code: "03.03.06.002-6", name: "TRATAMENTO DE INFECÇÃO DO TRATO URINÁRIO" },
  { code: "03.03.02.001-4", name: "TRATAMENTO DE INSUFICIÊNCIA CARDÍACA" },
  { code: "03.03.06.018-2", name: "TRATAMENTO DE SEPTICEMIA" },
  { code: "03.03.04.001-7", name: "TRATAMENTO DE CRISE HIPERTENSIVA" },
  { code: "03.03.03.003-0", name: "TRATAMENTO DE DIABETES MELLITUS" },
  { code: "03.03.10.011-0", name: "TRATAMENTO DE INSUFICIÊNCIA RENAL AGUDA" },
  { code: "03.03.06.007-7", name: "TRATAMENTO DE CELULITE" },
  { code: "03.03.02.003-0", name: "TRATAMENTO DE INFARTO AGUDO DO MIOCÁRDIO" },
  { code: "03.03.07.002-0", name: "TRATAMENTO DE ABDOME AGUDO" },
  { code: "03.03.06.003-4", name: "TRATAMENTO DE ERISIPELA" },
  { code: "03.03.04.003-3", name: "TRATAMENTO DE EPILEPSIA" },
  { code: "03.03.02.004-9", name: "TRATAMENTO DE ANGINA INSTÁVEL" },
  { code: "03.03.08.004-9", name: "TRATAMENTO DE DOENÇA PULMONAR OBSTRUTIVA CRÔNICA (DPOC)" },
  { code: "04.08.04.001-4", name: "TRATAMENTO CIRÚRGICO DE FRATURA DO FÊMUR" },
  { code: "04.07.02.003-3", name: "COLECISTECTOMIA VIDEOLAPAROSCÓPICA" },
  { code: "04.07.02.010-6", name: "APENDICECTOMIA" },
  { code: "04.07.02.004-1", name: "HERNIORRAFIA" },
  { code: "04.12.02.002-1", name: "TRATAMENTO CIRÚRGICO DE FRATURA DO TORNOZELO" },
];

interface AihFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

export function AihFormDialog({ open, onOpenChange, patientId, patientName }: AihFormDialogProps) {
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  // Doctor
  const [doctorName, setDoctorName] = useState("");
  const [doctorCRM, setDoctorCRM] = useState("");
  const [doctorCPF, setDoctorCPF] = useState("");
  const [doctorDocType, setDoctorDocType] = useState<"CPF" | "CNS">("CPF");

  // Patient
  const [aihPatientName, setAihPatientName] = useState(patientName);
  const [patientRecord, setPatientRecord] = useState("");
  const [patientCNS, setPatientCNS] = useState("");
  const [patientDOB, setPatientDOB] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [patientMotherName, setPatientMotherName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [patientCity, setPatientCity] = useState("São Luís");
  const [patientUF, setPatientUF] = useState("MA");
  const [patientCEP, setPatientCEP] = useState("");

  // Justification
  const [signsSymptoms, setSignsSymptoms] = useState("");
  const [conditions, setConditions] = useState("");
  const [examResults, setExamResults] = useState("");
  const [diagnosisInitial, setDiagnosisInitial] = useState("");
  const [cidPrimary, setCidPrimary] = useState("");
  const [cidSecondary, setCidSecondary] = useState("");
  const [cidAssociated, setCidAssociated] = useState("");

  // Procedure
  const [procedureDescription, setProcedureDescription] = useState("");
  const [procedureCode, setProcedureCode] = useState("");
  const [clinica, setClinica] = useState("");
  const [caraterInternacao, setCaraterInternacao] = useState<"eletiva" | "urgencia">("urgencia");
  const [searchProcedure, setSearchProcedure] = useState("");

  // External causes
  const [showExternalCauses, setShowExternalCauses] = useState(false);
  const [acidenteTransito, setAcidenteTransito] = useState(false);
  const [acidenteTrabalhoTipico, setAcidenteTrabalhoTipico] = useState(false);
  const [acidenteTrabalhoTrajeto, setAcidenteTrabalhoTrajeto] = useState(false);
  const [cnpjSeguradora, setCnpjSeguradora] = useState("");
  const [cnpjEmpresa, setCnpjEmpresa] = useState("");

  // Social Security
  const [vinculoPrevidencia, setVinculoPrevidencia] = useState("");

  // Loading
  const [importingAdmission, setImportingAdmission] = useState(false);
  const [importingEvolution, setImportingEvolution] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(false);

  const todayFormatted = format(new Date(), "dd/MM/yyyy");

  // Auto-load patient data + doctor profile
  useEffect(() => {
    if (!open) return;
    setAihPatientName(patientName);
    loadPatientData();
    loadDoctorProfile();
  }, [open, patientId, patientName]);

  const loadDoctorProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("full_name, crm").eq("id", user.id).maybeSingle();
    if (data) {
      setDoctorName(data.full_name || "");
      setDoctorCRM(data.crm || "");
    }
  };

  const loadPatientData = async () => {
    setLoadingPatient(true);
    try {
      // Identidade canônica unificada (mesmo helper usado pela impressão de
      // Evolução / Sumário de Alta). Aplica guarda anti-NI e prefere
      // patient_registry vinculado em patients.patient_registry_id.
      const header = await resolvePatientHeader(patientId, patientName, null);

      if (header.name && header.name !== "—") setAihPatientName(header.name);
      setPatientCNS(header.cns || "");
      setPatientDOB(header.birthDate || "");
      setPatientSex(header.sex || "");
      setPatientMotherName(header.motherName || "");
      setPatientPhone(header.phone || "");
      setPatientAddress(header.address || "");
      // Mantém defaults de cidade/UF caso registry não traga (form AIH BR)
      // Prontuário oficial vindo do helper (numero_prontuario formatado)
      if (header.prontuario) setPatientRecord(header.prontuario);

      // Fallback adicional para pre_admissions caso registry não traga endereço/cidade
      if (!header.address || !header.cns) {
        const { data: preAdm } = await supabase
          .from("pre_admissions")
          .select("cns, birth_date, sex, mother_name, phone, address, city, medical_record")
          .ilike("patient_name", `%${patientName}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (preAdm) {
          if (!header.cns && preAdm.cns) setPatientCNS(preAdm.cns);
          if (!header.birthDate && preAdm.birth_date) setPatientDOB(preAdm.birth_date);
          if (!header.sex && preAdm.sex) setPatientSex(preAdm.sex);
          if (!header.motherName && preAdm.mother_name) setPatientMotherName(preAdm.mother_name);
          if (!header.phone && preAdm.phone) setPatientPhone(preAdm.phone);
          if (!header.address && preAdm.address) setPatientAddress(preAdm.address);
          if (preAdm.city) setPatientCity(preAdm.city);
          if (!header.prontuario && preAdm.medical_record) setPatientRecord(preAdm.medical_record);
        }
      }
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      setLoadingPatient(false);
    }
  };

  const importAdmission = async () => {
    setImportingAdmission(true);
    try {
      const { data } = await supabase
        .from("admission_histories")
        .select("chief_complaint, clinical_history, diagnostic_hypothesis, initial_conduct")
        .eq("patient_id", patientId)
        .maybeSingle();
      if (!data) { toast.error("Nenhuma admissão encontrada"); return; }
      if (data.chief_complaint) setSignsSymptoms(prev => prev ? prev + "\n" + data.chief_complaint : data.chief_complaint);
      if (data.clinical_history) setConditions(prev => prev ? prev + "\n" + data.clinical_history : data.clinical_history);
      if (data.diagnostic_hypothesis) setDiagnosisInitial(data.diagnostic_hypothesis);
      if (data.initial_conduct) setConditions(prev => prev ? prev + "\n" + data.initial_conduct : data.initial_conduct);
      toast.success("Dados da admissão importados");
    } catch { toast.error("Erro ao importar admissão"); }
    finally { setImportingAdmission(false); }
  };

  const importEvolution = async () => {
    setImportingEvolution(true);
    try {
      const { data: patient } = await supabase
        .from("patients")
        .select("diagnoses, medical_history, relevant_exams, pendencies")
        .eq("id", patientId)
        .maybeSingle();
      if (!patient) { toast.error("Dados não encontrados"); return; }
      if (patient.diagnoses) setDiagnosisInitial(patient.diagnoses);
      if (patient.relevant_exams) setExamResults(prev => prev ? prev + "\n" + patient.relevant_exams : patient.relevant_exams);
      if (patient.medical_history) setConditions(prev => prev ? prev + "\n" + patient.medical_history : patient.medical_history);
      toast.success("Dados da evolução importados");
    } catch { toast.error("Erro ao importar evolução"); }
    finally { setImportingEvolution(false); }
  };

  const selectProcedure = (proc: { code: string; name: string }) => {
    setProcedureCode(proc.code);
    setProcedureDescription(proc.name);
    setSearchProcedure("");
    toast.success("Procedimento selecionado");
  };

  const filteredProcedures = AIH_PROCEDURES.filter(
    (p) => searchProcedure.length >= 2 && (
      p.name.toLowerCase().includes(searchProcedure.toLowerCase()) ||
      p.code.includes(searchProcedure)
    )
  );

  const resetForm = () => {
    setAihPatientName(patientName);
    setSignsSymptoms(""); setConditions(""); setExamResults("");
    setDiagnosisInitial(""); setCidPrimary(""); setCidSecondary(""); setCidAssociated("");
    setProcedureDescription(""); setProcedureCode(""); setClinica("");
    setShowExternalCauses(false); setVinculoPrevidencia("");
    toast.info("Formulário limpo");
  };

  const handlePrint = () => {
    if (!aihPatientName.trim()) { toast.error("Informe o nome do paciente"); return; }
    if (!procedureCode) { toast.error("Selecione um procedimento"); return; }
    window.print();
  };

  const formatDOB = (dob: string) => {
    if (!dob) return "";
    try { return format(new Date(dob + "T12:00:00"), "dd/MM/yyyy"); } catch { return dob; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 print:hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Laudo para Solicitação de AIH
          </DialogTitle>
          <DialogDescription>
            Autorização de Internação Hospitalar — {aihPatientName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] px-6 pb-6">
          {loadingPatient && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados do paciente...
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              {/* Estabelecimento */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estabelecimento de Saúde</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-1"><Label className="text-[10px] text-muted-foreground">Solicitante</Label><Input value={AIH_INSTITUTION.solicitante} readOnly className="bg-muted/50 font-medium text-xs" /></div>
                    <div className="w-24"><Label className="text-[10px] text-muted-foreground">CNES</Label><Input value={AIH_INSTITUTION.cnesSolicitante} readOnly className="bg-muted/50 font-mono font-bold text-xs text-center" /></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1"><Label className="text-[10px] text-muted-foreground">Executante</Label><Input value={AIH_INSTITUTION.executante} readOnly className="bg-muted/50 font-medium text-xs" /></div>
                    <div className="w-24"><Label className="text-[10px] text-muted-foreground">CNES</Label><Input value={AIH_INSTITUTION.cnesExecutante} readOnly className="bg-muted/50 font-mono font-bold text-xs text-center" /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Paciente */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação do Paciente</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2"><Label className="text-[10px] text-muted-foreground">Nome do Paciente *</Label><Input value={aihPatientName} onChange={(e) => setAihPatientName(e.target.value)} className="text-xs" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">Nº Prontuário</Label><Input value={patientRecord} onChange={(e) => setPatientRecord(e.target.value)} className="text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px] text-muted-foreground">CNS</Label><Input value={patientCNS} onChange={(e) => setPatientCNS(e.target.value)} className="text-xs" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">Data Nasc.</Label><Input type="date" value={patientDOB} onChange={(e) => setPatientDOB(e.target.value)} className="text-xs" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">Sexo</Label>
                      <Select value={patientSex} onValueChange={setPatientSex}><SelectTrigger className="text-xs"><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent></Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px] text-muted-foreground">Nome da Mãe</Label><Input value={patientMotherName} onChange={(e) => setPatientMotherName(e.target.value)} className="text-xs" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">Telefone</Label><Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} className="text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2"><Label className="text-[10px] text-muted-foreground">Endereço</Label><Input value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} className="text-xs" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">Município</Label><Input value={patientCity} onChange={(e) => setPatientCity(e.target.value)} className="text-xs" /></div>
                    <div className="grid grid-cols-2 gap-1">
                      <div><Label className="text-[10px] text-muted-foreground">UF</Label><Input value={patientUF} onChange={(e) => setPatientUF(e.target.value)} maxLength={2} className="text-xs" /></div>
                      <div><Label className="text-[10px] text-muted-foreground">CEP</Label><Input value={patientCEP} onChange={(e) => setPatientCEP(e.target.value)} className="text-xs" /></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Justificativa */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Justificativa da Internação</CardTitle>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={importAdmission} disabled={importingAdmission}>
                        <FileText className="h-3 w-3" /> {importingAdmission ? "..." : "Importar Admissão"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={importEvolution} disabled={importingEvolution}>
                        <ClipboardList className="h-3 w-3" /> {importingEvolution ? "..." : "Importar Evolução"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div><Label className="text-[10px] text-muted-foreground">17 — Principais Sinais e Sintomas Clínicos</Label><Textarea value={signsSymptoms} onChange={(e) => setSignsSymptoms(e.target.value)} rows={3} className="text-xs" placeholder="Descreva sinais e sintomas..." /></div>
                  <div><Label className="text-[10px] text-muted-foreground">18 — Condições que Justificam a Internação</Label><Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={3} className="text-xs" placeholder="Justifique a necessidade de internação..." /></div>
                  <div><Label className="text-[10px] text-muted-foreground">19 — Principais Resultados de Provas Diagnósticas</Label><Textarea value={examResults} onChange={(e) => setExamResults(e.target.value)} rows={3} className="text-xs" placeholder="Resultados de exames realizados..." /></div>
                  <div><Label className="text-[10px] text-muted-foreground">20 — Diagnóstico Inicial</Label><Input value={diagnosisInitial} onChange={(e) => setDiagnosisInitial(e.target.value)} className="text-xs" /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px] text-muted-foreground">21 — CID-10 Principal</Label><Input value={cidPrimary} onChange={(e) => setCidPrimary(e.target.value)} className="font-mono text-xs" placeholder="Ex: J18.9" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">22 — CID-10 Secundário</Label><Input value={cidSecondary} onChange={(e) => setCidSecondary(e.target.value)} className="font-mono text-xs" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">23 — CID-10 Causas Assoc.</Label><Input value={cidAssociated} onChange={(e) => setCidAssociated(e.target.value)} className="font-mono text-xs" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              {/* Procedimento */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Procedimento Solicitado</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={searchProcedure} onChange={(e) => setSearchProcedure(e.target.value)} placeholder="Buscar procedimento por nome ou código..." className="pl-8 text-xs" />
                  </div>
                  {filteredProcedures.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                      {filteredProcedures.map((proc) => (
                        <button key={proc.code} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors" onClick={() => selectProcedure(proc)}>
                          <span className="font-mono text-muted-foreground mr-2">{proc.code}</span>
                          <span>{proc.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div><Label className="text-[10px] text-muted-foreground">24 — Descrição do Procedimento</Label><Input value={procedureDescription} onChange={(e) => setProcedureDescription(e.target.value)} className="text-xs font-medium" /></div>
                  <div><Label className="text-[10px] text-muted-foreground">25 — Código do Procedimento</Label><Input value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)} className="font-mono text-xs" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px] text-muted-foreground">26 — Clínica</Label><Input value={clinica} onChange={(e) => setClinica(e.target.value)} placeholder="Ex: Clínica Médica" className="text-xs" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">27 — Caráter da Internação</Label>
                      <Select value={caraterInternacao} onValueChange={(v) => setCaraterInternacao(v as any)}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eletiva">Eletiva</SelectItem>
                          <SelectItem value="urgencia">Urgência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profissional */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profissional Solicitante</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div><Label className="text-[10px] text-muted-foreground">30 — Nome do Profissional</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="bg-muted/30 font-medium text-xs" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px] text-muted-foreground">CRM</Label><Input value={doctorCRM} onChange={(e) => setDoctorCRM(e.target.value)} className="bg-muted/30 font-mono text-xs" /></div>
                    <div><Label className="text-[10px] text-muted-foreground">CPF</Label><Input value={doctorCPF} onChange={(e) => setDoctorCPF(e.target.value)} placeholder="000.000.000-00" className="font-mono text-xs" /></div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Data da solicitação: <strong>{todayFormatted}</strong></p>
                </CardContent>
              </Card>

              {/* Causas Externas (collapsible) */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={showExternalCauses} onCheckedChange={(c) => setShowExternalCauses(!!c)} id="show-ext" />
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer" onClick={() => setShowExternalCauses(!showExternalCauses)}>
                      Causas Externas (Acidentes ou Violências)
                    </CardTitle>
                  </div>
                </CardHeader>
                {showExternalCauses && (
                  <CardContent className="space-y-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-xs"><Checkbox checked={acidenteTransito} onCheckedChange={(c) => setAcidenteTransito(!!c)} /> Acidente de Trânsito</label>
                      <label className="flex items-center gap-2 text-xs"><Checkbox checked={acidenteTrabalhoTipico} onCheckedChange={(c) => setAcidenteTrabalhoTipico(!!c)} /> Acidente Trabalho Típico</label>
                      <label className="flex items-center gap-2 text-xs"><Checkbox checked={acidenteTrabalhoTrajeto} onCheckedChange={(c) => setAcidenteTrabalhoTrajeto(!!c)} /> Acidente Trabalho Trajeto</label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-[10px] text-muted-foreground">CNPJ Seguradora</Label><Input value={cnpjSeguradora} onChange={(e) => setCnpjSeguradora(e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-[10px] text-muted-foreground">CNPJ Empresa</Label><Input value={cnpjEmpresa} onChange={(e) => setCnpjEmpresa(e.target.value)} className="text-xs" /></div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Vínculo Previdência */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">42 — Vínculo com a Previdência</CardTitle></CardHeader>
                <CardContent>
                  <RadioGroup value={vinculoPrevidencia} onValueChange={setVinculoPrevidencia} className="flex flex-wrap gap-3">
                    {["Empregado", "Empregador", "Autônomo", "Desempregado", "Aposentado", "Não Segurado"].map(v => (
                      <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <RadioGroupItem value={v} className="h-3.5 w-3.5" />{v}
                      </label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-xs" onClick={resetForm}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpar</Button>
                <Button className="flex-1 text-xs" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" /> Imprimir AIH</Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>

      {/* ── AIH Print Layout (padrão APAC: A4 retrato, página única) ── */}
      <div ref={printRef} className="hidden print:block">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
            .print\\:block { display: block !important; }
            .print\\:hidden { display: none !important; }
          }
          .aih-root {
            width: 186mm;
            height: 273mm;
            font-family: Arial, Helvetica, sans-serif;
            color: #000;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            margin: 0 auto;
          }
          .aih-root * { box-sizing: border-box; }
          .aih-doc-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 3px;
            margin-bottom: 0;
          }
          .aih-doc-header .aih-sus { font-size: 6.5pt; margin: 0; color: #333; }
          .aih-doc-header .aih-title { font-size: 9pt; font-weight: 700; margin: 2px 0 0 0; letter-spacing: 0.3px; }
          .aih-form {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            flex: 1;
          }
          .aih-form col.c1 { width: 16.66%; }
          .aih-form col.c2 { width: 16.66%; }
          .aih-form col.c3 { width: 16.66%; }
          .aih-form col.c4 { width: 16.66%; }
          .aih-form col.c5 { width: 16.66%; }
          .aih-form col.c6 { width: 16.7%; }
          .aih-form td, .aih-form th {
            border: 0.5pt solid #000;
            padding: 2px 4px;
            vertical-align: top;
            font-size: 8pt;
            line-height: 1.2;
          }
          .aih-form .sec {
            background: #1e293b;
            color: #fff;
            font-weight: 700;
            font-size: 7.5pt;
            padding: 2.5px 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            text-align: center;
          }
          .aih-form .lbl {
            font-size: 6.5pt;
            color: #555;
            display: block;
            line-height: 1.1;
            margin-bottom: 0.5px;
            white-space: nowrap;
          }
          .aih-form .val {
            font-size: 8.5pt;
            font-weight: 500;
            min-height: 11px;
            line-height: 1.2;
          }
          .aih-form .val-mono {
            font-family: 'Courier New', monospace;
            font-size: 8.5pt;
            font-weight: 600;
            min-height: 11px;
            line-height: 1.2;
          }
          .aih-form .just-cell {
            min-height: 42px;
            white-space: pre-wrap;
            font-size: 8pt;
            font-weight: 400;
            line-height: 1.3;
          }
          .aih-form .just-cell-lg {
            min-height: 60px;
            white-space: pre-wrap;
            font-size: 8pt;
            font-weight: 400;
            line-height: 1.3;
          }
          .aih-form .sig-space { height: 14px; }
          .aih-form .sig-space-sm { height: 10px; }
          .aih-form .chk { font-size: 7.5pt; }
        `}</style>
        <div className="aih-root">
          <div className="aih-doc-header">
            <p className="aih-sus">SISTEMA ÚNICO DE SAÚDE — SUS &nbsp;·&nbsp; MINISTÉRIO DA SAÚDE</p>
            <p className="aih-title">LAUDO PARA SOLICITAÇÃO DE AUTORIZAÇÃO DE INTERNAÇÃO HOSPITALAR</p>
          </div>

          <table className="aih-form">
            <colgroup><col className="c1"/><col className="c2"/><col className="c3"/><col className="c4"/><col className="c5"/><col className="c6"/></colgroup>
            <tbody>
              {/* ESTABELECIMENTO */}
              <tr><td colSpan={6} className="sec">Identificação do Estabelecimento de Saúde</td></tr>
              <tr>
                <td colSpan={4}><span className="lbl">1 — Nome do Estabelecimento Solicitante</span><div className="val">{AIH_INSTITUTION.solicitante}</div></td>
                <td colSpan={2}><span className="lbl">2 — CNES</span><div className="val-mono">{AIH_INSTITUTION.cnesSolicitante}</div></td>
              </tr>
              <tr>
                <td colSpan={4}><span className="lbl">3 — Nome do Estabelecimento Executante</span><div className="val">{AIH_INSTITUTION.executante}</div></td>
                <td colSpan={2}><span className="lbl">4 — CNES</span><div className="val-mono">{AIH_INSTITUTION.cnesExecutante}</div></td>
              </tr>

              {/* PACIENTE */}
              <tr><td colSpan={6} className="sec">Identificação do Paciente</td></tr>
              <tr>
                <td colSpan={4}><span className="lbl">5 — Nome do Paciente</span><div className="val">{aihPatientName.toUpperCase()}</div></td>
                <td colSpan={2}><span className="lbl">6 — Nº do Prontuário</span><div className="val">{patientRecord}</div></td>
              </tr>
              <tr>
                <td colSpan={2}><span className="lbl">7 — Cartão Nacional de Saúde (CNS)</span><div className="val">{patientCNS}</div></td>
                <td colSpan={2}><span className="lbl">8 — Data de Nascimento</span><div className="val">{formatDOB(patientDOB)}</div></td>
                <td colSpan={2}><span className="lbl">9 — Sexo</span><div className="val">{patientSex === "M" ? "Masc. (1)" : patientSex === "F" ? "Fem. (3)" : ""}</div></td>
              </tr>
              <tr>
                <td colSpan={3}><span className="lbl">10 — Nome da Mãe ou Responsável</span><div className="val">{patientMotherName.toUpperCase()}</div></td>
                <td colSpan={3}><span className="lbl">11 — Telefone de Contato</span><div className="val">{patientPhone}</div></td>
              </tr>
              <tr>
                <td colSpan={6}><span className="lbl">12 — Endereço (Rua, Nº, Bairro)</span><div className="val">{patientAddress.toUpperCase()}</div></td>
              </tr>
              <tr>
                <td colSpan={2}><span className="lbl">13 — Município de Residência</span><div className="val">{patientCity.toUpperCase()}</div></td>
                <td><span className="lbl">14 — Cód. IBGE</span><div className="val"></div></td>
                <td><span className="lbl">15 — UF</span><div className="val">{patientUF}</div></td>
                <td colSpan={2}><span className="lbl">16 — CEP</span><div className="val">{patientCEP}</div></td>
              </tr>

              {/* JUSTIFICATIVA */}
              <tr><td colSpan={6} className="sec">Justificativa da Internação</td></tr>
              <tr><td colSpan={6}><span className="lbl">17 — Principais Sinais e Sintomas Clínicos</span><div className="just-cell-lg">{signsSymptoms}</div></td></tr>
              <tr><td colSpan={6}><span className="lbl">18 — Condições que Justificam a Internação</span><div className="just-cell">{conditions}</div></td></tr>
              <tr><td colSpan={6}><span className="lbl">19 — Principais Resultados de Provas Diagnósticas (Resultados de Exames Realizados)</span><div className="just-cell">{examResults}</div></td></tr>
              <tr>
                <td colSpan={2}><span className="lbl">20 — Diagnóstico Inicial</span><div className="val">{diagnosisInitial.toUpperCase()}</div></td>
                <td><span className="lbl">21 — CID 10 Principal</span><div className="val-mono">{cidPrimary.toUpperCase()}</div></td>
                <td><span className="lbl">22 — CID 10 Secundário</span><div className="val-mono">{cidSecondary.toUpperCase()}</div></td>
                <td colSpan={2}><span className="lbl">23 — CID 10 Causas Associadas</span><div className="val-mono">{cidAssociated.toUpperCase()}</div></td>
              </tr>

              {/* PROCEDIMENTO */}
              <tr><td colSpan={6} className="sec">Procedimento Solicitado</td></tr>
              <tr>
                <td colSpan={4}><span className="lbl">24 — Descrição do Procedimento Solicitado</span><div className="val">{procedureDescription.toUpperCase()}</div></td>
                <td colSpan={2}><span className="lbl">25 — Código do Procedimento</span><div className="val-mono">{procedureCode}</div></td>
              </tr>
              <tr>
                <td><span className="lbl">26 — Clínica</span><div className="val">{clinica.toUpperCase()}</div></td>
                <td><span className="lbl">27 — Caráter da Internação</span><div className="val">{caraterInternacao === "urgencia" ? "Urgência" : "Eletiva"}</div></td>
                <td><span className="lbl">28 — Documento</span><div className="val">(X) CPF</div></td>
                <td colSpan={3}><span className="lbl">29 — Nº Documento (CNS/CPF) do Profissional</span><div className="val-mono">{doctorCPF}</div></td>
              </tr>
              <tr>
                <td colSpan={2}><span className="lbl">30 — Nome do Profissional Solicitante</span><div className="val">{doctorName.toUpperCase()}</div></td>
                <td><span className="lbl">31 — Data da Solicitação</span><div className="val">{todayFormatted}</div></td>
                <td colSpan={3}><span className="lbl">32 — Assinatura e Carimbo (Nº do Registro do Conselho)</span><div className="sig-space"></div><div className="val-mono" style={{ fontSize: "6.5pt" }}>CRM: {doctorCRM}</div></td>
              </tr>

              {/* CAUSAS EXTERNAS */}
              <tr><td colSpan={6} className="sec">Preencher em caso de Causas Externas (Acidentes ou Violências)</td></tr>
              <tr>
                <td colSpan={2} className="chk">
                  <div>33 — ({acidenteTransito ? "X" : " "}) Acidente de Trânsito</div>
                  <div>34 — ({acidenteTrabalhoTipico ? "X" : " "}) Acidente Trabalho Típico</div>
                  <div>35 — ({acidenteTrabalhoTrajeto ? "X" : " "}) Acidente Trabalho Trajeto</div>
                </td>
                <td colSpan={2}><span className="lbl">36 — CNPJ da Seguradora</span><div className="val">{cnpjSeguradora}</div></td>
                <td colSpan={2}><span className="lbl">39 — CNPJ Empresa</span><div className="val">{cnpjEmpresa}</div></td>
              </tr>

              {/* VÍNCULO PREVIDÊNCIA */}
              <tr>
                <td colSpan={6} className="chk" style={{ padding: "3px 4px" }}>
                  <span className="lbl" style={{ marginBottom: "2px" }}>42 — Vínculo com a Previdência</span>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {["Empregado", "Empregador", "Autônomo", "Desempregado", "Aposentado", "Não Segurado"].map(v => (
                      <span key={v}>({vinculoPrevidencia === v ? "X" : " "}) {v}</span>
                    ))}
                  </div>
                </td>
              </tr>

              {/* AUTORIZAÇÃO */}
              <tr><td colSpan={6} className="sec">Autorização</td></tr>
              <tr>
                <td colSpan={2}><span className="lbl">43 — Nome do Profissional Autorizador</span><div className="sig-space"></div></td>
                <td><span className="lbl">44 — Cód. Órgão Emissor</span><div className="sig-space"></div></td>
                <td colSpan={3}><span className="lbl">49 — Nº da Autorização de Internação Hospitalar</span><div className="sig-space"></div></td>
              </tr>
              <tr>
                <td><span className="lbl">45 — Documento</span><div className="val">( ) CNS ( ) CPF</div></td>
                <td colSpan={2}><span className="lbl">46 — Nº Documento do Profissional Autorizador</span><div className="sig-space"></div></td>
                <td colSpan={3}><span className="lbl">47 — Data da Autorização &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 48 — Assinatura e Carimbo</span><div className="sig-space"></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
