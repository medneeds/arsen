import { useState, useMemo } from "react";
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
import { Stethoscope, Loader2, AlertTriangle, ClipboardCheck } from "lucide-react";

const UTI_SECTORS = ["red", "yellow", "blue", "outside", "uti_01", "uti_02", "uci_01", "uci_02"];

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

export function AdmissionDialog({ open, onOpenChange, patient, onSuccess }: AdmissionDialogProps) {
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { user } = useAuth();
  const isUti = useMemo(() => UTI_SECTORS.includes(patient.sector), [patient.sector]);

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
  const [plan, setPlan] = useState("");
  const [cidPrimary, setCidPrimary] = useState("");
  const [cidSecondary, setCidSecondary] = useState("");
  const [dischargePrediction, setDischargePrediction] = useState("");

  // UTI extras
  const [admissionReason, setAdmissionReason] = useState("");
  const [originSector, setOriginSector] = useState("");
  const [devices, setDevices] = useState("");
  const [culturesAtb, setCulturesAtb] = useState("");
  const [specialties, setSpecialties] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!hda.trim()) return "História da Doença Atual (HDA) é obrigatória";
    if (!physGeneral.trim() && !physCv.trim() && !physResp.trim()) return "Exame físico é obrigatório";
    if (!plan.trim()) return "Plano terapêutico é obrigatório";
    if (!cidPrimary.trim()) return "CID primário é obrigatório";
    if (!dischargePrediction.trim()) return "Previsão de alta é obrigatória";
    return null;
  };

  const handleSubmit = async () => {
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

      const soapAdmission = {
        subjective: `HDA:\n${hda}\n\nAMP: ${amp || "—"}\nMUC: ${muc || "—"}\nAlergias: ${allergies || "Nega"}`,
        objective: `Antropometria: peso ${weight || "—"} kg, altura ${height || "—"} m\n` +
                   `SSVV admissionais: PA ${pa || "—"} | FC ${fc || "—"} | FR ${fr || "—"} | SpO₂ ${spo2 || "—"} | Tax ${tax || "—"} | Dx ${dx || "—"}`,
        assessment: `CID primário: ${cidPrimary}${cidSecondary ? `\nCID secundário: ${cidSecondary}` : ""}` +
                    (isUti ? `\n\nMotivo internação UTI: ${admissionReason || "—"}\nOrigem: ${originSector || "—"}\nDispositivos: ${devices || "—"}\nCulturas/ATB: ${culturesAtb || "—"}\nEspecialidades em conjunto: ${specialties || "—"}` : ""),
        plan: `${plan}\n\nPrevisão de alta: ${dischargePrediction}`,
      };

      const physicalExam = {
        general: physGeneral, cardiovascular: physCv, respiratory: physResp,
        abdomen: physAbd, neurological: "", extremities: physExt, skin: "", other: "",
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

      // Persist UTI-specific fields on patients (compat com card UTI atual)
      if (isUti) {
        await supabase
          .from("patients")
          .update({
            uti_admission_reason: admissionReason || null,
            uti_origin_sector: originSector || null,
            uti_devices: devices || null,
            uti_cultures_antibiotics: culturesAtb || null,
            uti_specialties: specialties || null,
            uti_allergies: allergies || null,
            uti_discharge_prediction: dischargePrediction,
          } as any)
          .eq("id", patient.id);
      } else {
        await supabase
          .from("patients")
          .update({
            hospital_discharge_prediction: null,
            uti_discharge_prediction: dischargePrediction,
          } as any)
          .eq("id", patient.id);
      }

      // O trigger sync_admission_to_patient já marca admission_status='admitido' automaticamente.
      toast.success("ADMISSÃO HOSPITALAR REGISTRADA — paciente ADMITIDO (D0)");
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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
            Admissão Hospitalar — {patient.name}
            <Badge variant="outline" className="ml-2 border-emerald-300 bg-emerald-50 text-emerald-700">
              {isUti ? "UTI / UCI" : "ENFERMARIA"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Leito {patient.bed} • Esta admissão será registrada como <strong>D0</strong> e aparecerá como primeira entrada na linha do tempo de evoluções (ADMISSÃO HOSPITALAR). Após assinada, só pode ser editada via adendo ou suspensa com justificativa.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="anamnese" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
            <TabsTrigger value="exame">Exame Físico</TabsTrigger>
            <TabsTrigger value="plano">Plano / CID</TabsTrigger>
            {isUti && <TabsTrigger value="uti">UTI</TabsTrigger>}
            {!isUti && <TabsTrigger value="extras" disabled>—</TabsTrigger>}
          </TabsList>

          <TabsContent value="anamnese" className="space-y-3 mt-3">
            <div>
              <Label>HDA — História da Doença Atual *</Label>
              <Textarea value={hda} onChange={e => setHda(e.target.value)} rows={4} placeholder="Paciente admitido com..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>AMP — Antecedentes</Label><Textarea value={amp} onChange={e => setAmp(e.target.value)} rows={2} /></div>
              <div><Label>MUC — Medicações de Uso Contínuo</Label><Textarea value={muc} onChange={e => setMuc(e.target.value)} rows={2} /></div>
            </div>
            <div><Label>Alergias medicamentosas</Label><Input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Nega / Especificar" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Peso (kg)</Label><Input value={weight} onChange={e => setWeight(e.target.value)} /></div>
              <div><Label>Altura (m)</Label><Input value={height} onChange={e => setHeight(e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs uppercase">SSVV admissionais</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Input placeholder="PA mmHg" value={pa} onChange={e => setPa(e.target.value)} />
                <Input placeholder="FC bpm" value={fc} onChange={e => setFc(e.target.value)} />
                <Input placeholder="FR irpm" value={fr} onChange={e => setFr(e.target.value)} />
                <Input placeholder="SpO₂ %" value={spo2} onChange={e => setSpo2(e.target.value)} />
                <Input placeholder="Tax °C" value={tax} onChange={e => setTax(e.target.value)} />
                <Input placeholder="Dx mg/dL" value={dx} onChange={e => setDx(e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exame" className="space-y-3 mt-3">
            <div><Label>Estado geral *</Label><Textarea value={physGeneral} onChange={e => setPhysGeneral(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cardiovascular</Label><Textarea value={physCv} onChange={e => setPhysCv(e.target.value)} rows={2} /></div>
              <div><Label>Respiratório</Label><Textarea value={physResp} onChange={e => setPhysResp(e.target.value)} rows={2} /></div>
              <div><Label>Abdome</Label><Textarea value={physAbd} onChange={e => setPhysAbd(e.target.value)} rows={2} /></div>
              <div><Label>Extremidades</Label><Textarea value={physExt} onChange={e => setPhysExt(e.target.value)} rows={2} /></div>
            </div>
          </TabsContent>

          <TabsContent value="plano" className="space-y-3 mt-3">
            <div><Label>Plano terapêutico inicial *</Label><Textarea value={plan} onChange={e => setPlan(e.target.value)} rows={5} placeholder="• Monitorização\n• Suporte clínico\n• Antibioticoterapia\n• ..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CID primário *</Label><Input value={cidPrimary} onChange={e => setCidPrimary(e.target.value)} placeholder="Ex.: J18.9 — Pneumonia" /></div>
              <div><Label>CID secundário</Label><Input value={cidSecondary} onChange={e => setCidSecondary(e.target.value)} /></div>
            </div>
            <div><Label>Previsão de alta *</Label><Input value={dischargePrediction} onChange={e => setDischargePrediction(e.target.value)} placeholder="DD/MM/AAAA ou 'Sem previsão'" /></div>
          </TabsContent>

          {isUti && (
            <TabsContent value="uti" className="space-y-3 mt-3">
              <div><Label>Motivo de internação UTI</Label><Textarea value={admissionReason} onChange={e => setAdmissionReason(e.target.value)} rows={2} /></div>
              <div><Label>Origem (setor anterior)</Label><Input value={originSector} onChange={e => setOriginSector(e.target.value)} /></div>
              <div><Label>Dispositivos invasivos</Label><Textarea value={devices} onChange={e => setDevices(e.target.value)} rows={2} placeholder="IOT, CVC, SVD, ..." /></div>
              <div><Label>Culturas pendentes / ATB em curso</Label><Textarea value={culturesAtb} onChange={e => setCulturesAtb(e.target.value)} rows={2} /></div>
              <div><Label>Especialidades em conjunto</Label><Input value={specialties} onChange={e => setSpecialties(e.target.value)} /></div>
              <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Confirme o SAPS 3 finalizado antes de assinar a admissão UTI.</p>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white uppercase">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Assinar e Admitir (D0)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
