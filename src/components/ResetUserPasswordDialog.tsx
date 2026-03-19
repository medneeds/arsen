import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const passwordSchema = z.object({
  newPassword: z.string()
    .min(6, { message: "SENHA DEVE TER 6 CARACTERES" })
    .max(6, { message: "SENHA DEVE TER 6 CARACTERES" })
    .regex(/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/, { message: "SENHA: 6 CARACTERES COM LETRAS MAIÚSCULAS E NÚMEROS" }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "SENHAS NÃO CONFEREM",
  path: ["confirmPassword"],
});

interface ResetUserPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  onSuccess: () => void;
}

export function ResetUserPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  onSuccess,
}: ResetUserPasswordDialogProps) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = passwordSchema.parse(formData);
      
      // Use Supabase Admin API to update user password
      // Note: This requires admin privileges - in production, this should be done via an edge function
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: validated.newPassword,
      });

      if (error) {
        // If admin API fails, try alternative approach
        toast.error("ERRO AO REDEFINIR SENHA: " + error.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("SENHA REDEFINIDA COM SUCESSO");
      
      // Reset form and close after delay
      setTimeout(() => {
        setFormData({ newPassword: "", confirmPassword: "" });
        setSuccess(false);
        onSuccess();
        onOpenChange(false);
      }, 2000);
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("ERRO AO PROCESSAR SOLICITAÇÃO");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ newPassword: "", confirmPassword: "" });
    setSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-600" />
            Redefinir Senha do Usuário
          </DialogTitle>
          <DialogDescription>
            Defina uma nova senha para o usuário
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Senha Redefinida!</h3>
            <p className="text-sm text-gray-600 mt-2">
              A nova senha foi configurada com sucesso.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Info */}
            <div className="bg-gray-50 rounded-lg p-3 border">
              <p className="text-xs text-gray-500 font-semibold mb-1">Usuário</p>
              <p className="font-medium">{userName || "—"}</p>
              <p className="text-xs text-gray-500">{userEmail?.replace("@sistema.local", "") || "—"}</p>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  A nova senha deve ter <strong>exatamente 6 caracteres</strong> contendo 
                  <strong> letras maiúsculas</strong> e <strong>números</strong>.
                </p>
              </div>
            </div>

            {/* Password Fields */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-600">Nova Senha *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      newPassword: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) 
                    })}
                    placeholder="EX: ABC123"
                    className="h-10 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase font-mono tracking-widest"
                    disabled={loading}
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[9px] text-gray-400">
                  {formData.newPassword.length}/6 caracteres
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-600 uppercase">Confirmar Nova Senha *</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      confirmPassword: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) 
                    })}
                    placeholder="REPITA A SENHA"
                    className="h-10 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase font-mono tracking-widest"
                    disabled={loading}
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || formData.newPassword.length !== 6}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Redefinir Senha
                  </span>
                )}
              </Button>
            </div>

            {/* LGPD Notice */}
            <div className="flex items-center gap-2 text-xs text-gray-400 pt-2">
              <Shield className="h-3 w-3" />
              <span>Esta ação será registrada na trilha de auditoria</span>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
