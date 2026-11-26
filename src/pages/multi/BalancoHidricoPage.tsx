import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Printer, Lock, CheckCircle2, ClipboardCheck, AlertTriangle, Ban, Loader2 } from "lucide-react";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PageTransition } from "@/components/PageTransition";
import { ModulePatientStrip, type StripTile } from "@/components/multi/ModulePatientStrip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePesoReferencia } from "@/hooks/usePesoReferencia";
import { useBalancoHidrico, toLancamento, type LancamentoRow } from "@/hooks/useBalancoHidrico";
import { canWriteModule, visibleMultiModules } from "@/config/multiModules";
import { BH_CATEGORIAS, categoriaLabel, computeFluidBalance, formatMl, periodoBH, type Sentido } from "@/lib/fluidBalance";
import { DOC_PREFIXES, formatDocCode, fortalezaLocal, fortalezaParts } from "@/lib/docPrefixes";
import { printBalancoHidrico } from "@/lib/printBalancoHidrico";
import type { StatusBH } from "@/lib/balancoHidricoDoc";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const fmtData = (d: Date) => { const p = fortalezaParts(d); return `${pad(p.day)}/${pad(p.month)}/${p.year}`; };
const fmtHora = (d: Date) => { const p = fortalezaParts(d); return `${pad(p.hour)}:${pad(p.minute)}`; };
const fmtDataHora = (iso: string) => { const d = new Date(iso); return `${fmtData(d)} ${fmtHora(d)}`; };

/**
 * Balanco hidrico 24h (07 -> 07) — prancheta 10 do prototipo.
 * Grade horaria, lancamentos (anulacao com motivo, nada se apaga), perdas
 * insensiveis (padrao desligado), alerta de oliguria com o peso usado.
 * Fechar (tecnico/enfermeiro) -> validar (so enfermeiro) -> PDF ENF-BH.
 * Mesma funcao de calculo (computeFluidBalance) na tela, no fechamento e no PDF.
 */
export default function BalancoHidricoPage() {
  const [sp] = useSearchParams();
  const patientId = sp.get("patientId");
  const { role } = useAuth();
  const visivel = visibleMultiModules(role).some((m) => m.key === "enfermagem");
  const podeEscrever = canWriteModule(role, "enfermagem");
  const ehEnfermeiro = role === "enfermeiro";

  const [ref, setRef] = useState<Date>(() => periodoBH(new Date()).start);
  const periodo = useMemo(() => periodoBH(ref), [ref]);
  const ehPeriodoAtual = periodo.start.getTime() === periodoBH(new Date()).start.getTime();
  const { peso } = usePesoReferencia(patientId);
  const bh = useBalancoHidrico(patientId, periodo);

  const fechamento = bh.fechamento;
  const status: StatusBH = fechamento?.validado_em ? "validado" : fechamento ? "fechado" : "aberto";
  const [insensiveisLocal, setInsensiveisLocal] = useState(false);
  const incluirInsensiveis = fechamento ? fechamento.incluir_insensiveis : insensiveisLocal;
  const bloqueado = status === "validado" || !podeEscrever;

  const lancamentos = useMemo(() => bh.lancamentos.map(toLancamento), [bh.lancamentos]);
  const result = useMemo(
    () => computeFluidBalance(lancamentos, periodo, { pesoKg: peso.kg, incluirInsensiveis, agora: new Date() }),
    [lancamentos, periodo, peso.kg, incluirInsensiveis],
  );
  const mudouDepoisDoFechamento = !!fechamento && status === "fechado"
    && bh.lancamentos.some((l) => new Date(l.criado_em).getTime() > new Date(fechamento.fechado_em).getTime()
      || (l.anulado_em && new Date(l.anulado_em).getTime() > new Date(fechamento.fechado_em).getTime()));

  // ── Novo lancamento ──
  const agoraP = fortalezaParts(new Date());
  const [hora, setHora] = useState(`${pad(agoraP.hour)}:${pad(agoraP.minute)}`);
  const [sentido, setSentido] = useState<Sentido>("perda");
  const [categoria, setCategoria] = useState("diurese");
  const [volume, setVolume] = useState("");
  const [descricao, setDescricao] = useState("");
  const volumeNum = Number(volume.replace(",", "."));
  const instanteLancamento = (() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hora);
    if (!m) return null;
    const h = Number(m[1]); const mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    const p = fortalezaParts(periodo.start);
    const base = fortalezaLocal(p.year, p.month, p.day, h, mi);
    return h >= 7 ? base : new Date(base.getTime() + DAY_MS); // 00–06h pertencem ao dia seguinte do periodo
  })();
  const futuro = instanteLancamento != null && instanteLancamento.getTime() > Date.now() + 5 * 60_000;
  const podeLancar = !bloqueado && instanteLancamento != null && !futuro && Number.isFinite(volumeNum) && volumeNum > 0 && volumeNum <= 20000;

  const lancar = () => {
    if (!podeLancar || !instanteLancamento) return;
    bh.lancar.mutate(
      { dataHora: instanteLancamento, sentido, categoria, volumeMl: volumeNum, descricao },
      { onSuccess: () => { setVolume(""); setDescricao(""); } },
    );
  };

  // ── Anulacao ──
  const [anulando, setAnulando] = useState<LancamentoRow | null>(null);
  const [motivo, setMotivo] = useState("");

  // ── Impressao ──
  const imprimir = () => {
    if (!patientId) return;
    const win = window.open("", "_blank", "width=1123,height=794");
    const snap = (fechamento?.snapshot ?? {}) as { fechado_por_nome?: string; validado_por_nome?: string };
    void printBalancoHidrico(
      patientId,
      { name: sp.get("patientName"), bed: sp.get("patientBed"), sector: sp.get("patientSector") },
      {
        result, lancamentos, periodoInicio: periodo.start, pesoTexto: peso.texto, incluirInsensiveis, status,
        fechadoPor: snap.fechado_por_nome ?? null, validadoPor: snap.validado_por_nome ?? null,
        validadoEm: fechamento?.validado_em ? fmtDataHora(fechamento.validado_em) : null,
      },
      fechamento?.doc_code ?? null,
      win,
    );
  };

  const oliguria = result.alertas.find((a) => a.tipo === "oliguria");
  const tiles: StripTile[] = [
    { label: "Peso de referência", value: peso.texto },
    { label: ehPeriodoAtual && status === "aberto" ? "Balanço parcial" : "Balanço 24h", value: formatMl(result.balanco, true) },
    {
      label: "Diurese",
      value: result.diureseMlKgH != null ? `${String(result.diureseMlKgH).replace(".", ",")} mL/kg/h` : formatMl(result.diureseMl),
      tone: oliguria ? "critical" : "neutral",
      hint: oliguria?.mensagem,
    },
  ];

  if (!visivel) {
    return (
      <PageTransition>
        <ClinicalHeader moduleLabel="Balanço hídrico" />
        <div className="p-4 md:p-6"><div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Seu perfil não tem acesso ao balanço hídrico.</div></div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <ClinicalHeader moduleLabel="Balanço hídrico" />
      <div className="space-y-4 p-4 md:p-6">
        {!patientId ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">Nenhum paciente selecionado. Escolha um leito no <Link className="font-semibold text-primary hover:underline" to="/enfermagem/setor">Painel do enfermeiro</Link>.</div>
        ) : (
        <>
          <ModulePatientStrip patientId={patientId} moduleLabel="Balanço hídrico" tiles={tiles} />

          {/* Barra: periodo, status, acoes */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => setRef(new Date(periodo.start.getTime() - DAY_MS))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-sm font-semibold text-foreground">{fmtData(periodo.start)} 07h → {fmtData(periodo.end)} 07h</div>
            <Button variant="outline" size="icon" aria-label="Próximo período" disabled={ehPeriodoAtual} onClick={() => setRef(new Date(periodo.start.getTime() + DAY_MS))}><ChevronRight className="h-4 w-4" /></Button>
            <span className={cn(
              "ml-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
              status === "validado" ? "border-released/40 bg-released-soft text-released-on-soft" : status === "fechado" ? "border-border bg-muted text-foreground" : "border-border bg-background text-muted-foreground",
            )}>
              {status === "validado" ? "Validado" : status === "fechado" ? "Fechado — aguarda validação" : "Aberto"}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={incluirInsensiveis} disabled={!!fechamento || bloqueado} onCheckedChange={setInsensiveisLocal} aria-label="Incluir perdas insensíveis" />
                Perdas insensíveis
              </label>
              <Button variant="outline" size="sm" className="gap-2" onClick={imprimir}><Printer className="h-4 w-4" /> Imprimir</Button>
              {podeEscrever && status !== "validado" && (
                <Button size="sm" variant={status === "fechado" && !mudouDepoisDoFechamento ? "outline" : "default"} className="gap-2" disabled={bh.fechar.isPending}
                  onClick={() => bh.fechar.mutate({ result, incluirInsensiveis, pesoKg: peso.kg, docCode: fechamento?.doc_code ?? formatDocCode(DOC_PREFIXES.enfBalanco) })}>
                  {bh.fechar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                  {status === "fechado" ? "Refechar" : "Fechar balanço"}
                </Button>
              )}
              {ehEnfermeiro && status === "fechado" && (
                <Button size="sm" className="gap-2" disabled={bh.validar.isPending || mudouDepoisDoFechamento} onClick={() => bh.validar.mutate()}
                  title={mudouDepoisDoFechamento ? "Há lançamentos depois do fechamento: refeche antes de validar" : undefined}>
                  <CheckCircle2 className="h-4 w-4" /> Validar
                </Button>
              )}
            </div>
          </div>

          {mudouDepoisDoFechamento && (
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-on-soft">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Houve lançamento ou anulação depois do fechamento. Refeche antes de validar.
            </div>
          )}
          {result.alertas.map((a) => (
            <div key={a.tipo} className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              a.tipo === "oliguria" ? "border-critical/40 bg-critical-soft text-critical-on-soft" : "border-warning/40 bg-warning-soft text-warning-on-soft")}>
              <AlertTriangle className="h-4 w-4 shrink-0" /> {a.mensagem}
            </div>
          ))}
          {bh.erro && <div className="rounded-md border border-critical/40 bg-critical-soft px-3 py-2 text-sm text-critical-on-soft">Não foi possível carregar o balanço: {String((bh.erro as Error).message ?? bh.erro)}</div>}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            {/* Grade horaria */}
            <section className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">Hora</th><th className="px-3 py-2 text-right">Ganhos</th><th className="px-3 py-2 text-right">Perdas</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-right">Acumulado</th></tr>
                </thead>
                <tbody>
                  {(() => { let acc = 0; return result.porHora.map((h, i) => {
                    acc += h.saldo;
                    const vazio = h.ganhos === 0 && h.perdas === 0;
                    return (
                      <tr key={i} className={cn("border-t border-border", (i === 6 || i === 12) && "border-t-2 border-t-foreground/30", vazio && "text-muted-foreground")}>
                        <td className="px-3 py-1.5 font-semibold tabular-nums">{pad(h.hora)}h</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{h.ganhos ? formatMl(h.ganhos) : "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{h.perdas ? formatMl(h.perdas) : "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{vazio ? "—" : formatMl(h.saldo, true)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatMl(acc, true)}</td>
                      </tr>
                    );
                  }); })()}
                </tbody>
                <tfoot className="border-t-2 border-foreground/30 bg-muted/60 text-sm font-semibold">
                  <tr><td className="px-3 py-2">Parciais</td><td colSpan={4} className="px-3 py-2 text-right text-xs font-medium">07–13h {formatMl(result.parciais.t07_13, true)} · 13–19h {formatMl(result.parciais.t13_19, true)} · 19–07h {formatMl(result.parciais.t19_07, true)}</td></tr>
                  <tr><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">{formatMl(result.ganhos)}</td><td className="px-3 py-2 text-right">{formatMl(result.perdas)}{result.insensiveis != null ? ` + ${formatMl(result.insensiveis)} insens.` : ""}</td><td colSpan={2} className="px-3 py-2 text-right">{formatMl(result.balanco, true)}</td></tr>
                </tfoot>
              </table>
            </section>

            <div className="space-y-4">
              {/* Novo lancamento */}
              {podeEscrever && status !== "validado" && (
                <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold text-foreground">Novo lançamento</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label htmlFor="bh-hora" className="text-xs">Hora</Label><Input id="bh-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1" /></div>
                    <div><Label htmlFor="bh-vol" className="text-xs">Volume (mL)</Label><Input id="bh-vol" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="mL" className="mt-1" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["ganho", "perda"] as const).map((s) => (
                      <Button key={s} type="button" variant={sentido === s ? "default" : "outline"} size="sm"
                        onClick={() => { setSentido(s); setCategoria(BH_CATEGORIAS.find((c) => c.sentido === s)!.key); }}>
                        {s === "ganho" ? "Ganho" : "Perda"}
                      </Button>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger className="mt-1" aria-label="Categoria"><SelectValue /></SelectTrigger>
                      <SelectContent>{BH_CATEGORIAS.filter((c) => c.sentido === sentido).map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label htmlFor="bh-desc" className="text-xs">Descrição (opcional)</Label><Input id="bh-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex.: dreno torácico D" className="mt-1" /></div>
                  {futuro && <p className="text-xs text-critical-on-soft">Horário no futuro não é aceito.</p>}
                  <Button className="w-full" disabled={!podeLancar || bh.lancar.isPending} onClick={lancar}>
                    {bh.lancar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar
                  </Button>
                </section>
              )}
              {!podeEscrever && <p className="text-xs text-muted-foreground">Modo leitura — o balanço é registrado pela enfermagem.</p>}

              {/* Lancamentos */}
              <section className="rounded-lg border border-border bg-card">
                <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">Lançamentos ({bh.lancamentos.filter((l) => !l.anulado_em).length})</h2>
                {bh.loading ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
                ) : bh.lancamentos.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nenhum lançamento no período.</p>
                ) : (
                  <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
                    {[...bh.lancamentos].reverse().map((l) => (
                      <li key={l.id} className={cn("flex items-start gap-2 px-4 py-2 text-sm", l.anulado_em && "text-muted-foreground")}>
                        <span className="w-12 shrink-0 tabular-nums">{fmtHora(new Date(l.data_hora))}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("font-medium", l.anulado_em && "line-through")}>
                            {l.sentido === "ganho" ? "+" : "−"}{formatMl(Number(l.volume_ml))} · {categoriaLabel(l.categoria)}
                          </span>
                          {l.descricao && <span className="block text-xs text-muted-foreground">{l.descricao}</span>}
                          {l.anulado_em && <span className="block text-xs">Anulado: {l.motivo_anulacao}</span>}
                        </span>
                        {!l.anulado_em && !bloqueado && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Anular lançamento" onClick={() => { setAnulando(l); setMotivo(""); }}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
        )}
      </div>

      <Dialog open={!!anulando} onOpenChange={(o) => { if (!o) setAnulando(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Anular lançamento</DialogTitle>
            <DialogDescription>
              {anulando && `${fmtHora(new Date(anulando.data_hora))} · ${formatMl(Number(anulando.volume_ml))} · ${categoriaLabel(anulando.categoria)}`}. O registro continua no histórico, riscado.
            </DialogDescription>
          </DialogHeader>
          <div><Label htmlFor="bh-motivo" className="text-xs">Motivo (obrigatório)</Label><Textarea id="bh-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1" rows={3} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnulando(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={!motivo.trim() || bh.anular.isPending}
              onClick={() => anulando && bh.anular.mutate({ id: anulando.id, motivo }, { onSuccess: () => setAnulando(null) })}>
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
