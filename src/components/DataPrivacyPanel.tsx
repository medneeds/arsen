import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  FileText,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";

// MIGRAÇÃO: nomes de campo espelham as colunas do schema novo
// (consentimentos_usuario / solicitacoes_dados_lgpd / politicas_retencao_dados).
interface Consent {
  id: string;
  tipo_consentimento: string;
  versao_consentimento: string;
  aceito_em: string;
}

interface DataRequest {
  id: string;
  tipo_solicitacao: string;
  status: string;
  solicitado_em: string;
  processado_em: string | null;
  observacoes: string | null;
}

interface RetentionPolicy {
  nome_tabela: string;
  anos_retencao: number;
  descricao: string | null;
  base_legal: string | null;
}

export function DataPrivacyPanel() {
  const { user } = useAuth();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingExport, setRequestingExport] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPrivacyData();
    }
  }, [user]);

  const fetchPrivacyData = async () => {
    try {
      // Buscar consentimentos (MIGRAÇÃO: user_consents → consentimentos_usuario)
      const { data: consentsData } = await supabase
        .from("consentimentos_usuario")
        .select("id, tipo_consentimento, versao_consentimento, aceito_em")
        .eq("usuario_id", user?.id)
        .order("aceito_em", { ascending: false });

      setConsents((consentsData as Consent[]) || []);

      // Buscar solicitações de dados (MIGRAÇÃO: data_requests → solicitacoes_dados_lgpd)
      const { data: requestsData } = await supabase
        .from("solicitacoes_dados_lgpd")
        .select("id, tipo_solicitacao, status, solicitado_em, processado_em, observacoes")
        .eq("usuario_id", user?.id)
        .order("solicitado_em", { ascending: false });

      setDataRequests((requestsData as DataRequest[]) || []);

      // Buscar políticas de retenção (MIGRAÇÃO: data_retention_policies → politicas_retencao_dados)
      const { data: policiesData } = await supabase
        .from("politicas_retencao_dados")
        .select("nome_tabela, anos_retencao, descricao, base_legal")
        .order("anos_retencao", { ascending: false });

      setRetentionPolicies((policiesData as RetentionPolicy[]) || []);
    } catch (error) {
      console.error("Erro ao buscar dados de privacidade:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestExport = async () => {
    if (!user) return;

    setRequestingExport(true);
    try {
      // MIGRAÇÃO: data_requests → solicitacoes_dados_lgpd.
      // DEGRADADO: a edge function "export-user-data" não existe no backend novo
      // (não consta na lista de functions migradas). O fluxo de geração+download
      // imediato foi degradado para apenas registrar a solicitação, que será
      // processada pela equipe de conformidade (mesmo modelo da exclusão).
      const { error } = await supabase.from("solicitacoes_dados_lgpd").insert({
        usuario_id: user.id,
        tipo_solicitacao: "export",
        status: "pending",
        observacoes: "Solicitação de portabilidade de dados conforme Art. 18 LGPD",
      });

      if (error) throw error;

      toast.success("Solicitação de exportação registrada. Será processada pela equipe de conformidade.");
      fetchPrivacyData();
    } catch (error) {
      console.error("Erro ao solicitar exportação:", error);
      toast.error("Erro ao registrar solicitação. Tente novamente.");
    } finally {
      setRequestingExport(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user) return;

    setRequestingDeletion(true);
    try {
      // MIGRAÇÃO: data_requests → solicitacoes_dados_lgpd.
      const { error } = await supabase.from("solicitacoes_dados_lgpd").insert({
        usuario_id: user.id,
        tipo_solicitacao: "deletion",
        status: "pending",
        observacoes: "Solicitação de exclusão de dados conforme Art. 18, VI LGPD",
      });

      if (error) throw error;

      toast.success("Solicitação de exclusão registrada. Será analisada pela equipe de acordo com a legislação vigente.");
      fetchPrivacyData();
    } catch (error) {
      console.error("Erro ao solicitar exclusão:", error);
      toast.error("Não foi possível registrar solicitação. Tente novamente.");
    } finally {
      setRequestingDeletion(false);
    }
  };

  const getConsentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      terms_of_use: "Termos de Uso",
      privacy_policy: "Política de Privacidade",
      data_processing: "Tratamento de Dados",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pendente" },
      processing: { variant: "default", label: "Em Processamento" },
      completed: { variant: "outline", label: "Concluído" },
      rejected: { variant: "destructive", label: "Rejeitado" },
    };
    const badge = badges[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  const getTableLabel = (tableName: string) => {
    const labels: Record<string, string> = {
      patients: "Dados de Pacientes",
      patient_movements: "Movimentações de Pacientes",
      audit_logs: "Logs de Auditoria",
      shift_handovers: "Passagens de Plantão",
      sepsis_protocols: "Protocolos de Sepse",
      user_consents: "Registros de Consentimento",
      profiles: "Perfis de Usuários",
      data_requests: "Solicitações de Dados",
    };
    return labels[tableName] || tableName;
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      export: "Exportação de Dados",
      deletion: "Exclusão de Dados",
      correction: "Correção de Dados",
    };
    return labels[type] || type;
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case "export":
        return <Download className="h-4 w-4 text-foreground" />;
      case "deletion":
        return <Trash2 className="h-4 w-4 text-critical-on-soft" />;
      default:
        return <FileText className="h-4 w-4 text-warning-on-soft" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Meus Consentimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Meus Consentimentos
          </CardTitle>
          <CardDescription>
            Registro dos termos e políticas que você aceitou
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum consentimento registrado.</p>
          ) : (
            <div className="space-y-3">
              {consents.map((consent) => (
                <div
                  key={consent.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-released-on-soft" />
                    <div>
                      <p className="font-medium">{getConsentTypeLabel(consent.tipo_consentimento)}</p>
                      <p className="text-xs text-muted-foreground">
                        Versão {consent.versao_consentimento}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {format(new Date(consent.aceito_em), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(consent.aceito_em), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portabilidade de Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Portabilidade de Dados (Art. 18 LGPD)
          </CardTitle>
          <CardDescription>
            Solicite uma cópia dos seus dados pessoais armazenados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={requestingExport}>
                  {requestingExport ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Solicitando...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Solicitar Exportação
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Solicitar Exportação de Dados</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você está solicitando uma cópia de todos os seus dados pessoais armazenados 
                    no sistema. O arquivo será preparado e você será notificado quando estiver 
                    disponível para download. Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRequestExport}>
                    Confirmar Solicitação
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {dataRequests.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3">Histórico de Solicitações</h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {dataRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getRequestTypeIcon(request.tipo_solicitacao)}
                          <div>
                            <p className="text-sm font-medium">
                              {getRequestTypeLabel(request.tipo_solicitacao)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(request.solicitado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Exclusão de Dados */}
      <Card className="border-critical-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-critical-on-soft" />
            Exclusão de Dados (Art. 18, VI LGPD)
          </CardTitle>
          <CardDescription>
            Solicite a exclusão dos seus dados pessoais do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-critical-soft rounded-lg border border-critical-border">
            <p className="text-sm text-critical-on-soft">
              <strong>Atenção:</strong> A exclusão de dados é irreversível. Alguns dados podem ser 
              mantidos por obrigação legal (ex: prontuários médicos por 20 anos conforme CFM 1.821/2007). 
              Sua solicitação será analisada pela equipe de conformidade.
            </p>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={requestingDeletion}>
                {requestingDeletion ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Solicitando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Solicitar Exclusão de Dados
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-critical-on-soft">Solicitar Exclusão de Dados</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Você está solicitando a exclusão dos seus dados pessoais do sistema. 
                    Esta ação é irreversível.
                  </p>
                  <p>
                    <strong>Importante:</strong> Alguns dados podem ser mantidos por obrigação legal, 
                    como registros médicos (20 anos conforme CFM) e logs de auditoria (5 anos conforme LGPD).
                  </p>
                  <p>
                    Sua solicitação será analisada pela equipe de conformidade e você será 
                    notificado sobre o resultado.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleRequestDeletion}
                  className="bg-critical hover:bg-critical"
                >
                  Confirmar Solicitação de Exclusão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Políticas de Retenção */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Políticas de Retenção de Dados
          </CardTitle>
          <CardDescription>
            Períodos de armazenamento conforme legislação vigente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {retentionPolicies.map((policy) => (
              <div
                key={policy.nome_tabela}
                className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-medium">{getTableLabel(policy.nome_tabela)}</p>
                  <p className="text-xs text-muted-foreground">{policy.descricao}</p>
                  <p className="text-xs text-blue-600">{policy.base_legal}</p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {policy.anos_retencao} anos
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aviso Legal */}
      <Card className="border-warning-border bg-warning-soft">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning-on-soft shrink-0 mt-1" />
            <div className="space-y-1">
              <p className="font-medium text-warning-on-soft">
                Informações sobre seus Direitos
              </p>
              <p className="text-sm text-warning-on-soft">
                Conforme a LGPD (Lei 13.709/2018), você tem direito a solicitar acesso, 
                correção, exclusão ou portabilidade dos seus dados pessoais. Para exercer 
                esses direitos ou obter mais informações, entre em contato com o 
                Encarregado de Proteção de Dados (DPO) da instituição.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
