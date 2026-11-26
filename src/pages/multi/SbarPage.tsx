import { useEffect, useMemo, useState } from "react";
import { Lock, Loader2, Printer, CheckCircle2, AlertOctagon } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { usePatients } from "@/hooks/usePatients";
import { usePlantaoSetor, derivarLeito, type LeitoEnfermagem } from "@/hooks/usePlantaoSetor";
import { useAnotacoesAcoes } from "@/hooks/useAnotacoesEnfermagem";
import { visibleMultiModules } from "@/config/multiModules";
import { prescriptionValidityWindow } from "@/lib/prescriptionValidity";
import { periodoBH, formatMl } from "@/lib/fluidBalance";
import { turnoAtual } from "@/lib/plantaoEnfermagem";
import { formatNews2 } from "@/lib/news2";
import { FUGULIN_CATEGORIAS, type FugulinCategoria } from "@/lib/fugulin";
import { montarSbarLeito, diagnosticosLegiveis, type SbarLeito } from "@/lib/anotacoesEnfermagem";
import { fortalezaParts, fortalezaLocal } from "@/lib/docPrefixes";
import { printSbar } from "@/lib/printEnfermagem";
import { hasActivePrecaution } from "@/lib/internacaoDiagnosticContext";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (iso: string) => { const p = fortalezaParts(new Date(iso)); return `${pad(p.hour)}:${pad(p.minute)}`; };

/** D de internacao (dia calendario, D1 = dia da entrada), em America/Fortaleza. */
function diasInternacao(entrada: string | null | undefined, agora: Date): number | null {
  if (!entrada) return null;
  const d = new Date(entrada.length <= 10 ? `${entrada}T12:00:00-03:00` : entrada);
  if (Number.isNaN(d.getTime())) return null;
  const a = fortalezaParts(d); const b = fortalezaParts(agora);
  const da = fortalezaLocal(a.year, a.month, a.day).getTime(); const db = fortalezaLocal(b.year, b.month, b.day).getTime();
  return Math.max(1, Math.round((db - da) / DAY_MS) + 1);
}

function pendenciasDoLeito(l: LeitoEnfermagem): string[] {
  const r = l.resumo;
  return [
    r.atrasadas ? `${r.atrasadas} dose(s) atrasada(s)` : "",
    r.duplaPendente ? `${r.duplaPendente} dupla checagem MAV pendente` : "",
    l.semHorario.length ? `Aprazar: ${l.semHorario.map((i) => i.nome).join(", ")}` : "",
    r.ssvvAtrasado ? (r.ssvvHaHoras == null ? "Sem SSVV registrado" : `SSVV há ${r.ssvvHaHoras.toLocaleString("pt-BR")} h`) : "",
    r.bhPendente ? "BH de ontem sem validação" : "",
    l.intercorrenciasAbertas.length ? `${l.intercorrenciasAbertas.length} intercorrência(s) sem ciência` : "",
    !l.fugulin ? "Classificar Fugulin de hoje" : "",
  ].filter(Boolean);
}

/**
 * Passagem de plantao SBAR do setor (§7.6): gerada a partir de diagnostico,
 * precaucao, NEWS2, BH do turno, Fugulin, intercorrencias e pendencias — as
 * MESMAS contas do painel do enfermeiro. O enfermeiro acrescenta a
 * recomendacao por leito, imprime ENF-SBAR e registra em passagens_plantao.
 * Dispositivos entram quando a tabela de dispositivos existir (etapa 6).
 */
export default function SbarPage() {
  const { role } = useAuth();
  const visivel = visibleMultiModules(role).some((m) => m.key === "enfermagem");
  const ehEnfermeiro = role === "enfermeiro";
  const acoes = useAnotacoesAcoes();
  const { currentDepartment, currentSectorCode, currentSectorLabel } = useDepartment();
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

  const [recomendacoes, setRecomendacoes] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [soAlerta, setSoAlerta] = useState(false);

  const sbar: (SbarLeito & { id: string })[] = useMemo(() => {
    if (!dados) return [];
    return ocupados.map((p) => {
      const l = derivarLeito(dados, p.id, agora, janela, true, turno.inicio);
      const v = l.ssvv;
      const ssvvTexto = v ? [
        v.pressao_sistolica != null ? `PA ${v.pressao_sistolica}/${v.pressao_diastolica ?? "—"}` : "",
        v.freq_cardiaca != null ? `FC ${v.freq_cardiaca}` : "", v.freq_respiratoria != null ? `FR ${v.freq_respiratoria}` : "",
        v.spo2 != null ? `SpO₂ ${v.spo2}%${v.o2_suplementar ? " em O₂" : ""}` : "", v.temperatura != null ? `Tax ${String(v.temperatura).replace(".", ",")}` : "",
        v.glicemia_capilar != null ? `HGT ${v.glicemia_capilar}` : "",
      ].filter(Boolean).join(" · ") + ` (${hhmm(v.data_hora)})` : null;
      return {
        id: p.id,
        ...montarSbarLeito({
          leito: String(p.bedNumber), paciente: p.name, idade: p.age ? String(p.age) : null,
          diasInternacao: diasInternacao(p.admissionDate, agora), diagnosticos: diagnosticosLegiveis(p.diagnoses),
          precaucao: hasActivePrecaution(p.isolationPrecautions) ? p.isolationPrecautions : null, paliativo: p.isPalliative,
          news2Texto: l.resumo.news2 ? formatNews2(l.resumo.news2) : null, news2Alerta: !!l.resumo.news2?.alertaEnfermeiro,
          ssvvTexto, bhTurnoTexto: `ganhos ${formatMl(l.turno.ganhos)}, perdas ${formatMl(l.turno.perdas)}, saldo ${formatMl(l.turno.ganhos - l.turno.perdas, true)}`,
          fugulinTexto: l.fugulin ? `${l.fugulin.escore} — ${FUGULIN_CATEGORIAS[l.fugulin.categoria as FugulinCategoria]?.label ?? l.fugulin.categoria}` : null,
          intercorrencias: l.anotacoesTurno.filter((a) => a.tipo === "intercorrencia").map((a) => `${hhmm(a.data_hora)} ${a.texto_gerado.replace(/^Intercorrência: /, "")}${a.ciencia_conduta ? ` Conduta: ${a.ciencia_conduta}` : ""}`),
          pendencias: pendenciasDoLeito(l),
          recomendacao: recomendacoes[p.id] ?? "",
        }),
      };
    });
  }, [dados, ocupados, agora, janela, turno.inicio, recomendacoes]);
  const visiveis = soAlerta ? sbar.filter((l) => l.alerta) : sbar;

  const setor = currentSectorLabel || String(currentDepartment || "");
  const imprimir = () => {
    const win = window.open("", "_blank", "width=794,height=1123");
    void printSbar(visiveis, { turno: turno.label, setor, observacoes, enfermeiro: null }, win);
  };
  const registrar = () => acoes.registrarPassagem.mutate({
    snapshot: { versao: 1, setor, turno: turno.label, turno_inicio: turno.inicio.toISOString(), gerado_em: new Date().toISOString(), leitos: sbar },
    observacoes, totalPacientes: sbar.length, leitosOcupados: ocupados.length, noturno: turno.noturno,
  });

  return (
    <PageTransition>
      <AppHeader variant="clinical" showSector moduleLabel="Passagem de plantão" />
      <div className="space-y-4 p-4 md:p-6">
        {!visivel ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Seu perfil não tem acesso.</div>
        ) : semSetor ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Selecione o setor no cabeçalho.</div>
        ) : isLoading || (carregando && ids.length > 0) || (ids.length > 0 && !dados && !erro) ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Montando a passagem…</div>
        ) : erro ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Falha ao carregar: {erro.message}</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-foreground">{setor} · {turno.label} · {sbar.length} leito(s)</span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={soAlerta} onCheckedChange={setSoAlerta} aria-label="Só leitos em atenção" /> Só leitos em atenção</label>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={imprimir}><Printer className="h-4 w-4" /> Imprimir ENF-SBAR</Button>
                {ehEnfermeiro && <Button size="sm" className="gap-2" disabled={!sbar.length || acoes.registrarPassagem.isPending} onClick={registrar}>
                  {acoes.registrarPassagem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Registrar passagem
                </Button>}
              </div>
            </div>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações gerais do setor (opcional)" aria-label="Observações gerais" />
            <div className="space-y-3">
              {visiveis.map((l) => (
                <section key={l.id} className={cn("rounded-lg border bg-card", l.alerta ? "border-destructive/40" : "border-border")}>
                  <header className={cn("flex items-center gap-2 border-b px-4 py-2", l.alerta ? "border-destructive/30 bg-destructive/5" : "border-border")}>
                    <span className="flex h-8 min-w-[2.5rem] items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-sm font-bold text-primary">{l.leito}</span>
                    <span className="font-semibold">{l.paciente}</span>
                    {l.alerta && <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-destructive"><AlertOctagon className="h-3.5 w-3.5" /> Atenção</span>}
                  </header>
                  <div className="grid gap-3 p-4 text-sm md:grid-cols-4">
                    {([["S", "Situação", l.s], ["B", "Breve histórico", l.b], ["A", "Avaliação", l.a], ["R", "Recomendação", l.r]] as const).map(([k, t, linhas]) => (
                      <div key={k}>
                        <div className="text-xs font-semibold uppercase text-muted-foreground"><span className="text-primary">{k}</span> {t}</div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">{linhas.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border px-4 py-2">
                    <Textarea rows={1} value={recomendacoes[l.id] ?? ""} onChange={(e) => setRecomendacoes((r) => ({ ...r, [l.id]: e.target.value }))} placeholder="Recomendação para o próximo plantão (entra no R)" aria-label={`Recomendação leito ${l.leito}`} />
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
