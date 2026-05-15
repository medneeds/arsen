import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Stethoscope, Printer, FilePlus2, Ban, ShieldAlert, Loader2,
  CheckCircle2, FileText, HeartPulse, Pill, AlertTriangle, ClipboardList,
  Activity, CalendarDays, ShieldCheck, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printAdmissionNormaZero } from "@/lib/printAdmission";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    name: string;
    bed: string;
    sector: string;
    age?: string | number;
  };
  onChanged?: () => void;
}

interface AdmissionRow {
  id: string;
  status: string;
  validated_at: string | null;
  validated_by_name: string | null;
  created_at: string;
  created_by_name: string | null;
  soap_data: any;
  vital_signs: any;
  physical_exam: any;
  suspension_reason?: string | null;
  suspended_at?: string | null;
}

interface AdmissionHistory {
  cid_primary: string | null;
  cid_secondary: string | null;
  clinical_history: string | null;
  initial_conduct: string | null;
}

const UTI_SECTORS = ["red", "yellow", "outside", "uti_01", "uti_02", "uci_02"];

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const Field = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) =>
  value && value.trim() ? (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</div>
      <div className={cn("text-sm text-slate-800 whitespace-pre-wrap leading-relaxed mt-0.5", mono && "font-mono")}>
        {value}
      </div>
    </div>
  ) : null;

const Section = ({
  icon: Icon, title, children, tone = "slate",
}: {
  icon: any; title: string; children: React.ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber" | "red";
}) => {
  const tones = {
    slate: "border-slate-200 bg-slate-50/40",
    blue: "border-blue-200 bg-blue-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
    amber: "border-amber-200 bg-amber-50/40",
    red: "border-red-200 bg-red-50/40",
  } as const;
  const iconTones = {
    slate: "text-slate-500", blue: "text-blue-600",
    emerald: "text-emerald-600", amber: "text-amber-600", red: "text-red-600",
  } as const;
  return (
    <section className={cn("rounded-lg border p-3.5 space-y-2.5", tones[tone])}>
      <header className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", iconTones[tone])} />
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">{title}</h4>
      </header>
      <div className="space-y-2">{children}</div>
    </section>
  );
};

export function AdmissionConsultDialog({ open, onOpenChange, patient, onChanged }: Props) {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const isUti = useMemo(() => UTI_SECTORS.includes(patient.sector), [patient.sector]);

  const [loading, setLoading] = useState(true);
  const [d0, setD0] = useState<AdmissionRow | null>(null);
  const [addenda, setAddenda] = useState<AdmissionRow[]>([]);
  const [history, setHistory] = useState<AdmissionHistory | null>(null);
  const [sapsPending, setSapsPending] = useState(false);

  // Adendo state
  const [adendoOpen, setAdendoOpen] = useState(false);
  const [adendoText, setAdendoText] = useState("");
  const [savingAdendo, setSavingAdendo] = useState(false);

  // Suspensão state
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [savingSuspend, setSavingSuspend] = useState(false);

  const fetchAll = async () => {
    if (!patient.id) return;
    setLoading(true);
    try {
      const { data: evs } = await supabase
        .from("clinical_evolutions")
        .select("id, status, validated_at, validated_by_name, created_at, created_by_name, soap_data, vital_signs, physical_exam, suspension_reason, suspended_at")
        .eq("patient_id", patient.id)
        .eq("evolution_type", "admission")
        .order("created_at", { ascending: true });

      const list = (evs || []) as AdmissionRow[];
      const root =
        list.find(e => e.status === "validated" && !(e.soap_data as any)?.parent_id) ||
        list.find(e => !(e.soap_data as any)?.parent_id) ||
        null;
      const adds = root
        ? list.filter(e => (e.soap_data as any)?.parent_id === root.id)
        : [];
      setD0(root);
      setAddenda(adds);

      const { data: ah } = await supabase
        .from("admission_histories")
        .select("cid_primary, cid_secondary, clinical_history, initial_conduct")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setHistory((ah as any) ?? null);

      const { data: pat } = await supabase
        .from("patients")
        .select("saps_pending, saps_completed_at")
        .eq("id", patient.id)
        .maybeSingle();
      setSapsPending(!!(pat as any)?.saps_pending && !(pat as any)?.saps_completed_at);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) fetchAll(); }, [open, patient.id]);

  const isSuspended = d0?.status === "suspended";

  const soap = (d0?.soap_data || {}) as any;
  const vs = (d0?.vital_signs || {}) as any;
  const pe = (d0?.physical_exam || {}) as any;

  const handlePrint = () => {
    if (!d0) return;
    const subj: string = soap.subjective || "";
    const obj: string = soap.objective || "";
    const ass: string = soap.assessment || "";
    const planTxt: string = soap.plan || history?.initial_conduct || "";
    void printAdmissionNormaZero({
      patient: { name: patient.name, bed: patient.bed, sector: patient.sector, age: patient.age },
      hospitalName: currentHospital?.name,
      doctorName: d0.validated_by_name || d0.created_by_name || "Médico Assistente",
      isUti,
      hda: history?.clinical_history || subj || "",
      vitals: { pa: vs.pa, fc: vs.fc, fr: vs.fr, spo2: vs.spo2, tax: vs.temp, dx: vs.dx },
      exam: { general: pe.general, cv: pe.cardiovascular, resp: pe.respiratory, abd: pe.abdomen, ext: pe.extremities },
      plan: planTxt,
      cidPrimary: history?.cid_primary || "",
      cidSecondary: history?.cid_secondary || undefined,
      dischargePredictionLabel: ass.match(/Previs[aã]o de alta:\s*([^\n]+)/i)?.[1] || "—",
      sapsPending,
    });
  };

  const submitAdendo = async () => {
    if (!d0 || !user) return;
    if (!adendoText.trim()) { toast.error("Descreva o adendo"); return; }
    setSavingAdendo(true);
    try {
      const doctor = user.user_metadata?.full_name || user.email || "Médico Assistente";
      const now = new Date().toISOString();
      const { error } = await supabase.from("clinical_evolutions").insert({
        patient_id: patient.id,
        patient_name: patient.name,
        patient_bed: patient.bed,
        patient_sector: patient.sector,
        evolution_type: "admission",
        status: "validated",
        soap_data: { addendum: adendoText, parent_id: d0.id },
        vital_signs: {},
        physical_exam: {},
        validated_at: now,
        validated_by: user.id,
        validated_by_name: doctor,
        created_by: user.id,
        created_by_name: doctor,
        hospital_unit_id: (d0 as any).hospital_unit_id ?? currentHospital?.id ?? null,
        state_id: (d0 as any).state_id ?? null,
      } as any);
      if (error) throw error;
      toast.success("Adendo registrado e vinculado ao D0");
      setAdendoOpen(false);
      setAdendoText("");
      fetchAll();
      onChanged?.();
    } catch (e: any) {
      toast.error("Erro ao salvar adendo: " + (e.message || e));
    } finally {
      setSavingAdendo(false);
    }
  };

  const submitSuspend = async () => {
    if (!d0 || !user) return;
    if (suspendReason.trim().length < 10) { toast.error("Justificativa precisa ter ao menos 10 caracteres"); return; }
    setSavingSuspend(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("clinical_evolutions")
        .update({
          status: "suspended",
          suspension_reason: suspendReason,
          suspended_by: user.id,
          suspended_at: now,
        } as any)
        .eq("id", d0.id);
      if (error) throw error;
      toast.success("Admissão SUSPENSA. Paciente retornou para PRÉ-ADMITIDO.", {
        description: "Os módulos clínicos foram bloqueados até nova admissão.",
      });
      setSuspendOpen(false);
      setSuspendReason("");
      onOpenChange(false);
      onChanged?.();
    } catch (e: any) {
      toast.error("Erro ao suspender: " + (e.message || e));
    } finally {
      setSavingSuspend(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className={cn(
            "px-6 pt-5 pb-4 border-b",
            isSuspended
              ? "bg-gradient-to-r from-red-50/70 via-white to-white"
              : "bg-gradient-to-r from-emerald-50/70 via-white to-white",
          )}>
            <DialogTitle className="flex items-center gap-2 uppercase text-slate-800">
              <span className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md",
                isSuspended ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700",
              )}>
                <Stethoscope className="h-4 w-4" />
              </span>
              Admissão Hospitalar — {patient.name}
              {isSuspended ? (
                <Badge className="ml-2 bg-red-100 text-red-700 border border-red-300 uppercase">
                  <Ban className="h-3 w-3 mr-1" /> Suspensa
                </Badge>
              ) : (
                <Badge className="ml-2 bg-emerald-100 text-emerald-700 border border-emerald-300 uppercase">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Validada (D0)
                </Badge>
              )}
              <Badge variant="outline" className="ml-1 border-slate-300 bg-white text-slate-700">
                {isUti ? "UTI / UCI" : "ENFERMARIA"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Leito <strong>{patient.bed}</strong> •{" "}
              {d0 ? (
                <>
                  Assinada por <strong>{d0.validated_by_name || d0.created_by_name || "—"}</strong> em{" "}
                  <strong>{fmtDateTime(d0.validated_at || d0.created_at)}</strong>
                </>
              ) : "Carregando..."}
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <ScrollArea className="max-h-[68vh]">
            <div className="px-6 py-5 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando admissão…
                </div>
              ) : !d0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Nenhuma admissão registrada para este paciente.
                </div>
              ) : (
                <>
                  {isSuspended && (
                    <Section icon={ShieldAlert} title="Admissão Suspensa" tone="red">
                      <Field label="Motivo" value={d0.suspension_reason || ""} />
                      <Field label="Suspensa em" value={fmtDateTime(d0.suspended_at)} />
                    </Section>
                  )}

                  <Section icon={FileText} title="Anamnese" tone="slate">
                    <Field label="HDA" value={history?.clinical_history || soap.subjective || ""} />
                  </Section>

                  <Section icon={HeartPulse} title="Sinais Vitais & Antropometria" tone="emerald">
                    <Field label="Resumo objetivo" value={soap.objective || ""} mono />
                  </Section>

                  <Section icon={Activity} title="Exame Físico" tone="slate">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Estado geral" value={pe.general} />
                      <Field label="Cardiovascular" value={pe.cardiovascular} />
                      <Field label="Respiratório" value={pe.respiratory} />
                      <Field label="Abdome" value={pe.abdomen} />
                      <Field label="Extremidades" value={pe.extremities} />
                      <Field label="Neurológico" value={pe.neurological} />
                    </div>
                  </Section>

                  <Section icon={ClipboardList} title="Diagnóstico (CID-10) & Avaliação" tone="blue">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="CID primário" value={history?.cid_primary} />
                      <Field label="CID secundário" value={history?.cid_secondary} />
                    </div>
                    <Field label="Avaliação" value={soap.assessment || ""} />
                  </Section>

                  <Section icon={Pill} title="Plano Terapêutico" tone="amber">
                    <Field label="Conduta inicial" value={soap.plan || history?.initial_conduct || ""} />
                  </Section>

                  {isUti && (
                    <Section icon={ShieldCheck} title="Ficha SAPS 3" tone={sapsPending ? "amber" : "emerald"}>
                      <p className="text-xs text-slate-700">
                        Status: <strong className={sapsPending ? "text-amber-700" : "text-emerald-700"}>
                          {sapsPending ? "PENDENTE (24 h)" : "Concluída"}
                        </strong>
                      </p>
                    </Section>
                  )}

                  {addenda.length > 0 && (
                    <Section icon={History} title={`Adendos (${addenda.length})`} tone="blue">
                      <div className="space-y-2">
                        {addenda.map((a) => (
                          <div key={a.id} className="rounded-md border border-blue-200 bg-white p-3">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                              <FilePlus2 className="h-3 w-3 text-blue-600" />
                              <span>Adendo</span>
                              <span>•</span>
                              <span>{fmtDateTime(a.validated_at || a.created_at)}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">{a.validated_by_name || a.created_by_name || "—"}</span>
                            </div>
                            <p className="text-sm text-slate-800 whitespace-pre-wrap">
                              {(a.soap_data as any)?.addendum || ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="px-6 py-3.5 border-t bg-slate-50/70 gap-2 sm:justify-between">
            <Button variant="outline" onClick={handlePrint} disabled={!d0} className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir (Norma Zero)
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAdendoOpen(true)}
                disabled={!d0 || isSuspended}
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
              >
                <FilePlus2 className="h-4 w-4" /> Adendo
              </Button>
              <Button
                variant="outline"
                onClick={() => setSuspendOpen(true)}
                disabled={!d0 || isSuspended}
                className="gap-2 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
              >
                <Ban className="h-4 w-4" /> Suspender
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Adendo */}
      <Dialog open={adendoOpen} onOpenChange={setAdendoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase text-slate-800">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                <FilePlus2 className="h-3.5 w-3.5" />
              </span>
              Adendo à Admissão
            </DialogTitle>
            <DialogDescription className="text-xs">
              O adendo é uma <strong>nova entrada audítavel</strong> vinculada ao D0. O registro original permanece intacto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Texto do adendo *</Label>
            <Textarea rows={5} value={adendoText} onChange={(e) => setAdendoText(e.target.value)}
              placeholder="Descreva a complementação da admissão..." />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAdendoOpen(false)} disabled={savingAdendo}>Cancelar</Button>
            <Button onClick={submitAdendo} disabled={savingAdendo} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {savingAdendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              Salvar Adendo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Suspender */}
      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 uppercase text-red-800">
              <ShieldAlert className="h-5 w-5 text-red-600" /> Suspender Admissão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              A suspensão <strong>invalida o D0</strong>. O paciente voltará para o estado{" "}
              <strong>PRÉ-ADMITIDO</strong> e os módulos clínicos (prescrição, evolução, requisições, docs e histórico)
              serão bloqueados até uma nova admissão. A justificativa fica registrada em auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Justificativa clínica * <span className="text-slate-400">(mín. 10 caracteres)</span></Label>
            <Textarea rows={4} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Ex.: erro de identificação do paciente, admissão duplicada..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingSuspend}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={submitSuspend} disabled={savingSuspend} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                {savingSuspend ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                Confirmar Suspensão
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
