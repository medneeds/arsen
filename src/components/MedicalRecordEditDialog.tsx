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
import { toSexoDb } from "@/lib/sexo";
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

// MIGRAÇÃO: RegistryRow (patient_registry, morto) → colunas reais de `pacientes`.
// Os campos ausentes deste mapa são DEGRADADOS (não têm coluna nova → não persistidos):
// neighborhood, city, state, medical_record, is_unidentified, unidentified_features.
const REG_TO_PACIENTE: Partial<Record<keyof RegistryRow, string>> = {
  full_name: "nome_completo",
  social_name: "nome_social",
  cpf: "cpf",
  cns: "cns",
  birth_date: "data_nascimento",
  sex: "sexo",
  mother_name: "nome_mae",
  phone: "telefone",
  address: "endereco",
  blood_type: "tipo_sanguineo",
  allergies: "alergias",
  comorbidities: "comorbidades",
};

/** Mapeia uma linha de `pacientes` para o view-model estável RegistryRow. */
function pacienteToRegistry(p: any, id: string): RegistryRow {
  return {
    id,
    full_name: p?.nome_completo ?? null,
    social_name: p?.nome_social ?? null,
    cpf: p?.cpf ?? null,
    cns: p?.cns ?? null,
    birth_date: p?.data_nascimento ?? null,
    sex: p?.sexo ?? null,
    mother_name: p?.nome_mae ?? null,
    phone: p?.telefone ?? null,
    address: p?.endereco ?? null,
    neighborhood: null, // MIGRAÇÃO: sem coluna em pacientes
    city: null,         // MIGRAÇÃO: sem coluna em pacientes
    state: null,        // MIGRAÇÃO: sem coluna em pacientes
    blood_type: p?.tipo_sanguineo ?? null,
    allergies: p?.alergias ?? null,
    comorbidities: p?.comorbidades ?? null,
    medical_record: null, // MIGRAÇÃO: prontuário é campo único (pacientes.prontuario) → sem PIS/legado separado
    is_unidentified: null,
    unidentified_features: null,
  };
}

// Campos de prontuário (para separar o histórico em "Prontuário" vs "Ficha cadastral").
const PRONTUARIO_FIELDS = new Set(["numero_prontuario"]);

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

  // MIGRAÇÃO: profiles.access_profiles (morto) → profissionais.papel === 'dev'.
  useEffect(() => {
    if (!user?.id) { setIsDeveloper(false); return; }
    let cancelled = false;
    supabase
      .from("profissionais")
      .select("papel")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsDeveloper((data as any)?.papel === "dev");
      });
    return () => { cancelled = true; };
  }, [user?.id]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // MIGRAÇÃO: patientId é internacoes.id. A identidade cadastral vive em `pacientes`,
  // resolvida via internacoes.paciente_id. Prontuário = pacientes.prontuario.
  const [pacienteId, setPacienteId] = useState<string | null>(null);

  // Prontuário
  const [record, setRecord] = useState<MedicalRecordRow | null>(null);
  const [numero, setNumero] = useState("");
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

  // Criação de prontuário legado on-demand (paciente sem medical_records — comum em UTI legacy)
  const [createLegacyNumber, setCreateLegacyNumber] = useState("");
  const [creatingLegacy, setCreatingLegacy] = useState(false);

  // MIGRAÇÃO: medical_records (morto) não existe mais — o prontuário é a coluna única
  // pacientes.prontuario (NOT NULL). Esta ação de "criar prontuário legado on-demand"
  // agora apenas define/atualiza pacientes.prontuario e audita em logs_auditoria.
  // Na prática raramente é acionada, pois `pacientes` sempre tem prontuário.
  async function createLegacyMedicalRecord() {
    const value = createLegacyNumber.trim();
    if (value.length < 1) {
      toast({ title: "Informe o nº do prontuário (PIN/PIS ou nº legado).", variant: "destructive" });
      return;
    }
    if (!pacienteId) {
      toast({ title: "Paciente não resolvido para esta internação.", variant: "destructive" });
      return;
    }
    setCreatingLegacy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const userEmail = u?.user?.email;

      const { error: upErr } = await supabase
        .from("pacientes")
        .update({ prontuario: value } as any)
        .eq("id", pacienteId);
      if (upErr) throw upErr;

      const { error: erroGrav1 } = await supabase
        .from("logs_auditoria")
        .insert({
          tipo_evento: "edicao_prontuario",
          nome_tabela: "pacientes",
          registro_id: pacienteId,
          paciente_id: pacienteId,
          internacao_id: patientId,
          campo_alterado: "numero_prontuario",
          campos_alterados: ["numero_prontuario"],
          valor_antigo: null,
          valor_novo: value,
          motivo: "[Prontuário definido on-demand pelo cockpit de edição]",
          ator_user_id: userId,
          email_ator: userEmail,
        } as any);
      if (erroGrav1) throw erroGrav1;

      toast({ title: "✅ Prontuário definido", description: `Nº ${value} vinculado ao paciente.` });
      setCreateLegacyNumber("");
      await loadData();
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      const msg = (e?.message || "").includes("prontuario")
        ? `Já existe um paciente com o prontuário "${value}". Escolha outro identificador.`
        : (e.message || "Erro inesperado");
      toast({ title: "Erro ao definir prontuário", description: msg, variant: "destructive" });
    } finally {
      setCreatingLegacy(false);
    }
  }

  useEffect(() => {
    if (!open || !patientId) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId]);

  async function loadData() {
    setLoading(true);
    try {
      // MIGRAÇÃO: patientId = internacoes.id → resolve o paciente vivo por internacoes.paciente_id.
      // medical_records / patient_registry / *_edit_history estão mortos: prontuário e ficha
      // cadastral vivem em `pacientes`; a trilha de edição vive em logs_auditoria.
      const { data: inter } = await supabase
        .from("internacoes")
        .select("paciente_id, paciente:pacientes(id, prontuario, nome_completo, nome_social, cpf, cns, data_nascimento, sexo, nome_mae, telefone, endereco, tipo_sanguineo, alergias, comorbidades)")
        .eq("id", patientId)
        .maybeSingle();

      const pac = (inter as any)?.paciente || null;
      const resolvedPacienteId: string | null = pac?.id || (inter as any)?.paciente_id || null;
      setPacienteId(resolvedPacienteId);

      let regRow: RegistryRow | null = null;

      if (pac && resolvedPacienteId) {
        regRow = pacienteToRegistry(pac, resolvedPacienteId);

        // "record" sintetizado a partir de pacientes.prontuario (medical_records morto).
        // MIGRAÇÃO: numero_prontuario_legado / is_legacy / generation_mode não existem
        // no schema novo → sempre null (UI degradada).
        setRecord({
          id: resolvedPacienteId,
          numero_prontuario: pac.prontuario || "",
          numero_prontuario_legado: null,
          is_legacy: null,
          generation_mode: null,
        });
        setNumero(pac.prontuario || "");

        // Histórico de edição a partir de logs_auditoria (tipo_evento='edicao_prontuario').
        const { data: logs } = await supabase
          .from("logs_auditoria")
          .select("id, campo_alterado, campos_alterados, valor_antigo, valor_novo, motivo, email_ator, criado_em")
          .eq("tipo_evento", "edicao_prontuario")
          .eq("registro_id", resolvedPacienteId)
          .order("criado_em", { ascending: false })
          .limit(120);

        const mapped: RegHistoryRow[] = ((logs as any[]) || []).map((l) => ({
          id: l.id,
          field_changed: l.campo_alterado || (Array.isArray(l.campos_alterados) ? l.campos_alterados[0] : "") || "",
          old_value: l.valor_antigo ?? null,
          new_value: l.valor_novo ?? null,
          reason: l.motivo ?? "",
          changed_by_email: l.email_ator ?? null,
          changed_at: l.criado_em,
          source: null,
        }));

        // Separa prontuário (numero_prontuario) da ficha cadastral (demais campos).
        setMrHistory(mapped.filter((h) => PRONTUARIO_FIELDS.has(h.field_changed)));
        setRegHistory(mapped.filter((h) => !PRONTUARIO_FIELDS.has(h.field_changed)));
      } else {
        setRecord(null);
        setMrHistory([]);
        setRegHistory([]);
      }

      setRegistry(regRow);
      setReg(regRow ? { ...regRow } : {});
      setMrReason("");
      setRegReason("");
      setCadastroEditMode(false);
      setPasteText("");
      setPisFromFieldsApplied(new Set());
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ===== Diffs =====
  // MIGRAÇÃO: numero_prontuario_legado degradado (sem coluna) → só numero_prontuario é editável.
  const mrChanges = useMemo(() => {
    const out: { field: string; oldVal: string; newVal: string }[] = [];
    if (record) {
      if ((record.numero_prontuario || "") !== numero.trim()) {
        out.push({ field: "numero_prontuario", oldVal: record.numero_prontuario || "", newVal: numero.trim() });
      }
    }
    return out;
  }, [record, numero]);

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

  // MIGRAÇÃO: UPDATE medical_records → UPDATE pacientes.prontuario. A trilha de edição
  // (medical_record_edit_history) vira logs_auditoria tipo_evento='edicao_prontuario'.
  async function saveProntuario() {
    if (!record || !pacienteId) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const userEmail = u?.user?.email;

      const numeroChange = mrChanges.find((c) => c.field === "numero_prontuario");
      if (numeroChange) {
        const { error: upErr } = await supabase
          .from("pacientes")
          .update({ prontuario: numeroChange.newVal || "" } as any)
          .eq("id", pacienteId);
        if (upErr) throw upErr;
      }

      const { error: hErr } = await supabase
        .from("logs_auditoria")
        .insert(mrChanges.map((c) => ({
          tipo_evento: "edicao_prontuario",
          nome_tabela: "pacientes",
          registro_id: pacienteId,
          paciente_id: pacienteId,
          internacao_id: patientId,
          campo_alterado: c.field,
          campos_alterados: [c.field],
          valor_antigo: c.oldVal || null,
          valor_novo: c.newVal || null,
          motivo: mrReason.trim(),
          ator_user_id: userId,
          email_ator: userEmail,
        })) as any);
      if (hErr) throw hErr;

      toast({ title: "Prontuário atualizado", description: `${mrChanges.length} ${(mrChanges.length) === 1 ? 'campo' : 'campos'} ${(mrChanges.length) === 1 ? 'alterado' : 'alterados'}.` });
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

  // MIGRAÇÃO: patient_registry / patient_registry_edit_history (mortos) → a ficha cadastral
  // é a própria linha de `pacientes` (sempre existe, resolvida por internacoes.paciente_id).
  // Não há mais criação/relink de registry: aplicamos UPDATE em pacientes com os campos
  // mapeáveis (REG_TO_PACIENTE) e auditamos campo a campo em logs_auditoria. Campos sem
  // coluna nova (neighborhood, city, state, medical_record) são DEGRADADOS — ignorados no
  // payload. O nome (nome_completo) é coluna direta, então não há mais "sync" separado.
  async function saveFicha(source: "manual" | "pis_import" = "manual") {
    if (!pacienteId) {
      toast({ title: "Paciente não resolvido para esta internação.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const userEmail = u?.user?.email;

      // Monta o UPDATE apenas com campos que têm coluna real em pacientes.
      const updatePayload: Record<string, any> = {};
      const skipped: string[] = [];
      for (const c of regChanges) {
        const col = REG_TO_PACIENTE[c.field as keyof RegistryRow];
        if (col) {
          // MIGRAÇÃO: sexo tem CHECK no banco (masculino/feminino/outro/nao_informado).
          updatePayload[col] = col === "sexo" ? toSexoDb(c.newVal) : (c.newVal || null);
        } else {
          skipped.push(c.field); // DEGRADADO: sem coluna nova
        }
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: upErr } = await supabase
          .from("pacientes")
          .update(updatePayload as any)
          .eq("id", pacienteId);
        if (upErr) throw upErr;
      }

      // Auditoria campo a campo — registra todas as alterações (inclusive as degradadas,
      // para não perder o rastro da intenção do editor).
      const historyRows = regChanges.map((c) => ({
        tipo_evento: "edicao_prontuario",
        nome_tabela: "pacientes",
        registro_id: pacienteId,
        paciente_id: pacienteId,
        internacao_id: patientId,
        campo_alterado: c.field,
        campos_alterados: [c.field],
        valor_antigo: c.oldVal || null,
        valor_novo: c.newVal || null,
        motivo: (pisFromFieldsApplied.has(c.field) || source === "pis_import")
          ? `[PIS] ${regReason.trim()}`
          : regReason.trim(),
        ator_user_id: userId,
        email_ator: userEmail,
      }));

      if (historyRows.length > 0) {
        const { error: hErr } = await supabase
          .from("logs_auditoria")
          .insert(historyRows as any);
        if (hErr) throw hErr;
      }

      const savedCount = regChanges.length - skipped.length;
      toast({
        title: "✅ Ficha cadastral atualizada",
        description: skipped.length > 0
          ? `${savedCount} campo(s) salvo(s). ${skipped.length} campo(s) sem destino no schema novo foram ignorados.`
          : `${savedCount} campo(s) alterado(s).`,
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
      // MIGRAÇÃO: RPC custom (assinatura mantida). p_patient_id = pacientes.id resolvido
      // via internacoes.paciente_id. p_registry_id descontinuado (patient_registry morto).
      const { error } = await (supabase.rpc as any)("admin_hard_delete_patient", {
        p_patient_id: pacienteId ?? patientId,
        p_reason: deleteReason.trim(),
      });
      if (error) throw error;
      toast({
        title: "Paciente excluído permanentemente",
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
      title: "Campos aplicados aos formulários",
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
      const requiresManualCpfCns = (resp.data as any)?.requiresManualCpfCns === true;
      if (!data) throw new Error("Sem dados extraídos");
      openPisReview(data, "file");
      if (requiresManualCpfCns) {
        // Modo imagem: CPF e CNS não são extraídos por proteção LGPD.
        // Avisa o usuário na tela de revisão que deve preencher esses campos.
        toast({
          title: "Preencha CPF e CNS na revisão",
          description: "Para documentos em imagem, CPF e CNS não são extraídos automaticamente (LGPD). Preencha esses campos manualmente na tela de revisão.",
        });
      }
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
              Paciente: <strong className="uppercase tracking-wider">{patientName || "—"}</strong>. Toda alteração é auditada com seu nome, e-mail, data/hora e motivo.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
              <TabsList className={isDeveloper ? "grid grid-cols-4 w-full" : "grid grid-cols-3 w-full"}>
                <TabsTrigger value="prontuario" className="text-xs gap-2">
                  <IdCard className="h-3.5 w-3.5" /> Prontuário
                </TabsTrigger>
                <TabsTrigger value="ficha" className="text-xs gap-2">
                  <FileText className="h-3.5 w-3.5" /> Ficha cadastral
                  {regChanges.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{regChanges.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="historico" className="text-xs gap-2">
                  <History className="h-3.5 w-3.5" /> Histórico
                  <Badge variant="outline" className="ml-1 h-4 px-1 text-xs">{mrHistory.length + regHistory.length}</Badge>
                </TabsTrigger>
                {isDeveloper && (
                  <TabsTrigger
                    value="danger"
                    className="text-xs gap-2 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground text-destructive"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Edição Avançada
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ============ ABA PRONTUÁRIO ============ */}
              <TabsContent value="prontuario" className="flex-1 mt-3 min-h-0">
                <ScrollArea className="h-[58vh] pr-2">
                  {!record ? (
                    <div className="rounded-md border border-dashed border-warning/40 bg-warning/5 p-4 text-sm space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="text-warning-on-soft font-medium text-xs uppercase tracking-wide">
                          Sem prontuário vinculado
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Este paciente ainda não possui registro em <code>medical_records</code> — comum em leitos
                        legados (UTI/PIS) admitidos antes da migração. Informe o nº de prontuário (PIN/PIS ou
                        identificador legado) para criar o vínculo agora. O modo <code>manual_legacy</code> será
                        aplicado automaticamente e a ação fica registrada no histórico.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                        <div className="flex-1">
                          <Label className="text-xs font-medium">Nº do prontuário (PIN/PIS ou legado)</Label>
                          <Input
                            value={createLegacyNumber}
                            onChange={(e) => setCreateLegacyNumber(e.target.value)}
                            placeholder="Ex.: 123456 ou PIS-7788"
                            className="h-9 text-xs uppercase tracking-wider mt-1"
                            disabled={creatingLegacy}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={createLegacyMedicalRecord}
                          disabled={creatingLegacy || createLegacyNumber.trim().length < 1}
                          className="gap-2"
                        >
                          {creatingLegacy ? "Criando..." : "Criar prontuário legado"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Após a criação você poderá editar o nº, alternar para o formato oficial AA-UUU-SSSSSS-DV
                        e completar a ficha cadastral normalmente.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <section className="space-y-3 p-3 rounded-lg border bg-card">
                        {/* MIGRAÇÃO: prontuário é campo único pacientes.prontuario. Nº Legado/PIN,
                            modo de geração e flag "legado" (medical_records) foram degradados. */}
                        <div>
                          <Label className="text-xs font-semibold">Nº do Prontuário</Label>
                          <Input value={numero} onChange={(e) => setNumero(e.target.value)}
                            className="h-9 text-xs uppercase" placeholder="Nº do prontuário" />
                        </div>
                      </section>

                      <section className="space-y-2 p-3 rounded-lg border border-warning/30 bg-warning/10">
                        <Label className="text-xs font-medium flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning-on-soft" />
                          Motivo da alteração do prontuário (obrigatório)
                        </Label>
                        <Textarea value={mrReason} onChange={(e) => setMrReason(e.target.value)} rows={2}
                          placeholder="Ex.: Vinculação com prontuário PIS / correção de digitação..."
                          className="text-xs" />
                      </section>

                      <div className="flex justify-end">
                        <Button onClick={tryConfirmProntuario} disabled={!mrChanges.length || saving} className="gap-2">
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
                        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs flex items-start gap-2">
                          <FileWarning className="h-4 w-4 text-warning-on-soft shrink-0 mt-1" />
                          <div>
                            <div className="font-medium text-warning-on-soft">
                              Sem ficha cadastral vinculada
                            </div>
                            <p className="text-xs text-warning-on-soft mt-1">
                              Este paciente foi admitido sem cadastro central (comum em leitos legados da UTI). Ative <strong>"Atualizar cadastro"</strong> para preencher os campos manualmente ou importar do PIS — ao salvar, a ficha será criada e vinculada automaticamente ao prontuário.
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Cabeçalho com botão Atualizar cadastro */}
                      <div className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${cadastroEditMode ? "border-released/40 bg-released/5" : "border-muted bg-muted/30"}`}>
                        <div className="text-xs leading-snug flex items-center gap-2">
                          {cadastroEditMode ? <Pencil className="h-3.5 w-3.5 text-released-on-soft" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                          <div>
                            <div className="font-medium">
                              {cadastroEditMode ? "Modo edição ativo" : "Cadastro bloqueado"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {cadastroEditMode
                                ? "Edite os campos manualmente OU use a captura PIS abaixo. Toda alteração exige motivo + confirmação."
                                : "Para alterar dados cadastrais ou importar do PIS, ative o modo edição."}
                            </p>
                          </div>
                        </div>
                        {!cadastroEditMode ? (
                          <Button size="sm" onClick={() => setCadastroEditMode(true)} className="gap-2 text-xs">
                            <Pencil className="h-3.5 w-3.5" /> Atualizar cadastro
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => {
                            setCadastroEditMode(false);
                            setReg(registry ? { ...registry } : {});
                            setRegReason("");
                            setPasteText("");
                            setPisFromFieldsApplied(new Set());
                          }} className="gap-2 text-xs">
                            <X className="h-3.5 w-3.5" /> Cancelar edição
                          </Button>
                        )}
                      </div>

                      {/* Captura PIS (anexar / arrastar / colar) — só em modo edição */}
                      {cadastroEditMode && (
                        <section className="p-3 rounded-lg border border-border/30 bg-primary/5 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <Sparkles className="h-3.5 w-3.5 text-foreground" />
                            Captura automática do PIS
                            <span className="text-xs font-normal text-muted-foreground">(anexar arquivo, arrastar ou colar texto)</span>
                          </div>

                          <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={`rounded-md border-2 border-dashed p-3 text-center text-xs transition-colors ${
                              isDragging ? "border-border bg-primary/10" : "border-muted-foreground/30 bg-background/50"
                            }`}
                          >
                            <FileUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-muted-foreground">Arraste a ficha PIS aqui (PDF/imagem) <strong>ou</strong></p>
                            <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                              onChange={handlePisFile} className="hidden" />
                            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}
                              disabled={importing} className="gap-2 text-xs mt-2">
                              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                              Anexar arquivo
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-2">
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
                                className="gap-2 text-xs">
                                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                Reconhecer e revisar
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            Os dados reconhecidos passam por uma etapa de revisão antes de serem aplicados aos campos. Nada é salvo automaticamente.
                          </p>
                        </section>
                      )}

                      {registry?.is_unidentified && (
                        <Badge variant="outline" className="text-xs border-warning/40">
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
                          <section className="space-y-2 p-3 rounded-lg border border-warning/30 bg-warning/10">
                            <Label className="text-xs font-medium flex items-center gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-warning-on-soft" />
                              Motivo da atualização cadastral (obrigatório)
                            </Label>
                            <Textarea value={regReason} onChange={(e) => setRegReason(e.target.value)} rows={2}
                              placeholder="Ex.: Atualização do endereço informada pelo acompanhante; importação do PIS..."
                              className="text-xs" />
                          </section>

                          <div className="flex justify-end">
                            <Button onClick={tryConfirmFicha} disabled={!regChanges.length || saving} className="gap-2">
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
                          <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-1" />
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-destructive uppercase tracking-wide">
                              Exclusão administrativa do paciente
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Operação <strong>irreversível</strong> reservada para casos excepcionais
                              de erro administrativo (cadastro duplicado, paciente inexistente, teste em produção, etc).
                              Apaga em cascata <strong>todos os dados</strong> deste paciente: prontuário, ficha cadastral,
                              evoluções, prescrições, exames, culturas, movimentações, atendimentos e históricos de edição.
                              Esta ação <strong>não pode ser desfeita</strong>.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-medium">
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
                          <Label className="text-xs font-medium">
                            Para confirmar, digite exatamente o nome do paciente:
                          </Label>
                          <code className="block text-xs p-2 bg-muted rounded-md border">{patientName || "—"}</code>
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
                            className="gap-2"
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
              <Sparkles className="h-5 w-5 text-foreground" />
              Revisar dados reconhecidos do PIS
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              A IA leu os dados {pisSource === "paste" ? "colados" : "do anexo"} e identificou os campos abaixo.
              <strong> Marque apenas os que deseja aplicar</strong> ao cadastro. Em seguida você ainda preencherá o motivo
              e confirmará o salvamento — nada é gravado neste passo.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[55vh] pr-3 -mr-1 border rounded-md bg-background/40">
            <div className="space-y-2 p-2">
              {Object.entries(PIS_FIELD_MAP).map(([pisKey, regKey]) => {
                const newVal = pisExtracted?.[pisKey];
                const newStr = newVal === null || newVal === undefined ? "" : String(newVal).trim();
                const oldStr = String((registry as any)?.[regKey] ?? "").trim();
                const same = newStr === oldStr;
                const hasNew = newStr.length > 0;
                return (
                  <div
                    key={pisKey}
                    className={`flex items-start gap-2 p-2 rounded-md border text-xs ${
                      !hasNew ? "bg-muted/30 opacity-60" :
                      same ? "bg-muted/40 border-muted" :
                      "bg-primary/5 border-border/30"
                    }`}
                  >
                    <Checkbox
                      checked={!!pisAccepted[pisKey]}
                      disabled={!hasNew}
                      onCheckedChange={(v) => setPisAccepted((prev) => ({ ...prev, [pisKey]: !!v }))}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {REG_FIELD_LABEL[regKey as string] || pisKey}
                        {!hasNew && <Badge variant="outline" className="text-xs">Não reconhecido</Badge>}
                        {hasNew && same && <Badge variant="outline" className="text-xs">Já está igual</Badge>}
                        {hasNew && !same && oldStr === "" && <Badge variant="secondary" className="text-xs bg-released/15 text-released-on-soft">Novo</Badge>}
                        {hasNew && !same && oldStr !== "" && <Badge variant="secondary" className="text-xs bg-warning/15 text-warning-on-soft">Será substituído</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">Atual</div>
                          <div className="break-words">{oldStr || <span className="italic text-muted-foreground">vazio</span>}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">Reconhecido</div>
                          <div className="break-words font-medium">{newStr || <span className="italic text-muted-foreground">—</span>}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="border-t pt-3 space-y-2">
            <div className="text-xs text-muted-foreground p-2 rounded-md bg-muted/40 leading-relaxed">
              <strong>O que acontece a seguir?</strong> Os campos marcados serão preenchidos no formulário (em destaque azul).
              Você ainda precisa informar o <strong>motivo</strong> e clicar em <strong>"Revisar e salvar ficha"</strong> para gravar
              as alterações no banco — cada campo será registrado no histórico com origem <code className="text-xs">pis_import</code>.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPisReviewOpen(false); setPisExtracted(null); }} className="gap-2">
                <X className="h-3.5 w-3.5" /> Cancelar reconhecimento
              </Button>
              <Button size="sm" onClick={applyPisAccepted}
                disabled={!Object.values(pisAccepted).some(Boolean)}
                className="gap-2 bg-primary hover:bg-primary">
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
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
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
      <Label className="text-xs flex items-center gap-1">
        {label}
        {highlight && <Badge variant="secondary" className="text-xs uppercase tracking-wider h-3.5 px-1 bg-primary/15 text-foreground">PIS</Badge>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`h-9 text-xs ${highlight ? "border-border/40 bg-primary/5" : ""} ${disabled ? "bg-muted/40 cursor-not-allowed" : ""}`}
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
      <div className="flex items-center gap-2 text-xs font-medium">
        {icon}
        {title} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem alterações registradas.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((h) => (
            <div key={h.id} className="text-xs p-2 rounded-md border bg-background">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {h.labelMap[h.field_changed] || h.field_changed}
                  </Badge>
                  {h.source && h.source !== "prontuario" && h.source !== "manual" && (
                    <Badge variant="secondary" className="text-xs uppercase tracking-wider">{h.source}</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.changed_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">De: </span>
                  <code className="px-1 bg-muted rounded-md break-all">{h.old_value || "—"}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Para: </span>
                  <code className="px-1 bg-muted rounded-md break-all">{h.new_value || "—"}</code>
                </div>
              </div>
              <p className="text-xs mt-1 italic text-foreground/80">"{h.reason}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                por {h.changed_by_email || "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
