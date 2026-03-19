import { Search, ExternalLink, FileText, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Protocol {
  title: string;
  category: string;
  status: "atualizado" | "em_breve";
  year?: string;
  externalUrl?: string;
}

export default function ProtocolosUtiPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const protocols: Protocol[] = [
    { title: "Admissão e Alta Seguras", category: "Gestão de Leitos", status: "atualizado", year: "2023" },
    { title: "Manejo de Óbitos e Leitos", category: "Gestão de Leitos", status: "atualizado", year: "2023" },
    { title: "Controle Glicêmico na UTI", category: "Metabólico", status: "atualizado", year: "2023" },
    { title: "Sepse e Uso de Antimicrobianos", category: "Infectologia", status: "atualizado", year: "2023" },
    { title: "Sedação e Analgesia na UTI", category: "Cuidados Intensivos", status: "atualizado", year: "2023" },
    { title: "Manejo do Potencial Doador", category: "Transplante", status: "atualizado", year: "2023" },
    { title: "Prevenção de IRAS - ITU-RC", category: "Infectologia", status: "atualizado", year: "2023" },
    { title: "Prevenção de IRAS - IPCS-LC", category: "Infectologia", status: "atualizado", year: "2023" },
    { title: "Hemorragia Subaracnoide", category: "Neurologia", status: "atualizado", year: "2023" },
    { title: "Desmame de Ventilação Mecânica e Prevenção de PAV", category: "Respiratório", status: "atualizado", year: "2023" },
    { title: "Anticoagulação Plena", category: "Hematologia", status: "em_breve" },
    { title: "Cuidados em Pós Parada Cardíaca", category: "Cardiologia", status: "atualizado", year: "2023" },
    { title: "Atendimento ao Politraumatizado", category: "Trauma", status: "atualizado", year: "2023" },
    { title: "Terapia Nutricional do Paciente Grave", category: "Nutrição", status: "em_breve" },
    { title: "Manejo do Choque", category: "Hemodinâmica", status: "atualizado", year: "2023" },
    { title: "Manejo do Status Epiléptico", category: "Neurologia", status: "atualizado", year: "2023" },
    { title: "Linha de Cuidados do IAM", category: "Cardiologia", status: "em_breve" },
    { title: "Linha de Cuidados do AVC", category: "Neurologia", status: "atualizado", year: "2023" },
    { title: "Manejo do Tétano Grave", category: "Infectologia", status: "em_breve" },
    { title: "Cetoacidose Diabética", category: "Metabólico", status: "em_breve" },
    { title: "Termo de Declaração de ME", category: "Documentos", status: "atualizado", year: "2023" },
    { title: "Termo de Traqueostomia", category: "Documentos", status: "em_breve" },
    { title: "Termo de Admissão em UTI", category: "Documentos", status: "atualizado", year: "2023" },
    { title: "POPs - Multiprofissional", category: "Gestão", status: "em_breve" },
    { title: "Notificação de Eventos Adversos", category: "Qualidade", status: "atualizado", year: "2023" },
  ];

  const filteredProtocols = protocols.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const available = protocols.filter(p => p.status === "atualizado").length;
  const coming = protocols.filter(p => p.status === "em_breve").length;

  return (
    <div className="bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-6 md:p-8 space-y-8 max-w-6xl">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
            Protocolos Assistenciais UTI
          </h1>
          <p className="text-muted-foreground text-lg">
            Serviço de Terapia Intensiva — Hospital Municipal Djalma Marques
          </p>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{available} disponíveis</Badge>
            <Badge variant="outline" className="text-muted-foreground">{coming} em breve</Badge>
          </div>
        </div>

        {/* Search */}
        <Card className="border-primary/20 shadow-lg">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar protocolo ou categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg border-2 focus:border-primary/50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Protocol cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProtocols.map((protocol, idx) => (
            <Card
              key={idx}
              className={`group transition-all duration-200 hover:shadow-lg ${
                protocol.status === "em_breve"
                  ? "opacity-60 border-dashed"
                  : "hover:border-primary/40 cursor-pointer"
              }`}
            >
              <CardContent className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <h3 className="font-semibold text-sm leading-tight">{protocol.title}</h3>
                  </div>
                  {protocol.status === "atualizado" ? (
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">{protocol.category}</Badge>
                  {protocol.status === "atualizado" ? (
                    <span className="text-xs text-emerald-500 font-medium">Atualizado {protocol.year}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Em breve</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProtocols.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum protocolo encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
