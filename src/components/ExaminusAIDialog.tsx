import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, Check, X, Plus, RefreshCw, AlertTriangle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ExaminusAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentExams: string[];
  onImportExams: (newExams: string[]) => void;
  sectorColor?: string;
}

export function ExaminusAIDialog({
  open,
  onOpenChange,
  currentExams,
  onImportExams,
  sectorColor = "hsl(var(--primary))"
}: ExaminusAIDialogProps) {
  const [inputText, setInputText] = useState("");
  const [extractedExams, setExtractedExams] = useState<string[]>([]);
  const [filteredCriticalExams, setFilteredCriticalExams] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFilteringCritical, setIsFilteringCritical] = useState(false);
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [streamContent, setStreamContent] = useState("");

  const processWithAI = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error("Cole o texto do exame antes de processar");
      return;
    }

    setIsProcessing(true);
    setIsStreaming(true);
    setStreamContent("");
    setExtractedExams([]);
    setFilteredCriticalExams([]);
    setShowOnlyCritical(false);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/examinus-chat`;
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Extraia e formate os exames do texto abaixo. Retorne CADA LINHA DE EXAME FORMATADA EM UMA LINHA SEPARADA (uma por linha). Use o formato padrão de formatação de exames laboratoriais e de imagem:\n\n${inputText}`
            }
          ]
        }),
      });

      if (response.status === 429) {
        toast.error("Limite de requisições excedido. Tente novamente em alguns segundos.");
        setIsProcessing(false);
        setIsStreaming(false);
        return;
      }

      if (response.status === 402) {
        toast.error("Créditos de IA esgotados.");
        setIsProcessing(false);
        setIsStreaming(false);
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error("Falha ao processar com IA");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              setStreamContent(fullContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Parse the final content into lines
      const lines = fullContent
        .split("\n")
        .map(line => line.trim().toUpperCase())
        .filter(line => line.length > 0 && !line.startsWith("-") && line !== "");
      
      setExtractedExams(lines);
      setIsStreaming(false);
      setIsProcessing(false);
      
      if (lines.length > 0) {
        toast.success(`${lines.length} exame(s) extraído(s) com sucesso!`);
      } else {
        toast.warning("Nenhum exame identificado no texto");
      }
    } catch (error) {
      console.error("Erro ao processar:", error);
      toast.error("Erro ao processar exames com IA");
      setIsProcessing(false);
      setIsStreaming(false);
    }
  }, [inputText]);

  const filterCriticalValues = useCallback(async () => {
    if (extractedExams.length === 0) {
      toast.error("Nenhum exame para filtrar");
      return;
    }

    setIsFilteringCritical(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/examinus-chat`;
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Analise os exames abaixo e retorne APENAS UMA LINHA RESUMIDA com os valores ALTERADOS ou CRÍTICOS mais relevantes para decisão médica.

REGRAS:
1. Identifique valores fora da normalidade (anemia, leucocitose, leucopenia, plaquetopenia, IRA, distúrbios eletrolíticos, acidose, alcalose, coagulopatia, PCR elevado, lactato elevado, etc.)
2. Retorne APENAS UMA LINHA no formato: "DD/MM: [valores alterados resumidos]"
3. Seja extremamente conciso - apenas valores críticos
4. Se houver gasometria alterada, inclua os dados relevantes
5. Se não houver alterações significativas, retorne: "SEM ALTERAÇÕES CRÍTICAS"

EXAMES:
${extractedExams.join('\n')}`
            }
          ]
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Falha ao filtrar valores críticos");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      const criticalLine = fullContent.trim().toUpperCase();
      if (criticalLine && criticalLine !== "SEM ALTERAÇÕES CRÍTICAS") {
        setFilteredCriticalExams([criticalLine]);
        setShowOnlyCritical(true);
        toast.success("Valores críticos identificados!");
      } else {
        toast.info("Nenhuma alteração crítica identificada nos exames");
      }
      
      setIsFilteringCritical(false);
    } catch (error) {
      console.error("Erro ao filtrar críticos:", error);
      toast.error("Erro ao identificar valores críticos");
      setIsFilteringCritical(false);
    }
  }, [extractedExams]);

  const handleRemoveExtracted = (index: number) => {
    if (showOnlyCritical) {
      setFilteredCriticalExams(prev => prev.filter((_, i) => i !== index));
    } else {
      setExtractedExams(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleEditExtracted = (index: number, value: string) => {
    if (showOnlyCritical) {
      setFilteredCriticalExams(prev => prev.map((item, i) => i === index ? value.toUpperCase() : item));
    } else {
      setExtractedExams(prev => prev.map((item, i) => i === index ? value.toUpperCase() : item));
    }
  };

  const handleConfirmImport = () => {
    const examsToImport = showOnlyCritical ? filteredCriticalExams : extractedExams;
    if (examsToImport.length === 0) {
      toast.error("Nenhum exame para importar");
      return;
    }
    
    onImportExams([...currentExams, ...examsToImport]);
    toast.success(`${examsToImport.length} exame(s) adicionado(s)!`);
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setInputText("");
    setExtractedExams([]);
    setFilteredCriticalExams([]);
    setStreamContent("");
    setIsStreaming(false);
    setShowOnlyCritical(false);
  };

  const displayedExams = showOnlyCritical ? filteredCriticalExams : extractedExams;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div 
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${sectorColor}20` }}
            >
              <Sparkles className="h-5 w-5" style={{ color: sectorColor }} />
            </div>
            <span>Examinus AI</span>
            <span className="text-xs font-normal text-muted-foreground ml-2">
              Importação inteligente de exames
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Input Section */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Cole o texto com os dados de exames
            </label>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Cole aqui o texto com resultados de exames laboratoriais, gasometria, imagem, etc..."
              className="min-h-[120px] resize-none text-sm"
              disabled={isProcessing}
            />
            <div className="flex gap-2">
              <Button
                onClick={processWithAI}
                disabled={isProcessing || !inputText.trim()}
                className="flex-1"
                style={{ 
                  backgroundColor: sectorColor,
                  color: 'white'
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Processar com IA
                  </>
                )}
              </Button>
              {(inputText || extractedExams.length > 0) && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Streaming Preview */}
          {isStreaming && streamContent && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-3 w-3 animate-spin" style={{ color: sectorColor }} />
                <span className="text-xs font-medium text-muted-foreground">Extraindo exames...</span>
              </div>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">
                {streamContent}
              </pre>
            </div>
          )}

          {/* Results Section */}
          {extractedExams.length > 0 && !isStreaming && (
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                  {showOnlyCritical ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      Valores críticos ({filteredCriticalExams.length})
                    </span>
                  ) : (
                    `Exames extraídos (${extractedExams.length})`
                  )}
                </label>
                <div className="flex items-center gap-2">
                  {!showOnlyCritical && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={filterCriticalValues}
                      disabled={isFilteringCritical}
                      className="h-7 text-xs gap-1.5 border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
                    >
                      {isFilteringCritical ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" />
                          Apenas Críticos
                        </>
                      )}
                    </Button>
                  )}
                  {showOnlyCritical && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOnlyCritical(false)}
                      className="h-7 text-xs gap-1.5"
                    >
                      <Filter className="h-3 w-3" />
                      Ver Todos ({extractedExams.length})
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Clique para editar
                  </span>
                </div>
              </div>
              
              <ScrollArea className="flex-1 border rounded-lg p-2 max-h-[200px]">
                <div className="space-y-1">
                  {displayedExams.map((exam, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded hover:bg-accent/50 group",
                        showOnlyCritical && "bg-warning/10 border border-warning/30"
                      )}
                    >
                      <span className="text-xs font-semibold text-muted-foreground flex-shrink-0 mt-0.5">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={exam}
                        onChange={(e) => handleEditExtracted(idx, e.target.value)}
                        className="flex-1 text-xs uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveExtracted(idx)}
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  className="flex-1"
                  style={{ 
                    backgroundColor: showOnlyCritical ? "hsl(var(--warning))" : sectorColor,
                    color: showOnlyCritical ? "hsl(var(--warning-foreground))" : 'white'
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar {displayedExams.length} exame(s)
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isStreaming && extractedExams.length === 0 && !isProcessing && (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground py-8">
              <div className="space-y-2">
                <Sparkles className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-sm">
                  Cole o texto dos exames e clique em "Processar com IA"
                </p>
                <p className="text-xs">
                  A IA irá extrair e formatar automaticamente os dados
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
