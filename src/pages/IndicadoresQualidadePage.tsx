import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Activity, BedDouble, HeartPulse, RefreshCw, Repeat, LogOut, AlertTriangle, TrendingUp, Clock, RotateCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useIndicadoresData, type InternacaoIndic } from "@/hooks/useIndicadoresData";

const DESFECHO_LABEL: Record<string, string> = {
  alta: "Alta", obito: "Óbito", transferida: "Transf. externa", cancelada: "Cancelada", ativa: "Ativa",
};
const fmtDT = (v: string | null) => (v ? format(new Date(v), "dd/MM/yy HH:mm", { locale: ptBR }) : "—");

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;
const hoursBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const fmtPct = (v: number | null) => (v == null ? "—" : `${v}%`);
const fmtNum = (v: number | null, suffix = "") => (v == null ? "—" : `${v}${suffix}`);

function Kpi({ icon: Icon, label, value, sub, tone = "primary", hint }: {
  icon: typeof Clock; label: string; value: string; sub?: string; tone?: string; hint?: string;
}) {
  const toneCls: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning-on-soft bg-warning-soft",
    released: "text-released-on-soft bg-released-soft",
    critical: "text-critical-on-soft bg-critical-soft",
    muted: "text-muted-foreground bg-muted",
  };
  return (
    <Card title={hint}>
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

export default function IndicadoresQualidadePage() {
  const { internacoes, setores, leitosTotal, loading, error, refetch } = useIndicadoresData();

  const [dtIni, setDtIni] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dtFim, setDtFim] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [setorSel, setSetorSel] = useState<string>("todos");
  const [desfechoSel, setDesfechoSel] = useState<string>("todos");

  const setorNome = (id: string | null) => (id && setores[id]) || "Sem setor";

  // Opcoes de setor (nomes unicos presentes nas internacoes).
  const setorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const i of internacoes) s.add(setorNome(i.setor_id));
    return Array.from(s).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internacoes, setores]);

  // Internacoes do setor selecionado (base dos KPIs e da tabela de saidas).
  const baseInternacoes = useMemo(
    () => (setorSel === "todos" ? internacoes : internacoes.filter((i) => setorNome(i.setor_id) === setorSel)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [internacoes, setorSel, setores],
  );

  const calc = useMemo(() => {
    const ini = new Date(dtIni + "T00:00:00").getTime();
    const fim = new Date(dtFim + "T23:59:59").getTime();
    const inRange = (d: string | null) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      return t >= ini && t <= fim;
    };

    // Saidas e admissoes no periodo (restritas ao setor selecionado).
    const saidas = baseInternacoes.filter((i) => i.data_alta && inRange(i.data_alta));
    const admissoes = baseInternacoes.filter((i) => i.data_entrada && inRange(i.data_entrada));
    const ativas = baseInternacoes.filter((i) => !i.data_alta && (i.status === "ativa" || i.status == null));

    // Permanencia (dias) das saidas.
    const permDias = saidas
      .filter((i) => i.data_entrada && i.data_alta)
      .map((i) => daysBetween(i.data_entrada as string, i.data_alta as string))
      .filter((d) => d >= 0);
    const mediaPermanencia = permDias.length
      ? Math.round((permDias.reduce((a, b) => a + b, 0) / permDias.length) * 10) / 10
      : null;

    // Desfechos.
    const obitos = saidas.filter((i) => i.status === "obito");
    const transfExt = saidas.filter((i) => i.status === "transferida");
    const obitos48 = obitos.filter((i) => i.data_entrada && i.data_alta && hoursBetween(i.data_entrada, i.data_alta) < 48);

    // Taxa de ocupacao ATUAL (snapshot). So faz sentido hospital-wide (nao temos
    // contagem de leitos por setor) — por isso so quando setor = todos.
    const ocupacao = setorSel === "todos" && leitosTotal > 0 ? Math.round((ativas.length / leitosTotal) * 1000) / 10 : null;
    // Giro de leito no periodo (saidas / leitos).
    const giro = leitosTotal > 0 ? Math.round((saidas.length / leitosTotal) * 100) / 100 : null;

    // Reinternacao 30d: admissao no periodo cujo paciente teve ALTA <=30d antes.
    const byPac = new Map<string, InternacaoIndic[]>();
    for (const i of internacoes) {
      if (!i.paciente_id) continue;
      let arr = byPac.get(i.paciente_id);
      if (!arr) { arr = []; byPac.set(i.paciente_id, arr); }
      arr.push(i);
    }
    let reinternacoes = 0;
    for (const adm of admissoes) {
      if (!adm.paciente_id || !adm.data_entrada) continue;
      const prev = (byPac.get(adm.paciente_id) ?? []).filter(
        (o) => o.id !== adm.id && o.data_alta && new Date(o.data_alta).getTime() <= new Date(adm.data_entrada as string).getTime(),
      );
      if (prev.some((o) => daysBetween(o.data_alta as string, adm.data_entrada as string) <= 30)) reinternacoes++;
    }

    // Por setor (saidas): permanencia media + obitos + admissoes.
    const setorAgg = new Map<string, { perm: number[]; obitos: number; adm: number; nome: string }>();
    const bump = (id: string | null) => {
      const nome = setorNome(id);
      let a = setorAgg.get(nome);
      if (!a) { a = { perm: [], obitos: 0, adm: 0, nome }; setorAgg.set(nome, a); }
      return a;
    };
    for (const i of saidas) {
      const a = bump(i.setor_id);
      if (i.data_entrada && i.data_alta) { const d = daysBetween(i.data_entrada, i.data_alta); if (d >= 0) a.perm.push(d); }
      if (i.status === "obito") a.obitos++;
    }
    for (const i of admissoes) bump(i.setor_id).adm++;
    const porSetor = Array.from(setorAgg.values()).map((a) => ({
      setor: a.nome,
      permMedia: a.perm.length ? Math.round((a.perm.reduce((x, y) => x + y, 0) / a.perm.length) * 10) / 10 : 0,
      obitos: a.obitos,
      admissoes: a.adm,
    })).sort((x, y) => y.admissoes - x.admissoes);

    // Lista de SAIDAS/ALTAS no periodo (para o relatorio por setor/paciente).
    const saidasList = saidas
      .filter((i) => desfechoSel === "todos" || i.status === desfechoSel)
      .map((i) => ({
        id: i.id,
        nome: i.nome || "—",
        prontuario: i.prontuario || "—",
        setor: setorNome(i.setor_id),
        data_entrada: i.data_entrada,
        data_alta: i.data_alta,
        permanencia: i.data_entrada && i.data_alta ? Math.round(daysBetween(i.data_entrada, i.data_alta) * 10) / 10 : null,
        desfecho: i.status,
      }))
      .sort((a, b) => (b.data_alta || "").localeCompare(a.data_alta || ""));

    return {
      saidasList,
      admissoes: admissoes.length,
      saidas: saidas.length,
      ativas: ativas.length,
      ocupacao,
      mediaPermanencia,
      giro,
      taxaMortalidade: pct(obitos.length, saidas.length),
      obitos: obitos.length,
      pctObito48: pct(obitos48.length, obitos.length),
      taxaTransfExt: pct(transfExt.length, saidas.length),
      taxaReinternacao: pct(reinternacoes, admissoes.length),
      reinternacoes,
      porSetor,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internacoes, baseInternacoes, setores, leitosTotal, dtIni, dtFim, setorSel, desfechoSel]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-foreground">Indicadores de Qualidade — Gestão de Pacientes</h1>
            <p className="text-xs text-muted-foreground">Ocupação, permanência, giro, mortalidade e reinternação. Referências: Fiocruz / ANS-QualiSS / Anvisa.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px]">
            <Label className="text-xs">Setor</Label>
            <Select value={setorSel} onValueChange={setSetorSel}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setorOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">De</Label><Input type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} className="mt-1 h-9 text-sm" /></div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-muted-foreground">Falha ao carregar dados ({error}).</p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        <Kpi icon={BedDouble} label="Taxa de ocupação" value={fmtPct(calc.ocupacao)} sub={`${calc.ativas} ativas / ${leitosTotal} leitos (agora)`} tone="primary" hint="Internações ativas ÷ leitos operacionais (snapshot atual)." />
        <Kpi icon={Clock} label="Média de permanência" value={fmtNum(calc.mediaPermanencia, " d")} sub="saídas no período" tone="warning" hint="Média (dias) entre admissão e saída das altas do período." />
        <Kpi icon={RotateCw} label="Giro de leito" value={fmtNum(calc.giro)} sub="saídas ÷ leitos (período)" tone="released" hint="Índice de rotatividade: saídas no período ÷ nº de leitos." />
        <Kpi icon={TrendingUp} label="Movimento" value={`${calc.admissoes} / ${calc.saidas}`} sub="admissões / saídas" tone="muted" hint="Admissões e saídas (altas/óbitos/transferências) no período." />
        <Kpi icon={HeartPulse} label="Taxa de mortalidade" value={fmtPct(calc.taxaMortalidade)} sub={`${calc.obitos} óbitos / ${calc.saidas} saídas`} tone="critical" hint="Óbitos ÷ saídas no período." />
        <Kpi icon={Activity} label="Óbitos < 48h" value={fmtPct(calc.pctObito48)} sub="dos óbitos" tone="critical" hint="% dos óbitos que ocorreram com menos de 48h de internação." />
        <Kpi icon={LogOut} label="Transferência externa" value={fmtPct(calc.taxaTransfExt)} sub="das saídas" tone="warning" hint="Saídas por transferência externa ÷ total de saídas." />
        <Kpi icon={Repeat} label="Reinternação 30d" value={fmtPct(calc.taxaReinternacao)} sub={`${calc.reinternacoes} de ${calc.admissoes} admissões`} tone="warning" hint="Admissões cujo paciente teve alta nos 30 dias anteriores." />
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Permanência média (dias) por setor</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {calc.porSetor.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calc.porSetor} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="setor" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <RTooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="permMedia" radius={[0, 4, 4, 0]}>
                    {calc.porSetor.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem saídas no período.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Admissões por setor (período)</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {calc.porSetor.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calc.porSetor} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="setor" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <RTooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="admissoes" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem admissões no período.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Saidas / Altas no periodo (relatorio por setor/paciente) */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-3">
          <CardTitle className="text-sm">
            Saídas / Altas no período
            <span className="ml-1 font-normal text-muted-foreground">
              ({calc.saidasList.length}{setorSel !== "todos" ? ` · ${setorSel}` : ""})
            </span>
          </CardTitle>
          <div className="w-[180px]">
            <Select value={desfechoSel} onValueChange={setDesfechoSel}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Desfecho" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os desfechos</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="obito">Óbito</SelectItem>
                <SelectItem value="transferida">Transferência externa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="text-xs">Paciente</TableHead>
                  <TableHead className="text-xs">Prontuário</TableHead>
                  <TableHead className="text-xs">Setor</TableHead>
                  <TableHead className="text-xs">Admissão</TableHead>
                  <TableHead className="text-xs">Saída</TableHead>
                  <TableHead className="text-xs text-right">Permanência</TableHead>
                  <TableHead className="text-xs">Desfecho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.saidasList.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Nenhuma saída no período/filtro.</TableCell></TableRow>
                ) : calc.saidasList.map((s) => (
                  <TableRow key={s.id} className="text-xs">
                    <TableCell className="max-w-[200px] truncate font-medium">{s.nome}</TableCell>
                    <TableCell className="font-mono">{s.prontuario}</TableCell>
                    <TableCell>{s.setor}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDT(s.data_entrada)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDT(s.data_alta)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{s.permanencia == null ? "—" : `${s.permanencia} d`}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-[10px]", s.desfecho === "obito" && "bg-critical-soft text-critical-on-soft")}>
                        {DESFECHO_LABEL[s.desfecho ?? ""] ?? s.desfecho ?? "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-[11px] text-muted-foreground">
        Período: {format(new Date(dtIni), "dd/MM/yyyy", { locale: ptBR })} a {format(new Date(dtFim), "dd/MM/yyyy", { locale: ptBR })} ·
        indicadores calculados sobre internações do Arsen. SMR (mortalidade observada/esperada via SAPS 3) e indicadores de IRAS/segurança entram na próxima fase.
      </p>
    </div>
  );
}
