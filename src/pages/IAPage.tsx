import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Send, Sparkles, Loader2, Copy, Check, FileText, X,
  SeparatorVertical, Clock, AlertTriangle, Stethoscope,
  Minimize2, CaseUpper, CaseSensitive, Paperclip, Trash2, Eraser,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function IAPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Toggles de inteligência clínica
  const [usePipeSeparator, setUsePipeSeparator] = useState(false);
  const [includeTime, setIncludeTime] = useState(true);
  const [onlyAltered, setOnlyAltered] = useState(false);
  const [clinicalImpression, setClinicalImpression] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  // Controle de caixa do INPUT (transforma o que você digita/cola)
  const [inputUppercase, setInputUppercase] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const scrollToEnd = () => {
      const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    };
    scrollToEnd();
    const t1 = setTimeout(scrollToEnd, 50);
    const t2 = setTimeout(scrollToEnd, 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [messages, isLoading]);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const copyToClipboard = async (text: string, key: string, upper = false) => {
    try {
      await navigator.clipboard.writeText(upper ? text.toUpperCase() : text);
      setCopiedIndex(key);
      setTimeout(() => setCopiedIndex(null), 1800);
      toast.success(upper ? "Copiado em CAIXA ALTA" : "Copiado");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((it: any) => it.str).join(" ") + "\n";
    }
    return fullText;
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      toast.error("Apenas PDFs e imagens são aceitos"); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 20MB"); return;
    }
    setSelectedFile(file);
    if (file.type.includes("image")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else setFilePreview(null);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearConversation = () => {
    setMessages([]);
    setInput("");
    removeFile();
    toast.success("Conversa limpa");
  };

  const streamChat = async (userMessage: string, file?: File) => {
    setIsLoading(true);
    let fileContent = null;
    let finalUserMessage = userMessage || "Extraia e formate este exame:";

    if (file) {
      try {
        if (file.type.includes("pdf")) {
          finalUserMessage = await extractTextFromPDF(file);
        } else if (file.type.includes("image")) {
          const reader = new FileReader();
          fileContent = await new Promise<string>((resolve) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        }
      } catch {
        toast.error("Erro ao processar arquivo");
        setIsLoading(false); return;
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
            compactMode,
          }),
        }
      );

      if (response.status === 429) { toast.error("Limite de requisições excedido."); setMessages(messages); return; }
      if (response.status === 402) { toast.error("Créditos de IA esgotados."); setMessages(messages); return; }
      if (!response.ok || !response.body) throw new Error("Falha ao iniciar stream");

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
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
            }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }
    } catch {
      toast.error("Erro ao processar mensagem.");
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

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) {
      if (window.history.length > 1) navigate(-1);
      else navigate("/");
    }
  };

  // Botão da toolbar lateral
  const ToolBtn = ({
    label, hint, icon: Icon, active, onClick, tone = "primary",
  }: {
    label: string; hint: string; icon: any; active?: boolean; onClick: () => void;
    tone?: "primary" | "amber" | "blue" | "neutral" | "danger";
  }) => {
    const toneActive: Record<string, string> = {
      primary: "bg-primary/15 border-primary/40 text-primary",
      amber: "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400",
      blue: "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400",
      neutral: "bg-foreground/10 border-foreground/30 text-foreground",
      danger: "bg-destructive/15 border-destructive/40 text-destructive",
    };
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "group relative flex flex-col items-center gap-0.5 w-full py-2 rounded-lg border text-[9px] uppercase tracking-wide transition-all",
              active
                ? toneActive[tone]
                : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="leading-none">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px] text-xs">
          {hint}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 gap-0 max-w-5xl w-[94vw] h-[90vh] flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <TooltipProvider>
          {/* Header */}
          <div className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-md shadow-primary/20">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground uppercase leading-none">Assistente Examinus</h1>
                <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Formatador inteligente de exames</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearConversation} className="h-8 text-[11px] uppercase">
                  <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Body: sidebar (esquerda) + conteúdo */}
          <div className="flex-1 flex min-h-0">
            {/* Toolbar lateral esquerda */}
            <aside className="w-[72px] shrink-0 border-r bg-muted/30 px-2 py-2.5 flex flex-col gap-1.5 overflow-y-auto">
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground/70 text-center mb-0.5">Saída IA</p>
              <ToolBtn
                label="Pipe" hint="Separar parâmetros com barra ( | ) em vez de espaço"
                icon={SeparatorVertical} active={usePipeSeparator}
                onClick={() => setUsePipeSeparator(v => !v)}
              />
              <ToolBtn
                label="Hora" hint="Incluir HH:MM após a data DD/MM"
                icon={Clock} active={includeTime}
                onClick={() => setIncludeTime(v => !v)}
              />
              <ToolBtn
                label="Alter." hint="Mostrar SOMENTE resultados alterados (↑↓)"
                icon={AlertTriangle} active={onlyAltered} tone="amber"
                onClick={() => setOnlyAltered(v => !v)}
              />
              <ToolBtn
                label="Impr." hint="Adicionar Impressão Clínica ao final"
                icon={Stethoscope} active={clinicalImpression} tone="blue"
                onClick={() => setClinicalImpression(v => !v)}
              />
              <ToolBtn
                label="Compac." hint="Modo compacto: máxima densidade, abreviações e sem quebras desnecessárias"
                icon={Minimize2} active={compactMode} tone="neutral"
                onClick={() => setCompactMode(v => !v)}
              />

              <div className="h-px bg-border my-1" />
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground/70 text-center mb-0.5">Entrada</p>
              <ToolBtn
                label={inputUppercase ? "ABC" : "Abc"}
                hint={inputUppercase ? "Entrada em CAIXA ALTA — desativar para texto normal" : "Forçar texto digitado/colado em CAIXA ALTA"}
                icon={inputUppercase ? CaseUpper : CaseSensitive}
                active={inputUppercase}
                onClick={() => setInputUppercase(v => !v)}
              />
              <ToolBtn
                label="Anexo" hint="Anexar PDF ou imagem (até 20MB)"
                icon={Paperclip}
                active={!!selectedFile}
                onClick={() => fileInputRef.current?.click()}
              />
            </aside>

            {/* Coluna principal */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Mensagens */}
              <ScrollArea className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-4 space-y-4" ref={scrollRef}>
                  {messages.length === 0 && (
                    <div className="text-center py-6 px-2">
                      <div className="relative inline-block mb-3">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/20 to-transparent rounded-full blur-xl animate-pulse" />
                        <div className="relative inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-primary via-primary/90 to-primary/70 shadow-xl shadow-primary/20 border border-primary/20">
                          <Sparkles className="h-9 w-9 text-primary-foreground" />
                        </div>
                      </div>
                      <h2 className="text-lg font-bold mb-1 uppercase">Olá! Sou o Examinus</h2>
                      <p className="text-muted-foreground text-xs mb-4 max-w-xl mx-auto">
                        Cole laudos, anexe PDFs ou imagens. Configure os toggles ao lado para personalizar a saída.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto text-left">
                        <div className="p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-xl">🧪</span>
                            <div>
                              <h3 className="font-bold text-xs mb-0.5 uppercase">Laboratoriais</h3>
                              <p className="text-[10px] text-muted-foreground leading-snug">
                                Hemograma, bioquímica, gaso e cultura em linha única compacta
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-xl">🖼️</span>
                            <div>
                              <h3 className="font-bold text-xs mb-0.5 uppercase">Imagem</h3>
                              <p className="text-[10px] text-muted-foreground leading-snug">
                                TC, RX, US e RM com extração apenas dos achados anormais
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex animate-in fade-in slide-in-from-bottom-2 duration-300",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "group relative max-w-[92%] rounded-2xl px-4 py-3 shadow-sm",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border"
                        )}
                      >
                        <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed">
                          {message.content}
                        </pre>
                        {message.role === "assistant" && (
                          <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="secondary" size="sm"
                              className="h-7 px-2 text-[10px] uppercase shadow-md"
                              onClick={() => copyToClipboard(message.content, `n-${index}`)}
                            >
                              {copiedIndex === `n-${index}` ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                              Copiar
                            </Button>
                            <Button
                              variant="secondary" size="sm"
                              className="h-7 px-2 text-[10px] uppercase shadow-md"
                              onClick={() => copyToClipboard(message.content, `u-${index}`, true)}
                            >
                              {copiedIndex === `u-${index}` ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <CaseUpper className="h-3 w-3 mr-1" />}
                              CX. Alta
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground uppercase">Formatando…</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t bg-card/40 backdrop-blur-sm">
                <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-2.5">
                  {selectedFile && (
                    <div className="mb-2 p-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {filePreview ? (
                          <img src={filePreview} alt="Preview" className="h-9 w-9 rounded object-cover" />
                        ) : (
                          <FileText className="h-7 w-7 text-primary" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-[11px] truncate max-w-[260px]">{selectedFile.name}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={removeFile} className="h-7 w-7">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    className="hidden"
                  />

                  <div className="relative flex items-end gap-2">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => {
                        const v = e.target.value;
                        setInput(inputUppercase ? v.toUpperCase() : v);
                      }}
                      onPaste={(e) => {
                        if (!inputUppercase) return;
                        e.preventDefault();
                        const text = e.clipboardData.getData("text");
                        const target = e.currentTarget;
                        const start = target.selectionStart ?? input.length;
                        const end = target.selectionEnd ?? input.length;
                        const next = input.slice(0, start) + text.toUpperCase() + input.slice(end);
                        setInput(next);
                      }}
                      placeholder={selectedFile ? "Mensagem opcional…" : "Cole o laudo do exame, ou anexe PDF/imagem pelo botão lateral…"}
                      className={cn(
                        "min-h-[72px] max-h-[220px] resize-y text-[12.5px] font-mono shadow-sm pr-12",
                        inputUppercase && "uppercase"
                      )}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="h-10 w-10 shrink-0 shadow-md"
                      disabled={(!input.trim() && !selectedFile) || isLoading}
                      title="Enviar (Enter)"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1 text-center uppercase tracking-wide">
                    Enter envia • Shift+Enter quebra linha • PDF até 20MB • Toggles de saída na lateral esquerda
                  </p>
                </form>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
