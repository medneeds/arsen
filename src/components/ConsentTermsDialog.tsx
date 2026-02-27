import { useState } from "react";
import { whitelabel } from "@/config/whitelabel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, FileText, Database, Lock } from "lucide-react";

const CURRENT_TERMS_VERSION = "1.0.0";

interface ConsentTermsDialogProps {
  open: boolean;
  onAccept: () => void;
  userId: string;
}

export function ConsentTermsDialog({ open, onAccept, userId }: ConsentTermsDialogProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [dataProcessingAccepted, setDataProcessingAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allAccepted = termsAccepted && privacyAccepted && dataProcessingAccepted;

  const handleAcceptTerms = async () => {
    if (!allAccepted) return;

    setIsSubmitting(true);
    try {
      // Registrar consentimentos individualmente
      const consents = [
        { consent_type: "terms_of_use", consent_version: CURRENT_TERMS_VERSION },
        { consent_type: "privacy_policy", consent_version: CURRENT_TERMS_VERSION },
        { consent_type: "data_processing", consent_version: CURRENT_TERMS_VERSION },
      ];

      for (const consent of consents) {
        const { error } = await supabase.from("user_consents").insert({
          user_id: userId,
          consent_type: consent.consent_type,
          consent_version: consent.consent_version,
          user_agent: navigator.userAgent,
        });

        if (error && !error.message.includes("duplicate")) {
          throw error;
        }
      }

      // Atualizar perfil com data de aceite
      await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: CURRENT_TERMS_VERSION,
        })
        .eq("id", userId);

      toast.success("Termos aceitos com sucesso!");
      onAccept();
    } catch (error) {
      console.error("Erro ao registrar consentimento:", error);
      toast.error("Erro ao registrar consentimento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-primary" />
            Termos de Uso e Política de Privacidade
          </DialogTitle>
          <DialogDescription>
            Em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018) e 
            Resolução CFM 1.821/2007, você deve ler e aceitar os termos abaixo para continuar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {/* Termos de Uso */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 font-semibold text-lg">
                <FileText className="h-5 w-5 text-blue-600" />
                1. Termos de Uso do Sistema
              </h3>
              <div className="text-sm text-muted-foreground space-y-2 pl-7">
                <p>
                  Este sistema de gestão hospitalar ("{whitelabel.platform.fullName}") é destinado exclusivamente ao uso por 
                  profissionais de saúde devidamente credenciados e autorizados pela instituição.
                </p>
                <p><strong>1.1. Responsabilidades do Usuário:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Manter suas credenciais de acesso em sigilo absoluto</li>
                  <li>Não compartilhar login e senha com terceiros</li>
                  <li>Utilizar o sistema apenas para fins profissionais legítimos</li>
                  <li>Reportar imediatamente qualquer uso não autorizado</li>
                  <li>Fazer logoff ao se afastar do dispositivo</li>
                </ul>
                <p><strong>1.2. Rastreabilidade:</strong></p>
                <p>
                  Todas as ações realizadas no sistema são registradas em log de auditoria imutável, 
                  associadas ao seu usuário, conforme exigência do CFM e LGPD.
                </p>
              </div>
            </section>

            {/* Política de Privacidade */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 font-semibold text-lg">
                <Lock className="h-5 w-5 text-green-600" />
                2. Política de Privacidade (LGPD)
              </h3>
              <div className="text-sm text-muted-foreground space-y-2 pl-7">
                <p><strong>2.1. Dados Coletados:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Dados de identificação profissional (nome, CRM, especialidade)</li>
                  <li>Dados de contato (telefone, e-mail)</li>
                  <li>Registros de acesso e ações no sistema</li>
                  <li>Endereço IP e informações do dispositivo</li>
                </ul>
                <p><strong>2.2. Finalidade do Tratamento:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Controle de acesso e autenticação</li>
                  <li>Rastreabilidade de ações (auditoria)</li>
                  <li>Cumprimento de obrigações legais (CFM, LGPD)</li>
                  <li>Segurança do sistema e dos dados de pacientes</li>
                </ul>
                <p><strong>2.3. Seus Direitos (Art. 18 LGPD):</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Confirmação da existência de tratamento</li>
                  <li>Acesso aos seus dados pessoais</li>
                  <li>Correção de dados incompletos ou inexatos</li>
                  <li>Portabilidade dos dados (exportação)</li>
                  <li>Informação sobre compartilhamento de dados</li>
                </ul>
              </div>
            </section>

            {/* Tratamento de Dados */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 font-semibold text-lg">
                <Database className="h-5 w-5 text-orange-600" />
                3. Tratamento de Dados de Pacientes
              </h3>
              <div className="text-sm text-muted-foreground space-y-2 pl-7">
                <p><strong>3.1. Base Legal:</strong></p>
                <p>
                  O tratamento de dados de pacientes é realizado com base no Art. 7º, VIII da LGPD 
                  (tutela da saúde) e Art. 11, II, "f" (dados sensíveis para tutela da saúde).
                </p>
                <p><strong>3.2. Retenção de Dados:</strong></p>
                <p>
                  Conforme Resolução CFM 1.821/2007, os dados de prontuários e registros médicos 
                  são mantidos por no mínimo 20 (vinte) anos após o último atendimento.
                </p>
                <p><strong>3.3. Sigilo Profissional:</strong></p>
                <p>
                  O acesso aos dados de pacientes está sujeito ao sigilo médico previsto no 
                  Código de Ética Médica. Violações serão reportadas ao CRM competente.
                </p>
              </div>
            </section>

            {/* Avisos Finais */}
            <section className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium">
                ⚠️ IMPORTANTE: O não cumprimento destes termos pode resultar em:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 mt-2">
                <li>Suspensão imediata do acesso ao sistema</li>
                <li>Notificação ao CRM e órgãos competentes</li>
                <li>Responsabilização civil e criminal conforme legislação vigente</li>
              </ul>
            </section>
          </div>
        </ScrollArea>

        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <label htmlFor="terms" className="text-sm leading-none cursor-pointer">
                Li e aceito os <strong>Termos de Uso</strong> do sistema
              </label>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox
                id="privacy"
                checked={privacyAccepted}
                onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
              />
              <label htmlFor="privacy" className="text-sm leading-none cursor-pointer">
                Li e aceito a <strong>Política de Privacidade</strong> conforme LGPD
              </label>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox
                id="dataProcessing"
                checked={dataProcessingAccepted}
                onCheckedChange={(checked) => setDataProcessingAccepted(checked === true)}
              />
              <label htmlFor="dataProcessing" className="text-sm leading-none cursor-pointer">
                Autorizo o <strong>tratamento dos meus dados</strong> conforme descrito acima
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleAcceptTerms}
              disabled={!allAccepted || isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Registrando..." : "Aceitar e Continuar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { CURRENT_TERMS_VERSION };
