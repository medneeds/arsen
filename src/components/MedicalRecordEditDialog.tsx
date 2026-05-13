import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, History, Loader2, Save, AlertTriangle, IdCard, Upload, FileWarning,
} from "lucide-react";
import { MovementConfirmDialog } from "./MovementConfirmDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  patientName: string;
  /** Recarrega dados externos depois que salvar */
  onSaved?: () => void;
}

interface MedicalRecordRow {
  id: string;
  numero_prontuario: string | null;
  numero_prontuario_legado: string | null;
  is_legacy: boolean | null;
  generation_mode: string | null;
}

interface RegistryRow {
  id: string;
  full_name: string | null;
  social_name: string | null;
  cpf: string | null;
  cns: string | null;
  birth_date: string | null;
  sex: string | null;
  mother_name: string | null;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  blood_type: string | null;
  allergies: string | null;
  comorbidities: string | null;
  medical_record: string | null;
  is_unidentified: boolean | null;
  unidentified_features: any;
}

interface MrHistoryRow {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_by_email: string | null;
  changed_at: string;
}

interface RegHistoryRow extends MrHistoryRow {
  source: string | null;
}

const MR_FIELD_LABEL: Record<string, string> = {
  numero_prontuario: "Nº do Prontuário",
  numero_prontuario_legado: "Nº Legado / PIN",
};

const REG_FIELD_LABEL: Record<string, string> = {
  full_name: "Nome completo",
  social_name: "Nome social",
  cpf: "CPF",
  cns: "Cartão SUS",
  birth_date: "Data de nascimento",
  sex: "Sexo",
  mother_name: "Nome da mãe",
  phone: "Telefone",
  address: "Endereço",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
  blood_type: "Tipo sanguíneo",
  allergies: "Alergias",
  comorbidities: "Comorbidades",
  medical_record: "Prontuário PIS/legado",
};

const REG_EDITABLE: (keyof RegistryRow)[] = [
  "full_name", "social_name", "cpf", "cns", "birth_date", "sex",
  "mother_name", "phone", "address", "neighborhood", "city", "state",
  "blood_type", "allergies", "comorbidities", "medical_record",
];

const UPPER_FIELDS = new Set([
  "full_name", "social_name", "mother_name", "address", "neighborhood", "city", "state",
  "allergies", "comorbidities",
]);

export function MedicalRecordEditDialog({
  open, onOpenChange, patientId, patientName, onSaved,
}: Props) {
  const [tab, setTab] = useState<"prontuario" | "ficha" | "historico">("prontuario");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Prontuário
  const [record, setRecord] = useState<MedicalRecordRow | null>(null);
  const [numero, setNumero] = useState("");
  const [legado, setLegado] = useState("");
  const [mrReason, setMrReason] = useState("");

  // Ficha cadastral
  const [registry, setRegistry] = useState<RegistryRow | null>(null);
  const [reg, setReg] = useState<Partial<RegistryRow>>({});
  const [regReason, setRegReason] = useState("");
  const [importing, setImporting] = useState(false);

  // Histórico
  const [mrHistory, setMrHistory] = useState<MrHistoryRow[]>([]);
  const [regHistory, setRegHistory] = useState<RegHistoryRow[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"prontuario" | "ficha">("prontuario");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !patientId) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId]);

  async function loadData() {
    setLoading(true);
    try {
      // 1) medical_records
      const { data: rec } = await supabase
        .from("medical_records")
        .select("id, numero_prontuario, numero_prontuario_legado, is_legacy, generation_mode, patient_registry_id")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let regRow: RegistryRow | null = null;
      let registryId: string | null = (rec as any)?.patient_registry_id || null;

      // 2) patients.patient_registry_id como fallback
      if (!registryId) {
        const { data: pat } = await supabase
          .from("patients")
          .select("patient_registry_id")
          .eq("id", patientId)
          .maybeSingle();
        registryId = (pat as any)?.patient_registry_id || null;
      }

      if (registryId) {
        const { data: r } = await supabase
          .from("patient_registry")
          .select("*")
          .eq("id", registryId)
          .maybeSingle();
        regRow = (r as RegistryRow) || null;
      }

      if (rec) {
        setRecord(rec as MedicalRecordRow);
        setNumero(rec.numero_prontuario || "");
        setLegado(rec.numero_prontuario_legado || "");

        const { data: hist } = await supabase
          .from("medical_record_edit_history")
          .select("id, field_changed, old_value, new_value, reason, changed_by_email, changed_at")
          .eq("medical_record_id", rec.id)
          .order("changed_at", { ascending: false })
          .limit(50);
        setMrHistory((hist as MrHistoryRow[]) || []);
      } else {
        setRecord(null);
        setMrHistory([]);
      }

      setRegistry(regRow);
      setReg(regRow ? { ...regRow } : {});
      setMrReason("");
      setRegReason("");

      if (regRow?.id) {
        const { data: rh } = await supabase
          .from("patient_registry_edit_history" as any)
          .select("id, field_changed, old_value, new_value, reason, changed_by_email, changed_at, source")
          .eq("patient_registry_id", regRow.id)
          .order("changed_at", { ascending: false })
          .limit(80);
        setRegHistory((rh as unknown as RegHistoryRow[]) || []);
      } else {
        setRegHistory([]);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ===== Diffs =====
  const mrChanges = useMemo(() => {
    const out: { field: string; oldVal: string; newVal: string }[] = [];
    if (record) {
      if ((record.numero_prontuario || "") !== numero.trim()) {
        out.push({ field: "numero_prontuario", oldVal: record.numero_prontuario || "", newVal: numero.trim() });
      }
      if ((record.numero_prontuario_legado || "") !== legado.trim()) {
        out.push({ field: "numero_prontuario_legado", oldVal: record.numero_prontuario_legado || "", newVal: legado.trim() });
      }
    }
    return out;
  }, [record, numero, legado]);

  const regChanges = useMemo(() => {
    const out: { field: string; oldVal: string; newVal: string }[] = [];
    if (!registry) return out;
    for (const k of REG_EDITABLE) {
      const before = (registry[k] ?? "") as string;
      const after = (reg[k] ?? "") as string;
      const a = (before || "").toString().trim();
      const b = (after || "").toString().trim();
      if (a !== b) out.push({ field: k as string, oldVal: a, newVal: b });
    }
    return out;
  }, [registry, reg]);

  const setRegField = (k: keyof RegistryRow, v: string) => {
    const val = UPPER_FIELDS.has(k as string) ? v.toUpperCase() : v;
    setReg((prev) => ({ ...prev, [k]: val }));
  };

  // ===== Save Prontuário =====
  function tryConfirmProntuario() {
    if (!mrChanges.length) {
      toast({ title: "Nenhuma alteração no prontuário" });
      return;
    }
    if (mrReason.trim().length < 5) {
      toast({ title: "Motivo obrigatório", description: "Mínimo 5 caracteres.", variant: "destructive" });
      return;
    }
    setConfirmKind("prontuario");
    setConfirmOpen(true);
  }

  async function saveProntuario() {
    if (!record) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const userEmail = u?.user?.email;

      const updatePayload: Record<string, any> = {};
      for (const c of mrChanges) updatePayload[c.field] = (c.newVal || null);

      const { error: upErr } = await supabase
        .from("medical_records").update(updatePayload).eq("id", record.id);
      if (upErr) throw upErr;

      const { error: hErr } = await supabase
        .from("medical_record_edit_history")
        .insert(mrChanges.map((c) => ({
          medical_record_id: record.id,
          patient_id: patientId,
          field_changed: c.field,
          old_value: c.oldVal || null,
          new_value: c.newVal || null,
          reason: mrReason.trim(),
          changed_by: userId,
          changed_by_email: userEmail,
        })));
      if (hErr) throw hErr;

      toast({ title: "✅ Prontuário atualizado", description: `${mrChanges.length} campo(s) alterado(s).` });
      setConfirmOpen(false);
      await loadData();
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ===== Save Ficha =====
  function tryConfirmFicha() {
    if (!regChanges.length) {
      toast({ title: "Nenhuma alteração na ficha cadastral" });
      return;
    }
    if (regReason.trim().length < 5) {
      toast({ title: "Motivo obrigatório", description: "Mínimo 5 caracteres.", variant: "destructive" });
      return;
    }
    setConfirmKind("ficha");
    setConfirmOpen(true);
  }

  async function saveFicha(source: "manual" | "pis_import" = "manual") {
    if (!registry) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const userEmail = u?.user?.email;

      const updatePayload: Record<string, any> = {};
      for (const c of regChanges) updatePayload[c.field] = (c.newVal || null);

      const { error: upErr } = await supabase
        .from("patient_registry").update(updatePayload).eq("id", registry.id);
      if (upErr) throw upErr;

      const { error: hErr } = await supabase
        .from("patient_registry_edit_history" as any)
        .insert(regChanges.map((c) => ({
          patient_registry_id: registry.id,
          patient_id: patientId,
          field_changed: c.field,
          old_value: c.oldVal || null,
          new_value: c.newVal || null,
          reason: regReason.trim(),
          source,
          changed_by: userId,
          changed_by_email: userEmail,
        })));
      if (hErr) throw hErr;

      toast({ title: "✅ Ficha cadastral atualizada", description: `${regChanges.length} campo(s) alterado(s).` });
      setConfirmOpen(false);
      await loadData();
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao salvar ficha", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ===== Import PIS =====
  async function handlePisFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10 MB", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const resp = await supabase.functions.invoke("extract-patient-data", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (resp.error) throw new Error(resp.error.message);
      const data = (resp.data as any)?.data;
      if (!data) throw new Error("Sem dados extraídos");

      setReg((prev) => ({
        ...prev,
        full_name: (data.patient_name || prev.full_name || "")?.toString().toUpperCase() || prev.full_name,
        mother_name: (data.mother_name || prev.mother_name || "")?.toString().toUpperCase() || prev.mother_name,
        birth_date: data.birth_date || prev.birth_date,
        sex: data.sex || prev.sex,
        cpf: data.cpf || prev.cpf,
        cns: data.cns || prev.cns,
        phone: data.phone || prev.phone,
        address: (data.address || prev.address || "")?.toString().toUpperCase() || prev.address,
        neighborhood: (data.neighborhood || prev.neighborhood || "")?.toString().toUpperCase() || prev.neighborhood,
        city: (data.city || prev.city || "")?.toString().toUpperCase() || prev.city,
        medical_record: (data.medical_record || prev.medical_record || "").toString().trim() || prev.medical_record,
      }));
      if (!regReason.trim()) setRegReason("Importação automática do sistema PIS");
      toast({ title: "✅ Dados importados do PIS", description: "Revise antes de salvar." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Falha na importação PIS", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Editar Prontuário & Ficha Cadastral
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paciente: <strong className="uppercase">{patientName || "—"}</strong>. Toda alteração é auditada com seu nome, e-mail, data/hora e motivo.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="prontuario" className="text-xs gap-1.5">
                  <IdCard className="h-3.5 w-3.5" /> Prontuário
                </TabsTrigger>
                <TabsTrigger value="ficha" className="text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Ficha cadastral
                  {regChanges.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{regChanges.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="historico" className="text-xs gap-1.5">
                  <History className="h-3.5 w-3.5" /> Histórico
                  <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{mrHistory.length + regHistory.length}</Badge>
                </TabsTrigger>
              </TabsList>

              {/* ============ ABA PRONTUÁRIO ============ */}
              <TabsContent value="prontuario" className="flex-1 mt-3 min-h-0">
                <ScrollArea className="h-[58vh] pr-2">
                  {!record ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nenhum prontuário vinculado a este paciente ainda.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <section className="space-y-3 p-3 rounded-lg border bg-card">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-semibold">Nº do Prontuário</Label>
                            <Input value={numero} onChange={(e) => setNumero(e.target.value)}
                              className="h-9 text-xs uppercase" placeholder="AA-UUU-SSSSSS-DV" />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">Nº Legado / PIN</Label>
                            <Input value={legado} onChange={(e) => setLegado(e.target.value)}
                              className="h-9 text-xs uppercase" placeholder="Nº PIS / código PIN" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          Modo:{" "}
                          <Badge variant="outline" className="text-[10px]">
                            {record.generation_mode || (record.is_legacy ? "manual_legacy" : "auto")}
                          </Badge>
                          {record.is_legacy && <Badge variant="secondary" className="text-[10px]">Legado</Badge>}
                        </div>
                      </section>

                      <section className="space-y-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Motivo da alteração do prontuário (obrigatório)
                        </Label>
                        <Textarea value={mrReason} onChange={(e) => setMrReason(e.target.value)} rows={2}
                          placeholder="Ex.: Vinculação com prontuário PIS / correção de digitação..."
                          className="text-xs" />
                      </section>

                      <div className="flex justify-end">
                        <Button onClick={tryConfirmProntuario} disabled={!mrChanges.length || saving} className="gap-1.5">
                          <Save className="h-4 w-4" /> Revisar e salvar prontuário
                        </Button>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* ============ ABA FICHA CADASTRAL ============ */}
              <TabsContent value="ficha" className="flex-1 mt-3 min-h-0">
                <ScrollArea className="h-[58vh] pr-2">
                  {!registry ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nenhuma ficha cadastral vinculada a este paciente.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Importar PIS */}
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10">
                        <div className="text-[11px] leading-snug">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <Upload className="h-3.5 w-3.5" /> Importar do sistema PIS
                          </div>
                          <p className="text-muted-foreground text-[10px]">
                            Anexe ficha PIS (PDF/imagem) — IA preenche automaticamente. Revise antes de salvar.
                          </p>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                          onChange={handlePisFile} className="hidden" />
                        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}
                          disabled={importing} className="gap-1.5 text-xs">
                          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Importar
                        </Button>
                      </div>

                      {registry.is_unidentified && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40">
                          <FileWarning className="h-3 w-3 mr-1" />
                          Paciente Não Identificado — para promover, use a função dedicada (merge).
                        </Badge>
                      )}

                      {/* Identificação */}
                      <FieldGrid title="Identificação">
                        <FieldInput label="Nome completo" value={reg.full_name || ""} onChange={(v) => setRegField("full_name", v)} />
                        <FieldInput label="Nome social" value={reg.social_name || ""} onChange={(v) => setRegField("social_name", v)} />
                        <FieldInput label="CPF" value={reg.cpf || ""} onChange={(v) => setRegField("cpf", v)} placeholder="000.000.000-00" />
                        <FieldInput label="CNS (Cartão SUS)" value={reg.cns || ""} onChange={(v) => setRegField("cns", v)} />
                        <FieldInput label="Data de nascimento" type="date" value={reg.birth_date || ""} onChange={(v) => setRegField("birth_date", v)} />
                        <FieldInput label="Sexo" value={reg.sex || ""} onChange={(v) => setRegField("sex", v)} placeholder="M / F / I" />
                        <FieldInput label="Tipo sanguíneo" value={reg.blood_type || ""} onChange={(v) => setRegField("blood_type", v)} />
                        <FieldInput label="Telefone" value={reg.phone || ""} onChange={(v) => setRegField("phone", v)} />
                      </FieldGrid>

                      <FieldGrid title="Filiação">
                        <FieldInput label="Nome da mãe" value={reg.mother_name || ""} onChange={(v) => setRegField("mother_name", v)} fullWidth />
                      </FieldGrid>

                      <FieldGrid title="Endereço">
                        <FieldInput label="Logradouro" value={reg.address || ""} onChange={(v) => setRegField("address", v)} fullWidth />
                        <FieldInput label="Bairro" value={reg.neighborhood || ""} onChange={(v) => setRegField("neighborhood", v)} />
                        <FieldInput label="Cidade" value={reg.city || ""} onChange={(v) => setRegField("city", v)} />
                        <FieldInput label="UF" value={reg.state || ""} onChange={(v) => setRegField("state", v)} />
                      </FieldGrid>

                      <FieldGrid title="Clínico">
                        <FieldInput label="Alergias conhecidas" value={reg.allergies || ""} onChange={(v) => setRegField("allergies", v)} fullWidth />
                        <FieldInput label="Comorbidades" value={reg.comorbidities || ""} onChange={(v) => setRegField("comorbidities", v)} fullWidth />
                      </FieldGrid>

                      <FieldGrid title="Origem PIS">
                        <FieldInput label="Prontuário PIS / legado (referência)" value={reg.medical_record || ""} onChange={(v) => setRegField("medical_record", v)} fullWidth />
                      </FieldGrid>

                      <section className="space-y-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Motivo da atualização cadastral (obrigatório)
                        </Label>
                        <Textarea value={regReason} onChange={(e) => setRegReason(e.target.value)} rows={2}
                          placeholder="Ex.: Atualização do endereço informada pelo acompanhante; importação do PIS..."
                          className="text-xs" />
                      </section>

                      <div className="flex justify-end">
                        <Button onClick={tryConfirmFicha} disabled={!regChanges.length || saving} className="gap-1.5">
                          <Save className="h-4 w-4" /> Revisar e salvar ficha ({regChanges.length})
                        </Button>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* ============ ABA HISTÓRICO ============ */}
              <TabsContent value="historico" className="flex-1 mt-3 min-h-0">
                <ScrollArea className="h-[58vh] pr-2">
                  <div className="space-y-3">
                    <HistoryBlock
                      title="Histórico do Prontuário"
                      icon={<IdCard className="h-3.5 w-3.5 text-muted-foreground" />}
                      rows={mrHistory.map((h) => ({ ...h, source: "prontuario", labelMap: MR_FIELD_LABEL }))}
                    />
                    <HistoryBlock
                      title="Histórico da Ficha Cadastral"
                      icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                      rows={regHistory.map((h) => ({ ...h, labelMap: REG_FIELD_LABEL }))}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MovementConfirmDialog
        open={confirmOpen}
        onOpenChange={(v) => !v && setConfirmOpen(false)}
        title={confirmKind === "prontuario" ? "Alterar dados do prontuário" : "Atualizar ficha cadastral"}
        confirmLabel="Confirmar alteração"
        onConfirm={() => (confirmKind === "prontuario" ? saveProntuario() : saveFicha("manual"))}
        isSubmitting={saving}
        tone="warning"
        summary={[
          { label: "Paciente", value: patientName || "—", fullWidth: true },
          {
            label: "Campos alterados",
            value: (confirmKind === "prontuario" ? mrChanges : regChanges)
              .map((c) => (confirmKind === "prontuario" ? MR_FIELD_LABEL[c.field] : REG_FIELD_LABEL[c.field]) || c.field)
              .join(", "),
          },
          {
            label: "Motivo",
            value: (confirmKind === "prontuario" ? mrReason : regReason).trim(),
            fullWidth: true,
          },
        ]}
        warnings={(confirmKind === "prontuario" ? mrChanges : regChanges).map((c) => ({
          label: (confirmKind === "prontuario" ? MR_FIELD_LABEL[c.field] : REG_FIELD_LABEL[c.field]) || c.field,
          detail: `"${c.oldVal || "vazio"}" → "${c.newVal || "vazio"}"`,
        }))}
        consequences={[
          { text: "A alteração é aplicada imediatamente em todo o sistema (mapa, cockpit, prescrição, exames, evoluções, documentos)." },
          { text: "Uma entrada permanente é gravada na auditoria com seu nome, e-mail, data/hora e motivo informado." },
          { text: "A alteração não pode ser desfeita por edição direta — apenas por nova alteração também auditada." },
        ]}
        finalNote="Esta operação é registrada permanentemente para fins legais e regulatórios (CFM/COREN/LGPD). Confirme apenas se a justificativa estiver correta."
      />
    </>
  );
}

// ============= Helpers =============

function FieldGrid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 p-3 rounded-lg border bg-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function FieldInput({
  label, value, onChange, placeholder, type = "text", fullWidth,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <Label className="text-[11px]">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-xs"
      />
    </div>
  );
}

function HistoryBlock({
  title, icon, rows,
}: {
  title: string; icon: React.ReactNode;
  rows: Array<MrHistoryRow & { labelMap: Record<string, string>; source?: string | null }>;
}) {
  return (
    <section className="space-y-2 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        {icon}
        {title} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Sem alterações registradas.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((h) => (
            <div key={h.id} className="text-[11px] p-2 rounded border bg-background">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {h.labelMap[h.field_changed] || h.field_changed}
                  </Badge>
                  {h.source && h.source !== "prontuario" && h.source !== "manual" && (
                    <Badge variant="secondary" className="text-[9px] uppercase">{h.source}</Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(h.changed_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-muted-foreground">De: </span>
                  <code className="px-1 bg-muted rounded break-all">{h.old_value || "—"}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Para: </span>
                  <code className="px-1 bg-muted rounded break-all">{h.new_value || "—"}</code>
                </div>
              </div>
              <p className="text-[10px] mt-1 italic text-foreground/80">"{h.reason}"</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                por {h.changed_by_email || "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
