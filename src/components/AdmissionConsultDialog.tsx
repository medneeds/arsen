import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import { toEvolucaoStatusDb, fromEvolucaoStatusDb } from "@/lib/evolucaoStatus";
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
  Activity, ShieldCheck, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printAdmissionNormaZero } from "@/lib/printAdmission";
import { resolveCurrentBedSector } from "@/lib/resolvePatientHeader";
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
    patient_registry_id?: string | null;
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

/** MIGRAÇÃO: profissionais.id ≠ auth.uid → resolve via profissionais.user_id. */
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

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const Field = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) =>
  value && value.trim() ? (
    <div>
      <div className="text-xs uppercase tracking-wider font-medium text-muted-foreground">{label}</div>
      <div className={cn("text-sm text-foreground whitespace-pre-wrap leading-relaxed mt-1", mono && "font-mono")}>
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
    slate: "border-border bg-muted/40",
    blue: "border-border bg-muted/40",
    emerald: "border-released-border bg-released-soft/40",
    amber: "border-warning-border bg-warning-soft/40",
    red: "border-critical-border bg-critical-soft/40",
  } as const;
  const iconTones = {
    slate: "text-muted-foreground", blue: "text-foreground",
    emerald: "text-released-on-soft", amber: "text-warning-on-soft", red: "text-critical-on-soft",
  } as const;
  return (
    <section className={cn("rounded-lg border p-4 space-y-3", tones[tone])}>
      <header className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", iconTones[tone])} />
        <h4 className="text-xs font-medium uppercase tracking-wide text-foreground">{title}</h4>
      </header>
      <div className="space-y-2">{children}</div>
    </section>
  );
};

export function AdmissionConsultDialog({ open, onOpenChange, patient, onChanged }: Props) {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const isUti = useMemo(() => UTI_SECTORS.includes(patient.sector), [patient.sector]);
  const identifiers = usePatientIdentifiers(patient.id, patient.name, currentHospital?.id || null);
  const registryId = identifiers.registry?.id ?? patient.patient_registry_id ?? null;

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
      // MIGRAÇÃO: clinical_evolutions → evolucoes (ancorada por internacao_id).
      // evolution_type='admission' vive em soap.__evolution_type; parent_id (adendo)
      // em soap.parent_id. Campos dedicados antigos remapeados do JSON `soap`.
      const { data: evs } = await supabase
        .from("evolucoes")
        .select("id, status, soap, exame_fisico, motivo_suspensao, data_hora, criado_em")
        .eq("internacao_id", patient.id)
        .order("data_hora", { ascending: false });

      const list: AdmissionRow[] = ((evs as any[]) || [])
        .filter((e) => (e.soap as any)?.__evolution_type === "admission")
        .map((e): AdmissionRow => {
          const soap: any = e.soap || {};
          return {
            id: e.id,
            status: fromEvolucaoStatusDb(e.status),
            validated_at: soap.__validated_at ?? null,
            validated_by_name: soap.__validated_by_name ?? null,
            created_at: e.criado_em || e.data_hora,
            created_by_name: soap.__created_by_name ?? null,
            soap_data: soap,
            vital_signs: soap.__vital_signs ?? {},
            physical_exam: e.exame_fisico ?? {},
            suspension_reason: e.motivo_suspensao ?? null,
            suspended_at: soap.__suspended_at ?? null,
          };
        });
      const root =
        list.find(e => e.status === "validated" && !(e.soap_data as any)?.parent_id) ||
        list.find(e => !(e.soap_data as any)?.parent_id) ||
        null;
      const adds = root
        ? list
            .filter(e => (e.soap_data as any)?.parent_id === root.id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        : [];
      setD0(root);
      setAddenda(adds);

      // MIGRAÇÃO: admission_histories → internacoes (clinical_history→historia_clinica,
      // initial_conduct→conduta_inicial). CID primário/secundário sem coluna → null.
      const { data: inter } = await supabase
        .from("internacoes")
        .select("historia_clinica, conduta_inicial, hipotese_diagnostica")
        .eq("id", patient.id)
        .maybeSingle();
      const i: any = inter || {};
      setHistory({
        cid_primary: null,
        cid_secondary: null,
        clinical_history: i.historia_clinica ?? null,
        initial_conduct: i.conduta_inicial ?? null,
      });

      // MIGRAÇÃO: patients.saps_pending/saps_completed_at sem coluna → SAPS
      // pendente degradado para false (o gate de SAPS não persiste no schema novo).
      setSapsPending(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) fetchAll(); }, [open, patient.id, registryId]);

  const isSuspended = d0?.status === "suspended";

  const soap = (d0?.soap_data || {}) as any;
  const vs = (d0?.vital_signs || {}) as any;
  const pe = (d0?.physical_exam || {}) as any;

  const handlePrint = async () => {
    if (!d0) return;
    const subj: string = soap.subjective || "";
    const obj: string = soap.objective || "";
    const ass: string = soap.assessment || "";
    const planTxt: string = soap.plan || history?.initial_conduct || "";
    // Leito/setor ATUAIS (após relocações), com fallback para snapshot da prop.
    const live = await resolveCurrentBedSector(patient.id);
    void printAdmissionNormaZero({
      patient: {
        name: patient.name,
        bed: live.bed || patient.bed,
        sector: live.sector || patient.sector,
        age: identifiers.registry?.age || patient.age,
      },
      identifiers: {
        prontuario: identifiers.prontuario,
        atendimento: identifiers.atendimento,
        socialName: identifiers.registry?.socialName || null,
        cpf: identifiers.registry?.cpf || null,
        cns: identifiers.registry?.cns || null,
        birthDate: identifiers.registry?.birthDate || null,
        sex: identifiers.registry?.sex || null,
        motherName: identifiers.registry?.motherName || null,
        address: [
          identifiers.registry?.address,
          identifiers.registry?.neighborhood,
          identifiers.registry?.city && identifiers.registry?.state
            ? `${identifiers.registry.city}/${identifiers.registry.state}`
            : identifiers.registry?.city || identifiers.registry?.state,
        ].filter(Boolean).join(" — ") || null,
        phone: identifiers.registry?.phone || null,
      },
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
      // MIGRAÇÃO: clinical_evolutions → evolucoes. Adendo = nova evolução com
      // soap.parent_id apontando para o D0. Campos dedicados no JSON `soap` (`__`).
      // profissional_id resolvido via profissionais.user_id (≠ auth.uid).
      const profissionalId = await resolveProfissionalId(user.id);
      if (!profissionalId) {
        toast.error("Profissional não encontrado para o usuário atual");
        setSavingAdendo(false);
        return;
      }
      const { error } = await supabase.from("evolucoes").insert({
        internacao_id: patient.id,
        profissional_id: profissionalId,
        data_hora: now,
        status: toEvolucaoStatusDb("validated"),
        exame_fisico: {},
        soap: {
          addendum: adendoText,
          parent_id: d0.id,
          __evolution_type: "admission",
          __patient_name: patient.name,
          __patient_bed: patient.bed,
          __patient_sector: patient.sector,
          __validated_at: now,
          __validated_by: user.id,
          __validated_by_name: doctor,
          __created_by: user.id,
          __created_by_name: doctor,
        },
      } as any);
      if (error) throw error;
      toast.success("Adendo registrado e vinculado ao D0");
      setAdendoOpen(false);
      setAdendoText("");
      fetchAll();
      onChanged?.();
    } catch (e: any) {
      toast.error("Não foi possível salvar adendo: " + (e.message || e));
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
      // MIGRAÇÃO: evolucoes tem `motivo_suspensao` (coluna real); suspended_at/by
      // vão no JSON `soap` (`__`). Lê o soap atual para não sobrescrever chaves.
      const { data: existing } = await supabase
        .from("evolucoes")
        .select("soap")
        .eq("id", d0.id)
        .maybeSingle();
      const mergedSoap: any = { ...(((existing as any)?.soap as any) || {}) };
      mergedSoap.__suspended_at = now;
      mergedSoap.__suspended_by = user.id;
      const { error } = await supabase
        .from("evolucoes")
        .update({
          status: toEvolucaoStatusDb("suspended"),
          motivo_suspensao: suspendReason,
          soap: mergedSoap,
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
      toast.error("Não foi possível suspender: " + (e.message || e));
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
            "px-6 pt-4 pb-4 border-b",
            isSuspended
              ? "bg-critical-soft/70"
              : "bg-released-soft/70",
          )}>
            <DialogTitle className="flex items-center gap-2 uppercase tracking-wider text-foreground">
              <span className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md",
                isSuspended ? "bg-critical-soft text-critical-on-soft" : "bg-released-soft text-released-on-soft",
              )}>
                <Stethoscope className="h-4 w-4" />
              </span>
              Admissão Hospitalar — {patient.name}
              {isSuspended ? (
                <Badge className="ml-2 bg-critical-soft text-critical-on-soft border border-critical-border uppercase tracking-wider">
                  <Ban className="h-3 w-3 mr-1" /> Suspensa
                </Badge>
              ) : (
                <Badge className="ml-2 bg-released-soft text-released-on-soft border border-released-border uppercase tracking-wider">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Validada (D0)
                </Badge>
              )}
              <Badge variant="outline" className="ml-1 border-border bg-white text-foreground">
                {isUti ? "UTI / UCI" : "ENFERMARIA"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-foreground">
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
            <div className="px-6 py-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando admissão…
                </div>
              ) : !d0 ? (
                <div className="rounded-lg border border-warning-border bg-warning-soft/60 p-4 text-sm text-warning-on-soft flex items-center gap-2">
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
                      <p className="text-xs text-foreground">
                        Status: <strong className={sapsPending ? "text-warning-on-soft" : "text-released-on-soft"}>
                          {sapsPending ? "PENDENTE (24 h)" : "Concluída"}
                        </strong>
                      </p>
                    </Section>
                  )}

                  {addenda.length > 0 && (
                    <Section icon={History} title={`Adendos (${addenda.length})`} tone="blue">
                      <div className="space-y-2">
                        {addenda.map((a) => (
                          <div key={a.id} className="rounded-md border border-border bg-white p-3">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                              <FilePlus2 className="h-3 w-3 text-foreground" />
                              <span>Adendo</span>
                              <span>•</span>
                              <span>{fmtDateTime(a.validated_at || a.created_at)}</span>
                              <span>•</span>
                              <span className="font-medium text-foreground">{a.validated_by_name || a.created_by_name || "—"}</span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
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
          <DialogFooter className="px-6 py-4 border-t bg-muted/70 gap-2 sm:justify-between">
            <Button variant="outline" onClick={handlePrint} disabled={!d0} className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir (Norma Zero)
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAdendoOpen(true)}
                disabled={!d0 || isSuspended}
                className="gap-2 border-border text-foreground hover:bg-muted hover:text-foreground"
              >
                <FilePlus2 className="h-4 w-4" /> Adendo
              </Button>
              <Button
                variant="outline"
                onClick={() => setSuspendOpen(true)}
                disabled={!d0 || isSuspended}
                className="gap-2 border-critical-border text-critical-on-soft hover:bg-critical-soft hover:text-critical-on-soft"
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
            <DialogTitle className="flex items-center gap-2 uppercase tracking-wider text-foreground">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground">
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
            <Button onClick={submitAdendo} disabled={savingAdendo} className="gap-2 bg-primary hover:bg-primary text-white">
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
            <AlertDialogTitle className="flex items-center gap-2 uppercase tracking-wider text-critical-on-soft">
              <ShieldAlert className="h-5 w-5 text-critical-on-soft" /> Suspender Admissão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              A suspensão <strong>invalida o D0</strong>. O paciente voltará para o estado{" "}
              <strong>PRÉ-ADMITIDO</strong> e os módulos clínicos (prescrição, evolução, requisições, docs e histórico)
              serão bloqueados até uma nova admissão. A justificativa fica registrada em auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Justificativa clínica * <span className="text-muted-foreground">(mín. 10 caracteres)</span></Label>
            <Textarea rows={4} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Ex.: erro de identificação do paciente, admissão duplicada..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingSuspend}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={submitSuspend} disabled={savingSuspend} className="gap-2 bg-critical hover:bg-critical text-white">
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
