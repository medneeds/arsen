import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, Plus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SlaBadge } from "@/components/sla/SlaBadge";

interface Props {
  requests: any[];
  typeFilter?: string;
  defaultRequestType?: string;
}

const REQUEST_TYPES = [
  { value: "interna", label: "Regulação interna" },
  { value: "externa_sisreg", label: "Externa · SISREG" },
  { value: "solicitacao_vaga", label: "Solicitação de vaga" },
  { value: "transferencia_interunidade", label: "Transferência interunidade" },
  { value: "alta_administrativa", label: "Alta administrativa" },
  { value: "bloqueio_interdicao", label: "Bloqueio / interdição" },
  { value: "parecer_regulatorio", label: "Parecer regulatório" },
];

const PRIORITIES = [
  { value: "verde", label: "Verde" },
  { value: "amarela", label: "Amarela" },
  { value: "vermelha", label: "Vermelha" },
];

export function NirRequestActions({ requests, typeFilter, defaultRequestType }: Props) {
  const { currentHospital, currentState } = useHospital();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    request_type: defaultRequestType || typeFilter || "interna",
    patient_name: "",
    patient_age: "",
    patient_record: "",
    origin_sector: "",
    destination_sector: "",
    priority: "amarela",
    reason: "",
    clinical_summary: "",
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["nir-regulation-requests"] });
    qc.invalidateQueries({ queryKey: ["nir-regulation-requests-all"] });
  };

  const create = async () => {
    if (!currentHospital?.id || !currentState?.id) return;
    if (!form.patient_name.trim() || !form.reason.trim()) {
      toast({ title: "Preencha paciente e motivo", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("regulation_requests").insert({
      ...form,
      patient_name: form.patient_name.toUpperCase(),
      hospital_unit_id: currentHospital.id,
      state_id: currentState.id,
      department: form.destination_sector || form.origin_sector || "NIR",
      status: "pendente",
      requested_by: user?.id ?? null,
      requested_by_name: user?.email?.split("@")[0]?.toUpperCase() ?? "NIR",
    });
    setBusy(false);
    if (error) {
      toast({ title: "Erro ao criar solicitação", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Solicitação criada" });
    setOpen(false);
    setForm({ ...form, patient_name: "", patient_age: "", patient_record: "", reason: "", clinical_summary: "" });
    refresh();
  };

  const updateStatus = async (id: string, newStatus: string, extra: Record<string, any> = {}) => {
    const { error } = await supabase
      .from("regulation_requests")
      .update({
        status: newStatus,
        regulator_id: user?.id ?? null,
        regulator_name: user?.email?.split("@")[0]?.toUpperCase() ?? "NIR",
        ...extra,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Solicitação ${newStatus}` });
    refresh();
  };

  const approve = (id: string) => updateStatus(id, "aprovada", { approved_at: new Date().toISOString() });
  const complete = (id: string) => updateStatus(id, "concluida", { completed_at: new Date().toISOString() });
  const deny = (id: string) => {
    const reason = window.prompt("Motivo da negação:") || "";
    if (!reason.trim()) return;
    updateStatus(id, "negada", { cancellation_reason: reason, canceled_at: new Date().toISOString() });
  };
  const cancel = (id: string) => {
    if (!window.confirm("Cancelar esta solicitação?")) return;
    updateStatus(id, "cancelada", { canceled_at: new Date().toISOString() });
  };

  return (
    <>
      <div className="flex items-center justify-end mb-2">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova solicitação
        </Button>
      </div>

      <div className="space-y-2">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Nenhuma solicitação. Clique em "Nova solicitação" para registrar.
            </CardContent>
          </Card>
        ) : (
          requests.map((req) => (
            <Card key={req.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="patient-id text-sm font-semibold text-foreground truncate">{req.patient_name}</p>
                      <Badge variant="outline" className="text-[10px]">{req.priority}</Badge>
                      <Badge
                        variant={
                          req.status === "pendente" ? "secondary" :
                          req.status === "aprovada" || req.status === "concluida" ? "default" :
                          req.status === "negada" || req.status === "cancelada" ? "destructive" : "outline"
                        }
                        className="text-[10px]"
                      >
                        {req.status}
                      </Badge>
                      {(req.status === "pendente" || req.status === "em_analise") && (
                        <SlaBadge startAt={req.created_at} thresholds={[60, 120, 180]} compact />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {req.origin_sector && <span>De: {req.origin_sector}</span>}
                      {req.destination_sector && <span>→ {req.destination_sector}</span>}
                      {req.cid_primary && <span>· CID {req.cid_primary}</span>}
                    </div>
                    {req.reason && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{req.reason}</p>}
                    {req.clinical_summary && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1 italic line-clamp-2">{req.clinical_summary}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {req.status === "pendente" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => updateStatus(req.id, "em_analise")}>
                          <Clock className="h-3 w-3 mr-1" /> Em análise
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => approve(req.id)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deny(req.id)}>
                          <XCircle className="h-3 w-3 mr-1" /> Negar
                        </Button>
                      </>
                    )}
                    {req.status === "em_analise" && (
                      <>
                        <Button size="sm" className="h-7 text-xs" onClick={() => approve(req.id)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deny(req.id)}>
                          <XCircle className="h-3 w-3 mr-1" /> Negar
                        </Button>
                      </>
                    )}
                    {req.status === "aprovada" && (
                      <>
                        <Button size="sm" className="h-7 text-xs" onClick={() => complete(req.id)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => cancel(req.id)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de criação */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova solicitação de regulação</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Paciente</Label>
              <Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value.toUpperCase() })} placeholder="NOME COMPLETO" />
            </div>
            <div>
              <Label className="text-xs">Idade</Label>
              <Input value={form.patient_age} onChange={(e) => setForm({ ...form, patient_age: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Prontuário</Label>
              <Input value={form.patient_record} onChange={(e) => setForm({ ...form, patient_record: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Setor de origem</Label>
              <Input value={form.origin_sector} onChange={(e) => setForm({ ...form, origin_sector: e.target.value })} placeholder="ex.: sala_vermelha" />
            </div>
            <div>
              <Label className="text-xs">Setor de destino</Label>
              <Input value={form.destination_sector} onChange={(e) => setForm({ ...form, destination_sector: e.target.value })} placeholder="ex.: red, ucc" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Motivo</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Resumo clínico</Label>
              <Textarea
                value={form.clinical_summary}
                onChange={(e) => setForm({ ...form, clinical_summary: e.target.value })}
                className="min-h-[70px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Criar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
