/**
 * Diálogo — Registro de OPME (Órtese, Prótese e Material Especial)
 * Sistema ARSen · Hospital Municipal Djalma Marques (Socorrão I)
 *
 * - Formulário digital espelhando o documento físico oficial
 * - Tabela dinâmica de materiais (Descrição · Qtd · Lote)
 * - Bloco estruturado de rastreabilidade por material (Referência · Lote · Fabricação · Validade · ANVISA)
 * - Identificação do paciente herdada do atendimento (sem redigitação)
 * - Persiste em discharge_documents (document_type = "opme")
 * - Gera PDF no layout institucional HMDM / Prefeitura de São Luís
 */

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Printer, Save, Package } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { supabase } from "@/integrations/supabase/client";
import { asUuidOrNull } from "@/lib/utils";
import { resolvePatientHeader } from "@/lib/resolvePatientHeader";
import { toast } from "sonner";
import { format } from "date-fns";
import { getSectorDisplayLabel } from "@/utils/bedNaming";

// ── Types ──────────────────────────────────────────────────────────────────

interface OPMEMaterial {
  id: string;
  descricao: string;
  quantidade: string;
  lote: string;
  referencia: string;
  fabricacao: string;
  validade: string;
  registro_anvisa: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId?: string | null;
  patientName?: string;
  patientBed?: string;
  patientSector?: string;
  /** Cirurgia/procedimento de origem, pré-preenchida quando chamado do fluxo de Procedimento */
  procedureLabel?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function newMaterial(): OPMEMaterial {
  return {
    id: crypto.randomUUID(),
    descricao: "",
    quantidade: "1",
    lote: "",
    referencia: "",
    fabricacao: "",
    validade: "",
    registro_anvisa: "",
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export function OPMEDialog({
  open, onOpenChange,
  patientId, patientName = "", patientBed = "", patientSector = "",
  procedureLabel = "",
}: Props) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();

  const [resolvedName, setResolvedName] = useState(patientName);
  const [resolvedBed, setResolvedBed] = useState(patientBed);
  const [resolvedSector, setResolvedSector] = useState(patientSector);

  const [cirurgia, setCirurgia] = useState(procedureLabel);
  const [cirurgiao, setCirurgiao] = useState("");
  const [instrumentador, setInstrumentador] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [dataHora, setDataHora] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const [materiais, setMateriais] = useState<OPMEMaterial[]>([newMaterial()]);
  const [intercorrencias, setIntercorrencias] = useState("");

  const [doctorName, setDoctorName] = useState("");
  const [doctorCRM, setDoctorCRM] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResolvedName(patientName);
    setResolvedBed(patientBed);
    setResolvedSector(patientSector);
    setCirurgia(procedureLabel);
    const validPid = asUuidOrNull(patientId);
    if (!validPid || !currentHospital?.id) return;
    resolvePatientHeader(validPid, patientName, currentHospital.id).then((h) => {
      if (h.name) setResolvedName(h.name);
    });
    resolveCurrentBedSector(validPid).then(({ bed, sector }) => {
      if (bed) setResolvedBed(bed);
      if (sector) setResolvedSector(sector);
    });
  }, [open, patientId, patientName, patientBed, patientSector, procedureLabel, currentHospital?.id]);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase.from("profiles").select("full_name, crm").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.full_name) setDoctorName(data.full_name);
      if (data?.crm) setDoctorCRM(data.crm);
    });
  }, [open, user?.id]);

  const addMaterial = () => setMateriais((prev) => [...prev, newMaterial()]);
  const removeMaterial = (id: string) =>
    setMateriais((prev) => prev.length > 1 ? prev.filter((m) => m.id !== id) : prev);
  const updateMaterial = useCallback((id: string, field: keyof OPMEMaterial, value: string) => {
    setMateriais((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  }, []);

  const handleSave = async () => {
    if (!resolvedName.trim()) { toast.error("Nome do paciente não identificado"); return; }
    if (materiais.every((m) => !m.descricao.trim())) { toast.error("Adicione ao menos um material"); return; }
    if (!currentHospital?.id || !currentState?.id) { toast.error("Contexto hospitalar não disponível"); return; }
    setSaving(true);
    try {
      const content = {
        cirurgia, cirurgiao, instrumentador, empresa,
        data_hora: dataHora,
        materiais: materiais.filter((m) => m.descricao.trim()),
        intercorrencias,
        medico_responsavel: doctorName,
        medico_crm: doctorCRM,
      };
      const { error } = await supabase.from("discharge_documents").insert({
        document_type: "opme",
        patient_id: asUuidOrNull(patientId),
        patient_name: resolvedName,
        patient_bed: resolvedBed || null,
        patient_sector: resolvedSector || null,
        content,
        signed_by: user?.id ?? null,
        signed_by_name: doctorName || null,
        signed_by_crm: doctorCRM || null,
        signed_at: new Date().toISOString(),
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        department: "procedimento",
      } as any);
      if (error) throw error;
      toast.success("Registro de OPME salvo");
      handlePrint();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const validMateriais = materiais.filter((m) => m.descricao.trim());
    const dataFormatada = dataHora ? format(new Date(dataHora), "dd/MM/yyyy HH:mm") : format(new Date(), "dd/MM/yyyy HH:mm");

    const materiaisRows = validMateriais.map((m, i) => `
      <tr>
        <td style="padding:4px 6px;border:1px solid #000;font-size:9pt;">${i + 1}</td>
        <td style="padding:4px 6px;border:1px solid #000;font-size:9pt;">${m.descricao}</td>
        <td style="padding:4px 6px;border:1px solid #000;font-size:9pt;text-align:center;">${m.quantidade}</td>
        <td style="padding:4px 6px;border:1px solid #000;font-size:9pt;">${m.lote}</td>
      </tr>`).join("");

    const rastreabilidadeBlocks = validMateriais.map((m, i) => `
      <div style="margin-bottom:8px;padding:6px;border:1px solid #ccc;border-radius:4px;">
        <strong style="font-size:9pt;">${i + 1}. ${m.descricao}</strong>
        <table style="width:100%;margin-top:4px;border-collapse:collapse;">
          <tr>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;background:#f5f5f5;width:25%;">Referência</td>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;">${m.referencia || "—"}</td>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;background:#f5f5f5;width:25%;">Lote</td>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;">${m.lote || "—"}</td>
          </tr>
          <tr>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;background:#f5f5f5;">Fabricação</td>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;">${m.fabricacao || "—"}</td>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;background:#f5f5f5;">Validade</td>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;">${m.validade || "—"}</td>
          </tr>
          <tr>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;background:#f5f5f5;">Reg. ANVISA</td>
            <td style="font-size:8.5pt;padding:2px 6px;border:1px solid #ccc;" colspan="3">${m.registro_anvisa || "—"}</td>
          </tr>
        </table>
      </div>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Registro de OPME — ${resolvedName}</title>
<style>
@page{size:A4 portrait;margin:12mm 14mm;}
body{font-family:Arial,sans-serif;font-size:10pt;color:#000;margin:0;}
.header{text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px;}
.header h1{font-size:13pt;font-weight:bold;margin:0 0 2px 0;text-transform:uppercase;}
.header h2{font-size:10pt;font-weight:normal;margin:0 0 2px 0;}
.header h3{font-size:11pt;font-weight:bold;margin:4px 0 0 0;text-transform:uppercase;letter-spacing:1px;}
.st{font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;background:#e8e8e8;padding:3px 6px;margin:10px 0 4px 0;border-left:3px solid #333;}
.fr{display:flex;gap:12px;margin-bottom:6px;}
.f{flex:1;}
.f label{font-size:8pt;font-weight:bold;display:block;margin-bottom:1px;color:#444;}
.f span{font-size:9.5pt;border-bottom:1px solid #999;display:block;min-height:16px;padding-bottom:1px;}
table{width:100%;border-collapse:collapse;margin-bottom:8px;}
th{background:#e8e8e8;font-size:9pt;font-weight:bold;padding:4px 6px;border:1px solid #000;text-align:left;}
.ic{border:1px solid #999;min-height:40px;padding:4px 6px;font-size:9.5pt;margin-bottom:8px;}
.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;}
.ab{border:1px solid #999;padding:6px;}
.ab label{font-size:8pt;font-weight:bold;display:block;margin-bottom:24px;}
.al{border-top:1px solid #000;font-size:8pt;padding-top:2px;text-align:center;}
.rodape{margin-top:14px;border-top:1px solid #ccc;padding-top:4px;font-size:8pt;color:#666;text-align:center;}
</style></head><body>
<div class="header">
<h2>PREFEITURA MUNICIPAL DE SÃO LUÍS — SECRETARIA MUNICIPAL DE SAÚDE</h2>
<h1>Hospital Municipal Djalma Marques — Socorrão I</h1>
<h3>Registro de Utilização de OPME</h3>
<div style="font-size:8.5pt;margin-top:3px;">Órtese, Prótese e Material Especial</div>
</div>
<div class="st">Identificação do Paciente</div>
<div class="fr">
<div class="f"><label>Nome</label><span>${resolvedName}</span></div>
<div class="f" style="max-width:180px;"><label>Data do Procedimento</label><span>${dataFormatada}</span></div>
</div>
<div class="fr">
<div class="f"><label>Cirurgia / Procedimento</label><span>${cirurgia || "—"}</span></div>
<div class="f" style="max-width:120px;"><label>Leito</label><span>${resolvedBed || "—"}</span></div>
<div class="f" style="max-width:160px;"><label>Setor</label><span>${getSectorDisplayLabel(resolvedSector) || resolvedSector || "—"}</span></div>
</div>
<div class="fr">
<div class="f"><label>Cirurgião</label><span>${cirurgiao || "—"}</span></div>
<div class="f"><label>Instrumentador</label><span>${instrumentador || "—"}</span></div>
<div class="f"><label>Empresa Fornecedora</label><span>${empresa || "—"}</span></div>
</div>
<div class="st">Descrição dos Materiais Utilizados</div>
<table><thead><tr>
<th style="width:30px;">#</th><th>Descrição do Material</th>
<th style="width:60px;text-align:center;">Qtd</th><th style="width:140px;">Lote</th>
</tr></thead><tbody>${materiaisRows}</tbody></table>
<div class="st">Intercorrências com o Material</div>
<div class="ic">${intercorrencias || "Nenhuma intercorrência relatada."}</div>
<div class="st">Rastreabilidade dos Materiais (Etiquetas)</div>
${rastreabilidadeBlocks}
<div class="st">Responsáveis</div>
<div class="assinaturas">
<div class="ab"><label>Médico Responsável</label><div class="al">${doctorName}${doctorCRM ? ` · CRM ${doctorCRM}` : ""}</div></div>
<div class="ab"><label>Circulante de Sala</label><div class="al">&nbsp;</div></div>
<div class="ab"><label>Enfermeiro</label><div class="al">&nbsp;</div></div>
<div class="ab"><label>Funcionário CME / Farmácia Satélite</label><div class="al">&nbsp;</div></div>
</div>
<div class="rodape">
Preencher em 2 vias: 1ª Via — Prontuário · 2ª Via — Setor de Dispensação do Material<br/>
Gerado pelo sistema ARSen em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
</div>
</body></html>`;

    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { toast.error("Popup bloqueado — permita pop-ups para imprimir"); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-500" />
            Registro de OPME
          </DialogTitle>
          <DialogDescription className="text-xs">
            Órtese, Prótese e Material Especial · {resolvedName || "Paciente não identificado"}
            {resolvedBed && ` · Leito ${resolvedBed}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-5 py-4">

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação do Procedimento</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Cirurgia / Procedimento</Label>
                  <Input value={cirurgia} onChange={(e) => setCirurgia(e.target.value)} placeholder="Ex: Passagem de cateter, RTUP..." className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Cirurgião</Label>
                  <Input value={cirurgiao} onChange={(e) => setCirurgiao(e.target.value)} placeholder="Nome do cirurgião" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Instrumentador</Label>
                  <Input value={instrumentador} onChange={(e) => setInstrumentador(e.target.value)} placeholder="Nome do instrumentador" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Empresa Fornecedora</Label>
                  <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Razão social da empresa" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Data e Hora do Procedimento</Label>
                  <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Materiais Utilizados</h3>
                <Button size="sm" variant="outline" onClick={addMaterial} className="h-7 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar material
                </Button>
              </div>

              {materiais.map((mat, idx) => (
                <div key={mat.id} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Material {idx + 1}</span>
                    {materiais.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => removeMaterial(mat.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[11px]">Descrição</Label>
                      <Input value={mat.descricao} onChange={(e) => updateMaterial(mat.id, "descricao", e.target.value)} placeholder="Ex: Cateter Medikath 7F..." className="mt-0.5 text-xs h-8" />
                    </div>
                    <div>
                      <Label className="text-[11px]">Quantidade</Label>
                      <Input type="number" min="1" value={mat.quantidade} onChange={(e) => updateMaterial(mat.id, "quantidade", e.target.value)} className="mt-0.5 text-xs h-8" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Rastreabilidade da Etiqueta</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">Referência</Label>
                        <Input value={mat.referencia} onChange={(e) => updateMaterial(mat.id, "referencia", e.target.value)} placeholder="Cód. de referência" className="mt-0.5 text-xs h-8 font-mono" />
                      </div>
                      <div>
                        <Label className="text-[11px]">Lote</Label>
                        <Input value={mat.lote} onChange={(e) => updateMaterial(mat.id, "lote", e.target.value)} placeholder="Nº do lote" className="mt-0.5 text-xs h-8 font-mono" />
                      </div>
                      <div>
                        <Label className="text-[11px]">Fabricação</Label>
                        <Input value={mat.fabricacao} onChange={(e) => updateMaterial(mat.id, "fabricacao", e.target.value)} placeholder="MM/AAAA" className="mt-0.5 text-xs h-8 font-mono" />
                      </div>
                      <div>
                        <Label className="text-[11px]">Validade</Label>
                        <Input value={mat.validade} onChange={(e) => updateMaterial(mat.id, "validade", e.target.value)} placeholder="MM/AAAA" className="mt-0.5 text-xs h-8 font-mono" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[11px]">Registro ANVISA</Label>
                        <Input value={mat.registro_anvisa} onChange={(e) => updateMaterial(mat.id, "registro_anvisa", e.target.value)} placeholder="Nº do registro ANVISA" className="mt-0.5 text-xs h-8 font-mono" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intercorrências com o Material</Label>
              <Textarea value={intercorrencias} onChange={(e) => setIntercorrencias(e.target.value)} placeholder="Citar material e justificativa (deixar em branco se não houve intercorrências)" className="text-xs min-h-[64px] resize-none" />
            </div>

          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" /> Pré-visualizar PDF
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar e Imprimir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
