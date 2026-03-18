import { useNavigate } from "react-router-dom";
import { ArrowLeft, Workflow, CheckCircle2, HelpCircle, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FluxoPaliativacaoPage() {
  const navigate = useNavigate();

  const katzItems = [
    { item: "Banho", description: "Capacidade de tomar banho sozinho" },
    { item: "Vestir-se", description: "Capacidade de se vestir sem ajuda" },
    { item: "Ir ao banheiro", description: "Capacidade de usar o banheiro independentemente" },
    { item: "Transferência", description: "Ex: da cama para a cadeira" },
    { item: "Continência", description: "Controle de esfíncteres" },
    { item: "Alimentação", description: "Capacidade de se alimentar sozinho" },
  ];

  const necpalCriteria = [
    { criterion: "Pergunta Surpresa", description: "\"Eu me surpreenderia se este paciente morresse no próximo ano?\"" },
    { criterion: "Declínio Funcional ou Nutricional", description: "Perda progressiva de capacidades e/ou peso" },
    { criterion: "Doenças Crônicas Avançadas", description: "Ex: Câncer, DPOC, IC, Demência" },
    { criterion: "Critérios Específicos de Cada Doença", description: "Indicadores clínicos por patologia" },
    { criterion: "Sinais de Fragilidade", description: "Dependência, polimedicação, vulnerabilidade" },
  ];

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
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Workflow className="h-7 w-7 text-violet-500" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Fluxo de Paliativação
                </h1>
                <p className="text-muted-foreground text-lg mt-1">
                  Instruções sobre Paliativação e Transferência UTI
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="uppercase bg-violet-500/10 text-violet-700 dark:text-violet-400">
                Protocolo Assistencial
              </Badge>
              <Badge variant="secondary" className="uppercase">
                Ferramentas de Avaliação
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* ESCALA DE AVD (KATZ) */}
        <Card className="border-blue-500/20 shadow-lg">
          <CardHeader className="bg-blue-500/5">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-blue-500" />
              <div>
                <CardTitle className="text-2xl uppercase">
                  1. Escala de AVD (Katz ou ABVD)
                </CardTitle>
                <CardDescription className="text-base uppercase mt-1">
                  Atividades Básicas da Vida Diária
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold uppercase text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Objetivo:
              </h3>
              <p className="text-foreground uppercase leading-relaxed">
                Avaliar a capacidade funcional de uma pessoa para realizar atividades básicas do dia a dia.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold uppercase text-foreground mb-4">Itens Avaliados:</h3>
              <div className="grid gap-3">
                {katzItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold uppercase text-foreground">{item.item}</h4>
                      <p className="text-sm text-muted-foreground uppercase mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold uppercase text-amber-700 dark:text-amber-400 mb-4">Pontuação:</h3>
              <ul className="space-y-3 text-foreground uppercase">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong>Cada item recebe 1 ponto</strong> se o paciente realiza sozinho.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">•</span>
                  <span><strong>Máximo: 6 pontos</strong> (Independência total).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Mínimo: 0 pontos</strong> (Dependência total).</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* NECPAL */}
        <Card className="border-purple-500/20 shadow-lg">
          <CardHeader className="bg-purple-500/5">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-purple-500" />
              <div>
                <CardTitle className="text-2xl uppercase">
                  2. NECPAL (Necesidades Paliativas)
                </CardTitle>
                <CardDescription className="text-base uppercase mt-1">
                  Identificação precoce de necessidades paliativas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold uppercase text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Objetivo:
              </h3>
              <p className="text-foreground uppercase leading-relaxed">
                Identificar precocemente pacientes com necessidades paliativas (não apenas os em fim de vida).
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold uppercase text-foreground mb-4">Componentes Principais:</h3>
              <div className="space-y-3">
                {necpalCriteria.map((criterion, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold uppercase text-foreground">{criterion.criterion}</h4>
                      <p className="text-sm text-muted-foreground uppercase mt-1">{criterion.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold uppercase text-emerald-700 dark:text-emerald-400 mb-4">Classificação:</h3>
              <p className="text-foreground uppercase leading-relaxed">
                Se o paciente responder <strong className="text-red-600 dark:text-red-400">"NÃO"</strong> à pergunta surpresa 
                e apresentar outros critérios → <strong className="text-emerald-600 dark:text-emerald-400">NECPAL POSITIVO</strong> → 
                Necessita abordagem paliativa.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* PERGUNTA SURPRESA */}
        <Card className="border-rose-500/20 shadow-lg">
          <CardHeader className="bg-rose-500/5">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-6 w-6 text-rose-500" />
              <div>
                <CardTitle className="text-2xl uppercase">
                  3. Pergunta Surpresa (Surprise Question)
                </CardTitle>
                <CardDescription className="text-base uppercase mt-1">
                  Rastreio prognóstico subjetivo
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-8 text-center">
              <HelpCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold uppercase text-foreground mb-2">Formulação:</h3>
              <p className="text-xl text-rose-600 dark:text-rose-400 uppercase font-semibold leading-relaxed">
                "Eu me surpreenderia se este paciente morresse no próximo ano?"
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold uppercase text-foreground mb-4">Interpretação:</h3>
              <div className="grid gap-4">
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <h4 className="font-semibold uppercase text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                    <span className="text-2xl">✗</span>
                    NÃO, eu não me surpreenderia
                  </h4>
                  <p className="text-foreground uppercase">
                    → Paciente com prognóstico limitado → <strong>Avaliação paliativa indicada.</strong>
                  </p>
                </div>

                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <h4 className="font-semibold uppercase text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
                    <span className="text-2xl">✓</span>
                    SIM, eu me surpreenderia
                  </h4>
                  <p className="text-foreground uppercase">
                    → Prognóstico mais favorável, mas o acompanhamento continua.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RESUMO INTEGRADO */}
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-2xl uppercase flex items-center gap-2">
              <Workflow className="h-6 w-6 text-primary" />
              Resumo Integrado - Uso na Prática Clínica
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-bold uppercase w-[200px]">Ferramenta</TableHead>
                    <TableHead className="font-bold uppercase">Objetivo</TableHead>
                    <TableHead className="font-bold uppercase">Quando Usar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-blue-500/5">
                    <TableCell className="font-semibold text-blue-600 dark:text-blue-400 uppercase">
                      ABVD (Katz)
                    </TableCell>
                    <TableCell className="uppercase">
                      Avaliar independência funcional
                    </TableCell>
                    <TableCell className="uppercase">
                      Geriatria, reabilitação, triagem em saúde
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-purple-500/5">
                    <TableCell className="font-semibold text-purple-600 dark:text-purple-400 uppercase">
                      NECPAL
                    </TableCell>
                    <TableCell className="uppercase">
                      Identificar necessidades paliativas
                    </TableCell>
                    <TableCell className="uppercase">
                      Pacientes crônicos, idosos, em declínio clínico
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-rose-500/5">
                    <TableCell className="font-semibold text-rose-600 dark:text-rose-400 uppercase">
                      Pergunta Surpresa
                    </TableCell>
                    <TableCell className="uppercase">
                      Rastreio prognóstico subjetivo
                    </TableCell>
                    <TableCell className="uppercase">
                      Parte do NECPAL ou triagem inicial
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
