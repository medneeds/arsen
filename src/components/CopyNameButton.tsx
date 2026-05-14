import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CopyNameButtonProps {
  value?: string;
  className?: string;
  label?: string;
}

/**
 * Discreet copy-to-clipboard icon, intended to sit next to a patient
 * name in subsection headers. Stays muted by default and only reveals
 * a confirmation tick on success.
 */
export function CopyNameButton({ value, className, label = "Copiar nome do paciente" }: CopyNameButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!value || !value.trim()) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Nome copiado", { description: value });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded",
        "text-muted-foreground/60 hover:text-foreground hover:bg-muted/60",
        "opacity-70 hover:opacity-100 transition-all print:hidden",
        className,
      )}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
