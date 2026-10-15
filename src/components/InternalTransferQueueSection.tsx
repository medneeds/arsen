import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowRightLeft, BedDouble, ChevronDown, ChevronUp, AlertTriangle, Clock, X, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useInternalTransferQueue, type InternalTransferRequestRow } from "@/hooks/useInternalTransferQueue";
import { usePatients } from "@/hooks/usePatients";
import { completeInternalTransfer, cancelInternalTransferRequest } from "@/lib/internalTransfer";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import { classificationLabel, sectorRequiresSaps } from "@/lib/sectorComplexity";
import { BedSelectorGrid, type BedOption } from "@/components/shared/BedSelectorGrid";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSapsSectors } from "@/hooks/useSapsSectors";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  sectorCode: string;
  /** Chamado apos concluir/cancelar uma transferencia, para o MAPA do pai
   *  (Index) refazer na hora — este componente tem usePatients proprio (so para
   *  listar leitos vagos), que nao e o do mapa. Sem isto, o paciente so aparece
   *  no destino via realtime (intermitente) ou apos F5. */
  onTransferComplete?: () => void;
}

export function InternalTransferQueueSection({ sectorCode, onTransferComplete }: Props) {
  const { toast } = useToast();
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { rows, refresh } = useInternalTransferQueue(sectorCode);
  // Buscar TODOS os pacientes do hospital (sem filtro de setor)
  // para encontrar leitos vagos em qualquer setor destino da transferência.
  // usePatients() sem parâmetros retorna apenas o setor ativo do usuário.
  const { patients, isLoading: patientsLoading, refetch } = usePatients(undefined, undefined);
  const [target, setTarget] = useState<InternalTransferRequestRow | null>(null);
  const [bedId, setBedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshingBeds, setRefreshingBeds] = useState(false);
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  // Popula o cache de habilitacao de SAPS (setores.aplica_saps) para o gate do
  // prompt pos-conclusao refletir o banco (UTI 1/UTI 2/UCI 2).
  useSapsSectors();
  // Prompt pos-conclusao de ESCALADA para setor de UTI/SAPS: oferece seguir para
  // a admissao de cuidados intensivos (preencher + validar) e/ou o SAPS 3. O
  // atendimento CONTINUA (mesma internacao) — isto abre o fluxo de admissao de UTI
  // no destino, nao um novo atendimento.
  const [postPrompt, setPostPrompt] = useState<
    { internacaoId: string; patientName: string; bed: string; sectorCode: string } | null
  >(null);

  // MIGRAÇÃO: profissional_id (profissionais.id) != auth.uid — resolvido via user_id.
  const resolveProfissionalId = async (userId?: string | null): Promise<string | null> => {
    if (!userId) return null;
    try {
      const { data } = await supabase.from("profissionais").select("id").eq("user_id", userId).maybeSingle();
      return (data as { id?: string } | null)?.id ?? null;
    } catch {
      return null;
    }
  };

  // Navegacao unica para a /admissao (mesma do pop-up de alocacao). tab="admissao"
  // abre o corpo de Cuidados Intensivos; tab="saps" abre a aba SAPS 3.
  const goToPostAdmission = (tab: "admissao" | "saps") => {
    if (!postPrompt) return;
    const info = postPrompt;
    setPostPrompt(null);
    const q = new URLSearchParams({
      patientId: info.internacaoId,
      patientName: info.patientName,
      patientBed: info.bed,
      patientSector: info.sectorCode,
    });
    if (tab === "saps") q.set("tab", "saps");
    navigate(`/admissao?${q.toString()}`);
  };

  // "Depois": cria a ficha SAPS pendente (24h) se ainda nao houver, ancorada na
  // internacao. (Sem isto, o toast "SAPS pendente" nao tinha lastro no banco e a
  // tarja de SAPS pendente no mapa nunca aparecia apos a escalada.)
  const handlePostLater = async () => {
    if (!postPrompt) return;
    const { internacaoId } = postPrompt;
    try {
      const { data: existing } = await supabase
        .from("avaliacoes_saps3")
        .select("id")
        .eq("internacao_id", internacaoId)
        .limit(1)
        .maybeSingle();
      if (!existing) {
        const registradoPor = await resolveProfissionalId(user?.id);
        const { error } = await supabase.from("avaliacoes_saps3").insert({
          internacao_id: internacaoId,
          status: "pendente",
          pending_since: new Date().toISOString(),
          criado_por: registradoPor,
        });
        if (error) throw error;
      }
      toast({ title: "SAPS 3 pendente", description: "Voce tem 24h para completar." });
    } catch (err) {
      toast({ title: "Erro ao criar SAPS pendente", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setPostPrompt(null);
    }
  };

  // Abre o diálogo e RE-BUSCA os leitos vagos na hora. O realtime (self-hosted)
  // é intermitente na VPS, então um leito recém-desalocado podia demorar a
  // aparecer; buscar no clique garante a lista fresca sem recarregar a página.
  const openAllocate = async (r: InternalTransferRequestRow) => {
    setTarget(r);
    setBedId("");
    setRefreshingBeds(true);
    try { await refetch(); } finally { setRefreshingBeds(false); }
  };

  const availableBeds = useMemo(() => {
    if (!target?.target_sector_code) return [];
    const targetSector = target.target_sector_code;
    // Mapear sector_code → department para cobrir pacientes com department preenchido
    const SECTOR_TO_DEPT: Record<string, string> = {
      enfermaria_transicao: "ENFERMARIA DE TRANSIÇÃO",
      enfermaria_vascular:  "ENFERMARIA VASCULAR",
      neuro_01: "NEURO 01", neuro_02: "NEURO 02",
      clinica_cirurgica: "CLÍNICA CIRÚRGICA",
      ucc: "UCC", blue: "UCI 1", outside: "UCI 2",
      sala_vermelha: "SALA VERMELHA", sala_laranja: "SALA LARANJA",
      observacao_clinica: "OBSERVAÇÃO CLÍNICA",
    };
    const deptEquivalent = SECTOR_TO_DEPT[targetSector];
    return (patients ?? [])
      .filter((p) => {
        const matchSector = p.sector === targetSector;
        const matchDept   = deptEquivalent && (p as { department?: string }).department === deptEquivalent;
        const isVacant    = !p.name || p.name.trim() === "";
        return (matchSector || matchDept) && isVacant;
      })
      .sort((a, b) => (parseInt(a.bedNumber) || 0) - (parseInt(b.bedNumber) || 0));
  }, [patients, target?.target_sector_code]);

  // Todos os leitos do setor destino (livres + ocupados) para o grid animado —
  // mesma experiencia visual do pre-admitir. Livres selecionaveis; ocupados
  // exibidos desabilitados. Sem EXTRA nesta fase (seria criar leito no destino).
  const sectorBeds = useMemo<BedOption[]>(() => {
    if (!target?.target_sector_code) return [];
    const targetSector = target.target_sector_code;
    const SECTOR_TO_DEPT: Record<string, string> = {
      enfermaria_transicao: "ENFERMARIA DE TRANSIÇÃO",
      enfermaria_vascular:  "ENFERMARIA VASCULAR",
      neuro_01: "NEURO 01", neuro_02: "NEURO 02",
      clinica_cirurgica: "CLÍNICA CIRÚRGICA",
      ucc: "UCC", blue: "UCI 1", outside: "UCI 2",
      sala_vermelha: "SALA VERMELHA", sala_laranja: "SALA LARANJA",
      observacao_clinica: "OBSERVAÇÃO CLÍNICA",
    };
    const deptEquivalent = SECTOR_TO_DEPT[targetSector];
    return (patients ?? [])
      .filter((p) => p.sector === targetSector || (deptEquivalent && (p as { department?: string }).department === deptEquivalent))
      .sort((a, b) => (parseInt(a.bedNumber) || 0) - (parseInt(b.bedNumber) || 0))
      .map((p) => ({
        id: p.id,
        label: p.bedNumber,
        status: (!p.name || p.name.trim() === "") ? ("livre" as const) : ("ocupado" as const),
      }));
  }, [patients, target?.target_sector_code]);

  const handleAllocate = async () => {
    if (!target || !bedId) return;
    const bed = (patients ?? []).find((p) => p.id === bedId);
    if (!bed) return;
    // Guarda: so leito vago (o grid ja desabilita ocupados, mas reforcamos para
    // nunca apontar uma internacao para um leito ja ocupado).
    if (bed.name && bed.name.trim() !== "") {
      toast({ title: "Leito ocupado", description: "Selecione um leito vago.", variant: "destructive" });
      return;
    }
    if (!currentHospital || !currentState) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await completeInternalTransfer({
        requestId: target.id,
        sourceInternacaoId: target.source_patient_id,
        targetBedRow: bed,
        currentUserId: user?.id ?? null,
        hospitalUnitId: currentHospital.id,
        stateId: currentState.id,
        department: currentDepartment ?? null,
      });
      if (!res.ok) throw new Error(res.error);
      if (res.aviso) {
        // Estado parcial recuperavel (ocupacao do destino / liberacao da origem / log) — nao silenciar.
        toast({ title: "Alocacao concluida com ressalva", description: res.aviso, variant: "destructive" });
      } else {
        toast({
          title: target.requires_saps ? "Paciente pré-admitido (SAPS pendente)" : "Paciente alocado",
          description: `Leito ${bed.bedNumber} • ${sectorLabelFromCode(bed.sector)}.`,
        });
      }
      // Destino de UTI/SAPS (escalada critica enfermaria->UTI): abre o fluxo de
      // admissao de cuidados intensivos no destino. O atendimento CONTINUA (mesma
      // internacao, source_patient_id) — isto nao e novo atendimento, e a nova
      // admissao clinica do setor critico. Captura os dados ANTES de limpar target.
      const destNeedsUti = !!target.requires_saps || sectorRequiresSaps(bed.sector);
      const postInfo = destNeedsUti
        ? {
            internacaoId: target.source_patient_id,
            patientName: target.patient_name,
            bed: bed.bedNumber,
            sectorCode: bed.sector,
          }
        : null;

      setTarget(null);
      setBedId("");
      refresh();
      // Re-busca o mapa: o leito recém-ocupado sai da lista de vagos e a origem
      // liberada entra, sem depender do realtime (intermitente na VPS) nem de F5.
      refetch();
      // Avisa o MAPA do pai (Index) para refazer — o refetch acima e so da
      // instancia local (lista de vagos). Sem isto, o paciente transferido so
      // aparecia no destino via realtime ou reload.
      onTransferComplete?.();
      if (postInfo) setPostPrompt(postInfo);
    } catch (err) {
      toast({ title: "Erro ao alocar", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (row: InternalTransferRequestRow) => {
    const reason = window.prompt("Motivo do cancelamento da transferência interna sinalizada:");
    if (!reason || reason.trim().length < 5) return;
    const { data: { user } } = await supabase.auth.getUser();
    const res = await cancelInternalTransferRequest(row.id, row.source_patient_id, reason.trim(), user?.id ?? null);
    if (!res.ok) {
      toast({ title: "Erro", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Sinalização cancelada", description: "O paciente foi removido da fila virtual. Realoque manualmente se necessário." });
    refresh();
    onTransferComplete?.();
  };

  // Não renderiza nada se não há transferências pendentes —
  // o card informativo fica apenas quando há itens na fila.
  if (rows.length === 0) return null;

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="print:hidden">
        <Card className="border-border bg-muted/50">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">
                  AGUARDANDO ALOCAÇÃO POR TRANSFERÊNCIA INTERNA
                </span>
                <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
              </div>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-md border bg-background p-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-sm">{r.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Origem: {sectorLabelFromCode(r.source_sector ?? "")} • Leito {r.source_bed ?? "—"}
                      {r.encounter_code && <> • <strong>Atend. #{r.encounter_code}</strong></>}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{classificationLabel(r.classification)}</Badge>
                      {r.requires_saps && (
                        <Badge className="text-xs bg-warning hover:bg-warning/90"><AlertTriangle className="h-3 w-3 mr-1" />SAPS após alocação</Badge>
                      )}
                      <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />{new Date(r.signaled_at).toLocaleString("pt-BR")}</Badge>
                    </div>
                    {r.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{r.reason}"</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => openAllocate(r)}>
                      <BedDouble className="h-3.5 w-3.5 mr-1" />
                      {r.requires_saps ? "Pré-admitir" : "Alocação direta"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(r)} title="Cancelar sinalização">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={!!target} onOpenChange={(v) => !submitting && !v && setTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {target?.requires_saps ? "Pré-admitir no leito" : "Alocação direta no leito"}
            </DialogTitle>
            <DialogDescription>
              {target?.requires_saps
                ? "Escalada para setor crítico — após alocar o leito, o paciente entrará com status SAPS pendente e o timer de cobrança será iniciado."
                : target?.classification === "escalada_intermediaria"
                  ? "Escalada para UCI 1 — será aberta nova admissão no destino. Histórico anterior preservado no prontuário."
                  : "Continuidade do mesmo atendimento — sem nova admissão, histórico integral preservado."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-muted p-3 text-xs">
              <p className="font-medium text-sm">{target?.patient_name}</p>
              <p className="text-muted-foreground">
                De: {sectorLabelFromCode(target?.source_sector ?? "")} • Leito {target?.source_bed ?? "—"}
              </p>
              <p className="text-muted-foreground">Para: {target?.target_sector_label}</p>
            </div>
            <div className="space-y-2">
              <Label>Leito disponível *</Label>
              {(patientsLoading || refreshingBeds) && availableBeds.length === 0 ? (
                // Delay ate os leitos vagos carregarem: spinner em vez de mostrar
                // "nenhum leito vago" cedo demais (padrao de loading da plataforma).
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando leitos vagos...
                </div>
              ) : availableBeds.length === 0 ? (
                <p className="text-xs text-destructive">Nenhum leito vago neste setor.</p>
              ) : (
                <BedSelectorGrid beds={sectorBeds} value={bedId || null} onChange={setBedId} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleAllocate} disabled={submitting || !bedId}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {submitting ? "Alocando..." : "Confirmar alocação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt pos-conclusao de ESCALADA para UTI/UCI 2 (SAPS): abre o fluxo de
          admissao de cuidados intensivos no destino. Mesma oferta do pop-up de
          alocacao — Ir para admissao / Preencher SAPS 3 / Depois (pendente 24h). */}
      <AlertDialog open={!!postPrompt} onOpenChange={(o) => { if (!o) setPostPrompt(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-primary" />
              Admissão em cuidados intensivos
            </AlertDialogTitle>
            <AlertDialogDescription>
              {postPrompt?.patientName} foi alocado no leito {postPrompt?.bed}. Como os cuidados
              foram escalonados para setor crítico, abra a admissão de cuidados intensivos
              (preencher e validar) ou preencha o SAPS 3 agora. O atendimento continua o mesmo —
              o histórico é preservado. O SAPS 3 também pode ficar pendente por até 24h.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:gap-2 sm:space-x-0">
            <AlertDialogAction onClick={() => goToPostAdmission("admissao")} className="w-full">
              Ir para admissão
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => goToPostAdmission("saps")}
              className="w-full border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Preencher SAPS 3 agora
            </AlertDialogAction>
            <AlertDialogCancel onClick={handlePostLater} className="w-full mt-0">
              Depois (manter SAPS pendente — 24h)
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
