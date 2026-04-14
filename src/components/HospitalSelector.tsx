import { useState, useEffect, useMemo } from "react";
import { Search, Building2, MapPin, ChevronDown, Check } from "lucide-react";
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

        // Auto-select HMDM if nothing selected
        if (!selectedHospitalId && enriched.length > 0) {
          const hmdm = enriched.find((h) =>
            h.name.toLowerCase().includes("djalma marques") ||
            h.name.toLowerCase().includes("socorrão")
          );
          if (hmdm) onSelect(hmdm);
          else onSelect(enriched[0]);
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
      <div className={cn("animate-pulse bg-slate-100 rounded-xl h-12", className)} />
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all duration-200 text-left"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 shrink-0">
          <Building2 className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-slate-400 tracking-[0.15em] leading-none mb-0.5">
            Unidade hospitalar
          </p>
          <p className="text-sm font-semibold text-slate-800 truncate">
            {selected?.name || "Selecione um hospital"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180"
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
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 z-50 overflow-hidden"
          >
            {/* Search */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar hospital..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-[240px] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">
                  Nenhum hospital encontrado
                </p>
              ) : (
                filtered.map((hospital) => (
                  <button
                    key={hospital.id}
                    type="button"
                    onClick={() => {
                      onSelect(hospital);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50/50 transition-colors",
                      hospital.id === selectedHospitalId && "bg-blue-50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        hospital.id === selectedHospitalId ? "text-blue-700" : "text-slate-700"
                      )}>
                        {hospital.name}
                      </p>
                      {hospital.address && (
                        <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          {hospital.state_abbreviation} · {hospital.address}
                        </p>
                      )}
                    </div>
                    {hospital.id === selectedHospitalId && (
                      <Check className="h-4 w-4 text-blue-600 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-outside overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setIsOpen(false); setSearch(""); }}
        />
      )}
    </div>
  );
}
