import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  KeyRound,
  Shield,
  User,
  AlertCircle,
  CheckCircle,
  Phone,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const requestSchema = z.object({
  username: z.string()
    .trim()
    .min(1, { message: "USUÁRIO OBRIGATÓRIO" })
    .regex(/^[A-Z0-9.]+$/, { message: "APENAS LETRAS MAIÚSCULAS E NÚMEROS" }),
  crm: z.string()
    .trim()
    .min(4, { message: "CRM OBRIGATÓRIO PARA VERIFICAÇÃO" })
    .regex(/^[A-Z0-9/\-\s]+$/, { message: "CRM INVÁLIDO" }),
});

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    crm: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = requestSchema.parse(formData);
      
      // Verificar se o usuário existe com o CRM informado
      const internalEmail = `${validated.username.toLowerCase()}@sistema.local`;
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, crm, status")
        .eq("email", internalEmail)
        .single();

      if (error || !profile) {
        toast.error("Usuário não encontrado");
        setLoading(false);
        return;
      }

      // Verificar se o CRM confere
      if (profile.crm?.toUpperCase() !== validated.crm.toUpperCase()) {
        toast.error("CRM NÃO CONFERE COM O CADASTRO");
        setLoading(false);
        return;
      }

      // Verificar se já existe solicitação pendente
      const { data: existingRequest } = await supabase
        .from("password_reset_requests")
        .select("id")
        .eq("username", validated.username.toUpperCase())
        .eq("status", "pending")
        .single();

      if (existingRequest) {
        toast.error("JÁ EXISTE UMA SOLICITAÇÃO PENDENTE PARA ESTE USUÁRIO");
        setLoading(false);
        return;
      }

      // Criar solicitação de reset de senha
      const { error: insertError } = await supabase
        .from("password_reset_requests")
        .insert({
          user_id: profile.id,
          username: validated.username.toUpperCase(),
          crm: validated.crm.toUpperCase(),
          status: "pending",
        });

      if (insertError) {
        console.error("Erro ao criar solicitação:", insertError);
        toast.error("ERRO AO REGISTRAR SOLICITAÇÃO");
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("SOLICITAÇÃO REGISTRADA COM SUCESSO");
      
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

  if (success) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-blue-100 mx-auto">
          <CheckCircle className="h-10 w-10 text-blue-600" />
        </div>
        
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-gray-900">Solicitação Enviada!</h3>
          <div className="text-sm text-gray-600 max-w-xs mx-auto space-y-2">
            <p>
              Sua solicitação de redefinição de senha foi registrada.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800">
                  <p className="font-semibold mb-1">Próximos passos:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Entre em contato com o <strong>COORDENADOR</strong> da unidade</li>
                    <li>Informe seu usuário: <strong>{formData.username}</strong></li>
                    <li>O coordenador irá redefinir sua senha</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-center text-xs text-gray-500">
          <Shield className="h-4 w-4" />
          <span>Procedimento conforme LGPD (Lei 13.709/2018)</span>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Back button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-gray-600 hover:text-gray-900 -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      {/* Header */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg mb-3">
          <KeyRound className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 uppercase">Recuperar Senha</h2>
        <p className="text-xs text-gray-500 mt-1">Informe seus dados para verificação</p>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            Por segurança, a redefinição de senha é realizada pelo <strong>COORDENADOR</strong> da unidade 
            após verificação de identidade.
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600 uppercase">Seu Usuário *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
              placeholder="SEU.USUARIO"
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
              disabled={loading}
              maxLength={30}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600 uppercase">Seu CRM (para verificação) *</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={formData.crm}
              onChange={(e) => setFormData({ ...formData, crm: e.target.value.toUpperCase() })}
              placeholder="CRM/MA 12345"
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
              disabled={loading}
            />
          </div>
          <p className="text-[9px] text-gray-400">Informe o CRM cadastrado no sistema</p>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold uppercase rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Verificando...</span>
          </div>
        ) : (
          <span className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Solicitar Redefinição
          </span>
        )}
      </Button>

      {/* Contact Info */}
      <div className="text-center pt-2">
        <p className="text-[9px] text-gray-400">
          Se não conseguir recuperar sua senha, entre em contato com o coordenador presencialmente.
        </p>
      </div>
    </form>
  );
}
