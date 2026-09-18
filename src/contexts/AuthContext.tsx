import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { comTempoLimite } from "@/lib/tempoLimite";

type UserRole = "admin" | "medico" | "porta" | "visitante" | "farmacia" | null;
type UserStatus = "pending" | "approved" | "rejected" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  status: UserStatus;
  allowedDepartments: string[];
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signUp: (username: string, password: string, fullName: string, role?: "admin" | "medico" | "porta" | "visitante" | "farmacia") => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshUserStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [status, setStatus] = useState<UserStatus>(null);
  const [allowedDepartments, setAllowedDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  // Evita dupla execução concorrente do fetchUserRoleAndDepartments (race condition
  // no init: onAuthStateChange + getSession podem disparar quase simultaneamente).
  const fetchingUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role and departments fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoleAndDepartments(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setStatus(null);
          setAllowedDepartments([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserRoleAndDepartments(session.user.id);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoleAndDepartments = async (userId: string) => {
    // Guard contra race entre onAuthStateChange e getSession disparando
    // fetchUserRoleAndDepartments para o mesmo userId quase simultaneamente.
    // fetchingUserIdRef é setado ANTES do primeiro await — garante exclusão mútua.
    if (fetchingUserIdRef.current === userId) return;
    fetchingUserIdRef.current = userId;
    try {
      // As tres consultas pedem a MESMA coisa (o userId) e nao dependem uma da
      // outra, mas rodavam em cascata: cada uma so comecava depois que a
      // anterior voltava. Com a latencia do Supabase self-hosted, isso somava
      // tres viagens de ida e volta ANTES de a primeira tela aparecer.
      // Em paralelo, o custo passa a ser o da consulta mais lenta.
      const [rolesRes, profileRes, deptRes] = await comTempoLimite(Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("status").eq("id", userId).maybeSingle(),
        supabase.from("user_departments").select("department").eq("user_id", userId),
      ]), "carregar permissões", 12_000);

      const { data: rolesData, error: roleError } = rolesRes;
      const roleData = rolesData && rolesData.length > 0
        ? (rolesData.find(r => r.role === 'admin') || rolesData[0])
        : null;

      if (roleError) {
        // Sempre loga — falha de role não deve ser silenciosa em produção.
        console.error("[AuthContext] falha ao buscar role do usuário — acesso bloqueado:", roleError);
        // Negar acesso completamente: role null + status pending exibe PendingApprovalScreen.
        // ProtectedRoute só verifica status, não role — por isso ambos precisam ser restritivos.
        // Antes era setRole("medico"), o que promovia qualquer usuário com falha de rede.
        setRole(null);
        setStatus("pending");
        setAllowedDepartments([]);
        return;
      }
      setRole(roleData?.role as UserRole);

      const { data: profileData, error: profileError } = profileRes;
      if (profileError) {
        console.error("[AuthContext] falha ao buscar status do usuário:", profileError);
        // Status "pending" é restritivo — bloqueia acesso sem conceder permissão indevida.
        setStatus("pending");
      } else {
        setStatus(profileData?.status as UserStatus);
      }

      const { data: deptData, error: deptError } = deptRes;
      if (deptError) {
        // Sempre loga em qualquer ambiente — falha de departamento pode bloquear
        // acesso legítimo e deve ser visível em produção.
        console.error("[AuthContext] falha ao buscar departamentos do usuário:", deptError);
        setAllowedDepartments([]);
      } else {
        setAllowedDepartments(deptData?.map(d => d.department) || []);
      }
    } catch (error) {
      // Sempre loga — erro crítico de autenticação deve ser visível em produção.
      console.error("[AuthContext] falha crítica ao carregar dados do usuário — acesso negado:", error);
      // Negar acesso: role null bloqueia o ProtectedRoute.
      // Status "pending" é conservador — não concede acesso mesmo se role for revertido.
      setRole(null);
      setStatus("pending");
      setAllowedDepartments([]);
    } finally {
      fetchingUserIdRef.current = null;
      setLoading(false);
    }
  };

  const refreshUserStatus = useCallback(async () => {
    if (user) {
      // Rebusca role + status + departamentos completos para garantir que mudanças
      // feitas por um admin (ex: promoção de visitante → médico) reflitam
      // imediatamente sem que o usuário precise fazer logout.
      await fetchUserRoleAndDepartments(user.id);
    }
  }, [user]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    // Aceita email, CPF (somente dígitos) ou usuário interno.
    const raw = identifier.trim();
    const digits = raw.replace(/\D+/g, "");
    const isEmail = raw.includes("@");
    const isCpf = !isEmail && digits.length === 11;

    let emailToUse = raw.toLowerCase();

    // Resolve identificador (CPF, e-mail ou usuário) → email real via RPC (sem cold start)
    try {
      // Com tempo limite: sem ele, um RPC que nao responde deixa o botao
      // "Entrando..." preso para sempre, sem erro e sem mensagem.
      const { data: resolveData, error: resolveError } = await comTempoLimite<{
        data: { email?: string } | null; error: unknown;
      }>(
        (supabase.rpc as any)("resolve_login", { p_identifier: isCpf ? digits : raw }),
        "identificar usuário",
        10_000,
      );
      if (resolveError || !(resolveData as any)?.email) {
        return { error: resolveError ?? new Error("Usuário não encontrado") };
      }
      emailToUse = (resolveData as any).email;
    } catch (e) {
      return { error: e };
    }

    try {
      const { error } = await comTempoLimite(
        supabase.auth.signInWithPassword({ email: emailToUse, password }),
        "autenticar",
        15_000,
      );
      return { error };
    } catch (e) {
      return { error: e };
    }
  }, []);

  const signUp = useCallback(async (username: string, password: string, fullName: string, role: "admin" | "medico" | "porta" | "visitante" | "farmacia" = "medico") => {
    const redirectUrl = `${window.location.origin}/`;
    const internalEmail = `${username.toLowerCase()}@sistema.local`;
    
    const { error } = await supabase.auth.signUp({
      email: internalEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          username: username,
          role: role, // Passar papel nos metadados para o trigger usar
        },
      },
    });
    
    if (!error) {
      navigate("/");
    }
    
    return { error };
  }, [navigate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setStatus(null);
    setAllowedDepartments([]);
    // Clear all PHI/access-control data from local storage to prevent leakage after logout (LGPD)
    try {
      const SENSITIVE_KEYS = [
        "patients",
        "patientHistory",
        "patientRedoHistory",
        "clinicalNotes",
        "clinicalChecklist",
        "access_profile",
        "gestor_sector_filter",
        "customTemplates",
      ];
      SENSITIVE_KEYS.forEach((k) => localStorage.removeItem(k));
      ["active_access_profile", "available_access_profiles"].forEach((k) => sessionStorage.removeItem(k));
      // Defensive sweep: any cached patient/clinical keys
      Object.keys(localStorage).forEach((k) => {
        if (/^(patient|clinical|prescription|evolution|exam|culture|note|checklist)/i.test(k)) {
          localStorage.removeItem(k);
        }
      });
    } catch {
      // ignore storage errors
    }
    navigate("/auth");
  }, [navigate]);

  /**
   * O objeto de valor precisa ser memoizado: criado inline, ele era NOVO a cada
   * render do provider, e os 71 componentes que consomem useAuth
   * re-renderizavam junto — mesmo sem nada ter mudado de fato. Com telas de
   * milhares de linhas, isso e a causa de transicao lenta em todo o app.
   */
  const valor = useMemo(
    () => ({ user, session, role, status, allowedDepartments, loading, signIn, signUp, signOut, refreshUserStatus }),
    [user, session, role, status, allowedDepartments, loading, signIn, signUp, signOut, refreshUserStatus],
  );

  return (
    <AuthContext.Provider value={valor}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
