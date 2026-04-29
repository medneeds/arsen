import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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
    try {
      // Fetch role - get highest privilege role (admin > medico > others)
      const { data: rolesData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const roleData = rolesData && rolesData.length > 0
        ? (rolesData.find(r => r.role === 'admin') || rolesData[0])
        : null;

      if (roleError) {
        if (import.meta.env.DEV) {
          console.error("Error fetching user role:", roleError);
        }
        setRole("medico");
      } else {
        setRole(roleData?.role as UserRole);
      }

      // Fetch user status from profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        if (import.meta.env.DEV) {
          console.error("Error fetching user status:", profileError);
        }
        setStatus("pending");
      } else {
        setStatus(profileData?.status as UserStatus);
      }

      // Fetch allowed departments
      const { data: deptData, error: deptError } = await supabase
        .from("user_departments")
        .select("department")
        .eq("user_id", userId);

      if (deptError) {
        if (import.meta.env.DEV) {
          console.error("Error fetching user departments:", deptError);
        }
        setAllowedDepartments([]);
      } else {
        setAllowedDepartments(deptData?.map(d => d.department) || []);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching user data:", error);
      }
      setRole("medico");
      setStatus("pending");
      setAllowedDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserStatus = async () => {
    if (user) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError && profileData) {
        setStatus(profileData.status as UserStatus);
      }
    }
  };

  const signIn = async (identifier: string, password: string) => {
    // Aceita email, CPF (somente dígitos) ou usuário interno.
    const raw = identifier.trim();
    const digits = raw.replace(/\D+/g, "");
    const isEmail = raw.includes("@");
    const isCpf = !isEmail && digits.length === 11;

    let emailToUse = raw.toLowerCase();

    if (isCpf) {
      // Resolve CPF -> email real via edge function (service role).
      try {
        const { data, error } = await supabase.functions.invoke("resolve-login", {
          body: { identifier: digits },
        });
        if (error || !data?.email) {
          return { error: error ?? new Error("CPF não encontrado") };
        }
        emailToUse = data.email;
      } catch (e) {
        return { error: e };
      }
    } else if (!isEmail) {
      // Compat retroativa: usuário interno -> email @sistema.local
      emailToUse = `${raw.toLowerCase()}@sistema.local`;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (!error) {
      navigate("/");
    }

    return { error };
  };

  const signUp = async (username: string, password: string, fullName: string, role: "admin" | "medico" | "porta" | "visitante" | "farmacia" = "medico") => {
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
  };

  const signOut = async () => {
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
  };

  return (
    <AuthContext.Provider value={{ user, session, role, status, allowedDepartments, loading, signIn, signUp, signOut, refreshUserStatus }}>
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
