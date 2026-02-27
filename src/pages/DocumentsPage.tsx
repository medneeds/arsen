import { 
  FileText, 
  Biohazard, 
  Radar, 
  ClipboardList, 
  Droplet, 
  FileCheck, 
  DollarSign,
  Search,
  ChevronRight,
  Scissors,
  Activity,
  Heart,
  Workflow
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const documents = [
    { 
      id: "sepse", 
      title: "Protocolo SEPSE", 
      description: "Protocolo institucional para manejo de sepse e choque séptico",
      route: "/sepsis-protocol",
      icon: Biohazard,
      color: "text-red-500",
      bgColor: "bg-red-500/10"
    },
    { 
      id: "controle-glicemico", 
      title: "Controle Glicêmico", 
      description: "Protocolo de insulina e controle glicêmico",
      route: "/documents/controle-glicemico",
      icon: Activity,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10"
    },
    { 
      id: "cuidados-paliativos", 
      title: "Cuidados Paliativos", 
      description: "Termo de aceite de tratamento em cuidados paliativos",
      route: "/documents/cuidados-paliativos",
      icon: Heart,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10"
    },
    { 
      id: "fluxo-paliativacao", 
      title: "Fluxo de Paliativação", 
      description: "Orientações sobre paliativação e transferência UTI",
      route: "/documents/fluxo-paliativacao",
      icon: Workflow,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10"
    },
    { 
      id: "tomografias", 
      title: "Tomografias", 
      description: "Questionários e documentos para exames tomográficos",
      route: "/documents/tomografias",
      icon: Radar,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    { 
      id: "opme", 
      title: "Listas OPME", 
      description: "Órteses, Próteses e Materiais Especiais",
      route: "/documents/opme",
      icon: ClipboardList,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    { 
      id: "hemoderivados", 
      title: "Hemoderivados", 
      description: "Solicitações e termos de hemotransfusão",
      route: "/documents/hemoderivados",
      icon: Droplet,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10"
    },
    { 
      id: "regulacoes", 
      title: "Regulações SUS", 
      description: "Documentos para regulação e solicitações SUS",
      route: "/documents/regulacoes",
      icon: FileCheck,
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    { 
      id: "alto-custo", 
      title: "Alto Custo", 
      description: "Solicitações de medicamentos e procedimentos de alto custo",
      route: "/documents/alto-custo",
      icon: DollarSign,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10"
    },
    { 
      id: "sadt", 
      title: "SADT", 
      description: "Serviço Auxiliar de Diagnóstico e Terapia",
      route: "/documents/sadt",
      icon: ClipboardList,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10"
    },
    { 
      id: "priorizacao-cirurgica", 
      title: "Priorização Cirúrgica", 
      description: "Classificação de procedimentos cirúrgicos por prioridade",
      route: "/documents/priorizacao-cirurgica",
      icon: Scissors,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    },
  ];

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-6 md:p-8 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent uppercase">
            DOCUMENTOS
          </h1>
          <p className="text-muted-foreground text-lg uppercase">
            Central de documentos médicos institucionais
          </p>
          <Badge variant="secondary" className="mt-2">
            {documents.length} categorias disponíveis
          </Badge>
        </div>

        {/* Search Bar */}
        <Card className="border-primary/20 shadow-lg">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar documentos por categoria ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-base bg-background/50 border-border/50 focus:border-primary transition-all"
              />
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.length === 0 ? (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Search className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-center text-muted-foreground text-lg">
                  Nenhum documento encontrado com esse termo
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredDocuments.map((doc, index) => (
              <Card
                key={doc.id}
                className="group hover:shadow-xl hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden animate-fade-in"
                style={{ animationDelay: `${index * 80}ms` }}
                onClick={() => navigate(doc.route)}
              >
                <CardContent className="p-0">
                  <div className="p-6 space-y-4">
                    {/* Icon and Title */}
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-14 h-14 rounded-xl ${doc.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <doc.icon className={`h-7 w-7 ${doc.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors mb-1">
                          {doc.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {doc.description}
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button 
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                      variant="outline"
                      asChild
                    >
                      <div className="flex items-center justify-between">
                        <span>Acessar documentos</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Footer Stats */}
        {filteredDocuments.length > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
            <FileText className="h-4 w-4" />
            <span>
              Exibindo {filteredDocuments.length} de {documents.length} {filteredDocuments.length === 1 ? "categoria" : "categorias"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
