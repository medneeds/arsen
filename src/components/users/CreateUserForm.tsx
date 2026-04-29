import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
import { ACCESS_PROFILES, SYSTEM_ROLES, PROFILE_TO_ROLE_HINT, type AccessProfile, type AppRole } from "@/config/userProfiles";
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

const GLOBAL_PROFILES: AccessProfile[] = ["gestor"];
const GLOBAL_ROLES: AppRole[] = ["admin"];

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
  // Rejeita sequências repetidas (000.000.000-00, 111…, etc.)
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
  const [role, setRole] = useState<AppRole>("medico");
  const [departments, setDepartments] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState(genTempPassword());

  const isGlobal = useMemo(
    () => GLOBAL_PROFILES.includes(accessProfile) || GLOBAL_ROLES.includes(role),
    [accessProfile, role],
  );

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

  // Auto-sugere role ao mudar accessProfile
  useEffect(() => {
    const hint = PROFILE_TO_ROLE_HINT[accessProfile];
    if (hint) setRole(hint);
  }, [accessProfile]);

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
      if (error) return; // silencioso; o submit revalida no servidor
      if (data) {
        setCpfError(`CPF já cadastrado${data.full_name ? ` para ${data.full_name}` : ""}`);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [cpf]);

  const reset = () => {
    setFullName(""); setEmail(""); setCpf(""); setPhone(""); setCrm("");
    setDepartments(new Set()); setPassword(genTempPassword());
    setCpfError(null);
  };

  const handleSubmit = async () => {
    // Validações
    if (!fullName.trim()) return toast.error("Informe o nome completo");
    if (!email.trim() || !/.+@.+\..+/.test(email)) return toast.error("E-mail inválido");
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) return toast.error("Informe o CPF completo");
    if (!isValidCpf(cpfDigits)) return toast.error("CPF inválido — verifique os dígitos");
    if (cpfError) return toast.error(cpfError);
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Telefone inválido");
    if (!hospitalUnitId) return toast.error("Selecione a unidade hospitalar");
    if (mode === "password" && password.length < 8) return toast.error("Senha precisa ter ao menos 8 caracteres");
    if (!isGlobal && departments.size === 0) {
      return toast.error("Selecione ao menos um setor (ou mude para perfil global)");
    }

    setSubmitting(true);
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
          role,
          hospitalUnitId,
          departments: isGlobal ? [] : Array.from(departments),
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

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
      reset();
      onCreated?.();
    } catch (e) {
      const msg = (e as Error).message ?? "Falha ao criar usuário";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => setPassword(genTempPassword())} title="Gerar nova">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(password); toast.success("Copiado"); }} title="Copiar">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            O usuário deverá trocar a senha no primeiro login.
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
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex.: MARIA SILVA" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase">E-mail *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@hospital.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5" /> CPF *</Label>
          <div className="relative">
            <Input
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
          <Input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" /> CRM / Registro</Label>
          <Input value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Unidade Hospitalar *</Label>
          <Select value={hospitalUnitId} onValueChange={setHospitalUnitId} disabled={loadingUnits}>
            <SelectTrigger><SelectValue placeholder={loadingUnits ? "Carregando…" : "Selecione a unidade"} /></SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}{u.unit_code ? ` (${u.unit_code})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Perfil + Role */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Perfil de Acesso *</Label>
          <Select value={accessProfile} onValueChange={(v) => setAccessProfile(v as AccessProfile)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACCESS_PROFILES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button type="button" onClick={handleSubmit} disabled={submitting || !!cpfError || cpfChecking}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando…</> : <><UserPlus className="h-4 w-4 mr-2" /> Cadastrar usuário</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
