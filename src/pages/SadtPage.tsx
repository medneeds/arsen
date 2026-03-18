import { Download, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function SadtPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const documents = [
    { file: "hapvida-guia-sp-sadt.pdf", title: "Guia SP-SADT Hapvida - Formato Retrato", orientation: "Retrato" },
    { file: "hapvida-guia-sp-sadt-paisagem.pdf", title: "Guia SP-SADT Hapvida - Formato Paisagem", orientation: "Paisagem" },
  ];

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (fileName: string) => {
    const link = document.createElement('a');
    link.href = `/documents/sadt/${fileName}`;
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
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-500 to-cyan-400 bg-clip-text text-transparent">
            SADT
          </h1>
          <p className="text-muted-foreground text-lg">
            Serviço Auxiliar de Diagnóstico e Terapia
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
                placeholder="Buscar documentos..."
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
                  {searchQuery
                    ? "Nenhum documento encontrado com esse termo"
                    : "Nenhum documento disponível"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredDocuments.map((doc, index) => (
              <Card
                key={doc.file}
                className="group hover:shadow-xl hover:border-primary/40 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-0">
                  <button
                    onClick={() => handleDownload(doc.file)}
                    className="w-full flex items-center gap-4 p-5 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                      <Download className="h-6 w-6 text-cyan-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {doc.orientation} • Clique para fazer download
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
            {filteredDocuments.length} {filteredDocuments.length === 1 ? "documento" : "documentos"} 
            {searchQuery && " encontrado(s)"}
          </p>
        )}
      </div>
    </div>
  );
}
