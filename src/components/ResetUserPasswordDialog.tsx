import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Shield,
  AlertTriangle,
  CheckCircle,
  Copy,
} from "lucide-react";

// MIGRAÇÃO: a antiga edge function "reset-user-password" recebia uma senha
// escolhida pelo admin. A nova "resetar-senha-profissional" gera uma senha
// provisória no servidor e a retorna, então todo o formulário de digitação
// de senha (schema zod, gerador local, campos de input) foi removido.

// MIGRAÇÃO: a nova edge function pode retornar a mensagem de erro dentro de
// (error as any).context.body, que vem como string JSON — parse abaixo.
const getFunctionErrorMessage = async (error: unknown): Promise<string> => {
  const err = error as { message?: string; context?: unknown };
  const ctx = err.context as { body?: unknown } | undefined;
  if (ctx?.body) {
    try {
      const raw =
        typeof ctx.body === "string" ? ctx.body : JSON.stringify(ctx.body);
      const parsed = JSON.parse(raw);
      if (parsed?.error) return parsed.error as string;
    } catch {
      // mantém fallback abaixo
    }
  }
  // Fallback: alguns runtimes expõem context como Response com .json()
  const maybeResponse = err.context as { clone?: () => Response } | undefined;
  if (maybeResponse?.clone) {
    try {
      const body = await maybeResponse.clone().json();
      if (body?.error) return body.error as string;
    } catch {
      // mantém fallback abaixo
    }
  }
  return err.message || "Falha na requisição";
};

interface ResetResult {
  email?: string;
  nome?: string;
  tempPassword: string;
}

export function ResetUserPasswordDialog({
  open,
  onOpenChange,
  profissionalId,
  userName,
  userEmail,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profissionalId: string;
  userName: string;
  userEmail: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);

  const handleReset = async () => {
    setLoading(true);

    try {
      // MIGRAÇÃO: a nova edge function exige o token do usuário no header.
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        throw new Error("Sessão expirada.");
      }

      // MIGRAÇÃO: chama "resetar-senha-profissional" com o PK da linha em
      // profissionais (profissionalId), NÃO o auth user_id.
      const { data, error } = await supabase.functions.invoke(
        "resetar-senha-profissional",
        {
          body: { profissionalId },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        toast.error(
          "ERRO AO REDEFINIR SENHA: " + (await getFunctionErrorMessage(error))
        );
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast.error("ERRO AO REDEFINIR SENHA: " + data.error);
        setLoading(false);
        return;
      }

      if (!data?.tempPassword) {
        toast.error("ERRO AO REDEFINIR SENHA: resposta inválida do servidor");
        setLoading(false);
        return;
      }

      setResult({
        email: data.email,
        nome: data.nome,
        tempPassword: data.tempPassword,
      });
      toast.success("SENHA REDEFINIDA COM SUCESSO");
      onSuccess?.();
    } catch (err) {
      toast.error(
        "ERRO AO REDEFINIR SENHA: " +
          (err instanceof Error ? err.message : "Erro ao processar solicitação")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  const handleCopy = async () => {
    if (!result?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      toast.success("SENHA COPIADA");
    } catch {
      toast.error("NÃO FOI POSSÍVEL COPIAR");
    }
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
            Gere uma senha provisória para o usuário
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-6 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Senha Redefinida!</h3>
            <p className="text-sm text-gray-600 mt-2">
              Repasse a senha provisória abaixo para{" "}
              <strong>{result.nome || userName || "o usuário"}</strong>.
            </p>

            {/* Senha provisória + copiar */}
            <div className="mt-4 bg-gray-50 border rounded-lg p-3 text-left">
              <p className="text-xs text-gray-500 font-semibold mb-1">
                Senha provisória
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-base tracking-widest bg-white border rounded px-2 py-2 break-all">
                  {result.tempPassword}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 flex-shrink-0"
                  onClick={handleCopy}
                  title="Copiar senha"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {result.email && (
                <p className="text-xs text-gray-500 mt-2">
                  {result.email.replace("@sistema.local", "")}
                </p>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4 text-left">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Esta senha não será exibida novamente. Copie-a agora e
                  oriente o usuário a alterá-la no primeiro acesso.
                </p>
              </div>
            </div>

            <Button
              type="button"
              className="w-full mt-4 bg-amber-600 hover:bg-amber-700"
              onClick={handleClose}
            >
              Concluir
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User Info */}
            <div className="bg-gray-50 rounded-lg p-3 border">
              <p className="text-xs text-gray-500 font-semibold mb-1">Usuário</p>
              <p className="font-medium">{userName || "—"}</p>
              <p className="text-xs text-gray-500">
                {userEmail?.replace("@sistema.local", "") || "—"}
              </p>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Uma <strong>senha provisória segura</strong> será gerada
                  automaticamente. A senha atual do usuário deixará de
                  funcionar.
                </p>
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
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Gerando...</span>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
