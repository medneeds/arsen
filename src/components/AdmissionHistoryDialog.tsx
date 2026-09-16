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
import { ClipboardList, Save, Loader2, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// MIGRAÇÃO: admission_histories morto. A história admissional agora É a própria
// internação — `patient.id` é `internacoes.id`. Mapeamento:
//   chief_complaint→queixa_principal, clinical_history→historia_clinica,
//   diagnostic_hypothesis→hipotese_diagnostica, initial_conduct→conduta_inicial.
// DEGRADADO (sem coluna em internacoes): cid_primary/cid_secondary/macro_diagnosis
// → a seção CID-10/Macrodiagnóstico e o gate de "CID obrigatório" foram removidos.
// patient_registry_id/hospital_unit_id/state_id/updated_by também não têm destino.

interface AdmissionHistoryDialogProps {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdmissionHistoryDialog({ patient, open, onOpenChange }: AdmissionHistoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [diagnosticHypothesis, setDiagnosticHypothesis] = useState("");
  const [initialConduct, setInitialConduct] = useState("");

  useEffect(() => {
    if (open && patient.id) {
      fetchAdmissionHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient.id]);

  const fetchAdmissionHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("internacoes")
        .select("queixa_principal, historia_clinica, hipotese_diagnostica, conduta_inicial, atualizado_em")
        .eq("id", patient.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const d: any = data;
        setChiefComplaint(d.queixa_principal || "");
        setClinicalHistory(d.historia_clinica || "");
        setDiagnosticHypothesis(d.hipotese_diagnostica || "");
        setInitialConduct(d.conduta_inicial || "");
        setLastUpdated(d.atualizado_em ?? null);
      } else {
        setChiefComplaint("");
        setClinicalHistory("");
        setDiagnosticHypothesis("");
        setInitialConduct("");
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
    setSaving(true);
    try {
      const { error } = await supabase
        .from("internacoes")
        .update({
          queixa_principal: chiefComplaint || null,
          historia_clinica: clinicalHistory || null,
          hipotese_diagnostica: diagnosticHypothesis || null,
          conduta_inicial: initialConduct || null,
        } as any)
        .eq("id", patient.id);
      if (error) throw error;

      toast.success("História admissional salva com sucesso");
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
            <span className="patient-id">{patient.name} — Leito {patient.bedNumber}</span>
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

            {/* MIGRAÇÃO: bloco "Classificação CID-10" (CID primário/secundário +
                macrodiagnóstico) removido — internacoes não tem colunas de CID. */}

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
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Vinculada à internação atual
              </div>
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
