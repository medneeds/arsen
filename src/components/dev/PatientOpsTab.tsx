import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Search, ShieldAlert, ArrowRightLeft, RotateCcw, BedDouble, X, User, Info } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PatientRow = {
  id: string;
  name: string;
  bed_number: string | null;
  sector: string | null;
  admission_status: string | null;
  is_vacant: boolean;
  updated_at: string | null;
  medical_record: string | null;
  hasPendingTransfer: boolean;
};

type Inspection = {
  patient: any;
  encounters: any[];
  transfers: any[];
  movements: any[];
  documents: any[];
};

type PendingAction = {
  kind: "cancel_transfer" | "reopen_encounter" | "release_orphan_bed" | "place_in_bed";
  action: string;
  params: Record<string, unknown>;
  plan: any;
  title: string;
  description: string;
  requiresReason?: boolean;
};

type VacantBed = { id: string; bed_number: string | null; sector: string | null };

const callOps = async (action: string, params: Record<string, unknown> = {}, confirm = false) => {
  const { data, error } = await supabase.functions.invoke("dev-console-ops", {
    body: { action, params, confirm },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};

const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

export function PatientOpsTab() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PatientRow | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [executing, setExecuting] = useState(false);
  const [reason, setReason] = useState("");
  const [vacantQuery, setVacantQuery] = useState("");
  const [vacantBeds, setVacantBeds] = useState<VacantBed[]>([]);
  const [loadingVacant, setLoadingVacant] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string>("");

  const search = async (q?: string) => {
    setLoading(true);
    try {
      const r = await callOps("list_patients_for_dev", { query: q ?? query, limit: 50 });
      setRows(r.patients ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na busca");
    } finally { setLoading(false); }
  };
  useEffect(() => { search(""); }, []);

  const inspect = async (p: PatientRow) => {
    setSelected(p);
    setInspection(null);
    setInspecting(true);
    try {
      const r = await callOps("inspect_patient", { patientId: p.id });
      setInspection(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao inspecionar");
    } finally { setInspecting(false); }
  };

  const preview = async (opts: {
    kind: PendingAction["kind"];
    action: string;
    params: Record<string, unknown>;
    title: string;
    description: string;
  }) => {
    try {
      const r = await callOps(opts.action, { ...opts.params, dryRun: true });
      setPending({ ...opts, plan: r.plan });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na prévia");
    }
  };

  const execute = async () => {
    if (!pending) return;
    setExecuting(true);
    try {
      await callOps(pending.action, { ...pending.params, dryRun: false }, true);
      toast.success("Ação executada com sucesso");
      setPending(null);
      if (selected) inspect(selected);
      search();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar");
    } finally { setExecuting(false); }
  };

  const filtered = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-4">
      <Card className="border-sky-200 bg-sky-50/40 dark:bg-sky-950/20 dark:border-sky-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-sky-900 dark:text-sky-200">
            <ShieldAlert className="h-4 w-4" /> Correção de pacientes com transferência travada
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-sky-900/80 dark:text-sky-100/80 space-y-1.5">
          <p>
            Use esta aba <strong>apenas</strong> para destravar casos onde a transferência interna deixou o paciente em estado inconsistente
            (ex.: leito de origem vazio + fila virtual pendente sem alocação, encounter fechado por engano, leito órfão com dados clínicos).
          </p>
          <p>
            Todas as ações <strong>não tocam</strong> prescrições, evoluções, exames ou prontuário — só camadas de movimentação/leito/transferência.
            Cada execução gera <code className="font-mono">audit_logs</code> com action <code className="font-mono">DEV_FIX_TRANSFER</code>.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        {/* LISTA */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm flex-1">Pacientes</CardTitle>
              <Badge variant="outline" className="text-xs">{filtered.length}</Badge>
            </div>
            <div className="flex gap-1.5 pt-2">
              <Input
                placeholder="Nome / leito / setor / prontuário…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => search()} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[560px]">
              <div className="divide-y divide-border">
                {filtered.length === 0 && !loading && (
                  <div className="p-6 text-center text-xs text-muted-foreground">Nenhum paciente.</div>
                )}
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => inspect(p)}
                    className={`w-full text-left p-3 text-xs hover:bg-muted/40 transition ${selected?.id === p.id ? "bg-muted/60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate flex-1">{p.name || <em className="text-muted-foreground">(leito vago)</em>}</span>
                      {p.hasPendingTransfer && (
                        <Badge variant="outline" className="text-[9px] gap-1 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40">
                          <ArrowRightLeft className="h-2.5 w-2.5" /> TRANSF. PENDENTE
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1 text-muted-foreground text-[11px]">
                      <span className="font-mono">{p.bed_number ?? "—"}</span>
                      <span>·</span>
                      <span className="truncate">{p.sector ?? "—"}</span>
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-[9px] font-mono">{p.admission_status ?? "sem status"}</Badge>
                      {p.is_vacant && <Badge variant="outline" className="text-[9px]">vago</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* PAINEL DE INSPEÇÃO */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              {selected ? selected.name || "(leito vago)" : "Selecione um paciente"}
            </CardTitle>
            {selected && (
              <Button size="sm" variant="ghost" onClick={() => inspect(selected)} disabled={inspecting}>
                <RefreshCw className={`h-3.5 w-3.5 ${inspecting ? "animate-spin" : ""}`} />
              </Button>
            )}
          </CardHeader>
          <CardContent className="text-xs">
            {!selected && (
              <p className="text-muted-foreground py-8 text-center">
                <Info className="h-4 w-4 inline mr-1" /> Escolha um paciente à esquerda para inspecionar e corrigir.
              </p>
            )}
            {selected && inspecting && (
              <p className="py-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…</p>
            )}
            {inspection && (
              <ScrollArea className="h-[540px] pr-3">
                <div className="space-y-4">
                  {/* Identidade */}
                  <section>
                    <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Identidade & leito</h4>
                    <div className="rounded-md border border-border bg-muted/20 p-2 space-y-1">
                      <div><span className="text-muted-foreground">Leito:</span> <span className="font-mono">{inspection.patient?.bed_number ?? "—"}</span> · <span className="font-mono">{inspection.patient?.sector ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Prontuário:</span> <span className="font-mono">{inspection.patient?.medical_record ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Status:</span> <Badge variant="secondary" className="text-[10px] font-mono ml-1">{inspection.patient?.admission_status ?? "—"}</Badge> {inspection.patient?.is_vacant && <Badge variant="outline" className="text-[10px] ml-1">vago</Badge>}</div>
                      <div><span className="text-muted-foreground">Registry ID:</span> <span className="font-mono text-[10px]">{inspection.patient?.patient_registry_id ?? "—"}</span></div>
                    </div>
                  </section>

                  {/* Transferências pendentes */}
                  <section>
                    <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3 w-3" /> Transferências internas
                    </h4>
                    {inspection.transfers.length === 0 ? (
                      <p className="text-muted-foreground text-[11px] italic">Nenhuma.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {inspection.transfers.map((t) => (
                          <div key={t.id} className="rounded-md border border-border p-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={t.status === "pending" ? "default" : t.status === "cancelled" ? "outline" : "secondary"} className="text-[9px]">
                                {t.status}
                              </Badge>
                              <span className="text-[11px]">{t.source_sector} <ArrowRightLeft className="h-2.5 w-2.5 inline mx-1" /> {t.target_sector_label ?? t.target_sector_code}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground">{fmt(t.signaled_at)}</span>
                            </div>
                            {t.status === "pending" && (
                              <div className="pt-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-6 text-[10px] gap-1"
                                  onClick={() => preview({
                                    kind: "cancel_transfer",
                                    action: "fix_transfer_cancel_pending",
                                    params: { requestId: t.id },
                                    title: "Cancelar transferência sinalizada",
                                    description: "Marca o request como cancelled e — se o leito de origem estiver vazio — restaura o paciente no leito.",
                                  })}
                                >
                                  <X className="h-3 w-3" /> Cancelar e restaurar leito
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Encounters */}
                  <section>
                    <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Atendimentos (encounter)</h4>
                    {inspection.encounters.length === 0 ? (
                      <p className="text-muted-foreground text-[11px] italic">Nenhum.</p>
                    ) : (
                      <div className="space-y-1">
                        {inspection.encounters.map((e) => {
                          const closed = !!e.ended_at;
                          const ageHours = closed ? (Date.now() - new Date(e.ended_at).getTime()) / 3_600_000 : 0;
                          const canReopen = closed && ageHours <= 24;
                          return (
                            <div key={e.id} className="rounded-md border border-border p-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px]">{e.encounter_code ?? e.id.slice(0, 8)}</span>
                                <Badge variant={closed ? "outline" : "default"} className="text-[9px]">
                                  {closed ? "encerrado" : "aberto"}
                                </Badge>
                                <span className="ml-auto text-[10px] text-muted-foreground">{fmt(e.started_at)}{closed && ` → ${fmt(e.ended_at)}`}</span>
                              </div>
                              {canReopen && (
                                <div className="pt-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] gap-1"
                                    onClick={() => preview({
                                      kind: "reopen_encounter",
                                      action: "fix_transfer_reopen_encounter",
                                      params: { encounterId: e.id },
                                      title: "Reabrir encounter",
                                      description: `Reabre o atendimento fechado há ${ageHours.toFixed(1)}h. Só permitido para encounters fechados nas últimas 24h.`,
                                    })}
                                  >
                                    <RotateCcw className="h-3 w-3" /> Reabrir
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Ação órfã */}
                  <section>
                    <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Leito órfão</h4>
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Use quando o paciente já teve desfecho mas o leito continua ocupado no mapa (arquiva dados clínicos e libera o leito).
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1"
                      disabled={!inspection.patient || inspection.patient.is_vacant}
                      onClick={() => preview({
                        kind: "release_orphan_bed",
                        action: "fix_transfer_release_orphan_bed",
                        params: { patientId: inspection.patient.id },
                        title: "Liberar leito órfão",
                        description: "Arquiva dados clínicos vinculados a esta linha do leito e reseta o leito para vago. NÃO apaga evolução/prescrição — arquiva.",
                      })}
                    >
                      <BedDouble className="h-3.5 w-3.5" /> Arquivar & liberar leito
                    </Button>
                  </section>

                  {/* Movimentações */}
                  <section>
                    <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Últimas movimentações</h4>
                    {inspection.movements.length === 0 ? (
                      <p className="text-muted-foreground text-[11px] italic">Nenhuma.</p>
                    ) : (
                      <div className="space-y-0.5">
                        {inspection.movements.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-[10px] border-b border-border/40 py-0.5">
                            <span className="font-mono">{m.movement_type}</span>
                            <span className="text-muted-foreground truncate flex-1">{m.destination ?? m.patient_sector ?? "—"}</span>
                            <Badge variant="outline" className="text-[9px]">{m.release_status}</Badge>
                            <span className="text-muted-foreground">{fmt(m.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CONFIRMAÇÃO */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !executing && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" /> {pending?.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground">{pending?.description}</p>
                <pre className="rounded-md bg-muted p-2 text-[10px] max-h-[280px] overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(pending?.plan ?? {}, null, 2)}
                </pre>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  A execução é auditada em <code className="font-mono">audit_logs</code> (action <code className="font-mono">DEV_FIX_TRANSFER</code>).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); execute(); }}
              disabled={executing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Confirmar e executar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
