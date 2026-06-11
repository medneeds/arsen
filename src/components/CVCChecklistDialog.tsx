/**
 * Diálogo — Checklist de Inserção de CVC (Bundle de Segurança)
 * Sistema ARSen · Hospital Municipal Djalma Marques (Socorrão I)
 *
 * - 15 passos do bundle com SIM / SIM (depois de lembrado) / NÃO
 * - Indicação clínica, via escolhida, kit de punção, auditoria
 * - Persiste em discharge_documents (document_type = "cvc_checklist")
 * - Gera PDF no layout institucional HMDM
 * - Vinculado ao registro de dispositivo CVC já existente
 */

import { useEffect, useState } from "react";
import { Printer, Save, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { supabase } from "@/integrations/supabase/client";
import { asUuidOrNull } from "@/lib/utils";
import { resolvePatientHeader, resolveCurrentBedSector } from "@/lib/resolvePatientHeader";
import { toast } from "sonner";
import { format } from "date-fns";
import { getSectorDisplayLabel } from "@/utils/bedNaming";

// ── Types ──────────────────────────────────────────────────────────────────

type BundleAnswer = "sim" | "sim_lembrado" | "nao" | null;

interface BundleStep {
  id: number;
  text: string;
}

// Os 15 passos do bundle conforme protocolo CCIH
const BUNDLE_STEPS: BundleStep[] = [
  { id: 1,  text: "Conferência do material necessário para o procedimento" },
  { id: 2,  text: "Retirada de adornos (anéis, pulseiras, relógio) pelo executante" },
  { id: 3,  text: "Uso de gorro e máscara pelo executante e assistente" },
  { id: 4,  text: "Higiene das mãos com água e sabão ou álcool gel" },
  { id: 5,  text: "Tricotomia do sítio de inserção (se necessário)" },
  { id: 6,  text: "Técnica asséptica rigorosa durante todo o procedimento" },
  { id: 7,  text: "Uso de EPI completo (avental estéril manga longa, luvas estéreis)" },
  { id: 8,  text: "Barreira máxima de proteção (campo duplo/fenestrado estéril)" },
  { id: 9,  text: "Degermação da pele com clorexidina alcoólica 0,5% ou PVPI" },
  { id: 10, text: "Preparação da pele em movimentos centrífugos — aguardar secagem" },
  { id: 11, text: "Inserção do cateter com técnica estéril" },
  { id: 12, text: "Conexão das extensões com técnica asséptica" },
  { id: 13, text: "Limpeza do sítio de inserção após o procedimento" },
  { id: 14, text: "Cobertura do sítio com curativo transparente estéril" },
  { id: 15, text: "Registro da data de inserção no curativo e no prontuário" },
];

type Indicacao = "sem_acesso" | "instabilidade" | "solucoes_perifericas" | "drogas_incompativeis";
type Via = "subclavia" | "jugular" | "femoral";
type Condicao = "emergencia" | "rotina";

const INDICACOES: { id: Indicacao; label: string }[] = [
  { id: "sem_acesso",          label: "Sem acesso venoso periférico viável" },
  { id: "instabilidade",       label: "Instabilidade hemodinâmica" },
  { id: "solucoes_perifericas",label: "Soluções não indicadas para via periférica" },
  { id: "drogas_incompativeis",label: "Drogas incompatíveis entre si (múltiplos lúmens)" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId?: string | null;
  patientName?: string;
  patientBed?: string;
  patientSector?: string;
  /** Data de inserção do CVC já registrada no dispositivo (pré-preenche o campo) */
  insertedAt?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CVCChecklistDialog({
  open, onOpenChange,
  patientId, patientName = "", patientBed = "", patientSector = "",
  insertedAt = "",
}: Props) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();

  const [resolvedName, setResolvedName] = useState(patientName);
  const [resolvedBed, setResolvedBed] = useState(patientBed);
  const [resolvedSector, setResolvedSector] = useState(patientSector);

  // Cabeçalho
  const [dataNascimento, setDataNascimento] = useState("");
  const [dataProcedimento, setDataProcedimento] = useState(
    () => insertedAt || format(new Date(), "yyyy-MM-dd")
  );

  // Flags iniciais
  const [admitidoComCVC, setAdmitidoComCVC] = useState(false);
  const [sinaisFlogisticos, setSinaisFlogisticos] = useState(false);
  const [trocadoCVC, setTrocadoCVC] = useState(false);
  const [iniciadoCVCAdmissao, setIniciadoCVCAdmissao] = useState(false);
  const [iniciadoCVC, setIniciadoCVC] = useState(false);
  const [obs, setObs] = useState("");

  // Indicação, condição e via
  const [indicacoes, setIndicacoes] = useState<Set<Indicacao>>(new Set());
  const [condicao, setCondicao] = useState<Condicao | null>(null);
  const [via, setVia] = useState<Via | null>(null);

  // Bundle (15 passos)
  const [answers, setAnswers] = useState<Record<number, BundleAnswer>>({});
  const [justificativa, setJustificativa] = useState("");

  // Auditoria
  const [executanteNome, setExecutanteNome] = useState("");
  const [executanteCRM, setExecutanteCRM] = useState("");
  const [auditorNome, setAuditorNome] = useState("");
  const [auditorCRM, setAuditorCRM] = useState("");

  const [saving, setSaving] = useState(false);

  // ── Resolve patient + doctor ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setResolvedName(patientName);
    setResolvedBed(patientBed);
    setResolvedSector(patientSector);
    if (insertedAt) setDataProcedimento(insertedAt);
    const validPid = asUuidOrNull(patientId);
    if (!validPid || !currentHospital?.id) return;
    resolvePatientHeader(validPid, patientName, currentHospital.id).then((h) => {
      if (h.name) setResolvedName(h.name);
    });
    resolveCurrentBedSector(validPid).then(({ bed, sector }) => {
      if (bed) setResolvedBed(bed);
      if (sector) setResolvedSector(sector);
    });
  }, [open, patientId, patientName, patientBed, patientSector, insertedAt, currentHospital?.id]);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase.from("profiles").select("full_name, crm").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.full_name) setExecutanteNome(data.full_name);
      if (data?.crm) setExecutanteCRM(data.crm);
    });
  }, [open, user?.id]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setAnswer = (id: number, val: BundleAnswer) =>
    setAnswers((prev) => ({ ...prev, [id]: prev[id] === val ? null : val }));

  const toggleIndicacao = (id: Indicacao) =>
    setIndicacoes((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Metrics
  const answered = BUNDLE_STEPS.filter((s) => answers[s.id] !== null && answers[s.id] !== undefined);
  const simCount = answered.filter((s) => answers[s.id] === "sim").length;
  const lembradoCount = answered.filter((s) => answers[s.id] === "sim_lembrado").length;
  const naoCount = answered.filter((s) => answers[s.id] === "nao").length;
  const pctAdesao = answered.length > 0 ? Math.round((simCount / answered.length) * 100) : 0;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!resolvedName.trim()) { toast.error("Nome do paciente não identificado"); return; }
    if (answered.length < BUNDLE_STEPS.length) {
      toast.warning(`${BUNDLE_STEPS.length - answered.length} etapa(s) do bundle sem resposta`);
    }
    if (!currentHospital?.id || !currentState?.id) { toast.error("Contexto hospitalar não disponível"); return; }
    setSaving(true);
    try {
      const content = {
        data_procedimento: dataProcedimento,
        data_nascimento: dataNascimento,
        flags: { admitidoComCVC, sinaisFlogisticos, trocadoCVC, iniciadoCVCAdmissao, iniciadoCVC, obs },
        indicacoes: Array.from(indicacoes),
        condicao, via,
        bundle: answers,
        justificativa,
        executante: { nome: executanteNome, crm: executanteCRM },
        auditor: { nome: auditorNome, crm: auditorCRM },
        metricas: { total: BUNDLE_STEPS.length, sim: simCount, sim_lembrado: lembradoCount, nao: naoCount, pct_adesao: pctAdesao },
      };
      const { error } = await supabase.from("discharge_documents").insert({
        document_type: "cvc_checklist",
        patient_id: asUuidOrNull(patientId),
        patient_name: resolvedName,
        patient_bed: resolvedBed || null,
        patient_sector: resolvedSector || null,
        content,
        signed_by: user?.id ?? null,
        signed_by_name: executanteNome || null,
        signed_by_crm: executanteCRM || null,
        signed_at: new Date().toISOString(),
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        department: "dispositivos",
      } as any);
      if (error) throw error;
      toast.success("Checklist CVC salvo");
      handlePrint();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!));
    const answerLabel = (a: BundleAnswer) =>
      a === "sim" ? "SIM" : a === "sim_lembrado" ? "SIM*" : a === "nao" ? "NÃO" : "—";
    const answerColor = (a: BundleAnswer) =>
      a === "sim" ? "#166534" : a === "sim_lembrado" ? "#854d0e" : a === "nao" ? "#991b1b" : "#6b7280";

    const bundleRows = BUNDLE_STEPS.map((s) => {
      const a = answers[s.id] ?? null;
      return `<tr>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8.5pt;">${s.id}.</td>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8.5pt;">${esc(s.text)}</td>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8.5pt;text-align:center;font-weight:bold;color:${a === "sim" ? "#166534" : "#6b7280"}">${a === "sim" ? "✓" : ""}</td>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8.5pt;text-align:center;font-weight:bold;color:${a === "sim_lembrado" ? "#854d0e" : "#6b7280"}">${a === "sim_lembrado" ? "✓" : ""}</td>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8.5pt;text-align:center;font-weight:bold;color:${a === "nao" ? "#991b1b" : "#6b7280"}">${a === "nao" ? "✗" : ""}</td>
      </tr>`;
    }).join("");

    const flagsAtivos = [
      admitidoComCVC && "Admitido com CVC",
      sinaisFlogisticos && "Sinais Flogísticos",
      trocadoCVC && "Trocado CVC",
      iniciadoCVCAdmissao && "Iniciado CVC na Admissão",
      iniciadoCVC && "Iniciado CVC",
    ].filter(Boolean).join(" · ") || "—";

    const dataFormatada = dataProcedimento
      ? format(new Date(dataProcedimento + "T00:00"), "dd/MM/yyyy")
      : format(new Date(), "dd/MM/yyyy");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Checklist CVC — ${esc(resolvedName)}</title>
<style>
@page{size:A4 portrait;margin:10mm 12mm;}
body{font-family:Arial,sans-serif;font-size:9.5pt;color:#000;margin:0;}
.header{text-align:center;border-bottom:2px solid #000;padding-bottom:5px;margin-bottom:8px;}
.header h1{font-size:12pt;font-weight:bold;margin:0 0 2px 0;text-transform:uppercase;}
.header h2{font-size:9pt;font-weight:normal;margin:0;}
.header h3{font-size:10pt;font-weight:bold;margin:3px 0 0 0;text-transform:uppercase;letter-spacing:.8px;}
.st{font-size:8.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;background:#e8e8e8;padding:2px 5px;margin:7px 0 3px 0;border-left:3px solid #333;}
.fr{display:flex;gap:10px;margin-bottom:4px;}
.f{flex:1;}
.f label{font-size:7.5pt;font-weight:bold;display:block;margin-bottom:1px;color:#444;}
.f span{font-size:9pt;border-bottom:1px solid #999;display:block;min-height:14px;}
.flags{font-size:8.5pt;padding:3px 5px;background:#f5f5f5;border:1px solid #ddd;margin-bottom:5px;}
table{width:100%;border-collapse:collapse;margin-bottom:6px;}
th{background:#e8e8e8;font-size:8.5pt;font-weight:bold;padding:3px 5px;border:1px solid #ccc;}
.metrics{display:flex;gap:8px;margin-bottom:6px;font-size:8pt;}
.met{padding:3px 8px;border-radius:3px;font-weight:bold;}
.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}
.ab{border:1px solid #999;padding:5px;}
.ab label{font-size:7.5pt;font-weight:bold;display:block;margin-bottom:18px;}
.al{border-top:1px solid #000;font-size:7.5pt;padding-top:2px;text-align:center;}
.rodape{margin-top:10px;border-top:1px solid #ccc;padding-top:3px;font-size:7.5pt;color:#666;text-align:center;}
.nota{font-size:7.5pt;color:#555;font-style:italic;margin-top:3px;}
</style></head><body>
<div class="header">
<h2>PREFEITURA MUNICIPAL DE SÃO LUÍS — SECRETARIA MUNICIPAL DE SAÚDE</h2>
<h1>Hospital Municipal Djalma Marques — Socorrão I</h1>
<h3>Checklist de Inserção de CVC — Bundle de Segurança</h3>
</div>
<div class="st">Identificação do Paciente</div>
<div class="fr">
<div class="f"><label>Nome</label><span>${esc(resolvedName)}</span></div>
<div class="f" style="max-width:130px;"><label>Data de Nascimento</label><span>${esc(dataNascimento || "—")}</span></div>
<div class="f" style="max-width:130px;"><label>Data do Procedimento</label><span>${esc(dataFormatada)}</span></div>
</div>
<div class="fr">
<div class="f" style="max-width:100px;"><label>Leito</label><span>${esc(resolvedBed || "—")}</span></div>
<div class="f" style="max-width:160px;"><label>Setor</label><span>${esc(getSectorDisplayLabel(resolvedSector) || resolvedSector || "—")}</span></div>
<div class="f"><label>Flags</label><span style="font-size:8pt;">${esc(flagsAtivos)}</span></div>
</div>
${obs ? `<div class="flags"><strong>OBS:</strong> ${esc(obs)}</div>` : ""}

<div class="st">Indicação do CVC</div>
<div style="margin-bottom:5px;font-size:8.5pt;">
${INDICACOES.map((i) => `<span style="margin-right:12px;">${indicacoes.has(i.id) ? "☑" : "☐"} ${esc(i.label)}</span>`).join(" ")}
</div>
<div style="font-size:8.5pt;margin-bottom:5px;">
<strong>Condição:</strong>
<span style="margin-right:12px;">${condicao === "emergencia" ? "☑" : "☐"} Emergência</span>
<span style="margin-right:12px;">${condicao === "rotina" ? "☑" : "☐"} Rotina</span>
&nbsp;&nbsp;&nbsp;<strong>Via escolhida:</strong>
<span style="margin-right:12px;">${via === "subclavia" ? "☑" : "☐"} 1ª Subclávia (preferencial)</span>
<span style="margin-right:12px;">${via === "jugular" ? "☑" : "☐"} 2ª Jugular</span>
<span>${via === "femoral" ? "☑" : "☐"} 3ª Femoral</span>
</div>

<div class="st">Etapas do Bundle (15 Passos)</div>
<div class="metrics">
<span class="met" style="background:#dcfce7;color:#166534;">SIM: ${simCount}</span>
<span class="met" style="background:#fef9c3;color:#854d0e;">SIM* (lembrado): ${lembradoCount}</span>
<span class="met" style="background:#fee2e2;color:#991b1b;">NÃO: ${naoCount}</span>
<span class="met" style="background:#f3f4f6;color:#374151;">Adesão espontânea: ${pctAdesao}%</span>
</div>
<table>
<thead><tr>
<th style="width:24px;">#</th>
<th>Etapa do Bundle</th>
<th style="width:40px;text-align:center;">SIM</th>
<th style="width:55px;text-align:center;">SIM*</th>
<th style="width:40px;text-align:center;">NÃO</th>
</tr></thead>
<tbody>${bundleRows}</tbody>
</table>
<p class="nota">* SIM (depois de lembrado) — etapa realizada somente após orientação do Auditor do Bundle</p>
${justificativa ? `<div class="st">Justificativa de Não Cumprimento</div><div style="border:1px solid #999;min-height:30px;padding:4px 5px;font-size:8.5pt;margin-bottom:5px;">${esc(justificativa)}</div>` : ""}

<div class="assinaturas">
<div class="ab"><label>Executante</label><div class="al">${esc(executanteNome)}${executanteCRM ? ` · CRM ${esc(executanteCRM)}` : ""}</div></div>
<div class="ab"><label>Auditor do Bundle</label><div class="al">${esc(auditorNome)}${auditorCRM ? ` · CRM ${esc(auditorCRM)}` : ""}&nbsp;</div></div>
</div>
<div class="rodape">
CCIH — Protocolo de Prevenção de IPCS (Infecção Primária de Corrente Sanguínea)<br/>
Gerado pelo sistema ARSen em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
</div>
</body></html>`;

    const win = window.open("", "_blank", "width=800,height=950");
    if (!win) { toast.error("Popup bloqueado — permita pop-ups para imprimir"); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const AnswerBtn = ({ stepId, value, label, color }: { stepId: number; value: BundleAnswer; label: string; color: string }) => (
    <button
      type="button"
      onClick={() => setAnswer(stepId, value)}
      className={cn(
        "px-2.5 py-1 rounded text-[11px] font-bold border transition-all",
        answers[stepId] === value
          ? `${color} text-white border-transparent`
          : "bg-background border-border text-muted-foreground hover:border-primary/50"
      )}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Checklist CVC — Bundle de Inserção
          </DialogTitle>
          <DialogDescription className="text-xs">
            Protocolo CCIH de prevenção de IPCS · {resolvedName || "Paciente não identificado"}
            {resolvedBed && ` · Leito ${resolvedBed}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-5 py-4">

            {/* ── Cabeçalho ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data de Nascimento</Label>
                  <Input value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} placeholder="DD/MM/AAAA" className="mt-1 font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Data do Procedimento</Label>
                  <Input type="date" value={dataProcedimento} onChange={(e) => setDataProcedimento(e.target.value)} className="mt-1" />
                </div>
              </div>
              {/* Flags */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "admitidoComCVC",     label: "Admitido com CVC",       val: admitidoComCVC,     set: setAdmitidoComCVC },
                  { key: "sinaisFlogisticos",   label: "Sinais Flogísticos",     val: sinaisFlogisticos,  set: setSinaisFlogisticos },
                  { key: "trocadoCVC",          label: "Trocado CVC",            val: trocadoCVC,         set: setTrocadoCVC },
                  { key: "iniciadoCVCAdmissao", label: "Iniciado CVC Admissão",  val: iniciadoCVCAdmissao,set: setIniciadoCVCAdmissao },
                  { key: "iniciadoCVC",         label: "Iniciado CVC",           val: iniciadoCVC,        set: setIniciadoCVC },
                ].map((f) => (
                  <button key={f.key} type="button" onClick={() => f.set(!f.val)}
                    className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                      f.val ? "bg-blue-600 text-white border-transparent" : "border-border text-muted-foreground bg-background hover:border-primary/50")}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-xs">OBS</Label>
                <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações gerais..." className="mt-1 text-xs" />
              </div>
            </div>

            <Separator />

            {/* ── Indicação ── */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Indicação</h3>
              <div className="space-y-1.5">
                {INDICACOES.map((i) => (
                  <button key={i.id} type="button" onClick={() => toggleIndicacao(i.id)}
                    className={cn("w-full text-left px-3 py-2 rounded-lg text-xs border transition-all flex items-center gap-2",
                      indicacoes.has(i.id) ? "bg-blue-600/10 border-blue-400 text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40")}>
                    <span className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0 text-[10px] font-bold",
                      indicacoes.has(i.id) ? "bg-blue-600 border-blue-600 text-white" : "border-border")}>
                      {indicacoes.has(i.id) ? "✓" : ""}
                    </span>
                    {i.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Condição de Realização</Label>
                  <div className="flex gap-2">
                    {(["emergencia", "rotina"] as Condicao[]).map((c) => (
                      <button key={c} type="button" onClick={() => setCondicao(condicao === c ? null : c)}
                        className={cn("flex-1 py-1.5 rounded text-xs font-medium border transition-all",
                          condicao === c ? "bg-blue-600 text-white border-transparent" : "border-border text-muted-foreground hover:border-primary/50")}>
                        {c === "emergencia" ? "Emergência" : "Rotina"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Via Escolhida</Label>
                  <div className="flex gap-1.5">
                    {([["subclavia","1ª Subclávia"],["jugular","2ª Jugular"],["femoral","3ª Femoral"]] as [Via, string][]).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setVia(via === v ? null : v)}
                        className={cn("flex-1 py-1.5 rounded text-[10px] font-medium border transition-all",
                          via === v ? "bg-blue-600 text-white border-transparent" : "border-border text-muted-foreground hover:border-primary/50")}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Bundle (15 passos) ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Etapas do Bundle</h3>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] border-green-400 text-green-700 bg-green-50 dark:bg-green-500/10">SIM {simCount}</Badge>
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-500/10">SIM* {lembradoCount}</Badge>
                  <Badge variant="outline" className="text-[10px] border-red-400 text-red-700 bg-red-50 dark:bg-red-500/10">NÃO {naoCount}</Badge>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                <span className="font-semibold">SIM*</span> = realizado somente após lembrado pelo auditor — captura adesão real ao protocolo
              </p>
              <div className="divide-y border rounded-lg overflow-hidden">
                {BUNDLE_STEPS.map((step) => (
                  <div key={step.id} className={cn("flex items-center gap-3 px-3 py-2 text-xs transition-colors",
                    answers[step.id] === "sim" ? "bg-green-50 dark:bg-green-500/5" :
                    answers[step.id] === "sim_lembrado" ? "bg-amber-50 dark:bg-amber-500/5" :
                    answers[step.id] === "nao" ? "bg-red-50 dark:bg-red-500/5" : "bg-background")}>
                    <span className="text-muted-foreground font-mono w-5 shrink-0">{step.id}.</span>
                    <span className="flex-1 text-foreground">{step.text}</span>
                    <div className="flex gap-1 shrink-0">
                      <AnswerBtn stepId={step.id} value="sim" label="SIM" color="bg-green-600" />
                      <AnswerBtn stepId={step.id} value="sim_lembrado" label="SIM*" color="bg-amber-500" />
                      <AnswerBtn stepId={step.id} value="nao" label="NÃO" color="bg-red-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Justificativa de NÃO */}
            {naoCount > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-red-700">Justificativa de Não Cumprimento</Label>
                <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Citar item e justificativa para cada etapa não cumprida..." className="text-xs min-h-[64px] resize-none border-red-200" />
              </div>
            )}

            <Separator />

            {/* ── Auditoria ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auditoria</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Executante</Label>
                  <Input value={executanteNome} onChange={(e) => setExecutanteNome(e.target.value)} placeholder="Nome completo" className="mt-1 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">CRM do Executante</Label>
                  <Input value={executanteCRM} onChange={(e) => setExecutanteCRM(e.target.value)} placeholder="CRM" className="mt-1 text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Auditor do Bundle</Label>
                  <Input value={auditorNome} onChange={(e) => setAuditorNome(e.target.value)} placeholder="Nome completo" className="mt-1 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">CRM do Auditor</Label>
                  <Input value={auditorCRM} onChange={(e) => setAuditorCRM(e.target.value)} placeholder="CRM" className="mt-1 text-xs font-mono" />
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t gap-2">
          <div className="flex-1 text-xs text-muted-foreground">
            {answered.length}/{BUNDLE_STEPS.length} etapas respondidas · Adesão espontânea: <strong>{pctAdesao}%</strong>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" /> Pré-visualizar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar e Imprimir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
