import React, { useState, useRef } from "react";
import { FileText, ImageIcon, Upload, X, Loader2, File, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ResultFile {
  name: string;
  url: string;
  type: "image" | "pdf";
  size?: number;
}

interface ExamResultInputProps {
  resultText: string;
  onResultTextChange: (text: string) => void;
  resultFiles: ResultFile[];
  onResultFilesChange: (files: ResultFile[]) => void;
  readOnly?: boolean;
  requestId: string;
}

const ExamResultInput: React.FC<ExamResultInputProps> = ({
  resultText,
  onResultTextChange,
  resultFiles,
  onResultFilesChange,
  readOnly = false,
  requestId,
}) => {
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File, fileType: "image" | "pdf") => {
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB");
      return;
    }

    setUploading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      const userId = authData.user.id;
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      // RLS exige primeiro segmento da pasta == auth.uid()
      const filePath = `${userId}/${requestId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("exam-results")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Bucket privado: usa URL assinada (válida por 7 dias)
      const { data: urlData, error: urlErr } = await supabase.storage
        .from("exam-results")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (urlErr || !urlData) throw urlErr ?? new Error("Falha ao gerar URL");

      const newFile: ResultFile = {
        name: file.name,
        url: urlData.signedUrl,
        type: fileType,
        size: file.size,
      };

      onResultFilesChange([...resultFiles, newFile]);
      toast.success(`${fileType === "image" ? "Imagem" : "PDF"} anexado com sucesso`);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = resultFiles.filter((_, i) => i !== index);
    onResultFilesChange(updated);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
        Resultado / Laudo
      </p>

      {/* Text input */}
      <Textarea
        value={resultText}
        onChange={(e) => onResultTextChange(e.target.value)}
        placeholder="Descreva o resultado ou laudo do exame..."
        rows={4}
        readOnly={readOnly}
        className={cn("text-sm", readOnly && "bg-muted/30")}
      />

      {/* Upload buttons */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5 text-xs"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Anexar Imagem
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => pdfInputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5 text-xs"
          >
            <FileText className="h-3.5 w-3.5" />
            Anexar PDF
          </Button>
          {uploading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Enviando...
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, "pdf");
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Attached files list */}
      {resultFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Arquivos Anexados ({resultFiles.length})
          </p>
          <div className="space-y-1.5">
            {resultFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg border bg-background text-xs group"
              >
                {file.type === "image" ? (
                  <div className="h-10 w-10 rounded border overflow-hidden shrink-0 bg-muted">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded border flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-500/10">
                    <File className="h-5 w-5 text-red-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {file.type === "image" ? "IMAGEM" : "PDF"}
                    </Badge>
                    {file.size && <span>{formatFileSize(file.size)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(file.url, "_blank")}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveFile(idx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamResultInput;
