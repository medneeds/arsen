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
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
    </div>
  );
};

// === PRINTABLE FICHA DE ATENDIMENTO ===
function PrintableFicha({
  patient,
  encounters,
  hospitalName,
}: {
  patient: PatientData;
  encounters: Encounter[];
  hospitalName: string;
}) {
  const cellStyle: React.CSSProperties = {
    border: "0.5px solid #94a3b8",
    padding: "3px 6px",
    fontSize: "7.5pt",
    lineHeight: 1.3,
    verticalAlign: "top",
  };
  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 700,
    fontSize: "6.5pt",
    backgroundColor: "#f1f5f9",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  };
  const sectionStyle: React.CSSProperties = {
    fontWeight: 800,
    fontSize: "8pt",
    backgroundColor: "#0c4a6e",
    color: "#fff",
    textAlign: "center",
    letterSpacing: "0.5px",
    padding: "5px 6px",
    border: "0.5px solid #0c4a6e",
  };

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#0f172a",
        width: "186mm",
        margin: "0 auto",
        lineHeight: 1.3,
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "2px solid #0c4a6e",
          paddingBottom: "4px",
          marginBottom: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "7pt", color: "#64748b", fontWeight: 600 }}>
            PREFEITURA DE SÃO LUÍS — SECRETARIA MUNICIPAL DE SAÚDE
          </div>
          <div style={{ fontSize: "11pt", fontWeight: 800, color: "#0c4a6e" }}>
            {hospitalName}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "9pt", fontWeight: 800, color: "#0c4a6e" }}>
            Ficha {patient.fichaNumber || "—"}
          </div>
          <div style={{ fontSize: "6.5pt", color: "#64748b" }}>{patient.fichaDate}</div>
        </div>
      </div>

      {/* DADOS DO PACIENTE */}
      <div style={{ ...sectionStyle, marginBottom: "2px" }}>DADOS DO(A) PACIENTE</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px" }}>
        <tbody>
          <tr>
            <td style={headerCellStyle}>Nome</td>
            <td style={{ ...cellStyle, fontWeight: 800, fontSize: "8.5pt" }} colSpan={3}>
              {patient.name || "—"}
            </td>
            <td style={headerCellStyle}>Prontuário</td>
            <td style={{ ...cellStyle, fontWeight: 700 }}>{patient.record || "—"}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Nome Social</td>
            <td style={cellStyle} colSpan={3}>{patient.socialName || "Não cadastrado"}</td>
            <td style={headerCellStyle}>Sexo</td>
            <td style={cellStyle}>{patient.sex || "—"}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Data Nasc.</td>
            <td style={cellStyle}>{patient.birthDate || "—"} {patient.age ? `${patient.age}` : ""}</td>
            <td style={headerCellStyle}>CNS</td>
            <td style={cellStyle}>{patient.cns || "—"}</td>
            <td style={headerCellStyle}>CPF</td>
            <td style={cellStyle}>{patient.cpf || "—"}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Mãe</td>
            <td style={cellStyle} colSpan={3}>{patient.motherName || "—"}</td>
            <td style={headerCellStyle}>Raça</td>
            <td style={cellStyle}>{patient.race || "—"}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Endereço</td>
            <td style={cellStyle} colSpan={3}>{patient.address || "—"}</td>
            <td style={headerCellStyle}>Telefones</td>
            <td style={cellStyle}>{patient.phone || "—"}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Cidade</td>
            <td style={cellStyle} colSpan={5}>{patient.city || "—"}</td>
          </tr>
        </tbody>
      </table>

      {/* ATENDIMENTOS */}
      <div style={{ ...sectionStyle, marginBottom: "4px" }}>ATENDIMENTOS</div>

      {encounters.map((enc, idx) => (
        <div
          key={enc.id}
          style={{
            border: "0.5px solid #94a3b8",
            marginBottom: "4px",
            pageBreakInside: "avoid",
          }}
        >
          {/* Encounter header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "3px 6px",
              borderBottom: "0.5px solid #cbd5e1",
              backgroundColor: "#f8fafc",
            }}
          >
            <div>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "8pt",
                  color: "#0c4a6e",
                  marginRight: "8px",
                }}
              >
                {idx + 1}/{encounters.length}
              </span>
              <span style={{ fontWeight: 700, fontSize: "7.5pt" }}>{enc.sector}</span>
              {enc.professionalName && (
                <span style={{ fontSize: "7pt", color: "#475569", marginLeft: "8px" }}>
                  {enc.professionalName}
                  {enc.professionalCRM ? ` — CRM ${enc.professionalCRM}` : ""}
                </span>
              )}
            </div>
            <div style={{ fontSize: "6.5pt", color: "#64748b", textAlign: "right" }}>
              <div>Início: {format(new Date(enc.startTime), "dd/MM/yyyy HH:mm:ss")}</div>
              <div>Encerrado: {format(new Date(enc.endTime), "dd/MM/yyyy HH:mm:ss")}</div>
            </div>
          </div>

          {/* Encounter content */}
          <div style={{ padding: "4px 6px" }}>
            {enc.type === "classificacao_risco" && (
              <div style={{ fontSize: "6.5pt", fontWeight: 700, color: "#dc2626", marginBottom: "2px", letterSpacing: "0.3px" }}>
                CLASSIFICAÇÃO DE RISCO
              </div>
            )}
            <div
              style={{
                fontSize: "7pt",
                lineHeight: 1.4,
                color: "#0f172a",
                whiteSpace: "pre-wrap",
              }}
            >
              {enc.content}
            </div>
            {enc.diagnoses && (
              <div style={{ fontSize: "7pt", color: "#334155", marginTop: "3px" }}>
                <span style={{ fontWeight: 800 }}>Diagnósticos: </span>
                {enc.diagnoses}
              </div>
            )}
            {enc.requests && (
              <div style={{ fontSize: "7pt", color: "#334155" }}>
                <span style={{ fontWeight: 800 }}>Solicitações: </span>
                {enc.requests}
              </div>
            )}
            {enc.outcome && (
              <div style={{ fontSize: "7pt", color: "#334155" }}>
                <span style={{ fontWeight: 800 }}>Desfecho: </span>
                {enc.outcome}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div
        style={{
          marginTop: "16px",
          borderTop: "0.5px solid #cbd5e1",
          paddingTop: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          pageBreakInside: "avoid",
        }}
      >
        <div style={{ fontSize: "6pt", color: "#94a3b8", lineHeight: 1.4 }}>
          <div>Endereço: Rua do Passeio, S/N, Centro, São Luís-MA</div>
          <div>CNPJ: 07008865000143 — Telefone: (98) 2211054</div>
          <div>
            Impresso em {format(new Date(), "dd/MM/yyyy HH:mm:ss")} [Ficha de Atendimento]
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "180px",
              borderBottom: "1.5px solid #0f172a",
              marginBottom: "4px",
            }}
          />
          <div style={{ fontSize: "7pt", fontWeight: 700 }}>Assinatura / Carimbo do Médico</div>
          <div style={{ fontSize: "6.5pt", color: "#64748b" }}>CRM: _______________</div>
        </div>
      </div>

      {/* System footer */}
      <div
        style={{
          marginTop: "8px",
          fontSize: "5.5pt",
          color: "#94a3b8",
          textAlign: "center",
          borderTop: "0.5px solid #e2e8f0",
          paddingTop: "3px",
        }}
      >
        Documento gerado pelo sistema BigHelp Map — {format(new Date(), "dd/MM/yyyy HH:mm:ss")}
      </div>
    </div>
  );
}

export default FichaAtendimentoPage;
