import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function CuidadosPaliativosPage() {
  const navigate = useNavigate();
  const docUrl = "/documents/termo-cuidados-paliativos.docx";

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = docUrl;
    link.download = 'TERMO_CUIDADOS_PALIATIVOS_HOSPITAL_GUARAS.docx';
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
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-pink-500/10 flex items-center justify-center">
                <Heart className="h-7 w-7 text-pink-500" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Cuidados Paliativos
                </h1>
                <p className="text-muted-foreground text-lg mt-1">
                  Termo de Aceite de Tratamento
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-pink-500/10 text-pink-700 dark:text-pink-400">
                Cuidados Paliativos
              </Badge>
              <Badge variant="secondary" className="">
                Qualitotal 18.14.9
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Content Card */}
        <Card className="border-pink-500/20 shadow-lg">
          <CardHeader className="bg-pink-500/5">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Heart className="h-6 w-6 text-pink-500" />
              Termo de Aceite de Tratamento – Cuidados Paliativos
            </CardTitle>
            <CardDescription className="text-base">
              Medidas de conforto e proporcionalidade do cuidado
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <h3 className="text-lg font-semibold text-foreground mb-4">Objetivo do Termo</h3>
              <p className="text-muted-foreground leading-relaxed">
                O presente termo de aceite de tratamento em cuidados paliativos tem o objetivo de cumprir 
                o dever ético de informar ao paciente e seu responsável legal quanto aos principais aspectos 
                relacionados à implementação dos cuidados paliativos.
              </p>
              
              <h3 className="text-lg font-semibold text-foreground mt-6 mb-4">Medidas Contempladas</h3>
              <div className="bg-muted/30 border border-border rounded-lg p-6 space-y-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-pink-600 dark:text-pink-400 flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Medidas de Conforto Autorizadas:
                  </h4>
                  <ul className="space-y-2 text-muted-foreground ml-6">
                    <li className="flex items-start gap-2">
                      <span className="text-pink-500 font-bold">✓</span>
                      <span>Medidas de conforto</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pink-500 font-bold">✓</span>
                      <span>Proporcionalidade do cuidado</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pink-500 font-bold">✓</span>
                      <span>Tratamento adequado às enfermidades</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pink-500 font-bold">✓</span>
                      <span>Permanência do paciente próximo aos familiares</span>
                    </li>
                  </ul>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <h4 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                    Medidas Não Autorizadas:
                  </h4>
                  <ul className="space-y-2 text-muted-foreground ml-6">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✗</span>
                      <span>Intubação orotraqueal</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✗</span>
                      <span>Reanimação cardiopulmonar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✗</span>
                      <span>Transferência para leito de UTI</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✗</span>
                      <span>Cateter venoso central</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-foreground mt-6 mb-4">Informações no Documento</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">•</span>
                  <span>Identificação completa do paciente e responsável legal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">•</span>
                  <span>Declaração de ciência sobre o quadro clínico</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">•</span>
                  <span>Aceite das medidas de conforto e proporcionalidade</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">•</span>
                  <span>Isenção de responsabilidade ao hospital e profissionais</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">•</span>
                  <span>Assinatura do paciente/responsável e médico assistente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">•</span>
                  <span>Referências ao Código de Ética Médica e CDC</span>
                </li>
              </ul>

              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-foreground uppercase font-semibold">
                  ⚠️ Importante: Este termo garante que o responsável legal foi devidamente informado 
                  sobre todas as implicações do tratamento paliativo, mantendo o foco na dignidade 
                  e conforto do paciente.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <Button 
                size="lg"
                className="w-full h-16 text-lg bg-pink-600 hover:bg-pink-700 text-white"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-5 w-5" />
                DOWNLOAD DO TERMO
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
