import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightLeft, BedDouble, Loader2, Shuffle, AlertCircle, User, MapPin, Eye, History, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Patient } from "@/types/patient";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";
import { isGhostBed } from "@/hooks/usePatients";
import { cn } from "@/lib/utils";
import { MovementConfirmDialog } from "@/components/MovementConfirmDialog";

// MIGRAÇÃO: a mega-tabela `patients` (leito+paciente numa linha) foi substituída por
// leitos (leito físico) + internacoes (ocupação, com leito_id) + pacientes (identidade).
// - Um "irmão" agora é uma INTERNAÇÃO ativa (data_alta IS NULL) num leito do mesmo setor.
// - Um "leito vago" é uma linha de `leitos` sem internação ativa apontando para ela.
// - Realocar = UPDATE internacoes.leito_id (+ leitos.status vago/ocupado).
// - Permutar = troca de leito_id entre duas internações ativas.
// Não há RPC de realocação/permuta no schema novo (verificado em types.ts) → updates diretos.
interface SiblingRow {
  id: string; // internacoes.id
  name: string;
  bed_number: string; // leitos.numero
  is_vacant: boolean | null;
  display_order: number | null;
  leito_id: string; // leitos.id
}

interface LeitoRow {
  id: string;
  numero: string;
  status: string;
}

interface BedReallocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  onSuccess?: () => void;
}

type VacantTarget = { bed_number: string; leito_id: string };

export function BedReallocationDialog({ open, onOpenChange, patient, onSuccess }: BedReallocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [siblings, setSiblings] = useState<SiblingRow[]>([]);
  const [leitos, setLeitos] = useState<LeitoRow[]>([]);
  const [tab, setTab] = useState<"realocar" | "permutar">("realocar");
  const [selectedTarget, setSelectedTarget] = useState<VacantTarget | null>(null);
  const [selectedSwap, setSelectedSwap] = useState<SiblingRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sectorConfig = SECTOR_BED_CONFIG[patient.sector as string];

  // Leito atual do paciente (resolvido pela lista de leitos do setor via numero).
  const currentLeitoId = useMemo(
    () => leitos.find((l) => l.numero === patient.bedNumber)?.id ?? null,
    [leitos, patient.bedNumber]
  );

  // Realocar = leitos do setor SEM internação ativa (e diferente do leito atual).
  const vacantTargets = useMemo<VacantTarget[]>(() => {
    const occupiedNumbers = new Set(siblings.map((s) => s.bed_number));
    return leitos
      .filter((l) => l.numero !== patient.bedNumber && !occupiedNumbers.has(l.numero))
      .map((l) => ({ bed_number: l.numero, leito_id: l.id }))
      .sort((a, b) => a.bed_number.localeCompare(b.bed_number));
  }, [leitos, siblings, patient.bedNumber]);

  // Permutar = qualquer internação ativa do setor, exceto a própria
  const swapCandidates = useMemo(
    () => [...siblings].sort((a, b) => a.bed_number.localeCompare(b.bed_number)),
    [siblings]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedTarget(null);
    setSelectedSwap(null);
    setTab("realocar");
    let cancel = false;
    (async () => {
      setLoading(true);
      // 1) Resolve o setor. MIGRAÇÃO: usePatientLive mapeia Patient.sector ← setores.nome,
      //    logo o código do setor está gravado em setores.nome.
      const { data: setorRows, error: setorErr } = await supabase
        .from("setores")
        .select("id")
        .eq("nome", patient.sector);
      if (cancel) return;
      const setorIds = (setorRows ?? []).map((s) => s.id);
      if (setorErr || setorIds.length === 0) {
        if (setorErr) toast.error("Falha ao carregar leitos do setor");
        setLeitos([]);
        setSiblings([]);
        setLoading(false);
        return;
      }

      // 2) Leitos do setor.
      const { data: leitoRows, error: leitoErr } = await supabase
        .from("leitos")
        .select("id, numero, status")
        .in("setor_id", setorIds);
      if (cancel) return;
      if (leitoErr) {
        toast.error("Falha ao carregar leitos do setor");
        setLoading(false);
        return;
      }
      const leitoList = (leitoRows ?? []).filter((l) => !!l.numero && !isGhostBed(l.numero)) as LeitoRow[];
      setLeitos(leitoList);

      // 3) Internações ATIVAS (data_alta IS NULL) nesses leitos, exceto a própria.
      const leitoIds = leitoList.map((l) => l.id);
      let sibs: SiblingRow[] = [];
      if (leitoIds.length > 0) {
        const { data: interRows, error: interErr } = await supabase
          .from("internacoes")
          .select("id, leito_id, paciente:pacientes(nome_completo, nome_social)")
          .in("leito_id", leitoIds)
          .is("data_alta", null)
          .neq("id", patient.id);
        if (cancel) return;
        if (interErr) {
          toast.error("Falha ao carregar internações do setor");
          setLoading(false);
          return;
        }
        const numeroByLeito = new Map(leitoList.map((l) => [l.id, l.numero] as const));
        sibs = ((interRows ?? []) as any[]).map((r: any) => {
          const pac = r.paciente || {};
          return {
            id: r.id,
            name: pac.nome_social || pac.nome_completo || "",
            bed_number: numeroByLeito.get(r.leito_id) ?? "",
            is_vacant: false,
            display_order: null,
            leito_id: r.leito_id,
          } as SiblingRow;
        }).filter((s) => !!s.bed_number);
      }
      setSiblings(sibs);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, patient.id, patient.sector]);

  // MIGRAÇÃO: move via internacoes.leito_id + leitos.status. `otherRow` != null → permuta
  // (troca de leito_id entre duas internações); null → realocação para leito vago.
  const performMove = async (otherRow: SiblingRow | null, targetBed: string, targetLeitoId: string) => {
    setSubmitting(true);
    try {
      if (!currentLeitoId) throw new Error("Leito atual do paciente não encontrado no setor.");
      if (!otherRow) {
        // Realocação simples: internação do paciente aponta para o leito destino.
        const { error } = await supabase
          .from("internacoes")
          .update({ leito_id: targetLeitoId })
          .eq("id", patient.id);
        if (error) throw error;
        // Atualiza status dos leitos (origem libera, destino ocupa).
        await supabase.from("leitos").update({ status: "livre" }).eq("id", currentLeitoId);
        await supabase.from("leitos").update({ status: "ocupado" }).eq("id", targetLeitoId);
      } else {
        // Permuta: troca leito_id entre as duas internações. Sem RPC atômica disponível
        // (verificado em types.ts) → dois updates com rollback best-effort.
        let r = await supabase
          .from("internacoes")
          .update({ leito_id: otherRow.leito_id })
          .eq("id", patient.id);
        if (r.error) throw r.error;
        r = await supabase
          .from("internacoes")
          .update({ leito_id: currentLeitoId })
          .eq("id", otherRow.id);
        if (r.error) {
          // rollback do primeiro update
          await supabase.from("internacoes").update({ leito_id: currentLeitoId }).eq("id", patient.id);
          throw r.error;
        }
        // Ambos os leitos permanecem ocupados — sem alteração de status.
      }
      toast.success(
        otherRow && otherRow.name?.trim()
          ? `Permuta concluída: ${patient.bedNumber} ↔ ${targetBed} (com ${otherRow.name})`
          : `Paciente realocado para ${targetBed}`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao mover paciente: " + (e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = () => {
    if (tab === "realocar" ? !selectedTarget : !selectedSwap) return;
    setConfirmOpen(true);
  };

  const doConfirm = () => {
    if (tab === "realocar") {
      if (!selectedTarget) return;
      performMove(null, selectedTarget.bed_number, selectedTarget.leito_id);
    } else {
      if (!selectedSwap) return;
      performMove(selectedSwap, selectedSwap.bed_number, selectedSwap.leito_id);
    }
    setConfirmOpen(false);
  };

  const sectorLabel = sectorConfig?.label ?? patient.sector;
  const canConfirm = tab === "realocar" ? !!selectedTarget : !!selectedSwap;
  const confirmLabel = tab === "realocar"
    ? `Confirmar realocação${selectedTarget ? ` para ${selectedTarget.bed_number}` : ""}`
    : `Confirmar permuta${selectedSwap ? ` ${patient.bedNumber} ↔ ${selectedSwap.bed_number}` : ""}`;

  const targetBed = tab === "realocar" ? selectedTarget?.bed_number : selectedSwap?.bed_number;
  const swapPartner = tab === "permutar" && selectedSwap?.name?.trim() ? selectedSwap.name : null;
  const isSwap = tab === "permutar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase">
            <Shuffle className="h-5 w-5 text-primary" />
            Realocar / Permutar leito
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold">{patient.name}</span> · Leito atual{" "}
            <Badge variant="outline" className="font-mono">{patient.bedNumber}</Badge>{" "}
            · Setor <span className="font-medium">{sectorLabel}</span> (movimentação interna ao setor — leitos são fixos)
          </DialogDescription>
        </DialogHeader>

        {!sectorConfig && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            Setor sem configuração de leitos disponível para realocação interna.
          </div>
        )}

        {sectorConfig && (
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "realocar" | "permutar"); setSelectedTarget(null); setSelectedSwap(null); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="realocar" className="gap-2">
                <BedDouble className="h-4 w-4" /> Realocar (leito vago)
              </TabsTrigger>
              <TabsTrigger value="permutar" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Permutar (vago ou ocupado)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="realocar" className="mt-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando leitos...
                </div>
              ) : vacantTargets.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum leito vago neste setor. Use a aba <strong>Permutar</strong> para trocar com outro paciente.
                </div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {vacantTargets.map((t) => {
                      const isSel = selectedTarget?.bed_number === t.bed_number;
                      return (
                        <button
                          key={t.bed_number}
                          type="button"
                          onClick={() => setSelectedTarget(t)}
                          className={cn(
                            "rounded-lg border p-3 text-center font-mono text-sm transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSel
                              ? "border-primary bg-primary/10 ring-2 ring-primary/40 font-semibold"
                              : "border-border bg-background"
                          )}
                        >
                          <BedDouble className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
                          {t.bed_number}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="permutar" className="mt-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando leitos...
                </div>
              ) : swapCandidates.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Não há outros leitos neste setor para permuta.
                </div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="space-y-1.5">
                    {swapCandidates.map((s) => {
                      const occupied = !!s.name?.trim();
                      const isSel = selectedSwap?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSwap(s)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSel
                              ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                              : "border-border bg-background"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Badge variant="outline" className="font-mono shrink-0">{s.bed_number}</Badge>
                            {occupied ? (
                              <span className="font-medium uppercase truncate">{s.name}</span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400 text-xs uppercase font-semibold">Leito vago</span>
                            )}
                          </div>
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>

      <MovementConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => !submitting && setConfirmOpen(o)}
        onConfirm={doConfirm}
        isSubmitting={submitting}
        title={isSwap ? "Confirmar permuta de leitos" : "Confirmar realocação de leito"}
        confirmLabel={isSwap ? "Confirmar permuta" : "Confirmar realocação"}
        summary={[
          { icon: User, label: "Paciente", value: patient.name },
          { icon: BedDouble, label: "Leito atual", value: `${patient.bedNumber} • ${sectorLabel}` },
          { icon: MapPin, label: isSwap ? "Leito da permuta" : "Leito de destino", value: targetBed || "—" },
          ...(swapPartner ? [{ icon: User, label: "Paciente recíproco", value: swapPartner }] : []),
        ]}
        consequences={[
          { icon: ArrowRightLeft, text: isSwap
            ? <>Os <strong>dois pacientes</strong> trocarão de leito atomicamente. Cada movimentação é registrada na linha do tempo de ambos.</>
            : <>O paciente será movido do leito <strong>{patient.bedNumber}</strong> para o leito <strong>{targetBed}</strong>, dentro do mesmo setor.</> },
          { icon: ClipboardList, text: <>O histórico assistencial (prescrições, evoluções, exames, cuidados) <strong>permanece vinculado ao paciente</strong> — nada é apagado.</> },
          { icon: BedDouble, text: isSwap
            ? <>O censo do setor permanece o mesmo (somente os números de leito mudam).</>
            : <>O leito de origem fica <strong>livre</strong> para nova alocação imediatamente.</> },
          { icon: Eye, text: <>O paciente continua visível em todos os módulos clínicos e dashboards.</> },
          { icon: History, text: <>A movimentação aparece no <strong>Histórico do Paciente</strong> e na auditoria do hospital.</> },
        ]}
        warnings={isSwap && swapPartner
          ? [{ label: "Permuta com paciente ocupado", detail: `${swapPartner} também será movido(a). Confirme com a equipe assistencial.` }]
          : []}
        finalNote={<>A operação é atômica — em caso de falha, ambos os leitos voltam ao estado original automaticamente.</>}
      />
    </Dialog>
  );
}
