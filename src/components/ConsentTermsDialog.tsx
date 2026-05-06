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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, FileText, Database, Lock, CheckCircle2, AlertTriangle } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState("terms");

  const allAccepted = termsAccepted && privacyAccepted && dataProcessingAccepted;
  const acceptedCount = [termsAccepted, privacyAccepted, dataProcessingAccepted].filter(Boolean).length;

  const handleAcceptTerms = async () => {
    if (!allAccepted) return;
    setIsSubmitting(true);
    try {
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
        if (error && !error.message.includes("duplicate")) throw error;
      }
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
      <DialogContent
        className="max-w-3xl w-[calc(100vw-1rem)] sm:w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] p-0 overflow-hidden gap-0 flex flex-col rounded-none sm:rounded-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header colorido compacto */}
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Shield className="h-5 w-5 text-primary" />
                TERMOS DE USO E POLÍTICA DE PRIVACIDADE
              </DialogTitle>
              <DialogDescription className="text-xs">
                Em conformidade com a LGPD (Lei 13.709/2018) e Resolução CFM 1.821/2007.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
              v{CURRENT_TERMS_VERSION}
            </Badge>
          </div>
        </DialogHeader>

        {/* Tabs de conteúdo */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 mx-6 mt-4 h-auto">
            <TabsTrigger value="terms" className="flex items-center gap-1.5 py-2 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">TERMOS DE USO</span>
              <span className="sm:hidden">TERMOS</span>
              {termsAccepted && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-1.5 py-2 text-xs">
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PRIVACIDADE</span>
              <span className="sm:hidden">LGPD</span>
              {privacyAccepted && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-1.5 py-2 text-xs">
              <Database className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">DADOS DE PACIENTES</span>
              <span className="sm:hidden">DADOS</span>
              {dataProcessingAccepted && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 max-h-[42vh] px-6 py-4">
            <TabsContent value="terms" className="mt-0 space-y-3 text-sm">
              <p className="text-muted-foreground leading-relaxed">
                O sistema <strong className="text-foreground">{whitelabel.platform.fullName}</strong> é destinado
                exclusivamente a profissionais de saúde devidamente credenciados e autorizados pela instituição.
              </p>
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <p className="font-semibold text-xs uppercase tracking-wide text-foreground">
                  Responsabilidades do usuário
                </p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-2"><span className="text-primary">•</span> Manter credenciais em sigilo absoluto</li>
                  <li className="flex gap-2"><span className="text-primary">•</span> Não compartilhar login e senha com terceiros</li>
                  <li className="flex gap-2"><span className="text-primary">•</span> Utilizar o sistema apenas para fins profissionais legítimos</li>
                  <li className="flex gap-2"><span className="text-primary">•</span> Reportar imediatamente qualquer uso não autorizado</li>
                  <li className="flex gap-2"><span className="text-primary">•</span> Fazer logoff ao se afastar do dispositivo</li>
                </ul>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                <p className="font-semibold text-xs uppercase tracking-wide">Rastreabilidade</p>
                <p className="text-xs text-muted-foreground">
                  Todas as ações são registradas em log de auditoria imutável, associadas ao seu usuário,
                  conforme exigência do CFM e LGPD.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="privacy" className="mt-0 space-y-3 text-sm">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg border bg-card p-3 space-y-2">
                  <p className="font-semibold text-xs uppercase tracking-wide">Dados coletados</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Identificação profissional (nome, CRM, especialidade)</li>
                    <li>• Contato (telefone, e-mail)</li>
                    <li>• Logs de acesso e ações</li>
                    <li>• IP e dispositivo</li>
                  </ul>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-2">
                  <p className="font-semibold text-xs uppercase tracking-wide">Finalidade</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Controle de acesso e autenticação</li>
                    <li>• Auditoria de ações</li>
                    <li>• Cumprimento de CFM e LGPD</li>
                    <li>• Segurança do sistema e dos pacientes</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border-l-4 border-l-primary bg-card p-3 space-y-1.5">
                <p className="font-semibold text-xs uppercase tracking-wide">Seus direitos (Art. 18 LGPD)</p>
                <p className="text-xs text-muted-foreground">
                  Confirmação de tratamento, acesso, correção, portabilidade e informação sobre compartilhamento
                  dos seus dados pessoais.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-0 space-y-3 text-sm">
              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                <p className="font-semibold text-xs uppercase tracking-wide">Base legal</p>
                <p className="text-xs text-muted-foreground">
                  Tratamento baseado no Art. 7º, VIII (tutela da saúde) e Art. 11, II, "f" (dados sensíveis para
                  tutela da saúde) da LGPD.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                <p className="font-semibold text-xs uppercase tracking-wide">Retenção</p>
                <p className="text-xs text-muted-foreground">
                  Conforme Resolução CFM 1.821/2007, prontuários e registros médicos são mantidos por no mínimo
                  <strong className="text-foreground"> 20 anos</strong> após o último atendimento.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                <p className="font-semibold text-xs uppercase tracking-wide">Sigilo profissional</p>
                <p className="text-xs text-muted-foreground">
                  O acesso é regido pelo sigilo médico do Código de Ética Médica. Violações serão reportadas ao CRM.
                </p>
              </div>
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Consequências do descumprimento</p>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      Suspensão de acesso, notificação ao CRM e responsabilização civil/criminal conforme legislação.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Footer fixo de aceite */}
        <div className="border-t bg-muted/30 px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{acceptedCount}/3</strong> seções aceitas
            </p>
            <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(acceptedCount / 3) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            <label
              htmlFor="terms-cb"
              className="flex items-center gap-2 rounded-lg border bg-card p-2.5 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Checkbox
                id="terms-cb"
                checked={termsAccepted}
                onCheckedChange={(c) => setTermsAccepted(c === true)}
              />
              <span className="text-xs leading-tight">Aceito os <strong>Termos de Uso</strong></span>
            </label>
            <label
              htmlFor="privacy-cb"
              className="flex items-center gap-2 rounded-lg border bg-card p-2.5 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Checkbox
                id="privacy-cb"
                checked={privacyAccepted}
                onCheckedChange={(c) => setPrivacyAccepted(c === true)}
              />
              <span className="text-xs leading-tight">Aceito a <strong>Política LGPD</strong></span>
            </label>
            <label
              htmlFor="data-cb"
              className="flex items-center gap-2 rounded-lg border bg-card p-2.5 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Checkbox
                id="data-cb"
                checked={dataProcessingAccepted}
                onCheckedChange={(c) => setDataProcessingAccepted(c === true)}
              />
              <span className="text-xs leading-tight">Autorizo <strong>tratamento de dados</strong></span>
            </label>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button
              onClick={handleAcceptTerms}
              disabled={!allAccepted || isSubmitting}
              className="w-full sm:w-auto"
              size="sm"
            >
              {isSubmitting ? "Registrando..." : allAccepted ? "Aceitar e continuar" : `Aceitar todas (${acceptedCount}/3)`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { CURRENT_TERMS_VERSION };
