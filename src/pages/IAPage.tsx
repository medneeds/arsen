import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Send, Sparkles, Loader2, Copy, Check, FileText, X, SeparatorVertical, Clock, AlertTriangle, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as pdfjsLib from "pdfjs-dist";

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function IAPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  // Toggles de inteligência clínica
  const [usePipeSeparator, setUsePipeSeparator] = useState(false);
  const [includeTime, setIncludeTime] = useState(true);
  const [onlyAltered, setOnlyAltered] = useState(false);
  const [clinicalImpression, setClinicalImpression] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll forçado para o final
  useEffect(() => {
    const scrollToEnd = () => {
      // Busca o viewport interno do ScrollArea
      const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    };
    
    scrollToEnd();
    // Múltiplos scrolls para garantir
    const timer1 = setTimeout(scrollToEnd, 10);
    const timer2 = setTimeout(scrollToEnd, 100);
    const timer3 = setTimeout(scrollToEnd, 200);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast.success("Copiado!");
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  const copyUppercaseToClipboard = async (text: string, index: number) => {
    try {
      const uppercaseText = text.toUpperCase();
      await navigator.clipboard.writeText(uppercaseText);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast.success("Copiado em caixa alta!");
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += pageText + "\n";
      }

      return fullText;
    } catch (error) {
      console.error("Erro ao extrair PDF:", error);
      throw new Error("Falha ao processar PDF");
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      toast.error("Apenas PDFs e imagens são aceitos");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 20MB");
      return;
    }

    setSelectedFile(file);

    // Preview para imagens
    if (file.type.includes("image")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const streamChat = async (userMessage: string, file?: File) => {
    setIsLoading(true);
    
    let fileContent = null;
    let finalUserMessage = userMessage || "Extraia e formate este exame:";

    // Processar arquivo se houver
    if (file) {
      try {
        if (file.type.includes("pdf")) {
          // Extrair texto do PDF
          const pdfText = await extractTextFromPDF(file);
          finalUserMessage = pdfText;
        } else if (file.type.includes("image")) {
          // Converter imagem para base64
          const reader = new FileReader();
          fileContent = await new Promise<string>((resolve) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        }
      } catch (error) {
        console.error("Erro ao processar arquivo:", error);
        toast.error("Erro ao processar arquivo");
        setIsLoading(false);
        return;
      }
    }

    const newMessages: Message[] = [...messages, { role: "user", content: finalUserMessage }];
    setMessages(newMessages);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/examinus-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            fileContent,
            usePipeSeparator,
            includeTime,
            onlyAltered,
            clinicalImpression,
          }),
        }
      );

      if (response.status === 429) {
        toast.error("Limite de requisições excedido. Tente novamente mais tarde.");
        setMessages(messages);
        return;
      }

      if (response.status === 402) {
        toast.error("Créditos de IA esgotados. Adicione créditos nas configurações.");
        setMessages(messages);
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error("Falha ao iniciar stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let assistantContent = "";

      while (!streamDone) {
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
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages([
                ...newMessages,
                { role: "assistant", content: assistantContent }
              ]);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Erro no chat:", error);
      toast.error("Erro ao processar mensagem. Tente novamente.");
      setMessages(messages);
    } finally {
      setIsLoading(false);
      removeFile();
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    streamChat(userMessage, selectedFile || undefined);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 backdrop-blur-sm">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground uppercase">Assistente Examinus</h1>
              <p className="text-[10px] text-muted-foreground uppercase">Formatador Inteligente de Exames Médicos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
        <ScrollArea className="flex-1 px-2">
          <div className="max-w-4xl mx-auto py-2 space-y-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center py-2 px-2">
                {/* Icon heroico com animação */}
                <div className="relative inline-block mb-2">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/20 to-transparent rounded-full blur-xl animate-pulse" />
                  <div className="relative inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-primary via-primary/90 to-primary/70 shadow-xl shadow-primary/20 border border-primary/20">
                    <Sparkles className="h-10 w-10 text-primary-foreground animate-in zoom-in-50 duration-1000" />
                  </div>
                </div>

                {/* Título com gradiente */}
                <h2 className="text-xl font-bold mb-1 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700">
                  OLÁ! SOU O ASSISTENTE EXAMINUS
                </h2>
                
                {/* Subtítulo elegante */}
                <p className="text-muted-foreground text-sm mb-3 max-w-2xl mx-auto leading-snug animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                  Cole ou digite laudos de exames para <span className="font-semibold text-foreground">formatação automática inteligente</span>
                </p>

                {/* Cards de funcionalidades com hover effect */}
                <div className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto text-left animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                  <div className="group p-3 rounded-xl bg-gradient-to-br from-card via-card to-card/80 border border-border/50 shadow-md hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 transition-colors">
                        <span className="text-2xl">🧪</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-sm mb-0.5 text-foreground uppercase tracking-wide">
                          Exames Laboratoriais
                        </h3>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Hemograma, bioquímica, coagulograma e gasometria formatados em <span className="font-medium text-foreground">linha única compacta</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="group p-3 rounded-xl bg-gradient-to-br from-card via-card to-card/80 border border-border/50 shadow-md hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 transition-colors">
                        <span className="text-2xl">🖼️</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-sm mb-0.5 text-foreground uppercase tracking-wide">
                          Exames de Imagem
                        </h3>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          TC, RX, US e RM com extração de <span className="font-medium text-foreground">apenas achados anormais</span> relevantes
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Indicador sutil */}
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] text-muted-foreground animate-in fade-in duration-1000 delay-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="uppercase tracking-wide">Pronto para ajudar</span>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
              >
                <div
                  className={`group relative max-w-[85%] rounded-2xl px-5 py-4 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-card border border-border shadow-sm"
                  }`}
                >
                  <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
                    {message.content}
                  </pre>
                  {message.role === "assistant" && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(message.content, index)}
                        title="Copiar"
                      >
                        {copiedIndex === index ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-xs font-bold"
                        onClick={() => copyUppercaseToClipboard(message.content, index)}
                        title="Copiar em Caixa Alta"
                      >
                        ABC
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-card border border-border rounded-2xl px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Formatando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t bg-card/50 backdrop-blur-sm shadow-lg">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-2 py-2">
            {/* File Preview */}
            {selectedFile && (
              <div className="mb-1.5 p-1.5 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                  <div>
                    <p className="font-medium text-[10px]">{selectedFile.name}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                  className="h-6 w-6"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Toggles de inteligência clínica */}
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setUsePipeSeparator((v) => !v)}
                title="Separar parâmetros com barra ( | )"
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2 rounded-full border text-[10px] uppercase tracking-wide transition-colors",
                  usePipeSeparator
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <SeparatorVertical className="h-3 w-3" />
                Pipe
              </button>
              <button
                type="button"
                onClick={() => setIncludeTime((v) => !v)}
                title="Incluir horário HH:MM após a data"
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2 rounded-full border text-[10px] uppercase tracking-wide transition-colors",
                  includeTime
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Clock className="h-3 w-3" />
                Horário
              </button>
              <button
                type="button"
                onClick={() => setOnlyAltered((v) => !v)}
                title="Exibir somente resultados alterados (↑ ↓)"
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2 rounded-full border text-[10px] uppercase tracking-wide transition-colors",
                  onlyAltered
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                Alterados
              </button>
              <button
                type="button"
                onClick={() => setClinicalImpression((v) => !v)}
                title="Adicionar seção de Impressão Clínica após os exames"
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2 rounded-full border text-[10px] uppercase tracking-wide transition-colors",
                  clinicalImpression
                    ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Stethoscope className="h-3 w-3" />
                Impressão
              </button>
            </div>

            <div className="flex gap-1.5">
              <div className="flex-1 space-y-0.5">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={selectedFile ? "Mensagem opcional..." : "Cole o laudo do exame ou anexe PDF/imagem..."}
                  className="min-h-[50px] max-h-[150px] resize-none text-xs font-mono shadow-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={isLoading}
                />
              </div>
              
              <div className="flex flex-col gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-[28px] w-[28px]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Anexar PDF ou imagem"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  className="h-[28px] w-[28px]"
                  disabled={(!input.trim() && !selectedFile) || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5 text-center">
              Shift + Enter para nova linha • Enter para enviar • PDF máximo 20MB
            </p>
          </form>
        </div>
    </div>
  );
}

