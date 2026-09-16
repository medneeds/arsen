import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, HelpCircle, ArrowLeft, Home as HomeIcon } from "lucide-react";
import { FAQ_ENTRIES, FAQ_CATEGORY_ORDER, type FaqEntry, type SlideTone } from "@/data/faqContent";
import { HelpSlideshowDialog } from "@/components/help/HelpSlideshowDialog";
import { cn } from "@/lib/utils";

const TONE_BG: Record<SlideTone, string> = {
  neutral: "bg-primary/10 text-foreground border-border/20",
  info: "bg-primary/10 text-foreground border-border/20",
  warning: "bg-warning/10 text-warning-on-soft border-warning/20",
  success: "bg-released/10 text-released-on-soft border-released/20",
  danger: "bg-critical/10 text-critical-on-soft border-critical/20",
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
    <div className="container max-w-6xl mx-auto px-4 py-6 md:py-8">
      {/* Back / Home bar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <HomeIcon className="h-4 w-4" />
          Início
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="h-12 w-12 rounded-lg bg-primary/10 grid place-items-center flex-shrink-0">
          <HelpCircle className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold leading-tight">Dúvidas Frequentes</h1>
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
          className="pl-8"
        />
      </div>

      {/* Grupos por categoria */}
      {FAQ_CATEGORY_ORDER.map((cat) => {
        const items = filtered.filter((e) => e.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {cat}
              </h2>
              <span className="text-xs text-muted-foreground/70">({items.length})</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setActive(entry)}
                    className={cn(
                      "group text-left rounded-lg border bg-card hover:bg-card/80 p-4 transition-all duration-200",
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
                        <div className="font-medium text-sm leading-tight">{entry.title}</div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.short}</p>
                        <div className="text-xs text-muted-foreground mt-2 uppercase tracking-wider font-medium">
                          {entry.slides.length} slides
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
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
