import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileUp, ClipboardPaste, Sparkles, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExtractedPisData {
  patient_name?: string | null;
  mother_name?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  cpf?: string | null;
  cns?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  medical_record?: string | null;
}

interface PisImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (data: ExtractedPisData) => void;
}

// Limites coerentes com o teto de body do Edge Function (~6 MB JSON).
// Base64 cresce ~33%; reservamos folga para headers/JSON wrapping.
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB do arquivo bruto
const MAX_TEXT_CHARS = 60_000;

// Detecta mime real pela extensão quando o browser não preenche file.type
function inferMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "";
}

// Lê arquivo como base64 sem travar a UI (FileReader é assíncrono e nativo).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result vem como "data:<mime>;base64,XXXX" — extrai só o payload
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

// Extrai texto de PDF no browser usando pdfjs (já instalado).
async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  // Worker via CDN compatível com a versão instalada
  try {
    const workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch {}
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const out: string[] = [];
  const maxPages = Math.min(doc.numPages, 10); // PIS típico: 1-3 páginas
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    out.push(text);
  }
  return out.join("\n").replace(/\s+\n/g, "\n").trim();
}

export function PisImportDialog({ open, onOpenChange, onExtracted }: PisImportDialogProps) {
  const [tab, setTab] = useState<"file" | "text">("file");
  const [isExtracting, setIsExtracting] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPastedText("");
    setFileName(null);
    setDragActive(false);
    setTab("file");
  };

  const handleClose = () => {
    if (isExtracting) return;
    reset();
    onOpenChange(false);
  };

  const callExtract = async (body: { imageBase64?: string; mimeType?: string; rawText?: string }) => {
    setIsExtracting(true);
    try {
      const response = await supabase.functions.invoke("extract-patient-data", { body });
      // supabase-js não desempacota o body em respostas não-2xx → fazemos isso aqui
      if (response.error) {
        let serverMsg = response.error.message || "Falha desconhecida";
        const ctx: any = (response.error as any).context;
        try {
          if (ctx?.body) {
            const txt = typeof ctx.body === "string" ? ctx.body : await new Response(ctx.body).text();
            const parsed = JSON.parse(txt);
            if (parsed?.error) serverMsg = parsed.error;
          } else if (ctx?.json?.error) {
            serverMsg = ctx.json.error;
          }
        } catch {
          /* mantém serverMsg padrão */
        }
        throw new Error(serverMsg);
      }
      const data = response.data?.data;
      if (!data) throw new Error("Não foi possível extrair dados");
      onExtracted(data);
      toast.success("Dados importados do PIS", { description: "Revise os campos preenchidos pela IA" });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error("PIS import error:", err);
      toast.error("Falha ao importar do PIS", { description: err?.message || "Tente novamente" });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Arquivo muito grande", {
        description: `Máximo 4 MB (este tem ${(file.size / 1024 / 1024).toFixed(1)} MB). Tente reduzir a resolução ou colar o texto.`,
      });
      return;
    }
    const mime = inferMime(file);
    if (!mime) {
      toast.error("Tipo de arquivo não reconhecido", {
        description: "Use PDF, JPG, PNG ou WEBP.",
      });
      return;
    }
    setFileName(file.name);

    // PDF → extrai texto no client e envia como rawText (caminho mais confiável)
    if (mime === "application/pdf") {
      setIsExtracting(true);
      try {
        const text = await extractPdfText(file);
        setIsExtracting(false);
        if (text.length < 20) {
          toast.error("Não foi possível ler o texto do PDF", {
            description: "Pode ser um PDF escaneado/imagem. Tire uma foto/print da tela e anexe como JPG ou PNG.",
          });
          setFileName(null);
          return;
        }
        await callExtract({ rawText: text.slice(0, MAX_TEXT_CHARS) });
        return;
      } catch (e: any) {
        setIsExtracting(false);
        console.error("PDF parse error:", e);
        toast.error("Falha ao ler o PDF", { description: "Tente anexar como imagem (JPG/PNG)." });
        setFileName(null);
        return;
      }
    }

    // Imagem → base64 via FileReader (não trava UI)
    try {
      const base64 = await fileToBase64(file);
      await callExtract({ imageBase64: base64, mimeType: mime });
    } catch (e: any) {
      console.error("File read error:", e);
      toast.error("Falha ao ler arquivo", { description: e?.message || "Tente novamente" });
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const handleSubmitText = () => {
    const trimmed = pastedText.trim();
    if (trimmed.length < 20) {
      toast.error("Texto muito curto", { description: "Cole pelo menos um trecho com nome, data e CPF" });
      return;
    }
    callExtract({ rawText: trimmed.slice(0, MAX_TEXT_CHARS) });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Importar do PIS
          </DialogTitle>
          <DialogDescription className="text-xs">
            Anexe o PDF/imagem do sistema PIS ou cole o texto bruto. A IA preenche os campos do cadastro automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "file" | "text")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="text-xs gap-1.5">
              <FileUp className="h-3.5 w-3.5" /> Arquivo (PDF/Imagem)
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs gap-1.5">
              <ClipboardPaste className="h-3.5 w-3.5" /> Colar texto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => !isExtracting && inputRef.current?.click()}
              className={cn(
                "rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
                dragActive ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50 hover:bg-muted/40",
                isExtracting && "pointer-events-none opacity-60"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {isExtracting ? (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  Extraindo dados com IA…
                </div>
              ) : fileName ? (
                <div className="flex flex-col items-center gap-1 text-sm">
                  <FileText className="h-6 w-6 text-primary" />
                  <span className="font-medium truncate max-w-full">{fileName}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-sm text-muted-foreground">
                  <Upload className="h-6 w-6 text-primary/70" />
                  <span><strong className="text-foreground">Arraste</strong> o arquivo aqui ou <strong className="text-foreground">clique</strong> para selecionar</span>
                  <span className="text-[11px]">PDF, JPG, PNG ou WEBP · até 4 MB</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="text" className="mt-3 space-y-2">
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Cole aqui o texto do PIS (ex.: copiou do PDF, da tela ou de um print convertido em texto). A IA extrai nome, CPF, CNS, data de nascimento, mãe, endereço…"
              rows={10}
              className="text-xs font-mono"
              disabled={isExtracting}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{pastedText.length} caracteres</span>
              <Button size="sm" onClick={handleSubmitText} disabled={isExtracting || pastedText.trim().length < 20} className="h-8">
                {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                Extrair com IA
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isExtracting}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
