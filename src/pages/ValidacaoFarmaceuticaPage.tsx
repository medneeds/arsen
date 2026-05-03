import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck, Search, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Pill, Syringe, FlaskConical, Activity,
  FileText, Loader2, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlatformHeader } from "@/components/layout/PlatformHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";

interface PrescriptionItem {
  id: string;
  name: string;
  dose?: string;
  route?: string;
  posology?: string;
  schedule?: string;
  instructions?: string;
  category?: string;
  suspended?: boolean;
  highAlert?: boolean;
  flags?: string[];
}

interface PrescriptionWithValidation {
  id: string;
  patient_name: string;
  created_at: string;
  status: string;
  items: PrescriptionItem[];
  patient_data: any;
  created_by: string | null;
  validation?: {
    id: string;
    status: string;
    notes: string | null;
    dose_check_passed: boolean | null;
    allergy_check_passed: boolean | null;
    interaction_check_passed: boolean | null;
    dilution_check_passed: boolean | null;
    validation_items: any[];
    validated_by: string | null;
    validator_name: string | null;
    updated_at: string;
  } | null;
}

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-700 border-amber-300", icon: Clock },
  approved: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700 border-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Rejeitada", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  requires_changes: { label: "Requer Ajustes", color: "bg-orange-500/15 text-orange-700 border-orange-300", icon: AlertTriangle },
};

const ValidacaoFarmaceuticaPage = () => {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const selectedUnit = currentHospital?.id;
  const selectedState = currentState?.id;
  const [prescriptions, setPrescriptions] = useState<PrescriptionWithValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionWithValidation | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validating, setValidating] = useState(false);

  // Validation form state
  const [doseCheck, setDoseCheck] = useState(false);
  const [allergyCheck, setAllergyCheck] = useState(false);
  const [interactionCheck, setInteractionCheck] = useState(false);
  const [dilutionCheck, setDilutionCheck] = useState(false);
  const [validationNotes, setValidationNotes] = useState("");
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [itemStatus, setItemStatus] = useState<Record<string, "ok" | "alert" | "rejected">>({});

  useEffect(() => {
    if (selectedUnit && selectedState) {
      fetchPrescriptions();
    }
  }, [selectedUnit, selectedState]);

  const fetchPrescriptions = async () => {
    if (!selectedUnit || !selectedState) return;
    setLoading(true);
    try {
      const { data: prescriptionsData, error: presError } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("hospital_unit_id", selectedUnit)
        .eq("state_id", selectedState)
        .order("created_at", { ascending: false })
        .limit(100);

      if (presError) throw presError;

      const { data: validationsData, error: valError } = await supabase
        .from("prescription_validations")
        .select("*")
        .eq("hospital_unit_id", selectedUnit)
        .eq("state_id", selectedState);

      if (valError) throw valError;

      const validationMap = new Map<string, any>();
      (validationsData || []).forEach((v: any) => {
        validationMap.set(v.prescription_id, v);
      });

      const merged: PrescriptionWithValidation[] = (prescriptionsData || []).map((p: any) => ({
        ...p,
        items: Array.isArray(p.items) ? p.items : [],
        validation: validationMap.get(p.id) || null,
      }));

      setPrescriptions(merged);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar prescrições");
    } finally {
      setLoading(false);
    }
  };

  const getValidationStatus = (p: PrescriptionWithValidation) => {
    return p.validation?.status || "pending";
  };

  const filtered = prescriptions.filter((p) => {
    const status = getValidationStatus(p);
    const matchesTab = activeTab === "all" || status === activeTab;
    const matchesSearch =
      !search ||
      p.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      p.items.some((i) => i.name?.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const counts = {
    pending: prescriptions.filter((p) => getValidationStatus(p) === "pending").length,
    approved: prescriptions.filter((p) => getValidationStatus(p) === "approved").length,
    rejected: prescriptions.filter((p) => getValidationStatus(p) === "rejected").length,
    requires_changes: prescriptions.filter((p) => getValidationStatus(p) === "requires_changes").length,
  };

  const openValidation = (p: PrescriptionWithValidation) => {
    setSelectedPrescription(p);
    // Pre-fill from existing validation if any
    if (p.validation) {
      setDoseCheck(p.validation.dose_check_passed || false);
      setAllergyCheck(p.validation.allergy_check_passed || false);
      setInteractionCheck(p.validation.interaction_check_passed || false);
      setDilutionCheck(p.validation.dilution_check_passed || false);
      setValidationNotes(p.validation.notes || "");
      const existingItems: Record<string, "ok" | "alert" | "rejected"> = {};
      const existingNotes: Record<string, string> = {};
      (p.validation.validation_items as any[] || []).forEach((vi: any) => {
        if (vi.item_id) {
          existingItems[vi.item_id] = vi.status || "ok";
          existingNotes[vi.item_id] = vi.note || "";
        }
      });
      setItemStatus(existingItems);
      setItemNotes(existingNotes);
    } else {
      setDoseCheck(false);
      setAllergyCheck(false);
      setInteractionCheck(false);
      setDilutionCheck(false);
      setValidationNotes("");
      setItemStatus({});
      setItemNotes({});
    }
    setShowValidationDialog(true);
  };

  const handleSubmitValidation = async (finalStatus: "approved" | "rejected" | "requires_changes") => {
    if (!selectedPrescription || !selectedUnit || !selectedState || !user) return;
    setValidating(true);

    const validationItems = selectedPrescription.items
      .filter((i) => !i.suspended)
      .map((i) => ({
        item_id: i.id,
        item_name: i.name,
        status: itemStatus[i.id] || "ok",
        note: itemNotes[i.id] || "",
      }));

    const payload = {
      prescription_id: selectedPrescription.id,
      validated_by: user.id,
      validator_name: user.email?.split("@")[0]?.toUpperCase() || "FARMÁCIA",
      status: finalStatus,
      notes: validationNotes || null,
      validation_items: validationItems,
      dose_check_passed: doseCheck,
      allergy_check_passed: allergyCheck,
      interaction_check_passed: interactionCheck,
      dilution_check_passed: dilutionCheck,
      hospital_unit_id: selectedUnit,
      state_id: selectedState,
    };

    try {
      if (selectedPrescription.validation) {
        const { error } = await supabase
          .from("prescription_validations")
          .update(payload)
          .eq("id", selectedPrescription.validation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("prescription_validations")
          .insert(payload as any);
        if (error) throw error;
      }

      toast.success(
        finalStatus === "approved"
          ? "Prescrição aprovada pela farmácia"
          : finalStatus === "rejected"
          ? "Prescrição rejeitada"
          : "Ajustes solicitados ao prescritor"
      );
      setShowValidationDialog(false);
      fetchPrescriptions();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar validação");
    } finally {
      setValidating(false);
    }
  };

  const activeItems = selectedPrescription?.items.filter((i) => !i.suspended) || [];
  const highAlertItems = activeItems.filter((i) => i.highAlert);

  return (
    <>
      <PlatformHeader
        variant="institutional"
        eyebrow="Farmácia · Validação"
        title="Validação Farmacêutica"
        icon={ShieldCheck}
        subtitle={<span className="truncate">Conferência e aprovação de prescrições</span>}
        actions={
          <div className="relative w-56 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/70" />
            <Input
              placeholder="Buscar paciente ou medicamento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white/15 border-white/25 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-white/40"
            />
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "pending", label: "Pendentes", icon: Clock, color: "text-amber-600" },
          { key: "approved", label: "Aprovadas", icon: CheckCircle2, color: "text-emerald-600" },
          { key: "rejected", label: "Rejeitadas", icon: XCircle, color: "text-destructive" },
          { key: "requires_changes", label: "Ajustes", icon: AlertTriangle, color: "text-orange-600" },
        ].map((kpi) => (
          <Card key={kpi.key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab(kpi.key)}>
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={cn("h-8 w-8", kpi.color)} />
              <div>
                <p className="text-2xl font-bold text-foreground">{counts[kpi.key as keyof typeof counts]}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
          <TabsTrigger value="requires_changes">Ajustes</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma prescrição encontrada</p>
            </div>
          ) : (
            filtered.map((p) => {
              const status = getValidationStatus(p);
              const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const StatusIcon = config.icon;
              const activeCount = p.items.filter((i) => !i.suspended).length;
              const highAlertCount = p.items.filter((i) => i.highAlert && !i.suspended).length;

              return (
                <Card
                  key={p.id}
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-all border-l-4",
                    status === "approved" && "border-l-primary",
                    status === "rejected" && "border-l-destructive",
                    status !== "approved" && status !== "rejected" && "border-l-muted-foreground"
                  )}
                  onClick={() => openValidation(p)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="patient-id font-semibold text-foreground truncate">{p.patient_name}</h3>
                          <Badge variant="outline" className={cn("text-xs border", config.color)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          {highAlertCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {highAlertCount} Alto Alerta
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Pill className="h-3 w-3" />
                            {activeCount} itens
                          </span>
                          <span>
                            {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          {p.validation?.validator_name && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {p.validation.validator_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Validation Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Validação Farmacêutica — <span className="patient-id">{selectedPrescription?.patient_name}</span>
            </DialogTitle>
            <DialogDescription>
              Confira dose, via, diluição, alergias e interações antes de aprovar.
            </DialogDescription>
          </DialogHeader>

          {selectedPrescription && (
            <div className="space-y-5">
              {/* Global Checks */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Checklist Global
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {[
                    { id: "dose", label: "Doses dentro do limite", state: doseCheck, setter: setDoseCheck, icon: Pill },
                    { id: "allergy", label: "Sem alergias identificadas", state: allergyCheck, setter: setAllergyCheck, icon: AlertTriangle },
                    { id: "interaction", label: "Sem interações críticas", state: interactionCheck, setter: setInteractionCheck, icon: FlaskConical },
                    { id: "dilution", label: "Diluições conferidas", state: dilutionCheck, setter: setDilutionCheck, icon: Syringe },
                  ].map((check) => (
                    <div
                      key={check.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        check.state ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30" : "bg-background border-border"
                      )}
                      onClick={() => check.setter(!check.state)}
                    >
                      <Checkbox checked={check.state} onCheckedChange={(v) => check.setter(!!v)} />
                      <check.icon className={cn("h-4 w-4", check.state ? "text-emerald-600" : "text-muted-foreground")} />
                      <span className={cn("text-sm", check.state ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* High Alert Warning */}
              {highAlertItems.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {highAlertItems.length} medicamento(s) de ALTO ALERTA — verificação dupla obrigatória
                  </p>
                  <ul className="mt-1 ml-6 text-xs text-destructive/80 list-disc">
                    {highAlertItems.map((i) => (
                      <li key={i.id}>{i.name} — {i.dose} {i.route}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Item-by-item review */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Revisão por Item ({activeItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activeItems.map((item) => {
                    const st = itemStatus[item.id] || "ok";
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          st === "ok" && "border-border",
                          st === "alert" && "border-orange-300 bg-orange-50 dark:bg-orange-950/20",
                          st === "rejected" && "border-destructive/40 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {item.highAlert && (
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              )}
                              <span className="font-medium text-sm text-foreground truncate">
                                {item.name}
                              </span>
                              {item.category && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {item.category}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {[item.dose, item.route, item.posology, item.schedule].filter(Boolean).join(" • ")}
                            </p>
                            {item.instructions && (
                              <p className="text-xs text-muted-foreground/70 italic mt-0.5">{item.instructions}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant={st === "ok" ? "default" : "outline"}
                              className="h-7 px-2 text-xs"
                              onClick={() => setItemStatus((prev) => ({ ...prev, [item.id]: "ok" }))}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant={st === "alert" ? "secondary" : "outline"}
                              className="h-7 px-2 text-xs"
                              onClick={() => setItemStatus((prev) => ({ ...prev, [item.id]: "alert" }))}
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant={st === "rejected" ? "destructive" : "outline"}
                              className="h-7 px-2 text-xs"
                              onClick={() => setItemStatus((prev) => ({ ...prev, [item.id]: "rejected" }))}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {(st === "alert" || st === "rejected") && (
                          <Input
                            className="mt-2 h-8 text-xs"
                            placeholder="Observação sobre este item..."
                            value={itemNotes[item.id] || ""}
                            onChange={(e) =>
                              setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* General Notes */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Observações Gerais
                </Label>
                <Textarea
                  placeholder="Notas da farmácia sobre a prescrição..."
                  value={validationNotes}
                  onChange={(e) => setValidationNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleSubmitValidation("requires_changes")}
              disabled={validating}
              className="flex-1"
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              Solicitar Ajustes
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleSubmitValidation("rejected")}
              disabled={validating}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Rejeitar
            </Button>
            <Button
              onClick={() => handleSubmitValidation("approved")}
              disabled={validating || !(doseCheck && allergyCheck && interactionCheck && dilutionCheck)}
              className="flex-1"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Aprovar Prescrição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};

export default ValidacaoFarmaceuticaPage;
