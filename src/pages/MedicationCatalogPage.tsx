import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Pill, AlertTriangle, Shield, Beaker, ChevronDown, ChevronRight, Syringe, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

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
  'VO': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'IV': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'IM': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'SC': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

export default function MedicationCatalogPage() {
  const [medications, setMedications] = useState<MedicationCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const [catalogRes, presentationsRes, aliasesRes] = await Promise.all([
        supabase.from("medication_catalog").select("*").order("generic_name"),
        supabase.from("medication_presentations").select("*"),
        supabase.from("medication_aliases").select("*"),
      ]);

      if (catalogRes.error) throw catalogRes.error;

      const meds: MedicationCatalogItem[] = (catalogRes.data || []).map((med: any) => ({
        ...med,
        presentations: (presentationsRes.data || []).filter((p: any) => p.medication_id === med.id),
        aliases: (aliasesRes.data || []).filter((a: any) => a.medication_id === med.id),
      }));

      setMedications(meds);
    } catch (err) {
      toast.error("Erro ao carregar catálogo de medicamentos");
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
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Pill className="h-6 w-6 text-primary" />
          Catálogo Clínico de Medicamentos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Consulta rápida de medicamentos, apresentações, vias e orientações de preparo.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Medicamentos</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.highAlert}</p>
            <p className="text-xs text-muted-foreground">Alto Alerta</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.controlled}</p>
            <p className="text-xs text-muted-foreground">Controlados</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.classes}</p>
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
            className="pl-10"
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
              <Card className={`border-border transition-shadow ${expandedId === med.id ? 'shadow-md ring-1 ring-primary/20' : 'hover:shadow-sm'} ${med.high_alert ? 'border-l-4 border-l-destructive' : ''}`}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {med.generic_name}
                          {med.high_alert && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                              <AlertTriangle className="h-3 w-3" /> ALTO ALERTA
                            </Badge>
                          )}
                          {med.controlled && (
                            <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-amber-500 hover:bg-amber-600">
                              <Shield className="h-3 w-3" /> CONTROLADO
                            </Badge>
                          )}
                          {med.requires_dilution && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                              <Beaker className="h-3 w-3" /> DILUIÇÃO
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{med.therapeutic_class}</span>
                          {med.atc_code && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
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
                            <Badge key={route} className={`text-[10px] px-1.5 py-0 ${routeColors[route] || 'bg-muted text-muted-foreground'}`}>
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
                        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
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
                      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Syringe className="h-4 w-4" />
                        Apresentações ({med.presentations.length})
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
                              </tr>
                            </thead>
                            <tbody>
                              {med.presentations.map((p) => (
                                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                                  <td className="px-3 py-2 text-foreground">{p.form}</td>
                                  <td className="px-3 py-2 text-foreground font-mono text-xs">{p.concentration}</td>
                                  <td className="px-3 py-2">
                                    <Badge className={`text-[10px] px-1.5 py-0 ${routeColors[p.route] || 'bg-muted text-muted-foreground'}`}>
                                      {p.route}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 text-foreground text-xs max-w-[200px]">{p.standard_dilution || "—"}</td>
                                  <td className="px-3 py-2 text-foreground text-xs">{p.max_daily_dose || "—"}</td>
                                  <td className="px-3 py-2 text-foreground text-xs">{p.infusion_time || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Aliases */}
                    {med.aliases.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Nomes comerciais:</span>
                        {med.aliases.map((a) => (
                          <Badge key={a.id} variant="outline" className="text-[10px] px-1.5 py-0">
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
