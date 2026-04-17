import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Printer, ArrowLeft, FileText, Search, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import { whitelabel, getInstitutionalHeaderLines } from "@/config/whitelabel";
import socorraoCross from "@/assets/socorrao-cross-logo.png";

interface Encounter {
  id: string;
  sector: string;
  professionalName: string;
  professionalCRM: string;
  startTime: string;
  endTime: string;
  type: string; // 'classificacao_risco' | 'evolucao' | 'prescricao'
  content: string;
  diagnoses: string;
  requests: string;
  outcome: string;
}

interface PatientData {
  name: string;
  socialName: string;
  birthDate: string;
  age: string;
  sex: string;
  motherName: string;
  address: string;
  neighborhood: string;
  city: string;
  record: string;
  cns: string;
  cpf: string;
  race: string;
  phone: string;
  fichaNumber: string;
  fichaDate: string;
}

const FichaAtendimentoPage = () => {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const patientId = searchParams.get("patientId") || "";
  const patientName = searchParams.get("patientName") || "";

  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);

  // Fetch all data for the patient
  useEffect(() => {
    const fetchData = async () => {
      if (!currentHospital || !currentState) return;
      setLoading(true);

      try {
        const allEncounters: Encounter[] = [];

        // 1. Fetch patient basic data from patients table or registry
        let pd: PatientData = {
          name: patientName,
          socialName: "",
          birthDate: "",
          age: "",
          sex: "",
          motherName: "",
          address: "",
          neighborhood: "",
          city: "",
          record: "",
          cns: "",
          cpf: "",
          race: "",
          phone: "",
          fichaNumber: "",
          fichaDate: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
        };

        // Try pre_admissions for full patient data
        const { data: preAdm } = await supabase
          .from("pre_admissions")
          .select("*")
          .eq("hospital_unit_id", currentHospital.id)
          .eq("state_id", currentState.id)
          .eq("patient_name", patientName)
          .order("created_at", { ascending: false })
          .limit(1);

        if (preAdm && preAdm.length > 0) {
          const pa = preAdm[0];
          pd = {
            ...pd,
            socialName: pa.social_name || "",
            birthDate: pa.birth_date ? format(new Date(pa.birth_date + "T12:00:00"), "dd/MM/yyyy") : "",
            sex: pa.sex || "",
            motherName: pa.mother_name || "",
            address: `${pa.address || ""}${pa.neighborhood ? ` — ${pa.neighborhood}` : ""}`,
            neighborhood: pa.neighborhood || "",
            city: pa.city || "",
            record: pa.medical_record || "",
            cns: pa.cns || "",
            cpf: pa.cpf || "",
            phone: pa.phone || "",
          };

          // Build risk classification encounter
          const vs = pa.vital_signs as Record<string, string> | null;
          const vitalsStr = vs
            ? [
                vs.pa ? `PA: ${vs.pa} mmHg` : null,
                vs.fc ? `FC: ${vs.fc} bpm` : null,
                vs.fr ? `FR: ${vs.fr} irpm` : null,
                vs.tax ? `Tax: ${vs.tax} °C` : null,
                vs.sato2 ? `SatO2: ${vs.sato2}%` : null,
                vs.peso ? `Peso: ${vs.peso} kg` : null,
                vs.glicemia ? `Glicemia: ${vs.glicemia} mg/dL` : null,
              ]
                .filter(Boolean)
                .join(" | ")
            : "";

          if (pa.chief_complaint || pa.risk_classification) {
            const riskContent = [
              pa.chief_complaint ? `Queixa principal: ${pa.chief_complaint}` : null,
              vitalsStr ? `Sinais vitais: ${vitalsStr}` : null,
              pa.allergies ? `Alergias: ${pa.allergies}` : null,
              pa.glasgow_score ? `Glasgow: ${pa.glasgow_score}` : null,
              pa.risk_classification ? `Cor da classificação de risco: ${pa.risk_classification.charAt(0).toUpperCase() + pa.risk_classification.slice(1)}` : null,
              pa.destination_sector ? `Encaminhamento: ${pa.destination_sector}` : null,
            ]
              .filter(Boolean)
              .join("\n");

            allEncounters.push({
              id: pa.id,
              sector: "Classificação de Risco",
              professionalName: "",
              professionalCRM: "",
              startTime: pa.risk_classified_at || pa.created_at,
              endTime: pa.updated_at || pa.created_at,
              type: "classificacao_risco",
              content: riskContent,
              diagnoses: "",
              requests: "",
              outcome: pa.destination_sector ? `Encaminhamento: PS ${pa.destination_sector.charAt(0).toUpperCase() + pa.destination_sector.slice(1)}` : "",
            });
          }
        }

        // Try patients table for additional data
        const { data: patientRow } = await supabase
          .from("patients")
          .select("*")
          .eq("hospital_unit_id", currentHospital.id)
          .eq("state_id", currentState.id)
          .eq("name", patientName)
          .order("created_at", { ascending: false })
          .limit(1);

        if (patientRow && patientRow.length > 0) {
          const p = patientRow[0];
          if (!pd.record && p.medical_record) pd.record = p.medical_record;
          if (!pd.age && p.age) pd.age = String(p.age);

          // Build evolution encounter from patient data
          const sectorMap: Record<string, string> = {
            red: "PS Sala Vermelha",
            yellow: "PS Sala Amarela",
            blue: "PS Sala Azul",
            outside: "PS Observação",
            sala_vermelha: "PS Sala Vermelha",
            sala_laranja: "PS Sala Laranja",
          };

          if (p.admission_history) {
            allEncounters.push({
              id: `patient-evolution-${p.id}`,
              sector: sectorMap[p.sector] || p.sector,
              professionalName: "",
              professionalCRM: "",
              startTime: p.admission_date || p.created_at,
              endTime: p.updated_at,
              type: "evolucao",
              content: p.admission_history,
              diagnoses: p.diagnoses || "",
              requests: "",
              outcome: p.internment_status === "SOLICITACAO_PENDENTE"
                ? "Internação"
                : p.internment_status === "IR_PARA_UTI"
                ? "UTI"
                : p.internment_status === "IR_PARA_ENFERMARIA"
                ? "Enfermaria"
                : "",
            });
          }
        }

        // Fetch admission history
        const { data: admHist } = await supabase
          .from("admission_histories")
          .select("*")
          .eq("hospital_unit_id", currentHospital.id)
          .eq("state_id", currentState.id)
          .eq("patient_id", patientId || "00000000-0000-0000-0000-000000000000")
          .order("created_at", { ascending: true });

        if (admHist) {
          admHist.forEach((ah) => {
            const content = [
              ah.chief_complaint ? `# HDA: ${ah.chief_complaint}` : null,
              ah.clinical_history ? `${ah.clinical_history}` : null,
              ah.initial_conduct ? `# Conduta: ${ah.initial_conduct}` : null,
            ]
              .filter(Boolean)
              .join("\n");

            if (content) {
              allEncounters.push({
                id: ah.id,
                sector: "PS",
                professionalName: "",
                professionalCRM: "",
                startTime: ah.created_at,
                endTime: ah.updated_at,
                type: "evolucao",
                content,
                diagnoses: ah.diagnostic_hypothesis || "",
                requests: "",
                outcome: "",
              });
            }
          });
        }

        // Fetch conduct history for evolution entries
        const { data: conducts } = await supabase
          .from("conduct_history")
          .select("*")
          .eq("hospital_unit_id", currentHospital.id)
          .eq("state_id", currentState.id)
          .eq("patient_id", patientId || "00000000-0000-0000-0000-000000000000")
          .order("created_at", { ascending: true });

        if (conducts && conducts.length > 0) {
          // Group conducts by timestamp proximity (within 5 minutes = same encounter)
          const grouped: Encounter[] = [];
          let current: typeof conducts[0][] = [conducts[0]];

          for (let i = 1; i < conducts.length; i++) {
            const prev = new Date(conducts[i - 1].created_at).getTime();
            const curr = new Date(conducts[i].created_at).getTime();
            if (curr - prev < 300000) {
              current.push(conducts[i]);
            } else {
              grouped.push({
                id: current[0].id,
                sector: "PS",
                professionalName: current[0].changed_by_email?.split("@")[0] || "",
                professionalCRM: "",
                startTime: current[0].created_at,
                endTime: current[current.length - 1].created_at,
                type: "evolucao",
                content: current.map((c) => `${c.field_name}: ${c.new_value || ""}`).join("\n"),
                diagnoses: "",
                requests: "",
                outcome: "",
              });
              current = [conducts[i]];
            }
          }
          if (current.length > 0) {
            grouped.push({
              id: current[0].id,
              sector: "PS",
              professionalName: current[0].changed_by_email?.split("@")[0] || "",
              professionalCRM: "",
              startTime: current[0].created_at,
              endTime: current[current.length - 1].created_at,
              type: "evolucao",
              content: current.map((c) => `${c.field_name}: ${c.new_value || ""}`).join("\n"),
              diagnoses: "",
              requests: "",
              outcome: "",
            });
          }
          // Don't duplicate if admission_history already covered this
          if (!patientRow || !patientRow[0]?.admission_history) {
            allEncounters.push(...grouped);
          }
        }

        // Fetch prescriptions
        const { data: prescriptions } = await supabase
          .from("prescriptions")
          .select("*")
          .eq("hospital_unit_id", currentHospital.id)
          .eq("state_id", currentState.id)
          .eq("patient_name", patientName)
          .order("created_at", { ascending: true });

        if (prescriptions) {
          prescriptions.forEach((rx) => {
            const rxItems = (rx.items as Array<{ name: string; dose: string; route: string; posology: string; category: string; status: string }>) || [];
            const activeItems = rxItems.filter((i) => i.status !== "suspended");
            const content = activeItems.map((item, idx) => {
              const parts = [item.name];
              if (item.dose && item.dose !== "-") parts.push(item.dose);
              if (item.route && item.route !== "-") parts.push(item.route);
              if (item.posology && item.posology !== "-") parts.push(item.posology);
              return `${idx + 1}. ${parts.join(", ")}`;
            }).join("\n");

            const sig = rx.digital_signature as { doctorName?: string; crm?: string } | null;

            allEncounters.push({
              id: rx.id,
              sector: "PS",
              professionalName: sig?.doctorName || "",
              professionalCRM: sig?.crm || "",
              startTime: rx.created_at,
              endTime: rx.updated_at,
              type: "prescricao",
              content: `PRESCRIÇÃO\n${content}`,
              diagnoses: "",
              requests: `${activeItems.length} itens prescritos`,
              outcome: "",
            });
          });
        }

        // Fetch exam requests
        const { data: exams } = await supabase
          .from("exam_requests")
          .select("*")
          .eq("hospital_unit_id", currentHospital.id)
          .eq("state_id", currentState.id)
          .eq("patient_name", patientName)
          .order("created_at", { ascending: true });

        if (exams) {
          exams.forEach((ex) => {
            const items = (ex.items as Array<{ name: string }>) || [];
            allEncounters.push({
              id: ex.id,
              sector: "PS",
              professionalName: ex.requested_by_name || "",
              professionalCRM: "",
              startTime: ex.created_at,
              endTime: ex.updated_at,
              type: "evolucao",
              content: `Solicitação de ${ex.category}: ${items.map((i) => i.name).join(", ")}`,
              diagnoses: "",
              requests: `${items.length} exames solicitados`,
              outcome: ex.status === "completed" ? "Resultado disponível" : "Aguardando",
            });
          });
        }

        // Sort all encounters by time
        allEncounters.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        // Get encounter code for ficha number
        const { data: enc } = await supabase
          .from("patient_encounters")
          .select("encounter_code, created_at")
          .eq("hospital_unit_id", currentHospital.id)
          .eq("state_id", currentState.id)
          .eq("patient_name", patientName)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

        if (enc && enc.length > 0) {
          pd.fichaNumber = enc[0].encounter_code;
          pd.fichaDate = format(new Date(enc[0].created_at), "dd/MM/yyyy HH:mm:ss");
        }

        // Calculate age
        if (pd.birthDate && !pd.age) {
          const birth = new Date(pd.birthDate.split("/").reverse().join("-"));
          const now = new Date();
          const years = now.getFullYear() - birth.getFullYear();
          pd.age = `${years} ano(s)`;
        }

        setPatientData(pd);
        setEncounters(allEncounters);
      } catch (err) {
        console.error("Error fetching ficha data:", err);
        toast.error("Erro ao carregar dados do atendimento");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentHospital, currentState, patientId, patientName]);

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
    }, 300);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando ficha de atendimento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ClinicalHeader
        moduleLabel="Ficha de Atendimento"
      />

      <div className="flex items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button size="sm" onClick={handlePrint} disabled={encounters.length === 0}>
          <Printer className="h-4 w-4 mr-1" /> Imprimir Ficha
        </Button>
      </div>

      {/* Preview */}
      <div className="border border-border rounded-lg p-4 bg-card space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            {patientData?.name || patientName}
          </h3>
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            {encounters.length} atendimento(s)
          </Badge>
        </div>

        {encounters.map((enc, idx) => (
          <div key={enc.id} className="border border-border rounded-md p-3 bg-muted/30">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Badge variant={enc.type === "classificacao_risco" ? "destructive" : enc.type === "prescricao" ? "default" : "secondary"} className="text-xs">
                  {idx + 1}/{encounters.length}
                </Badge>
                <span className="text-xs font-semibold">{enc.sector}</span>
                {enc.professionalName && (
                  <span className="text-xs text-muted-foreground">
                    {enc.professionalName}{enc.professionalCRM ? ` — CRM ${enc.professionalCRM}` : ""}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(enc.startTime), "dd/MM/yyyy HH:mm")}
              </span>
            </div>
            <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-4">
              {enc.content}
            </p>
            {enc.diagnoses && (
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Diagnósticos:</strong> {enc.diagnoses}
              </p>
            )}
            {enc.outcome && (
              <p className="text-xs text-muted-foreground">
                <strong>Desfecho:</strong> {enc.outcome}
              </p>
            )}
          </div>
        ))}

        {encounters.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum atendimento encontrado para este paciente
          </div>
        )}
      </div>

      {/* Print Portal */}
      {showPrint &&
        createPortal(
          <div id="ficha-print-root" style={{ display: "none" }}>
            <PrintableFicha
              patient={patientData!}
              encounters={encounters}
              hospitalName={currentHospital?.name || "HOSPITAL MUNICIPAL"}
            />
          </div>,
          document.body
        )}

      <style>{`
        @media print {
          body > *:not(#ficha-print-root) { display: none !important; }
          #ficha-print-root {
            display: block !important;
            position: absolute; top: 0; left: 0; width: 100%;
          }
          @page { size: A4 portrait; margin: 14mm 14mm 16mm 14mm; }
          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};

// === PRINTABLE FICHA DE ATENDIMENTO — Padrão Institucional Socorrão I ===
function PrintableFicha({
  patient,
  encounters,
  hospitalName,
}: {
  patient: PatientData;
  encounters: Encounter[];
  hospitalName: string;
}) {
  const inst = whitelabel.institution;
  const colors = whitelabel.theme.institutionalColors;
  const headerLines = getInstitutionalHeaderLines();
  const now = new Date();

  // ---- Tipologia institucional ----
  const fontFamily =
    "'Helvetica Neue', 'Segoe UI', Helvetica, Arial, sans-serif";
  const ink = "#0a1628";
  const inkSoft = "#475569";
  const inkMuted = "#94a3b8";
  const lineSoft = "#cbd5e1";
  const surfaceSoft = "#f8fafc";

  const cellStyle: React.CSSProperties = {
    border: `0.5px solid ${lineSoft}`,
    padding: "4px 7px",
    fontSize: "8pt",
    lineHeight: 1.35,
    verticalAlign: "top",
    color: ink,
  };
  const labelCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 700,
    fontSize: "6.5pt",
    backgroundColor: surfaceSoft,
    color: inkSoft,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    width: "70px",
  };

  // Cor do tipo de atendimento (timeline dot)
  const typeMeta = (type: string) => {
    if (type === "classificacao_risco")
      return { color: colors.red, label: "Classificação de Risco" };
    if (type === "prescricao")
      return { color: colors.blue, label: "Prescrição Médica" };
    if (type === "evolucao")
      return { color: colors.green, label: "Evolução Clínica" };
    return { color: colors.orange, label: "Atendimento" };
  };

  // Banda colorida institucional (cruz Socorrão)
  const InstitutionalBand = () => (
    <div style={{ display: "flex", height: "4px", marginTop: "6px" }}>
      <div style={{ flex: 1, backgroundColor: colors.red }} />
      <div style={{ flex: 1, backgroundColor: colors.orange }} />
      <div style={{ flex: 1, backgroundColor: colors.yellow }} />
      <div style={{ flex: 1, backgroundColor: colors.green }} />
      <div style={{ flex: 1, backgroundColor: colors.blue }} />
    </div>
  );

  return (
    <div
      style={{
        fontFamily,
        color: ink,
        width: "182mm",
        margin: "0 auto",
        lineHeight: 1.35,
        position: "relative",
      }}
    >
      {/* Marca d'água — cruz colorida muito sutil */}
      <img
        src={socorraoCross}
        alt=""
        aria-hidden
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "120mm",
          height: "auto",
          opacity: 0.04,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* ========== CABEÇALHO INSTITUCIONAL (Norma Zero) ========== */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            paddingBottom: "8px",
          }}
        >
          {/* Logo institucional */}
          <img
            src={socorraoCross}
            alt={inst.hospitalLogoAlt}
            style={{
              width: "62px",
              height: "62px",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />

          {/* Hierarquia institucional centralizada */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                fontSize: "7.5pt",
                fontWeight: 600,
                color: inkSoft,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
              }}
            >
              {headerLines[0]}
            </div>
            <div
              style={{
                fontSize: "8pt",
                fontWeight: 600,
                color: inkSoft,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                marginTop: "1px",
              }}
            >
              {headerLines[1]}
            </div>
            <div
              style={{
                fontSize: "11pt",
                fontWeight: 800,
                color: ink,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                marginTop: "3px",
                lineHeight: 1.15,
              }}
            >
              {headerLines[2]}
            </div>
            <div
              style={{
                fontSize: "6.5pt",
                color: inkMuted,
                marginTop: "3px",
                fontStyle: "italic",
              }}
            >
              {inst.address}
            </div>
          </div>

          {/* Bloco direito — número da ficha */}
          <div
            style={{
              minWidth: "120px",
              textAlign: "right",
              borderLeft: `1px solid ${lineSoft}`,
              paddingLeft: "10px",
            }}
          >
            <div
              style={{
                fontSize: "6pt",
                color: inkMuted,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Ficha de Atendimento
            </div>
            <div
              style={{
                fontSize: "11pt",
                fontWeight: 800,
                color: ink,
                marginTop: "2px",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.5px",
              }}
            >
              Nº {patient.fichaNumber || "—"}
            </div>
            <div
              style={{
                fontSize: "6.5pt",
                color: inkSoft,
                marginTop: "2px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {patient.fichaDate}
            </div>
          </div>
        </div>

        {/* Banda colorida institucional (cruz Socorrão) */}
        <InstitutionalBand />
      </div>

      {/* ========== TÍTULO DO DOCUMENTO ========== */}
      <div
        style={{
          textAlign: "center",
          margin: "10px 0 8px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: "12pt",
            fontWeight: 800,
            color: ink,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          Ficha de Atendimento
        </div>
        <div
          style={{
            fontSize: "7pt",
            color: inkSoft,
            marginTop: "2px",
            letterSpacing: "0.4px",
          }}
        >
          Histórico Cronológico do Atendimento — Setor de Urgência e Emergência
        </div>
      </div>

      {/* ========== DADOS DO PACIENTE ========== */}
      <SectionTitle title="Identificação do Paciente" color={ink} />
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "10px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <tbody>
          <tr>
            <td style={labelCellStyle}>Nome</td>
            <td
              style={{
                ...cellStyle,
                fontWeight: 800,
                fontSize: "9pt",
                textTransform: "uppercase",
                letterSpacing: "0.3px",
              }}
              colSpan={3}
            >
              {patient.name || "—"}
            </td>
            <td style={labelCellStyle}>Prontuário</td>
            <td
              style={{
                ...cellStyle,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {patient.record || "—"}
            </td>
          </tr>
          <tr>
            <td style={labelCellStyle}>Nome social</td>
            <td style={cellStyle} colSpan={3}>
              {patient.socialName || "Não cadastrado"}
            </td>
            <td style={labelCellStyle}>Sexo</td>
            <td style={cellStyle}>{patient.sex || "—"}</td>
          </tr>
          <tr>
            <td style={labelCellStyle}>Nascimento</td>
            <td style={cellStyle}>
              {patient.birthDate || "—"}{" "}
              {patient.age ? (
                <span style={{ color: inkSoft }}>· {patient.age}</span>
              ) : null}
            </td>
            <td style={labelCellStyle}>CNS</td>
            <td style={cellStyle}>{patient.cns || "—"}</td>
            <td style={labelCellStyle}>CPF</td>
            <td style={cellStyle}>{patient.cpf || "—"}</td>
          </tr>
          <tr>
            <td style={labelCellStyle}>Mãe</td>
            <td style={cellStyle} colSpan={3}>
              {patient.motherName || "—"}
            </td>
            <td style={labelCellStyle}>Raça/Cor</td>
            <td style={cellStyle}>{patient.race || "—"}</td>
          </tr>
          <tr>
            <td style={labelCellStyle}>Endereço</td>
            <td style={cellStyle} colSpan={3}>
              {patient.address || "—"}
            </td>
            <td style={labelCellStyle}>Telefone</td>
            <td style={cellStyle}>{patient.phone || "—"}</td>
          </tr>
          <tr>
            <td style={labelCellStyle}>Cidade</td>
            <td style={cellStyle} colSpan={5}>
              {patient.city || "—"}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== TIMELINE CRONOLÓGICA ========== */}
      <SectionTitle
        title={`Linha do Tempo do Atendimento · ${encounters.length} evento${
          encounters.length !== 1 ? "s" : ""
        }`}
        color={ink}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {encounters.map((enc, idx) => {
          const meta = typeMeta(enc.type);
          const isLast = idx === encounters.length - 1;
          const start = new Date(enc.startTime);
          const end = new Date(enc.endTime);
          const sameDay =
            format(start, "yyyyMMdd") === format(end, "yyyyMMdd");
          const durMin = Math.max(
            0,
            Math.round((end.getTime() - start.getTime()) / 60000)
          );

          return (
            <div
              key={enc.id}
              style={{
                display: "flex",
                gap: "10px",
                pageBreakInside: "avoid",
                marginBottom: isLast ? "0" : "8px",
              }}
            >
              {/* Coluna timeline (dot + linha) */}
              <div
                style={{
                  position: "relative",
                  width: "26px",
                  flexShrink: 0,
                  paddingTop: "2px",
                }}
              >
                {/* Linha vertical */}
                {!isLast && (
                  <div
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "18px",
                      bottom: "-8px",
                      width: "1px",
                      backgroundColor: lineSoft,
                    }}
                  />
                )}
                {/* Dot colorido */}
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    backgroundColor: meta.color,
                    border: "2px solid #fff",
                    boxShadow: `0 0 0 1px ${meta.color}`,
                    margin: "0 auto",
                  }}
                />
                {/* Numeração */}
                <div
                  style={{
                    fontSize: "6pt",
                    fontWeight: 800,
                    color: inkSoft,
                    textAlign: "center",
                    marginTop: "3px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </div>
              </div>

              {/* Card do evento */}
              <div
                style={{
                  flex: 1,
                  border: `0.5px solid ${lineSoft}`,
                  borderLeft: `3px solid ${meta.color}`,
                  borderRadius: "2px",
                  backgroundColor: "#fff",
                  overflow: "hidden",
                }}
              >
                {/* Cabeçalho do evento */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "5px 8px",
                    backgroundColor: surfaceSoft,
                    borderBottom: `0.5px solid ${lineSoft}`,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "6pt",
                        fontWeight: 800,
                        color: meta.color,
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                      }}
                    >
                      {meta.label}
                    </div>
                    <div
                      style={{
                        fontSize: "8pt",
                        fontWeight: 700,
                        color: ink,
                        marginTop: "1px",
                      }}
                    >
                      {enc.sector}
                      {enc.professionalName && (
                        <span
                          style={{
                            fontSize: "7pt",
                            color: inkSoft,
                            fontWeight: 500,
                            marginLeft: "6px",
                          }}
                        >
                          · {enc.professionalName}
                          {enc.professionalCRM
                            ? ` — CRM ${enc.professionalCRM}`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                      fontSize: "6.5pt",
                      color: inkSoft,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: ink }}>
                      {format(start, "dd/MM/yyyy")}
                    </div>
                    <div>
                      {format(start, "HH:mm:ss")}
                      {sameDay
                        ? ` → ${format(end, "HH:mm:ss")}`
                        : ` → ${format(end, "dd/MM HH:mm")}`}
                    </div>
                    {durMin > 0 && (
                      <div style={{ color: inkMuted, fontSize: "6pt" }}>
                        Duração: {durMin >= 60
                          ? `${Math.floor(durMin / 60)}h ${durMin % 60}min`
                          : `${durMin} min`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Conteúdo do evento */}
                <div style={{ padding: "6px 8px" }}>
                  <div
                    style={{
                      fontSize: "7.5pt",
                      lineHeight: 1.45,
                      color: ink,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {enc.content}
                  </div>

                  {(enc.diagnoses || enc.requests || enc.outcome) && (
                    <div
                      style={{
                        marginTop: "5px",
                        paddingTop: "4px",
                        borderTop: `0.5px dashed ${lineSoft}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      {enc.diagnoses && (
                        <FieldRow
                          label="Diagnósticos"
                          value={enc.diagnoses}
                          color={ink}
                          labelColor={inkSoft}
                        />
                      )}
                      {enc.requests && (
                        <FieldRow
                          label="Solicitações"
                          value={enc.requests}
                          color={ink}
                          labelColor={inkSoft}
                        />
                      )}
                      {enc.outcome && (
                        <FieldRow
                          label="Desfecho"
                          value={enc.outcome}
                          color={ink}
                          labelColor={inkSoft}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {encounters.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              fontSize: "8pt",
              color: inkMuted,
              border: `0.5px dashed ${lineSoft}`,
              borderRadius: "2px",
            }}
          >
            Nenhum evento registrado para este atendimento
          </div>
        )}
      </div>

      {/* ========== ASSINATURA ========== */}
      <div
        style={{
          marginTop: "20px",
          paddingTop: "10px",
          borderTop: `1px solid ${lineSoft}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          pageBreakInside: "avoid",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: "6.5pt", color: inkMuted, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, color: inkSoft }}>
            {inst.hospitalFullName}
          </div>
          <div>{inst.address}</div>
          <div>{inst.email}</div>
        </div>

        <div style={{ textAlign: "center", minWidth: "200px" }}>
          <div
            style={{
              width: "100%",
              borderBottom: `1px solid ${ink}`,
              marginBottom: "4px",
              height: "30px",
            }}
          />
          <div style={{ fontSize: "7pt", fontWeight: 700, color: ink }}>
            Assinatura e Carimbo do Médico Responsável
          </div>
          <div
            style={{
              fontSize: "6.5pt",
              color: inkSoft,
              marginTop: "2px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            CRM/____ Nº _____________
          </div>
        </div>
      </div>

      {/* ========== RODAPÉ DO SISTEMA ========== */}
      <div
        style={{
          marginTop: "10px",
          paddingTop: "5px",
          borderTop: `0.5px solid ${lineSoft}`,
          display: "flex",
          justifyContent: "space-between",
          fontSize: "5.5pt",
          color: inkMuted,
          letterSpacing: "0.3px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span>
          {whitelabel.print.systemLabel} · Documento gerado automaticamente
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {format(now, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
        </span>
        <span>
          {whitelabel.compliance.normaZeroCode} · v
          {whitelabel.compliance.normaZeroVersion}
        </span>
      </div>
    </div>
  );
}

// === Helpers de UI institucional ===
function SectionTitle({ title, color }: { title: string; color: string }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        marginBottom: "4px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <div
        style={{
          fontSize: "7pt",
          fontWeight: 800,
          color,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div
        style={{
          flex: 1,
          height: "1px",
          backgroundColor: "#cbd5e1",
        }}
      />
    </div>
  );
}

function FieldRow({
  label,
  value,
  color,
  labelColor,
}: {
  label: string;
  value: string;
  color: string;
  labelColor: string;
}) {
  return (
    <div style={{ fontSize: "7pt", lineHeight: 1.4, color }}>
      <span
        style={{
          fontWeight: 800,
          color: labelColor,
          textTransform: "uppercase",
          fontSize: "6.5pt",
          letterSpacing: "0.4px",
          marginRight: "4px",
        }}
      >
        {label}:
      </span>
      {value}
    </div>
  );
}

export default FichaAtendimentoPage;
