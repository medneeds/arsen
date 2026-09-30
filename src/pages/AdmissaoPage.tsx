import { useEffect, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AdmissionForm } from "@/components/admission/AdmissionForm";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PatientCockpit } from "@/components/PatientCockpit";
import { usePatientLive } from "@/hooks/usePatientLive";
import type { Patient } from "@/types/patient";

/**
 * Perfis claramente NAO clinicos (porta / recepcao / administrativo) nao podem
 * registrar uma admissao clinica D0. Conservador: bloqueia so o que e
 * inequivocamente de porta/recepcao e permite todos os demais perfis que hoje
 * ja conseguem abrir a admissao pelo Hub.
 */
const DENIED_ACCESS_PROFILES = ["administrativo", "porta", "recepcao"];

interface AdmissaoLocationState {
  patient?: Partial<{
    id: string;
    name: string;
    bed: string;
    sector: string;
    age: string | number;
    department: string;
    patient_registry_id: string | null;
  }>;
  returnTo?: string;
}

export default function AdmissaoPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  // ─── Contexto do paciente — reidratado dos MESMOS search params das outras
  // paginas de modulo (patientSector = CODIGO do setor: red/yellow/uti_01...).
  const patientId = searchParams.get("patientId") || "";
  const patientName = searchParams.get("patientName") || "";
  const patientBed = searchParams.get("patientBed") || "";
  const patientSector = searchParams.get("patientSector") || "";
  const patientAge = searchParams.get("patientAge") || "";
  const state = (location.state ?? null) as AdmissaoLocationState | null;

  // ─── Guarda de permissao — mesmo mecanismo do App.tsx (access_profile em
  // localStorage) + role do AuthContext. Perfil de porta/recepcao nao admite.
  const accessProfile = typeof window !== "undefined"
    ? (localStorage.getItem("access_profile") || "medico")
    : "medico";
  const denied = DENIED_ACCESS_PROFILES.includes(accessProfile) || role === "porta";

  // ─── patient: search params como base, enriquecido pelo state quando presente
  // (state tem prioridade nos campos que trouxer). O AdmissionForm resolve
  // idade/registry por patient.id via usePatientIdentifiers — sem fetch aqui.
  const patient = useMemo(() => {
    const base = {
      id: patientId,
      name: patientName || "",
      bed: patientBed || "",
      sector: patientSector || "",
      age: patientAge || undefined,
      patient_registry_id: null as string | null,
    };
    return state?.patient ? { ...base, ...state.patient } : base;
  }, [patientId, patientName, patientBed, patientSector, patientAge, state]);

  const returnTo = state?.returnTo || (patientId ? `/paciente?patientId=${patientId}` : "/mapa");

  // Linha viva da internacao — traz o admissionStatus derivado (transferencia/
  // saida). Sem isso a tarja de sinalizacao do cockpit sumia na Admissao, porque
  // o cockpitPatient era montado so a partir dos params (sem admissionStatus).
  const { patient: livePatient } = usePatientLive(patient.id || null);

  // Paciente para o Cockpit do trilho direito — mesma harmonizacao dos demais
  // modulos (stub a partir dos params; o Cockpit resolve o resto por id).
  const cockpitPatient: Patient = useMemo(() => ({
    id: patient.id || "admissao-stub",
    bedNumber: patient.bed,
    name: patient.name,
    age: patient.age ? String(patient.age).replace(/\s*anos?$/i, "") : "",
    sector: (patient.sector as Patient["sector"]) || "outside",
    diagnoses: [],
    medicalHistory: [],
    relevantExams: [],
    pendencies: [],
    schedule: [],
    admissionHistory: "",
    admissionDate: "",
    utiAllergies: [],
    clinicalStatus: "regular",
    admissionStatus: livePatient?.admissionStatus,
  }), [patient, livePatient]);

  // ─── Guarda de permissao: perfil de porta/recepcao -> acesso negado
  useEffect(() => {
    if (denied) {
      toast.error("Acesso negado: seu perfil não pode registrar admissões clínicas");
      navigate(returnTo, { replace: true });
    }
  }, [denied, navigate, returnTo]);

  // ─── Guarda de contexto: sem patientId algum (deep-link sem contexto) volta.
  useEffect(() => {
    if (!denied && !patientId) {
      toast.info("Abra a admissão pelo painel do paciente");
      navigate(returnTo, { replace: true });
    }
  }, [denied, patientId, navigate, returnTo]);

  if (denied || !patientId) return null;

  return (
    <div className="print:p-2">
      {/* Shell institucional harmonizado — mesmo cabecalho/abas dos demais modulos */}
      <ClinicalHeader moduleLabel="Admissão" />

      <div className="flex print:block">
        <div className="flex-1 min-w-0 p-3 sm:p-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <AdmissionForm
              embedded
              patient={patient}
              onClose={() => navigate(returnTo)}
              onSuccess={() => toast.success("Admissão hospitalar registrada. Módulos clínicos liberados.")}
            />
          </div>
        </div>

        {/* Cockpit no trilho direito — igual a Evolucao/Prescricao */}
        <PatientCockpit patient={cockpitPatient} />
      </div>
    </div>
  );
}
