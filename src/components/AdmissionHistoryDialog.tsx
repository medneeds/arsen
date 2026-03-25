import { useState, useEffect } from "react";
import { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Save, Loader2, CheckCircle2, Clock, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CidSearchInput } from "./CidSearchInput";

interface AdmissionHistoryDialogProps {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdmissionHistoryDialog({ patient, open, onOpenChange }: AdmissionHistoryDialogProps) {
  const { currentHospital, currentState } = useHospital();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [diagnosticHypothesis, setDiagnosticHypothesis] = useState("");
  const [initialConduct, setInitialConduct] = useState("");
  const [cidPrimary, setCidPrimary] = useState("");
  const [cidSecondary, setCidSecondary] = useState("");
  const [macroDiagnosis, setMacroDiagnosis] = useState("");

  useEffect(() => {
    if (open && patient.id) {
      fetchAdmissionHistory();
    }
  }, [open, patient.id]);

  const fetchAdmissionHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admission_histories")
        .select("*")
        .eq("patient_id", patient.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingId(data.id);
        setChiefComplaint(data.chief_complaint || "");
        setClinicalHistory(data.clinical_history || "");
        setDiagnosticHypothesis(data.diagnostic_hypothesis || "");
        setInitialConduct(data.initial_conduct || "");
        setCidPrimary((data as any).cid_primary || "");
        setCidSecondary((data as any).cid_secondary || "");
        setMacroDiagnosis((data as any).macro_diagnosis || "");
        setLastUpdated(data.updated_at);
      } else {
        setExistingId(null);
        setChiefComplaint("");
        setClinicalHistory("");
        setDiagnosticHypothesis("");
        setInitialConduct("");
        setCidPrimary("");
        setCidSecondary("");
        setMacroDiagnosis("");
        setLastUpdated(null);
      }
    } catch (err) {
      console.error("Error fetching admission history:", err);
      toast.error("Erro ao carregar história admissional");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentHospital || !currentState) return;
    
    if (!cidPrimary) {
      toast.error("CID Primário é obrigatório");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        patient_id: patient.id,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        chief_complaint: chiefComplaint || null,
        clinical_history: clinicalHistory || null,
        diagnostic_hypothesis: diagnosticHypothesis || null,
        initial_conduct: initialConduct || null,
        cid_primary: cidPrimary || null,
        cid_secondary: cidSecondary || null,
        macro_diagnosis: macroDiagnosis || null,
        updated_by: user?.id || null,
      };

      if (existingId) {
        const { error } = await supabase
          .from("admission_histories")
          .update(payload)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("admission_histories")
          .insert({ ...payload, created_by: user?.id || null })
          .select("id, updated_at")
          .single();
        if (error) throw error;
        if (data) {
          setExistingId(data.id);
          setLastUpdated(data.updated_at);
        }
      }

      toast.success("História admissional salva com sucesso");
      // Refresh to get updated_at
      await fetchAdmissionHistory();
    } catch (err) {
      console.error("Error saving admission history:", err);
      toast.error("Erro ao salvar história admissional");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            História Admissional
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>{patient.name} — Leito {patient.bedNumber}</span>
            {lastUpdated && (
              <Badge variant="outline" className="text-xs gap-1">
                <Clock className="h-3 w-3" />
                Atualizado em {format(new Date(lastUpdated), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            {/* Queixa Principal */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Queixa Principal
              </Label>
              <Textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="Descreva a queixa principal do paciente..."
                className="min-h-[60px] text-sm"
              />
            </div>

            {/* História Clínica */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                História Clínica
              </Label>
              <Textarea
                value={clinicalHistory}
                onChange={(e) => setClinicalHistory(e.target.value)}
                placeholder="HDA, antecedentes pessoais e familiares, medicamentos em uso, alergias, revisão de sistemas..."
                className="min-h-[120px] text-sm"
              />
            </div>

            {/* Hipótese Diagnóstica */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Hipótese Diagnóstica
              </Label>
              <Textarea
                value={diagnosticHypothesis}
                onChange={(e) => setDiagnosticHypothesis(e.target.value)}
                placeholder="Hipóteses diagnósticas principais e diferenciais..."
                className="min-h-[60px] text-sm"
              />
            </div>

            {/* Conduta Inicial */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Conduta Inicial
              </Label>
              <Textarea
                value={initialConduct}
                onChange={(e) => setInitialConduct(e.target.value)}
                placeholder="Plano terapêutico inicial, exames solicitados, medicamentos prescritos..."
                className="min-h-[80px] text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              {existingId && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Registro existente
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
