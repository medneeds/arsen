import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toSexoDb } from "@/lib/sexo";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment, departmentForSector } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BedDouble, Brain,
  AlertTriangle, Loader2, Calendar, Activity, CalendarIcon
} from "lucide-react";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";
// MIGRAÇÃO: PisRegistrySyncDialog (sincronizava patient_registry — tabela morta) removido.

// MIGRAÇÃO: profissional_id (profissionais.id) ≠ auth.uid — resolvido via profissionais.user_id.
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

// MIGRAÇÃO: Patient.sector ← setores.nome (usePatientLive) → o código do setor está em setores.nome.
async function resolveSetorId(code: string): Promise<string | null> {
  if (!code) return null;
  try {
    const { data } = await supabase
      .from("setores")
      .select("id")
      .eq("nome", code)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

const bedSortNumber = (s: string) => {
  const m = (s || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

// MIGRAÇÃO: os leitos agora vêm DO BANCO (tabela `leitos` do setor). A lista de
// leitos para alocação é a real (numero + status), não mais gerada por
// SECTOR_BED_CONFIG. O config legado só é usado como fallback quando o setor
// ainda não tem leitos cadastrados. "EXTRA" (maca extra) é sempre ofertado.
async function loadSectorBeds(
  setorId: string | null,
  code: string,
): Promise<{ beds: string[]; occupied: string[]; full: boolean }> {
  let rows: { numero: string; status: string; internacoes?: { data_alta: string | null }[] }[] = [];
  if (setorId) {
    // Inclui internações do leito para derivar ocupação da INTERNAÇÃO ATIVA
    // (fonte da verdade), mesmo que leitos.status esteja dessincronizado.
    const { data } = await supabase
      .from("leitos")
      .select("numero, status, internacoes(data_alta)")
      .eq("setor_id", setorId);
    rows = ((data as any[]) || []).filter((r) => !!r?.numero);
  }
  // Ocupado = status indisponível OU tem internação ativa (data_alta null).
  const hasActive = (r: any) => (r.internacoes || []).some((i: any) => !i.data_alta);
  const occupied = rows.filter((r) => r.status !== "livre" || hasActive(r)).map((r) => r.numero);

  if (rows.length > 0) {
    const beds = rows.map((r) => r.numero).sort((a, b) => bedSortNumber(a) - bedSortNumber(b));
    const freeCount = beds.length - occupied.length;
    return { beds: [...beds, "EXTRA"], occupied, full: freeCount <= 0 };
  }

  // Fallback legado: setor sem leitos no banco → gera pela config antiga.
  const config = SECTOR_BED_CONFIG[code];
  if (config) {
    const start = config.startNumber ?? 1;
    const end = start + config.maxRegularBeds - 1;
    const beds: string[] = [];
    for (let i = start; i <= end; i++) beds.push(`${config.prefix}${String(i).padStart(2, "0")}`);
    const freeCount = beds.filter((b) => !occupied.includes(b)).length;
    return { beds: [...beds, "EXTRA"], occupied, full: freeCount <= 0 };
  }
  return { beds: ["EXTRA"], occupied, full: false };
}

interface PreAdmissionFull {
  id: string;
  /** MIGRAÇÃO: paciente já criado no cadastro da pré-admissão (dados_extraidos_ia.paciente_id). */
  paciente_id?: string | null;
  patient_name: string;
  social_name?: string | null;
  birth_date: string | null;
  sex: string | null;
  medical_record: string | null;
  cpf: string | null;
  cns: string | null;
  mother_name: string | null;
  phone: string | null;
  destination_sector: string | null;
  status: string;
  risk_classification: string | null;
  chief_complaint: string | null;
  vital_signs: any;
  glasgow_score: number | null;
  glasgow_detail: any;
  airway_patent: boolean | null;
  airway_obstruction: boolean | null;
  airway_intubated: boolean | null;
  allergies: string | null;
  flu_symptoms: boolean | null;
  flu_symptoms_detail: string | null;
  peripheral_perfusion: string | null;
  pulse_quality: string | null;
  pain_scale: number | null;
  oxygen_therapy: boolean | null;
  oxygen_therapy_detail: string | null;
  triage_notes: string | null;
  notes: string | null;
  created_at: string;
}

// MIGRAÇÃO: pre_admissoes só tem colunas de identificação/triagem básicas
// (nome_paciente, cpf, cns, data_nascimento, classificacao_risco, setor_destino_id,
// dados_extraidos_ia Json, status, data_hora). Todo o bloco clínico rico do modelo
// antigo (vital_signs, glasgow, allergies, chief_complaint, airway_*, oxygen_therapy,
// triage_notes, sex, mother_name, phone, medical_record, social_name, notes...) NÃO
// tem coluna → é lido de `dados_extraidos_ia` (Json) quando presente, senão degrada a
// null e a seção correspondente da UI simplesmente não renderiza.
function mapPreAdmissao(raw: any): PreAdmissionFull {
  const ia = (raw?.dados_extraidos_ia as any) || {};
  const pick = <T,>(k: string): T | null => (ia[k] ?? null);
  return {
    id: raw.id,
    paciente_id: pick<string>("paciente_id"),
    patient_name: raw.nome_paciente,
    social_name: pick<string>("social_name"),
    birth_date: raw.data_nascimento ?? null,
    sex: pick<string>("sex"),
    medical_record: pick<string>("medical_record"),
    cpf: raw.cpf ?? null,
    cns: raw.cns ?? null,
    mother_name: pick<string>("mother_name"),
    phone: pick<string>("phone"),
    destination_sector: null, // setor_destino_id é id, não label → degradado
    status: raw.status,
    risk_classification: raw.classificacao_risco ?? null,
    chief_complaint: pick<string>("chief_complaint"),
    vital_signs: ia.vital_signs ?? null,
    glasgow_score: pick<number>("glasgow_score"),
    glasgow_detail: ia.glasgow_detail ?? null,
    airway_patent: pick<boolean>("airway_patent"),
    airway_obstruction: pick<boolean>("airway_obstruction"),
    airway_intubated: pick<boolean>("airway_intubated"),
    allergies: pick<string>("allergies"),
    flu_symptoms: pick<boolean>("flu_symptoms"),
    flu_symptoms_detail: pick<string>("flu_symptoms_detail"),
    peripheral_perfusion: pick<string>("peripheral_perfusion"),
    pulse_quality: pick<string>("pulse_quality"),
    pain_scale: pick<number>("pain_scale"),
    oxygen_therapy: pick<boolean>("oxygen_therapy"),
    oxygen_therapy_detail: pick<string>("oxygen_therapy_detail"),
    triage_notes: pick<string>("triage_notes"),
    notes: pick<string>("notes"),
    created_at: raw.criado_em ?? raw.data_hora ?? new Date().toISOString(),
  };
}

interface AdmitPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preAdmission: { id: string; patient_name: string; risk_classification?: string | null } | null;
  onSuccess: () => void;
}

const RISK_COLORS: Record<string, string> = {
  vermelho: "bg-red-600 text-white",
  laranja: "bg-orange-500 text-white",
  amarelo: "bg-yellow-500 text-black",
  verde: "bg-green-600 text-white",
  azul: "bg-blue-600 text-white",
  branca: "bg-white text-slate-900 border border-slate-400",
};

const RISK_LABELS: Record<string, string> = {
  vermelho: "EMERGÊNCIA",
  laranja: "MUITO URGENTE",
  amarelo: "URGENTE",
  verde: "POUCO URGENTE",
  azul: "NÃO URGENTE",
  branca: "FICHA BRANCA",
};

const SECTORS = [
  { value: "red", label: "UTI 1", color: "text-red-500" },
  { value: "yellow", label: "UTI 2", color: "text-yellow-500" },
  { value: "blue", label: "UCI 1", color: "text-blue-500" },
  { value: "outside", label: "UCI 2", color: "text-emerald-500" },
  { value: "ucc", label: "UCC", color: "text-cyan-600" },
];

export function AdmitPatientDialog({ open, onOpenChange, preAdmission, onSuccess }: AdmitPatientDialogProps) {
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedBed, setSelectedBed] = useState("");
  const [admissionNotes, setAdmissionNotes] = useState("");
  const [dischargeDays, setDischargeDays] = useState<string>("");
  const [dischargeDate, setDischargeDate] = useState<Date | undefined>(undefined);
  const [noDischargePrediction, setNoDischargePrediction] = useState(false);
  const [admissionDate, setAdmissionDate] = useState<Date | undefined>(undefined);
  const [availableBeds, setAvailableBeds] = useState<string[]>([]);
  const [occupiedBeds, setOccupiedBeds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullData, setFullData] = useState<PreAdmissionFull | null>(null);
  const [sectorFullAlert, setSectorFullAlert] = useState(false);
  const [extraBedRequested, setExtraBedRequested] = useState(false);
  const [bedsLoaded, setBedsLoaded] = useState(false);

  // MIGRAÇÃO: estados da sincronização PIS → patient_registry removidos (tabela morta).

  const { currentHospital, currentState } = useHospital();
  const { currentDepartment, currentSectorCode } = useDepartment();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch everything in parallel on open
  useEffect(() => {
    if (!open) return;
    const storedSector = currentSectorCode || localStorage.getItem("selected_sector") || "red";
    setSelectedSector(storedSector);
    setSelectedBed("");
    setExtraBedRequested(false);
    setSectorFullAlert(false);
    setBedsLoaded(false);
    setDischargeDays("");
    setDischargeDate(undefined);
    setNoDischargePrediction(false);
    // Sugestão automática: agora (editável pelo usuário antes de confirmar)
    setAdmissionDate(new Date());

    // MIGRAÇÃO: internacoes/pacientes/leitos/setores não têm hospital_unit_id/state_id —
    // o gate por currentHospital/currentState foi removido (contextos não são mais chave).
    if (!preAdmission?.id) return;

    const fetchAll = async () => {
      // MIGRAÇÃO: pre_admissions → pre_admissoes. Ocupação de leitos vem de `leitos`
      // (status='ocupado') do setor, resolvido via setores.nome === código do setor.
      const setorId = await resolveSetorId(storedSector);
      const [preAdmRes, bedsInfo] = await Promise.all([
        supabase
          .from("pre_admissoes")
          .select("*")
          .eq("id", preAdmission.id)
          .single(),
        loadSectorBeds(setorId, storedSector),
      ]);

      if (preAdmRes.data) setFullData(mapPreAdmissao(preAdmRes.data as any));

      setOccupiedBeds(bedsInfo.occupied);
      setAvailableBeds(bedsInfo.beds);
      setSectorFullAlert(bedsInfo.full);
      setBedsLoaded(true);
    };
    fetchAll();
  }, [open, preAdmission?.id, currentHospital?.id, currentState?.id, currentDepartment, currentSectorCode]);

  // Re-fetch beds when sector changes manually (from the full-alert dropdown)
  const handleSectorChange = async (newSector: string) => {
    setSelectedSector(newSector);
    setSelectedBed("");
    setExtraBedRequested(false);
    setBedsLoaded(false);

    // MIGRAÇÃO: leitos vêm do banco (tabela `leitos` do setor, via setores.nome === código).
    const setorId = await resolveSetorId(newSector);
    const bedsInfo = await loadSectorBeds(setorId, newSector);
    setOccupiedBeds(bedsInfo.occupied);
    setAvailableBeds(bedsInfo.beds);
    setSectorFullAlert(bedsInfo.full);
    setBedsLoaded(true);
  };

  const calcAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return Math.floor((Date.now() - new Date(birthDate + 'T12:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  // SAPS 3 é exclusivo para UTI 1, UTI 2 e UCI 2. UCI 1 (blue) segue fluxo de enfermaria.
  const isUtiAdmission =
    selectedSector === "red" ||
    selectedSector === "yellow" ||
    selectedSector === "outside";

  const handleAdmit = async () => {
    // MIGRAÇÃO: gate por currentHospital/currentState removido (sem colunas no schema novo).
    if (!selectedSector || !fullData) return;
    if (!isUtiAdmission && !selectedBed) return;

    // Bloqueia data/hora de admissão futura
    if (admissionDate && admissionDate.getTime() > Date.now()) {
      toast({
        title: "Data de admissão inválida",
        description: "Não é permitido registrar admissão com data ou horário futuros.",
        variant: "destructive",
      });
      return;
    }

    // MIGRAÇÃO: sincronização PIS → patient_registry REMOVIDA (patient_registry morto).
    // O bloco de diff/PisRegistrySyncDialog não tem tabela de destino no schema novo.

    setIsSubmitting(true);
    try {
      const age = calcAge(fullData.birth_date);
      const destinationSectorLabel = SECTORS.find((sector) => sector.value === selectedSector)?.label || selectedSector;

      if (isUtiAdmission) {
        // Calcula o leito final (incluindo EXTRA dinâmico) já neste pop-up
        let finalBedUti = selectedBed;
        if (selectedBed === "EXTRA" || extraBedRequested) {
          const extraBeds = occupiedBeds
            .filter(b => b.startsWith("EXTRA"))
            .map(b => parseInt(b.replace("EXTRA", ""), 10))
            .filter(n => !isNaN(n));
          const nextExtra = extraBeds.length > 0 ? Math.max(...extraBeds) + 1 : 1;
          finalBedUti = `EXTRA${nextExtra}`;
        }
        if (!finalBedUti) {
          toast({ title: "Selecione um leito", description: "Escolha o leito antes de continuar para o SAPS 3.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        // MIGRAÇÃO: pre_admissions → pre_admissoes. Colunas destination_sector/destination_bed/
        // notes NÃO existem → degradadas (o leito/setor escolhidos seguem apenas via URL para o
        // SAPS 3, que conclui a admissão). Persistimos só o status.
        const { error: updateError } = await supabase
          .from("pre_admissoes")
          .update({ status: "classificado" })
          .eq("id", fullData.id);

        if (updateError) throw updateError;

        const params = new URLSearchParams({
          fromAllocation: "true",
          preAdmissionId: fullData.id,
          patientName: fullData.patient_name,
          patientAge: age ? String(age) : "",
          destinationSector: destinationSectorLabel,
          selectedBed: finalBedUti,
          selectedSector,
        });
        if (extraBedRequested || selectedBed === "EXTRA") params.set("extraBed", "true");

        toast({
          title: "Encaminhado para admissão UTI",
          description: "Preencha o SAPS 3 antes de definir o leito.",
        });

        onOpenChange(false);
        onSuccess();
        setSelectedSector("");
        setSelectedBed("");
        setAdmissionNotes("");
        setFullData(null);
        setExtraBedRequested(false);
        setSectorFullAlert(false);
        navigate(`/saps3?${params.toString()}`);
        return;
      }

      let finalBed = selectedBed;
      if (selectedBed === "EXTRA") {
        const extraBeds = occupiedBeds.filter(b => b.startsWith("EXTRA")).map(b => parseInt(b.replace("EXTRA", ""), 10)).filter(n => !isNaN(n));
        const nextExtra = extraBeds.length > 0 ? Math.max(...extraBeds) + 1 : 1;
        finalBed = `EXTRA${nextExtra}`;
      }

      // MIGRAÇÃO: a mega-tabela `patients` (leito+paciente) foi substituída por
      // leitos + pacientes + internacoes. Admitir = garantir leito → garantir paciente →
      // criar internação apontando para ambos → marcar leito ocupado.
      const setorId = await resolveSetorId(selectedSector);
      if (!setorId) {
        throw new Error(`Setor "${selectedSector}" não encontrado no cadastro (setores). Configure o setor antes de admitir.`);
      }

      // 1) Leito: localiza a linha do leito pelo (setor_id, numero); cria se não existir
      //    (ex.: leitos EXTRA dinâmicos). Bloqueia se já estiver ocupado.
      const { data: existingLeito } = await supabase
        .from("leitos")
        .select("id, status")
        .eq("setor_id", setorId)
        .eq("numero", finalBed)
        .maybeSingle();

      if (existingLeito && existingLeito.status === "ocupado") {
        throw new Error(`Leito ${finalBed} já está ocupado. Atualize o mapa e selecione outro leito.`);
      }

      let leitoId = (existingLeito as any)?.id ?? null;
      if (!leitoId) {
        const { data: newLeito, error: leitoErr } = await supabase
          .from("leitos")
          .insert({
            setor_id: setorId,
            numero: finalBed,
            status: "livre",
            tipo: finalBed.startsWith("EXTRA") ? "maca" : "leito",
          })
          .select("id")
          .single();
        if (leitoErr) throw leitoErr;
        leitoId = (newLeito as any).id;
      }

      // MIGRAÇÃO: arquivamento defensivo (RPC archive_patient_bed_data) REMOVIDO — a RPC não
      // existe no backend novo e a colisão de ocupante não ocorre (leito só ocupa via internação).

      // 2) Paciente: REAPROVEITA o paciente já criado no cadastro da pré-admissão
      //    (dados_extraidos_ia.paciente_id); senão por CPF; senão pelo prontuário
      //    já gravado (medical_record). Só cria um novo se nada casar — evita o
      //    "duplicate key pacientes_prontuario_key" que ocorria ao recriar o paciente.
      let pacienteId: string | null = fullData.paciente_id ?? null;
      if (pacienteId) {
        // Confirma que o paciente ainda existe (id pode estar obsoleto).
        const { data: byId } = await supabase.from("pacientes").select("id").eq("id", pacienteId).maybeSingle();
        pacienteId = (byId as any)?.id ?? null;
      }
      if (!pacienteId && fullData.cpf) {
        const { data: existingPac } = await supabase
          .from("pacientes")
          .select("id")
          .eq("cpf", fullData.cpf)
          .maybeSingle();
        pacienteId = (existingPac as any)?.id ?? null;
      }
      if (!pacienteId && fullData.medical_record) {
        const { data: byProntuario } = await supabase
          .from("pacientes")
          .select("id")
          .eq("prontuario", fullData.medical_record)
          .maybeSingle();
        pacienteId = (byProntuario as any)?.id ?? null;
      }
      if (!pacienteId) {
        // MIGRAÇÃO: pacientes.prontuario é NOT NULL e pre_admissoes não carrega prontuário/
        // medical_record próprio → usa medical_record (de dados_extraidos_ia) / cpf / cns como
        // identificador, com fallback derivado do id da pré-admissão. Nenhum dado clínico inventado.
        const prontuario =
          fullData.medical_record || fullData.cpf || fullData.cns || `PA-${String(fullData.id).slice(0, 8)}`;
        const { data: newPac, error: pacErr } = await supabase
          .from("pacientes")
          .insert({
            nome_completo: fullData.patient_name,
            nome_social: fullData.social_name ?? null,
            cpf: fullData.cpf ?? null,
            cns: fullData.cns ?? null,
            data_nascimento: fullData.birth_date ?? null,
            sexo: toSexoDb(fullData.sex),
            nome_mae: fullData.mother_name ?? null,
            telefone: fullData.phone ?? null,
            alergias: fullData.allergies ?? null,
            prontuario,
          })
          .select("id")
          .single();
        if (pacErr) throw pacErr;
        pacienteId = (newPac as any).id;
      }

      // 3) Internação. patient.id (view-model) === internacoes.id.
      // MIGRAÇÃO/DEGRADADO: sem colunas para o bloco uti_*, clinical_status, admission_status,
      // admitted_at, is_vacant, previsão de alta, medical_responsibility, highlights, saps_*,
      // department, hospital/state → não gravados. queixa/alergias/pendências mapeadas para
      // internacoes. status='pre_admitido' preserva o significado do antigo admission_status.
      const registradoPor = await resolveProfissionalId(user?.id);
      const { error: interErr } = await supabase
        .from("internacoes")
        .insert({
          paciente_id: pacienteId,
          leito_id: leitoId,
          setor_classificacao_id: setorId,
          data_entrada: (admissionDate ?? new Date()).toISOString(),
          status: "ativa",
          queixa_principal: fullData.chief_complaint || null,
          historia_clinica: fullData.allergies ? `Alergias: ${fullData.allergies}` : null,
          pendencias: admissionNotes || null,
          registrado_por: registradoPor,
        });
      if (interErr) throw interErr;

      // 4) Ocupa o leito.
      await supabase.from("leitos").update({ status: "ocupado" }).eq("id", leitoId);

      // MIGRAÇÃO: vínculo de medical_records ao paciente REMOVIDO (medical_records morto;
      // prontuário vive em pacientes.prontuario).

      // 5) Atualiza a pré-admissão. destination_sector/destination_bed inexistentes → degradados;
      // setor_destino_id (id do setor) e internacao_id são preservados.
      const { error: updateError } = await supabase
        .from("pre_admissoes")
        .update({
          status: "admitido",
          setor_destino_id: setorId,
        })
        .eq("id", fullData.id);

      if (updateError) throw updateError;

      toast({ title: "Paciente PRÉ-ADMITIDO", description: `${fullData.patient_name} → Leito ${finalBed}. Conclua a admissão hospitalar pelo Painel Clínico.` });
      onOpenChange(false);
      onSuccess();
      setSelectedSector("");
      setSelectedBed("");
      setAdmissionNotes("");
      setFullData(null);
      setExtraBedRequested(false);
      setSectorFullAlert(false);
    } catch (err: any) {
      toast({ title: "Erro na admissão", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!preAdmission) return null;
  
  if (!fullData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const pa = fullData;
  const vs = pa.vital_signs || {};
  const gd = pa.glasgow_detail || {};
  const age = calcAge(pa.birth_date);

  const airwayStatus = pa.airway_intubated ? "IOT/Intubado" : pa.airway_obstruction ? "Obstruída" : pa.airway_patent ? "Pérvias" : "—";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            Pré-admissão em Leito
          </DialogTitle>
          <DialogDescription>
            Aloca o paciente no leito e prepara o SAPS 3 quando indicado. A admissão hospitalar (HDA, exame físico, plano) é feita depois pelo Painel Clínico.
          </DialogDescription>
        </DialogHeader>

        {/* Patient Header */}
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50 border">
          <div>
            <p className="patient-id font-bold text-sm">{pa.patient_name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {age !== null && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{age} anos</span>}
              {pa.sex && <span>• {pa.sex}</span>}
              {pa.medical_record && <span>• Pront: {pa.medical_record}</span>}
            </div>
            {pa.chief_complaint && (
              <p className="text-xs mt-1"><span className="font-medium">Queixa:</span> {pa.chief_complaint}</p>
            )}
          </div>
          {pa.risk_classification && (
            <Badge className={cn("shrink-0", RISK_COLORS[pa.risk_classification])}>
              {RISK_LABELS[pa.risk_classification]}
            </Badge>
          )}
        </div>

        {/* Triage Summary */}
        <div className="grid grid-cols-2 gap-2">
          {/* Vital Signs */}
          {(vs.pa_sistolica || vs.fc || vs.fr || vs.tax || vs.spo2) && (
            <Card className="col-span-2">
              <CardContent className="p-3">
                <p className="text-xs font-semibold flex items-center gap-1 mb-2">
                  <Activity className="h-3.5 w-3.5 text-primary" /> Sinais Vitais
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                  {vs.pa_sistolica && <div><span className="text-muted-foreground">PA:</span> {vs.pa_sistolica}/{vs.pa_diastolica}</div>}
                  {vs.fc && <div><span className="text-muted-foreground">FC:</span> {vs.fc}</div>}
                  {vs.fr && <div><span className="text-muted-foreground">FR:</span> {vs.fr}</div>}
                  {vs.tax && <div><span className="text-muted-foreground">Tax:</span> {vs.tax}°C</div>}
                  {vs.spo2 && <div><span className="text-muted-foreground">SpO₂:</span> {vs.spo2}%</div>}
                  {vs.hgt && <div><span className="text-muted-foreground">HGT:</span> {vs.hgt}</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Glasgow */}
          {pa.glasgow_score && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-semibold flex items-center gap-1 mb-1">
                  <Brain className="h-3.5 w-3.5 text-purple-500" /> Glasgow
                </p>
                <p className="text-lg font-bold">{pa.glasgow_score}<span className="text-xs font-normal text-muted-foreground">/15</span></p>
                <div className="text-[10px] text-muted-foreground">
                  {gd.ocular && <span>O:{gd.ocular} </span>}
                  {gd.verbal && <span>V:{gd.verbal} </span>}
                  {gd.motor && <span>M:{gd.motor}</span>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extras */}
          {(pa.allergies || pa.flu_symptoms || pa.oxygen_therapy || pa.pain_scale !== null) && (
            <Card className="col-span-2">
              <CardContent className="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  {pa.pain_scale !== null && pa.pain_scale !== undefined && (
                    <div><span className="text-muted-foreground">Dor:</span> <span className="font-semibold">{pa.pain_scale}/10</span></div>
                  )}
                  {pa.allergies && <div><span className="text-muted-foreground">Alergias:</span> {pa.allergies}</div>}
                  {pa.flu_symptoms && <div className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-500" /> Sintomas gripais{pa.flu_symptoms_detail ? `: ${pa.flu_symptoms_detail}` : ""}</div>}
                  {pa.oxygen_therapy && <div><span className="text-muted-foreground">O₂:</span> {pa.oxygen_therapy_detail || "Sim"}</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {pa.triage_notes && (
            <Card className="col-span-2">
              <CardContent className="p-3 text-[11px]">
                <span className="font-semibold">Obs. Triagem:</span> {pa.triage_notes}
              </CardContent>
            </Card>
          )}
        </div>

        <Separator />

        {/* Allocation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <BedDouble className="h-4 w-4" /> Alocação
            </p>
            <div className="flex items-center gap-2">
              {bedsLoaded && (() => {
                const freeCount = availableBeds.filter(b => b !== "EXTRA" && !occupiedBeds.includes(b)).length;
                return freeCount > 0 ? (
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
                    {freeCount} {freeCount === 1 ? "leito livre" : "leitos livres"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/10">
                    Lotado
                  </Badge>
                );
              })()}
              <Badge variant="outline" className="text-xs font-medium">
                {SECTORS.find(s => s.value === selectedSector)?.label || "—"}
              </Badge>
            </div>
          </div>

          {/* Sector full alert */}
          {bedsLoaded && sectorFullAlert && !extraBedRequested && (
            <Card className="border-destructive/40 bg-destructive/10">
              <CardContent className="p-3 flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive">Setor lotado — Admissão bloqueada</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Todos os leitos regulares de <span className="font-medium">{SECTORS.find(s => s.value === selectedSector)?.label}</span> estão ocupados. 
                    Solicite uma maca extra para alocação provisória ou altere o setor.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                      onClick={() => {
                        setExtraBedRequested(true);
                        setSelectedBed("EXTRA");
                      }}
                    >
                      <BedDouble className="h-3.5 w-3.5" />
                      Solicitar Maca Extra
                    </Button>
                    <Select value={selectedSector} onValueChange={handleSectorChange}>
                      <SelectTrigger className="h-7 w-auto text-xs px-2">
                        <SelectValue placeholder="Alterar setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map(s => (
                          <SelectItem key={s.value} value={s.value}>
                            <span className={s.color}>{s.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extra bed confirmed */}
          {bedsLoaded && sectorFullAlert && extraBedRequested && (
            <Card className="border-amber-500/40 bg-amber-500/10">
              <CardContent className="p-3 flex items-start gap-2.5">
                <BedDouble className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Maca extra solicitada</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    O paciente será alocado provisoriamente em maca extra no setor <span className="font-medium">{SECTORS.find(s => s.value === selectedSector)?.label}</span>.
                    Transfira para leito regular assim que houver disponibilidade.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 text-[10px] text-muted-foreground px-1"
                    onClick={() => { setExtraBedRequested(false); setSelectedBed(""); }}
                  >
                    Cancelar maca extra
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bed grid (UTI + non-UTI unificado) */}
          {bedsLoaded && !sectorFullAlert && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Selecione o leito</Label>
                {selectedBed && selectedBed !== "EXTRA" && (
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/10">
                    {selectedBed}
                  </Badge>
                )}
              </div>
              <div className="rounded-md border bg-muted/30 p-2 max-h-[180px] overflow-y-auto">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {availableBeds.map(bed => {
                    if (bed === "EXTRA") {
                      const isSel = selectedBed === "EXTRA";
                      return (
                        <button
                          key="EXTRA"
                          type="button"
                          onClick={() => setSelectedBed("EXTRA")}
                          className={cn(
                            "rounded-md border px-1.5 py-1.5 text-[10px] font-semibold transition-all flex flex-col items-center gap-0.5",
                            isSel
                              ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/30"
                              : "border-dashed border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                          )}
                        >
                          <BedDouble className="h-3 w-3" />
                          EXTRA
                        </button>
                      );
                    }
                    const isOccupied = occupiedBeds.includes(bed);
                    const isSel = selectedBed === bed;
                    return (
                      <button
                        key={bed}
                        type="button"
                        disabled={isOccupied}
                        onClick={() => setSelectedBed(bed)}
                        className={cn(
                          "rounded-md border px-1.5 py-1.5 text-[11px] font-semibold transition-all flex flex-col items-center gap-0.5 leading-tight",
                          isOccupied
                            ? "border-destructive/30 bg-destructive/10 text-destructive/70 cursor-not-allowed"
                            : isSel
                              ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/30"
                              : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15"
                        )}
                      >
                        <BedDouble className="h-3 w-3" />
                        {bed}
                        <span className="text-[9px] font-normal opacity-80">
                          {isOccupied ? "Ocupado" : "Livre"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {isUtiAdmission && (
                <p className="text-[10px] text-muted-foreground">
                  O leito escolhido será reservado e aparecerá pré-selecionado no SAPS 3.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Data e hora da admissão
              <span className="text-[10px] font-normal text-muted-foreground">(sugerida — confirme ou edite)</span>
            </Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-9 flex-1 justify-start text-left font-normal text-xs",
                      !admissionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {admissionDate
                      ? format(admissionDate, "dd/MM/yyyy (EEE)", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={admissionDate}
                    onSelect={(d) => {
                      if (!d) return;
                      // Preserva o horário atual do estado (ou agora) ao trocar só a data
                      const base = admissionDate ?? new Date();
                      const merged = new Date(d);
                      merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
                      setAdmissionDate(merged);
                    }}
                    disabled={(date) => date > new Date()}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={admissionDate ? format(admissionDate, "HH:mm") : ""}
                onChange={(e) => {
                  const [hh, mm] = e.target.value.split(":").map((n) => parseInt(n, 10));
                  if (isNaN(hh) || isNaN(mm)) return;
                  const base = admissionDate ?? new Date();
                  const merged = new Date(base);
                  merged.setHours(hh, mm, 0, 0);
                  // Bloqueia horário futuro
                  if (merged.getTime() > Date.now()) {
                    toast({
                      title: "Horário inválido",
                      description: "Não é permitido informar horário futuro de admissão.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setAdmissionDate(merged);
                }}
                className="h-9 w-28 text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Por padrão, usamos o momento atual. Ajuste se a admissão efetiva ocorreu em outro horário.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Previsão de alta</Label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noDischargePrediction}
                  onChange={(e) => {
                    setNoDischargePrediction(e.target.checked);
                    if (e.target.checked) {
                      setDischargeDays("");
                      setDischargeDate(undefined);
                    }
                  }}
                  className="h-3.5 w-3.5 cursor-pointer"
                />
                Sem previsão
              </label>
            </div>
            <div className={cn("flex gap-2", noDischargePrediction && "opacity-50 pointer-events-none")}>

              <div className="relative w-32">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={dischargeDays}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setDischargeDays(v);
                    if (v === "") {
                      setDischargeDate(undefined);
                    } else {
                      const n = parseInt(v, 10);
                      if (!isNaN(n)) setDischargeDate(addDays(startOfDay(new Date()), n));
                    }
                  }}
                  placeholder="Dias"
                  className="h-9 text-xs pr-10"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">dias</span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-9 flex-1 justify-start text-left font-normal text-xs",
                      !dischargeDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dischargeDate
                      ? format(dischargeDate, "dd/MM/yyyy (EEE)", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={dischargeDate}
                    onSelect={(d) => {
                      setDischargeDate(d);
                      if (d) {
                        const diff = differenceInCalendarDays(startOfDay(d), startOfDay(new Date()));
                        setDischargeDays(diff >= 0 ? String(diff) : "");
                      } else {
                        setDischargeDays("");
                      }
                    }}
                    disabled={(date) => date < startOfDay(new Date())}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Digite os dias para ver a data, ou escolha a data para calcular os dias automaticamente.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações da admissão (opcional)</Label>
            <Textarea
              value={admissionNotes}
              onChange={(e) => setAdmissionNotes(e.target.value)}
              placeholder="Pendências, condutas iniciais..."
              className="h-16 text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdmit}
            disabled={!selectedSector || !selectedBed || isSubmitting || (sectorFullAlert && !extraBedRequested)}
            className="gap-1"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BedDouble className="h-4 w-4" />}
            {isUtiAdmission ? "Continuar para SAPS 3" : "Pré-admitir em Leito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* MIGRAÇÃO: PisRegistrySyncDialog removido — sincronizava PIS → patient_registry (tabela
        morta). Sem destino no schema novo; a identidade vem direto de pacientes. */}
    </>
  );
}
