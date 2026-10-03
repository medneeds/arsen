import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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
  /* campos normalizados uma unica vez no carregamento (filtro barato, sem NFD por tecla) */
  ncode: string;
  ndesc: string;
  ncat: string;
}

/* Teto de itens renderizados no dropdown. O catalogo tem ~14 mil CIDs;
   renderizar tudo trava o navegador, entao mostramos no maximo este tanto. */
const MAX_RESULTS = 60;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ---------------------------------------------------------------------------
   Cache do catalogo de CID.
   - CATALOG_CACHE: memoria (por aba), compartilhado entre instancias.
   - IndexedDB: persiste entre recargas/F5 e entre sessoes no mesmo aparelho,
     validado pela contagem de linhas da tabela. Assim a tela so baixa os ~14k
     codigos UMA vez por aparelho (ou quando a tabela muda), em vez de a cada
     carga. Toda operacao de IDB falha de forma silenciosa e cai para a rede;
     a busca continua client-side (acento-insensivel via normalize).
--------------------------------------------------------------------------- */
let CATALOG_CACHE: CidCode[] | null = null;
let CATALOG_PROMISE: Promise<CidCode[]> | null = null;

const IDB_NAME = "arsen-cid-cache";
const IDB_STORE = "kv";
const IDB_KEY = "cid10_catalog_v1";

interface CachedCatalog { count: number; rows: CidCode[]; }

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<CachedCatalog | null> {
  try {
    const db = await idbOpen();
    return await new Promise<CachedCatalog | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const r = tx.objectStore(IDB_STORE).get(key);
      r.onsuccess = () => resolve((r.result as CachedCatalog) ?? null);
      r.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function idbSet(key: string, val: CachedCatalog): Promise<void> {
  try {
    const db = await idbOpen();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* cache best-effort: ignora falha de escrita */ }
}

async function fetchAllFromServer(): Promise<CidCode[]> {
  const all: CidCode[] = [];
  const PAGE = 1000;
  let from = 0;
  // paginado para passar do limite padrao de 1000 linhas por resposta
  while (true) {
    // Tabela dedicada `cid10_codes`. A "categoria" de exibicao usa capitulo
    // (capitulo CID) quando presente, senao categoria.
    const { data, error } = await supabase
      .from("cid10_codes")
      .select("codigo, descricao, categoria, capitulo")
      .order("codigo")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data.map((r: { codigo: string | null; descricao: string | null; categoria: string | null; capitulo: string | null }) => {
      const code = r.codigo ?? "";
      const description = r.descricao ?? "";
      const category = r.capitulo ?? r.categoria ?? "";
      return { code, description, category, ncode: normalize(code), ndesc: normalize(description), ncat: normalize(category) };
    }) as CidCode[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function loadCatalog(): Promise<CidCode[]> {
  if (CATALOG_CACHE) return Promise.resolve(CATALOG_CACHE);
  if (CATALOG_PROMISE) return CATALOG_PROMISE;
  CATALOG_PROMISE = (async () => {
    // 1. Contagem viva da tabela (query leve, head) para validar o cache local.
    let liveCount: number | null = null;
    try {
      const { count } = await supabase
        .from("cid10_codes")
        .select("*", { count: "exact", head: true });
      liveCount = typeof count === "number" ? count : null;
    } catch { liveCount = null; }

    // 2. Cache local: usa se a contagem bater (ou se a rede nao respondeu a contagem).
    const cached = await idbGet(IDB_KEY);
    if (cached?.rows?.length && (liveCount === null || cached.count === liveCount)) {
      CATALOG_CACHE = cached.rows;
      return cached.rows;
    }

    // 3. Baixa tudo e repovoa o cache local.
    const all = await fetchAllFromServer();
    CATALOG_CACHE = all;
    if (all.length) void idbSet(IDB_KEY, { count: liveCount ?? all.length, rows: all });
    return all;
  })();
  return CATALOG_PROMISE;
}

export function CidSearchInput({
  value, onChange, placeholder, className,
}: CidSearchInputProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [catalog, setCatalog] = useState<CidCode[]>(CATALOG_CACHE ?? []);
  const [isLoading, setIsLoading] = useState(!CATALOG_CACHE);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  /* Posicao do dropdown: renderizado em portal no body (posicao fixa) para
     escapar do overflow-hidden do AccordionContent, que recortava a lista. */
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedCode = value ? value.split(" - ")[0] : "";
  const selectedDesc = value ? value.substring(value.indexOf(" - ") + 3) : "";

  const updateMenuRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  /* Carrega catálogo uma vez */
  useEffect(() => {
    if (CATALOG_CACHE) return;
    let mounted = true;
    loadCatalog()
      .then(rows => { if (mounted) { setCatalog(rows); setIsLoading(false); } })
      .catch(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  /* Fecha ao clicar fora (considera tambem o dropdown em portal) */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Recalcula a posicao do dropdown enquanto aberto (scroll/resize do dialog) */
  useEffect(() => {
    if (!(isOpen && !value)) return;
    updateMenuRect();
    const onMove = () => updateMenuRect();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [isOpen, value, updateMenuRect]);

  /* Filtra sobre campos pre-normalizados (includes barato, sem NFD por tecla) */
  const matches = useMemo(() => {
    if (!catalog.length) return [];
    const q = normalize(search.trim());
    if (!q) return catalog;
    return catalog.filter(c =>
      c.ncode.includes(q) || c.ndesc.includes(q) || c.ncat.includes(q)
    );
  }, [catalog, search]);

  /* Teto de render: nunca despejar os ~14 mil no DOM (trava o navegador) */
  const visible = useMemo(() => matches.slice(0, MAX_RESULTS), [matches]);
  const hiddenCount = matches.length - visible.length;

  /* Agrupa por categoria preservando ordem (sobre o conjunto ja limitado) */
  const grouped = useMemo(() => {
    const map = new Map<string, CidCode[]>();
    for (const item of visible) {
      const key = item.category || "Outros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [visible]);

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
            onKeyDown={e => {
              if (e.key === "Enter" && search.trim()) {
                const nq = normalize(search.trim());
                const exact = catalog.find(c => c.ncode === nq);
                if (exact) {
                  handleSelect(exact);
                } else {
                  // Tenta buscar pelo início do código (ex: "I10" → "I10 - Hipertensão...")
                  const partial = catalog.find(c => c.ncode.startsWith(nq));
                  if (partial) {
                    handleSelect(partial);
                  }
                  // Se não encontrar no catálogo, não salva — exige seleção do dropdown
                }
                e.preventDefault();
              }
              if (e.key === "Escape") setIsOpen(false);
            }}
            onBlur={() => {
              // Ao sair do campo: tenta encontrar no catálogo antes de salvar
              setTimeout(() => {
                if (search.trim() && !value) {
                  const nq = normalize(search.trim());
                  const exact = catalog.find(c => c.ncode === nq);
                  if (exact) {
                    handleSelect(exact);
                  } else {
                    setSearch(""); // descarta texto que não está no catálogo
                  }
                }
              }, 200);
            }}
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

      {isOpen && !value && menuRect && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: menuRect.top, left: menuRect.left, width: menuRect.width, zIndex: 9999 }}
          className="bg-popover border rounded-md shadow-md overflow-hidden"
        >
          <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground bg-muted/40 border-b flex items-center justify-between">
            <span>{search ? `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'}` : `${catalog.length} CIDs disponíveis`}</span>
            <span className="font-normal">{hiddenCount > 0 ? `mostrando ${MAX_RESULTS} — refine a busca` : 'Role ou digite'}</span>
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
                <div className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground bg-muted sticky top-0">
                  {cat}
                </div>
                {items.map(item => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-start gap-2 border-b last:border-b-0"
                  >
                    <Badge variant="outline" className="shrink-0 font-mono text-xs mt-1">
                      {item.code}
                    </Badge>
                    <span className="text-xs leading-snug">{item.description}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
