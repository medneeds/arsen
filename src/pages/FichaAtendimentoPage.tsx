import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, ArrowLeft, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { formatAge } from "@/lib/patientAge";
import { getNormaZeroMissingFields, NormaZeroBlockedDocument } from "@/components/NormaZeroPrintHeader";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import { whitelabel, getInstitutionalHeaderLines } from "@/config/whitelabel";
import socorraoCross from "@/assets/socorrao-cross-logo.png";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";

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
  const { currentHospital } = useHospital();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const patientId = searchParams.get("patientId") || "";
  const patientName = searchParams.get("patientName") || "";

  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);

  // Fetch all data for the patient
  //
  // MIGRAÇÃO: patientId agora é `internacoes.id`. A ficha inteira é remontada a partir de
  // internacoes(+pacientes,+leitos,+setores) + evolucoes + sinais_vitais + prescricoes +
  // solicitacoes_exame + altas + pre_admissoes. As tabelas antigas (patients, patient_registry,
  // pre_admissions rico, admission_histories, conduct_history, patient_encounters) não existem
  // mais. Filtros hospital_unit_id/state_id saíram (internacoes é identificada globalmente pelo id).
  useEffect(() => {
    const fetchData = async () => {
      if (!patientId) { setLoading(false); return; }
      setLoading(true);

      try {
        const allEncounters: Encounter[] = [];

        const pd: PatientData = {
          name: patientName,
          socialName: "",
          birthDate: "",
          age: "",
          sex: "",
          motherName: "",
          address: "",
          neighborhood: "", // MIGRAÇÃO: pacientes.endereco é campo único → sem bairro
          city: "",         // MIGRAÇÃO: sem coluna cidade em pacientes
          record: "",
          cns: "",
          cpf: "",
          race: "",         // MIGRAÇÃO: sem coluna raça/cor em pacientes
          phone: "",
          fichaNumber: "",  // MIGRAÇÃO: encounter_code (patient_encounters) morto → sem nº de ficha
          fichaDate: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
        };

        // 1. Internação + paciente + leito + setor
        const { data: interRow } = await supabase
          .from("internacoes")
          .select(
            "id, status, data_entrada, data_alta, queixa_principal, historia_clinica, hipotese_diagnostica, conduta_inicial, exames_relevantes, pendencias, agenda, criado_em, leito_id, paciente_id, paciente:pacientes(nome_completo, nome_social, cpf, cns, data_nascimento, sexo, nome_mae, telefone, endereco, tipo_sanguineo, alergias, comorbidades, prontuario), leito:leitos(numero, setor:setores(nome, tipo))"
          )
          .eq("id", patientId)
          .maybeSingle();

        const inter = interRow as any;
        const pac = inter?.paciente || null;
        const sectorCode: string = inter?.leito?.setor?.tipo || inter?.leito?.setor?.nome || "";

        if (pac) {
          pd.name = pac.nome_completo || patientName;
          pd.socialName = pac.nome_social || "";
          pd.birthDate = pac.data_nascimento
            ? format(new Date(pac.data_nascimento + "T12:00:00"), "dd/MM/yyyy")
            : "";
          pd.sex = pac.sexo || "";
          pd.motherName = pac.nome_mae || "";
          pd.address = pac.endereco || "";
          pd.record = pac.prontuario || "";
          pd.cns = pac.cns || "";
          pd.cpf = pac.cpf || "";
          pd.phone = pac.telefone || "";
        }
        if (inter?.data_entrada) {
          pd.fichaDate = format(new Date(inter.data_entrada), "dd/MM/yyyy HH:mm:ss");
        }

        // Admissão sintetizada a partir de internacoes (substitui admission_histories, morta)
        if (inter) {
          const admContent = [
            inter.queixa_principal ? `# HDA: ${inter.queixa_principal}` : null,
            inter.historia_clinica || null,
            inter.conduta_inicial ? `# Conduta: ${inter.conduta_inicial}` : null,
          ].filter(Boolean).join("\n");
          if (admContent) {
            allEncounters.push({
              id: `adm-${inter.id}`,
              sector: sectorCode || "PS",
              professionalName: "",
              professionalCRM: "",
              startTime: inter.data_entrada || inter.criado_em,
              endTime: inter.data_entrada || inter.criado_em,
              type: "evolucao",
              content: admContent,
              diagnoses: inter.hipotese_diagnostica || "",
              requests: "",
              outcome: "",
            });
          }
        }

        // 2. Pré-admissões / classificação de risco
        // MIGRAÇÃO: pre_admissions rico (chief_complaint, vital_signs, allergies, glasgow,
        // destination_sector) → pre_admissoes só tem classificacao_risco + dados_extraidos_ia (Json).
        // Extraímos o que houver do JSON da IA; campos ausentes são omitidos.
        const { data: preAdms } = await supabase
          .from("pre_admissoes")
          .select("id, classificacao_risco, dados_extraidos_ia, data_hora, status, criado_em")
          .eq("internacao_id", patientId)
          .order("data_hora", { ascending: true });

        (preAdms as any[] | null)?.forEach((pa) => {
          const ia = (pa.dados_extraidos_ia as Record<string, any>) || {};
          const risco = pa.classificacao_risco
            ? String(pa.classificacao_risco).charAt(0).toUpperCase() + String(pa.classificacao_risco).slice(1)
            : "";
          const content = [
            (ia.chief_complaint || ia.queixa_principal) ? `Queixa principal: ${ia.chief_complaint || ia.queixa_principal}` : null,
            (ia.allergies || ia.alergias) ? `Alergias: ${ia.allergies || ia.alergias}` : null,
            risco ? `Classificação de risco: ${risco}` : null,
          ].filter(Boolean).join("\n");
          if (content) {
            allEncounters.push({
              id: pa.id,
              sector: "Classificação de Risco",
              professionalName: "",
              professionalCRM: "",
              startTime: pa.data_hora || pa.criado_em,
              endTime: pa.data_hora || pa.criado_em,
              type: "classificacao_risco",
              content,
              diagnoses: "",
              requests: "",
              outcome: "",
            });
          }
        });

        // 3. Evoluções (soap Json) — profissional via profissionais (FK profissional_id)
        const { data: evos } = await supabase
          .from("evolucoes")
          .select("id, data_hora, soap, status, criado_em, atualizado_em, profissional:profissionais(nome, numero_conselho)")
          .eq("internacao_id", patientId)
          .order("data_hora", { ascending: true });

        (evos as any[] | null)?.forEach((ev) => {
          const soap = (ev.soap as Record<string, any>) || {};
          const content = [
            soap.subjective ? `S: ${soap.subjective}` : null,
            soap.objective ? `O: ${soap.objective}` : null,
            soap.assessment ? `A: ${soap.assessment}` : null,
            soap.plan ? `P: ${soap.plan}` : null,
          ].filter(Boolean).join("\n");
          if (content) {
            allEncounters.push({
              id: ev.id,
              sector: sectorCode || "PS",
              professionalName: ev.profissional?.nome || "",
              professionalCRM: ev.profissional?.numero_conselho || "",
              startTime: ev.data_hora || ev.criado_em,
              endTime: ev.atualizado_em || ev.data_hora || ev.criado_em,
              type: "evolucao",
              content,
              diagnoses: soap.__diagnostic_hypotheses || "",
              requests: "",
              outcome: "",
            });
          }
        });

        // 4. Sinais vitais — registrado_por via profissionais
        const { data: vitals } = await supabase
          .from("sinais_vitais")
          .select("id, data_hora, freq_cardiaca, freq_respiratoria, pressao_sistolica, pressao_diastolica, spo2, temperatura, nivel_consciencia, observacoes, criado_em, profissional:profissionais(nome, numero_conselho)")
          .eq("internacao_id", patientId)
          .order("data_hora", { ascending: true });

        (vitals as any[] | null)?.forEach((v) => {
          const vitalsStr = [
            (v.pressao_sistolica && v.pressao_diastolica) ? `PA: ${v.pressao_sistolica}/${v.pressao_diastolica} mmHg` : null,
            v.freq_cardiaca ? `FC: ${v.freq_cardiaca} bpm` : null,
            v.freq_respiratoria ? `FR: ${v.freq_respiratoria} irpm` : null,
            v.temperatura ? `Tax: ${v.temperatura} °C` : null,
            v.spo2 ? `SatO2: ${v.spo2}%` : null,
            v.nivel_consciencia ? `Consciência: ${v.nivel_consciencia}` : null,
          ].filter(Boolean).join(" | ");
          const content = [
            vitalsStr ? `Sinais vitais: ${vitalsStr}` : null,
            v.observacoes || null,
          ].filter(Boolean).join("\n");
          if (content) {
            allEncounters.push({
              id: v.id,
              sector: sectorCode || "PS",
              professionalName: v.profissional?.nome || "",
              professionalCRM: v.profissional?.numero_conselho || "",
              startTime: v.data_hora || v.criado_em,
              endTime: v.data_hora || v.criado_em,
              type: "evolucao",
              content,
              diagnoses: "",
              requests: "",
              outcome: "",
            });
          }
        });

        // 5. Prescrições (itens Json) — criado_por via profissionais
        const { data: prescriptions } = await supabase
          .from("prescricoes")
          .select("id, itens, status, criado_em, atualizado_em, assinatura_digital, profissional:profissionais(nome, numero_conselho)")
          .eq("internacao_id", patientId)
          .order("criado_em", { ascending: true });

        (prescriptions as any[] | null)?.forEach((rx) => {
          const rxItems = (rx.itens as Array<any>) || [];
          const activeItems = rxItems.filter((i) => i.status !== "suspended");
          const content = activeItems.map((item, idx) => {
            const parts = [item.name || item.medication || item.description];
            if (item.dose && item.dose !== "-") parts.push(item.dose);
            if (item.route && item.route !== "-") parts.push(item.route);
            if (item.posology && item.posology !== "-") parts.push(item.posology);
            return `${idx + 1}. ${parts.filter(Boolean).join(", ")}`;
          }).join("\n");

          const sig = rx.assinatura_digital as { doctorName?: string; crm?: string } | null;

          allEncounters.push({
            id: rx.id,
            sector: sectorCode || "PS",
            professionalName: sig?.doctorName || rx.profissional?.nome || "",
            professionalCRM: sig?.crm || rx.profissional?.numero_conselho || "",
            startTime: rx.criado_em,
            endTime: rx.atualizado_em || rx.criado_em,
            type: "prescricao",
            content: `PRESCRIÇÃO\n${content}`,
            diagnoses: "",
            requests: `${activeItems.length} itens prescritos`,
            outcome: "",
          });
        });

        // 6. Solicitações de exame (itens Json) — solicitado_por via profissionais
        const { data: exams } = await supabase
          .from("solicitacoes_exame")
          .select("id, categoria, itens, status, criado_em, atualizado_em, profissional:profissionais(nome, numero_conselho)")
          .eq("internacao_id", patientId)
          .order("criado_em", { ascending: true });

        (exams as any[] | null)?.forEach((ex) => {
          const items = (ex.itens as Array<{ name?: string }>) || [];
          allEncounters.push({
            id: ex.id,
            sector: sectorCode || "PS",
            professionalName: ex.profissional?.nome || "",
            professionalCRM: ex.profissional?.numero_conselho || "",
            startTime: ex.criado_em,
            endTime: ex.atualizado_em || ex.criado_em,
            type: "evolucao",
            content: `Solicitação de ${ex.categoria}: ${items.map((i) => i.name || "").filter(Boolean).join(", ")}`,
            diagnoses: "",
            requests: `${items.length} exames solicitados`,
            outcome: (ex.status === "concluido" || ex.status === "completed") ? "Resultado disponível" : "Aguardando",
          });
        });

        // 7. Altas / documentos de desfecho (discharge_documents → altas)
        const { data: dischs } = await supabase
          .from("altas")
          .select("id, tipo, conteudo, data_hora, numero_documento, crm_assinatura, criado_em")
          .eq("internacao_id", patientId)
          .order("data_hora", { ascending: true });

        (dischs as any[] | null)?.forEach((al) => {
          const c = (al.conteudo as Record<string, any>) || {};
          const summary = c.summary || c.resumo || c.discharge_summary || "";
          allEncounters.push({
            id: al.id,
            sector: sectorCode || "PS",
            professionalName: "",
            professionalCRM: al.crm_assinatura || "",
            startTime: al.data_hora || al.criado_em,
            endTime: al.data_hora || al.criado_em,
            type: "evolucao",
            content: `DOCUMENTO DE ALTA (${al.tipo})${summary ? `\n${summary}` : ""}`,
            diagnoses: "",
            requests: "",
            outcome: al.numero_documento ? `Documento nº ${al.numero_documento}` : "",
          });
        });

        // Sort all encounters by time
        allEncounters.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        // Idade ao vivo a partir da data de nascimento. pd.birthDate já vem em
        // dd/mm/yyyy; convertida para ISO antes do cálculo.
        if (pd.birthDate) {
          const isoBirthDate = pd.birthDate.split("/").reverse().join("-");
          pd.age = formatAge(isoBirthDate) || pd.age;
        }

        setPatientData(pd);
        setEncounters(allEncounters);
      } catch (err) {
        console.error("Error fetching ficha data:", err);
        toast.error("Não foi possível carregar dados do atendimento");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId, patientName]);

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
          <h3 className="font-medium text-sm">
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
                <span className="text-xs font-medium">{sectorLabelFromCode(enc.sector) || enc.sector}</span>
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

  // Norma Zero — bloqueia a geração da Ficha de Atendimento se a
  // identificação do paciente estiver incompleta.
  const missingFields = getNormaZeroMissingFields({
    name: patient.name,
    birthDate: patient.birthDate,
    sex: patient.sex,
    record: patient.record,
  });
  if (missingFields.length > 0) {
    return <NormaZeroBlockedDocument missingFields={missingFields} />;
  }

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
                      {sectorLabelFromCode(enc.sector) || enc.sector}
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
