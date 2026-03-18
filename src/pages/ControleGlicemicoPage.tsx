import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ControleGlicemicoPage() {
  const navigate = useNavigate();
  const pdfUrl = "/documents/protocolo-controle-glicemico.pdf";

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'PROTOCOLO_CONTROLE_GLICEMICO_HAPVIDA.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/documents")}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Activity className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Protocolo de Controle Glicêmico
                </h1>
                <p className="text-muted-foreground text-lg mt-1">
                  Formulário de controle glicêmico e protocolo de insulina
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                Rede Hapvida
              </Badge>
              <Badge variant="secondary">
                Protocolo Institucional
              </Badge>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <Card className="border-emerald-500/20 shadow-lg">
          <CardHeader className="bg-emerald-500/5">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Activity className="h-6 w-6 text-emerald-500" />
              Formulário de Controle Glicêmico
            </CardTitle>
            <CardDescription className="text-base">
              Protocolo de Insulina — Rede Hapvida
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <h3 className="text-lg font-semibold text-foreground mb-4">Sobre o Protocolo</h3>
              <p className="text-muted-foreground leading-relaxed">
                Formulário padronizado para registro e acompanhamento do controle glicêmico de pacientes 
                em uso de protocolo de insulina. Permite o monitoramento sistemático dos níveis glicêmicos 
                e ajuste das velocidades de infusão conforme protocolo institucional.
              </p>
              
              <h3 className="text-lg font-semibold text-foreground mt-6 mb-4">Informações Registradas</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Dados do paciente (Nome completo, Data de nascimento, Setor, Leito)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Data e horário de cada aferição</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Glicemia capilar aferida</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Velocidade de infusão atual da insulina</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Velocidade de infusão corrigida conforme protocolo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Horário da próxima aferição programada</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Assinatura do enfermeiro responsável</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 border-t border-border">
              <Button 
                size="lg"
                className="w-full h-16 text-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-5 w-5" />
                Download do Formulário
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
