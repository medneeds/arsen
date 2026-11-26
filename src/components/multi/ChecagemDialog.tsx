import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useChecagemAcoes, type AprazamentoRow, type AdministracaoRow } from "@/hooks/useAprazamento";
import { instanteChecagem, type ItemAprazavel } from "@/lib/aprazamentoItens";
import { categoriaLabel } from "@/lib/fluidBalance";
import { fortalezaParts } from "@/lib/docPrefixes";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const fmtHora = (d: Date) => { const p = fortalezaParts(d); return `${pad(p.hour)}:${pad(p.minute)}`; };

export interface AlvoChecagem {
  internacaoId: string;
  prescricaoId: string;
  /** horario aprazado; null = dose S/N/avulsa */
  apz: AprazamentoRow | null;
  item: ItemAprazavel | null;
  /** rotulo extra no titulo (ex.: leito no "Meu plantao") */
  contexto?: string;
}

/**
 * Checagem de dose — UNICA para a tela de aprazamento e o "Meu plantao".
 * Regras: hora nao futura; nao realizado, dose S/N e antecipacao > 1 h exigem
 * motivo; volume vai para o BH (o banco lanca); MAV pede dupla checagem por
 * outro profissional, no login dele; anular checagem anula o ganho no BH.
 */
export function ChecagemDialog({
  alvo, checagem, meuProfissionalId, podeChecar, onClose,
}: {
  alvo: AlvoChecagem | null;
  checagem: AdministracaoRow | null;
  meuProfissionalId: string | null;
  podeChecar: boolean;
  onClose: () => void;
}) {
  const acoes = useChecagemAcoes();
  const [status, setStatus] = useState<"realizado" | "nao_realizado">("realizado");
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [volume, setVolume] = useState("");
  const [anulando, setAnulando] = useState<AdministracaoRow | null>(null);
  const [motivoAnul, setMotivoAnul] = useState("");

  useEffect(() => {
    if (!alvo) return;
    setStatus("realizado");
    setHora(fmtHora(new Date()));
    setMotivo("");
    const vol = alvo.apz?.volume_ml ?? alvo.item?.volumeMl ?? null;
    setVolume(vol != null ? String(vol) : "");
  }, [alvo]);

  const apz = alvo?.apz ?? null;
  const item = alvo?.item ?? null;
  const instante = alvo ? instanteChecagem(hora, apz ? new Date(apz.horario) : new Date()) : null;
  const futuro = !!instante && instante.getTime() > Date.now() + 5 * 60_000;
  const volumeNum = volume.trim() ? Number(volume.replace(",", ".")) : null;
  const bhCategoria = apz?.bh_categoria ?? item?.bhCategoria ?? null;
  const antecipada = !!apz && status === "realizado" && !!instante
    && instante.getTime() < new Date(apz.horario).getTime() - 60 * 60_000;
  const precisaMotivo = status === "nao_realizado" || !apz || antecipada;
  const valido = !!instante && !futuro && (!precisaMotivo || motivo.trim().length >= 3)
    && (volumeNum == null || (Number.isFinite(volumeNum) && volumeNum > 0 && volumeNum < 10000));
  const mav = apz?.mav ?? item?.mav ?? false;

  const confirmar = () => {
    if (!alvo || !instante) return;
    acoes.checar.mutate({
      internacaoId: alvo.internacaoId,
      aprazamentoId: apz?.id ?? null,
      prescricaoId: apz?.prescricao_id ?? alvo.prescricaoId,
      itemId: apz?.item_id ?? item!.itemId,
      itemNome: apz?.item_nome ?? item!.nome,
      status,
      realizadoEm: instante,
      motivo: apz ? (motivo || undefined) : `${status === "realizado" ? "Dose S/N/avulsa" : "Não realizada"}: ${motivo}`,
      volumeMl: bhCategoria ? volumeNum : null,
      bhCategoria,
      mav,
    }, { onSuccess: onClose });
  };

  return (
    <>
      <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {alvo?.contexto ? `${alvo.contexto} · ` : ""}{apz ? `${apz.item_nome} — ${fmtHora(new Date(apz.horario))}` : `${item?.nome ?? ""} — dose S/N`}
            </DialogTitle>
            <DialogDescription>{apz?.item_resumo ?? item?.resumo}</DialogDescription>
          </DialogHeader>
          {checagem ? (
            <div className="space-y-3 text-sm">
              <div className={cn("rounded-md border px-3 py-2", checagem.status === "realizado" ? "border-released/40 bg-released-soft text-released-on-soft" : "border-warning/40 bg-warning-soft text-warning-on-soft")}>
                {checagem.status === "realizado" ? "Realizada" : "Não realizada"} às {fmtHora(new Date(checagem.realizado_em))} por {checagem.registrado_por_nome ?? "—"}
                {checagem.motivo && <div className="text-xs">{checagem.motivo}</div>}
                {checagem.volume_ml ? <div className="text-xs">{checagem.volume_ml} mL lançados no balanço hídrico</div> : null}
              </div>
              {checagem.mav && checagem.status === "realizado" && (
                checagem.dupla_checagem_em
                  ? <div className="text-xs text-muted-foreground">Dupla checagem MAV por {checagem.dupla_checagem_por_nome} às {fmtHora(new Date(checagem.dupla_checagem_em))}</div>
                  : checagem.registrado_por === meuProfissionalId
                    ? <div className="flex items-center gap-1.5 text-xs font-medium text-warning-on-soft"><ShieldAlert className="h-3.5 w-3.5" /> Dupla checagem pendente: deve ser feita por outro profissional, no login dele.</div>
                    : podeChecar && <Button size="sm" className="gap-2" disabled={acoes.duplaChecagem.isPending} onClick={() => acoes.duplaChecagem.mutate(checagem.id, { onSuccess: onClose })}><ShieldAlert className="h-4 w-4" /> Confirmar dupla checagem</Button>
              )}
              {podeChecar && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setAnulando(checagem); setMotivoAnul(""); onClose(); }}>Anular checagem</Button>}
            </div>
          ) : (
            <div className="space-y-3">
              {mav && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"><ShieldAlert className="h-4 w-4 shrink-0" /> Alta vigilância: confira paciente, dose, via e diluição com outro profissional antes de administrar. A dupla checagem é registrada por ele, no login dele.</div>
              )}
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={status === "realizado" ? "default" : "outline"} onClick={() => setStatus("realizado")}>Realizado</Button>
                <Button type="button" size="sm" variant={status === "nao_realizado" ? "default" : "outline"} onClick={() => setStatus("nao_realizado")}>Não realizado</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="chk-hora">Hora</Label><Input id="chk-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
                {status === "realizado" && bhCategoria && (
                  <div><Label htmlFor="chk-vol">Volume (mL)</Label><Input id="chk-vol" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} /></div>
                )}
              </div>
              {futuro && <p className="text-xs text-destructive">A hora não pode estar no futuro.</p>}
              {antecipada && <p className="text-xs font-medium text-warning-on-soft">Dose mais de 1 h antes do horário aprazado: informe o motivo da antecipação.</p>}
              {status === "realizado" && bhCategoria && volumeNum ? <p className="text-xs text-muted-foreground">{volumeNum} mL entram no balanço hídrico como {categoriaLabel(bhCategoria)}.</p> : null}
              <div>
                <Label htmlFor="chk-motivo">{status === "nao_realizado" || antecipada ? "Motivo (obrigatório)" : apz ? "Observação" : "Indicação da dose (obrigatório)"}</Label>
                <Textarea id="chk-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  placeholder={status === "nao_realizado" ? "Ex.: paciente em exame, recusa, jejum, acesso perdido" : apz ? "" : "Ex.: dor 7/10, febre 38,5 °C"} />
              </div>
            </div>
          )}
          {!checagem && (
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button disabled={!valido || acoes.checar.isPending || !podeChecar} onClick={confirmar}>{acoes.checar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!anulando} onOpenChange={(o) => !o && setAnulando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Anular checagem</DialogTitle><DialogDescription>{anulando?.item_nome} — a checagem fica registrada como anulada; o ganho no balanço hídrico também é anulado.</DialogDescription></DialogHeader>
          <Textarea rows={2} value={motivoAnul} onChange={(e) => setMotivoAnul(e.target.value)} placeholder="Motivo (obrigatório)" aria-label="Motivo da anulação" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnulando(null)}>Voltar</Button>
            <Button variant="destructive" disabled={motivoAnul.trim().length < 3 || acoes.anularChecagem.isPending} onClick={() => anulando && acoes.anularChecagem.mutate({ id: anulando.id, motivo: motivoAnul }, { onSuccess: () => setAnulando(null) })}>Anular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
