import { Download, Search, ChevronRight, FileText, Droplet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { HemocomponentRequestDialog } from "@/components/HemocomponentRequestDialog";

export default function HemoderivadosPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);

  const documents = [
    { title: "HEMOC ATO - SADT", file: "hemoc-ato-sadt.pdf", type: "SADT" },
    { title: "HEMOC CONCENTRADOS - SADT", file: "hemoc-concentrados-sadt.pdf", type: "SADT" },
    { title: "HEMOC EXAMES - SADT", file: "hemoc-exames-sadt.pdf", type: "SADT" },
    { title: "SOLICITAÇÃO DE HEMOCONCENTRADOS", file: "solicitacao-hemoconcentrados.pdf", type: "Solicitação" },
    { title: "TERMO DE ESCLARECIMENTO - HEMOTRANSFUSÃO", file: "termo-esclarecimento-hemotransfusao.pdf", type: "Termo" },
  ];

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (fileName: string) => {
    const link = document.createElement('a');
    link.href = `/documents/hemoderivados/${fileName}`;
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
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-rose-500 to-rose-400 bg-clip-text text-transparent">
            Hemoderivados
          </h1>
          <p className="text-muted-foreground text-lg">
            Solicitações e termos de hemotransfusão
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
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                      <Download className="h-6 w-6 text-rose-500" />
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
