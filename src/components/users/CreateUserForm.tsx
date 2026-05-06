import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  UserPlus,
  KeyRound,
  Mail,
  Building2,
  Shield,
  IdCard,
  Phone,
  Stethoscope,
  Loader2,
  Copy,
  RefreshCw,
  CloudOff,
  CloudUpload,
  CheckCircle2,
  Trash2,
  Circle,
  XCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ACCESS_PROFILES, SYSTEM_ROLES, type AccessProfile, type AppRole } from "@/config/userProfiles";
import { PROFILE_DEFAULTS } from "@/config/profileDefaults";
import { SectorPermissionsPicker } from "@/components/permissions/SectorPermissionsPicker";

interface HospitalUnit {
  id: string;
  name: string;
  unit_code: string | null;
}

interface Props {
  /** Callback quando o cadastro é concluído (para refresh da lista). */
  onCreated?: () => void;
}

const GLOBAL_PROFILES: AccessProfile[] = [
  "gestor",
  "coord_medico",
  "coord_enfermagem",
  "coord_multi",
];
const GLOBAL_ROLES: AppRole[] = ["admin"];
const DRAFT_KEY = "createUserForm:draft:v1";
const AUTOSAVE_DEBOUNCE_MS = 800;

type DraftShape = {
  mode: "password" | "invite";
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  crm: string;
  hospitalUnitId: string;
  accessProfile: AccessProfile;
  accessProfiles: AccessProfile[];
  role: AppRole;
  departments: string[];
};

function genTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Valida CPF pelos dígitos verificadores (algoritmo da Receita Federal). */
function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (sliceLen: number) => {
    let sum = 0;
    for (let i = 0; i < sliceLen; i++) {
      sum += parseInt(cpf[i], 10) * (sliceLen + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === parseInt(cpf[9], 10) && calc(10) === parseInt(cpf[10], 10);
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

type SubmitStepKey =
  | "validate"
  | "cpf"
  | "auth"
  | "profile"
  | "role"
  | "hospital"
  | "departments"
  | "audit"
  | "done";

type StepStatus = "pending" | "running" | "done" | "error" | "skipped";

interface SubmitStep {
  key: SubmitStepKey;
  label: string;
  status: StepStatus;
  detail?: string;
}

const BASE_STEPS: { key: SubmitStepKey; label: string }[] = [
  { key: "validate", label: "Validando formulário" },
  { key: "cpf", label: "Verificando CPF no banco" },
  { key: "auth", label: "Criando credencial de acesso" },
  { key: "profile", label: "Sincronizando perfil" },
  { key: "role", label: "Atribuindo role do sistema" },
  { key: "hospital", label: "Vinculando unidade hospitalar" },
  { key: "departments", label: "Aplicando setores permitidos" },
  { key: "audit", label: "Registrando auditoria" },
];

export function CreateUserForm({ onCreated }: Props) {
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modo
  const [mode, setMode] = useState<"password" | "invite">("password");

  // Campos
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfChecking, setCpfChecking] = useState(false);
  const [phone, setPhone] = useState("");
  const [crm, setCrm] = useState("");
  const [hospitalUnitId, setHospitalUnitId] = useState("");
  const [accessProfile, setAccessProfile] = useState<AccessProfile>("medico");
  // Múltiplos perfis acumulados (ex.: gestor + nir + médico). O primeiro é o "principal".
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>(["medico"]);
  const [role, setRole] = useState<AppRole>("medico");
  const [departments, setDepartments] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState(genTempPassword());

  // Progresso de submit
  const [submitSteps, setSubmitSteps] = useState<SubmitStep[]>([]);
  const submitStepsRef = useRef<SubmitStep[]>([]);

  // Autosave state
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "restored">("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const hydratedRef = useRef(false);

  // Refs para foco automático
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const unitTriggerRef = useRef<HTMLButtonElement>(null);

  const isGlobal = useMemo(
    () => accessProfiles.some((p) => GLOBAL_PROFILES.includes(p)) || GLOBAL_ROLES.includes(role),
    [accessProfiles, role],
  );

  // ---- Hidratação do rascunho (uma única vez) ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<DraftShape>;
        if (d) {
          if (d.mode) setMode(d.mode);
          if (d.fullName) setFullName(d.fullName);
          if (d.email) setEmail(d.email);
          if (d.cpf) setCpf(d.cpf);
          if (d.phone) setPhone(d.phone);
          if (d.crm) setCrm(d.crm);
          if (d.hospitalUnitId) setHospitalUnitId(d.hospitalUnitId);
          if (d.accessProfile) setAccessProfile(d.accessProfile);
          if (Array.isArray(d.accessProfiles) && d.accessProfiles.length > 0) {
            setAccessProfiles(d.accessProfiles);
          } else if (d.accessProfile) {
            setAccessProfiles([d.accessProfile]);
          }
          if (d.role) setRole(d.role);
          if (Array.isArray(d.departments)) setDepartments(new Set(d.departments));
          setDraftStatus("restored");
          toast.info("Rascunho restaurado", { description: "Continuando de onde parou." });
        }
      }
    } catch {
      /* ignore */
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  // ---- Carrega unidades ----
  useEffect(() => {
    (async () => {
      setLoadingUnits(true);
      const { data, error } = await supabase
        .from("hospital_units")
        .select("id, name, unit_code")
        .order("name");
      if (error) toast.error("Falha ao carregar unidades");
      else setUnits(data ?? []);
      setLoadingUnits(false);
    })();
  }, []);

  // ---- Foco inicial no primeiro campo obrigatório ----
  useEffect(() => {
    if (!fullName) {
      const t = setTimeout(() => fullNameRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantém accessProfile (singular, "principal") sempre sincronizado com o
  // primeiro item de accessProfiles. accessProfiles é a fonte de verdade.
  useEffect(() => {
    if (accessProfiles.length === 0) return;
    if (accessProfiles[0] !== accessProfile) {
      setAccessProfile(accessProfiles[0]);
    }
  }, [accessProfiles, accessProfile]);

  // Auto-aplica permissões padrão (role + setores sugeridos) ao mudar perfil PRINCIPAL.
  // Não bloqueia edição: gestor/admin pode ajustar manualmente depois.
  // Roda só após hidratação para não sobrescrever um rascunho restaurado.
  const lastAutoAppliedProfileRef = useRef<AccessProfile | null>(null);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (lastAutoAppliedProfileRef.current === accessProfile) return;
    const defaults = PROFILE_DEFAULTS[accessProfile];
    if (!defaults) return;
    setRole(defaults.role);
    setDepartments(new Set(defaults.departments));
    if (lastAutoAppliedProfileRef.current !== null) {
      toast.info("Permissões padrão aplicadas", { description: defaults.hint });
    }
    lastAutoAppliedProfileRef.current = accessProfile;
  }, [accessProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Autosave debounced ----
  useEffect(() => {
    if (!hydratedRef.current) return;
    setDraftStatus("saving");
    const t = setTimeout(() => {
      try {
        const draft: DraftShape = {
          mode,
          fullName,
          email,
          cpf,
          phone,
          crm,
          hospitalUnitId,
          accessProfile,
          accessProfiles,
          role,
          departments: Array.from(departments),
        };
        const hasContent =
          fullName || email || cpf || phone || crm || hospitalUnitId || departments.size > 0;
        if (hasContent) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
          setDraftSavedAt(Date.now());
          setDraftStatus("saved");
        } else {
          localStorage.removeItem(DRAFT_KEY);
          setDraftStatus("idle");
        }
      } catch {
        setDraftStatus("idle");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [mode, fullName, email, cpf, phone, crm, hospitalUnitId, accessProfile, accessProfiles, role, departments]);

  // Validação de CPF (formato + dígitos verificadores + duplicidade) com debounce
  useEffect(() => {
    const digits = cpf.replace(/\D/g, "");
    setCpfChecking(false);
    if (digits.length === 0) {
      setCpfError(null);
      return;
    }
    if (digits.length < 11) {
      setCpfError("CPF incompleto");
      return;
    }
    if (!isValidCpf(digits)) {
      setCpfError("CPF inválido (dígito verificador não confere)");
      return;
    }
    setCpfError(null);
    setCpfChecking(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("cpf", digits)
        .maybeSingle();
      setCpfChecking(false);
      if (error) return;
      if (data) {
        setCpfError(`CPF já cadastrado${data.full_name ? ` para ${data.full_name}` : ""}`);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [cpf]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftSavedAt(null);
    setDraftStatus("idle");
  };

  const reset = () => {
    setFullName(""); setEmail(""); setCpf(""); setPhone(""); setCrm("");
    setDepartments(new Set()); setPassword(genTempPassword());
    setCpfError(null);
    clearDraft();
    setTimeout(() => fullNameRef.current?.focus(), 60);
  };

  /** Foca o ref e mostra um toast de erro. Retorna true para encadear `return`. */
  const focusInvalid = (ref: RefObject<HTMLElement>, msg: string) => {
    toast.error(msg);
    setTimeout(() => {
      ref.current?.focus();
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return true;
  };

  // ---- Helpers de progresso ----
  const initSteps = (isGlobalNow: boolean) => {
    const steps: SubmitStep[] = BASE_STEPS.map((s) => ({
      key: s.key,
      label: s.label,
      status: "pending",
    }));
    if (isGlobalNow) {
      const idx = steps.findIndex((s) => s.key === "departments");
      if (idx >= 0) {
        steps[idx] = { ...steps[idx], status: "skipped", detail: "Perfil global — sem setores" };
      }
    }
    submitStepsRef.current = steps;
    setSubmitSteps(steps);
  };

  const setStep = (key: SubmitStepKey, patch: Partial<SubmitStep>) => {
    const next = submitStepsRef.current.map((s) =>
      s.key === key ? { ...s, ...patch } : s,
    );
    submitStepsRef.current = next;
    setSubmitSteps(next);
  };

  const completePending = (asError = false, errorMsg?: string) => {
    const next = submitStepsRef.current.map((s) => {
      if (s.status === "running") {
        return asError
          ? { ...s, status: "error" as StepStatus, detail: errorMsg ?? s.detail }
          : { ...s, status: "done" as StepStatus };
      }
      return s;
    });
    submitStepsRef.current = next;
    setSubmitSteps(next);
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleSubmit = async () => {
    if (!fullName.trim()) return focusInvalid(fullNameRef, "Informe o nome completo");
    if (!email.trim() || !/.+@.+\..+/.test(email)) return focusInvalid(emailRef, "E-mail inválido");
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) return focusInvalid(cpfRef, "Informe o CPF completo");
    if (!isValidCpf(cpfDigits)) return focusInvalid(cpfRef, "CPF inválido — verifique os dígitos");
    if (cpfError) return focusInvalid(cpfRef, cpfError);
    if (phone.replace(/\D/g, "").length < 10) return focusInvalid(phoneRef, "Telefone inválido");
    if (!hospitalUnitId) return focusInvalid(unitTriggerRef as unknown as RefObject<HTMLElement>, "Selecione a unidade hospitalar");
    if (mode === "password" && (password.length < 6 || password.length > 12)) return toast.error("Senha precisa ter de 6 a 12 caracteres");
    if (!isGlobal && departments.size === 0) {
      return toast.error("Selecione ao menos um setor (ou mude para perfil global)");
    }

    setSubmitting(true);
    initSteps(isGlobal);

    // Etapa 1: validação local (real)
    setStep("validate", { status: "running" });
    await wait(120);
    setStep("validate", { status: "done" });

    // Etapa 2: confirma CPF no banco (consulta real adicional para refletir status backend)
    setStep("cpf", { status: "running", detail: "Consultando profiles…" });
    try {
      const { data: cpfDup, error: cpfQErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("cpf", cpfDigits)
        .maybeSingle();
      if (cpfQErr) throw cpfQErr;
      if (cpfDup) {
        setStep("cpf", { status: "error", detail: "CPF já cadastrado" });
        toast.error("CPF já cadastrado no sistema");
        setSubmitting(false);
        return;
      }
      setStep("cpf", { status: "done", detail: "Disponível" });
    } catch (e) {
      setStep("cpf", { status: "error", detail: (e as Error).message });
      toast.error("Falha ao validar CPF");
      setSubmitting(false);
      return;
    }

    // Etapas 3-8 são executadas pela edge function como uma única transação.
    // Avançamos visualmente em paralelo à chamada para refletir a ordem real
    // do backend (ver supabase/functions/admin-create-user/index.ts).
    const advanceTimers: ReturnType<typeof setTimeout>[] = [];
    const startStep = (key: SubmitStepKey, delay: number, detail?: string) => {
      advanceTimers.push(
        setTimeout(() => {
          // Marca a etapa anterior em running como concluída
          const prev = submitStepsRef.current.find((s) => s.status === "running");
          if (prev) setStep(prev.key, { status: "done" });
          setStep(key, { status: "running", detail });
        }, delay),
      );
    };

    setStep("auth", {
      status: "running",
      detail: mode === "password" ? "Criando usuário com senha provisória" : "Enviando convite por e-mail",
    });
    startStep("profile", 700, "Upsert em profiles");
    startStep("role", 1200, `Atribuindo role: ${role}`);
    startStep("hospital", 1500, "Vinculando hospital_unit");
    if (!isGlobal) {
      startStep("departments", 1800, `${departments.size} setor(es)`);
      startStep("audit", 2200, "Persistindo trilha");
    } else {
      startStep("audit", 1900, "Persistindo trilha");
    }

    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          mode,
          email: email.trim().toLowerCase(),
          password: mode === "password" ? password : undefined,
          fullName: fullName.trim().toUpperCase(),
          cpf: cpf.replace(/\D/g, ""),
          phone,
          crm: crm.trim() || null,
          accessProfile,
          accessProfiles,
          role,
          hospitalUnitId,
          departments: isGlobal ? [] : Array.from(departments),
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      advanceTimers.forEach(clearTimeout);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // Marca todas as etapas pendentes/em execução como concluídas
      const finalized = submitStepsRef.current.map((s) =>
        s.status === "pending" || s.status === "running" ? { ...s, status: "done" as StepStatus } : s,
      );
      submitStepsRef.current = finalized;
      setSubmitSteps(finalized);

      if (mode === "password") {
        toast.success("Usuário criado!", {
          description: `Senha provisória: ${password}`,
          action: {
            label: "Copiar",
            onClick: () => navigator.clipboard.writeText(password),
          },
          duration: 12000,
        });
      } else {
        toast.success("Convite enviado por e-mail");
      }
      // Pequeno delay para o usuário ver o estado "done" completo
      await wait(500);
      reset();
      setSubmitSteps([]);
      submitStepsRef.current = [];
      onCreated?.();
    } catch (e) {
      advanceTimers.forEach(clearTimeout);
      const msg = (e as Error).message ?? "Falha ao criar usuário";
      completePending(true, msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Renderização do indicador de autosave ----
  const draftIndicator = (() => {
    if (submitting) return null;
    if (draftStatus === "saving") {
      return (
        <span className="preserve-case inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CloudUpload className="h-3 w-3 animate-pulse" /> Salvando rascunho…
        </span>
      );
    }
    if (draftStatus === "saved" || draftStatus === "restored") {
      const when = draftSavedAt ? new Date(draftSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
      return (
        <span className="preserve-case inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Rascunho salvo{when ? ` às ${when}` : ""}
        </span>
      );
    }
    return (
      <span className="preserve-case inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <CloudOff className="h-3 w-3" /> Sem rascunho
      </span>
    );
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow">
            <UserPlus className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Cadastrar novo usuário</h2>
            <p className="text-xs text-muted-foreground">
              Cria o acesso de um colaborador segmentado por unidade, perfil e setores.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {draftIndicator}
          {(draftStatus === "saved" || draftStatus === "restored") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => {
                clearDraft();
                toast.success("Rascunho descartado");
              }}
              title="Descartar rascunho salvo"
            >
              <Trash2 className="h-3 w-3" /> Descartar
            </Button>
          )}
        </div>
      </div>

      {/* Modo */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "password" | "invite")}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="password" className="gap-2">
            <KeyRound className="h-4 w-4" /> Senha provisória
          </TabsTrigger>
          <TabsTrigger value="invite" className="gap-2">
            <Mail className="h-4 w-4" /> Convite por e-mail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="mt-3">
          <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
            <Label className="text-xs font-bold uppercase shrink-0">Senha</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 12))}
              className="font-mono"
              maxLength={12}
              placeholder="6 a 12 caracteres"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => setPassword(genTempPassword())} title="Gerar nova">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(password); toast.success("Copiado"); }} title="Copiar">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            De 6 a 12 caracteres — letras maiúsculas/minúsculas, números e especiais permitidos. O usuário deverá trocar a senha no primeiro login.
          </p>
        </TabsContent>

        <TabsContent value="invite" className="mt-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Será enviado um e-mail com link para o usuário definir a própria senha.
          </div>
        </TabsContent>
      </Tabs>

      {/* Identificação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase">Nome completo *</Label>
          <Input
            ref={fullNameRef}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex.: MARIA SILVA"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase">E-mail *</Label>
          <Input
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@hospital.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5" /> CPF *</Label>
          <div className="relative">
            <Input
              ref={cpfRef}
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              aria-invalid={!!cpfError}
              aria-describedby="cpf-help"
              className={cpfError ? "border-destructive focus-visible:ring-destructive pr-9" : "pr-9"}
            />
            {cpfChecking && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
            {!cpfChecking && cpf && !cpfError && cpf.replace(/\D/g, "").length === 11 && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            )}
          </div>
          <p
            id="cpf-help"
            className={`text-[11px] min-h-[14px] ${cpfError ? "text-destructive font-medium" : "text-muted-foreground"}`}
          >
            {cpfError ?? (cpfChecking ? "Verificando disponibilidade…" : "Informe um CPF válido (não cadastrado).")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone *</Label>
          <Input
            ref={phoneRef}
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" /> CRM / Registro</Label>
          <Input value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Unidade Hospitalar *</Label>
          {loadingUnits ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={hospitalUnitId} onValueChange={setHospitalUnitId}>
              <SelectTrigger ref={unitTriggerRef}>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}{u.unit_code ? ` (${u.unit_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Perfil + Role */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Perfis de Acesso *
          </Label>
          <p className="preserve-case text-[11px] text-muted-foreground -mt-0.5">
            Selecione um ou mais perfis. O <strong>primeiro</strong> é o principal — define a tela de pouso padrão e os setores sugeridos. Quando há mais de um, o usuário escolherá no login qual usar.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ACCESS_PROFILES.map((p) => {
              const checked = accessProfiles.includes(p.value);
              const isPrimary = checked && accessProfiles[0] === p.value;
              return (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => {
                    setAccessProfiles((prev) => {
                      if (prev.includes(p.value)) {
                        // Não permite remover o último
                        if (prev.length === 1) return prev;
                        return prev.filter((x) => x !== p.value);
                      }
                      return [...prev, p.value];
                    });
                  }}
                  onDoubleClick={() => {
                    // Duplo clique = promover a principal
                    setAccessProfiles((prev) => {
                      if (!prev.includes(p.value)) return [p.value, ...prev];
                      return [p.value, ...prev.filter((x) => x !== p.value)];
                    });
                  }}
                  className={`preserve-case text-xs px-2.5 py-1 rounded-full border transition-all ${
                    isPrimary
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : checked
                        ? "bg-primary/10 text-primary border-primary/40"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                  title={isPrimary ? "Perfil principal (duplo clique para mudar)" : checked ? "Duplo clique para definir como principal" : "Clique para adicionar"}
                >
                  {isPrimary && "★ "}{p.shortLabel ?? p.label}
                </button>
              );
            })}
          </div>
          <p className="preserve-case text-[10px] text-muted-foreground/80">
            Clique para adicionar/remover • Duplo clique para definir como principal (★)
          </p>
        </div>
        <div className="hidden" aria-hidden="true">
          {/* compat: alguns rascunhos antigos ainda referenciam accessProfile singular */}
          <input type="hidden" value={accessProfile} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase">Role do Sistema *</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SYSTEM_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Setores */}
      {isGlobal ? (
        <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-bold uppercase tracking-wider text-primary">Perfil global</p>
            <p className="text-xs text-muted-foreground mt-1">
              {role === "admin" ? "Coordenadores (admin)" : "Gestores"} têm acesso a todos os setores automaticamente —
              nenhuma seleção é necessária.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4">
          <SectorPermissionsPicker selected={departments} onChange={setDepartments} />
        </div>
      )}

      {/* Indicador de progresso do submit (etapas reais do backend) */}
      {submitSteps.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-bottom-1">
          {(() => {
            const total = submitSteps.filter((s) => s.status !== "skipped").length;
            const done = submitSteps.filter((s) => s.status === "done").length;
            const hasError = submitSteps.some((s) => s.status === "error");
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const current = submitSteps.find((s) => s.status === "running");
            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    {hasError ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : pct === 100 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    <span className="preserve-case">
                      {hasError
                        ? "Falha durante o cadastro"
                        : pct === 100
                          ? "Cadastro concluído"
                          : current
                            ? current.label
                            : "Processando…"}
                    </span>
                  </div>
                  <span className="preserve-case text-xs text-muted-foreground tabular-nums">
                    {done}/{total} · {pct}%
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
                  {submitSteps.map((s) => (
                    <li key={s.key} className="flex items-start gap-2 text-[12px]">
                      <span className="mt-0.5 shrink-0">
                        {s.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                        {s.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                        {s.status === "pending" && <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                        {s.status === "error" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                        {s.status === "skipped" && <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />}
                      </span>
                      <span className="preserve-case leading-tight">
                        <span
                          className={
                            s.status === "done"
                              ? "text-foreground"
                              : s.status === "running"
                                ? "text-foreground font-medium"
                                : s.status === "error"
                                  ? "text-destructive font-medium"
                                  : s.status === "skipped"
                                    ? "text-muted-foreground/60 line-through"
                                    : "text-muted-foreground"
                          }
                        >
                          {s.label}
                        </span>
                        {s.detail && (
                          <span className="block text-[10.5px] text-muted-foreground">{s.detail}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
        </div>
      )}

      {/* Resumo + ação */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Badge variant="outline">{mode === "password" ? "Acesso imediato" : "Convite"}</Badge>
          <Badge variant="outline">Perfil: {accessProfile}</Badge>
          <Badge variant="outline">Role: {role}</Badge>
          {!isGlobal && <Badge variant="outline">{departments.size} setor(es)</Badge>}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={reset} disabled={submitting}>Limpar</Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || !!cpfError || cpfChecking || loadingUnits}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando…</> : <><UserPlus className="h-4 w-4 mr-2" /> Cadastrar usuário</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
