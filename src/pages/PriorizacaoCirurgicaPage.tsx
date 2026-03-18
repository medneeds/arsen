import { useNavigate } from "react-router-dom";
import { ArrowLeft, Scissors, AlertCircle, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export default function PriorizacaoCirurgicaPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const emergencyProcedures = [
    { specialty: "Cabeça e Pescoço", procedure: "Dissecção de veia para colocação de cateter central NPP ou QT" },
    { specialty: "Cardíaca", procedure: "Revascularização do miocárdio" },
    { specialty: "Cardíaca", procedure: "Drenagem pericárdica" },
    { specialty: "Geral", procedure: "Apendicectomia por videolaparoscopia (4ª edição)" },
    { specialty: "Geral", procedure: "Laparotomia exploradora" },
    { specialty: "Geral", procedure: "Laparotomia exploradora por videolaparoscopia" },
    { specialty: "Geral", procedure: "Colectomia parcial com colostomia" },
    { specialty: "Geral", procedure: "Acesso à circulação venosa central" },
    { specialty: "Geral", procedure: "Ooforectomia uni ou bilateral / ooforoplastia uni ou bilateral" },
    { specialty: "Geral", procedure: "Hemorragia intensa" },
    { specialty: "Geral", procedure: "Abdome agudo" },
    { specialty: "Geral", procedure: "Hemotórax hipertensivo" },
    { specialty: "Cardiologia", procedure: "Cateterismo cardíaco e E/OU com cineangiocoronariografia e ventriculografia" },
    { specialty: "Hemodinâmica", procedure: "Angioplastia transluminal percutânea de múltiplos vasos ou de bifurcação com implante de stent" },
    { specialty: "Neurocirurgia", procedure: "Hipertensão intracraniana – DVE e DVP" },
    { specialty: "Neurocirurgia", procedure: "Craniotomia" },
    { specialty: "Ortopedia", procedure: "Fraturas expostas" },
    { specialty: "Ortopedia", procedure: "Amputações" },
    { specialty: "Ortopedia", procedure: "Toracotomia com drenagem pleural fechada" },
    { specialty: "Torácica", procedure: "Toracotomia" },
    { specialty: "Torácica", procedure: "Broncoscopia com ou sem aspirado ou lavado bronquico" },
    { specialty: "Urológica", procedure: "Torção de testículo – cirurgia" },
    { specialty: "Vascular", procedure: "Aneurisma de aorta com ruptura – tratamento cirúrgico" },
    { specialty: "Vascular", procedure: "Aneurisma periférico com ruptura – tratamento cirúrgico" },
    { specialty: "Vascular", procedure: "Obstrução arterial aguda" },
  ];

  const urgencyProcedures = [
    { specialty: "Bucomaxilo", procedure: "Fraturas complexas do terço médio da face – fixação" },
    { specialty: "Bucomaxilo", procedure: "Cirurgia com síntese, levantamento de crânio maxilar, enxerto ósseo e halo craniano eventuais" },
    { specialty: "Bucomaxilo", procedure: "Fraturas dos ossos nasais – redução cirúrgica e gesso" },
    { specialty: "Bucomaxilo", procedure: "Redução de fratura do malar (com fixação)" },
    { specialty: "Cabeça e Pescoço", procedure: "Traqueostomia" },
    { specialty: "Cabeça e Pescoço", procedure: "Traqueobronquio com colocação de órtese traqueal ou traqueobronquica por via cervical" },
    { specialty: "Geral", procedure: "Colecistectomia sem colangiografia por videolaparoscopia" },
    { specialty: "Geral", procedure: "Desbridamento cirúrgico (por U.T.)" },
    { specialty: "Geral", procedure: "Colecistectomia com colangiografia" },
    { specialty: "Geral", procedure: "Excisões: ferimentos, cicatrizes, tumores – excisão" },
    { specialty: "Geral", procedure: "Retalho ou enxertos da região" },
    { specialty: "Geral", procedure: "Herniorrafia com ou sem ressecção intestinal" },
    { specialty: "Geral", procedure: "Drenagem de glândula de Bartholin ou Skene" },
    { specialty: "Ortopedia", procedure: "Fraturas de fêmur – tratamento cirúrgico" },
    { specialty: "Ortopedia", procedure: "Fraturas de tíbia associadas a fíbula (inclusive deslocamento epifisário) – tratamento cirúrgico" },
    { specialty: "Ortopedia", procedure: "Lesões de tornozelo – tratamento" },
    { specialty: "Ortopedia", procedure: "Fraturas e/ou luxações ao nível do tornozelo" },
    { specialty: "Ortopedia", procedure: "Fraturas/ luxações (incluindo deslocamento epifisário) – membros superiores e inferiores" },
    { specialty: "Ortopedia", procedure: "Artroscopia de joelho" },
    { specialty: "Ortopedia", procedure: "Reconstrução do ligamento cruzado" },
    { specialty: "Urologia", procedure: "Prostatectomia radical" },
    { specialty: "Urologia", procedure: "Colocação ureteroscópica de duplo J unilateral" },
  ];

  const filterProcedures = (procedures: typeof emergencyProcedures) => {
    if (!searchQuery.trim()) return procedures;
    
    const query = searchQuery.toLowerCase();
    return procedures.filter(
      (item) =>
        item.procedure.toLowerCase().includes(query) ||
        item.specialty.toLowerCase().includes(query)
    );
  };

  const filteredEmergencyProcedures = filterProcedures(emergencyProcedures);
  const filteredUrgencyProcedures = filterProcedures(urgencyProcedures);

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
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Scissors className="h-7 w-7 text-orange-500" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Priorização Cirúrgica
                </h1>
                <p className="text-muted-foreground text-lg mt-1">
                  Priorização Cirúrgica
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="uppercase">
                Emergência
              </Badge>
              <Badge variant="secondary" className="uppercase">
                Internação
              </Badge>
              <Badge variant="secondary" className="uppercase">
                UTIs
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Search Bar */}
        <Card className="border-primary/20 shadow-lg">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por procedimento ou especialidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-base bg-background/50 border-border/50 focus:border-primary transition-all uppercase"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Priority Levels */}
        <Tabs defaultValue="emergency" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="emergency" className="text-base uppercase">
              <AlertCircle className="h-4 w-4 mr-2" />
              Emergência Imediata
            </TabsTrigger>
            <TabsTrigger value="urgency" className="text-base uppercase">
              <Clock className="h-4 w-4 mr-2" />
              Urgência (6 horas)
            </TabsTrigger>
          </TabsList>

          {/* Emergency Procedures */}
          <TabsContent value="emergency" className="space-y-4">
            <Card className="border-red-500/20 shadow-lg">
              <CardHeader className="bg-red-500/5">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <CardTitle className="text-2xl uppercase">
                      Procedimentos Cirúrgicos de Emergência
                    </CardTitle>
                    <CardDescription className="text-base uppercase mt-1">
                      Atendimento Imediato – Cirurgia Agora
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-bold uppercase w-[250px]">
                          Especialidade
                        </TableHead>
                        <TableHead className="font-bold uppercase">
                          Procedimento
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmergencyProcedures.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-12 text-muted-foreground uppercase">
                            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            Nenhum procedimento encontrado com esse termo
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEmergencyProcedures.map((item, index) => (
                        <TableRow 
                          key={index}
                          className="hover:bg-red-500/5 transition-colors"
                        >
                          <TableCell className="font-semibold text-red-600 uppercase align-top">
                            {item.specialty}
                          </TableCell>
                          <TableCell className="uppercase">
                            {item.procedure}
                          </TableCell>
                        </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="uppercase">
                {searchQuery
                  ? `Exibindo ${filteredEmergencyProcedures.length} de ${emergencyProcedures.length} procedimentos`
                  : `Total: ${emergencyProcedures.length} procedimentos de emergência`}
              </span>
            </div>
          </TabsContent>

          {/* Urgency Procedures */}
          <TabsContent value="urgency" className="space-y-4">
            <Card className="border-amber-500/20 shadow-lg">
              <CardHeader className="bg-amber-500/5">
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-amber-500" />
                  <div>
                    <CardTitle className="text-2xl uppercase">
                      Procedimentos Cirúrgicos de Urgência
                    </CardTitle>
                    <CardDescription className="text-base uppercase mt-1">
                      Atendimento em até 6 horas
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-bold uppercase w-[250px]">
                          Especialidade
                        </TableHead>
                        <TableHead className="font-bold uppercase">
                          Procedimento
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUrgencyProcedures.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-12 text-muted-foreground uppercase">
                            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            Nenhum procedimento encontrado com esse termo
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUrgencyProcedures.map((item, index) => (
                        <TableRow 
                          key={index}
                          className="hover:bg-amber-500/5 transition-colors"
                        >
                          <TableCell className="font-semibold text-amber-600 uppercase align-top">
                            {item.specialty}
                          </TableCell>
                          <TableCell className="uppercase">
                            {item.procedure}
                          </TableCell>
                        </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="uppercase">
                {searchQuery
                  ? `Exibindo ${filteredUrgencyProcedures.length} de ${urgencyProcedures.length} procedimentos`
                  : `Total: ${urgencyProcedures.length} procedimentos de urgência`}
              </span>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
