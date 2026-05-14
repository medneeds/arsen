import * as React from "react";
import DOMPurify from "dompurify";
import { Bold, Italic, Underline as UnderlineIcon, List, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RichTextEditor — editor leve baseado em contentEditable com toolbar B/I/U/Lista.
 * - Enter cria parágrafo (<p>) por padrão do navegador.
 * - Shift+Enter cria quebra simples (<br>).
 * - Saída: HTML sanitizado (DOMPurify) — apenas tags inline básicas + <p>, <br>, <ul>, <ol>, <li>.
 * - Aceita valor legado em texto puro: converte \n\n em <p>, \n em <br>.
 */

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "span", "div"];
const ALLOWED_ATTR: string[] = [];

export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

/** Converte texto legado (sem HTML) em parágrafos HTML, ou retorna HTML sanitizado. */
export function toRichHtml(value: string | null | undefined): string {
  if (!value) return "";
  const v = String(value);
  if (/<\/?(p|br|strong|em|u|ul|ol|li|b|i)[\s>/]/i.test(v)) {
    return sanitizeRichHtml(v);
  }
  // texto puro
  const escaped = v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Extrai texto puro (para validações de tamanho mínimo, busca etc.). */
export function richHtmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = sanitizeRichHtml(html);
  return (tmp.textContent || "").trim();
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 140,
  autoFocus,
  disabled,
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const lastEmittedRaw = React.useRef<string>("");
  const [empty, setEmpty] = React.useState(true);

  // Sync external value -> editor.
  // Importante: só re-sincroniza quando o `value` recebido é DIFERENTE do que
  // acabamos de emitir. Caso contrário, o re-render do pai reescreve o
  // innerHTML a cada tecla (sanitize/toRichHtml normalizam o HTML e geram
  // strings diferentes), causando "retração" do conteúdo e perda do cursor.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastEmittedRaw.current) {
      setEmpty(!(el.textContent || "").trim());
      return;
    }
    const incoming = toRichHtml(value);
    if (incoming !== el.innerHTML) {
      el.innerHTML = incoming;
    }
    lastEmittedRaw.current = value ?? "";
    setEmpty(!(el.textContent || "").trim());
  }, [value]);

  React.useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const exec = (cmd: "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "removeFormat") => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(cmd, false);
    handleInput();
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeRichHtml(el.innerHTML);
    lastEmittedRaw.current = clean;
    setEmpty(!(el.textContent || "").trim());
    onChange(clean);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Cola sempre como texto puro para evitar herdar estilos/cores externas
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    document.execCommand("insertText", false, text);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    // Atalhos
    const meta = e.ctrlKey || e.metaKey;
    if (meta && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); exec("bold"); return; }
      if (k === "i") { e.preventDefault(); exec("italic"); return; }
      if (k === "u") { e.preventDefault(); exec("underline"); return; }
    }
  };

  const BtnIcon = ({ cmd, Icon, label }: { cmd: any; Icon: any; label: string }) => (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
      title={label}
      aria-label={label}
      disabled={disabled}
      className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className={cn("rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0", className)}>
      <div className="flex items-center gap-0.5 border-b border-border/60 bg-muted/30 px-1.5 py-1">
        <BtnIcon cmd="bold" Icon={Bold} label="Negrito (Ctrl+B)" />
        <BtnIcon cmd="italic" Icon={Italic} label="Itálico (Ctrl+I)" />
        <BtnIcon cmd="underline" Icon={UnderlineIcon} label="Sublinhado (Ctrl+U)" />
        <span className="mx-1 h-4 w-px bg-border/60" />
        <BtnIcon cmd="insertUnorderedList" Icon={List} label="Lista" />
        <span className="ml-auto" />
        <BtnIcon cmd="removeFormat" Icon={RotateCcw} label="Limpar formatação" />
      </div>
      <div className="relative">
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-placeholder={placeholder}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKey}
          onBlur={handleInput}
          className={cn(
            "prose prose-sm max-w-none px-3 py-2 text-sm outline-none",
            "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
            "[&_strong]:font-semibold [&_em]:italic [&_u]:underline",
            disabled && "opacity-60 cursor-not-allowed"
          )}
          style={{ minHeight }}
        />
        {empty && placeholder && (
          <div
            className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground/60 select-none"
            aria-hidden
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
