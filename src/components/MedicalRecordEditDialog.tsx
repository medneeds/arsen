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
  ShieldAlert, Trash2, Pencil, Lock, ClipboardPaste, Sparkles, Check, X, FileUp,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { MovementConfirmDialog } from "./MovementConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";

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
  const [tab, setTab] = useState<"prontuario" | "ficha" | "historico" | "danger">("prontuario");
  const { user } = useAuth();
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) { setIsDeveloper(false); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("access_profiles")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const profiles = (data as any)?.access_profiles as string[] | null;
        setIsDeveloper(Array.isArray(profiles) && profiles.includes("desenvolvedor"));
      });
    return () => { cancelled = true; };
  }, [user?.id]);
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
  const [cadastroEditMode, setCadastroEditMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Revisão PIS (etapa intermediária)
  const [pisReviewOpen, setPisReviewOpen] = useState(false);
  const [pisExtracted, setPisExtracted] = useState<Record<string, any> | null>(null);
  const [pisAccepted, setPisAccepted] = useState<Record<string, boolean>>({});
  const [pisSource, setPisSource] = useState<"file" | "paste">("file");
  const [pisFromFieldsApplied, setPisFromFieldsApplied] = useState<Set<string>>(new Set());

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
      setCadastroEditMode(false);
      setPasteText("");
      setPisFromFieldsApplied(new Set());

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
    for (const k of REG_EDITABLE) {
      const before = (registry?.[k] ?? "") as string;
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
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const userEmail = u?.user?.email;

      let registryId = registry?.id || null;
      let createdNewRegistry = false;

      // Se o paciente ainda não tem ficha cadastral vinculada, cria uma agora
      // hidratando com dados básicos do paciente (legacy UTI patients).
      if (!registryId) {
        const { data: pat } = await supabase
          .from("patients")
          .select("id, name, hospital_unit_id, state_id, patient_registry_id")
          .eq("id", patientId)
          .maybeSingle();

        if ((pat as any)?.patient_registry_id) {
          registryId = (pat as any).patient_registry_id;
        } else {
          const seedName = (reg.full_name || (pat as any)?.name || "PACIENTE SEM IDENTIFICAÇÃO").toString().toUpperCase().trim();
          const insertPayload: Record<string, any> = {
            full_name: seedName,
            hospital_unit_id: (pat as any)?.hospital_unit_id || null,
            state_id: (pat as any)?.state_id || null,
            is_unidentified: false,
            created_by: userId,
          };
          // Aplica desde já os campos preenchidos no formulário
          for (const k of REG_EDITABLE) {
            const v = (reg as any)[k];
            if (v != null && String(v).trim() !== "") insertPayload[k as string] = v;
          }
          const { data: newReg, error: insErr } = await supabase
            .from("patient_registry")
            .insert(insertPayload as any)
            .select("id")
            .single();
          if (insErr) throw insErr;
          registryId = (newReg as any).id;
          createdNewRegistry = true;

          // Vincula ao paciente
          await supabase
            .from("patients")
            .update({ patient_registry_id: registryId } as any)
            .eq("id", patientId);

          // Vincula ao prontuário ativo (se existir)
          if (record?.id) {
            await supabase
              .from("medical_records")
              .update({ patient_registry_id: registryId } as any)
              .eq("id", record.id);
          }
        }
      }

      // Se houve criação, todos os campos preenchidos já entraram no insert; só precisamos auditar.
      // Caso contrário (registry pré-existente), aplica o UPDATE com os diffs.
      if (!createdNewRegistry && regChanges.length > 0) {
        const updatePayload: Record<string, any> = {};
        for (const c of regChanges) updatePayload[c.field] = (c.newVal || null);

        const { error: upErr } = await supabase
          .from("patient_registry").update(updatePayload).eq("id", registryId!);
        if (upErr) throw upErr;
      }

      // Histórico — registra todas as alterações (incluindo a criação inicial campo a campo)
      const historyRows = regChanges.map((c) => ({
        patient_registry_id: registryId!,
        patient_id: patientId,
        field_changed: c.field,
        old_value: c.oldVal || null,
        new_value: c.newVal || null,
        reason: createdNewRegistry
          ? `[Ficha criada] ${regReason.trim()}`
          : regReason.trim(),
        source: pisFromFieldsApplied.has(c.field) ? "pis_import" : source,
        changed_by: userId,
        changed_by_email: userEmail,
      }));

      if (historyRows.length > 0) {
        const { error: hErr } = await supabase
          .from("patient_registry_edit_history" as any)
          .insert(historyRows);
        if (hErr) throw hErr;
      }

      toast({
        title: createdNewRegistry ? "✅ Ficha cadastral criada" : "✅ Ficha cadastral atualizada",
        description: `${regChanges.length} campo(s) ${createdNewRegistry ? "preenchido(s)" : "alterado(s)"}.`,
      });
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

  // ===== HARD DELETE (perfil desenvolvedor) =====
  async function executeHardDelete() {
    if (!isDeveloper) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("admin_hard_delete_patient" as any, {
        p_patient_id: patientId,
        p_registry_id: registry?.id ?? null,
        p_reason: deleteReason.trim(),
      });
      if (error) throw error;
      toast({
        title: "🗑️ Paciente excluído permanentemente",
        description: "Todos os dados foram apagados. Operação registrada nos logs.",
      });
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Falha na exclusão",
        description: e.message || "Operação negada pelo servidor.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  // ===== Import PIS — abre etapa intermediária de revisão =====
  const PIS_FIELD_MAP: Record<string, keyof RegistryRow> = {
    patient_name: "full_name",
    mother_name: "mother_name",
    birth_date: "birth_date",
    sex: "sex",
    cpf: "cpf",
    cns: "cns",
    phone: "phone",
    address: "address",
    neighborhood: "neighborhood",
    city: "city",
    state: "state",
    medical_record: "medical_record",
  };

  function openPisReview(extracted: Record<string, any>, source: "file" | "paste") {
    // pré-marca apenas campos com valor não vazio
    const accepted: Record<string, boolean> = {};
    for (const [pisKey] of Object.entries(PIS_FIELD_MAP)) {
      const v = extracted?.[pisKey];
      if (v !== null && v !== undefined && String(v).trim() !== "") accepted[pisKey] = true;
    }
    setPisExtracted(extracted);
    setPisAccepted(accepted);
    setPisSource(source);
    setPisReviewOpen(true);
  }

  function applyPisAccepted() {
    if (!pisExtracted) return;
    const next: Partial<RegistryRow> = { ...reg };
    const sources = new Set(pisFromFieldsApplied);
    for (const [pisKey, regKey] of Object.entries(PIS_FIELD_MAP)) {
      if (!pisAccepted[pisKey]) continue;
      const raw = pisExtracted[pisKey];
      if (raw === null || raw === undefined || String(raw).trim() === "") continue;
      let val = String(raw).trim();
      if (UPPER_FIELDS.has(regKey as string)) val = val.toUpperCase();
      (next as any)[regKey] = val;
      sources.add(regKey as string);
    }
    setReg(next);
    setPisFromFieldsApplied(sources);
    if (!regReason.trim()) {
      setRegReason(pisSource === "paste"
        ? "Atualização cadastral via colagem de dados do PIS"
        : "Importação automática do sistema PIS (anexo)");
    }
    setPisReviewOpen(false);
    setPisExtracted(null);
    setPasteText("");
    toast({
      title: "✅ Campos aplicados aos formulários",
      description: "Revise, ajuste se necessário e salve para confirmar a alteração.",
    });
  }

  async function handlePisFile(eOrFile: React.ChangeEvent<HTMLInputElement> | File) {
    const file = (eOrFile as any)?.target ? (eOrFile as any).target.files?.[0] : (eOrFile as File);
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
      openPisReview(data, "file");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Falha na importação PIS", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePasteSubmit() {
    const text = pasteText.trim();
    if (text.length < 10) {
      toast({ title: "Cole um trecho maior", description: "Cole o texto completo da ficha PIS para reconhecimento.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const resp = await supabase.functions.invoke("extract-patient-data", {
        body: { rawText: text },
      });
      if (resp.error) throw new Error(resp.error.message);
      const data = (resp.data as any)?.data;
      if (!data) throw new Error("Sem dados extraídos");
      openPisReview(data, "paste");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Falha no reconhecimento", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handlePisFile(file);
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
              <TabsList className={isDeveloper ? "grid grid-cols-4 w-full" : "grid grid-cols-3 w-full"}>
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
                {isDeveloper && (
                  <TabsTrigger
                    value="danger"
                    className="text-xs gap-1.5 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground text-destructive"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Edição Avançada
                  </TabsTrigger>
                )}
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
                  {(
                    <div className="space-y-3">
                      {!registry && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] flex items-start gap-2">
                          <FileWarning className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-amber-800 dark:text-amber-300">
                              Sem ficha cadastral vinculada
                            </div>
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                              Este paciente foi admitido sem cadastro central (comum em leitos legados da UTI). Ative <strong>"Atualizar cadastro"</strong> para preencher os campos manualmente ou importar do PIS — ao salvar, a ficha será criada e vinculada automaticamente ao prontuário.
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Cabeçalho com botão Atualizar cadastro */}
                      <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${cadastroEditMode ? "border-emerald-500/40 bg-emerald-500/5" : "border-muted bg-muted/30"}`}>
                        <div className="text-[11px] leading-snug flex items-center gap-2">
                          {cadastroEditMode ? <Pencil className="h-3.5 w-3.5 text-emerald-600" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                          <div>
                            <div className="font-semibold">
                              {cadastroEditMode ? "Modo edição ativo" : "Cadastro bloqueado"}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {cadastroEditMode
                                ? "Edite os campos manualmente OU use a captura PIS abaixo. Toda alteração exige motivo + confirmação."
                                : "Para alterar dados cadastrais ou importar do PIS, ative o modo edição."}
                            </p>
                          </div>
                        </div>
                        {!cadastroEditMode ? (
                          <Button size="sm" onClick={() => setCadastroEditMode(true)} className="gap-1.5 text-xs">
                            <Pencil className="h-3.5 w-3.5" /> Atualizar cadastro
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => {
                            setCadastroEditMode(false);
                            setReg(registry ? { ...registry } : {});
                            setRegReason("");
                            setPasteText("");
                            setPisFromFieldsApplied(new Set());
                          }} className="gap-1.5 text-xs">
                            <X className="h-3.5 w-3.5" /> Cancelar edição
                          </Button>
                        )}
                      </div>

                      {/* Captura PIS (anexar / arrastar / colar) — só em modo edição */}
                      {cadastroEditMode && (
                        <section className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold">
                            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                            Captura automática do PIS
                            <span className="text-[10px] font-normal text-muted-foreground">(anexar arquivo, arrastar ou colar texto)</span>
                          </div>

                          <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={`rounded-md border-2 border-dashed p-3 text-center text-[11px] transition-colors ${
                              isDragging ? "border-blue-500 bg-blue-500/10" : "border-muted-foreground/30 bg-background/50"
                            }`}
                          >
                            <FileUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-muted-foreground">Arraste a ficha PIS aqui (PDF/imagem) <strong>ou</strong></p>
                            <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                              onChange={handlePisFile} className="hidden" />
                            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}
                              disabled={importing} className="gap-1.5 text-xs mt-1.5">
                              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                              Anexar arquivo
                            </Button>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] flex items-center gap-1.5">
                              <ClipboardPaste className="h-3.5 w-3.5" /> Colar dados do PIS
                            </Label>
                            <Textarea
                              value={pasteText}
                              onChange={(e) => setPasteText(e.target.value)}
                              rows={3}
                              placeholder="Cole aqui o texto da ficha PIS (Ctrl+V). A IA reconhece nome, CPF, CNS, endereço, mãe, etc."
                              className="text-xs"
                              disabled={importing}
                            />
                            <div className="flex justify-end">
                              <Button size="sm" onClick={handlePasteSubmit}
                                disabled={importing || pasteText.trim().length < 10}
                                className="gap-1.5 text-xs">
                                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                Reconhecer e revisar
                              </Button>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground italic">
                            Os dados reconhecidos passam por uma etapa de revisão antes de serem aplicados aos campos. Nada é salvo automaticamente.
                          </p>
                        </section>
                      )}

                      {registry.is_unidentified && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40">
                          <FileWarning className="h-3 w-3 mr-1" />
                          Paciente Não Identificado — para promover, use a função dedicada (merge).
                        </Badge>
                      )}

                      {/* Identificação */}
                      <FieldGrid title="Identificação">
                        <FieldInput label="Nome completo" value={reg.full_name || ""} onChange={(v) => setRegField("full_name", v)} disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("full_name")} />
                        <FieldInput label="Nome social" value={reg.social_name || ""} onChange={(v) => setRegField("social_name", v)} disabled={!cadastroEditMode} />
                        <FieldInput label="CPF" value={reg.cpf || ""} onChange={(v) => setRegField("cpf", v)} placeholder="000.000.000-00" disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("cpf")} />
                        <FieldInput label="CNS (Cartão SUS)" value={reg.cns || ""} onChange={(v) => setRegField("cns", v)} disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("cns")} />
                        <FieldInput label="Data de nascimento" type="date" value={reg.birth_date || ""} onChange={(v) => setRegField("birth_date", v)} disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("birth_date")} />
                        <FieldInput label="Sexo" value={reg.sex || ""} onChange={(v) => setRegField("sex", v)} placeholder="M / F / I" disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("sex")} />
                        <FieldInput label="Tipo sanguíneo" value={reg.blood_type || ""} onChange={(v) => setRegField("blood_type", v)} disabled={!cadastroEditMode} />
                        <FieldInput label="Telefone" value={reg.phone || ""} onChange={(v) => setRegField("phone", v)} disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("phone")} />
                      </FieldGrid>

                      <FieldGrid title="Filiação">
                        <FieldInput label="Nome da mãe" value={reg.mother_name || ""} onChange={(v) => setRegField("mother_name", v)} fullWidth disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("mother_name")} />
                      </FieldGrid>

                      <FieldGrid title="Endereço">
                        <FieldInput label="Logradouro" value={reg.address || ""} onChange={(v) => setRegField("address", v)} fullWidth disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("address")} />
                        <FieldInput label="Bairro" value={reg.neighborhood || ""} onChange={(v) => setRegField("neighborhood", v)} disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("neighborhood")} />
                        <FieldInput label="Cidade" value={reg.city || ""} onChange={(v) => setRegField("city", v)} disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("city")} />
                        <FieldInput label="UF" value={reg.state || ""} onChange={(v) => setRegField("state", v)} disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("state")} />
                      </FieldGrid>

                      <FieldGrid title="Clínico">
                        <FieldInput label="Alergias conhecidas" value={reg.allergies || ""} onChange={(v) => setRegField("allergies", v)} fullWidth disabled={!cadastroEditMode} />
                        <FieldInput label="Comorbidades" value={reg.comorbidities || ""} onChange={(v) => setRegField("comorbidities", v)} fullWidth disabled={!cadastroEditMode} />
                      </FieldGrid>

                      <FieldGrid title="Origem PIS">
                        <FieldInput label="Prontuário PIS / legado (referência)" value={reg.medical_record || ""} onChange={(v) => setRegField("medical_record", v)} fullWidth disabled={!cadastroEditMode} highlight={pisFromFieldsApplied.has("medical_record")} />
                      </FieldGrid>

                      {cadastroEditMode && (
                        <>
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
                        </>
                      )}
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

              {/* ============ ABA EDIÇÃO AVANÇADA (DESENVOLVEDOR) ============ */}
              {isDeveloper && (
                <TabsContent value="danger" className="flex-1 mt-3 min-h-0">
                  <ScrollArea className="h-[58vh] pr-2">
                    <div className="space-y-4">
                      <section className="p-4 rounded-lg border-2 border-destructive/50 bg-destructive/5 space-y-3">
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-destructive uppercase tracking-wide">
                              Exclusão administrativa do paciente
                            </h3>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Operação <strong>irreversível</strong> reservada para casos excepcionais
                              de erro administrativo (cadastro duplicado, paciente inexistente, teste em produção, etc).
                              Apaga em cascata <strong>todos os dados</strong> deste paciente: prontuário, ficha cadastral,
                              evoluções, prescrições, exames, culturas, movimentações, atendimentos e históricos de edição.
                              Esta ação <strong>não pode ser desfeita</strong>.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold">
                            Motivo da exclusão (mínimo 10 caracteres, obrigatório)
                          </Label>
                          <Textarea
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            rows={3}
                            placeholder="Ex.: Cadastro duplicado do paciente XYZ — registro correto é o ID abc123. Solicitado por..."
                            className="text-xs"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold">
                            Para confirmar, digite exatamente o nome do paciente:
                          </Label>
                          <code className="block text-[10px] p-1.5 bg-muted rounded border">{patientName || "—"}</code>
                          <Input
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                            placeholder="Digite o nome completo do paciente"
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <Button
                            variant="destructive"
                            disabled={
                              deleting ||
                              deleteReason.trim().length < 10 ||
                              deleteConfirmName.trim().toUpperCase() !== (patientName || "").trim().toUpperCase()
                            }
                            onClick={() => setConfirmDeleteOpen(true)}
                            className="gap-1.5"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir paciente permanentemente
                          </Button>
                        </div>
                      </section>
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}
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

      <MovementConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(v) => !v && setConfirmDeleteOpen(false)}
        title="Excluir paciente permanentemente"
        confirmLabel="Sim, excluir todos os dados"
        onConfirm={executeHardDelete}
        isSubmitting={deleting}
        tone="destructive"
        summary={[
          { label: "Paciente", value: patientName || "—", fullWidth: true },
          { label: "ID interno", value: patientId, fullWidth: true },
          { label: "Motivo", value: deleteReason.trim(), fullWidth: true },
        ]}
        warnings={[
          { label: "Operação irreversível", detail: "Não há cesto de lixo nem rollback. Os dados deixam de existir." },
          { label: "Restrito ao perfil desenvolvedor", detail: "Apenas usuários com perfil 'desenvolvedor' podem executar." },
        ]}
        consequences={[
          { text: "Apaga prontuário, ficha cadastral, evoluções, prescrições, exames, culturas e movimentações." },
          { text: "Remove todos os atendimentos, históricos de edição e snapshots de versão." },
          { text: "Libera CPF/CNS para reuso (caso o paciente seja recadastrado, será novo registro)." },
          { text: "A operação é registrada nos logs de auditoria do servidor com seu ID e motivo." },
        ]}
        finalNote="Use APENAS para erros administrativos excepcionais (cadastro duplicado, paciente inexistente, dados de teste). Para alta clínica use o fluxo de Saída."
      />

      {/* ============ ETAPA INTERMEDIÁRIA: REVISAR DADOS RECONHECIDOS ============ */}
      <Dialog open={pisReviewOpen} onOpenChange={(v) => { if (!v) { setPisReviewOpen(false); setPisExtracted(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Revisar dados reconhecidos do PIS
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              A IA leu os dados {pisSource === "paste" ? "colados" : "do anexo"} e identificou os campos abaixo.
              <strong> Marque apenas os que deseja aplicar</strong> ao cadastro. Em seguida você ainda preencherá o motivo
              e confirmará o salvamento — nada é gravado neste passo.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-2 max-h-[60vh]">
            <div className="space-y-1.5 py-2">
              {Object.entries(PIS_FIELD_MAP).map(([pisKey, regKey]) => {
                const newVal = pisExtracted?.[pisKey];
                const newStr = newVal === null || newVal === undefined ? "" : String(newVal).trim();
                const oldStr = String((registry as any)?.[regKey] ?? "").trim();
                const same = newStr === oldStr;
                const hasNew = newStr.length > 0;
                return (
                  <div
                    key={pisKey}
                    className={`flex items-start gap-2 p-2 rounded border text-[11px] ${
                      !hasNew ? "bg-muted/30 opacity-60" :
                      same ? "bg-muted/40 border-muted" :
                      "bg-blue-500/5 border-blue-500/30"
                    }`}
                  >
                    <Checkbox
                      checked={!!pisAccepted[pisKey]}
                      disabled={!hasNew}
                      onCheckedChange={(v) => setPisAccepted((prev) => ({ ...prev, [pisKey]: !!v }))}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center gap-1.5">
                        {REG_FIELD_LABEL[regKey as string] || pisKey}
                        {!hasNew && <Badge variant="outline" className="text-[9px]">Não reconhecido</Badge>}
                        {hasNew && same && <Badge variant="outline" className="text-[9px]">Já está igual</Badge>}
                        {hasNew && !same && oldStr === "" && <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-700">Novo</Badge>}
                        {hasNew && !same && oldStr !== "" && <Badge variant="secondary" className="text-[9px] bg-amber-500/15 text-amber-700">Será substituído</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <div className="text-[9px] uppercase text-muted-foreground">Atual</div>
                          <div className="truncate">{oldStr || <span className="italic text-muted-foreground">vazio</span>}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase text-muted-foreground">Reconhecido</div>
                          <div className="truncate font-medium">{newStr || <span className="italic text-muted-foreground">—</span>}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="border-t pt-3 space-y-2">
            <div className="text-[10px] text-muted-foreground p-2 rounded bg-muted/40 leading-relaxed">
              <strong>O que acontece a seguir?</strong> Os campos marcados serão preenchidos no formulário (em destaque azul).
              Você ainda precisa informar o <strong>motivo</strong> e clicar em <strong>"Revisar e salvar ficha"</strong> para gravar
              as alterações no banco — cada campo será registrado no histórico com origem <code className="text-[9px]">pis_import</code>.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPisReviewOpen(false); setPisExtracted(null); }} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Cancelar reconhecimento
              </Button>
              <Button size="sm" onClick={applyPisAccepted}
                disabled={!Object.values(pisAccepted).some(Boolean)}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Check className="h-3.5 w-3.5" /> Aplicar selecionados ({Object.values(pisAccepted).filter(Boolean).length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  label, value, onChange, placeholder, type = "text", fullWidth, disabled, highlight,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; fullWidth?: boolean;
  disabled?: boolean; highlight?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <Label className="text-[11px] flex items-center gap-1">
        {label}
        {highlight && <Badge variant="secondary" className="text-[8px] uppercase h-3.5 px-1 bg-blue-500/15 text-blue-700 dark:text-blue-300">PIS</Badge>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`h-9 text-xs ${highlight ? "border-blue-500/40 bg-blue-500/5" : ""} ${disabled ? "bg-muted/40 cursor-not-allowed" : ""}`}
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
