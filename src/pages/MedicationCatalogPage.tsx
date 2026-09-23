import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Pill, AlertTriangle, Shield, Beaker, ChevronDown, ChevronRight, Syringe, Info, Download, Loader2, Pencil, Check, X, Lock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCanEditCatalog } from "@/hooks/useCanEditCatalog";
import { invalidateMedicationProtocolCache } from "@/hooks/useMedicationProtocols";

interface MedicationAlias {
  id: string;
  alias_name: string;
  alias_type: string;
}

interface MedicationPresentation {
  id: string;
  form: string;
  concentration: string;
  unit: string;
  route: string;
  standard_dilution: string | null;
  max_daily_dose: string | null;
  infusion_time: string | null;
  iv_bolus: boolean;
  pharmacy_suggestion_enabled: boolean;
}

interface MedicationCatalogItem {
  id: string;
  generic_name: string;
  therapeutic_class: string;
  pharmacological_group: string | null;
  atc_code: string | null;
  controlled: boolean;
  requires_dilution: boolean;
  high_alert: boolean;
  notes: string | null;
  presentations: MedicationPresentation[];
  aliases: MedicationAlias[];
}

const routeColors: Record<string, string> = {
  'VO': 'bg-released-soft text-released-on-soft',
  'IV': 'bg-muted text-foreground',
  'IM': 'bg-warning-soft text-warning-on-soft',
  'SC': 'bg-muted text-foreground',
};

export default function MedicationCatalogPage() {
  const { isAdmin } = useIsAdmin();
  const canEdit = useCanEditCatalog();
  const [medications, setMedications] = useState<MedicationCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ standard_dilution: string; max_daily_dose: string; infusion_time: string; iv_bolus: boolean; pharmacy_suggestion_enabled: boolean }>({
    standard_dilution: "",
    max_daily_dose: "",
    infusion_time: "",
    iv_bolus: false,
    pharmacy_suggestion_enabled: false,
  });
  const [savingId, setSavingId] = useState<string | null>(null);

  const startEdit = (p: MedicationPresentation) => {
    setEditingId(p.id);
    setEditDraft({
      standard_dilution: p.standard_dilution ?? "",
      max_daily_dose: p.max_daily_dose ?? "",
      infusion_time: p.infusion_time ?? "",
      iv_bolus: p.iv_bolus ?? false,
      pharmacy_suggestion_enabled: p.pharmacy_suggestion_enabled ?? false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (presentationId: string, medicationId: string) => {
    setSavingId(presentationId);
    try {
      // MIGRAÇÃO: apresentacoes_medicamento só tem diluicao_padrao/
      // dose_maxima_diaria/tempo_infusao. iv_bolus e pharmacy_suggestion_enabled
      // NÃO têm coluna → DEGRADADOS: não são persistidos (ficam só no estado
      // local otimista). O popup de "sugestão automática da farmácia" não pode
      // ser (des)ativado neste schema.
      const payload = {
        diluicao_padrao: editDraft.standard_dilution.trim() || null,
        dose_maxima_diaria: editDraft.max_daily_dose.trim() || null,
        tempo_infusao: editDraft.infusion_time.trim() || null,
      };
      if (editDraft.pharmacy_suggestion_enabled) invalidateMedicationProtocolCache();
      const { error } = await supabase
        .from("apresentacoes_medicamento")
        .update(payload)
        .eq("id", presentationId);
      if (error) throw error;
      // atualização otimista local (inclui os campos degradados, só em memória)
      const localPatch = {
        standard_dilution: payload.diluicao_padrao,
        max_daily_dose: payload.dose_maxima_diaria,
        infusion_time: payload.tempo_infusao,
        iv_bolus: editDraft.iv_bolus,
        pharmacy_suggestion_enabled: editDraft.pharmacy_suggestion_enabled,
      };
      setMedications((prev) =>
        prev.map((m) =>
          m.id !== medicationId
            ? m
            : {
                ...m,
                presentations: m.presentations.map((pr) =>
                  pr.id === presentationId ? { ...pr, ...localPatch } : pr,
                ),
              },
        ),
      );
      setEditingId(null);
      toast.success("Evidência atualizada");
    } catch (err: any) {
      toast.error("Não foi possível salvar");
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      // MIGRAÇÃO: medication_catalog → catalogo_medicamentos;
      // medication_presentations → apresentacoes_medicamento;
      // medication_aliases → sinonimos_medicamento (colunas em pt-BR).
      const [catalogRes, presentationsRes, aliasesRes] = await Promise.all([
        supabase.from("catalogo_medicamentos").select("*").order("nome_generico"),
        supabase.from("apresentacoes_medicamento").select("*"),
        supabase.from("sinonimos_medicamento").select("*"),
      ]);

      if (catalogRes.error) throw catalogRes.error;

      const presByMed = (presentationsRes.data || []) as any[];
      const aliasesByMed = (aliasesRes.data || []) as any[];

      const meds: MedicationCatalogItem[] = (catalogRes.data || []).map((med: any) => ({
        id: med.id,
        generic_name: med.nome_generico,
        therapeutic_class: med.classe_terapeutica,
        pharmacological_group: med.grupo_farmacologico ?? null,
        atc_code: med.codigo_atc ?? null,
        controlled: !!med.controlado,
        requires_dilution: !!med.exige_diluicao,
        high_alert: !!med.alta_vigilancia,
        notes: med.observacoes ?? null,
        // DEGRADADO: iv_bolus e pharmacy_suggestion_enabled não existem em
        // apresentacoes_medicamento → default false (os toggles "Bolus EV" e
        // "Sugestão automática" ficam só na UI, sem persistência).
        presentations: presByMed
          .filter((p: any) => p.medicamento_id === med.id)
          .map((p: any) => ({
            id: p.id,
            form: p.forma,
            concentration: p.concentracao,
            unit: p.unidade,
            route: p.via,
            standard_dilution: p.diluicao_padrao ?? null,
            max_daily_dose: p.dose_maxima_diaria ?? null,
            infusion_time: p.tempo_infusao ?? null,
            iv_bolus: false,
            pharmacy_suggestion_enabled: false,
          })),
        aliases: aliasesByMed
          .filter((a: any) => a.medicamento_id === med.id)
          .map((a: any) => ({
            id: a.id,
            alias_name: a.nome_sinonimo,
            alias_type: a.tipo,
          })),
      }));

      setMedications(meds);
    } catch (err) {
      toast.error("Não foi possível carregar catálogo de medicamentos");
    } finally {
      setLoading(false);
    }
  };

  const therapeuticClasses = useMemo(() => {
    const classes = new Set(medications.map((m) => m.therapeutic_class));
    return Array.from(classes).sort();
  }, [medications]);

  const filtered = useMemo(() => {
    return medications.filter((med) => {
      const matchesClass = classFilter === "all" || med.therapeutic_class === classFilter;
      if (!searchTerm) return matchesClass;
      const term = searchTerm.toLowerCase();
      const matchesName = med.generic_name.toLowerCase().includes(term);
      const matchesAlias = med.aliases.some((a) => a.alias_name.toLowerCase().includes(term));
      const matchesAtc = med.atc_code?.toLowerCase().includes(term);
      return matchesClass && (matchesName || matchesAlias || matchesAtc);
    });
  }, [medications, searchTerm, classFilter]);

  const stats = useMemo(() => ({
    total: medications.length,
    highAlert: medications.filter((m) => m.high_alert).length,
    controlled: medications.filter((m) => m.controlled).length,
    classes: therapeuticClasses.length,
  }), [medications, therapeuticClasses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Pill className="h-6 w-6 text-primary" />
            Catálogo Clínico de Medicamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consulta rápida de medicamentos, apresentações, vias e orientações de preparo.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={importing}
          onClick={async () => {
            setImporting(true);
            try {
              const { data, error } = await supabase.functions.invoke("seed-rename-catalog");
              if (error) throw error;
              toast.success(data.message || `${data.inserted} medicamentos importados`);
              if (data.inserted > 0) fetchCatalog();
            } catch (err: any) {
              toast.error("Nenhum item foi importado. Verifique o arquivo e tente novamente.");
            } finally {
              setImporting(false);
            }
          }}
          className="shrink-0"
        >
          {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          {importing ? "Importando..." : "Importar RENAME/FTN"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-semibold text-primary">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Medicamentos</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-semibold text-destructive">{stats.highAlert}</p>
            <p className="text-xs text-muted-foreground">Alto Alerta</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-semibold text-warning-on-soft">{stats.controlled}</p>
            <p className="text-xs text-muted-foreground">Controlados</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-semibold text-muted-foreground">{stats.classes}</p>
            <p className="text-xs text-muted-foreground">Classes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome genérico, comercial ou código ATC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Classe terapêutica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as classes</SelectItem>
            {therapeuticClasses.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Pill className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum medicamento encontrado.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((med) => (
            <Collapsible
              key={med.id}
              open={expandedId === med.id}
              onOpenChange={(open) => setExpandedId(open ? med.id : null)}
            >
              <Card className={`border-border transition-shadow-sm ${expandedId === med.id ? 'shadow-md ring-1 ring-primary/20' : 'hover:shadow-sm'} ${med.high_alert ? 'border-l-4 border-l-destructive' : ''}`}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-medium text-foreground flex items-center gap-2 flex-wrap">
                          {med.generic_name}
                          {med.high_alert && (
                            <Badge variant="destructive" className="text-xs px-2 py-0 gap-1">
                              <AlertTriangle className="h-3 w-3" /> ALTO ALERTA
                            </Badge>
                          )}
                          {med.controlled && (
                            <Badge className="text-xs px-2 py-0 gap-1 bg-warning hover:bg-warning">
                              <Shield className="h-3 w-3" /> CONTROLADO
                            </Badge>
                          )}
                          {med.requires_dilution && (
                            <Badge variant="outline" className="text-xs px-2 py-0 gap-1">
                              <Beaker className="h-3 w-3" /> DILUIÇÃO
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{med.therapeutic_class}</span>
                          {med.atc_code && (
                            <Badge variant="secondary" className="text-xs px-2 py-0 font-mono">
                              {med.atc_code}
                            </Badge>
                          )}
                          {med.aliases.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({med.aliases.map((a) => a.alias_name).join(", ")})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex gap-1">
                          {Array.from(new Set(med.presentations.map((p) => p.route))).map((route) => (
                            <Badge key={route} className={`text-xs px-2 py-0 ${routeColors[route] || 'bg-muted text-muted-foreground'}`}>
                              {route}
                            </Badge>
                          ))}
                        </div>
                        {expandedId === med.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <Separator />
                  <CardContent className="p-4 space-y-4">
                    {/* Notes */}
                    {med.notes && (
                      <div className="bg-muted/50 rounded-lg p-3 flex gap-2 text-sm">
                        <Info className="h-4 w-4 text-primary mt-1 shrink-0" />
                        <span className="text-foreground">{med.notes}</span>
                      </div>
                    )}

                    {/* Pharmacological group */}
                    {med.pharmacological_group && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Grupo farmacológico:</span>{" "}
                        <span className="text-foreground font-medium">{med.pharmacological_group}</span>
                      </div>
                    )}

                    {/* Presentations table */}
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Syringe className="h-4 w-4" />
                        Apresentações ({med.presentations.length})
                        {canEdit ? (
                          <Badge variant="outline" className="text-xs px-2 py-0 ml-2 gap-1">
                            <Pencil className="h-3 w-3" /> Edição liberada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs px-2 py-0 ml-2 gap-1 text-muted-foreground">
                            <Lock className="h-3 w-3" /> Somente leitura
                          </Badge>
                        )}
                      </h4>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50 text-muted-foreground text-xs">
                                <th className="px-3 py-2 text-left font-medium">Forma</th>
                                <th className="px-3 py-2 text-left font-medium">Concentração</th>
                                <th className="px-3 py-2 text-left font-medium">Via</th>
                                <th className="px-3 py-2 text-left font-medium">Diluição</th>
                                <th className="px-3 py-2 text-left font-medium">Dose Máx.</th>
                                <th className="px-3 py-2 text-left font-medium">Tempo Infusão</th>
                                <th className="px-3 py-2 text-center font-medium w-[60px]" title="Bolus EV">Bolus</th>
                                <th className="px-3 py-2 text-center font-medium w-[70px]" title="Sugestão automática">Sugest.</th>
                                {canEdit && <th className="px-3 py-2 text-left font-medium w-[80px]">Ações</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {med.presentations.map((p) => {
                                const isEditing = editingId === p.id;
                                const isSaving = savingId === p.id;
                                return (
                                  <tr key={p.id} className="border-t border-border hover:bg-muted/30 align-top">
                                    <td className="px-3 py-2 text-foreground">{p.form}</td>
                                    <td className="px-3 py-2 text-foreground font-mono text-xs">{p.concentration}</td>
                                    <td className="px-3 py-2">
                                      <Badge className={`text-xs px-2 py-0 ${routeColors[p.route] || 'bg-muted text-muted-foreground'}`}>
                                        {p.route}
                                      </Badge>
                                    </td>
                                    {isEditing ? (
                                      <>
                                        <td className="px-2 py-2 max-w-[240px]">
                                          <Textarea
                                            value={editDraft.standard_dilution}
                                            onChange={(e) => setEditDraft((d) => ({ ...d, standard_dilution: e.target.value }))}
                                            placeholder="Ex.: Diluir em 100 mL SF 0,9%"
                                            className="text-xs min-h-[60px]"
                                          />
                                        </td>
                                        <td className="px-2 py-2 max-w-[160px]">
                                          <Input
                                            value={editDraft.max_daily_dose}
                                            onChange={(e) => setEditDraft((d) => ({ ...d, max_daily_dose: e.target.value }))}
                                            placeholder="Ex.: 4 g/dia"
                                            className="text-xs h-8"
                                          />
                                        </td>
                                        <td className="px-2 py-2 max-w-[160px]">
                                          <Input
                                            value={editDraft.infusion_time}
                                            onChange={(e) => setEditDraft((d) => ({ ...d, infusion_time: e.target.value }))}
                                            placeholder="Ex.: Infusão lenta ≥60 min"
                                            className="text-xs h-8"
                                          />
                                        </td>
                                        {/* Bolus EV */}
                                        <td className="px-2 py-2 text-center">
                                          <input type="checkbox" checked={editDraft.iv_bolus}
                                            onChange={(e) => setEditDraft((d) => ({ ...d, iv_bolus: e.target.checked, infusion_time: e.target.checked ? "" : d.infusion_time }))}
                                            title="Bolus EV — sem diluição nem tempo"
                                            className="h-4 w-4 cursor-pointer accent-violet-600" />
                                        </td>
                                        {/* Habilitar sugestão automática */}
                                        <td className="px-2 py-2 text-center">
                                          <input type="checkbox" checked={editDraft.pharmacy_suggestion_enabled}
                                            onChange={(e) => setEditDraft((d) => ({ ...d, pharmacy_suggestion_enabled: e.target.checked }))}
                                            title="Habilitar popup de sugestão automática para o médico"
                                            className="h-4 w-4 cursor-pointer accent-emerald-600" />
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td className="px-3 py-2 text-foreground text-xs max-w-[200px]">{p.standard_dilution || "—"}</td>
                                        <td className="px-3 py-2 text-foreground text-xs">{p.max_daily_dose || "—"}</td>
                                        <td className="px-3 py-2 text-foreground text-xs">{p.infusion_time || "—"}</td>
                                        <td className="px-3 py-2 text-center">{p.iv_bolus ? <span className="text-foreground font-semibold text-xs">Bolus</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                                        <td className="px-3 py-2 text-center">{p.pharmacy_suggestion_enabled ? <span className="text-released-on-soft font-semibold text-xs">Ativo</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                                      </>
                                    )}
                                    {canEdit && (
                                      <td className="px-2 py-2">
                                        {isEditing ? (
                                          <div className="flex gap-1">
                                            <Button
                                              size="icon"
                                              variant="default"
                                              className="h-7 w-7"
                                              disabled={isSaving}
                                              onClick={() => saveEdit(p.id, med.id)}
                                            >
                                              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7"
                                              disabled={isSaving}
                                              onClick={cancelEdit}
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={() => startEdit(p)}
                                            title="Editar evidência"
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {canEdit && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Diluição padrão, dose máxima e tempo de infusão alimentam as sugestões "Padrão" da prescrição.
                        </p>
                      )}
                    </div>

                    {/* Aliases */}
                    {med.aliases.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Nomes comerciais:</span>
                        {med.aliases.map((a) => (
                          <Badge key={a.id} variant="outline" className="text-xs px-2 py-0">
                            {a.alias_name}
                            {a.alias_type === 'abbreviation' && ' (abrev.)'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}
