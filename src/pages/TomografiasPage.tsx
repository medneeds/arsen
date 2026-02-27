import { Download, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function TomografiasPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const documents = [
    { title: "QUESTIONÁRIO - CABEÇA E PESCOÇO", file: "questionario-cabeca-e-pescoco.pdf", type: "Questionário" },
    { title: "QUESTIONÁRIO - COLUNA", file: "questionario-coluna.pdf", type: "Questionário" },
    { title: "QUESTIONÁRIO - CRÂNIO", file: "questionario-cranio.pdf", type: "Questionário" },
    { title: "QUESTIONÁRIO - TÓRAX", file: "questionario-torax.pdf", type: "Questionário" },
    { title: "QUESTIONÁRIO - ABDOME E PELVE", file: "questionario-abdome-pelve.pdf", type: "Questionário" },
    { title: "QUESTIONÁRIO - MEMBROS", file: "questionario-membros.pdf", type: "Questionário" },
    { title: "QUESTIONÁRIO - ANGIOS", file: "questionario-angios.pdf", type: "Questionário" },
    { title: "TERMO DE CONSENTIMENTO - GESTANTE", file: "termo-consentimento-gestante.pdf", type: "Termo" },
    { title: "TERMO DE CONSENTIMENTO - TC", file: "termo-consentimento-tc.pdf", type: "Termo" },
    { title: "FICHA DE ACOMPANHAMENTO - TC", file: "ficha-acompanhamento-tc.pdf", type: "Ficha" },
  ];

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (fileName: string) => {
    const link = document.createElement('a');
    link.href = `/documents/tomografias/${fileName}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-6 md:p-8 space-y-8 max-w-6xl">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-blue-400 bg-clip-text text-transparent uppercase">
            TOMOGRAFIAS
          </h1>
          <p className="text-muted-foreground text-lg uppercase">
            Questionários e documentos para exames tomográficos
          </p>
          <Badge variant="secondary" className="mt-2">
            {documents.length} documentos disponíveis
          </Badge>
        </div>

        {/* Search Bar */}
        <Card className="border-primary/20 shadow-lg">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por título ou tipo de documento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-base bg-background/50 border-border/50 focus:border-primary transition-all"
              />
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        <div className="space-y-3">
          {filteredDocuments.length === 0 ? (
            <Card className="border-dashed">
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
                key={doc.file}
                className="group hover:shadow-xl hover:border-primary/40 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <CardContent className="p-0">
                  <button
                    onClick={() => handleDownload(doc.file)}
                    className="w-full flex items-center gap-4 p-5 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Download className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {doc.type} • Clique para fazer download
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Footer Info */}
        {filteredDocuments.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {filteredDocuments.length} de {documents.length} {filteredDocuments.length === 1 ? "documento" : "documentos"} 
            {searchQuery && " encontrado(s)"}
          </p>
        )}
      </div>
    </div>
  );
}
