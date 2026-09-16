import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getImpersonation, clearImpersonation } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";
import { UserCog, Loader2 } from "lucide-react";

/**
 * Faixa global exibida quando o super_admin está impersonando um admin de
 * unidade. Mostra quem está sendo impersonado e o botão para voltar.
 * Montada na raiz do App para aparecer em qualquer tela do modo admin.
 */
export function ImpersonationBanner() {
  const [voltando, setVoltando] = useState(false);
  const imp = getImpersonation();
  if (!imp) return null;

  const voltar = async () => {
    setVoltando(true);
    const { error } = await supabase.auth.setSession(imp.origin);
    if (error) {
      setVoltando(false);
      alert("Falha ao voltar para o super admin: " + error.message);
      return;
    }
    clearImpersonation();
    // Reload completo: reinicia AuthContext/HospitalContext limpos como super_admin.
    window.location.assign("/painel-super-admin");
  };

  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-amber-950">
      <span className="flex items-center gap-2">
        <UserCog className="h-4 w-4 shrink-0" />
        <span>
          Logado como <strong>{imp.target.nome}</strong> ({imp.target.email}) — {imp.target.hospitalNome}
        </span>
      </span>
      <Button size="sm" variant="outline" className="bg-white/80 hover:bg-white" disabled={voltando} onClick={voltar}>
        {voltando ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
        Voltar ao super admin
      </Button>
    </div>
  );
}
