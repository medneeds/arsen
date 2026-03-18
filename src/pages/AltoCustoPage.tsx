import { Download, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function AltoCustoPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const documents = [
    { title: "ALTEPLASE - AVEI", file: "alteplase-avei.odt", category: "Trombolítico" },
    { title: "ALTEPLASE - TROMBOSE DE PERMCATH", file: "alteplase-trombose-permcath.odt", category: "Trombolítico" },
    { title: "CICLOFOSFAMIDA", file: "ciclofosfamida.odt", category: "Imunossupressor" },
    { title: "ERTAPENEM", file: "ertapenem.odt", category: "Antibiótico" },
    { title: "FILGRASTIM - GRANULOKINE", file: "filgrastim-granulokine.odt", category: "Estimulante" },
    { title: "IMUNOGLOBULINA HUMANA", file: "imunoglobulina-humana.odt", category: "Imunoglobulina" },
    { title: "MICAFUNGINA", file: "micafungina.odt", category: "Antifúngico" },
    { title: "REVOLADE PTI", file: "revolade-pti.odt", category: "Trombocitopoiético" },
    { title: "TEICOPLANINA", file: "teicoplanina.odt", category: "Antibiótico" },
    { title: "TERLIPRESSINA", file: "terlipressina.odt", category: "Vasoconstritor" },
  ];

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (fileName: string) => {
    const link = document.createElement('a');
    link.href = `/documents/alto-custo/${fileName}`;
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
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-amber-500 to-amber-400 bg-clip-text text-transparent">
            Alto Custo
          </h1>
          <p className="text-muted-foreground text-lg">
            Solicitações de medicamentos e procedimentos de alto custo
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
                placeholder="Buscar por medicamento ou categoria..."
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
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                      <Download className="h-6 w-6 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {doc.category} • Clique para fazer download
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
