import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, Loader2 } from "lucide-react";
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

export function CidSearchInput({ value, onChange, label, required, placeholder, className }: CidSearchInputProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CidCode[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Parse selected value to display
  const selectedCode = value ? value.split(" - ")[0] : "";
  const selectedDesc = value ? value.substring(value.indexOf(" - ") + 3) : "";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      // Normalize search term
      const normalized = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      
      const { data, error } = await supabase
        .from("cid10_codes")
        .select("code, description, category")
        .or(`code.ilike.%${normalized}%,description.ilike.%${normalized}%`)
        .order("code")
        .limit(15);

      if (error) throw error;
      setResults((data as CidCode[]) || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (term: string) => {
    setSearch(term);
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(term), 300);
  };

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
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {selectedCode}
          </Badge>
          <span className="truncate text-xs">{selectedDesc}</span>
          <button onClick={handleClear} className="ml-auto shrink-0 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => search.length >= 2 && setIsOpen(true)}
            placeholder={placeholder || "Buscar CID-10 (código ou descrição)..."}
            className="pl-8 text-sm h-9"
          />
          {isLoading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {results.map(item => (
            <button
              key={item.code}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-start gap-2 border-b last:border-b-0"
            >
              <Badge variant="outline" className="shrink-0 font-mono text-[10px] mt-0.5">
                {item.code}
              </Badge>
              <div className="min-w-0">
                <p className="text-xs truncate">{item.description}</p>
                <p className="text-[10px] text-muted-foreground">{item.category}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && search.length >= 2 && !isLoading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-center text-xs text-muted-foreground">
          Nenhum CID encontrado para "{search}"
        </div>
      )}
    </div>
  );
}
