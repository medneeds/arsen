import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CidSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

interface CidCode {
  code: string;
  description: string;
  category: string;
}

/* Catálogo carregado uma única vez e compartilhado entre instâncias */
let CATALOG_CACHE: CidCode[] | null = null;
let CATALOG_PROMISE: Promise<CidCode[]> | null = null;

function loadCatalog(): Promise<CidCode[]> {
  if (CATALOG_CACHE) return Promise.resolve(CATALOG_CACHE);
  if (CATALOG_PROMISE) return CATALOG_PROMISE;
  CATALOG_PROMISE = (async () => {
    const all: CidCode[] = [];
    const PAGE = 1000;
    let from = 0;
    // paginate to bypass 1000-row default limit
    // (the table currently has ~255 rows but this is future-proof)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("cid10_codes")
        .select("code, description, category")
        .order("code")
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as CidCode[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    CATALOG_CACHE = all;
    return all;
  })();
  return CATALOG_PROMISE;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function CidSearchInput({
  value, onChange, placeholder, className,
}: CidSearchInputProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [catalog, setCatalog] = useState<CidCode[]>(CATALOG_CACHE ?? []);
  const [isLoading, setIsLoading] = useState(!CATALOG_CACHE);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedCode = value ? value.split(" - ")[0] : "";
  const selectedDesc = value ? value.substring(value.indexOf(" - ") + 3) : "";

  /* Carrega catálogo uma vez */
  useEffect(() => {
    if (CATALOG_CACHE) return;
    let mounted = true;
    loadCatalog()
      .then(rows => { if (mounted) { setCatalog(rows); setIsLoading(false); } })
      .catch(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  /* Fecha ao clicar fora */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Filtra (NFD + case-insensitive em código, descrição e categoria) */
  const filtered = useMemo(() => {
    if (!catalog.length) return [];
    const q = normalize(search.trim());
    if (!q) return catalog;
    return catalog.filter(c =>
      normalize(c.code).includes(q) ||
      normalize(c.description).includes(q) ||
      normalize(c.category).includes(q)
    );
  }, [catalog, search]);

  /* Agrupa por categoria preservando ordem */
  const grouped = useMemo(() => {
    const map = new Map<string, CidCode[]>();
    for (const item of filtered) {
      const key = item.category || "Outros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleSelect = (item: CidCode) => {
    onChange(`${item.code} - ${item.description}`);
    setSearch("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {value ? (
        <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 text-sm">
          <Badge variant="outline" className="shrink-0 font-mono text-xs">{selectedCode}</Badge>
          <span className="truncate text-xs">{selectedDesc}</span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remover CID"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            placeholder={placeholder || "Buscar CID-10 (código, descrição ou capítulo)..."}
            className="pl-8 pr-8 text-sm h-9"
          />
          <button
            type="button"
            onClick={() => setIsOpen(o => !o)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Abrir catálogo"
            tabIndex={-1}
          >
            {isLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />}
          </button>
        </div>
      )}

      {isOpen && !value && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40 border-b flex items-center justify-between">
            <span>{search ? `${filtered.length} resultado(s)` : `${catalog.length} CIDs disponíveis`}</span>
            <span className="font-normal">Role ou digite</span>
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto">
            {isLoading && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando catálogo...
              </div>
            )}

            {!isLoading && grouped.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhum CID encontrado{search ? ` para "${search}"` : ""}
              </div>
            )}

            {!isLoading && grouped.map(([cat, items]) => (
              <div key={cat}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 sticky top-0">
                  {cat}
                </div>
                {items.map(item => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-start gap-2 border-b last:border-b-0"
                  >
                    <Badge variant="outline" className="shrink-0 font-mono text-[10px] mt-0.5">
                      {item.code}
                    </Badge>
                    <span className="text-xs leading-snug">{item.description}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
