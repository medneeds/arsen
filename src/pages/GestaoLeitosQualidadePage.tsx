import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Activity, BedDouble, Clock, Download, RefreshCw, Search, Timer, TrendingUp, AlertTriangle, ArrowRightLeft, LogIn,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import { useGestaoLeitos, type GestaoLeitoRow } from "@/hooks/useGestaoLeitos";

// ── Helpers de formatacao ──────────────────────────────────────────────────
const fmtDateTime = (v: string | null) => (v ? format(new Date(v), "dd/MM/yy HH:mm", { locale: ptBR }) : "—");
const fmtDate = (v: string | null) => (v ? format(new Date(v), "dd/MM/yyyy", { locale: ptBR }) : "—");

/** minutos -> "Xh Ym" / "Ym". */
const fmtDur = (min: number | null | undefined) => {
  if (min == null) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
};

/** destino_setor pode vir como codigo (yellow) ou rotulo — normaliza para rotulo. */
const sectorLabel = (v: string | null) => {
  if (!v) return "—";
  return sectorLabelFromCode(v) || v;
};

/** diagnostico vem como texto (as vezes um array JSON) — formata legivel. */
const fmtDiag = (v: string | null) => {
  if (!v) return "—";
  const t = v.trim();
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t) as unknown[];
      if (Array.isArray(arr)) return arr.map((x) => String(x)).filter(Boolean).join("; ") || "—";
    } catch { /* usa como texto */ }
  }
  return t;
};

const TIPO_LABEL: Record<string, string> = {
  admissao: "Admissão",
  transferencia_interna: "Transf. interna",
};

const DESFECHO_LABEL: Record<string, string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  em_transito: "Em trânsito",
  pendente: "Pendente",
  alta: "Alta",
  obito: "Óbito",
  transferida: "Transferida",
  cancelada: "Cancelada",
};

function Kpi({ icon: Icon, label, value, sub, tone = "primary" }: {
  icon: typeof Clock; label: string; value: string; sub?: string; tone?: "primary" | "warning" | "released" | "muted";
}) {
  const toneCls: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning-on-soft bg-warning-soft",
    released: "text-released-on-soft bg-released-soft",
    muted: "text-muted-foreground bg-muted",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneCls[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-semibold leading-tight text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--released))",
  "hsl(var(--critical))", "hsl(var(--muted-foreground))",
];

export default function GestaoLeitosQualidadePage() {
  const { rows, loading, error, refetch } = useGestaoLeitos();

  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [desfecho, setDesfecho] = useState<string>("todos");
  const [setor, setSetor] = useState<string>("todos");
  const [dtIni, setDtIni] = useState<string>("");
  const [dtFim, setDtFim] = useState<string>("");

  // Opcoes de setor destino (rotulos unicos).
  const setorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.destino_setor) s.add(sectorLabel(r.destino_setor));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    const ini = dtIni ? new Date(dtIni + "T00:00:00") : null;
    const fim = dtFim ? new Date(dtFim + "T23:59:59") : null;
    return rows.filter((r) => {
      if (tipo !== "todos" && r.tipo_movimento !== tipo) return false;
      if (desfecho !== "todos" && r.desfecho !== desfecho) return false;
      if (setor !== "todos" && sectorLabel(r.destino_setor) !== setor) return false;
      if (qn) {
        const hay = `${r.nome_paciente ?? ""} ${r.prontuario ?? ""} ${r.numero_atendimento ?? ""}`.toLowerCase();
        if (!hay.includes(qn)) return false;
      }
      if ((ini || fim) && r.dt_pedido_leito) {
        const d = new Date(r.dt_pedido_leito);
        if (ini && d < ini) return false;
        if (fim && d > fim) return false;
      }
      return true;
    });
  }, [rows, q, tipo, desfecho, setor, dtIni, dtFim]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = filtered.length;
    const adm = filtered.filter((r) => r.tipo_movimento === "admissao").length;
    const transf = filtered.filter((r) => r.tipo_movimento === "transferencia_interna").length;
    const esperas = filtered.map((r) => r.min_espera_apos_solicitacao).filter((n): n is number => n != null);
    const transitos = filtered.map((r) => r.min_transito).filter((n): n is number => n != null);
    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    const transfTotal = filtered.filter((r) => r.tipo_movimento === "transferencia_interna");
    const concl = transfTotal.filter((r) => r.desfecho === "concluida").length;
    const pctConcl = transfTotal.length ? Math.round((concl / transfTotal.length) * 100) : null;
    return {
      total, adm, transf,
      avgEspera: avg(esperas),
      avgTransito: avg(transitos),
      pctConcl,
    };
  }, [filtered]);

  // ── Dados dos graficos ──
  const volumePorSetor = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const k = sectorLabel(r.destino_setor);
      if (k === "—") continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m, ([setor, total]) => ({ setor, total })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filtered]);

  const esperaPorSetor = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of filtered) {
      if (r.min_espera_apos_solicitacao == null) continue;
      const k = sectorLabel(r.destino_setor);
      if (k === "—") continue;
      let arr = m.get(k);
      if (!arr) { arr = []; m.set(k, arr); }
      arr.push(r.min_espera_apos_solicitacao);
    }
    return Array.from(m, ([setor, arr]) => ({
      setor, media: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    })).sort((a, b) => b.media - a.media).slice(0, 10);
  }, [filtered]);

  // ── Export CSV (layout da planilha de qualidade) ──
  const exportCsv = () => {
    const headers = [
      "Prontuário", "Tipo", "Nome", "Sexo", "Dt Nasc", "Idade", "Diagnóstico",
      "Setor Procedência", "Leito Procedência", "Data Admissão Hospitalar",
      "Dt/Hora Pedido de Leito", "Dt/Hora Recebimento Solicitação", "Tipo de Leito Solicitado",
      "Dt/Hora Liberação do Leito", "Dt/Hora Admissão no Leito", "Destino (Setor)", "Leito Destino",
      "Desfecho", "Motivo Não Ocupação",
      "Espera após Solicitação (min)", "Até Recebimento (min)", "Trânsito (min)",
    ];
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const iso = (v: string | null) => (v ? format(new Date(v), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "");
    const lines = filtered.map((r) => [
      r.prontuario, TIPO_LABEL[r.tipo_movimento] ?? r.tipo_movimento, r.nome_paciente, r.sexo,
      r.dt_nascimento ? format(new Date(r.dt_nascimento), "dd/MM/yyyy") : "", r.idade_anos, fmtDiag(r.diagnostico),
      sectorLabel(r.setor_procedencia) === "—" ? "" : sectorLabel(r.setor_procedencia), r.leito_procedencia,
      iso(r.data_admissao_hospitalar), iso(r.dt_pedido_leito), iso(r.dt_recebimento_solicitacao),
      r.tipo_leito_solicitado, iso(r.dt_liberacao_leito), iso(r.dt_admissao_no_leito),
      sectorLabel(r.destino_setor) === "—" ? "" : sectorLabel(r.destino_setor), r.leito_destino,
      DESFECHO_LABEL[r.desfecho ?? ""] ?? r.desfecho, r.motivo_nao_ocupacao,
      r.min_espera_apos_solicitacao, r.min_ate_recebimento, r.min_transito,
    ].map(esc).join(";"));
    const csv = "﻿" + [headers.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestao-leitos-qualidade-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = q || tipo !== "todos" || desfecho !== "todos" || setor !== "todos" || dtIni || dtFim;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4">
      {/* Cabecalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BedDouble className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-foreground">Gestão de Leitos — Qualidade</h1>
            <p className="text-xs text-muted-foreground">Tempos de movimentação de pacientes (admissões e transferências internas).</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={!filtered.length} className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Relatório indisponível</p>
              <p className="text-muted-foreground mt-1">
                A view <code className="font-mono">vw_gestao_leitos</code> não respondeu ({error}). Confirme que ela foi aplicada no banco.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={TrendingUp} label="Movimentações" value={String(kpis.total)} sub={`${kpis.adm} adm · ${kpis.transf} transf.`} />
        <Kpi icon={LogIn} label="Admissões" value={String(kpis.adm)} tone="released" />
        <Kpi icon={ArrowRightLeft} label="Transf. internas" value={String(kpis.transf)} tone="primary" />
        <Kpi icon={Clock} label="Espera média" value={fmtDur(kpis.avgEspera)} sub="após solicitação" tone="warning" />
        <Kpi icon={Timer} label="Trânsito médio" value={fmtDur(kpis.avgTransito)} sub="saída → nova alocação" tone="warning" />
        <Kpi icon={Activity} label="Transf. concluídas" value={kpis.pctConcl == null ? "—" : `${kpis.pctConcl}%`} tone="released" />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label className="text-xs">Buscar</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, prontuário ou atendimento" className="h-9 pl-8 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="admissao">Admissão</SelectItem>
                <SelectItem value="transferencia_interna">Transf. interna</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Desfecho</Label>
            <Select value={desfecho} onValueChange={setDesfecho}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {["ativa", "concluida", "em_transito", "pendente", "alta", "obito", "transferida"].map((d) => (
                  <SelectItem key={d} value={d}>{DESFECHO_LABEL[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Setor destino</Label>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {setorOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graficos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Volume por setor de destino</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {volumePorSetor.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumePorSetor} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="setor" width={110} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <RTooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {volumePorSetor.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados no filtro.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Espera média (min) por setor de destino</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {esperaPorSetor.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={esperaPorSetor} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="setor" width={110} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <RTooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="media" radius={[0, 4, 4, 0]} fill="hsl(var(--warning))" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados no filtro.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm">
            Detalhamento {hasFilters && <span className="font-normal text-muted-foreground">({filtered.length} de {rows.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Paciente</TableHead>
                  <TableHead className="text-xs">Prontuário</TableHead>
                  <TableHead className="text-xs">Atend.</TableHead>
                  <TableHead className="text-xs">Procedência</TableHead>
                  <TableHead className="text-xs">Pedido</TableHead>
                  <TableHead className="text-xs">Recebimento</TableHead>
                  <TableHead className="text-xs">Liberação</TableHead>
                  <TableHead className="text-xs">Admissão no leito</TableHead>
                  <TableHead className="text-xs">Destino</TableHead>
                  <TableHead className="text-xs text-right">Espera</TableHead>
                  <TableHead className="text-xs text-right">Trânsito</TableHead>
                  <TableHead className="text-xs">Desfecho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !rows.length ? (
                  <TableRow><TableCell colSpan={13} className="py-8 text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
                ) : !filtered.length ? (
                  <TableRow><TableCell colSpan={13} className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação no filtro.</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={`${r.tipo_movimento}-${r.evento_id}`} className="text-xs">
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1 text-[10px]", r.tipo_movimento === "admissao" ? "border-released-border text-released-on-soft" : "border-primary/40 text-primary")}>
                        {r.tipo_movimento === "admissao" ? <LogIn className="h-2.5 w-2.5" /> : <ArrowRightLeft className="h-2.5 w-2.5" />}
                        {TIPO_LABEL[r.tipo_movimento] ?? r.tipo_movimento}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate font-medium">{r.nome_paciente || "—"}</TableCell>
                    <TableCell className="font-mono">{r.prontuario || "—"}</TableCell>
                    <TableCell className="font-mono">{r.numero_atendimento || "—"}</TableCell>
                    <TableCell>{sectorLabel(r.setor_procedencia)}{r.leito_procedencia ? ` · ${r.leito_procedencia}` : ""}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(r.dt_pedido_leito)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(r.dt_recebimento_solicitacao)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(r.dt_liberacao_leito)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(r.dt_admissao_no_leito)}</TableCell>
                    <TableCell>{sectorLabel(r.destino_setor)}{r.leito_destino ? ` · ${r.leito_destino}` : ""}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtDur(r.min_espera_apos_solicitacao)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtDur(r.min_transito)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{DESFECHO_LABEL[r.desfecho ?? ""] ?? r.desfecho ?? "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-[11px] text-muted-foreground">
        Fonte: view <code className="font-mono">vw_gestao_leitos</code> · datas em {fmtDate(new Date().toISOString())} · uso restrito ao setor de qualidade/gestão.
      </p>
    </div>
  );
}
