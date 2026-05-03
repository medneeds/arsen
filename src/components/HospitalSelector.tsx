import { useState, useEffect, useMemo } from "react";
import { Search, Hospital as HospitalIcon, MapPin, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Hospital {
  id: string;
  name: string;
  state_id: string;
  address: string | null;
  state_name?: string;
  state_abbreviation?: string;
}

interface HospitalSelectorProps {
  selectedHospitalId: string | null;
  onSelect: (hospital: Hospital) => void;
  className?: string;
}

export function HospitalSelector({ selectedHospitalId, onSelect, className }: HospitalSelectorProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const { data: hospitalsData } = await supabase
          .from("hospital_units")
          .select("*")
          .order("name");

        const { data: statesData } = await supabase
          .from("states")
          .select("*");

        const enriched = (hospitalsData || []).map((h) => {
          const state = statesData?.find((s) => s.id === h.state_id);
          return {
            ...h,
            state_name: state?.name || "",
            state_abbreviation: state?.abbreviation || "",
          };
        });

        setHospitals(enriched);

        if (!selectedHospitalId && enriched.length > 0) {
          onSelect(enriched[0]);
        }
      } catch (err) {
        console.error("Error fetching hospitals:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHospitals();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return hospitals;
    const q = search.toLowerCase();
    return hospitals.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.state_name?.toLowerCase().includes(q) ||
        h.address?.toLowerCase().includes(q)
    );
  }, [hospitals, search]);

  const selected = hospitals.find((h) => h.id === selectedHospitalId);

  if (loading) {
    return (
      <div className={cn("animate-pulse bg-muted rounded-xl h-12", className)} />
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Click-outside overlay (must come BEFORE dropdown so dropdown sits on top) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => { setIsOpen(false); setSearch(""); }}
        />
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 min-h-[52px] bg-card border border-border rounded-xl hover:border-primary/40 hover:shadow-sm hover:shadow-primary/5 active:bg-muted/30 transition-all duration-200 text-left group"
      >
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 shrink-0 group-hover:from-primary/15 group-hover:to-primary/10 transition-colors">
          <HospitalIcon className="h-4 w-4 text-primary" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-muted-foreground tracking-[0.15em] leading-none mb-0.5">
            Unidade hospitalar
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {selected?.name || "Selecione um hospital"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl shadow-primary/10 z-[70] overflow-hidden"
          >
            {/* Search */}
            <div className="p-3 border-b border-border/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar hospital..."
                  className="w-full pl-9 pr-3 py-2.5 sm:py-2 text-base sm:text-sm bg-muted/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-[60vh] sm:max-h-[240px] overflow-y-auto py-1 overscroll-contain">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Nenhum hospital encontrado
                </p>
              ) : (
                filtered.map((hospital) => (
                  <button
                    key={hospital.id}
                    type="button"
                    onMouseDown={(e) => {
                      // Prevent overlay from intercepting before click fires on mobile
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect(hospital);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left hover:bg-primary/5 active:bg-primary/10 transition-colors",
                      hospital.id === selectedHospitalId && "bg-primary/8"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        hospital.id === selectedHospitalId ? "text-primary" : "text-foreground"
                      )}>
                        {hospital.name}
                      </p>
                      {hospital.address && (
                        <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          {hospital.state_abbreviation} · {hospital.address}
                        </p>
                      )}
                    </div>
                    {hospital.id === selectedHospitalId && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
