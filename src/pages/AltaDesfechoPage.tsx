import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientCockpit } from "@/components/PatientCockpit";
import { usePatientLive } from "@/hooks/usePatientLive";
import type { Patient } from "@/types/patient";

interface PatientCtx {
  id: string;
  name: string;
  bed: string;
  sector: string;
  age: string;
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  ClipboardList,
  FileText,
  Send,
  AlertTriangle,
  Printer,
  Save,
  Plus,
  Trash2,
  ArrowRight,
  Heart,
  Brain,
  Clock,
  User,
  Building2,
  Phone,
  MapPin,
  Stethoscope,
  Pill,
  Activity,
  Calendar,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";

// ── Discharge Summary Tab ──
function DischargeSummaryTab({ patient }: { patient: PatientCtx }) {
  const [form, setForm] = useState({
    patientName: patient.name,
    patientBed: patient.bed,
    medicalRecord: "",
    admissionDate: "",
    dischargeDate: new Date().toISOString().split("T")[0],
    dischargeType: "melhorado",
    attendingPhysician: "",
    crm: "",
    // Clinical
    admissionDiagnosis: "",
    finalDiagnoses: [""],
    procedures: [""],
    complications: "",
    // Discharge summary (clinical synthesis - distinct from orientations)
    dischargeSummary: "",
    // Orientations
    orientations: "",
    returnDate: "",
    returnSpecialty: "",
    restrictions: "",
    // Prescriptions
    dischargeMedications: [{ name: "", dose: "", frequency: "", duration: "", instructions: "" }],
    // Follow-up
    referralPrimary: false,
    referralSpecialty: "",
    referralNotes: "",
  });

  const addDiagnosis = () => setForm(f => ({ ...f, finalDiagnoses: [...f.finalDiagnoses, ""] }));
  const removeDiagnosis = (i: number) => setForm(f => ({ ...f, finalDiagnoses: f.finalDiagnoses.filter((_, idx) => idx !== i) }));
  const updateDiagnosis = (i: number, val: string) => setForm(f => ({ ...f, finalDiagnoses: f.finalDiagnoses.map((d, idx) => idx === i ? val : d) }));

  const addProcedure = () => setForm(f => ({ ...f, procedures: [...f.procedures, ""] }));
  const removeProcedure = (i: number) => setForm(f => ({ ...f, procedures: f.procedures.filter((_, idx) => idx !== i) }));
  const updateProcedure = (i: number, val: string) => setForm(f => ({ ...f, procedures: f.procedures.map((p, idx) => idx === i ? val : p) }));

  const addMedication = () => setForm(f => ({
    ...f,
    dischargeMedications: [...f.dischargeMedications, { name: "", dose: "", frequency: "", duration: "", instructions: "" }]
  }));
  const removeMedication = (i: number) => setForm(f => ({
    ...f,
    dischargeMedications: f.dischargeMedications.filter((_, idx) => idx !== i)
  }));
  const updateMedication = (i: number, field: string, val: string) => setForm(f => ({
    ...f,
    dischargeMedications: f.dischargeMedications.map((m, idx) => idx === i ? { ...m, [field]: val } : m)
  }));

  const handlePrint = () => {
    toast.info("Gerando sumário de alta para impressão...");
    // Future: open print preview
  };

  const handleSave = () => {
    toast.success("Sumário de alta salvo com sucesso!");
  };

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-6 pr-4 pb-8">
        {/* Patient & Administrative Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Dados do Paciente e Internação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do Paciente</Label>
                <Input value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} placeholder="Nome completo" className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Leito</Label>
                <Input value={form.patientBed} onChange={e => setForm(f => ({ ...f, patientBed: e.target.value }))} placeholder="Ex: V01" className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prontuário</Label>
                <Input value={form.medicalRecord} onChange={e => setForm(f => ({ ...f, medicalRecord: e.target.value }))} placeholder="Nº prontuário" className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Médico Responsável</Label>
                <Input value={form.attendingPhysician} onChange={e => setForm(f => ({ ...f, attendingPhysician: e.target.value }))} placeholder="Dr(a)..." className="text-xs h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data Admissão</Label>
                <Input type="date" value={form.admissionDate} onChange={e => setForm(f => ({ ...f, admissionDate: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data Alta</Label>
                <Input type="date" value={form.dischargeDate} onChange={e => setForm(f => ({ ...f, dischargeDate: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CRM</Label>
                <Input value={form.crm} onChange={e => setForm(f => ({ ...f, crm: e.target.value }))} placeholder="CRM" className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Alta</Label>
                <Select value={form.dischargeType} onValueChange={v => setForm(f => ({ ...f, dischargeType: v }))}>
                  <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="melhorado">Melhorado</SelectItem>
                    <SelectItem value="curado">Curado</SelectItem>
                    <SelectItem value="inalterado">Inalterado</SelectItem>
                    <SelectItem value="a_pedido">A pedido</SelectItem>
                    <SelectItem value="evasao">Evasão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="obito">Óbito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diagnoses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              Diagnósticos Finais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Diagnóstico de Admissão</Label>
              <Input value={form.admissionDiagnosis} onChange={e => setForm(f => ({ ...f, admissionDiagnosis: e.target.value }))} placeholder="Diagnóstico inicial na admissão" className="text-xs h-9" />
            </div>
            <Label className="text-xs font-medium">Diagnósticos Finais / CID</Label>
            {form.finalDiagnoses.map((d, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={d} onChange={e => updateDiagnosis(i, e.target.value)} placeholder={`Diagnóstico ${i + 1} (CID-10)`} className="text-xs h-9 flex-1" />
                {form.finalDiagnoses.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeDiagnosis(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addDiagnosis} className="text-xs h-8"><Plus className="h-3 w-3 mr-1" />Adicionar diagnóstico</Button>
          </CardContent>
        </Card>

        {/* Discharge Summary (clinical synthesis - distinct from orientations) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Sumário de Alta
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-1">
                (síntese clínica do internamento)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Label className="text-xs">
              Sumário clínico — diferente das orientações ao paciente
            </Label>
            <Textarea
              value={form.dischargeSummary}
              onChange={e => setForm(f => ({ ...f, dischargeSummary: e.target.value }))}
              placeholder="Motivo da internação, evolução, exames relevantes, tratamentos realizados, condição clínica na alta..."
              className="text-xs min-h-[140px]"
            />
            <p className="text-[10px] text-muted-foreground">
              Este texto compõe o sumário oficial enviado ao histórico do paciente e ao PDF Norma Zero.
            </p>
          </CardContent>
        </Card>

        {/* Procedures */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Procedimentos Realizados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.procedures.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={p} onChange={e => updateProcedure(i, e.target.value)} placeholder={`Procedimento ${i + 1}`} className="text-xs h-9 flex-1" />
                {form.procedures.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeProcedure(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addProcedure} className="text-xs h-8"><Plus className="h-3 w-3 mr-1" />Adicionar procedimento</Button>
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">Complicações durante internação</Label>
              <Textarea value={form.complications} onChange={e => setForm(f => ({ ...f, complications: e.target.value }))} placeholder="Descrever complicações, se houver" className="text-xs min-h-[60px]" />
            </div>
          </CardContent>
        </Card>

        {/* Orientations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Orientações de Alta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Orientações ao paciente/família</Label>
              <Textarea value={form.orientations} onChange={e => setForm(f => ({ ...f, orientations: e.target.value }))} placeholder="Cuidados domiciliares, sinais de alerta, dieta, atividade física..." className="text-xs min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data de Retorno</Label>
                <Input type="date" value={form.returnDate} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Especialidade para Retorno</Label>
                <Input value={form.returnSpecialty} onChange={e => setForm(f => ({ ...f, returnSpecialty: e.target.value }))} placeholder="Ex: Cardiologia" className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Restrições</Label>
                <Input value={form.restrictions} onChange={e => setForm(f => ({ ...f, restrictions: e.target.value }))} placeholder="Atividades, dieta..." className="text-xs h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discharge Prescriptions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              Receita de Alta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.dischargeMedications.map((med, i) => (
              <div key={i} className="p-3 border border-border rounded-lg space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Medicamento {i + 1}</span>
                  {form.dischargeMedications.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMedication(i)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Input value={med.name} onChange={e => updateMedication(i, "name", e.target.value)} placeholder="Nome" className="text-xs h-8" />
                  <Input value={med.dose} onChange={e => updateMedication(i, "dose", e.target.value)} placeholder="Dose" className="text-xs h-8" />
                  <Input value={med.frequency} onChange={e => updateMedication(i, "frequency", e.target.value)} placeholder="Frequência" className="text-xs h-8" />
                  <Input value={med.duration} onChange={e => updateMedication(i, "duration", e.target.value)} placeholder="Duração" className="text-xs h-8" />
                  <Input value={med.instructions} onChange={e => updateMedication(i, "instructions", e.target.value)} placeholder="Observações" className="text-xs h-8" />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addMedication} className="text-xs h-8"><Plus className="h-3 w-3 mr-1" />Adicionar medicamento</Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handlePrint} className="text-xs h-9">
            <Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir Sumário
          </Button>
          <Button onClick={handleSave} className="text-xs h-9">
            <Save className="h-3.5 w-3.5 mr-1.5" />Salvar Sumário de Alta
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Referral Tab ──
function ReferralTab({ patient }: { patient: PatientCtx }) {
  const [referralType, setReferralType] = useState<"primaria" | "especializada">("primaria");
  const [form, setForm] = useState({
    patientName: patient.name,
    medicalRecord: "",
    birthDate: "",
    cns: "",
    // Clinical
    clinicalSummary: "",
    currentMedications: "",
    relevantExams: "",
    diagnosisCid: "",
    // Referral
    reason: "",
    targetUnit: "",
    targetSpecialty: "",
    urgency: "eletiva",
    // Contact
    referringPhysician: "",
    referringCrm: "",
    referringUnit: "",
    contactPhone: "",
  });

  const handleSend = () => {
    toast.success("Encaminhamento registrado com sucesso!");
  };

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-6 pr-4 pb-8">
        {/* Referral Type Toggle */}
        <div className="flex gap-2">
          <Button
            variant={referralType === "primaria" ? "default" : "outline"}
            onClick={() => setReferralType("primaria")}
            className="text-xs h-9"
          >
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            Atenção Primária (UBS/ESF)
          </Button>
          <Button
            variant={referralType === "especializada" ? "default" : "outline"}
            onClick={() => setReferralType("especializada")}
            className="text-xs h-9"
          >
            <Stethoscope className="h-3.5 w-3.5 mr-1.5" />
            Atenção Especializada
          </Button>
        </div>

        {/* Patient ID */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Identificação do Paciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prontuário</Label>
                <Input value={form.medicalRecord} onChange={e => setForm(f => ({ ...f, medicalRecord: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data Nascimento</Label>
                <Input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CNS</Label>
                <Input value={form.cns} onChange={e => setForm(f => ({ ...f, cns: e.target.value }))} className="text-xs h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinical Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Resumo Clínico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Diagnóstico / CID-10</Label>
              <Input value={form.diagnosisCid} onChange={e => setForm(f => ({ ...f, diagnosisCid: e.target.value }))} placeholder="Ex: I21.0 - Infarto agudo do miocárdio" className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Resumo clínico e evolução</Label>
              <Textarea value={form.clinicalSummary} onChange={e => setForm(f => ({ ...f, clinicalSummary: e.target.value }))} placeholder="Breve resumo do quadro clínico, intervenções e evolução" className="text-xs min-h-[80px]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Medicamentos em uso</Label>
                <Textarea value={form.currentMedications} onChange={e => setForm(f => ({ ...f, currentMedications: e.target.value }))} placeholder="Lista de medicamentos atuais" className="text-xs min-h-[60px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exames relevantes</Label>
                <Textarea value={form.relevantExams} onChange={e => setForm(f => ({ ...f, relevantExams: e.target.value }))} placeholder="Resultados relevantes" className="text-xs min-h-[60px]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              {referralType === "primaria" ? "Contrarreferência — Atenção Primária" : "Referência — Atenção Especializada"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo do encaminhamento</Label>
              <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Motivo e orientações para a unidade de destino" className="text-xs min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{referralType === "primaria" ? "UBS/ESF de Destino" : "Serviço de Destino"}</Label>
                <Input value={form.targetUnit} onChange={e => setForm(f => ({ ...f, targetUnit: e.target.value }))} className="text-xs h-9" />
              </div>
              {referralType === "especializada" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Especialidade</Label>
                  <Input value={form.targetSpecialty} onChange={e => setForm(f => ({ ...f, targetSpecialty: e.target.value }))} className="text-xs h-9" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Urgência</Label>
                <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v }))}>
                  <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eletiva">Eletiva</SelectItem>
                    <SelectItem value="prioritaria">Prioritária</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Médico Referente</Label>
                <Input value={form.referringPhysician} onChange={e => setForm(f => ({ ...f, referringPhysician: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CRM</Label>
                <Input value={form.referringCrm} onChange={e => setForm(f => ({ ...f, referringCrm: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade de Origem</Label>
                <Input value={form.referringUnit} onChange={e => setForm(f => ({ ...f, referringUnit: e.target.value }))} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone Contato</Label>
                <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} className="text-xs h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" className="text-xs h-9">
            <Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir Guia
          </Button>
          <Button onClick={handleSend} className="text-xs h-9">
            <Send className="h-3.5 w-3.5 mr-1.5" />Registrar Encaminhamento
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Death & Outcomes Tab ──
function DeathOutcomeTab({ patient }: { patient: PatientCtx }) {
  const [activeSection, setActiveSection] = useState<"declaracao" | "morte_encefalica" | "cihdott">("declaracao");

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-6 pr-4 pb-8">
        {/* Section Toggle */}
        <div className="flex flex-wrap gap-2">
          <Button variant={activeSection === "declaracao" ? "default" : "outline"} onClick={() => setActiveSection("declaracao")} className="text-xs h-9">
            <FileText className="h-3.5 w-3.5 mr-1.5" />Declaração de Óbito
          </Button>
          <Button variant={activeSection === "morte_encefalica" ? "default" : "outline"} onClick={() => setActiveSection("morte_encefalica")} className="text-xs h-9">
            <Brain className="h-3.5 w-3.5 mr-1.5" />Protocolo de Morte Encefálica
          </Button>
          <Button variant={activeSection === "cihdott" ? "default" : "outline"} onClick={() => setActiveSection("cihdott")} className="text-xs h-9">
            <Heart className="h-3.5 w-3.5 mr-1.5" />Notificação CIHDOTT
          </Button>
        </div>

        {activeSection === "declaracao" && <DeathDeclarationSection patient={patient} />}
        {activeSection === "morte_encefalica" && <BrainDeathProtocolSection />}
        {activeSection === "cihdott" && <CihdottSection />}
      </div>
    </ScrollArea>
  );
}

function DeathDeclarationSection({ patient }: { patient: PatientCtx }) {
  const [form, setForm] = useState({
    patientName: patient.name,
    medicalRecord: "",
    birthDate: "",
    sex: "",
    motherName: "",
    // Death details
    deathDate: new Date().toISOString().split("T")[0],
    deathTime: "",
    deathLocation: "hospital",
    // Causes (DO pattern)
    deathSummary: "", // Resumo / relatório livre do óbito (substitui causa mortis estruturada)
    // Classification
    deathType: "natural",
    autopsyRequested: false,
    imlNotified: false,
    // Physician
    physicianName: "",
    physicianCrm: "",
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Identificação do Falecido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prontuário</Label>
              <Input value={form.medicalRecord} onChange={e => setForm(f => ({ ...f, medicalRecord: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data Nascimento</Label>
              <Input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sexo</Label>
              <Select value={form.sex} onValueChange={v => setForm(f => ({ ...f, sex: v }))}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Mãe</Label>
              <Input value={form.motherName} onChange={e => setForm(f => ({ ...f, motherName: e.target.value }))} className="text-xs h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Dados do Óbito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data do Óbito</Label>
              <Input type="date" value={form.deathDate} onChange={e => setForm(f => ({ ...f, deathDate: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora do Óbito</Label>
              <Input type="time" value={form.deathTime} onChange={e => setForm(f => ({ ...f, deathTime: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.deathType} onValueChange={v => setForm(f => ({ ...f, deathType: v }))}>
                <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="violenta">Violenta / Acidental</SelectItem>
                  <SelectItem value="suspeita">Suspeita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Local</Label>
              <Select value={form.deathLocation} onValueChange={v => setForm(f => ({ ...f, deathLocation: v }))}>
                <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hospital">Hospital</SelectItem>
                  <SelectItem value="domicilio">Domicílio</SelectItem>
                  <SelectItem value="via_publica">Via Pública</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Resumo do Óbito
          </CardTitle>
          <CardDescription className="text-xs">
            Relatório livre — descreva o histórico clínico relevante, a evolução até o óbito, manobras realizadas, horário da constatação e demais observações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.deathSummary}
            onChange={e => setForm(f => ({ ...f, deathSummary: e.target.value }))}
            placeholder="Descreva livremente o relatório do óbito..."
            className="text-xs min-h-[200px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Encaminhamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox checked={form.autopsyRequested} onCheckedChange={v => setForm(f => ({ ...f, autopsyRequested: !!v }))} />
              <Label className="text-xs">Necropsia solicitada</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.imlNotified} onCheckedChange={v => setForm(f => ({ ...f, imlNotified: !!v }))} />
              <Label className="text-xs">IML notificado (morte violenta/suspeita)</Label>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Médico Atestante</Label>
              <Input value={form.physicianName} onChange={e => setForm(f => ({ ...f, physicianName: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CRM</Label>
              <Input value={form.physicianCrm} onChange={e => setForm(f => ({ ...f, physicianCrm: e.target.value }))} className="text-xs h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" className="text-xs h-9"><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir DO</Button>
        <Button className="text-xs h-9" onClick={() => toast.success("Declaração de óbito registrada")}><Save className="h-3.5 w-3.5 mr-1.5" />Registrar Óbito</Button>
      </div>
    </div>
  );
}

function BrainDeathProtocolSection() {
  const [form, setForm] = useState({
    patientName: "",
    medicalRecord: "",
    causeOfComa: "",
    // Prerequisites
    prereqNoHypothermia: false,
    prereqNoSedation: false,
    prereqNoMetabolic: false,
    prereqNoShock: false,
    // First exam
    exam1Date: "",
    exam1Time: "",
    exam1Physician: "",
    exam1Crm: "",
    exam1ComaAreflexia: false,
    exam1AbsentPupillary: false,
    exam1AbsentCorneal: false,
    exam1AbsentVestibulo: false,
    exam1AbsentCough: false,
    exam1ApneaTest: false,
    // Second exam
    exam2Date: "",
    exam2Time: "",
    exam2Physician: "",
    exam2Crm: "",
    exam2ComaAreflexia: false,
    exam2AbsentPupillary: false,
    exam2AbsentCorneal: false,
    exam2AbsentVestibulo: false,
    exam2AbsentCough: false,
    exam2ApneaTest: false,
    // Complementary
    complementaryExam: "",
    complementaryDate: "",
    complementaryResult: "",
  });

  const ExamChecklist = ({ prefix, label }: { prefix: "exam1" | "exam2"; label: string }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={(form as any)[`${prefix}Date`]} onChange={e => setForm(f => ({ ...f, [`${prefix}Date`]: e.target.value }))} className="text-xs h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hora</Label>
            <Input type="time" value={(form as any)[`${prefix}Time`]} onChange={e => setForm(f => ({ ...f, [`${prefix}Time`]: e.target.value }))} className="text-xs h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Médico Examinador</Label>
            <Input value={(form as any)[`${prefix}Physician`]} onChange={e => setForm(f => ({ ...f, [`${prefix}Physician`]: e.target.value }))} className="text-xs h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CRM</Label>
            <Input value={(form as any)[`${prefix}Crm`]} onChange={e => setForm(f => ({ ...f, [`${prefix}Crm`]: e.target.value }))} className="text-xs h-9" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {[
            { key: `${prefix}ComaAreflexia`, label: "Coma aperceptivo / arreflexia" },
            { key: `${prefix}AbsentPupillary`, label: "Reflexo fotomotor ausente bilateral" },
            { key: `${prefix}AbsentCorneal`, label: "Reflexo corneopalpebral ausente bilateral" },
            { key: `${prefix}AbsentVestibulo`, label: "Reflexo vestíbulo-ocular ausente" },
            { key: `${prefix}AbsentCough`, label: "Reflexo de tosse ausente" },
            { key: `${prefix}ApneaTest`, label: "Teste de apneia positivo (sem mov. respiratório)" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox checked={(form as any)[key]} onCheckedChange={v => setForm(f => ({ ...f, [key]: !!v }))} />
              <Label className="text-xs">{label}</Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Protocolo de Morte Encefálica — Resolução CFM 2.173/2017
          </CardTitle>
          <CardDescription className="text-xs">
            Requer 2 exames clínicos por médicos diferentes + 1 exame complementar. Intervalo mínimo conforme faixa etária.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Paciente</Label>
              <Input value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Causa do Coma</Label>
              <Input value={form.causeOfComa} onChange={e => setForm(f => ({ ...f, causeOfComa: e.target.value }))} placeholder="Causa conhecida e irreversível" className="text-xs h-9" />
            </div>
          </div>
          <Separator />
          <Label className="text-xs font-medium">Pré-requisitos obrigatórios</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "prereqNoHypothermia", label: "Temperatura axilar > 35°C" },
              { key: "prereqNoSedation", label: "Sem efeito de sedativos/BNM" },
              { key: "prereqNoMetabolic", label: "Sem distúrbio metabólico grave" },
              { key: "prereqNoShock", label: "Sem hipotensão arterial" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox checked={(form as any)[key]} onCheckedChange={v => setForm(f => ({ ...f, [key]: !!v }))} />
                <Label className="text-xs">{label}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ExamChecklist prefix="exam1" label="1º Exame Clínico" />
      <ExamChecklist prefix="exam2" label="2º Exame Clínico" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Exame Complementar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Exame</Label>
              <Select value={form.complementaryExam} onValueChange={v => setForm(f => ({ ...f, complementaryExam: v }))}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eeg">Eletroencefalograma (EEG)</SelectItem>
                  <SelectItem value="doppler">Doppler Transcraniano</SelectItem>
                  <SelectItem value="angiografia">Angiografia Cerebral</SelectItem>
                  <SelectItem value="cintilografia">Cintilografia Cerebral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data/Hora</Label>
              <Input type="datetime-local" value={form.complementaryDate} onChange={e => setForm(f => ({ ...f, complementaryDate: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Resultado</Label>
              <Select value={form.complementaryResult} onValueChange={v => setForm(f => ({ ...f, complementaryResult: v }))}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compativel">Compatível com ME</SelectItem>
                  <SelectItem value="incompativel">Incompatível com ME</SelectItem>
                  <SelectItem value="inconclusivo">Inconclusivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" className="text-xs h-9"><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir Termo</Button>
        <Button className="text-xs h-9 bg-red-600 hover:bg-red-700" onClick={() => toast.success("Protocolo de ME registrado. CIHDOTT será notificada.")}><Save className="h-3.5 w-3.5 mr-1.5" />Concluir Protocolo ME</Button>
      </div>
    </div>
  );
}

function CihdottSection() {
  const [form, setForm] = useState({
    patientName: "",
    medicalRecord: "",
    age: "",
    sex: "",
    causeOfDeath: "",
    brainDeathDate: "",
    brainDeathTime: "",
    // Donor evaluation
    bloodType: "",
    weight: "",
    height: "",
    // Contraindications
    hasHIV: false,
    hasHTLV: false,
    hasSepsis: false,
    hasActiveNeoplasia: false,
    otherContraindications: "",
    // Family
    familyApproachDate: "",
    familyApproachTime: "",
    familyConsented: "",
    familyContactName: "",
    familyRelationship: "",
    familyPhone: "",
    refusalReason: "",
    // Organs
    organsOffered: [] as string[],
    // Central
    centralNotifiedDate: "",
    centralNotifiedTime: "",
    centralContactPerson: "",
    protocolNumber: "",
  });

  const organOptions = [
    "Coração", "Pulmões", "Fígado", "Rins", "Pâncreas", "Intestino",
    "Córneas", "Pele", "Ossos", "Tendões", "Valvas Cardíacas", "Vasos Sanguíneos",
  ];

  const toggleOrgan = (organ: string) => {
    setForm(f => ({
      ...f,
      organsOffered: f.organsOffered.includes(organ)
        ? f.organsOffered.filter(o => o !== organ)
        : [...f.organsOffered, organ],
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-emerald-600" />
            Notificação CIHDOTT — Comissão Intra-Hospitalar de Doação de Órgãos e Tecidos
          </CardTitle>
          <CardDescription className="text-xs">
            Toda morte encefálica DEVE ser notificada, independente de ser potencial doador. Lei 9.434/97.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Paciente</Label>
              <Input value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prontuário</Label>
              <Input value={form.medicalRecord} onChange={e => setForm(f => ({ ...f, medicalRecord: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Idade</Label>
              <Input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Causa do Óbito / ME</Label>
              <Input value={form.causeOfDeath} onChange={e => setForm(f => ({ ...f, causeOfDeath: e.target.value }))} className="text-xs h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Donor Evaluation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Avaliação do Potencial Doador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo Sanguíneo</Label>
              <Select value={form.bloodType} onValueChange={v => setForm(f => ({ ...f, bloodType: v }))}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Peso (kg)</Label>
              <Input value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Altura (cm)</Label>
              <Input value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} className="text-xs h-9" />
            </div>
          </div>
          <Separator />
          <Label className="text-xs font-medium text-red-500">Contraindicações absolutas</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "hasHIV", label: "HIV positivo" },
              { key: "hasHTLV", label: "HTLV I/II positivo" },
              { key: "hasSepsis", label: "Sepse refratária" },
              { key: "hasActiveNeoplasia", label: "Neoplasia maligna ativa" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox checked={(form as any)[key]} onCheckedChange={v => setForm(f => ({ ...f, [key]: !!v }))} />
                <Label className="text-xs">{label}</Label>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Outras contraindicações</Label>
            <Input value={form.otherContraindications} onChange={e => setForm(f => ({ ...f, otherContraindications: e.target.value }))} className="text-xs h-9" />
          </div>
        </CardContent>
      </Card>

      {/* Organs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Órgãos e Tecidos Ofertados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {organOptions.map(organ => (
              <div key={organ} className="flex items-center gap-1.5">
                <Checkbox checked={form.organsOffered.includes(organ)} onCheckedChange={() => toggleOrgan(organ)} />
                <Label className="text-[10px]">{organ}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Family Approach */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Entrevista Familiar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data Entrevista</Label>
              <Input type="date" value={form.familyApproachDate} onChange={e => setForm(f => ({ ...f, familyApproachDate: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={form.familyApproachTime} onChange={e => setForm(f => ({ ...f, familyApproachTime: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Familiar Responsável</Label>
              <Input value={form.familyContactName} onChange={e => setForm(f => ({ ...f, familyContactName: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Grau de Parentesco</Label>
              <Input value={form.familyRelationship} onChange={e => setForm(f => ({ ...f, familyRelationship: e.target.value }))} className="text-xs h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Consentimento</Label>
              <Select value={form.familyConsented} onValueChange={v => setForm(f => ({ ...f, familyConsented: v }))}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim — Autorizado</SelectItem>
                  <SelectItem value="nao">Não — Recusado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.familyPhone} onChange={e => setForm(f => ({ ...f, familyPhone: e.target.value }))} className="text-xs h-9" />
            </div>
            {form.familyConsented === "nao" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Motivo da Recusa</Label>
                <Input value={form.refusalReason} onChange={e => setForm(f => ({ ...f, refusalReason: e.target.value }))} className="text-xs h-9" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Central Notification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Notificação à Central de Transplantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data Notificação</Label>
              <Input type="date" value={form.centralNotifiedDate} onChange={e => setForm(f => ({ ...f, centralNotifiedDate: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={form.centralNotifiedTime} onChange={e => setForm(f => ({ ...f, centralNotifiedTime: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Responsável na Central</Label>
              <Input value={form.centralContactPerson} onChange={e => setForm(f => ({ ...f, centralContactPerson: e.target.value }))} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nº Protocolo</Label>
              <Input value={form.protocolNumber} onChange={e => setForm(f => ({ ...f, protocolNumber: e.target.value }))} className="text-xs h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" className="text-xs h-9"><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir Notificação</Button>
        <Button className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700" onClick={() => toast.success("Notificação CIHDOTT registrada com sucesso")}><Save className="h-3.5 w-3.5 mr-1.5" />Registrar Notificação</Button>
      </div>
    </div>
  );
}


// ── Main Page ──
export default function AltaDesfechoPage() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const patientName =
    searchParams.get("patientName") || searchParams.get("patient") || "";
  const patientBed =
    searchParams.get("patientBed") || searchParams.get("bed") || "";
  const patientSector = searchParams.get("patientSector") || "";
  const patientAge = searchParams.get("patientAge") || "";

  const patientCtx: PatientCtx = {
    id: patientId,
    name: patientName,
    bed: patientBed,
    sector: patientSector,
    age: patientAge,
  };

  // Live patient data for cockpit (subscribed via realtime)
  const { patient: livePatient } = usePatientLive(patientId || null);

  const cockpitPatient: Patient = useMemo(() => {
    if (livePatient) return livePatient;
    return {
      id: patientId || "alta-stub",
      bedNumber: patientBed,
      name: patientName,
      age: patientAge.replace(/\s*anos?$/i, ""),
      sector: (patientSector as Patient["sector"]) || "outside",
      diagnoses: [],
      medicalHistory: [],
      relevantExams: [],
      pendencies: [],
      schedule: [],
      admissionHistory: "",
      utiAllergies: [],
      clinicalStatus: "regular",
    } as Patient;
  }, [livePatient, patientId, patientName, patientBed, patientSector, patientAge]);

  const hasPatient = !!(patientId || patientName);

  return (
    <div className="flex">
      <div className="flex-1 min-w-0 p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <ArrowRight className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">Alta e Desfecho</h1>
            <p className="text-xs text-muted-foreground truncate">
              {hasPatient
                ? `${patientName}${patientBed ? ` • Leito ${patientBed}` : ""}${patientSector ? ` • ${patientSector.toUpperCase()}` : ""}`
                : "Selecione um paciente pelo cockpit ou painel clínico"}
            </p>
          </div>
        </div>

        <Tabs defaultValue="sumario" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="sumario" className="text-xs gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Sumário de Alta
            </TabsTrigger>
            <TabsTrigger value="referencia" className="text-xs gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Referência
            </TabsTrigger>
            <TabsTrigger value="obito" className="text-xs gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Óbito
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sumario" className="mt-4">
            <DischargeSummaryTab patient={patientCtx} />
          </TabsContent>
          <TabsContent value="referencia" className="mt-4">
            <ReferralTab patient={patientCtx} />
          </TabsContent>
          <TabsContent value="obito" className="mt-4">
            <DeathOutcomeTab patient={patientCtx} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Patient Cockpit — fixed right sidebar */}
      <PatientCockpit patient={cockpitPatient} />
    </div>
  );
}
