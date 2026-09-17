import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, X, BedDouble, ArrowRight, FileSearch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { SECTOR_DISPLAY, SECTOR_TO_DEPARTMENT, type Department } from "@/contexts/DepartmentContext";
import { formatBedDisplay } from "@/utils/bedNaming";

interface PacienteEncontrado {
  id: string;
  name: string;
  bedNumber: string;
  sectorCode: string;
  sectorLabel: string;
  department: Department;
  medicalRecord: string | null;
  age: string | null;
}

/**
 * Busca compacta de paciente na sidebar — mesma lógica do PatientQuickSearch
 * da tela inicial, adaptada para o espaço estreito da sidebar.
 * Busca pacientes internados (leitos ocupados) em todo o hospital.
 */
export function SidebarPatientSearch({
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PacienteEncontrado[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [open, setOpen] = useState(false);
  const { currentHospital, currentState } = useHospital();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pedidoRef = useRef(0);

  const termoLimpo = termo.trim();
  const ativo = termoLimpo.length >= 3;

  // Busca com debounce 350ms — igual ao PatientQuickSearch
  useEffect(() => {
    if (!ativo || !currentHospital || !currentState) {
      setResultados([]);
      setBuscou(false);
      return;
    }
    const meuPedido = ++pedidoRef.current;
    setBuscando(true);
    const timer = window.setTimeout(async () => {
      const escapado = termoLimpo.replace(/[%_]/g, "\\$&");
      const padrao = `%${escapado}%`;
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, bed_number, sector, medical_record, age, is_vacant")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .eq("is_vacant", false)
        .or(`name.ilike.${padrao},medical_record.ilike.${padrao}`)
        .order("name")
        .limit(6);
      if (meuPedido !== pedidoRef.current) return;
      if (!error) {
        setResultados(
          (data ?? []).map((p) => {
            const codigo = (p.sector as string) ?? "";
            return {
              id: p.id as string,
              name: (p.name as string) || "Sem nome",
              bedNumber: (p.bed_number as string) ?? "",
              sectorCode: codigo,
              sectorLabel: SECTOR_DISPLAY[codigo] ?? codigo,
              department: (SECTOR_TO_DEPARTMENT[codigo] ?? "") as Department,
              medicalRecord: (p.medical_record as string) ?? null,
              age: p.age ? String(p.age) : null,
            };
          })
        );
      }
      setBuscando(false);
      setBuscou(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [termoLimpo, ativo, currentHospital, currentState]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const irParaPaciente = (p: PacienteEncontrado) => {
    setOpen(false);
    setTermo("");
    navigate(`/paciente?patientId=${p.id}&patientName=${encodeURIComponent(p.name)}&patientBed=${p.bedNumber}&patientSector=${p.sectorCode}`);
    onNavigate?.();
  };

  // Sidebar colapsada — só ícone
  if (isCollapsed) {
    return (
      <div className="px-0 flex justify-center py-2 border-b border-border/50">
        <button
          onClick={() => navigate("/paciente")}
          title="Buscar paciente"
          className="h-7 w-7 flex items-center justify-center rounded-md bg-muted/40 hover:bg-primary/10 hover:text-primary text-foreground/70 ring-1 ring-border/40 transition-colors"
        >
          <FileSearch className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          Buscar Paciente
        </span>
        <div className="flex-1 h-px bg-primary/30" />
      </div>

      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
          <Input
            value={termo}
            onChange={(e) => { setTermo(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Nome ou prontuário…"
            className="h-7 pl-6 pr-6 text-xs bg-muted/40 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40"
          />
          {buscando && (
            <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {termo && !buscando && (
            <button
              onClick={() => { setTermo(""); setOpen(false); setResultados([]); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-md max-h-80 overflow-y-auto">
            {!ativo && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Digite ao menos 3 caracteres
              </p>
            )}
            {ativo && buscou && resultados.length === 0 && !buscando && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Nenhum paciente internado encontrado.
              </p>
            )}
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => irParaPaciente(p)}
                className="w-full text-left px-3 py-2 hover:bg-primary/10 transition-colors border-b border-border/40 last:border-b-0 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                      <BedDouble className="h-2.5 w-2.5 inline" />
                      {formatBedDisplay(p.bedNumber)}
                      <span>·</span>
                      {p.sectorLabel}
                      {p.medicalRecord && <><span>·</span>{p.medicalRecord}</>}
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
