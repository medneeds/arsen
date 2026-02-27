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

interface Consent {
  id: string;
  consent_type: string;
  consent_version: string;
  accepted_at: string;
}

interface DataRequest {
  id: string;
  request_type: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
}

interface RetentionPolicy {
  table_name: string;
  retention_years: number;
  description: string;
  legal_basis: string;
}

export function DataPrivacyPanel() {
  const { user } = useAuth();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingExport, setRequestingExport] = useState(false);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPrivacyData();
    }
  }, [user]);

  const fetchPrivacyData = async () => {
    try {
      // Buscar consentimentos
      const { data: consentsData } = await supabase
        .from("user_consents")
        .select("*")
        .eq("user_id", user?.id)
        .order("accepted_at", { ascending: false });

      setConsents(consentsData || []);

      // Buscar solicitações de dados
      const { data: requestsData } = await supabase
        .from("data_requests")
        .select("*")
        .eq("user_id", user?.id)
        .order("requested_at", { ascending: false });

      setDataRequests(requestsData || []);

      // Buscar políticas de retenção
      const { data: policiesData } = await supabase
        .from("data_retention_policies")
        .select("*")
        .order("retention_years", { ascending: false });

      setRetentionPolicies(policiesData || []);
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
      // Create the request record first
      const { data: requestData, error } = await supabase.from("data_requests").insert({
        user_id: user.id,
        request_type: "export",
        status: "processing",
      }).select().single();

      if (error) throw error;

      // Call the edge function to generate the export
      setDownloadingExport(true);
      const { data, error: exportError } = await supabase.functions.invoke("export-user-data", {
        body: { request_id: requestData.id },
      });

      if (exportError) {
        // Update request to failed
        await supabase.from("data_requests").update({ status: "pending", notes: "Falha ao gerar - tentando novamente" }).eq("id", requestData.id);
        throw exportError;
      }

      // Create a downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-lgpd-${user.id.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Dados exportados com sucesso! Arquivo baixado.");
      fetchPrivacyData();
    } catch (error) {
      console.error("Erro ao exportar dados:", error);
      toast.error("Erro ao exportar dados. Tente novamente.");
    } finally {
      setRequestingExport(false);
      setDownloadingExport(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user) return;

    setRequestingDeletion(true);
    try {
      const { error } = await supabase.from("data_requests").insert({
        user_id: user.id,
        request_type: "deletion",
        status: "pending",
        notes: "Solicitação de exclusão de dados conforme Art. 18, VI LGPD",
      });

      if (error) throw error;

      toast.success("Solicitação de exclusão registrada. Será analisada pela equipe de acordo com a legislação vigente.");
      fetchPrivacyData();
    } catch (error) {
      console.error("Erro ao solicitar exclusão:", error);
      toast.error("Erro ao registrar solicitação. Tente novamente.");
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
        return <Download className="h-4 w-4 text-blue-600" />;
      case "deletion":
        return <Trash2 className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-orange-600" />;
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
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">{getConsentTypeLabel(consent.consent_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        Versão {consent.consent_version}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {format(new Date(consent.accepted_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(consent.accepted_at), "HH:mm", { locale: ptBR })}
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
                          {getRequestTypeIcon(request.request_type)}
                          <div>
                            <p className="text-sm font-medium">
                              {getRequestTypeLabel(request.request_type)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(request.requested_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Exclusão de Dados (Art. 18, VI LGPD)
          </CardTitle>
          <CardDescription>
            Solicite a exclusão dos seus dados pessoais do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
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
                <AlertDialogTitle className="text-red-600">Solicitar Exclusão de Dados</AlertDialogTitle>
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
                  className="bg-red-600 hover:bg-red-700"
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
                key={policy.table_name}
                className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-medium">{getTableLabel(policy.table_name)}</p>
                  <p className="text-xs text-muted-foreground">{policy.description}</p>
                  <p className="text-xs text-blue-600">{policy.legal_basis}</p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {policy.retention_years} anos
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aviso Legal */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Informações sobre seus Direitos
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
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
