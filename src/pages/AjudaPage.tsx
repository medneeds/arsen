import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, HelpCircle, ArrowLeft, Home as HomeIcon } from "lucide-react";
import { FAQ_ENTRIES, type FaqEntry, type SlideTone } from "@/data/faqContent";
import { HelpSlideshowDialog } from "@/components/help/HelpSlideshowDialog";
import { cn } from "@/lib/utils";

const TONE_BG: Record<SlideTone, string> = {
  neutral: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  danger: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
};

export default function AjudaPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<FaqEntry | null>(null);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return FAQ_ENTRIES;
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = norm(query);
    return FAQ_ENTRIES.filter((e) =>
      norm(e.title + " " + e.short + " " + e.slides.map((s) => s.title + " " + s.body).join(" ")).includes(q),
    );
  }, [query]);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 md:py-10">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center flex-shrink-0">
          <HelpCircle className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold leading-tight">Dúvidas Frequentes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guias didáticos sobre as operações mais comuns da plataforma. Clique em uma dúvida para abrir o passo a passo em slides.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por dúvida, ex: desalocar, transferência, alta…"
          className="pl-9"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setActive(entry)}
              className={cn(
                "group text-left rounded-xl border bg-card hover:bg-card/80 p-4 transition-all duration-200",
                "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg grid place-items-center flex-shrink-0 border transition-transform group-hover:scale-105",
                    TONE_BG[entry.tone],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-tight">{entry.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.short}</p>
                  <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider font-medium">
                    {entry.slides.length} slides
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12">
          Nenhuma dúvida encontrada para "{query}".
        </div>
      )}

      <HelpSlideshowDialog
        entry={active}
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
      />
    </div>
  );
}
