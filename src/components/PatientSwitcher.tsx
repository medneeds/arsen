import React, { useEffect, useState } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { SECTOR_DISPLAY as SECTOR_LABELS } from "@/contexts/DepartmentContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  useEffect(() => {
    if (!patientSector || !currentHospital || !currentState) return;

    const fetchSectorPatients = async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, name, bed_number, sector")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .eq("sector", patientSector)
        .eq("is_vacant", false)
        .order("bed_number");

      if (data) setPatients(data);
    };

    fetchSectorPatients();
  }, [patientSector, currentHospital, currentState]);

  // Only render when there's a patient context
  if (!patientName) return null;

  const handleSwitch = (p: SectorPatient) => {
    const params = new URLSearchParams(searchParams);
    params.set("patientId", p.id);
    params.set("patientName", p.name);
    params.set("patientBed", p.bed_number);
    params.set("patientSector", p.sector);
    navigate(`${location.pathname}?${params.toString()}`);
  };

  return (
    <>
      <span className={cn("text-xs", variant === "dark" ? "text-white/30" : "text-muted-foreground/40")}>/</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all max-w-[200px]",
            variant === "dark"
              ? "text-white hover:bg-white/10"
              : "text-foreground hover:bg-muted"
          )}>
            <User className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate">{patientName}</span>
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
                  p.name === patientName && "bg-primary/10 font-semibold"
                )}
              >
                <span className="text-muted-foreground font-mono mr-2 w-8 text-right shrink-0">{p.bed_number}</span>
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
