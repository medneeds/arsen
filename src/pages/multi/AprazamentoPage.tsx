import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Printer, Lock, Loader2, CalendarClock, CheckCircle2, XCircle, AlertTriangle, ShieldAlert, Ban, Droplets,
} from "lucide-react";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PageTransition } from "@/components/PageTransition";
import { ModulePatientStrip, type StripTile } from "@/components/multi/ModulePatientStrip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteModule, visibleMultiModules } from "@/config/multiModules";
import { useAprazamento, useMeuProfissionalId, type AprazamentoRow, type AdministracaoRow, type NovoHorario } from "@/hooks/useAprazamento";
import { ChecagemDialog, type AlvoChecagem } from "@/components/multi/ChecagemDialog";
import { prescriptionValidityWindow } from "@/lib/prescriptionValidity";
import { gradeOptions } from "@/lib/aprazamentoHmdm";
import {
  itensAprazaveis, itensJaAprazados, planejarAprazamento, statusDose, horariosACancelar, horariosDaOpcao, validarLivre,
  type ItemAprazavel, type StatusDose,
} from "@/lib/aprazamentoItens";
import { categoriaLabel } from "@/lib/fluidBalance";
import { fortalezaParts } from "@/lib/docPrefixes";
import { printAprazamento } from "@/lib/printAprazamento";
import type { LinhaDoc, OcorrenciaDoc } from "@/lib/aprazamentoDoc";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const fmtHora = (d: Date) => { const p = fortalezaParts(d); return `${pad(p.hour)}:${pad(p.minute)}`; };
const fmtDia = (d: Date) => { const p = fortalezaParts(d); return `${pad(p.day)}/${pad(p.month)}`; };
const fmtDiaHora = (d: Date) => `${fmtDia(d)} ${fmtHora(d)}`;
const nomeCurto = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/).slice(0, 2).join(" ");

const STATUS_UI: Record<StatusDose, { label: string; cls: string }> = {
  pendente: { label: "Aprazado", cls: "border-border bg-background text-foreground" },
  proxima: { label: "Próxima", cls: "border-primary/50 bg-primary/10 text-foreground" },
  atrasada: { label: "Atrasada", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
  realizada: { label: "Realizada", cls: "border-released/40 bg-released-soft text-released-on-soft" },
  nao_realizada: { label: "Não realizada", cls: "border-warning/40 bg-warning-soft text-warning-on-soft" },
  cancelada: { label: "Cancelada", cls: "border-border bg-muted text-muted-foreground line-through" },
};

type Escolha = { key: string; livre: string; marcado: boolean };

/**
 * Aprazamento HMDM (enfermeiro) e checagem (tecnico/enfermeiro) — prancheta 9 do prototipo.
 * Vigencia 12h -> 12h. Prescricao = a mesma do card de prescricao ativa.
 * Dose realizada com volume gera o ganho no BH no banco (sem lancamento duplo).
 */
export default function AprazamentoPage() {
  const [sp] = useSearchParams();
  const patientId = sp.get("patientId");
  const { role } = useAuth();
  const visivel = visibleMultiModules(role).some((m) => m.key === "enfermagem");
  const podeChecar = canWriteModule(role, "enfermagem");
  const ehEnfermeiro = role === "enfermeiro";

  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  const atual = useMemo(() => prescriptionValidityWindow(agora), [agora]);
  const [ref, setRef] = useState<Date>(() => new Date());
  const janela = useMemo(() => prescriptionValidityWindow(ref), [ref]);
  const ehAtual = janela.start.getTime() === atual.start.getTime();

  const apz = useAprazamento(patientId, janela);
  const meuProf = useMeuProfissionalId();

  const itens = useMemo(() => itensAprazaveis(apz.prescricao?.itens, agora), [apz.prescricao, agora]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.itemId, i])), [itens]);
  const checagemPorApz = useMemo(() => {
    const m = new Map<string, AdministracaoRow>();
    for (const c of apz.checagens) if (c.aprazamento_id && !c.anulado_em) m.set(c.aprazamento_id, c);
    return m;
  }, [apz.checagens]);

  const existentes = useMemo(
    () => apz.horarios.map((h) => ({ itemId: h.item_id, horario: new Date(h.horario), cancelado: !!h.cancelado_em, aprazadoEm: new Date(h.aprazado_em), canceladoEm: h.cancelado_em ? new Date(h.cancelado_em) : null })),
    [apz.horarios],
  );
  const plano = useMemo(
    () => (ehAtual && apz.prescricao ? planejarAprazamento(itens, janela, agora, existentes) : []),
    [ehAtual, apz.prescricao, itens, janela, agora, existentes],
  );
  const jaAprazados = useMemo(() => itensJaAprazados(existentes), [existentes]);
  const manuais = itens.filter((i) => i.tipo === "manual" && !jaAprazados.has(i.itemId));
  const snItens = itens.filter((i) => i.tipo === "sn");
  const continuos = itens.filter((i) => i.tipo === "continuo");

  const aCancelar = useMemo(() => horariosACancelar(
    apz.horarios.map((h) => ({ ...h, itemId: h.item_id, horario: new Date(h.horario), cancelado: !!h.cancelado_em, checado: checagemPorApz.has(h.id) })),
    new Set(itens.map((i) => i.itemId)),
    agora,
  ), [apz.horarios, itens, agora, checagemPorApz]);
  const prescricaoMudou = !!apz.prescricao && apz.horarios.some((h) => !h.cancelado_em && h.prescricao_id !== apz.prescricao!.id);

  // ── Escolhas do enfermeiro (por item) ──
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const escolha = (id: string): Escolha => escolhas[id] ?? { key: "sugerido", livre: "", marcado: true };
  const setEscolha = (id: string, patch: Partial<Escolha>) => setEscolhas((e) => ({ ...e, [id]: { ...escolha(id), ...patch } }));

  type Resolvido = { item: ItemAprazavel; horarios: Date[]; modo: NovoHorario["modo"]; motivo: string; erros: string[] };
  const resolver = (item: ItemAprazavel, sugeridos: Date[] | null, modoSug: string | null, motivoSug: string): Resolvido => {
    const e = escolha(item.itemId);
    if (e.key === "livre" || !sugeridos) {
      const v = validarLivre(item, e.livre, janela, agora);
      return { item, horarios: v.horarios, modo: "livre", motivo: "aprazamento livre", erros: v.ok ? [] : v.erros };
    }
    if (e.key === "sugerido") {
      const modo = (["padrao", "alternativo", "agora", "prescricao"].includes(modoSug ?? "") ? modoSug : "padrao") as NovoHorario["modo"];
      return { item, horarios: sugeridos, modo, motivo: motivoSug, erros: sugeridos.length ? [] : ["sem dose restante nesta vigência"] };
    }
    const opt = gradeOptions(item.frequencia).find((o) => o.key === e.key);
    const hs = opt ? horariosDaOpcao(item, opt.hours, janela, agora) : [];
    return { item, horarios: hs, modo: "alternativo", motivo: opt ? `${opt.label} (escolhido pelo enfermeiro)` : "", erros: hs.length ? [] : ["sem dose restante nesta opção"] };
  };
  const resolvidos: Resolvido[] = [
    ...plano.map((p) => resolver(p.item, p.sugestao.horarios, p.sugestao.modo, p.sugestao.motivo)),
    ...manuais.map((i) => resolver(i, null, null, "")),
  ];
  const selecionados = resolvidos.filter((r) => escolha(r.item.itemId).marcado && r.erros.length === 0 && r.horarios.length > 0);

  const aprazarSelecionados = () => {
    if (!apz.prescricao) return;
    const prescricaoId = apz.prescricao.id;
    const linhas: NovoHorario[] = selecionados.flatMap((r) => r.horarios.map((h) => ({
      prescricaoId, itemId: r.item.itemId, itemNome: r.item.nome, itemResumo: r.item.resumo, horario: h,
      modo: r.modo, motivo: r.motivo, mav: r.item.mav, volumeMl: r.item.volumeMl, bhCategoria: r.item.bhCategoria,
    })));
    apz.aprazar.mutate(linhas, { onSuccess: () => setEscolhas({}) });
  };

  // ── Grade da vigencia (aprazados) ──
  const porItem = useMemo(() => {
    const m = new Map<string, AprazamentoRow[]>();
    for (const h of apz.horarios) m.set(h.item_id, [...(m.get(h.item_id) ?? []), h]);
    return [...m.entries()];
  }, [apz.horarios]);
  const statusDe = (h: AprazamentoRow): StatusDose => {
    const c = checagemPorApz.get(h.id);
    return statusDose(new Date(h.horario), agora, c ? { status: c.status } : null, !!h.cancelado_em);
  };
  const atrasadas = apz.horarios.filter((h) => statusDe(h) === "atrasada").length;
  const proximas = apz.horarios.filter((h) => statusDe(h) === "proxima").length;
  const duplaPendente = apz.checagens.filter((c) => c.mav && c.status === "realizado" && !c.anulado_em && !c.dupla_checagem_em).length;

  // ── Dialogo de checagem (componente unico, mesmo do "Meu plantao") ──
  const [alvo, setAlvo] = useState<AlvoChecagem | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelando, setCancelando] = useState<string[] | null>(null);
  const abrirChecagem = (h: AprazamentoRow | null, item: ItemAprazavel | null) => {
    if (!patientId || !apz.prescricao) return;
    setAlvo({ internacaoId: patientId, prescricaoId: h?.prescricao_id ?? apz.prescricao.id, apz: h, item });
  };
  const checagemAberta = alvo?.apz ? checagemPorApz.get(alvo.apz.id) ?? null : null;

  // ── Ocorrencias e impressao ──
  const ocorrencias: OcorrenciaDoc[] = useMemo(() => {
    const out: (OcorrenciaDoc & { t: number })[] = [];
    for (const c of apz.checagens) {
      if (c.anulado_em) { out.push({ t: new Date(c.anulado_em).getTime(), quando: fmtDiaHora(new Date(c.anulado_em)), item: c.item_nome, texto: `Checagem anulada: ${c.motivo_anulacao ?? ""}`, por: nomeCurto(c.registrado_por_nome) }); continue; }
      if (c.status === "nao_realizado") out.push({ t: new Date(c.realizado_em).getTime(), quando: fmtDiaHora(new Date(c.realizado_em)), item: c.item_nome, texto: c.motivo ?? "Não realizado", por: nomeCurto(c.registrado_por_nome) });
      else if (!c.aprazamento_id) out.push({ t: new Date(c.realizado_em).getTime(), quando: fmtDiaHora(new Date(c.realizado_em)), item: c.item_nome, texto: `${c.motivo ?? "Dose avulsa"}${c.volume_ml ? ` · ${c.volume_ml} mL` : ""}`, por: nomeCurto(c.registrado_por_nome) });
      if (c.mav && c.dupla_checagem_em) out.push({ t: new Date(c.dupla_checagem_em).getTime(), quando: fmtDiaHora(new Date(c.dupla_checagem_em)), item: c.item_nome, texto: "Dupla checagem MAV", por: nomeCurto(c.dupla_checagem_por_nome) });
    }
    for (const h of apz.horarios) if (h.cancelado_em) out.push({ t: new Date(h.cancelado_em).getTime(), quando: fmtDiaHora(new Date(h.cancelado_em)), item: h.item_nome, texto: `Horário ${fmtHora(new Date(h.horario))} cancelado: ${h.motivo_cancelamento ?? ""}`, por: nomeCurto(h.cancelado_por_nome) });
    return out.sort((a, b) => a.t - b.t);
  }, [apz.checagens, apz.horarios]);

  const vigenciaTxt = `${fmtDia(janela.start)} 12h → ${fmtDia(janela.end)} 12h`;
  const imprimir = () => {
    if (!patientId) return;
    const win = window.open("", "_blank", "width=1123,height=794");
    const linhas: LinhaDoc[] = porItem.map(([itemId, hs]) => ({
      nome: hs[0].item_nome,
      resumo: hs[0].item_resumo ?? "",
      mav: hs.some((h) => h.mav),
      observacao: itemPorId.has(itemId) ? null : "suspenso/fora da prescrição atual",
      doses: hs.map((h) => {
        const d = new Date(h.horario); const p = fortalezaParts(d); const c = checagemPorApz.get(h.id);
        return { hora: p.hour, minuto: p.minute, status: statusDe(h), checadoAs: c ? fmtHora(new Date(c.realizado_em)) : null, por: c ? (c.registrado_por_nome ?? "").trim().split(/\s+/)[0] || null : null, duplaPendente: !!c && c.mav && c.status === "realizado" && !c.dupla_checagem_em };
      }),
    }));
    const aprazadores = [...new Set(apz.horarios.map((h) => h.aprazado_por_nome).filter(Boolean))].join(", ");
    void printAprazamento(
      patientId,
      { name: sp.get("patientName"), bed: sp.get("patientBed"), sector: sp.get("patientSector") },
      { vigencia: vigenciaTxt, linhas, ocorrencias, aprazadoPor: aprazadores || null },
      win,
    );
  };

  const tiles: StripTile[] = [
    { label: "Atrasadas", value: String(atrasadas), tone: atrasadas ? "critical" : "neutral", hint: "Mais de 60 min após o horário, sem checagem" },
    { label: "Próxima hora", value: String(proximas) },
    { label: "Dupla checagem MAV", value: duplaPendente ? `${duplaPendente} pendente(s)` : "—", tone: duplaPendente ? "warning" : "neutral" },
  ];

  if (!visivel) {
    return (
      <PageTransition>
        <ClinicalHeader moduleLabel="Aprazamento" />
        <div className="p-4 md:p-6"><div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Seu perfil não tem acesso ao aprazamento.</div></div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <ClinicalHeader moduleLabel="Aprazamento e checagem" />
      <div className="space-y-4 p-4 md:p-6">
        {!patientId ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">Nenhum paciente selecionado. Escolha um leito no <Link className="font-semibold text-primary hover:underline" to="/enfermagem/setor">Painel do enfermeiro</Link>.</div>
        ) : (
        <>
          <ModulePatientStrip patientId={patientId} moduleLabel="Aprazamento" tiles={tiles} />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Vigência anterior" onClick={() => setRef(new Date(janela.start.getTime() - DAY_MS / 2))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-sm font-semibold text-foreground">Vigência {vigenciaTxt}</div>
            <Button variant="outline" size="icon" aria-label="Próxima vigência" disabled={ehAtual} onClick={() => setRef(new Date(janela.end.getTime() + DAY_MS / 2))}><ChevronRight className="h-4 w-4" /></Button>
            {!ehAtual && <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Vigência encerrada — somente leitura e impressão</span>}
            <div className="ml-auto flex items-center gap-2">
              <Link to={`/enfermagem/balanco?${sp.toString()}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><Droplets className="h-3.5 w-3.5" /> Balanço hídrico</Link>
              <Button variant="outline" size="sm" className="gap-2" onClick={imprimir}><Printer className="h-4 w-4" /> Imprimir ENF-APZ</Button>
            </div>
          </div>

          {apz.carregando ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando prescrição e horários…</div>
          ) : apz.erro ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Falha ao carregar: {String((apz.erro as { message?: string }).message ?? apz.erro)}</div>
          ) : !apz.prescricao ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Sem prescrição ativa (assinada ou validada) para esta internação.</div>
          ) : null}

          {/* Avisos de sincronia com a prescricao */}
          {ehAtual && aCancelar.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-on-soft">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {aCancelar.length} horário(s) futuro(s) de item suspenso ou retirado da prescrição: {[...new Set(aCancelar.map((a) => a.item_nome))].join(", ")}.
              {ehEnfermeiro && <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setCancelando(aCancelar.map((a) => a.id)); setCancelMotivo("Item suspenso/retirado da prescrição"); }}>Riscar horários futuros</Button>}
            </div>
          )}
          {ehAtual && prescricaoMudou && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Há nova versão da prescrição desde o aprazamento. Confira doses e horários; itens novos aparecem em “A aprazar”.
            </div>
          )}

          {/* A aprazar (enfermeiro, vigencia atual) */}
          {ehAtual && apz.prescricao && resolvidos.length > 0 && (
            <section className="rounded-lg border border-border bg-card">
              <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">A aprazar ({resolvidos.length})</h2>
                <span className="text-xs text-muted-foreground">Sugestão pela grade HMDM: horário da prescrição prevalece, ATB novo com 1ª dose imediata, intercalação e evitar 07h/19h.</span>
                {ehEnfermeiro ? (
                  <Button size="sm" className="ml-auto gap-2" disabled={!selecionados.length || apz.aprazar.isPending} onClick={aprazarSelecionados}>
                    {apz.aprazar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aprazar {selecionados.length} item(ns)
                  </Button>
                ) : <span className="ml-auto text-xs text-muted-foreground">Somente o enfermeiro apraza.</span>}
              </header>
              <ul className="divide-y divide-border">
                {resolvidos.map((r) => {
                  const e = escolha(r.item.itemId);
                  const opts = gradeOptions(r.item.frequencia);
                  const temSugestao = plano.some((p) => p.item.itemId === r.item.itemId);
                  return (
                    <li key={r.item.itemId} className="flex flex-wrap items-start gap-3 px-4 py-3">
                      {ehEnfermeiro && <Checkbox className="mt-1" checked={e.marcado} onCheckedChange={(v) => setEscolha(r.item.itemId, { marcado: v === true })} aria-label={`Aprazar ${r.item.nome}`} />}
                      <div className="min-w-[14rem] flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                          {r.item.mav && <span className="rounded border border-destructive/60 px-1 text-[10px] font-bold text-destructive">MAV</span>}
                          {r.item.nome}
                          {r.item.novoAntibiotico && <span className="rounded bg-primary/10 px-1 text-[10px] font-bold text-primary">ATB novo</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.item.resumo || "sem posologia"}{r.item.volumeMl ? ` · ${r.item.volumeMl} mL/dose → BH (${categoriaLabel(r.item.bhCategoria ?? "")})` : ""}</div>
                        {r.item.frequencia.tipo === "espacado" && <div className="mt-1 text-xs font-medium text-warning-on-soft">Intervalo de {r.item.frequencia.dias} dias: confirme se a dose é nesta vigência.</div>}
                        {r.motivo && e.key === "sugerido" && <div className="mt-1 text-xs text-muted-foreground">{r.motivo}</div>}
                      </div>
                      {ehEnfermeiro && (
                        <div className="flex flex-wrap items-center gap-2">
                          {temSugestao && (
                            <Select value={e.key} onValueChange={(v) => setEscolha(r.item.itemId, { key: v })}>
                              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sugerido">Sugerido</SelectItem>
                                {opts.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}: {o.hours.map(pad).join(" ")}</SelectItem>)}
                                <SelectItem value="livre">Livre</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {(e.key === "livre" || !temSugestao) && (
                            <Input className="h-8 w-40 text-xs" placeholder="horas: 10, 18, 02" value={e.livre} onChange={(ev) => setEscolha(r.item.itemId, { livre: ev.target.value })} aria-label={`Horas livres para ${r.item.nome}`} />
                          )}
                        </div>
                      )}
                      <div className="flex w-full flex-wrap items-center gap-1 pl-7">
                        {r.horarios.map((h) => <span key={h.getTime()} className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-semibold tabular-nums">{fmtHora(h)}</span>)}
                        {r.erros.map((er) => <span key={er} className="text-xs text-destructive">{er}</span>)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Grade da vigencia + checagem */}
          <section className="rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Horários da vigência</h2>
              <span className="text-xs text-muted-foreground">{podeChecar ? "Toque no horário para checar." : "Modo leitura."} Atraso: mais de 60 min sem checagem.</span>
            </header>
            {porItem.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum horário aprazado nesta vigência.</p>
            ) : (
              <ul className="divide-y divide-border">
                {porItem.map(([itemId, hs]) => {
                  const ativos = hs.filter((h) => !h.cancelado_em && !checagemPorApz.has(h.id));
                  return (
                    <li key={itemId} className="flex flex-wrap items-start gap-3 px-4 py-3">
                      <div className="min-w-[14rem] flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                          {hs.some((h) => h.mav) && <span className="rounded border border-destructive/60 px-1 text-[10px] font-bold text-destructive">MAV</span>}
                          {hs[0].item_nome}
                          {!itemPorId.has(itemId) && <span className="rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">fora da prescrição atual</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{hs[0].item_resumo}{hs[0].aprazado_por_nome ? ` · aprazado por ${nomeCurto(hs[0].aprazado_por_nome)}` : ""}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hs.map((h) => {
                          const st = statusDe(h); const c = checagemPorApz.get(h.id);
                          const dc = c && c.mav && c.status === "realizado" && !c.dupla_checagem_em;
                          return (
                            <button key={h.id} type="button" disabled={!podeChecar || st === "cancelada"}
                              onClick={() => abrirChecagem(h, itemPorId.get(itemId) ?? null)}
                              title={c ? `${STATUS_UI[st].label} às ${fmtHora(new Date(c.realizado_em))} por ${c.registrado_por_nome ?? "—"}${c.motivo ? ` — ${c.motivo}` : ""}` : h.cancelado_em ? `Cancelado: ${h.motivo_cancelamento}` : STATUS_UI[st].label}
                              className={cn("flex flex-col items-center rounded-md border px-2 py-1 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default", STATUS_UI[st].cls)}>
                              <span className="font-bold">{fmtHora(new Date(h.horario))}</span>
                              <span className="flex items-center gap-0.5 text-[10px]">
                                {st === "realizada" ? <CheckCircle2 className="h-3 w-3" /> : st === "nao_realizada" ? <XCircle className="h-3 w-3" /> : st === "atrasada" ? <AlertTriangle className="h-3 w-3" /> : st === "cancelada" ? <Ban className="h-3 w-3" /> : null}
                                {c ? fmtHora(new Date(c.realizado_em)) : STATUS_UI[st].label}
                              </span>
                              {dc && <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning-on-soft"><ShieldAlert className="h-3 w-3" /> DC</span>}
                            </button>
                          );
                        })}
                        {ehEnfermeiro && ehAtual && ativos.some((h) => new Date(h.horario).getTime() >= agora.getTime()) && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCancelando(ativos.filter((h) => new Date(h.horario).getTime() >= agora.getTime()).map((h) => h.id)); setCancelMotivo(""); }}>Reaprazar</Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* S/N, ACM e continuos */}
          {apz.prescricao && (snItens.length > 0 || continuos.length > 0) && (
            <section className="rounded-lg border border-border bg-card">
              <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Se necessário, a critério médico e contínuos</h2></header>
              <ul className="divide-y divide-border">
                {snItens.map((i) => (
                  <li key={i.itemId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="min-w-[14rem] flex-1 text-sm"><span className="font-semibold">{i.mav && <span className="mr-1 rounded border border-destructive/60 px-1 text-[10px] font-bold text-destructive">MAV</span>}{i.nome}</span><span className="block text-xs text-muted-foreground">{i.resumo}</span></div>
                    {podeChecar && ehAtual && <Button size="sm" variant="outline" onClick={() => abrirChecagem(null, i)}>Registrar dose</Button>}
                  </li>
                ))}
                {continuos.map((i) => (
                  <li key={i.itemId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="min-w-[14rem] flex-1 text-sm"><span className="font-semibold">{i.nome}</span><span className="block text-xs text-muted-foreground">{i.resumo} · infusão contínua: sem horário; volume entra no balanço como EV contínuo</span></div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ocorrencias.length > 0 && (
            <section className="rounded-lg border border-border bg-card">
              <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Ocorrências</h2></header>
              <ul className="divide-y divide-border text-sm">
                {ocorrencias.map((o, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3 px-4 py-2"><span className="tabular-nums text-muted-foreground">{o.quando}</span><span className="font-semibold">{o.item}</span><span className="flex-1">{o.texto}</span><span className="text-xs text-muted-foreground">{o.por}</span></li>
                ))}
              </ul>
            </section>
          )}
        </>
        )}
      </div>

      <ChecagemDialog alvo={alvo} checagem={checagemAberta} meuProfissionalId={meuProf} podeChecar={podeChecar} onClose={() => setAlvo(null)} />

      {/* Cancelar / reaprazar horarios */}
      <Dialog open={!!cancelando} onOpenChange={(o) => !o && setCancelando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cancelar {cancelando?.length ?? 0} horário(s) futuro(s)</DialogTitle><DialogDescription>Os horários ficam riscados (não se apagam). Para reaprazar, o item volta para “A aprazar”.</DialogDescription></DialogHeader>
          <Textarea rows={2} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} placeholder="Motivo (obrigatório)" aria-label="Motivo do cancelamento" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelando(null)}>Voltar</Button>
            <Button disabled={cancelMotivo.trim().length < 3 || apz.cancelar.isPending} onClick={() => cancelando && apz.cancelar.mutate({ ids: cancelando, motivo: cancelMotivo }, { onSuccess: () => setCancelando(null) })}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
