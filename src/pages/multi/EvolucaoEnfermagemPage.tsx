import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Lock, Loader2, CheckCircle2, Printer, Ban, AlertOctagon, ClipboardList } from "lucide-react";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PageTransition } from "@/components/PageTransition";
import { ModulePatientStrip, type StripTile } from "@/components/multi/ModulePatientStrip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { visibleMultiModules } from "@/config/multiModules";
import { usePlantaoSetor, derivarLeito, type AnotacaoRow } from "@/hooks/usePlantaoSetor";
import { useAnotacoesAcoes } from "@/hooks/useAnotacoesEnfermagem";
import { prescriptionValidityWindow } from "@/lib/prescriptionValidity";
import { periodoBH, formatMl } from "@/lib/fluidBalance";
import { turnoAtual } from "@/lib/plantaoEnfermagem";
import { formatNews2 } from "@/lib/news2";
import { FUGULIN_AREAS, FUGULIN_CATEGORIAS, classificarFugulin, type FugulinRespostas, type FugulinCategoria } from "@/lib/fugulin";
import {
  FUGULIN_OPCOES, BRADEN_ITENS, MORSE_ITENS, classificarBraden, classificarMorse, RISCO_BRADEN_LABEL, RISCO_MORSE_LABEL,
  type BradenRespostas, type MorseRespostas,
} from "@/lib/escalasEnfermagem";
import { SISTEMAS_EXAME, montarEvolucao, secoesEvolucao, validarEvolucao, type ConteudoEvolucao, type SistemaKey } from "@/lib/anotacoesEnfermagem";
import { DOC_PREFIXES, formatDocCode, fortalezaParts } from "@/lib/docPrefixes";
import { printEvolucaoEnfermagem } from "@/lib/printEnfermagem";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (iso: string) => { const p = fortalezaParts(new Date(iso)); return `${pad(p.day)}/${pad(p.month)} ${pad(p.hour)}:${pad(p.minute)}`; };
const hojeLocal = () => { const p = fortalezaParts(new Date()); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; };

interface ConteudoGravado extends ConteudoEvolucao { bradenRespostas?: BradenRespostas; morseRespostas?: MorseRespostas }

/**
 * Evolucao do enfermeiro + SAE (prancheta 13, aba evolucao) e Fugulin do dia.
 * Puxa sozinho: NEWS2/SSVV, BH do turno, anotacoes e intercorrencias do turno
 * (leitura). Grava anotacoes_enfermagem tipo evolucao_enfermeiro (conteudo +
 * texto) com codigo ENF-EVO; PDF reimprime com o mesmo codigo.
 * Fugulin grava classificacoes_cuidado (1 por dia; refazer atualiza).
 */
export default function EvolucaoEnfermagemPage() {
  const [sp] = useSearchParams();
  const patientId = sp.get("patientId");
  const { role } = useAuth();
  const visivel = visibleMultiModules(role).some((m) => m.key === "enfermagem");
  const ehEnfermeiro = role === "enfermeiro";
  const acoes = useAnotacoesAcoes();

  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  const janela = useMemo(() => prescriptionValidityWindow(agora), [agora]);
  const turno = useMemo(() => turnoAtual(agora), [agora]);
  const periodoAnterior = useMemo(() => { const p = periodoBH(agora); return { start: new Date(p.start.getTime() - DAY_MS), end: p.start }; }, [agora]);
  const ids = useMemo(() => (patientId ? [patientId] : []), [patientId]);
  const { dados, carregando, erro } = usePlantaoSetor(ids, janela, turno, periodoAnterior);
  const leito = useMemo(() => (dados && patientId ? derivarLeito(dados, patientId, agora, janela, true, turno.inicio) : null), [dados, patientId, agora, janela, turno.inicio]);
  const evolucoes = useMemo(() => (dados?.anotacoes ?? []).filter((a) => a.tipo === "evolucao_enfermeiro").sort((a, b) => b.data_hora.localeCompare(a.data_hora)), [dados]);

  // ── Fugulin ──
  const [fug, setFug] = useState<FugulinRespostas>({});
  // Recarrega as respostas so quando a classificacao gravada muda (nao a cada refetch).
  const fugSalvoEm = leito?.fugulin?.atualizado_em ?? null;
  const fugSalvo = leito?.fugulin?.respostas;
  useEffect(() => { if (fugSalvoEm && fugSalvo) setFug(fugSalvo as FugulinRespostas); }, [fugSalvoEm]); // eslint-disable-line react-hooks/exhaustive-deps
  const fugRes = classificarFugulin(fug);

  // ── Evolucao ──
  const [sistemas, setSistemas] = useState<Partial<Record<SistemaKey, string>>>({});
  const [braden, setBraden] = useState<BradenRespostas>({});
  const [morse, setMorse] = useState<MorseRespostas>({});
  const [diagnosticos, setDiagnosticos] = useState("");
  const [intervencoes, setIntervencoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const bRes = classificarBraden(braden);
  const mRes = classificarMorse(morse);

  const contexto = leito ? [
    leito.resumo.news2 ? `${formatNews2(leito.resumo.news2)} (SSVV ${leito.ssvv ? fmt(leito.ssvv.data_hora) : "—"})` : "Sem SSVV nas últimas 48 h",
    `BH do turno: ganhos ${formatMl(leito.turno.ganhos)}, perdas ${formatMl(leito.turno.perdas)}`,
    leito.resumo.atrasadas ? `${leito.resumo.atrasadas} dose(s) atrasada(s)` : "",
  ].filter(Boolean) : [];
  const anotacoesTurno = (leito?.anotacoesTurno ?? []).map((a) => `${fmt(a.data_hora)} ${a.registrado_por_nome ?? ""}: ${a.texto_gerado}${a.tipo === "intercorrencia" && a.ciencia_em ? ` — Conduta: ${a.ciencia_conduta}` : ""}`);

  const conteudo: ConteudoGravado = {
    sistemas, diagnosticos, intervencoes, observacoes, contexto, anotacoesTurno,
    fugulin: fugRes.completo ? { escore: fugRes.escore as number, categoria: fugRes.categoria as FugulinCategoria } : (leito?.fugulin ? { escore: leito.fugulin.escore, categoria: leito.fugulin.categoria as FugulinCategoria } : null),
    braden: bRes.completo ? { escore: bRes.escore as number, risco: bRes.risco! } : null,
    morse: mRes.completo ? { escore: mRes.escore as number, risco: mRes.risco! } : null,
    bradenRespostas: braden, morseRespostas: morse,
  };
  const erros = validarEvolucao(conteudo);

  const registrar = () => {
    if (!patientId) return;
    acoes.registrar.mutate({
      internacaoId: patientId, tipo: "evolucao_enfermeiro", dataHora: new Date(), conteudo, texto: montarEvolucao(conteudo),
      docCode: formatDocCode(DOC_PREFIXES.enfEvolucao),
    }, { onSuccess: () => { setSistemas({}); setBraden({}); setMorse({}); setDiagnosticos(""); setIntervencoes(""); setObservacoes(""); } });
  };

  const imprimir = (a: AnotacaoRow) => {
    if (!patientId) return;
    const win = window.open("", "_blank", "width=794,height=1123");
    void printEvolucaoEnfermagem(patientId, { name: sp.get("patientName"), bed: sp.get("patientBed"), sector: sp.get("patientSector") }, {
      secoes: secoesEvolucao(a.conteudo as unknown as ConteudoEvolucao), dataHora: fmt(a.data_hora),
      status: a.status === "validado" ? "Validada" : "Registrada", autor: a.registrado_por_nome, docCode: a.doc_code,
    }, win);
  };
  const [anulando, setAnulando] = useState<AnotacaoRow | null>(null);
  const [motivo, setMotivo] = useState("");

  const tiles: StripTile[] = [
    { label: "NEWS2", value: leito?.resumo.news2 ? (leito.resumo.news2.parcial ? `parcial ${leito.resumo.news2.score}` : String(leito.resumo.news2.score)) : "—", tone: leito?.resumo.news2?.alertaEnfermeiro ? "critical" : "neutral" },
    { label: "Fugulin hoje", value: leito?.fugulin ? `${leito.fugulin.escore} · ${FUGULIN_CATEGORIAS[leito.fugulin.categoria as FugulinCategoria]?.label ?? ""}` : "—", tone: leito && !leito.fugulin ? "warning" : "neutral" },
    { label: "Intercorrências abertas", value: String(leito?.intercorrenciasAbertas.length ?? 0), tone: leito?.intercorrenciasAbertas.length ? "critical" : "neutral" },
  ];

  if (!visivel) {
    return (<PageTransition><ClinicalHeader moduleLabel="Evolução de enfermagem" /><div className="p-4 md:p-6"><div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Seu perfil não tem acesso.</div></div></PageTransition>);
  }

  return (
    <PageTransition>
      <ClinicalHeader moduleLabel="Evolução de enfermagem" />
      <div className="space-y-4 p-4 md:p-6">
        {!patientId ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">Nenhum paciente selecionado. Escolha um leito no <Link className="font-semibold text-primary hover:underline" to="/enfermagem/setor">Painel do enfermeiro</Link>.</div>
        ) : carregando || !dados ? (
          erro ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Falha ao carregar: {erro.message}</div>
            : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
        <>
          <ModulePatientStrip patientId={patientId} moduleLabel="Evolução de enfermagem" tiles={tiles} />
          {!ehEnfermeiro && <p className="text-xs text-muted-foreground">Modo leitura — a evolução, a SAE e o Fugulin são registrados pelo enfermeiro.</p>}

          {leito && leito.intercorrenciasAbertas.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2 font-semibold"><AlertOctagon className="h-4 w-4" /> Intercorrência sem ciência</div>
              <ul className="mt-1 list-disc pl-5">{leito.intercorrenciasAbertas.map((a) => <li key={a.id}>{fmt(a.data_hora)} — {a.texto_gerado}</li>)}</ul>
              <p className="mt-1 text-xs">Registre a ciência e a conduta no <Link to="/enfermagem/setor" className="font-semibold underline">Painel do enfermeiro</Link>.</p>
            </div>
          )}

          {/* Fugulin */}
          <section className="rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Classificação do cuidado (Fugulin) — hoje</h2>
              <span className="text-xs text-muted-foreground">{leito?.fugulin ? `Registrado por ${leito.fugulin.registrado_por_nome ?? "—"} às ${fmt(leito.fugulin.atualizado_em)}` : "Ainda não classificado hoje"}</span>
              <span className={cn("ml-auto rounded-md border px-2 py-0.5 text-sm font-semibold", fugRes.completo ? "border-primary/40 bg-primary/10" : "border-border text-muted-foreground")}>
                {fugRes.completo ? `${fugRes.escore} · ${FUGULIN_CATEGORIAS[fugRes.categoria!].label} · ${fugRes.horas24h} h/24h` : `${12 - fugRes.faltando.length}/12 áreas`}
              </span>
              {ehEnfermeiro && (
                <Button size="sm" disabled={!fugRes.completo || acoes.salvarFugulin.isPending} onClick={() => patientId && acoes.salvarFugulin.mutate({
                  id: leito?.fugulin?.id ?? null, internacaoId: patientId, data: hojeLocal(), escore: fugRes.escore as number, categoria: fugRes.categoria as string, respostas: fug as Record<string, number>,
                })}>{leito?.fugulin ? "Atualizar" : "Salvar"} Fugulin</Button>
              )}
            </header>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {FUGULIN_AREAS.map((a) => (
                <div key={a.key}>
                  <Label className="text-xs">{a.label}</Label>
                  <Select value={fug[a.key] ? String(fug[a.key]) : ""} onValueChange={(v) => setFug((f) => ({ ...f, [a.key]: Number(v) }))} disabled={!ehEnfermeiro}>
                    <SelectTrigger className="h-auto min-h-9 text-left text-xs" aria-label={`Fugulin: ${a.label}`}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{FUGULIN_OPCOES[a.key].map((t, i) => <SelectItem key={t} value={String(i + 1)} className="text-xs">{i + 1} · {t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          {/* Nova evolucao */}
          {ehEnfermeiro && (
            <section className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ClipboardList className="h-4 w-4 text-primary" /> Nova evolução de enfermagem</h2>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <div className="font-semibold uppercase text-muted-foreground">Dados do período (automático)</div>
                <ul className="mt-1 list-disc pl-5">{contexto.map((c) => <li key={c}>{c}</li>)}</ul>
                {anotacoesTurno.length > 0 && <>
                  <div className="mt-2 font-semibold uppercase text-muted-foreground">Anotações e intercorrências do turno (entram na evolução)</div>
                  <ul className="mt-1 list-disc pl-5">{anotacoesTurno.map((c) => <li key={c}>{c}</li>)}</ul>
                </>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {SISTEMAS_EXAME.map((s) => (
                  <div key={s.key}><Label htmlFor={`ev-${s.key}`} className="text-xs">{s.label}</Label>
                    <Textarea id={`ev-${s.key}`} rows={2} value={sistemas[s.key] ?? ""} onChange={(e) => setSistemas((x) => ({ ...x, [s.key]: e.target.value }))} /></div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase text-muted-foreground">Braden</h3>
                    <span className="text-xs font-semibold">{bRes.completo ? `${bRes.escore} · ${RISCO_BRADEN_LABEL[bRes.risco!]}` : "incompleta"}</span></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {BRADEN_ITENS.map((it) => (
                      <Select key={it.key} value={braden[it.key] ? String(braden[it.key]) : ""} onValueChange={(v) => setBraden((b) => ({ ...b, [it.key]: Number(v) }))}>
                        <SelectTrigger className="h-auto min-h-9 text-left text-xs" aria-label={`Braden: ${it.label}`}><SelectValue placeholder={it.label} /></SelectTrigger>
                        <SelectContent>{it.opcoes.map((t, i) => <SelectItem key={t} value={String(i + 1)} className="text-xs">{it.label}: {i + 1} · {t}</SelectItem>)}</SelectContent>
                      </Select>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase text-muted-foreground">Morse</h3>
                    <span className="text-xs font-semibold">{mRes.completo ? `${mRes.escore} · ${RISCO_MORSE_LABEL[mRes.risco!]}` : "incompleta"}</span></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MORSE_ITENS.map((it) => (
                      <Select key={it.key} value={morse[it.key] != null ? String(morse[it.key]) : ""} onValueChange={(v) => setMorse((m) => ({ ...m, [it.key]: Number(v) }))}>
                        <SelectTrigger className="h-auto min-h-9 text-left text-xs" aria-label={`Morse: ${it.label}`}><SelectValue placeholder={it.label} /></SelectTrigger>
                        <SelectContent>{it.opcoes.map((o, i) => <SelectItem key={o.t} value={String(i)} className="text-xs">{it.label}: {o.t} ({o.p})</SelectItem>)}</SelectContent>
                      </Select>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label htmlFor="ev-dx" className="text-xs">Diagnósticos de enfermagem (SAE / NANDA)</Label><Textarea id="ev-dx" rows={3} value={diagnosticos} onChange={(e) => setDiagnosticos(e.target.value)} /></div>
                <div><Label htmlFor="ev-int" className="text-xs">Intervenções / cuidados prescritos</Label><Textarea id="ev-int" rows={3} value={intervencoes} onChange={(e) => setIntervencoes(e.target.value)} /></div>
              </div>
              <div><Label htmlFor="ev-obs" className="text-xs">Observações</Label><Textarea id="ev-obs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
              {erros.map((e) => <p key={e} className="text-xs text-destructive">{e}</p>)}
              <Button className="gap-2" disabled={erros.length > 0 || acoes.registrar.isPending} onClick={registrar}>
                {acoes.registrar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Registrar evolução
              </Button>
            </section>
          )}

          {/* Evolucoes registradas (48h) */}
          <section className="rounded-lg border border-border bg-card">
            <header className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Evoluções de enfermagem (últimas 48 h)</header>
            {evolucoes.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma evolução registrada.</p> : (
              <ul className="divide-y divide-border">
                {evolucoes.map((a) => (
                  <li key={a.id} className="space-y-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <b>{fmt(a.data_hora)}</b><span className="text-muted-foreground">{a.registrado_por_nome}</span>
                      {a.doc_code && <span className="text-xs text-muted-foreground">{a.doc_code}</span>}
                      <div className="ml-auto flex gap-1">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => imprimir(a)}><Printer className="h-4 w-4" /> ENF-EVO</Button>
                        {ehEnfermeiro && <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => { setAnulando(a); setMotivo(""); }}><Ban className="h-4 w-4" /> Anular</Button>}
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-muted-foreground">{a.texto_gerado}</pre>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
        )}
      </div>

      <Dialog open={!!anulando} onOpenChange={(o) => !o && setAnulando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Anular evolução</DialogTitle><DialogDescription>A evolução fica registrada como anulada; não é apagada.</DialogDescription></DialogHeader>
          <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obrigatório)" aria-label="Motivo da anulação" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnulando(null)}>Voltar</Button>
            <Button variant="destructive" disabled={motivo.trim().length < 3 || acoes.anular.isPending} onClick={() => anulando && acoes.anular.mutate({ id: anulando.id, motivo }, { onSuccess: () => setAnulando(null) })}>Anular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
