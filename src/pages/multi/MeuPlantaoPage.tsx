import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Loader2, AlertTriangle, ShieldAlert, Wifi, WifiOff, Activity, Droplets, BedDouble, CheckCircle2, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { usePatients } from "@/hooks/usePatients";
import { usePlantaoSetor, usePlantaoAcoes, derivarLeito, type LeitoEnfermagem, type DoseLeito } from "@/hooks/usePlantaoSetor";
import { useMeuProfissionalId, type AdministracaoRow } from "@/hooks/useAprazamento";
import { ChecagemDialog, type AlvoChecagem } from "@/components/multi/ChecagemDialog";
import { AnotacaoTecnicoForm, IntercorrenciaForm } from "@/components/multi/AnotacoesTecnico";
import type { AnotacaoRow } from "@/hooks/usePlantaoSetor";
import { prescriptionValidityWindow } from "@/lib/prescriptionValidity";
import { periodoBH, formatMl } from "@/lib/fluidBalance";
import { turnoAtual, tarefasAgora, news2DeSinaisVitais, validarSSVV, type CampoSSVV } from "@/lib/plantaoEnfermagem";
import { instanteChecagem } from "@/lib/aprazamentoItens";
import { formatNews2 } from "@/lib/news2";
import { fortalezaParts } from "@/lib/docPrefixes";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const fmtHora = (d: Date) => { const p = fortalezaParts(d); return `${pad(p.hour)}:${pad(p.minute)}`; };
const num = (s: string) => { const t = s.trim().replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };

function useOnline() {
  const [on, setOn] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const a = () => setOn(true); const b = () => setOn(false);
    window.addEventListener("online", a); window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  return on;
}

const CAMPOS: { k: CampoSSVV; label: string; ph: string }[] = [
  { k: "pressao_sistolica", label: "PA sistólica", ph: "120" },
  { k: "pressao_diastolica", label: "PA diastólica", ph: "80" },
  { k: "freq_cardiaca", label: "FC (bpm)", ph: "80" },
  { k: "freq_respiratoria", label: "FR (irpm)", ph: "18" },
  { k: "spo2", label: "SpO₂ (%)", ph: "96" },
  { k: "temperatura", label: "Temp. (°C)", ph: "36,5" },
  { k: "glicemia_capilar", label: "HGT (mg/dL)", ph: "110" },
  { k: "dor_escala", label: "Dor (0–10)", ph: "0" },
];
const PERDAS = [
  { k: "diurese", label: "Diurese (mL)" },
  { k: "dreno", label: "Dreno (mL)" },
  { k: "sng_aberta", label: "SNG aberta (mL)" },
  { k: "evacuacao", label: "Evacuação (mL)" },
  { k: "vomito", label: "Vômito (mL)" },
];

/**
 * "Meu plantao" do tecnico (prancheta 2), web desktop/tablet.
 * Inicio do turno: o tecnico assume os leitos (plantao_leitos). Abas:
 *  Agora — doses ate +2h dos meus leitos, atrasadas primeiro, + dupla checagem MAV;
 *  Controles da hora — SSVV (sinais_vitais, com O2 suplementar => NEWS2 completo)
 *    e perdas (diurese, drenos... => balanco_hidrico_lancamentos);
 *  Balanco do turno — ganhos/perdas por leito no turno.
 * Mesma checagem (ChecagemDialog) e mesma conta do painel (derivarLeito).
 * Sem rede: mostra o estado e bloqueia salvar (fila offline fora do escopo).
 */
export default function MeuPlantaoPage() {
  const { role } = useAuth();
  const online = useOnline();
  const meuProf = useMeuProfissionalId();
  const visivel = role === "tecnico" || role === "enfermeiro";
  const { currentDepartment, currentSectorCode } = useDepartment();
  const { patients, isLoading } = usePatients(currentSectorCode ? undefined : currentDepartment, currentSectorCode || undefined);
  const semSetor = !currentDepartment && !currentSectorCode;

  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  const janela = useMemo(() => prescriptionValidityWindow(agora), [agora]);
  const turno = useMemo(() => turnoAtual(agora), [agora]);
  const periodoAnterior = useMemo(() => { const p = periodoBH(agora); return { start: new Date(p.start.getTime() - DAY_MS), end: p.start }; }, [agora]);

  const ocupados = useMemo(() => patients.filter((p) => !p.isVacant && p.name)
    .sort((a, b) => String(a.bedNumber).localeCompare(String(b.bedNumber), "pt-BR", { numeric: true })), [patients]);
  const ids = useMemo(() => ocupados.map((p) => p.id), [ocupados]);
  const { dados, carregando, erro } = usePlantaoSetor(ids, janela, turno, periodoAnterior);
  const acoes = usePlantaoAcoes();

  const meus = useMemo(() => (dados && meuProf ? dados.plantao.filter((p) => p.profissional_id === meuProf) : []), [dados, meuProf]);
  const meusIds = useMemo(() => new Set(meus.map((m) => m.internacao_id)), [meus]);
  const leitos = useMemo(() => {
    if (!dados) return [] as { p: (typeof ocupados)[number]; l: LeitoEnfermagem }[];
    return ocupados.filter((p) => meusIds.has(p.id)).map((p) => ({ p, l: derivarLeito(dados, p.id, agora, janela, true, turno.inicio) }));
  }, [dados, ocupados, meusIds, agora, janela, turno.inicio]);
  const pacientePorId = useMemo(() => new Map(ocupados.map((p) => [p.id, p])), [ocupados]);

  const leitosOpcao = leitos.map(({ p }) => ({ internacaoId: p.id, rotulo: `${p.bedNumber} · ${p.name}` }));

  // ── Escolha de leitos ──
  const [escolha, setEscolha] = useState<Set<string>>(new Set());
  const [escolhendo, setEscolhendo] = useState(false);
  const outros = (id: string) => (dados?.plantao ?? []).filter((x) => x.internacao_id === id && x.profissional_id !== meuProf).map((x) => (x.profissional_nome ?? "").split(/\s+/).slice(0, 2).join(" "));

  // ── Agora ──
  const fila = useMemo(() => tarefasAgora(leitos.flatMap(({ l }) => l.doses), agora), [leitos, agora]);
  const dcOutros = leitos.flatMap(({ l }) => l.dcPendentes.filter((c) => c.registrado_por !== meuProf));
  const [alvo, setAlvo] = useState<AlvoChecagem | null>(null);
  const [alvoChecagem, setAlvoChecagem] = useState<AdministracaoRow | null>(null);
  const abrirDose = (d: DoseLeito) => {
    const lt = leitos.find(({ l }) => l.internacaoId === d.internacaoId);
    const p = pacientePorId.get(d.internacaoId);
    setAlvoChecagem(d.checagemRow);
    setAlvo({ internacaoId: d.internacaoId, prescricaoId: d.apz.prescricao_id, apz: d.apz, item: lt?.l.itens.find((i) => i.itemId === d.apz.item_id) ?? null, contexto: p ? `Leito ${p.bedNumber}` : undefined });
  };
  const abrirDc = (c: AdministracaoRow) => {
    const lt = leitos.find(({ l }) => l.internacaoId === c.internacao_id);
    const d = lt?.l.doses.find((x) => x.apz.id === c.aprazamento_id);
    const p = pacientePorId.get(c.internacao_id);
    setAlvoChecagem(c);
    setAlvo({ internacaoId: c.internacao_id, prescricaoId: c.prescricao_id, apz: d?.apz ?? null, item: lt?.l.itens.find((i) => i.itemId === c.item_id) ?? null, contexto: p ? `Leito ${p.bedNumber}` : undefined });
  };

  // ── Controles da hora ──
  const [leitoCtrl, setLeitoCtrl] = useState<string>("");
  useEffect(() => { if (!leitoCtrl && leitos.length) setLeitoCtrl(leitos[0].l.internacaoId); }, [leitos, leitoCtrl]);
  const [hora, setHora] = useState(() => fmtHora(new Date()));
  const [vals, setVals] = useState<Record<string, string>>({});
  const [o2, setO2] = useState<"" | "sim" | "nao">("");
  const [fio2, setFio2] = useState("");
  const [consc, setConsc] = useState("");
  const limpar = () => { setVals({}); setO2(""); setFio2(""); setConsc(""); setHora(fmtHora(new Date())); };
  const ssvvNums = Object.fromEntries(CAMPOS.map((c) => [c.k, num(vals[c.k] ?? "")])) as Record<CampoSSVV, number | null>;
  const fio2Num = o2 === "sim" ? num(fio2) : null;
  const fio2Frac = fio2Num != null && !Number.isNaN(fio2Num) ? (fio2Num > 1 ? Math.round(fio2Num) / 100 : fio2Num) : fio2Num;
  const perdasNums = PERDAS.map((p) => ({ categoria: p.k, volumeMl: num(vals[p.k] ?? "") }));
  const temSSVV = CAMPOS.some((c) => ssvvNums[c.k] != null) || o2 !== "" || !!consc;
  const errosSSVV = [
    ...validarSSVV({ ...ssvvNums, fio2: fio2Frac }),
    ...(Object.values(ssvvNums).some((v) => Number.isNaN(v as number)) ? ["há campo com valor inválido"] : []),
    ...perdasNums.filter((p) => p.volumeMl != null && (Number.isNaN(p.volumeMl) || p.volumeMl <= 0 || p.volumeMl >= 10000)).map((p) => `${p.categoria}: volume inválido`),
  ];
  const instante = instanteChecagem(hora, new Date());
  const futuro = !!instante && instante.getTime() > Date.now() + 5 * 60_000;
  const previa = temSSVV ? news2DeSinaisVitais({
    data_hora: new Date().toISOString(), freq_respiratoria: ssvvNums.freq_respiratoria, spo2: ssvvNums.spo2,
    o2_suplementar: o2 === "" ? null : o2 === "sim", temperatura: ssvvNums.temperatura, pressao_sistolica: ssvvNums.pressao_sistolica,
    freq_cardiaca: ssvvNums.freq_cardiaca, nivel_consciencia: consc || null,
  }) : null;
  const perdasValidas = perdasNums.filter((p): p is { categoria: string; volumeMl: number } => p.volumeMl != null && !Number.isNaN(p.volumeMl) && p.volumeMl > 0);
  const podeSalvar = online && !!leitoCtrl && !!instante && !futuro && errosSSVV.length === 0 && (temSSVV || perdasValidas.length > 0) && !acoes.registrarControles.isPending;
  const salvar = () => {
    if (!instante) return;
    const ssvv = temSSVV ? {
      // colunas inteiras no banco (PA, FC, FR, HGT, dor): arredonda; SpO2 e temperatura sao numeric
      ...Object.fromEntries(Object.entries(ssvvNums).filter(([, v]) => v != null)
        .map(([k, v]) => [k, k === "spo2" || k === "temperatura" ? v : Math.round(v as number)])),
      o2_suplementar: o2 === "" ? null : o2 === "sim",
      fio2: fio2Frac ?? null,
      nivel_consciencia: consc || null,
    } : null;
    acoes.registrarControles.mutate({ internacaoId: leitoCtrl, dataHora: instante, registradoPor: meuProf, ssvv, perdas: perdasValidas }, {
      onSuccess: limpar,
    });
  };

  if (!visivel) {
    return (
      <PageTransition>
        <AppHeader variant="clinical" showSector moduleLabel="Meu plantão" />
        <div className="p-4 md:p-6"><div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> “Meu plantão” é do técnico e do enfermeiro.</div></div>
      </PageTransition>
    );
  }

  const precisaEscolher = !!dados && (meus.length === 0 || escolhendo);

  return (
    <PageTransition>
      <AppHeader variant="clinical" showSector moduleLabel="Meu plantão" />
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-foreground">{turno.label}</span>
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold", online ? "border-border text-muted-foreground" : "border-destructive/40 bg-destructive/10 text-destructive")}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{online ? "Conectado" : "Sem conexão — registros bloqueados"}
          </span>
          {meus.length > 0 && !escolhendo && <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setEscolha(new Set()); setEscolhendo(true); }}>Assumir mais leitos</Button>}
        </div>

        {semSetor ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Selecione o setor no cabeçalho.</div>
        ) : isLoading || (carregando && ids.length > 0) || (ids.length > 0 && !dados && !erro) ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : erro ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Falha ao carregar: {erro.message}</div>
        ) : ocupados.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nenhum leito ocupado neste setor.</div>
        ) : precisaEscolher ? (
          <section className="rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <BedDouble className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Quais leitos são seus neste plantão?</h2>
              <div className="ml-auto flex gap-2">
                {escolhendo && <Button size="sm" variant="ghost" onClick={() => setEscolhendo(false)}>Cancelar</Button>}
                <Button size="sm" disabled={!escolha.size || !online || acoes.assumir.isPending} onClick={() => acoes.assumir.mutate({ ids: [...escolha], turnoInicio: turno.inicio }, { onSuccess: () => { setEscolhendo(false); setEscolha(new Set()); } })}>
                  {acoes.assumir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assumir {escolha.size || ""} leito(s)
                </Button>
              </div>
            </header>
            <ul className="divide-y divide-border">
              {ocupados.filter((p) => !meusIds.has(p.id)).map((p) => {
                const o = outros(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted">
                      <Checkbox checked={escolha.has(p.id)} onCheckedChange={(v) => setEscolha((s) => { const n = new Set(s); if (v === true) n.add(p.id); else n.delete(p.id); return n; })} aria-label={`Leito ${p.bedNumber}`} />
                      <span className="flex h-8 min-w-[2.5rem] items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-sm font-bold text-primary">{p.bedNumber}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                      {o.length > 0 && <span className="text-xs text-muted-foreground">com {o.join(", ")}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {leitos.map(({ p, l }) => {
                const meu = meus.find((m) => m.internacao_id === p.id);
                return (
                  <span key={p.id} className={cn("inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs", l.resumo.atrasadas || l.resumo.news2?.alertaEnfermeiro ? "border-warning/40 bg-warning-soft text-warning-on-soft" : "border-border bg-card")}>
                    <b>{p.bedNumber}</b><span className="max-w-[10rem] truncate">{p.name}</span>
                    {l.resumo.news2 && <span title={formatNews2(l.resumo.news2)}>NEWS2 {l.resumo.news2.parcial ? `parcial ${l.resumo.news2.score}` : l.resumo.news2.score}</span>}
                    {meu && <button type="button" aria-label={`Liberar leito ${p.bedNumber}`} title="Liberar leito" className="rounded hover:bg-muted" disabled={!online} onClick={() => acoes.liberar.mutate(meu.id)}><X className="h-3.5 w-3.5" /></button>}
                  </span>
                );
              })}
            </div>

            <Tabs defaultValue="agora">
              <TabsList>
                <TabsTrigger value="agora">Agora {fila.length ? `(${fila.length})` : ""}</TabsTrigger>
                <TabsTrigger value="controles">Controles da hora</TabsTrigger>
                <TabsTrigger value="balanco">Balanço do turno</TabsTrigger>
                <TabsTrigger value="anotacao">Anotação</TabsTrigger>
                <TabsTrigger value="intercorrencia">Intercorrência</TabsTrigger>
              </TabsList>

              <TabsContent value="agora" className="space-y-3">
                {dcOutros.length > 0 && (
                  <section className="rounded-lg border border-warning/40 bg-warning-soft">
                    <header className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-warning-on-soft"><ShieldAlert className="h-4 w-4" /> Dupla checagem MAV aguardando você</header>
                    <ul className="divide-y divide-warning/30">
                      {dcOutros.map((c) => (
                        <li key={c.id}><button type="button" className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-warning/10" onClick={() => abrirDc(c)}>
                          <b>Leito {pacientePorId.get(c.internacao_id)?.bedNumber}</b><span className="flex-1">{c.item_nome} · {fmtHora(new Date(c.realizado_em))} por {c.registrado_por_nome}</span>
                        </button></li>
                      ))}
                    </ul>
                  </section>
                )}
                <section className="rounded-lg border border-border bg-card">
                  <header className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">Doses até {fmtHora(new Date(agora.getTime() + 2 * 3_600_000))} — atrasadas primeiro</header>
                  {fila.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">Nada pendente nas próximas 2 horas nos seus leitos.</p> : (
                    <ul className="divide-y divide-border">
                      {fila.map(({ dose, status }) => {
                        const p = pacientePorId.get(dose.internacaoId);
                        return (
                          <li key={dose.id}>
                            <button type="button" disabled={!online} onClick={() => abrirDose(dose as DoseLeito)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted disabled:opacity-60">
                              <span className={cn("w-14 shrink-0 rounded-md border px-1.5 py-0.5 text-center text-sm font-bold tabular-nums", status === "atrasada" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border")}>{fmtHora(dose.horario)}</span>
                              <span className="w-12 shrink-0 text-sm font-bold text-primary">{p?.bedNumber}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{(dose as DoseLeito).apz.mav && <span className="mr-1 rounded border border-destructive/60 px-1 text-[10px] font-bold text-destructive">MAV</span>}{(dose as DoseLeito).apz.item_nome}</span>
                                <span className="block truncate text-xs text-muted-foreground">{(dose as DoseLeito).apz.item_resumo} · {p?.name}</span>
                              </span>
                              {status === "atrasada" && <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Atrasada</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
                <p className="text-xs text-muted-foreground">Doses S/N e a grade completa ficam no aprazamento de cada paciente (toque no nome no painel do enfermeiro).</p>
              </TabsContent>

              <TabsContent value="controles">
                <section className="space-y-4 rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-56">
                      <Label>Leito</Label>
                      <Select value={leitoCtrl} onValueChange={setLeitoCtrl}>
                        <SelectTrigger aria-label="Leito"><SelectValue /></SelectTrigger>
                        <SelectContent>{leitos.map(({ p }) => <SelectItem key={p.id} value={p.id}>{p.bedNumber} · {p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="w-28"><Label htmlFor="ctl-hora">Hora</Label><Input id="ctl-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
                    {futuro && <span className="text-xs text-destructive">Hora no futuro.</span>}
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sinais vitais</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                      {CAMPOS.map((c) => (
                        <div key={c.k}><Label htmlFor={`ctl-${c.k}`} className="text-xs">{c.label}</Label><Input id={`ctl-${c.k}`} inputMode="decimal" placeholder={c.ph} value={vals[c.k] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [c.k]: e.target.value }))} /></div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-4">
                      <div>
                        <Label className="text-xs">O₂ suplementar</Label>
                        <div className="mt-1 flex gap-1">
                          {(["nao", "sim"] as const).map((v) => <Button key={v} type="button" size="sm" variant={o2 === v ? "default" : "outline"} onClick={() => setO2(o2 === v ? "" : v)}>{v === "sim" ? "Sim" : "Não"}</Button>)}
                        </div>
                      </div>
                      {o2 === "sim" && <div className="w-28"><Label htmlFor="ctl-fio2" className="text-xs">FiO₂ (% ou 0,xx)</Label><Input id="ctl-fio2" inputMode="decimal" placeholder="40" value={fio2} onChange={(e) => setFio2(e.target.value)} /></div>}
                      <div className="w-48">
                        <Label className="text-xs">Consciência (AVPU)</Label>
                        <Select value={consc} onValueChange={setConsc}>
                          <SelectTrigger aria-label="Consciência"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alert">Alerta</SelectItem>
                            <SelectItem value="voice">Responde à voz</SelectItem>
                            <SelectItem value="pain">Responde à dor</SelectItem>
                            <SelectItem value="unresponsive">Não responde</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {previa && (
                        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-semibold", previa.alertaEnfermeiro ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border")}>
                          <Activity className="h-4 w-4" /> {formatNews2(previa)}
                        </span>
                      )}
                    </div>
                    {previa?.alertaEnfermeiro && <p className="mt-2 text-xs font-semibold text-destructive">NEWS2 em alerta: comunique o enfermeiro. O painel do enfermeiro do setor acende ao salvar.</p>}
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perdas (vão para o balanço hídrico)</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {PERDAS.map((c) => (
                        <div key={c.k}><Label htmlFor={`ctl-${c.k}`} className="text-xs">{c.label}</Label><Input id={`ctl-${c.k}`} inputMode="decimal" value={vals[c.k] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [c.k]: e.target.value }))} /></div>
                      ))}
                    </div>
                  </div>
                  {errosSSVV.length > 0 && <ul className="text-xs text-destructive">{errosSSVV.map((e) => <li key={e}>{e}</li>)}</ul>}
                  <div className="flex gap-2">
                    <Button disabled={!podeSalvar} onClick={salvar} className="gap-2">{acoes.registrarControles.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salvar controles</Button>
                    <Button variant="ghost" onClick={limpar}>Limpar</Button>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="balanco">
                <section className="rounded-lg border border-border bg-card">
                  <header className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">Balanço do turno ({turno.label})</header>
                  <ul className="divide-y divide-border">
                    {leitos.map(({ p, l }) => {
                      const qs = new URLSearchParams({ patientId: p.id, patientName: p.name, patientBed: String(p.bedNumber ?? ""), patientSector: String(p.sector ?? "") });
                      return (
                        <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                          <b className="w-12 text-primary">{p.bedNumber}</b>
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          <span className="tabular-nums">Ganhos {formatMl(l.turno.ganhos)}</span>
                          <span className="tabular-nums">Perdas {formatMl(l.turno.perdas)}</span>
                          <span className="font-semibold tabular-nums">Saldo {formatMl(l.turno.ganhos - l.turno.perdas, true)}</span>
                          <Link to={`/enfermagem/balanco?${qs.toString()}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Droplets className="h-3.5 w-3.5" /> BH 24h</Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </TabsContent>
              <TabsContent value="anotacao">
                <AnotacaoTecnicoForm leitos={leitosOpcao} online={online} />
                <AnotacoesDoTurno leitos={leitos.map(({ p, l }) => ({ rotulo: String(p.bedNumber), anotacoes: l.anotacoesTurno }))} />
              </TabsContent>
              <TabsContent value="intercorrencia">
                <IntercorrenciaForm leitos={leitosOpcao} online={online} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
      <ChecagemDialog alvo={alvo} checagem={alvoChecagem} meuProfissionalId={meuProf} podeChecar={online} onClose={() => { setAlvo(null); setAlvoChecagem(null); }} />
    </PageTransition>
  );
}

/** Anotacoes e intercorrencias registradas no turno nos meus leitos (leitura). */
function AnotacoesDoTurno({ leitos }: { leitos: { rotulo: string; anotacoes: AnotacaoRow[] }[] }) {
  const itens = leitos.flatMap((l) => l.anotacoes.map((a) => ({ ...a, leito: l.rotulo }))).sort((a, b) => b.data_hora.localeCompare(a.data_hora));
  if (!itens.length) return null;
  return (
    <section className="mt-3 rounded-lg border border-border bg-card">
      <header className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">Registrado neste turno</header>
      <ul className="divide-y divide-border text-sm">
        {itens.map((a) => (
          <li key={a.id} className="flex flex-wrap gap-x-3 px-4 py-2">
            <span className="tabular-nums text-muted-foreground">{fmtHora(new Date(a.data_hora))}</span>
            <b className="text-primary">{a.leito}</b>
            <span className={cn("flex-1", a.tipo === "intercorrencia" && "font-medium text-destructive")}>{a.texto_gerado}</span>
            <span className="text-xs text-muted-foreground">{a.registrado_por_nome}{a.tipo === "intercorrencia" ? (a.ciencia_em ? ` · ciência: ${a.ciencia_por_nome}` : " · aguardando ciência") : ""}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
