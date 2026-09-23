import React, { useEffect, useState } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { formatAge } from "@/lib/patientAge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SectorPatient {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  age: string | null;
  patient_registry_id: string | null;
}

// Params específicos de um paciente/contexto pontual que NÃO devem persistir
// ao alternar para outro paciente (evita herdar pré-admissão, alocação,
// SAPS pendente etc. do paciente anterior).
const STALE_PATIENT_PARAMS = [
  "preAdmissionId",
  "allocationRequestId",
  "completeSapsId",
  "fromAllocation",
  "destinationSector",
  "selectedBed",
  "selectedSector",
  "bed",
  "patient",
];

interface PatientSwitcherProps {
  variant?: "default" | "dark";
}

/**
 * Dropdown in the clinical header that shows the current patient name
 * and allows switching to other patients in the same sector.
 */
export function PatientSwitcher({ variant = "dark" }: PatientSwitcherProps) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentHospital, currentState } = useHospital();

  const patientName = searchParams.get("patientName") || "";
  const patientSector = searchParams.get("patientSector") || "";

  const [patients, setPatients] = useState<SectorPatient[]>([]);

  // Fetch patients from same sector
  // MIGRAÇÃO: patients (mega-tabela leito+paciente) → internacoes ATIVAS
  // (data_alta IS NULL) cujo leito pertence a um setor com `tipo` == código
  // do setor (SectorType) no hospital atual. name/age/registry via join
  // pacientes; bed_number via leitos; sector via setores.tipo.
  // Filtros hospital_unit_id/state_id/is_vacant não têm coluna → substituídos
  // por setores→alas.hospital_id e pela ausência de coluna is_vacant.
  useEffect(() => {
    if (!patientSector || !currentHospital) return;

    const fetchSectorPatients = async () => {
      const { data } = await (supabase
        .from("internacoes")
        .select(`
          id, paciente_id,
          paciente:pacientes ( nome_completo, nome_social, data_nascimento ),
          leito:leitos!inner (
            numero,
            setor:setores!inner ( tipo, ala:alas!inner ( hospital_id ) )
          )
        `) as any)
        .is("data_alta", null)
        .eq("leito.setor.ala.hospital_id", currentHospital.id)
        .eq("leito.setor.tipo", patientSector);

      if (Array.isArray(data)) {
        const mapped: SectorPatient[] = data.map((row: any) => {
          const pac = row.paciente || {};
          return {
            id: row.id,
            name: pac.nome_social || pac.nome_completo || "",
            bed_number: row.leito?.numero || "",
            sector: row.leito?.setor?.tipo || patientSector,
            age: formatAge(pac.data_nascimento),
            patient_registry_id: row.paciente_id ?? null,
          };
        });
        mapped.sort((a, b) => (a.bed_number || "").localeCompare(b.bed_number || "", undefined, { numeric: true }));
        setPatients(mapped);
      }
    };

    fetchSectorPatients();
  }, [patientSector, currentHospital]);

  // Only render when there's a patient context
  if (!patientName) return null;

  const handleSwitch = (p: SectorPatient) => {
    const params = new URLSearchParams(searchParams);
    // Limpa contexto pontual do paciente anterior (pré-admissão, alocação,
    // SAPS pendente etc.) para evitar que o novo paciente herde estados.
    STALE_PATIENT_PARAMS.forEach(k => params.delete(k));
    params.set("patientId", p.id);
    params.set("patientName", p.name);
    params.set("patientBed", p.bed_number || "");
    params.set("patientSector", p.sector);
    if (p.age) params.set("patientAge", p.age);
    else params.delete("patientAge");
    if (p.patient_registry_id) params.set("patientRegistryId", p.patient_registry_id);
    else params.delete("patientRegistryId");
    navigate(`${location.pathname}?${params.toString()}`);
  };

  return (
    <>
      <span className={cn("text-xs", variant === "dark" ? "text-white/30" : "text-muted-foreground/40")}>/</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all max-w-[200px]",
            variant === "dark"
              ? "text-white hover:bg-white/10"
              : "text-foreground hover:bg-muted"
          )}>
            <User className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate patient-id">{patientName}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto">
          {patients.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              Carregando pacientes...
            </DropdownMenuItem>
          ) : (
            patients.map(p => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleSwitch(p)}
                className={cn(
                  "text-xs cursor-pointer",
                  p.name === patientName && "bg-primary/10 font-medium"
                )}
              >
                <span className="patient-id text-muted-foreground font-mono mr-2 w-8 text-right shrink-0">{p.bed_number}</span>
                <span className="patient-id truncate">{p.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
