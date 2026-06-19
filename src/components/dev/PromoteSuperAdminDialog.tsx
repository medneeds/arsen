import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

/**
 * Diálogo para o admin atual promover outro usuário a super_admin.
 * Chama o RPC public.promote_to_super_admin(target_user_id uuid).
 */
export function PromoteSuperAdminDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const handlePromote = async () => {
    if (confirm !== "PROMOVER SUPER ADMIN") {
      toast.error("Digite exatamente: PROMOVER SUPER ADMIN");
      return;
    }
    setBusy(true);
    try {
      // 1) resolver email → user_id via profiles
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .ilike("email", email.trim())
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) throw new Error("Usuário não encontrado com este e-mail");

      // 2) chama rpc
      const { error } = await (supabase.rpc as any)("promote_to_super_admin", {
        target_user_id: prof.id,
      });
      if (error) throw error;

      toast.success(`${prof.full_name || prof.email} agora é Super Admin`);
      setOpen(false);
      setEmail("");
      setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao promover");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="contents">{trigger}</div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Promover usuário a Super Admin
          </DialogTitle>
          <DialogDescription>
            Super Admin tem acesso ao Backup e Restore completo do banco. Use com extremo cuidado.
            A ação é registrada no histórico de auditoria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="promote-email">E-mail do usuário</Label>
            <Input
              id="promote-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@dominio.com"
              autoComplete="off"
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promote-confirm">
              Digite <span className="font-mono font-bold">PROMOVER SUPER ADMIN</span> para confirmar
            </Label>
            <Input
              id="promote-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handlePromote}
            disabled={busy || !email || confirm !== "PROMOVER SUPER ADMIN"}
            variant="destructive"
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Promover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
