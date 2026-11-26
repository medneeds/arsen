import { useState } from "react";
import { Loader2, CheckCircle2, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnotacoesAcoes } from "@/hooks/useAnotacoesEnfermagem";
import {
  FRASES_TECNICO, TIPOS_INTERCORRENCIA, montarAnotacaoTecnico, montarIntercorrencia, validarIntercorrencia,
} from "@/lib/anotacoesEnfermagem";
import { instanteChecagem } from "@/lib/aprazamentoItens";
import { fortalezaParts } from "@/lib/docPrefixes";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const agoraHHMM = () => { const p = fortalezaParts(new Date()); return `${pad(p.hour)}:${pad(p.minute)}`; };

export interface LeitoOpcao { internacaoId: string; rotulo: string }

function LeitoHora({ leitos, leito, setLeito, hora, setHora }: { leitos: LeitoOpcao[]; leito: string; setLeito: (v: string) => void; hora: string; setHora: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-64">
        <Label>Leito</Label>
        <Select value={leito} onValueChange={setLeito}>
          <SelectTrigger aria-label="Leito"><SelectValue placeholder="Escolha o leito" /></SelectTrigger>
          <SelectContent>{leitos.map((l) => <SelectItem key={l.internacaoId} value={l.internacaoId}>{l.rotulo}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="w-28"><Label htmlFor="an-hora">Hora</Label><Input id="an-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
    </div>
  );
}

const futuro = (d: Date | null) => !!d && d.getTime() > Date.now() + 5 * 60_000;

/** Anotacao do tecnico: frases clicaveis + texto livre -> anotacoes_enfermagem (anotacao_tecnico). */
export function AnotacaoTecnicoForm({ leitos, online }: { leitos: LeitoOpcao[]; online: boolean }) {
  const acoes = useAnotacoesAcoes();
  const [leito, setLeito] = useState(leitos[0]?.internacaoId ?? "");
  const [hora, setHora] = useState(agoraHHMM);
  const [frases, setFrases] = useState<string[]>([]);
  const [livre, setLivre] = useState("");
  const texto = montarAnotacaoTecnico({ frases, livre });
  const instante = instanteChecagem(hora, new Date());
  const ok = online && !!leito && !!instante && !futuro(instante) && texto.length > 0 && !acoes.registrar.isPending;
  const toggle = (f: string) => setFrases((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]));
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <LeitoHora leitos={leitos} leito={leito} setLeito={setLeito} hora={hora} setHora={setHora} />
      {FRASES_TECNICO.map((g) => (
        <div key={g.grupo}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.grupo}</h3>
          <div className="flex flex-wrap gap-1.5">
            {g.frases.map((f) => (
              <button key={f} type="button" aria-pressed={frases.includes(f)} onClick={() => toggle(f)}
                className={cn("rounded-full border px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  frases.includes(f) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted")}>
                {f}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div><Label htmlFor="an-livre">Complemento</Label><Textarea id="an-livre" rows={2} value={livre} onChange={(e) => setLivre(e.target.value)} placeholder="Texto livre (opcional)" /></div>
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm"><span className="text-xs font-semibold uppercase text-muted-foreground">Prévia</span><p className="mt-1">{texto || "—"}</p></div>
      {futuro(instante) && <p className="text-xs text-destructive">A hora não pode estar no futuro.</p>}
      <Button disabled={!ok} className="gap-2" onClick={() => instante && acoes.registrar.mutate(
        { internacaoId: leito, tipo: "anotacao_tecnico", dataHora: instante, conteudo: { frases, livre: livre.trim() }, texto },
        { onSuccess: () => { setFrases([]); setLivre(""); setHora(agoraHHMM()); } },
      )}>{acoes.registrar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Registrar anotação</Button>
    </section>
  );
}

/** Intercorrencia: fica aberta no painel do enfermeiro ate a ciencia com conduta. */
export function IntercorrenciaForm({ leitos, online }: { leitos: LeitoOpcao[]; online: boolean }) {
  const acoes = useAnotacoesAcoes();
  const [leito, setLeito] = useState(leitos[0]?.internacaoId ?? "");
  const [hora, setHora] = useState(agoraHHMM);
  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [conduta, setConduta] = useState("");
  const [medico, setMedico] = useState(false);
  const c = { tipo, descricao, condutaImediata: conduta, medicoComunicado: medico };
  const erros = validarIntercorrencia(c);
  const instante = instanteChecagem(hora, new Date());
  const ok = online && !!leito && !!instante && !futuro(instante) && erros.length === 0 && !acoes.registrar.isPending;
  return (
    <section className="space-y-4 rounded-lg border border-destructive/30 bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertOctagon className="h-4 w-4" /> A intercorrência aparece na hora no painel do enfermeiro do setor e fica aberta até ele registrar a ciência e a conduta. Em emergência, chame o enfermeiro antes de registrar.</p>
      <LeitoHora leitos={leitos} leito={leito} setLeito={setLeito} hora={hora} setHora={setHora} />
      <div className="w-80">
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger aria-label="Tipo de intercorrência"><SelectValue placeholder="Escolha" /></SelectTrigger>
          <SelectContent>{TIPOS_INTERCORRENCIA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label htmlFor="ic-desc">O que aconteceu</Label><Textarea id="ic-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
      <div><Label htmlFor="ic-cond">Conduta imediata</Label><Textarea id="ic-cond" rows={2} value={conduta} onChange={(e) => setConduta(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={medico} onCheckedChange={(v) => setMedico(v === true)} /> Médico plantonista comunicado</label>
      {tipo && descricao && <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">{montarIntercorrencia(c)}</div>}
      {futuro(instante) && <p className="text-xs text-destructive">A hora não pode estar no futuro.</p>}
      <Button variant="destructive" disabled={!ok} className="gap-2" onClick={() => instante && acoes.registrar.mutate(
        { internacaoId: leito, tipo: "intercorrencia", dataHora: instante, conteudo: c, texto: montarIntercorrencia(c) },
        { onSuccess: () => { setTipo(""); setDescricao(""); setConduta(""); setMedico(false); setHora(agoraHHMM()); } },
      )}>{acoes.registrar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertOctagon className="h-4 w-4" />} Registrar intercorrência</Button>
    </section>
  );
}
