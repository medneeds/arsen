import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, AlertTriangle, ShieldAlert, CalendarClock, Droplets, Activity, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { usePatients } from "@/hooks/usePatients";
import { usePlantaoSetor, derivarLeito } from "@/hooks/usePlantaoSetor";
import { visibleMultiModules } from "@/config/multiModules";
import { prescriptionValidityWindow } from "@/lib/prescriptionValidity";
import { periodoBH } from "@/lib/fluidBalance";
import { turnoAtual } from "@/lib/plantaoEnfermagem";
import { formatNews2 } from "@/lib/news2";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const tom = (alerta: boolean) => (alerta ? "border-warning/40 bg-warning-soft text-warning-on-soft" : "border-border bg-background text-muted-foreground");

/**
 * Painel do enfermeiro do setor (prancheta 17): uma linha por leito com doses
 * atrasadas, dupla checagem MAV, itens sem horario, NEWS2 (parcial quando falta
 * O2 suplementar), SSVV atrasado, BH de ontem sem validacao e tecnico do turno.
 * Mesma conta do "Meu plantao" (derivarLeito). Atualiza em tempo real.
 */
export default function PainelEnfermeiroPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { currentDepartment, currentSectorCode } = useDepartment();
  const { patients, isLoading } = usePatients(currentSectorCode ? undefined : currentDepartment, currentSectorCode || undefined);
  const visivel = visibleMultiModules(role).some((m) => m.key === "enfermagem");
  const semSetor = !currentDepartment && !currentSectorCode;

  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  const janela = useMemo(() => prescriptionValidityWindow(agora), [agora]);
  const turno = useMemo(() => turnoAtual(agora), [agora]);
  const periodoAnterior = useMemo(() => { const p = periodoBH(agora); return { start: new Date(p.start.getTime() - DAY_MS), end: p.start }; }, [agora]);

  const ocupados = useMemo(() => patients
    .filter((p) => !p.isVacant && p.name)
    .sort((a, b) => String(a.bedNumber).localeCompare(String(b.bedNumber), "pt-BR", { numeric: true })), [patients]);
  const ids = useMemo(() => ocupados.map((p) => p.id), [ocupados]);
  const { dados, carregando, erro } = usePlantaoSetor(ids, janela, turno, periodoAnterior);

  const linhas = useMemo(() => (dados ? ocupados.map((p) => ({ p, l: derivarLeito(dados, p.id, agora, janela, true) })) : []), [dados, ocupados, agora, janela]);
  const tecnicos = useMemo(() => [...new Set(linhas.flatMap(({ l }) => l.resumo.tecnicos))].sort(), [linhas]);
  const [soPendencia, setSoPendencia] = useState(false);
  const [tecnico, setTecnico] = useState("todos");
  const filtradas = linhas.filter(({ l }) => (!soPendencia || l.resumo.pendencias > 0)
    && (tecnico === "todos" || (tecnico === "sem" ? l.resumo.tecnicos.length === 0 : l.resumo.tecnicos.includes(tecnico))));

  const tot = linhas.reduce((a, { l }) => ({
    atrasadas: a.atrasadas + l.resumo.atrasadas,
    dc: a.dc + l.resumo.duplaPendente,
    semHorario: a.semHorario + l.resumo.semAprazamento,
    news2: a.news2 + (l.resumo.news2?.alertaEnfermeiro ? 1 : 0),
    semTecnico: a.semTecnico + (l.resumo.tecnicos.length === 0 ? 1 : 0),
  }), { atrasadas: 0, dc: 0, semHorario: 0, news2: 0, semTecnico: 0 });

  const abrir = (p: (typeof ocupados)[number], path: string) => {
    const qs = new URLSearchParams({ patientId: p.id, patientName: p.name, patientBed: String(p.bedNumber ?? ""), patientSector: String(p.sector ?? "") });
    navigate(`${path}?${qs.toString()}`);
  };

  const Tile = ({ label, value, alerta }: { label: string; value: number; alerta: boolean }) => (
    <div className={cn("rounded-lg border px-3 py-2", tom(alerta && value > 0))}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );

  return (
    <PageTransition>
      <AppHeader variant="clinical" showSector moduleLabel="Painel do enfermeiro" />
      <div className="space-y-4 p-4 md:p-6">
        {!visivel ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4 shrink-0" /> Seu perfil não tem acesso ao painel do enfermeiro.</div>
        ) : semSetor ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Selecione o setor no cabeçalho para ver os leitos.</div>
        ) : isLoading || (carregando && ids.length > 0) ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando leitos…</div>
        ) : erro ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Falha ao carregar o painel: {erro.message}</div>
        ) : ocupados.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nenhum leito ocupado neste setor.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Leitos" value={ocupados.length} alerta={false} />
              <Tile label="Doses atrasadas" value={tot.atrasadas} alerta />
              <Tile label="Dupla checagem MAV" value={tot.dc} alerta />
              <Tile label="Itens sem horário" value={tot.semHorario} alerta />
              <Tile label="NEWS2 em alerta" value={tot.news2} alerta />
              <Tile label="Leitos sem técnico" value={tot.semTecnico} alerta />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-foreground">{turno.label}</span>
              <span className="text-xs text-muted-foreground">Vigência da prescrição 12h → 12h · atualiza em tempo real</span>
              <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={soPendencia} onCheckedChange={setSoPendencia} aria-label="Só leitos com pendência" /> Só com pendência</label>
              <Select value={tecnico} onValueChange={setTecnico}>
                <SelectTrigger className="h-8 w-48 text-xs" aria-label="Filtrar por técnico"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os técnicos</SelectItem>
                  <SelectItem value="sem">Sem técnico no turno</SelectItem>
                  {tecnicos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <section className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Leito · paciente</th>
                    <th className="px-3 py-2">Técnico</th>
                    <th className="px-3 py-2">Doses</th>
                    <th className="px-3 py-2">MAV</th>
                    <th className="px-3 py-2">Sem horário</th>
                    <th className="px-3 py-2">NEWS2 · SSVV</th>
                    <th className="px-3 py-2">BH de ontem</th>
                    <th className="px-3 py-2">Turno (BH)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtradas.map(({ p, l }) => {
                    const r = l.resumo;
                    return (
                      <tr key={p.id} className="align-top hover:bg-muted/40">
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => abrir(p, "/enfermagem/aprazamento")} className="flex items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                            <span className="flex h-8 min-w-[2.5rem] items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-sm font-bold text-primary">{p.bedNumber}</span>
                            <span className="min-w-0"><span className="block max-w-[14rem] truncate font-semibold text-foreground">{p.name}</span>
                              {r.pendencias > 0 ? <span className="text-xs font-medium text-warning-on-soft">{r.pendencias} pendência(s)</span> : <span className="text-xs text-muted-foreground">sem pendência</span>}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-xs">{r.tecnicos.length ? r.tecnicos.join(", ") : <span className="text-warning-on-soft">sem técnico</span>}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.atrasadas > 0 && <span className="mr-1 inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive"><AlertTriangle className="h-3 w-3" />{r.atrasadas} atrasada(s)</span>}
                          {r.proximaHora > 0 && <span className="inline-block rounded border border-border px-1.5 py-0.5">{r.proximaHora} na próxima hora</span>}
                          {!r.atrasadas && !r.proximaHora && <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">{r.duplaPendente ? <span className="inline-flex items-center gap-1 font-semibold text-warning-on-soft"><ShieldAlert className="h-3 w-3" />{r.duplaPendente} DC pendente</span> : "—"}</td>
                        <td className="px-3 py-2 text-xs">
                          {l.semHorario.length
                            ? <button type="button" className="inline-flex items-center gap-1 font-semibold text-warning-on-soft hover:underline" onClick={() => abrir(p, "/enfermagem/aprazamento")} title={l.semHorario.map((i) => i.nome).join(", ")}><CalendarClock className="h-3 w-3" />{l.semHorario.length} item(ns)</button>
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.news2
                            ? <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5", r.news2.alertaEnfermeiro ? "border-destructive/40 bg-destructive/10 font-semibold text-destructive" : "border-border")} title={formatNews2(r.news2)}>
                                <Activity className="h-3 w-3" />{r.news2.parcial ? `parcial ${r.news2.score}` : r.news2.score}
                              </span>
                            : <span className="text-muted-foreground">sem SSVV</span>}
                          {r.ssvvHaHoras != null && <span className={cn("ml-1", r.ssvvAtrasado ? "font-semibold text-warning-on-soft" : "text-muted-foreground")}>há {r.ssvvHaHoras.toLocaleString("pt-BR")} h</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <button type="button" onClick={() => abrir(p, "/enfermagem/balanco")} className={cn("rounded px-1 hover:underline", r.bhPendente ? "font-semibold text-warning-on-soft" : "text-muted-foreground")}>
                            {r.bhAnterior === "validado" ? "Validado" : r.bhAnterior === "fechado" ? "Fechado, sem validar" : "Não fechado"}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">
                          <span className="inline-flex items-center gap-1 text-muted-foreground"><Droplets className="h-3 w-3" />+{l.turno.ganhos.toLocaleString("pt-BR")} / −{l.turno.perdas.toLocaleString("pt-BR")} mL</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtradas.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum leito com os filtros atuais.</p>}
            </section>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> O técnico aparece quando assume o leito em “Meu plantão”. Fugulin do dia e escala entram na etapa de SAE.</p>
          </>
        )}
      </div>
    </PageTransition>
  );
}
