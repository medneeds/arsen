import { useEffect, useRef, useState, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  UserPlus,
  Shield,
  IdCard,
  Stethoscope,
  Loader2,
  Copy,
  KeyRound,
  CheckCircle2,
  Layers,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useSectorNavigation } from "@/hooks/useSectorNavigation";
import { ACCESS_PROFILES } from "@/config/userProfiles";

// MIGRAÇÃO: schema NOVO (português). O papel do usuário é a coluna
// profissionais.papel (enum papel_profissional) — não existe mais user_roles,
// nem profiles, nem hospital_units. O hospital é derivado do admin chamador
// pela própria edge function "criar-profissional".
type Papel = Database["public"]["Enums"]["papel_profissional"];

// MIGRAÇÃO: apenas papéis clínicos/operacionais. super_admin/admin/dev são
// bloqueados no backend (PAPEIS_PERMITIDOS) e ficam fora do Select.
const PAPEL_OPTIONS: { value: Papel; label: string }[] = [
  { value: "medico", label: "Médico" },
  { value: "enfermeiro", label: "Enfermeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "coordenador", label: "Coordenador" },
  { value: "farmacia", label: "Farmácia" },
  { value: "regulador", label: "Regulador" },
  { value: "nir", label: "NIR" },
  { value: "porta", label: "Médico da porta" },
  { value: "visitante", label: "Visitante" },
];

interface Props {
  /** Callback quando o cadastro é concluído (para refresh da lista). */
  onCreated?: () => void;
}

interface CreatedInfo {
  nome: string;
  email: string;
  tempPassword: string;
}

/** Resposta esperada da edge function "criar-profissional". */
interface CriarProfissionalResponse {
  success?: boolean;
  email?: string;
  nome?: string;
  tempPassword?: string;
  error?: string;
}

export function CreateUserForm({ onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);

  // Campos (schema novo)
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>("medico");
  // Perfis de acesso (um ou mais). O PRIMEIRO é o principal (★) — define a tela
  // de pouso e vira user_metadata.access_profile; a lista vai em access_profiles.
  const [accessProfiles, setAccessProfiles] = useState<string[]>(["medico"]);
  const toggleProfile = (v: string) =>
    setAccessProfiles((prev) => {
      if (prev.includes(v)) return prev.length === 1 ? prev : prev.filter((x) => x !== v);
      return [...prev, v];
    });
  const makePrimary = (v: string) =>
    setAccessProfiles((prev) => (prev.includes(v) ? [v, ...prev.filter((x) => x !== v)] : [v, ...prev]));
  const [conselho, setConselho] = useState(""); // ex.: CRM, COREN (opcional)
  const [numeroConselho, setNumeroConselho] = useState(""); // opcional
  const [cargo, setCargo] = useState(""); // opcional

  // Permissões de setor (profissionais_setores) — setores do banco (alas→setores).
  const { sectors: dbSectors } = useSectorNavigation();
  const setoresByAla = dbSectors.reduce<Record<string, typeof dbSectors>>((acc, s) => {
    (acc[s.alaNome] ??= []).push(s);
    return acc;
  }, {});
  const [selectedSetores, setSelectedSetores] = useState<Set<string>>(new Set());
  const toggleSetor = (id: string) =>
    setSelectedSetores((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Resultado (senha provisória gerada pelo backend)
  const [created, setCreated] = useState<CreatedInfo | null>(null);

  // Refs para foco automático
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // ---- Foco inicial no primeiro campo obrigatório ----
  useEffect(() => {
    const t = setTimeout(() => nomeRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  /** Foca o ref e mostra um toast de erro. Retorna true para encadear `return`. */
  const focusInvalid = (ref: RefObject<HTMLElement>, msg: string) => {
    toast.error(msg);
    setTimeout(() => {
      ref.current?.focus();
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return true;
  };

  const reset = () => {
    setNome("");
    setEmail("");
    setPapel("medico");
    setAccessProfiles(["medico"]);
    setConselho("");
    setNumeroConselho("");
    setCargo("");
    setSelectedSetores(new Set());
    setTimeout(() => nomeRef.current?.focus(), 60);
  };

  /**
   * Extrai a mensagem de erro real da FunctionsHttpError. O supabase-js embute
   * o corpo JSON da edge function em (error as any).context.body (string).
   */
  const extractError = async (error: unknown): Promise<string> => {
    const fallback = (error as Error)?.message ?? "Falha ao criar usuário";
    const ctx = (error as { context?: { body?: unknown } })?.context;
    const body = ctx?.body;
    try {
      if (typeof body === "string") {
        const parsed = JSON.parse(body) as { error?: string };
        if (parsed?.error) return parsed.error;
      } else if (body && typeof (body as ReadableStream).getReader === "function") {
        const text = await new Response(body as ReadableStream).text();
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed?.error) return parsed.error;
      }
    } catch {
      /* usa o fallback */
    }
    return fallback;
  };

  const handleSubmit = async () => {
    if (!nome.trim()) return focusInvalid(nomeRef, "Informe o nome completo");
    if (!email.trim() || !/.+@.+\..+/.test(email)) return focusInvalid(emailRef, "E-mail inválido");

    setSubmitting(true);
    setCreated(null);
    try {
      // MIGRAÇÃO: a edge function exige o token do admin no header Authorization.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");

      const { data, error } = await supabase.functions.invoke<CriarProfissionalResponse>(
        "criar-profissional",
        {
          body: {
            nome: nome.trim().toUpperCase(),
            email: email.trim().toLowerCase(),
            papel,
            perfilAcesso: accessProfiles[0], // principal → user_metadata.access_profile
            perfisAcesso: accessProfiles, // lista completa → user_metadata.access_profiles
            conselho: conselho.trim() || undefined,
            numeroConselho: numeroConselho.trim() || undefined,
            cargo: cargo.trim() || undefined,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (error) throw new Error(await extractError(error));
      if (!data?.success || !data.tempPassword) {
        throw new Error(data?.error ?? "Falha ao criar usuário");
      }

      // Permissões de setor: a edge function não retorna o id do profissional →
      // resolvemos pelo e-mail (RLS: admin lê os do seu hospital) e gravamos os
      // vínculos em profissionais_setores.
      if (selectedSetores.size > 0) {
        try {
          const { data: prof } = await supabase
            .from("profissionais")
            .select("id")
            .eq("email", email.trim().toLowerCase())
            .maybeSingle();
          const profId = (prof as any)?.id;
          if (profId) {
            const links = Array.from(selectedSetores).map((setor_id) => ({ profissional_id: profId, setor_id }));
            const { error: linkErr } = await supabase.from("profissionais_setores").insert(links as any);
            if (linkErr) console.error("[CreateUserForm] falha ao vincular setores:", linkErr);
          }
        } catch (linkErr) {
          console.error("[CreateUserForm] erro ao vincular setores:", linkErr);
        }
      }

      setCreated({
        nome: data.nome ?? nome.trim().toUpperCase(),
        email: data.email ?? email.trim().toLowerCase(),
        tempPassword: data.tempPassword,
      });
      toast.success("Profissional cadastrado!", {
        description: "Repasse a senha provisória ao colaborador.",
      });
      reset();
      onCreated?.();
    } catch (e) {
      const msg = (e as Error).message ?? "Falha ao criar usuário";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.tempPassword);
    toast.success("Senha copiada");
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
            Cria o acesso de um colaborador no seu hospital. Uma senha provisória será gerada.
          </p>
        </div>
      </div>

      {/* Senha provisória gerada (resultado do último cadastro) */}
      {created && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="preserve-case">
            Acesso criado para {created.nome}
          </AlertTitle>
          <AlertDescription>
            <p className="preserve-case text-xs text-muted-foreground">
              E-mail: <span className="font-medium text-foreground">{created.email}</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="preserve-case inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 font-mono text-sm">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                {created.tempPassword}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={copyPassword}>
                <Copy className="h-4 w-4 mr-1.5" /> Copiar
              </Button>
            </div>
            <p className="preserve-case mt-2 text-[11px] text-muted-foreground">
              Guarde e repasse com segurança — a senha não será exibida novamente. O usuário
              deverá trocá-la no primeiro login.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Identificação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase">Nome completo *</Label>
          <Input
            ref={nomeRef}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
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
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Papel *
          </Label>
          <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o papel" />
            </SelectTrigger>
            <SelectContent>
              {PAPEL_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Perfis de Acesso *
          </Label>
          <p className="text-[11px] text-muted-foreground -mt-0.5">
            Selecione um ou mais. O <strong>primeiro (★)</strong> é o principal — define a tela de pouso. Com mais de um, o usuário escolhe no login.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ACCESS_PROFILES.map((p) => {
              const checked = accessProfiles.includes(p.value);
              const isPrimary = checked && accessProfiles[0] === p.value;
              return (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => toggleProfile(p.value)}
                  onDoubleClick={() => makePrimary(p.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    isPrimary
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : checked
                        ? "bg-primary/10 text-primary border-primary/40"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                  title={isPrimary ? "Perfil principal (duplo clique para mudar)" : checked ? "Duplo clique para definir como principal" : "Clique para adicionar"}
                >
                  {isPrimary && "★ "}{p.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
            <IdCard className="h-3.5 w-3.5" /> Cargo
          </Label>
          <Input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Opcional (ex.: Plantonista)"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" /> Conselho
          </Label>
          <Input
            value={conselho}
            onChange={(e) => setConselho(e.target.value)}
            placeholder="Opcional (ex.: CRM, COREN)"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" /> Nº do conselho
          </Label>
          <Input
            value={numeroConselho}
            onChange={(e) => setNumeroConselho(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      {/* Permissões de setor (opcional) */}
      {dbSectors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Setores de acesso
            <span className="font-normal normal-case text-muted-foreground">(opcional — pode ajustar depois)</span>
          </Label>
          <div className="rounded-lg border p-3 space-y-3 max-h-56 overflow-y-auto">
            {Object.entries(setoresByAla).map(([ala, setores]) => (
              <div key={ala} className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{ala}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {setores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-1.5 py-1 hover:bg-muted/60">
                      <Checkbox checked={selectedSetores.has(s.id)} onCheckedChange={() => toggleSetor(s.id)} />
                      <span className="truncate">{s.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ação */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={reset} disabled={submitting}>
          Limpar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" /> Cadastrar usuário
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// MIGRAÇÃO: mantém compatibilidade com eventuais imports default.
export default CreateUserForm;
