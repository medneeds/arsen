import { ReactNode } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useIpAccess } from "@/hooks/useIpAccess";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface IpRestrictedProps {
  moduleKey: string;
  children: ReactNode;
  /** Texto opcional do nome amigável do módulo */
  moduleLabel?: string;
}

/**
 * Envolve uma rota/módulo e bloqueia acesso quando o IP do cliente
 * não está na allowlist. A regra só atua quando `enforce=true` na
 * tabela `module_ip_settings`.
 */
export function IpRestricted({ moduleKey, children, moduleLabel }: IpRestrictedProps) {
  const { allowed, loading, ip, reason } = useIpAccess(moduleKey);
  const { signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card/80 backdrop-blur p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold uppercase tracking-tight">
          ACESSO RESTRITO À REDE AUTORIZADA
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          O módulo{" "}
          <span className="font-medium text-foreground">
            {moduleLabel ?? moduleKey}
          </span>{" "}
          só pode ser acessado a partir de IPs autorizados pela administração.
        </p>
        <div className="mt-5 rounded-lg bg-muted/50 px-4 py-3 text-left text-xs space-y-1">
          <div>
            <span className="text-muted-foreground">Seu IP detectado:</span>{" "}
            <span className="font-mono">{ip ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Motivo:</span>{" "}
            <span className="font-mono">{reason ?? "—"}</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Se você acredita que isso é um engano, contate a equipe de TI / administração
          do sistema para liberar este IP.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
