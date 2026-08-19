import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileSignature, ClipboardList, FileCheck2, Pill, PillBottle, ShieldCheck, ArrowLeft, Printer, Plus, Trash2,
} from "lucide-react";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import { usePatientLive } from "@/hooks/usePatientLive";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { usePatientCid } from "@/hooks/usePatientCid";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { useReceituario } from "@/hooks/useReceituario";
import { printReceituario, type ReceituarioType } from "@/lib/receituario";
import type { ReceituarioItem } from "@/lib/receituario";
import { useDocumentoMedico, type DocumentoMedicoType } from "@/hooks/useDocumentoMedico";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type DocKind = "atestado" | "relatorio" | "termo" | "receituario" | "receituario_especial";

const RECEITUARIO_HISTORY_LABEL: Record<string, string> = {
  alta: "Receituário de Alta",
  ambulatorial: "Receituário Ambulatorial",
  simples: "Receituário Simples",
  controle_especial: "Receituário de Controle Especial",
};

const DOC_MEDICO_HISTORY_LABEL: Record<string, string> = {
  atestado: "Atestado Médico",
  relatorio: "Relatório Médico",
  termo: "Termo / Declaração",
};

const TEMPLATES: Array<{
  kind: DocKind;
  label: string;
  desc: string;
  icon: React.ElementType;
  tone: string;
  bg: string;
  prefix: string;
}> = [
  { kind: "atestado",            label: "Atestado médico",                  desc: "Afastamento, comparecimento, repouso",     icon: FileSignature, tone: "text-blue-600",    bg: "bg-blue-500/10",    prefix: "ATEST" },
  { kind: "relatorio",           label: "Relatório médico",                 desc: "Quadro clínico, evolução, conclusão",       icon: ClipboardList, tone: "text-violet-600",  bg: "bg-violet-500/10",  prefix: "RELAT" },
  { kind: "termo",               label: "Termo / declaração",               desc: "Consentimento, responsabilidade, recusa",   icon: FileCheck2,    tone: "text-amber-600",   bg: "bg-amber-500/10",   prefix: "TERMO" },
  { kind: "receituario",         label: "Receituário simples",              desc: "Prescrição ambulatorial / pós-alta",         icon: Pill,          tone: "text-emerald-600", bg: "bg-emerald-500/10", prefix: "RECEIT" },
  { kind: "receituario_especial",label: "Receituário de controle especial", desc: "Portaria 344/98 — listas C1, C2, C5 (2 vias)", icon: PillBottle,    tone: "text-rose-600",    bg: "bg-rose-500/10",    prefix: "RECCE" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string | null;
  patientName: string;
  patientBed?: string;
  patientSector?: string;
  hospitalName?: string;
  /** Abre o Checklist de CVC (diálogo próprio) a partir deste fluxo. */
  onOpenCvc?: () => void;
}

interface RxItem { name: string; dose: string; route: string; freq: string; duration: string; }

export function MedicalDocumentDialog({
  open, onOpenChange, patientId, patientName, patientBed, patientSector, hospitalName,
  onOpenCvc,
}: Props) {
  const doctor = useCurrentDoctor();
  const { patient } = usePatientLive(patientId);
  const { cidPrimary } = usePatientCid(patientId);
  const { receituarios, save: saveReceituario } = useReceituario(patientId, patientName);
  const { documentos, save: saveDocumentoMedico } = useDocumentoMedico(patientId, patientName);

  const [kind, setKind] = useState<DocKind | null>(null);

  // shared
  const [body, setBody] = useState("");
  // atestado
  const [days, setDays] = useState("");
  const [includeCid, setIncludeCid] = useState(true);
  // receituario
  const [rx, setRx] = useState<RxItem[]>([{ name: "", dose: "", route: "VO", freq: "", duration: "" }]);

  const reset = () => {
    setKind(null); setBody(""); setDays(""); setIncludeCid(true);
    setRx([{ name: "", dose: "", route: "VO", freq: "", duration: "" }]);
  };

  const close = () => { reset(); onOpenChange(false); };

  const tpl = useMemo(() => TEMPLATES.find((t) => t.kind === kind), [kind]);

  const defaultBody = (k: DocKind): string => {
    const nm = (patientName || "").toUpperCase();
    switch (k) {
      case "atestado":
        return `Atesto, para os devidos fins, que o(a) paciente ${nm} esteve sob meus cuidados nesta data, necessitando de afastamento de suas atividades habituais por ___ (____) dias a partir desta data.`;
      case "relatorio":
        return `Paciente ${nm}${patient?.age ? `, ${patient.age}` : ""}, encontra-se sob assistência nesta unidade.\n\nDIAGNÓSTICO:\n${cidPrimary ? `• ${cidPrimary}` : "• "}\n\nQUADRO CLÍNICO:\n• \n\nCONDUTA / EVOLUÇÃO:\n• \n\nCONCLUSÃO:\n• `;
      case "termo":
        return `Eu, _____________________________________, portador(a) do RG nº __________________, responsável legal pelo(a) paciente ${nm}, declaro estar ciente das informações prestadas pela equipe assistencial e ____________________________________________________________________.`;
      case "receituario":
      case "receituario_especial":
        return ""; // handled separately
    }
  };

  const isRx = kind === "receituario" || kind === "receituario_especial";
  const displaySector = getSectorDisplayLabel(patientSector);

  const startEdit = (k: DocKind) => {
    setKind(k);
    setBody(defaultBody(k));
  };

  const buildBodyHtml = (): string => {
    if (!tpl) return "";
    const esc = (s: string) =>
      (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

    const patientLine = `
      <div style="border:1px solid #cbd5e1;border-radius:4pt;padding:6pt 10pt;margin-bottom:10pt;font-size:9pt;background:#f8fafc">
        <div><b>PACIENTE:</b> ${esc((patientName || "").toUpperCase())}</div>
        ${patient?.age ? `<div><b>IDADE:</b> ${esc(String(patient.age))}</div>` : ""}
        ${patientBed ? `<div><b>LEITO:</b> ${esc(patientBed)} ${displaySector ? `• ${esc(displaySector)}` : ""}</div>` : ""}
        ${includeCid && cidPrimary ? `<div><b>CID-10:</b> ${esc(cidPrimary)}</div>` : ""}
      </div>`;

    if (isRx) {
      const rows = rx.filter((r) => r.name.trim()).map((r, i) => `
        <tr>
          <td class="nz-c">${i + 1}</td>
          <td><b>${esc(r.name)}</b>${r.dose ? ` — ${esc(r.dose)}` : ""}</td>
          <td>${esc(r.route)}</td>
          <td>${esc(r.freq)}</td>
          <td>${esc(r.duration)}</td>
        </tr>`).join("");
      const especialNote = kind === "receituario_especial"
        ? `<div style="margin-top:8pt;padding:6pt 8pt;border:1px dashed #be123c;border-radius:4pt;font-size:8.5pt;color:#9f1239;background:#fff1f2">
             <b>Receituário de Controle Especial</b> — Portaria SVS/MS nº 344/1998. Validade: 30 dias a partir da data de emissão. Emitido em 2 (duas) vias: 1ª via retida pela farmácia, 2ª via do paciente.
           </div>` : "";
      return `${patientLine}
        <table class="nz">
          <thead><tr>
            <th style="width:24pt">#</th><th>Medicamento / Dose</th><th>Via</th><th>Posologia</th><th>Duração</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="nz-empty">Sem itens</td></tr>`}</tbody>
        </table>
        ${body ? `<div style="margin-top:10pt;font-size:9pt;white-space:pre-wrap">${esc(body)}</div>` : ""}
        ${especialNote}
      `;
    }

    return `${patientLine}
      <div style="font-size:10pt;line-height:1.55;text-align:justify;white-space:pre-wrap;padding:4pt 2pt">${esc(body)}</div>
    `;
  };

  const handlePrint = async () => {
    if (!tpl) return;

    // Receituário (simples ou de controle especial): grava PRIMEIRO — mesmo
    // furo de rastreabilidade já corrigido em Hemocomponente/SAT/Procedimento,
    // só que aqui nem existia tabela até esta correção. Se salvar falhar,
    // nada é impresso.
    if (isRx) {
      const validItems = rx.filter((r) => r.name.trim());
      if (validItems.length === 0) {
        toast.error("Adicione pelo menos um medicamento antes de imprimir");
        return;
      }
      const items: ReceituarioItem[] = validItems.map((r) => ({
        id: crypto.randomUUID(),
        name: r.name,
        dose: r.dose,
        route: r.route,
        frequency: r.freq,
        duration: r.duration,
      }));
      const receituarioType: ReceituarioType = kind === "receituario_especial" ? "controle_especial" : "simples";
      const savedId = await saveReceituario({
        type: receituarioType,
        patient_id: patientId ?? null,
        patient_name: patientName,
        patient_bed: patientBed,
        patient_sector: patientSector,
        items,
        free_text: body || undefined,
        signed_by_name: doctor.fullName || undefined,
        signed_by_crm: doctor.crm || undefined,
      });
      if (!savedId) return;
    }

    // Atestado / Relatório / Termo: mesmo princípio — grava PRIMEIRO. Antes
    // desta correção esses 3 tipos não tinham nem tabela: só geravam HTML e
    // mandavam pra impressão, sem nenhum rastro no sistema.
    if (!isRx) {
      if (!body.trim()) {
        toast.error("Preencha o conteúdo do documento antes de imprimir");
        return;
      }
      const savedId = await saveDocumentoMedico({
        type: kind as DocumentoMedicoType,
        patient_id: patientId ?? null,
        patient_name: patientName,
        patient_bed: patientBed,
        patient_sector: patientSector,
        body,
        days: kind === "atestado" && days ? Number(days) : null,
        cid: kind === "relatorio" && includeCid ? (cidPrimary || null) : null,
        signed_by_name: doctor.fullName || undefined,
        signed_by_crm: doctor.crm || undefined,
      });
      if (!savedId) return;
    }

    const logo = await prepareLogo();
    const subtitle =
      kind === "atestado" && days ? `Afastamento de ${days} dia(s)` :
      kind === "receituario_especial" ? "Portaria SVS/MS nº 344/1998 — 2 vias" : undefined;

    const baseBody = buildBodyHtml();
    const bodyHtml = kind === "receituario_especial"
      ? `<div style="border-bottom:2px dashed #94a3b8;padding-bottom:8pt;margin-bottom:8pt"><div style="font-size:8pt;color:#64748b;margin-bottom:4pt"><b>1ª VIA — FARMÁCIA</b></div>${baseBody}</div>
         <div style="page-break-before:always"></div>
         <div><div style="font-size:8pt;color:#64748b;margin-bottom:4pt"><b>2ª VIA — PACIENTE</b></div>${baseBody}</div>`
      : baseBody;

    const html = buildNormaZeroDocument({
      title: tpl.label,
      subtitle,
      sectorLabel: displaySector ? `Assistência — ${displaySector}` : "Assistência Médica",
      hospitalName,
      docCodePrefix: tpl.prefix,
      bodyHtml,
      signatures: [
        {
          label: doctor.fullName ? doctor.fullName.toUpperCase() : "MÉDICO ASSISTENTE",
          caption: [doctor.crm && `CRM ${doctor.crm}`, doctor.specialty].filter(Boolean).join(" • ") || "Carimbo e assinatura",
        },
      ],
      logoDataUrl: logo,
    });
    openPrintWindow(html, "Preparando documento…");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 normal-case">
            {kind && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setKind(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {kind ? tpl?.label : "Emitir documento"}
          </DialogTitle>
          <DialogDescription className="normal-case">
            {kind
              ? `Para ${(patientName || "").toUpperCase()}${patientBed ? ` • leito ${patientBed}` : ""}`
              : "Selecione o tipo de documento a ser emitido"}
          </DialogDescription>
        </DialogHeader>

        {!kind && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => startEdit(t.kind)}
                  className="group flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-muted/40 hover:border-primary/40 transition-all text-left"
                >
                  <div className={`p-2 rounded-lg ${t.bg}`}>
                    <Icon className={`h-5 w-5 ${t.tone}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground normal-case">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 normal-case">{t.desc}</p>
                  </div>
                </button>
              );
            })}
            {/* Checklist de CVC — incorporado ao fluxo de documentos; abre o diálogo próprio */}
            {onOpenCvc && (
              <button
                type="button"
                onClick={() => { onOpenChange(false); onOpenCvc(); }}
                className="group flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-muted/40 hover:border-primary/40 transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <ShieldCheck className="h-5 w-5 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground normal-case">Checklist de CVC</p>
                  <p className="text-xs text-muted-foreground mt-0.5 normal-case">Bundle de inserção · prevenção de IPCS (CCIH)</p>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Histórico — combina receituários e documentos (atestado/relatório/
            termo) já emitidos para este paciente, com reimpressão. Aparece
            só na tela de seleção de tipo (mesmo componente usado no Cockpit
            e em Documentos do Paciente — cobre os 2 lugares de uma vez). */}
        {!kind && (receituarios.length > 0 || documentos.length > 0) && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
              Histórico ({receituarios.length + documentos.length})
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {[
                ...receituarios.map((r) => ({
                  key: `rx-${r.id}`,
                  label: RECEITUARIO_HISTORY_LABEL[r.type] || "Receituário",
                  detail: Array.isArray(r.items) && r.items.length > 0
                    ? `${r.items.length} ${r.items.length === 1 ? "item" : "itens"}`
                    : undefined,
                  createdAt: r.created_at,
                  authorName: r.signed_by_name,
                  onPrint: () => printReceituario(r, hospitalName),
                })),
                ...documentos.map((d) => ({
                  key: `doc-${d.id}`,
                  label: DOC_MEDICO_HISTORY_LABEL[d.type] || "Documento",
                  detail: undefined,
                  createdAt: d.created_at,
                  authorName: d.signed_by_name,
                  onPrint: () => printDocumentoMedico(d, {
                    hospitalName,
                    doctorName: doctor.fullName,
                    doctorCrm: doctor.crm,
                    doctorSpecialty: doctor.specialty,
                  }),
                })),
              ]
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background/80 border border-border/40 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground/90 truncate normal-case">
                        {item.label}
                        {item.detail && <span className="text-muted-foreground font-normal"> · {item.detail}</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground normal-case">
                        {item.createdAt ? format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ""}
                        {item.authorName ? ` · ${item.authorName}` : ""}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      title="Reimprimir"
                      onClick={item.onPrint}
                    >
                      <Printer className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {kind && (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-4">
              {/* Patient summary */}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-0.5">
                <div><b className="text-foreground">PACIENTE:</b> {(patientName || "").toUpperCase()}</div>
                {patient?.age && <div><b className="text-foreground">IDADE:</b> {patient.age}</div>}
                {patientBed && <div><b className="text-foreground">LEITO:</b> {patientBed} {displaySector && `• ${displaySector}`}</div>}
                {cidPrimary && (
                  <div className="flex items-center gap-2">
                    <b className="text-foreground">CID-10:</b> {cidPrimary}
                    <label className="flex items-center gap-1 ml-auto cursor-pointer">
                      <input type="checkbox" checked={includeCid} onChange={(e) => setIncludeCid(e.target.checked)} />
                      <span>incluir no documento</span>
                    </label>
                  </div>
                )}
              </div>

              {kind === "atestado" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Dias de afastamento</Label>
                    <Input value={days} onChange={(e) => setDays(e.target.value)} placeholder="Ex: 3" className="h-9 mt-1" />
                  </div>
                </div>
              )}

              {isRx ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Itens do receituário</Label>
                    <Button
                      type="button" size="sm" variant="ghost"
                      onClick={() => setRx([...rx, { name: "", dose: "", route: "VO", freq: "", duration: "" }])}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {rx.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border/60 p-2.5 space-y-2 bg-card/40">
                      <div className="flex gap-2">
                        <Input
                          value={r.name}
                          onChange={(e) => { const c = [...rx]; c[i].name = e.target.value; setRx(c); }}
                          placeholder="Medicamento" className="h-8 text-sm"
                        />
                        <Input
                          value={r.dose}
                          onChange={(e) => { const c = [...rx]; c[i].dose = e.target.value; setRx(c); }}
                          placeholder="Dose (ex: 500mg)" className="h-8 text-sm w-40"
                        />
                        <Button
                          type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                          onClick={() => setRx(rx.filter((_, j) => j !== i))}
                          disabled={rx.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={r.route}
                          onChange={(e) => { const c = [...rx]; c[i].route = e.target.value; setRx(c); }}
                          placeholder="Via" className="h-8 text-sm"
                        />
                        <Input
                          value={r.freq}
                          onChange={(e) => { const c = [...rx]; c[i].freq = e.target.value; setRx(c); }}
                          placeholder="Posologia (ex: 8/8h)" className="h-8 text-sm"
                        />
                        <Input
                          value={r.duration}
                          onChange={(e) => { const c = [...rx]; c[i].duration = e.target.value; setRx(c); }}
                          placeholder="Duração (ex: 7 dias)" className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                  <Label className="text-xs mt-2 block">Observações (opcional)</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Orientações, retorno..." />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Corpo do documento</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={kind === "relatorio" ? 12 : 7}
                    className="mt-1 font-mono text-sm leading-relaxed"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    O texto será renderizado no padrão Norma Zero, com cabeçalho institucional e assinatura do médico logado.
                  </p>
                </div>
              )}

              {/* Signing doctor */}
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-2.5 text-xs flex items-center justify-between">
                <div>
                  <b className="text-foreground">Assinatura: </b>
                  {doctor.fullName ? doctor.fullName.toUpperCase() : <span className="text-destructive">médico não identificado</span>}
                </div>
                {doctor.crm && <Badge variant="outline" className="text-[10px]">CRM {doctor.crm}</Badge>}
              </div>
            </div>
          </ScrollArea>
        )}

        {kind && (
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Cancelar</Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Gerar e imprimir
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
