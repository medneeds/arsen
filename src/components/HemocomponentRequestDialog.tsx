/**
 * Diálogo para gerar a Solicitação de Sangue / Hemocomponentes seguindo
 * o padrão Socorrão I. Pré-carrega dados do paciente quando informado.
 *
 * - Visualização React (PrintableHemocomponentRequest) + impressão real (popup A4).
 * - Multi-select de setores, hemocomponentes (com quantidades, atributos e justificativa lab),
 *   histórico transfusional, tipo de transfusão e dados do médico solicitante.
 */

import { useEffect, useMemo, useState } from "react";
import { Printer, Eye, Droplet } from "lucide-react";
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
import { toast } from "sonner";
import {
  PrintableHemocomponentRequest,
  printHemocomponentRequest,
  type HemocomponentRequestData,
  type SectorKey,
  type ComponentKey,
  type TransfusionType,
} from "./PrintableHemocomponentRequest";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pré-carrega dados a partir de um paciente já registrado (opcional). */
  patientId?: string | null;
  /** Fallback: nome/leito/setor quando o paciente é mock (sem UUID real). */
  patientName?: string;
  patientBed?: string;
  patientSector?: string;
}

const SECTOR_GROUPS: Array<{ title: string; items: Array<{ key: SectorKey; label: string }> }> = [
  { title: "Pronto Socorro", items: [
    { key: "sala_vermelha", label: "Sala Vermelha" },
    { key: "sala_laranja", label: "Sala Laranja" },
    { key: "sala_decisao", label: "Sala de decisão médica" },
    { key: "retaguarda_ps1", label: "Retaguarda PS1" },
    { key: "retaguarda_ps2", label: "Retaguarda PS2" },
    { key: "corredor_ps", label: "Corredor PS" },
  ]},
  { title: "Centro Cirúrgico", items: [
    { key: "cc_preparo", label: "Preparo" },
    { key: "cc_bloco", label: "Bloco" },
    { key: "cc_srpa", label: "SRPA" },
  ]},
  { title: "UTI", items: [
    { key: "uti_1", label: "UTI 1" },
    { key: "uti_2", label: "UTI 2" },
  ]},
  { title: "Clínicas", items: [
    { key: "clinica_cirurgica", label: "Clínica Cirúrgica" },
    { key: "neurocirurgia", label: "Neurocirurgia" },
    { key: "cardiologia", label: "Cardiologia" },
    { key: "uci", label: "UCI" },
    { key: "pediatria", label: "Pediatria" },
  ]},
];

const COMPONENT_KEYS: ComponentKey[] = ["hemacias", "plaquetas", "plasma", "crio"];
const COMPONENT_LABELS: Record<ComponentKey, string> = {
  hemacias: "Conc. de Hemácias",
  plaquetas: "Conc. de Plaquetas",
  plasma: "Plasma Fresco Congelado",
  crio: "Crioprecipitado",
};

export function HemocomponentRequestDialog({
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
  const [data, setData] = useState<HemocomponentRequestData>({
    patient_name: "",
    components: [],
    transfusion_sectors: [],
    obstetric_history: {},
    created_at: new Date().toISOString(),
  });

  // Pré-preenche com props (mock ou contexto da URL) imediatamente
  useEffect(() => {
    if (!open) return;
    setData((d) => ({
      ...d,
      patient_name: d.patient_name || patientName || "",
      patient_unit: d.patient_unit || patientSector || null,
      patient_bed: d.patient_bed || patientBed || null,
    }));
  }, [open, patientName, patientBed, patientSector]);

  // Pré-carrega dados do paciente quando fornecido (UUID real)
  useEffect(() => {
    if (!open || !patientId) return;
    (async () => {
      const { data: p } = await supabase
        .from("patients")
        .select("name, bed_number, sector, medical_record, diagnoses, patient_registry_id")
        .eq("id", patientId)
        .maybeSingle();
      if (!p) return;

      let registry: any = null;
      if (p.patient_registry_id) {
        const r = await supabase
          .from("patient_registry")
          .select("full_name, social_name, birth_date, sex, blood_type, medical_record")
          .eq("id", p.patient_registry_id)
          .maybeSingle();
        registry = r.data;
      }

      setData((d) => ({
        ...d,
        patient_name: registry?.full_name || p.name || d.patient_name,
        patient_social_name: registry?.social_name || null,
        patient_birth_date: registry?.birth_date || null,
        patient_sex: registry?.sex || null,
        patient_blood_group: registry?.blood_type || null,
        patient_record: registry?.medical_record || p.medical_record || null,
        patient_unit: p.sector || d.patient_unit,
        patient_bed: p.bed_number || d.patient_bed,
        patient_diagnosis: p.diagnoses || null,
      }));
    })();
  }, [open, patientId]);

  // Pré-preenche dados do médico solicitante
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, crm")
        .eq("id", user.id)
        .maybeSingle();
      if (prof) {
        setData((d) => ({
          ...d,
          requested_by_name: prof.full_name,
          requested_by_crm: prof.crm,
        }));
      }
    })();
  }, [open, user]);

  const previewData = useMemo<HemocomponentRequestData>(() => ({
    ...data,
    created_at: data.created_at || new Date().toISOString(),
  }), [data]);

  const toggleSector = (key: SectorKey, checked: boolean) => {
    setData((d) => ({
      ...d,
      transfusion_sectors: checked
        ? [...(d.transfusion_sectors || []), key]
        : (d.transfusion_sectors || []).filter((k) => k !== key),
    }));
  };

  const toggleComponent = (key: ComponentKey, checked: boolean) => {
    setData((d) => {
      const current = d.components || [];
      if (checked) {
        if (current.find((c) => c.key === key)) return d;
        return { ...d, components: [...current, { key }] };
      } else {
        return { ...d, components: current.filter((c) => c.key !== key) };
      }
    });
  };

  const updateComponent = (key: ComponentKey, patch: Record<string, any>) => {
    setData((d) => ({
      ...d,
      components: (d.components || []).map((c) => (c.key === key ? { ...c, ...patch } : c)),
    }));
  };

  const getComponent = (key: ComponentKey) => (data.components || []).find((c) => c.key === key);
  const isComponentActive = (key: ComponentKey) => Boolean(getComponent(key));

  const persistRequest = async (): Promise<string | null> => {
    if (!currentHospital?.id || !currentState?.id) {
      toast.error("Selecione hospital/estado para salvar");
      return null;
    }
    if (!data.patient_name?.trim()) {
      toast.error("Informe o nome do paciente");
      return null;
    }
    if (!data.components || data.components.length === 0) {
      toast.error("Selecione ao menos um hemocomponente");
      return null;
    }
    try {
      const items = (data.components || []).map((c) => ({
        name: COMPONENT_LABELS[c.key],
        key: c.key,
        quantity: (c as any).quantity || null,
        attributes: (c as any).attributes || null,
        lab_justification: (c as any).lab_justification || null,
      }));
      const payload: any = {
        category: "hemocomponente",
        patient_id: asUuidOrNull(patientId),
        patient_name: data.patient_name,
        patient_bed: data.patient_bed || null,
        patient_sector: data.patient_unit || null,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        priority: data.transfusion_type === "emergencia" || data.transfusion_type === "programada"
          ? "urgente"
          : "rotina",
        clinical_indication: [
          data.transfusion_type ? `Tipo: ${data.transfusion_type}` : null,
          data.patient_diagnosis ? `Dx: ${data.patient_diagnosis}` : null,
        ].filter(Boolean).join(" | "),
        items,
        notes: [
          data.requested_by_name ? `Médico: ${data.requested_by_name}${data.requested_by_crm ? " — CRM " + data.requested_by_crm : ""}` : null,
          data.transfusion_sectors && data.transfusion_sectors.length > 0
            ? `Setores: ${data.transfusion_sectors.join(", ")}`
            : null,
        ].filter(Boolean).join("\n"),
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
      console.error("[HemocomponentRequestDialog] persist error", e);
      toast.error(e?.message || "Erro ao salvar solicitação");
      return null;
    }
  };

  const handleSaveOnly = async () => {
    const id = await persistRequest();
    if (id) toast.success("Solicitação registrada — visível no Cockpit");
  };

  const handlePrint = async () => {
    await persistRequest();
    printHemocomponentRequest({ ...data, created_at: new Date().toISOString() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5 text-rose-500" />
            Solicitação de Sangue / Hemocomponentes
          </DialogTitle>
          <DialogDescription>
            Padrão hospitalar Socorrão I — preencha os dados e gere o documento para impressão.
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
            <Button onClick={handlePrint} size="sm" className="bg-rose-500 hover:bg-rose-600">
              <Printer className="h-4 w-4 mr-1" /> Salvar e Imprimir
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          {previewMode ? (
            <PrintableHemocomponentRequest request={previewData} />
          ) : (
            <Tabs defaultValue="patient" className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="patient">Paciente</TabsTrigger>
                <TabsTrigger value="transfusion">Transfusão</TabsTrigger>
                <TabsTrigger value="components">Hemocomponentes</TabsTrigger>
                <TabsTrigger value="history">Histórico & Tipo</TabsTrigger>
              </TabsList>

              {/* Paciente */}
              <TabsContent value="patient" className="space-y-3">
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
                  <Field label="Sexo">
                    <RadioGroup value={String(data.patient_sex || "")} onValueChange={(v) => setData({ ...data, patient_sex: v })} className="flex gap-4 pt-2">
                      <div className="flex items-center gap-2"><RadioGroupItem value="F" id="sx-f" /><Label htmlFor="sx-f">Feminino</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="M" id="sx-m" /><Label htmlFor="sx-m">Masculino</Label></div>
                    </RadioGroup>
                  </Field>
                  <Field label="Grupo sanguíneo (ABO/RH)">
                    <Input value={data.patient_blood_group || ""} onChange={(e) => setData({ ...data, patient_blood_group: e.target.value })} placeholder="ex.: O+" />
                  </Field>
                  <Field label="Peso (kg)">
                    <Input value={String(data.patient_weight ?? "")} onChange={(e) => setData({ ...data, patient_weight: e.target.value })} />
                  </Field>
                  <Field label="N° prontuário">
                    <Input value={data.patient_record || ""} onChange={(e) => setData({ ...data, patient_record: e.target.value })} />
                  </Field>
                  <Field label="Raça">
                    <Input value={data.patient_race || ""} onChange={(e) => setData({ ...data, patient_race: e.target.value })} />
                  </Field>
                  <Field label="Unidade / Setor">
                    <Input value={data.patient_unit || ""} onChange={(e) => setData({ ...data, patient_unit: e.target.value })} />
                  </Field>
                  <Field label="Leito">
                    <Input value={data.patient_bed || ""} onChange={(e) => setData({ ...data, patient_bed: e.target.value })} />
                  </Field>
                  <Field label="Diagnóstico" full>
                    <Textarea rows={2} value={data.patient_diagnosis || ""} onChange={(e) => setData({ ...data, patient_diagnosis: e.target.value })} />
                  </Field>
                </div>
              </TabsContent>

              {/* Transfusão (setores) */}
              <TabsContent value="transfusion" className="space-y-3">
                <p className="text-sm text-muted-foreground">Selecione o(s) setor(es) onde a transfusão será realizada:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {SECTOR_GROUPS.map((g) => (
                    <div key={g.title} className="border rounded-md p-3">
                      <div className="text-xs font-bold uppercase text-center mb-2 text-muted-foreground">{g.title}</div>
                      <div className="space-y-1.5">
                        {g.items.map((it) => (
                          <div key={it.key} className="flex items-center gap-2">
                            <Checkbox
                              id={`sec-${it.key}`}
                              checked={(data.transfusion_sectors || []).includes(it.key)}
                              onCheckedChange={(c) => toggleSector(it.key, !!c)}
                            />
                            <Label htmlFor={`sec-${it.key}`} className="text-sm cursor-pointer">{it.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Hemocomponentes */}
              <TabsContent value="components" className="space-y-3">
                {COMPONENT_KEYS.map((k) => {
                  const c = getComponent(k);
                  const active = isComponentActive(k);
                  return (
                    <div key={k} className="border rounded-md p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox id={`cmp-${k}`} checked={active} onCheckedChange={(v) => toggleComponent(k, !!v)} />
                        <Label htmlFor={`cmp-${k}`} className="text-base font-bold cursor-pointer">{COMPONENT_LABELS[k]}</Label>
                      </div>
                      {active && (
                        <div className="grid grid-cols-2 gap-3 pl-6 text-sm">
                          <Field label="Quantidade">
                            <Input value={String(c?.quantity ?? "")} onChange={(e) => updateComponent(k, { quantity: e.target.value })} />
                          </Field>
                          {(k === "hemacias" || k === "plaquetas") && (
                            <div className="col-span-2 flex flex-wrap gap-4 pt-1">
                              <div className="flex items-center gap-2">
                                <Checkbox id={`${k}-des`} checked={!!c?.desleucocitado} onCheckedChange={(v) => updateComponent(k, { desleucocitado: !!v })} />
                                <Label htmlFor={`${k}-des`} className="cursor-pointer">Desleucocitado / Filtrado</Label>
                              </div>
                              {k === "hemacias" && (
                                <div className="flex items-center gap-2">
                                  <Checkbox id={`${k}-lav`} checked={!!c?.lavado} onCheckedChange={(v) => updateComponent(k, { lavado: !!v })} />
                                  <Label htmlFor={`${k}-lav`} className="cursor-pointer">Lavado</Label>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Checkbox id={`${k}-irr`} checked={!!c?.irradiado} onCheckedChange={(v) => updateComponent(k, { irradiado: !!v })} />
                                <Label htmlFor={`${k}-irr`} className="cursor-pointer">Irradiado</Label>
                              </div>
                            </div>
                          )}
                          {k === "plasma" && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Administração</Label>
                              <RadioGroup value={c?.admin_schedule || ""} onValueChange={(v) => updateComponent(k, { admin_schedule: v })} className="flex gap-4 pt-1">
                                <div className="flex items-center gap-2"><RadioGroupItem value="8_8h" id="pl-88" /><Label htmlFor="pl-88">8/8 Horas</Label></div>
                                <div className="flex items-center gap-2"><RadioGroupItem value="continuo" id="pl-co" /><Label htmlFor="pl-co">Contínuo</Label></div>
                              </RadioGroup>
                            </div>
                          )}
                          <Separator className="col-span-2 my-1" />
                          <div className="col-span-2 text-xs font-bold uppercase text-muted-foreground">Justificativa Laboratorial</div>
                          {k === "hemacias" && (
                            <>
                              <Field label="Hb"><Input value={c?.lab_hb || ""} onChange={(e) => updateComponent(k, { lab_hb: e.target.value })} /></Field>
                              <Field label="Ht"><Input value={c?.lab_ht || ""} onChange={(e) => updateComponent(k, { lab_ht: e.target.value })} /></Field>
                            </>
                          )}
                          {k === "plaquetas" && (
                            <Field label="N° de plaquetas" full><Input value={c?.lab_platelets || ""} onChange={(e) => updateComponent(k, { lab_platelets: e.target.value })} /></Field>
                          )}
                          {k === "plasma" && (
                            <>
                              <Field label="TAP"><Input value={c?.lab_tap || ""} onChange={(e) => updateComponent(k, { lab_tap: e.target.value })} /></Field>
                              <Field label="TTPA"><Input value={c?.lab_ttpa || ""} onChange={(e) => updateComponent(k, { lab_ttpa: e.target.value })} /></Field>
                              <Field label="RNI"><Input value={c?.lab_rni || ""} onChange={(e) => updateComponent(k, { lab_rni: e.target.value })} /></Field>
                            </>
                          )}
                          {k === "crio" && (
                            <Field label="Fibrinogênio" full><Input value={c?.lab_fibrinogen || ""} onChange={(e) => updateComponent(k, { lab_fibrinogen: e.target.value })} /></Field>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </TabsContent>

              {/* Histórico & Tipo */}
              <TabsContent value="history" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Transfusões prévias?</Label>
                    <RadioGroup value={String(data.previous_transfusion ?? "")} onValueChange={(v) => setData({ ...data, previous_transfusion: v === "true" })} className="flex gap-4">
                      <div className="flex items-center gap-2"><RadioGroupItem value="true" id="pt-s" /><Label htmlFor="pt-s">Sim</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="false" id="pt-n" /><Label htmlFor="pt-n">Não</Label></div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Reação transfusional?</Label>
                    <RadioGroup value={String(data.transfusion_reaction ?? "")} onValueChange={(v) => setData({ ...data, transfusion_reaction: v === "true" })} className="flex gap-4">
                      <div className="flex items-center gap-2"><RadioGroupItem value="true" id="rt-s" /><Label htmlFor="rt-s">Sim</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="false" id="rt-n" /><Label htmlFor="rt-n">Não</Label></div>
                    </RadioGroup>
                  </div>
                  <Field label="Tipo de reação" full>
                    <Input value={data.reaction_type || ""} onChange={(e) => setData({ ...data, reaction_type: e.target.value })} />
                  </Field>
                  <Field label="Gesta">
                    <Input value={String(data.obstetric_history?.gesta ?? "")} onChange={(e) => setData({ ...data, obstetric_history: { ...data.obstetric_history, gesta: e.target.value } })} />
                  </Field>
                  <Field label="Parto">
                    <Input value={String(data.obstetric_history?.parto ?? "")} onChange={(e) => setData({ ...data, obstetric_history: { ...data.obstetric_history, parto: e.target.value } })} />
                  </Field>
                  <Field label="Aborto">
                    <Input value={String(data.obstetric_history?.aborto ?? "")} onChange={(e) => setData({ ...data, obstetric_history: { ...data.obstetric_history, aborto: e.target.value } })} />
                  </Field>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase">Tipo de Transfusão</Label>
                  <RadioGroup value={data.transfusion_type || ""} onValueChange={(v) => setData({ ...data, transfusion_type: v as TransfusionType })} className="space-y-2">
                    <div className="flex items-center gap-2"><RadioGroupItem value="programada" id="tt-p" /><Label htmlFor="tt-p">Programada</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="rotina" id="tt-r" /><Label htmlFor="tt-r">De rotina (até 24h)</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="urgencia" id="tt-u" /><Label htmlFor="tt-u">De urgência (até 3h)</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="emergencia" id="tt-e" /><Label htmlFor="tt-e">De emergência (risco de vida)</Label></div>
                  </RadioGroup>

                  {data.transfusion_type === "programada" && (
                    <div className="grid grid-cols-2 gap-3 pl-6">
                      <Field label="Data programada">
                        <Input type="date" value={data.scheduled_date || ""} onChange={(e) => setData({ ...data, scheduled_date: e.target.value })} />
                      </Field>
                      <Field label="Horário">
                        <Input type="time" value={data.scheduled_time || ""} onChange={(e) => setData({ ...data, scheduled_time: e.target.value })} />
                      </Field>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Médico solicitante">
                    <Input value={data.requested_by_name || ""} onChange={(e) => setData({ ...data, requested_by_name: e.target.value })} />
                  </Field>
                  <Field label="CRM">
                    <Input value={data.requested_by_crm || ""} onChange={(e) => setData({ ...data, requested_by_crm: e.target.value })} />
                  </Field>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </ScrollArea>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handlePrint} className="bg-rose-500 hover:bg-rose-600">
            <Printer className="h-4 w-4 mr-1" /> Gerar e Imprimir
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
