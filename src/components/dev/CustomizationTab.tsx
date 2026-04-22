import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Building2, Bed, Plus, Download, Info, Hash, Layers, Save, Trash2, Copy,
  AlertTriangle, FileJson, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { SECTOR_BED_CONFIG, SectorBedConfig } from "@/utils/bedNaming";
import { SECTOR_DISPLAY, DEPARTMENT_TO_SECTOR } from "@/contexts/DepartmentContext";

/**
 * Personalização — Dev Console
 * --------------------------------------------------------------------------
 * Aba destinada à governança de SETORES e LEITOS do hospital. Por enquanto,
 * funciona como CONSOLE DE LEITURA + RASCUNHO (drafts persistidos em
 * localStorage e exportáveis em JSON), preparando o terreno para a futura
 * migração que tornará `SECTOR_BED_CONFIG` dinâmico (tabela `hospital_sectors`).
 *
 * Sub-abas:
 *  1. Setores Existentes — lista de setores ativos com config atual
 *  2. Numeração de Leitos — preview do range gerado por sector + override
 *  3. Criar Novo Setor — wizard para draft de novo setor
 *  4. Exportar/Importar — JSON para handoff p/ migração futura
 * --------------------------------------------------------------------------
 */

const DRAFT_KEY = "dev_console:sector_drafts:v1";
const OVERRIDES_KEY = "dev_console:bed_overrides:v1";

type SectorDraft = SectorBedConfig & {
  code: string;
  department: string;
  status: "rascunho" | "pendente_migracao";
  createdAt: string;
  notes?: string;
};

type BedOverride = {
  sectorCode: string;
  newMaxBeds?: number;
  newPrefix?: string;
  newStartNumber?: number;
  reason: string;
  createdAt: string;
};

const loadDrafts = (): SectorDraft[] => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]");
  } catch { return []; }
};
const saveDrafts = (d: SectorDraft[]) => localStorage.setItem(DRAFT_KEY, JSON.stringify(d));

const loadOverrides = (): BedOverride[] => {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "[]");
  } catch { return []; }
};
const saveOverrides = (o: BedOverride[]) => localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));

export function CustomizationTab() {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle className="text-sm">Console de Personalização — modo Rascunho</AlertTitle>
        <AlertDescription className="text-xs">
          Esta aba documenta a estrutura ATUAL de setores/leitos (hardcoded em <code>src/utils/bedNaming.ts</code>)
          e permite preparar mudanças futuras (novos setores, renumeração, capacidade extra). Alterações aqui são
          salvas como <strong>rascunho</strong> no navegador e exportadas em JSON — a aplicação real exigirá uma
          migração para tornar <code>SECTOR_BED_CONFIG</code> dinâmico (tabela <code>hospital_sectors</code>).
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="sectors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sectors" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Setores Existentes</TabsTrigger>
          <TabsTrigger value="numbering" className="gap-1.5"><Hash className="h-3.5 w-3.5" /> Numeração de Leitos</TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Criar Novo Setor</TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5"><FileJson className="h-3.5 w-3.5" /> Exportar / Importar</TabsTrigger>
        </TabsList>

        <TabsContent value="sectors"><ExistingSectorsPanel /></TabsContent>
        <TabsContent value="numbering"><BedNumberingPanel /></TabsContent>
        <TabsContent value="new"><NewSectorPanel /></TabsContent>
        <TabsContent value="export"><ExportImportPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────── Setores Existentes ───────────
function ExistingSectorsPanel() {
  const sectors = useMemo(() => Object.entries(SECTOR_BED_CONFIG), []);
  const totalBeds = useMemo(
    () => sectors.reduce((acc, [, cfg]) => acc + cfg.maxRegularBeds, 0),
    [sectors]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiMini label="Setores ativos" value={sectors.length} />
        <KpiMini label="Total de leitos fixos" value={totalBeds} />
        <KpiMini label="Prefixos únicos" value={new Set(sectors.map(([, c]) => c.prefix)).size} />
        <KpiMini label="Suporte a EXTRA" value="Todos" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4" /> Configuração atual (hardcoded em <code className="text-xs">SECTOR_BED_CONFIG</code>)
          </CardTitle>
          <CardDescription className="text-xs">
            Fonte de verdade: <code>src/utils/bedNaming.ts</code>. Mudanças exigem editar este arquivo + popular
            <code> bed_census</code> via SQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[480px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="text-left p-2">Código interno</th>
                  <th className="text-left">Label</th>
                  <th className="text-left">Prefixo</th>
                  <th className="text-right">Início</th>
                  <th className="text-right">Capacidade</th>
                  <th className="text-left">Range gerado</th>
                  <th className="text-left">Department</th>
                </tr>
              </thead>
              <tbody>
                {sectors.map(([code, cfg]) => {
                  const start = cfg.startNumber ?? 1;
                  const end = start + cfg.maxRegularBeds - 1;
                  const range = `${cfg.prefix}${String(start).padStart(2, "0")}–${cfg.prefix}${String(end).padStart(2, "0")}`;
                  const dept = Object.entries(DEPARTMENT_TO_SECTOR).find(([, c]) => c === code)?.[0] ?? "—";
                  return (
                    <tr key={code} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-2 font-mono">{code}</td>
                      <td className="font-medium">{SECTOR_DISPLAY[code] ?? cfg.label}</td>
                      <td><Badge variant="outline" className="text-[10px] font-mono">{cfg.prefix}</Badge></td>
                      <td className="text-right tabular-nums">{start}</td>
                      <td className="text-right tabular-nums font-medium">{cfg.maxRegularBeds}</td>
                      <td className="font-mono text-muted-foreground">{range}</td>
                      <td className="text-[11px] text-muted-foreground">{dept}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-muted/30">
                <tr>
                  <td colSpan={4} className="p-2 font-medium">TOTAL</td>
                  <td className="text-right tabular-nums font-bold">{totalBeds}</td>
                  <td colSpan={2} className="text-[11px] text-muted-foreground p-2">leitos fixos pré-populados em bed_census</td>
                </tr>
              </tfoot>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────── Numeração de Leitos ───────────
function BedNumberingPanel() {
  const [overrides, setOverrides] = useState<BedOverride[]>(loadOverrides());
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [newMax, setNewMax] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [newStart, setNewStart] = useState("");
  const [reason, setReason] = useState("");

  const cfg = selectedSector ? SECTOR_BED_CONFIG[selectedSector] : null;

  const previewBeds = useMemo(() => {
    if (!cfg) return [];
    const prefix = newPrefix || cfg.prefix;
    const start = parseInt(newStart || String(cfg.startNumber ?? 1), 10);
    const max = parseInt(newMax || String(cfg.maxRegularBeds), 10);
    if (isNaN(start) || isNaN(max) || max < 1) return [];
    return Array.from({ length: Math.min(max, 50) }, (_, i) =>
      `${prefix}${String(start + i).padStart(2, "0")}`
    );
  }, [cfg, newPrefix, newStart, newMax]);

  const saveOverride = () => {
    if (!selectedSector || !reason.trim()) {
      toast.error("Selecione um setor e justifique a alteração");
      return;
    }
    const ov: BedOverride = {
      sectorCode: selectedSector,
      newMaxBeds: newMax ? parseInt(newMax, 10) : undefined,
      newPrefix: newPrefix || undefined,
      newStartNumber: newStart ? parseInt(newStart, 10) : undefined,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [...overrides.filter(o => o.sectorCode !== selectedSector), ov];
    saveOverrides(next);
    setOverrides(next);
    toast.success("Override salvo como rascunho");
    setNewMax(""); setNewPrefix(""); setNewStart(""); setReason("");
  };

  const removeOverride = (sectorCode: string) => {
    const next = overrides.filter(o => o.sectorCode !== sectorCode);
    saveOverrides(next);
    setOverrides(next);
    toast.success("Override removido");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Simulador & Override de Numeração</CardTitle>
          <CardDescription className="text-xs">
            Veja como os leitos serão nomeados. Alterações salvas aqui ficam como rascunho até serem aplicadas
            via migração + edição de <code>SECTOR_BED_CONFIG</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Setor</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SECTOR_BED_CONFIG).map(([code, c]) => (
                    <SelectItem key={code} value={code}>{c.label} ({code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Novo prefixo (opcional)</Label>
              <Input value={newPrefix} onChange={e => setNewPrefix(e.target.value.toUpperCase())} placeholder={cfg?.prefix ?? "L"} maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Início (opcional)</Label>
              <Input type="number" value={newStart} onChange={e => setNewStart(e.target.value)} placeholder={String(cfg?.startNumber ?? 1)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Capacidade (opcional)</Label>
              <Input type="number" value={newMax} onChange={e => setNewMax(e.target.value)} placeholder={String(cfg?.maxRegularBeds ?? "")} />
            </div>
          </div>

          {cfg && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preview ({previewBeds.length} leitos)</Label>
              <div className="flex flex-wrap gap-1 p-3 rounded-md border border-border bg-muted/30 max-h-40 overflow-y-auto">
                {previewBeds.map(b => (
                  <Badge key={b} variant="secondary" className="font-mono text-[10px]">{b}</Badge>
                ))}
                {previewBeds.length >= 50 && <Badge variant="outline" className="text-[10px]">… (truncado a 50)</Badge>}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Justificativa (obrigatória)</Label>
            <Textarea
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Ex.: expansão da UTI 2 para 12 leitos com renumeração L09–L20"
              rows={2}
            />
          </div>

          <Button onClick={saveOverride} disabled={!selectedSector || !reason.trim()}>
            <Save className="h-4 w-4 mr-2" /> Salvar override (rascunho)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Overrides Pendentes ({overrides.length})</CardTitle>
          <CardDescription className="text-xs">Aguardando migração/aplicação no código.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {overrides.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Nenhum override salvo.</p>
          ) : (
            <ScrollArea className="h-[260px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card border-b border-border text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Setor</th>
                    <th className="text-left">Mudanças</th>
                    <th className="text-left">Justificativa</th>
                    <th className="text-left">Data</th>
                    <th className="text-right p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map(o => (
                    <tr key={o.sectorCode} className="border-b border-border/50">
                      <td className="p-2 font-mono">{o.sectorCode}</td>
                      <td className="space-x-1">
                        {o.newPrefix && <Badge variant="outline" className="text-[10px]">prefix→{o.newPrefix}</Badge>}
                        {o.newStartNumber !== undefined && <Badge variant="outline" className="text-[10px]">start→{o.newStartNumber}</Badge>}
                        {o.newMaxBeds !== undefined && <Badge variant="outline" className="text-[10px]">max→{o.newMaxBeds}</Badge>}
                      </td>
                      <td className="text-muted-foreground max-w-[260px] truncate">{o.reason}</td>
                      <td className="text-muted-foreground font-mono">{new Date(o.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="text-right p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeOverride(o.sectorCode)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────── Criar Novo Setor ───────────
function NewSectorPanel() {
  const [drafts, setDrafts] = useState<SectorDraft[]>(loadDrafts());
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [department, setDepartment] = useState("");
  const [prefix, setPrefix] = useState("L");
  const [startNumber, setStartNumber] = useState("1");
  const [maxBeds, setMaxBeds] = useState("");
  const [notes, setNotes] = useState("");

  const codeNormalized = code.trim().toLowerCase().replace(/\s+/g, "_");
  const codeConflict = codeNormalized && (
    SECTOR_BED_CONFIG[codeNormalized] ||
    drafts.some(d => d.code === codeNormalized)
  );

  const previewBeds = useMemo(() => {
    const start = parseInt(startNumber, 10);
    const max = parseInt(maxBeds, 10);
    if (isNaN(start) || isNaN(max) || max < 1 || !prefix) return [];
    return Array.from({ length: Math.min(max, 30) }, (_, i) =>
      `${prefix.toUpperCase()}${String(start + i).padStart(2, "0")}`
    );
  }, [prefix, startNumber, maxBeds]);

  const saveDraft = () => {
    if (!codeNormalized || !label.trim() || !maxBeds || !prefix) {
      toast.error("Preencha código, label, prefixo e capacidade");
      return;
    }
    if (codeConflict) {
      toast.error("Código já existe (em SECTOR_BED_CONFIG ou em outro rascunho)");
      return;
    }
    const draft: SectorDraft = {
      code: codeNormalized,
      label: label.trim(),
      department: department.trim() || "—",
      prefix: prefix.toUpperCase(),
      startNumber: parseInt(startNumber, 10),
      maxRegularBeds: parseInt(maxBeds, 10),
      status: "rascunho",
      createdAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
    };
    const next = [...drafts, draft];
    saveDrafts(next);
    setDrafts(next);
    toast.success(`Setor "${draft.label}" salvo como rascunho`);
    setCode(""); setLabel(""); setDepartment(""); setPrefix("L"); setStartNumber("1"); setMaxBeds(""); setNotes("");
  };

  const removeDraft = (c: string) => {
    const next = drafts.filter(d => d.code !== c);
    saveDrafts(next);
    setDrafts(next);
  };

  const generateMigrationSQL = (d: SectorDraft) => {
    const start = d.startNumber ?? 1;
    const beds = Array.from({ length: d.maxRegularBeds }, (_, i) =>
      `${d.prefix}${String(start + i).padStart(2, "0")}`
    );
    const values = beds.map(b => `('${d.code}', '${b}', 'vago')`).join(",\n  ");
    return `-- Setor: ${d.label} (${d.code})
-- 1) Adicionar em src/utils/bedNaming.ts:
--    ${d.code}: { prefix: '${d.prefix}', maxRegularBeds: ${d.maxRegularBeds}, label: '${d.label}', startNumber: ${start} },
--
-- 2) Adicionar em DepartmentContext.tsx:
--    DEPARTMENT_TO_SECTOR: "${d.department.toUpperCase()}": "${d.code}"
--    SECTOR_DISPLAY: ${d.code}: "${d.label}"
--
-- 3) Popular bed_census (executar no Supabase):
INSERT INTO bed_census (sector, bed_number, status, hospital_unit_id, state_id)
SELECT v.sector, v.bed_number, v.status, hu.id, hu.state_id
FROM (VALUES
  ${values}
) AS v(sector, bed_number, status)
CROSS JOIN hospital_units hu
WHERE hu.unit_code = '001'
ON CONFLICT DO NOTHING;`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" /> Wizard de Novo Setor
          </CardTitle>
          <CardDescription className="text-xs">
            Define um novo setor + range de leitos. Salva como rascunho e gera SQL pronto para migração.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Código interno (snake_case) *</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="ex: enfermaria_pediatrica" />
              {codeConflict && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Código já existe
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Label de exibição *</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="ex: Enf. Pediátrica" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Department (categoria)</Label>
              <Input value={department} onChange={e => setDepartment(e.target.value.toUpperCase())} placeholder="ex: PEDIATRIA" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prefixo dos leitos *</Label>
              <Input value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} maxLength={4} placeholder="L, EV, OC..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Número inicial *</Label>
              <Input type="number" value={startNumber} onChange={e => setStartNumber(e.target.value)} min={1} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Capacidade (qtd leitos) *</Label>
              <Input type="number" value={maxBeds} onChange={e => setMaxBeds(e.target.value)} min={1} placeholder="ex: 20" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Ex.: setor a ser ativado em 2026-Q3, requer treinamento prévio..." />
          </div>

          {previewBeds.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preview de leitos ({previewBeds.length})</Label>
              <div className="flex flex-wrap gap-1 p-3 rounded-md border border-border bg-muted/30 max-h-32 overflow-y-auto">
                {previewBeds.map(b => (
                  <Badge key={b} variant="secondary" className="font-mono text-[10px]">{b}</Badge>
                ))}
                {parseInt(maxBeds, 10) > 30 && <Badge variant="outline" className="text-[10px]">… +{parseInt(maxBeds, 10) - 30}</Badge>}
              </div>
            </div>
          )}

          <Button onClick={saveDraft} disabled={!codeNormalized || !label.trim() || !maxBeds || !!codeConflict}>
            <Save className="h-4 w-4 mr-2" /> Salvar rascunho
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bed className="h-4 w-4" /> Setores Rascunho ({drafts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {drafts.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Nenhum setor rascunho.</p>
          ) : (
            <ScrollArea className="h-[320px]">
              <div className="divide-y divide-border">
                {drafts.map(d => (
                  <div key={d.code} className="p-3 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{d.label}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">{d.code}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {d.maxRegularBeds} leitos · {d.prefix}{String(d.startNumber).padStart(2, "0")}–
                          {d.prefix}{String((d.startNumber ?? 1) + d.maxRegularBeds - 1).padStart(2, "0")}
                          {d.department !== "—" && ` · ${d.department}`}
                        </div>
                        {d.notes && <p className="text-[11px] text-muted-foreground italic">"{d.notes}"</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => {
                            navigator.clipboard.writeText(generateMigrationSQL(d));
                            toast.success("SQL de migração copiado");
                          }}
                          title="Copiar SQL de migração">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeDraft(d.code)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────── Exportar / Importar ───────────
function ExportImportPanel() {
  const [drafts, setDrafts] = useState<SectorDraft[]>(loadDrafts());
  const [overrides, setOverrides] = useState<BedOverride[]>(loadOverrides());
  const [importJson, setImportJson] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDrafts(loadDrafts());
      setOverrides(loadOverrides());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const exportPayload = useMemo(() => ({
    version: "1.0",
    exportedAt: new Date().toISOString(),
    currentConfig: SECTOR_BED_CONFIG,
    drafts,
    overrides,
    totalCurrentBeds: Object.values(SECTOR_BED_CONFIG).reduce((s, c) => s + c.maxRegularBeds, 0),
    totalDraftBeds: drafts.reduce((s, d) => s + d.maxRegularBeds, 0),
  }), [drafts, overrides]);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arsen-sectors-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exportado");
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (parsed.drafts && Array.isArray(parsed.drafts)) {
        saveDrafts(parsed.drafts);
        setDrafts(parsed.drafts);
      }
      if (parsed.overrides && Array.isArray(parsed.overrides)) {
        saveOverrides(parsed.overrides);
        setOverrides(parsed.overrides);
      }
      toast.success(`Importado: ${parsed.drafts?.length ?? 0} rascunhos, ${parsed.overrides?.length ?? 0} overrides`);
      setImportJson("");
    } catch {
      toast.error("JSON inválido");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar configuração
          </CardTitle>
          <CardDescription className="text-xs">
            Snapshot completo: config atual + rascunhos + overrides. Use para handoff de migração ou versionamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-muted/40"><span className="text-muted-foreground">Setores ativos:</span> <strong>{Object.keys(SECTOR_BED_CONFIG).length}</strong></div>
            <div className="p-2 rounded bg-muted/40"><span className="text-muted-foreground">Leitos atuais:</span> <strong>{exportPayload.totalCurrentBeds}</strong></div>
            <div className="p-2 rounded bg-muted/40"><span className="text-muted-foreground">Rascunhos:</span> <strong>{drafts.length}</strong></div>
            <div className="p-2 rounded bg-muted/40"><span className="text-muted-foreground">Overrides:</span> <strong>{overrides.length}</strong></div>
          </div>
          <Button onClick={downloadJson} className="w-full">
            <Download className="h-4 w-4 mr-2" /> Baixar JSON
          </Button>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Preview do payload</summary>
            <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto max-h-40 font-mono">
              {JSON.stringify(exportPayload, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" /> Importar / Restaurar
          </CardTitle>
          <CardDescription className="text-xs">
            Cole um JSON exportado anteriormente para restaurar rascunhos e overrides. <strong>Sobrescreve</strong> os
            rascunhos atuais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
            rows={10}
            placeholder='{"drafts": [...], "overrides": [...]}'
            className="font-mono text-[11px]"
          />
          <Button onClick={handleImport} disabled={!importJson.trim()} variant="outline" className="w-full">
            Importar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiMini({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
