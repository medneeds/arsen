/**
 * Diálogo otimizado para "Solicitação de Exame Microbiológico" — espelha
 * o formulário oficial Norma Zero (PrintableCultureRequest).
 *
 * - Pré-carrega dados do paciente (incluindo mãe se < 18 anos).
 * - Catálogo fixo de culturas com checkbox + campo "amostras" para hemoculturas.
 * - Antecedentes (internação 30d, ATB 24h) e tipo (profilático/terapêutico).
 * - Persistência em `exam_requests` (category: `cultura`) para sincronizar
 *   com o Cockpit (`usePatientSpecialRequests`) e demais painéis.
 * - Pré-visualização React + impressão A4 popup.
 */

import { useEffect, useMemo, useState } from "react";
import { Printer, Eye, Microscope } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CollapsibleInfoCard } from "@/components/shared/CollapsibleInfoCard";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { supabase } from "@/integrations/supabase/client";
import { asUuidOrNull } from "@/lib/utils";
import { SECTOR_DISPLAY } from "@/contexts/DepartmentContext";
import { toast } from "sonner";
import {
  PrintableCultureRequest,
  printCultureRequest,
  type CultureRequestData,
} from "./PrintableCultureRequest";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId?: string | null;
  /** Fallback: nome/leito/setor quando o paciente é mock (sem UUID real). */
  patientName?: string;
  patientBed?: string;
  patientSector?: string;
}

interface CultureItem {
  key: string;
  label: string;
  hasSamples?: boolean;
  hasDetail?: boolean;
}

const CULTURE_ITEMS: CultureItem[] = [
  { key: "hemo_aerobio", label: "Hemocultura para aeróbios", hasSamples: true },
  { key: "hemo_anaerobio", label: "Hemocultura para anaeróbios", hasSamples: true },
  { key: "hemo_fungos", label: "Hemocultura para fungos" },
  { key: "urocultura", label: "Urocultura" },
  { key: "secrecao", label: "Secreção", hasDetail: true },
  { key: "fragmento", label: "Fragmento", hasDetail: true },
  { key: "swab", label: "SWAB", hasDetail: true },
  { key: "outros", label: "Outros", hasDetail: true },
];

function ageInYears(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
  return years;
}

interface SelectionState {
  [key: string]: { checked: boolean; samples?: string; detail?: string };
}

export function CultureRequestDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  patientBed,
  patientSector,
}: Props) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const [previewMode, setPreviewMode] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>({});
  const [data, setData] = useState<CultureRequestData>({
    patient_name: "",
    items: [],
    created_at: new Date().toISOString(),
  });

  // Pré-preenche com props (mock ou contexto da URL) imediatamente
  useEffect(() => {
    if (!open) return;
    setData((d) => ({
      ...d,
      patient_name: d.patient_name || patientName || "",
      patient_sector: d.patient_sector || patientSector || null,
      patient_bed: d.patient_bed || patientBed || null,
    }));
  }, [open, patientName, patientBed, patientSector]);

  // Pré-carrega dados do paciente (UUID real)
  useEffect(() => {
    if (!open || !patientId) return;
    (async () => {
      const { data: p } = await supabase
        .from("patients")
        .select("name, bed_number, sector, medical_record, patient_registry_id")
        .eq("id", patientId)
        .maybeSingle();
      if (!p) return;

      let registry: any = null;
      if (p.patient_registry_id) {
        const r = await supabase
          .from("patient_registry")
          .select("full_name, social_name, birth_date, cpf, cns, mother_name, medical_record")
          .eq("id", p.patient_registry_id)
          .maybeSingle();
        registry = r.data;
      }

      setData((d) => ({
        ...d,
        patient_name: registry?.full_name || p.name || d.patient_name,
        patient_social_name: registry?.social_name || null,
        patient_birth_date: registry?.birth_date || null,
        patient_cpf: registry?.cpf || null,
        patient_cns: registry?.cns || null,
        patient_record: registry?.medical_record || p.medical_record || null,
        patient_sector: p.sector || d.patient_sector,
        patient_bed: p.bed_number || d.patient_bed,
        mother_name: registry?.mother_name || null,
      }));
    })();
  }, [open, patientId]);

  // Pré-preenche médico solicitante
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.full_name) {
        setData((d) => ({ ...d, requested_by_name: prof.full_name }));
      }
    })();
  }, [open, user]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setSavedId(null);
      setPreviewMode(false);
    }
  }, [open]);

  const updateSel = (key: string, patch: Partial<SelectionState[string]>) => {
    setSelection((s) => ({
      ...s,
      [key]: { checked: false, ...s[key], ...patch },
    }));
  };

  const buildItems = (): CultureRequestData["items"] => {
    const out: CultureRequestData["items"] = [];
    for (const item of CULTURE_ITEMS) {
      const sel = selection[item.key];
      if (!sel?.checked) continue;
      if (item.hasSamples && sel.samples) {
        out.push({ name: item.label, samples: sel.samples });
      } else if (item.hasDetail && sel.detail) {
        out.push({ name: `${item.label}: ${sel.detail}` });
      } else {
        out.push({ name: item.label });
      }
    }
    return out;
  };

  const previewData = useMemo<CultureRequestData>(() => ({
    ...data,
    items: buildItems(),
    created_at: data.created_at || new Date().toISOString(),
  }), [data, selection]);

  const age = ageInYears(data.patient_birth_date);
  const isMinor = age !== null && age < 18;

  const persistRequest = async (): Promise<string | null> => {
    if (!currentHospital?.id || !currentState?.id) {
      toast.error("Selecione hospital/estado para salvar");
      return null;
    }
    if (!data.patient_name?.trim()) {
      toast.error("Informe o nome do paciente");
      return null;
    }
    const items = buildItems();
    if (items.length === 0) {
      toast.error("Selecione ao menos uma cultura");
      return null;
    }
    try {
      const payload: any = {
        category: "cultura",
        patient_id: asUuidOrNull(patientId),
        patient_name: data.patient_name,
        patient_bed: data.patient_bed || null,
        patient_sector: data.patient_sector || null,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        priority: "rotina",
        clinical_indication: data.clinical_indication || null,
        items,
        notes: [
          data.antibiotic_use ? `Uso ATB: ${data.antibiotic_use}` : null,
          data.hospitalized_last_30d != null
            ? `Internado 30d: ${data.hospitalized_last_30d ? "Sim" : "Não"}`
            : null,
          data.used_antibiotic_last_24h != null
            ? `ATB 24h: ${data.used_antibiotic_last_24h ? "Sim" : "Não"}${data.antibiotic_name ? " — " + data.antibiotic_name : ""}`
            : null,
          isMinor && data.mother_name ? `Mãe: ${data.mother_name}` : null,
        ].filter(Boolean).join("\n") || null,
        requested_by: user?.id || null,
        requested_by_name: data.requested_by_name || null,
        status: "pending",
      };
      if (savedId) {
        const { error } = await supabase.from("exam_requests").update(payload).eq("id", savedId);
        if (error) throw error;
        return savedId;
      }
      const { data: inserted, error } = await supabase
        .from("exam_requests")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      setSavedId(inserted.id);
      return inserted.id;
    } catch (e: any) {
      console.error("[CultureRequestDialog] persist error", e);
      toast.error(e?.message || "Erro ao salvar solicitação");
      return null;
    }
  };

  const handleSaveOnly = async () => {
    const id = await persistRequest();
    if (id) toast.success("Solicitação de cultura registrada — visível no Cockpit");
  };

  const handlePrint = async () => {
    await persistRequest();
    printCultureRequest({ ...data, items: buildItems(), created_at: new Date().toISOString() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-emerald-500" />
            Solicitação de Exame Microbiológico
          </DialogTitle>
          <DialogDescription>
            Preencha o formulário no padrão hospitalar — geração automática do documento Norma Zero.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={previewMode ? "outline" : "default"}
              size="sm"
              onClick={() => setPreviewMode(false)}
            >
              Preencher
            </Button>
            <Button
              variant={previewMode ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewMode(true)}
            >
              <Eye className="h-4 w-4 mr-1" /> Pré-visualizar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveOnly} size="sm" variant="outline">
              Salvar no Cockpit
            </Button>
            <Button onClick={handlePrint} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Printer className="h-4 w-4 mr-1" /> Salvar e Imprimir
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          {previewMode ? (
            <PrintableCultureRequest request={previewData} />
          ) : (
            <div className="space-y-4">
              {/* Bloco retrátil — paciente já carregado */}
              <CollapsibleInfoCard
                title="Identificação do paciente"
                summary={data.patient_name || "—"}
                badge={[data.patient_sector, data.patient_bed].filter(Boolean).join(" · ") || undefined}
              >
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome completo" full>
                    <Input value={data.patient_name} onChange={(e) => setData({ ...data, patient_name: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Nome social">
                    <Input value={data.patient_social_name || ""} onChange={(e) => setData({ ...data, patient_social_name: e.target.value })} />
                  </Field>
                  <Field label="Data de nascimento">
                    <Input type="date" value={data.patient_birth_date || ""} onChange={(e) => setData({ ...data, patient_birth_date: e.target.value })} />
                  </Field>
                  <Field label="CPF">
                    <Input value={data.patient_cpf || ""} onChange={(e) => setData({ ...data, patient_cpf: e.target.value })} placeholder="000.000.000-00" />
                  </Field>
                  <Field label="CNS">
                    <Input value={data.patient_cns || ""} onChange={(e) => setData({ ...data, patient_cns: e.target.value })} />
                  </Field>
                  <Field label="N° prontuário">
                    <Input value={data.patient_record || ""} onChange={(e) => setData({ ...data, patient_record: e.target.value })} />
                  </Field>
                  <Field label="Setor">
                    <Input value={data.patient_sector || ""} onChange={(e) => setData({ ...data, patient_sector: e.target.value })} />
                  </Field>
                  <Field label="Leito">
                    <Input value={data.patient_bed || ""} onChange={(e) => setData({ ...data, patient_bed: e.target.value })} />
                  </Field>
                  {(isMinor || data.mother_name) && (
                    <>
                      <Field label={`Nome da mãe${isMinor ? " (obrigatório — menor de 18 anos)" : ""}`} full>
                        <Input value={data.mother_name || ""} onChange={(e) => setData({ ...data, mother_name: e.target.value.toUpperCase() })} />
                      </Field>
                      <Field label="Data de nascimento da mãe">
                        <Input type="date" value={data.mother_birth_date || ""} onChange={(e) => setData({ ...data, mother_birth_date: e.target.value })} />
                      </Field>
                    </>
                  )}
                </div>
              </CollapsibleInfoCard>

              {/* PRINCIPAL — Culturas em evidência */}
              <div className="rounded-lg border-2 border-emerald-500/30 ring-1 ring-emerald-500/10 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  <Microscope className="h-4 w-4" /> Culturas solicitadas
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione as culturas com TSA (Teste de Sensibilidade aos Antimicrobianos).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {CULTURE_ITEMS.map((item) => {
                    const sel = selection[item.key];
                    const isChecked = !!sel?.checked;
                    return (
                      <div
                        key={item.key}
                        className={`border rounded-md p-2.5 transition-colors ${isChecked ? "border-emerald-500/60 bg-card" : "border-border bg-card/60 hover:bg-accent/40"}`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`cult-${item.key}`}
                            checked={isChecked}
                            onCheckedChange={(v) => updateSel(item.key, { checked: !!v })}
                          />
                          <Label htmlFor={`cult-${item.key}`} className="text-sm font-medium cursor-pointer flex-1">
                            {item.label}
                          </Label>
                        </div>
                        {isChecked && item.hasSamples && (
                          <div className="mt-2 pl-6 flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Amostras:</Label>
                            <Input
                              className="h-7 max-w-[100px] text-sm"
                              value={sel.samples || ""}
                              onChange={(e) => updateSel(item.key, { samples: e.target.value })}
                              placeholder="ex.: 2"
                            />
                          </div>
                        )}
                        {isChecked && item.hasDetail && (
                          <div className="mt-2 pl-6">
                            <Input
                              className="h-7 text-sm"
                              value={sel.detail || ""}
                              onChange={(e) => updateSel(item.key, { detail: e.target.value })}
                              placeholder={
                                item.key === "secrecao"
                                  ? "ex.: ferida operatória, traqueal..."
                                  : item.key === "fragmento"
                                  ? "ex.: tecido subcutâneo, óssea..."
                                  : item.key === "swab"
                                  ? "ex.: nasal, axilar, retal..."
                                  : "Especifique"
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Antecedentes — compactos */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Antecedentes</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Internado nos últimos 30 dias?</Label>
                    <RadioGroup
                      value={String(data.hospitalized_last_30d ?? "")}
                      onValueChange={(v) => setData({ ...data, hospitalized_last_30d: v === "true" })}
                      className="flex gap-3"
                    >
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="true" id="h30-s" /><Label htmlFor="h30-s" className="text-xs">Sim</Label></div>
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="false" id="h30-n" /><Label htmlFor="h30-n" className="text-xs">Não</Label></div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">ATB nas últimas 24h?</Label>
                    <RadioGroup
                      value={String(data.used_antibiotic_last_24h ?? "")}
                      onValueChange={(v) => setData({ ...data, used_antibiotic_last_24h: v === "true" })}
                      className="flex gap-3"
                    >
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="true" id="atb24-s" /><Label htmlFor="atb24-s" className="text-xs">Sim</Label></div>
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="false" id="atb24-n" /><Label htmlFor="atb24-n" className="text-xs">Não</Label></div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de uso</Label>
                    <RadioGroup
                      value={data.antibiotic_use || ""}
                      onValueChange={(v) => setData({ ...data, antibiotic_use: v as "profilatico" | "terapeutico" })}
                      className="flex gap-3"
                    >
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="profilatico" id="atbu-p" /><Label htmlFor="atbu-p" className="text-xs">Profilático</Label></div>
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="terapeutico" id="atbu-t" /><Label htmlFor="atbu-t" className="text-xs">Terapêutico</Label></div>
                    </RadioGroup>
                  </div>
                </div>

                {data.used_antibiotic_last_24h && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Qual antibiótico?</Label>
                      <Input
                        value={data.antibiotic_name || ""}
                        onChange={(e) => setData({ ...data, antibiotic_name: e.target.value })}
                        placeholder="ex.: Ceftriaxona 1g 12/12h"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Início</Label>
                      <Input
                        type="date"
                        value={data.antibiotic_start_date || ""}
                        onChange={(e) => setData({ ...data, antibiotic_start_date: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <Field label="Justificativa clínica (opcional)" full>
                  <Textarea
                    rows={2}
                    value={data.clinical_indication || ""}
                    onChange={(e) => setData({ ...data, clinical_indication: e.target.value })}
                    placeholder="Hipótese diagnóstica, suspeita de foco infeccioso, etc."
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Médico solicitante">
                    <Input
                      value={data.requested_by_name || ""}
                      onChange={(e) => setData({ ...data, requested_by_name: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700">
            <Printer className="h-4 w-4 mr-1" /> Salvar e Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
