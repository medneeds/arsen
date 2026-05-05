import { whitelabel } from "@/config/whitelabel";
import socorraoCross from "@/assets/socorrao-cross-logo.png";

const C = whitelabel.theme.institutionalColors;

/* ============================================================
 * Mockups de PDF Norma Zero — para a apresentação institucional
 * Renderizados em escala dentro dos slides 16:9.
 * Replicam estrutura visual de printNormaZero.ts (header com 5
 * cores, doc-bar, h2 azul, tabelas, bloco de assinaturas).
 * Dados FICTÍCIOS — somente para demonstração de layout.
 * ============================================================ */

function DocFrame({
  docCode,
  sector,
  title,
  subtitle,
  children,
  signatures,
}: {
  docCode: string;
  sector: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  signatures: string[];
}) {
  const now = new Date();
  const dt = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} • ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return (
    <div
      className="mx-auto flex h-full w-full flex-col rounded-md bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200"
      style={{ aspectRatio: "1 / 1.414" }}
    >
      {/* HEADER */}
      <div className="flex items-stretch gap-3 border-b border-slate-200 px-5 pt-4">
        <img src={socorraoCross} alt="HMDM" className="h-12 w-12 flex-none object-contain" />
        <div className="flex-1 text-center leading-tight">
          <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {whitelabel.print.institutionalHeader.line1}
          </p>
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-700">
            {whitelabel.print.institutionalHeader.line2}
          </p>
          <p className="text-[10px] font-black uppercase tracking-tight text-slate-900">
            {whitelabel.print.institutionalHeader.line3}
          </p>
        </div>
        <div className="h-12 w-3" />
      </div>
      {/* CRUZ COLORIDA */}
      <div className="flex h-1.5 w-full">
        <span className="flex-1" style={{ background: C.red }} />
        <span className="flex-1" style={{ background: C.orange }} />
        <span className="flex-1" style={{ background: C.yellow }} />
        <span className="flex-1" style={{ background: C.green }} />
        <span className="flex-1" style={{ background: C.blue }} />
      </div>
      {/* DOC-BAR */}
      <div className="flex items-center justify-between bg-slate-100 px-5 py-1.5 text-[7px] font-semibold uppercase tracking-wider text-slate-600">
        <span>Doc.: {docCode}</span>
        <span>{sector}</span>
        <span>Emissão {dt}</span>
      </div>
      {/* TÍTULO */}
      <div className="border-b border-slate-200 px-5 py-3 text-center">
        <h1 className="text-[14px] font-black uppercase tracking-tight text-slate-900">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
      {/* CORPO */}
      <div className="nz-body flex-1 overflow-hidden px-5 py-3 text-[7.5px] leading-relaxed text-slate-800">
        {children}
      </div>
      {/* ASSINATURAS */}
      <div className="grid grid-cols-3 gap-3 px-5 pb-3 pt-2">
        {signatures.map((s) => (
          <div key={s} className="text-center">
            <div className="mx-auto h-px w-full bg-slate-400" />
            <p className="mt-1 text-[7px] font-bold uppercase tracking-wider text-slate-700">{s}</p>
            <p className="text-[6px] uppercase tracking-wider text-slate-400">CRM • Carimbo</p>
          </div>
        ))}
      </div>
      {/* RODAPÉ */}
      <div
        className="flex items-center justify-between border-t border-slate-200 px-5 py-1.5 text-[6px] font-semibold uppercase tracking-wider text-slate-500"
        style={{ background: "#f8fafc" }}
      >
        <span>HMDM • Arsen 1.0</span>
        <span>{whitelabel.compliance.normaZeroCode} v{whitelabel.compliance.normaZeroVersion}</span>
        <span>{whitelabel.compliance.legalReferences}</span>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-1.5 mt-2 rounded-sm px-1.5 py-1 text-[7px] font-black uppercase tracking-wider text-white"
      style={{ background: C.blue }}
    >
      {children}
    </h2>
  );
}

function KV({ k, v, full = false }: { k: string; v: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-3" : ""}>
      <p className="text-[6px] font-bold uppercase tracking-wider text-slate-500">{k}</p>
      <p className="text-[7.5px] font-semibold text-slate-900">{v}</p>
    </div>
  );
}

function PatientHeader({ extra }: { extra?: React.ReactNode }) {
  return (
    <div
      className="mb-2 rounded-sm border border-slate-200 p-2"
      style={{ background: "#f8fafc" }}
    >
      <div className="grid grid-cols-3 gap-2">
        <KV k="Paciente" v="MARIA DAS GRAÇAS PEREIRA SOUSA" full />
        <KV k="Prontuário" v="26-HMDM-000142-7" />
        <KV k="Atendimento" v="000000000823" />
        <KV k="DN / Idade / Sexo" v="14/03/1958 • 67a • F" />
        <KV k="CPF / CNS" v="123.456.789-00 • 700 1234 5678 9012" />
        <KV k="Setor / Leito" v="UTI 2 • L14" />
        <KV k="CID-10 principal" v="A41.9 — SEPSE NÃO ESPECIFICADA" />
        {extra}
      </div>
    </div>
  );
}

/* ===== Mockups individuais ============================== */

export function PrescriptionMockup() {
  return (
    <DocFrame
      docCode="PRESC-20260505-0830"
      sector="UTI 2 • Leito L14"
      title="Prescrição Médica"
      subtitle="Hospital Municipal Djalma Marques – Socorrão I"
      signatures={["Médico Assistente", "Farmacêutico Validador", "Enfermagem Conferente"]}
    >
      <PatientHeader
        extra={
          <>
            <KV k="Peso / Altura" v="62 kg • 1,58 m" />
            <KV k="Alergias" v="DIPIRONA (RASH)" />
            <KV k="Diagnósticos secundários" v="HAS • DM2 • DPOC" />
          </>
        }
      />
      <Section>1. Dieta e Cuidados Gerais</Section>
      <ul className="mb-1 ml-3 list-disc space-y-0.5">
        <li>DIETA ENTERAL POR SNE — 1.500 KCAL/DIA, INFUSÃO CONTÍNUA 60 ML/H</li>
        <li>CABECEIRA ELEVADA 30°, MUDANÇA DE DECÚBITO 2/2H</li>
        <li>HIGIENE ORAL COM CLOREXIDINA 0,12% — 12/12H</li>
      </ul>

      <Section>2. Hidratação / Reposição</Section>
      <table className="w-full border-collapse text-[7px]">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="border border-slate-200 p-1 text-left">#</th>
            <th className="border border-slate-200 p-1 text-left">Solução</th>
            <th className="border border-slate-200 p-1 text-left">Diluição</th>
            <th className="border border-slate-200 p-1 text-left">Via / Velocidade</th>
            <th className="border border-slate-200 p-1 text-left">Aprazamento</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-200 p-1">1</td>
            <td className="border border-slate-200 p-1">SF 0,9% 1000 ML</td>
            <td className="border border-slate-200 p-1">+ KCl 19,1% 10 ML</td>
            <td className="border border-slate-200 p-1">EV BIC • 80 ML/H</td>
            <td className="border border-slate-200 p-1">Contínuo 24H</td>
          </tr>
        </tbody>
      </table>

      <Section>3. Medicamentos</Section>
      <table className="w-full border-collapse text-[7px]">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="border border-slate-200 p-1 text-left">#</th>
            <th className="border border-slate-200 p-1 text-left">Princípio Ativo</th>
            <th className="border border-slate-200 p-1 text-left">Dose</th>
            <th className="border border-slate-200 p-1 text-left">Via</th>
            <th className="border border-slate-200 p-1 text-left">Frequência</th>
            <th className="border border-slate-200 p-1 text-left">Diluição / Tempo</th>
            <th className="border border-slate-200 p-1 text-left">Apraz.</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["1", "CEFTRIAXONA", "2 g", "EV", "12/12h", "SF 0,9% 100 mL — 30 min", "08-20"],
            ["2", "AZITROMICINA", "500 mg", "EV", "1×/dia", "SG 5% 250 mL — 60 min", "10"],
            ["3", "NORADRENALINA", "16 mg", "EV BIC", "Contínuo", "+ SG 5% 250 mL — 0,3 mcg/kg/min", "Cont."],
            ["4", "OMEPRAZOL", "40 mg", "EV", "1×/dia", "Bolus lento 5 min", "08"],
            ["5", "ENOXAPARINA", "40 mg", "SC", "1×/dia", "—", "20"],
            ["6", "DIPIRONA SÓDICA", "1 g", "EV", "6/6h S/N", "SF 0,9% 50 mL — 10 min", "S/N"],
            ["7", "INSULINA REGULAR", "Esq. móvel", "SC", "6/6h", "Glicemia capilar prévia", "06-12-18-24"],
          ].map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className="border border-slate-200 p-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <Section>4. Profilaxias e Monitorização</Section>
      <p>
        TEV: ENOXAPARINA 40 MG SC 1×/DIA • TGI: OMEPRAZOL 40 MG EV 1×/DIA • SINAIS VITAIS 2/2H •
        DIURESE HORÁRIA • GLICEMIA CAPILAR 6/6H • LACTATO 6/6H ATÉ NORMALIZAÇÃO
      </p>
    </DocFrame>
  );
}

export function EvolutionMockup() {
  return (
    <DocFrame
      docCode="EVOL-20260505-0915"
      sector="UTI 2 • Leito L14"
      title="Evolução Médica — SOAP"
      subtitle="3º Dia de Internação em UTI"
      signatures={["Médico Plantonista", "Médico Diarista", "Coordenação UTI"]}
    >
      <PatientHeader />
      <Section>S — Subjetivo</Section>
      <p>
        PACIENTE EM VENTILAÇÃO MECÂNICA, SEDADA (RASS −2). FAMILIAR REFERE BOA EVOLUÇÃO NAS
        ÚLTIMAS 24H. SEM QUEIXAS DA EQUIPE DE ENFERMAGEM.
      </p>

      <Section>O — Objetivo</Section>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="font-bold">SINAIS VITAIS:</p>
          <p>PA 118/74 mmHg • FC 88 bpm • FR 16 irpm • SatO₂ 96% • Tax 36,8°C</p>
          <p className="mt-1 font-bold">VENTILAÇÃO:</p>
          <p>VCV • VC 380 mL • FR 14 • PEEP 8 • FiO₂ 40% • PaO₂/FiO₂ 280</p>
        </div>
        <div>
          <p className="font-bold">EXAMES (06h):</p>
          <p>Hb 9,8 • Leu 14.200 (8% bast.) • Plaq 165k</p>
          <p>Cr 1,1 • U 58 • Na 138 • K 4,2 • Lac 1,8</p>
          <p>PCR 142 → 98 • Procalcitonina 2,1 → 1,4</p>
        </div>
      </div>

      <Section>A — Avaliação</Section>
      <ul className="ml-3 list-disc space-y-0.5">
        <li>SEPSE PULMONAR — D3 ATB EM EVOLUÇÃO FAVORÁVEL (PCR/PROCALCITONINA EM QUEDA)</li>
        <li>CHOQUE SÉPTICO EM RESOLUÇÃO — DESMAME DE NORADRENALINA EM CURSO</li>
        <li>IRA AKI 1 — DIURESE PRESERVADA, FUNÇÃO RENAL ESTÁVEL</li>
      </ul>

      <Section>P — Plano</Section>
      <ul className="ml-3 list-disc space-y-0.5">
        <li>MANTER CEFTRIAXONA + AZITROMICINA — REAVALIAR EM D5</li>
        <li>REDUZIR NORADRENALINA 0,3 → 0,2 MCG/KG/MIN CONFORME PA</li>
        <li>INICIAR DESPERTAR DIÁRIO COM PROTOCOLO ABCDEF</li>
        <li>SOLICITAR RX TÓRAX CONTROLE • GASOMETRIA ARTERIAL EM 6H</li>
        <li>SAPS 3: 52 PONTOS • NEWS2: 4</li>
      </ul>
    </DocFrame>
  );
}

export function SimpleRequestMockup() {
  return (
    <DocFrame
      docCode="REQ-LAB-20260505-0930"
      sector="UTI 2 • Leito L14"
      title="Requisição de Exames Laboratoriais"
      subtitle="Solicitação de Rotina"
      signatures={["Médico Solicitante", "Coleta — Enfermagem", "Laboratório Receptor"]}
    >
      <PatientHeader />
      <Section>Indicação Clínica</Section>
      <p>
        CONTROLE EVOLUTIVO DE SEPSE PULMONAR EM D3 DE ANTIBIOTICOTERAPIA. AVALIAÇÃO DE FUNÇÃO
        RENAL, ELETRÓLITOS E RESPOSTA INFLAMATÓRIA.
      </p>

      <Section>Exames Solicitados</Section>
      <table className="w-full border-collapse text-[7px]">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="border border-slate-200 p-1 text-left">Categoria</th>
            <th className="border border-slate-200 p-1 text-left">Exame</th>
            <th className="border border-slate-200 p-1 text-center">Urgente</th>
            <th className="border border-slate-200 p-1 text-center">☐</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["HEMATOLOGIA", "HEMOGRAMA COMPLETO COM PLAQUETAS", "SIM"],
            ["BIOQUÍMICA", "UREIA E CREATININA", "NÃO"],
            ["BIOQUÍMICA", "SÓDIO, POTÁSSIO, CLORETO, MAGNÉSIO", "NÃO"],
            ["INFLAMATÓRIO", "PROTEÍNA C REATIVA (PCR)", "SIM"],
            ["INFLAMATÓRIO", "PROCALCITONINA", "SIM"],
            ["GASOMETRIA", "GASOMETRIA ARTERIAL + LACTATO", "SIM"],
            ["HEPÁTICO", "TGO, TGP, BILIRRUBINAS, FA, GGT", "NÃO"],
            ["COAGULAÇÃO", "TAP/INR, TTPA", "NÃO"],
          ].map((r, i) => (
            <tr key={i}>
              <td className="border border-slate-200 p-1">{r[0]}</td>
              <td className="border border-slate-200 p-1 font-semibold">{r[1]}</td>
              <td
                className="border border-slate-200 p-1 text-center font-bold"
                style={{ color: r[2] === "SIM" ? C.red : "#64748b" }}
              >
                {r[2]}
              </td>
              <td className="border border-slate-200 p-1 text-center">☐</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section>Prazo / Observações</Section>
      <p>
        COLETA IMEDIATA. RESULTADOS DESEJÁVEIS EM ATÉ 2H PARA OS ITENS URGENTES. DEMAIS NA ROTINA
        DA MANHÃ. ENVIAR RESULTADO AO PAINEL CLÍNICO COM CIÊNCIA MÉDICA.
      </p>
    </DocFrame>
  );
}

export function CultureMockup() {
  return (
    <DocFrame
      docCode="CULT-20260505-1000"
      sector="UTI 2 • Leito L14"
      title="Solicitação de Cultura Microbiológica"
      subtitle="Notificação CCIH automática"
      signatures={["Médico Solicitante", "Coleta — Enfermagem", "Microbiologia"]}
    >
      <PatientHeader />
      <Section>Sítio e Material</Section>
      <div className="grid grid-cols-2 gap-2">
        <KV k="Material" v="HEMOCULTURA — 2 PARES (PERIFÉRICA + CVC)" />
        <KV k="Sítio" v="ANTECUBITAL D + CVC SUBCLÁVIA D" />
        <KV k="Hipótese" v="BACTEREMIA / SEPSE PULMONAR" />
        <KV k="ATB em uso" v="CEFTRIAXONA + AZITROMICINA (D3)" />
      </div>

      <Section>Cultura Solicitada</Section>
      <table className="w-full border-collapse text-[7px]">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="border border-slate-200 p-1 text-left">Tipo</th>
            <th className="border border-slate-200 p-1 text-left">Frasco</th>
            <th className="border border-slate-200 p-1 text-left">Volume</th>
            <th className="border border-slate-200 p-1 text-left">Antibiograma</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-200 p-1">HEMOCULTURA AERÓBICA</td>
            <td className="border border-slate-200 p-1">FRASCO AZUL × 2</td>
            <td className="border border-slate-200 p-1">10 ML / FRASCO</td>
            <td className="border border-slate-200 p-1 font-bold" style={{ color: C.green }}>SIM</td>
          </tr>
          <tr>
            <td className="border border-slate-200 p-1">HEMOCULTURA ANAERÓBICA</td>
            <td className="border border-slate-200 p-1">FRASCO ROXO × 2</td>
            <td className="border border-slate-200 p-1">10 ML / FRASCO</td>
            <td className="border border-slate-200 p-1 font-bold" style={{ color: C.green }}>SIM</td>
          </tr>
          <tr>
            <td className="border border-slate-200 p-1">UROCULTURA (SVD)</td>
            <td className="border border-slate-200 p-1">FRASCO ESTÉRIL</td>
            <td className="border border-slate-200 p-1">10 ML</td>
            <td className="border border-slate-200 p-1 font-bold" style={{ color: C.green }}>SIM</td>
          </tr>
          <tr>
            <td className="border border-slate-200 p-1">ASPIRADO TRAQUEAL</td>
            <td className="border border-slate-200 p-1">FRASCO ESTÉRIL</td>
            <td className="border border-slate-200 p-1">2 ML</td>
            <td className="border border-slate-200 p-1 font-bold" style={{ color: C.green }}>SIM</td>
          </tr>
        </tbody>
      </table>

      <Section>Procedimento e Notificação CCIH</Section>
      <ul className="ml-3 list-disc space-y-0.5">
        <li>HIGIENIZAÇÃO COM CLOREXIDINA ALCOÓLICA 0,5% • TÉCNICA ASSÉPTICA</li>
        <li>COLETA ANTES DA PRÓXIMA DOSE DE ANTIBIÓTICO</li>
        <li>NOTIFICAÇÃO AUTOMÁTICA AO PAINEL CCIH (LGPD/CFM 1.821/2007)</li>
        <li>RESULTADO PRELIMINAR EM 48H — IDENTIFICAÇÃO E ANTIBIOGRAMA EM 72H</li>
      </ul>
    </DocFrame>
  );
}

export function AntimicrobialMockup() {
  return (
    <DocFrame
      docCode="ATM-20260505-1015"
      sector="UTI 2 • Leito L14"
      title="Guia de Antimicrobiano"
      subtitle="Solicitação à Farmácia / CCIH"
      signatures={["Médico Prescritor", "Farmácia Clínica", "CCIH — Aprovação"]}
    >
      <PatientHeader
        extra={<KV k="Cultura prévia" v="HEMOCULTURA EM ANDAMENTO (D2)" full />}
      />

      <Section>Antimicrobiano Solicitado</Section>
      <table className="w-full border-collapse text-[7px]">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="border border-slate-200 p-1 text-left">Princípio</th>
            <th className="border border-slate-200 p-1 text-left">Dose / Via</th>
            <th className="border border-slate-200 p-1 text-left">Posologia</th>
            <th className="border border-slate-200 p-1 text-left">Duração</th>
            <th className="border border-slate-200 p-1 text-left">Classe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-200 p-1 font-bold">PIPERACILINA-TAZOBACTAM</td>
            <td className="border border-slate-200 p-1">4,5 G EV</td>
            <td className="border border-slate-200 p-1">6/6H — INFUSÃO ESTENDIDA 4H</td>
            <td className="border border-slate-200 p-1">7 DIAS</td>
            <td className="border border-slate-200 p-1">RESTRITO</td>
          </tr>
          <tr>
            <td className="border border-slate-200 p-1 font-bold">VANCOMICINA</td>
            <td className="border border-slate-200 p-1">1 G EV</td>
            <td className="border border-slate-200 p-1">12/12H — INFUSÃO 60 MIN</td>
            <td className="border border-slate-200 p-1">7 DIAS</td>
            <td className="border border-slate-200 p-1">RESTRITO</td>
          </tr>
        </tbody>
      </table>

      <Section>Justificativa Clínica</Section>
      <p>
        SEPSE GRAVE COM FOCO PULMONAR, FALHA TERAPÊUTICA APÓS 72H DE CEFTRIAXONA + AZITROMICINA.
        SUSPEITA DE PNEUMONIA HOSPITALAR POR GERMES MULTIRRESISTENTES (PSEUDOMONAS / MRSA).
        DESCALONAMENTO CONFORME RESULTADO DE CULTURA.
      </p>

      <Section>Critérios de Reavaliação (CCIH)</Section>
      <ul className="ml-3 list-disc space-y-0.5">
        <li>REAVALIAÇÃO OBRIGATÓRIA EM 48-72H COM RESULTADO DE CULTURA</li>
        <li>DOSAGEM DE VANCOCINEMIA ANTES DA 4ª DOSE (META: VALE 15-20 MCG/ML)</li>
        <li>MONITORAR FUNÇÃO RENAL DIARIAMENTE (CR / DEPURAÇÃO)</li>
        <li>NOTIFICAÇÃO AUTOMÁTICA À FARMÁCIA E CCIH — TRILHA DE AUDITORIA</li>
      </ul>

      <div className="mt-2 rounded border-l-4 p-2 text-[7px]" style={{ borderLeftColor: C.red, background: "#fff5f5" }}>
        <p className="font-bold uppercase tracking-wider" style={{ color: C.red }}>
          ⚠ Antibiótico de uso restrito — requer aval da CCIH
        </p>
      </div>
    </DocFrame>
  );
}

export function TetanusSerumMockup() {
  return (
    <DocFrame
      docCode="SAT-20260505-1030"
      sector="UE Vertical • Leito C2-12"
      title="Soro Antitetânico — Solicitação"
      subtitle="Profilaxia Pós-Exposição"
      signatures={["Médico Solicitante", "Farmácia / Sala de Imunização", "Enfermagem"]}
    >
      <div className="mb-2 rounded-sm border border-slate-200 p-2" style={{ background: "#f8fafc" }}>
        <div className="grid grid-cols-3 gap-2">
          <KV k="Paciente" v="JOÃO PEDRO LIMA SILVA" full />
          <KV k="Prontuário" v="26-HMDM-000389-3" />
          <KV k="DN / Idade" v="08/11/1985 • 40a • M" />
          <KV k="Setor" v="UE VERTICAL • C2-12" />
          <KV k="Tipo de ferimento" v="LACERANTE • PROFUNDO • CONTAMINADO" />
          <KV k="Local" v="MMII DIREITO — REGIÃO PRÉ-TIBIAL" />
          <KV k="Tempo de evolução" v="6 HORAS" />
          <KV k="Vacinação prévia" v="DESCONHECIDA / INCERTA" />
          <KV k="Mecanismo" v="ACIDENTE COM PREGO ENFERRUJADO" />
        </div>
      </div>

      <Section>Indicação (Conforme Min. Saúde)</Section>
      <p>
        FERIMENTO DE ALTO RISCO (PROFUNDO, CONTAMINADO, COM CORPO ESTRANHO METÁLICO) EM PACIENTE
        COM HISTÓRIA VACINAL DESCONHECIDA → INDICADO IMUNIZAÇÃO PASSIVA + ATIVA.
      </p>

      <Section>Esquema Solicitado</Section>
      <table className="w-full border-collapse text-[7px]">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="border border-slate-200 p-1 text-left">Produto</th>
            <th className="border border-slate-200 p-1 text-left">Dose</th>
            <th className="border border-slate-200 p-1 text-left">Via</th>
            <th className="border border-slate-200 p-1 text-left">Local</th>
            <th className="border border-slate-200 p-1 text-left">Observação</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-200 p-1 font-bold">SORO ANTITETÂNICO (SAT) — EQUINO</td>
            <td className="border border-slate-200 p-1">5.000 UI</td>
            <td className="border border-slate-200 p-1">IM PROFUNDO</td>
            <td className="border border-slate-200 p-1">GLÚTEO ESQ.</td>
            <td className="border border-slate-200 p-1">TESTE DE SENSIBILIDADE PRÉVIO</td>
          </tr>
          <tr>
            <td className="border border-slate-200 p-1 font-bold">VACINA dT (DUPLA ADULTO)</td>
            <td className="border border-slate-200 p-1">0,5 ML</td>
            <td className="border border-slate-200 p-1">IM</td>
            <td className="border border-slate-200 p-1">DELTÓIDE D</td>
            <td className="border border-slate-200 p-1">ESQUEMA: 0 - 30 - 60 DIAS</td>
          </tr>
        </tbody>
      </table>

      <Section>Cuidados Pré e Pós-Aplicação</Section>
      <ul className="ml-3 list-disc space-y-0.5">
        <li>LIMPEZA ABUNDANTE DA FERIDA COM SF 0,9% E DESBRIDAMENTO</li>
        <li>OBSERVAÇÃO POR 30 MIN APÓS APLICAÇÃO DO SAT (RISCO DE ANAFILAXIA)</li>
        <li>MANTER ADRENALINA E HIDROCORTISONA À BEIRA-LEITO</li>
        <li>ORIENTAR PACIENTE QUANTO AO COMPLETAR ESQUEMA VACINAL EM 30 E 60 DIAS</li>
      </ul>
    </DocFrame>
  );
}

export function HemocomponentMockup() {
  return (
    <DocFrame
      docCode="HEMO-20260505-1045"
      sector="UTI 2 • Leito L14"
      title="Solicitação de Hemocomponentes"
      subtitle="Agência Transfusional — RDC 34/2014"
      signatures={["Médico Solicitante", "Hemoterapeuta", "Enfermagem Transfusional"]}
    >
      <PatientHeader
        extra={
          <>
            <KV k="Tipagem ABO/Rh" v="O POSITIVO" />
            <KV k="Anticorpos irregulares" v="NEGATIVOS" />
            <KV k="Histórico transfusional" v="2 CHs em 2024 — sem reação" />
          </>
        }
      />

      <Section>Hemocomponente Solicitado</Section>
      <table className="w-full border-collapse text-[7px]">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="border border-slate-200 p-1 text-left">Componente</th>
            <th className="border border-slate-200 p-1 text-center">Unidades</th>
            <th className="border border-slate-200 p-1 text-left">Modalidade</th>
            <th className="border border-slate-200 p-1 text-left">Especificações</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-200 p-1 font-bold">CONCENTRADO DE HEMÁCIAS (CH)</td>
            <td className="border border-slate-200 p-1 text-center">02</td>
            <td className="border border-slate-200 p-1 font-bold" style={{ color: C.orange }}>URGENTE</td>
            <td className="border border-slate-200 p-1">FILTRADO • IRRADIADO</td>
          </tr>
          <tr>
            <td className="border border-slate-200 p-1 font-bold">PLASMA FRESCO CONGELADO (PFC)</td>
            <td className="border border-slate-200 p-1 text-center">02</td>
            <td className="border border-slate-200 p-1 font-bold" style={{ color: C.orange }}>URGENTE</td>
            <td className="border border-slate-200 p-1">15 ML/KG</td>
          </tr>
        </tbody>
      </table>

      <Section>Indicação Clínica</Section>
      <p>
        HEMOGLOBINA 6,8 G/DL EM PACIENTE SÉPTICA, INSTÁVEL HEMODINAMICAMENTE, COM SINAIS DE
        HIPOPERFUSÃO TECIDUAL (LACTATO 4,2). META PÓS-TRANSFUSÃO: HB &gt; 8,0 G/DL. DISTÚRBIO DE
        COAGULAÇÃO ASSOCIADO: INR 2,4 — INDICADO PFC PARA CORREÇÃO ANTES DE PROCEDIMENTO.
      </p>

      <Section>Critérios e Monitorização</Section>
      <ul className="ml-3 list-disc space-y-0.5">
        <li>VERIFICAR PROVA CRUZADA E IDENTIFICAÇÃO DUPLA À BEIRA-LEITO</li>
        <li>SINAIS VITAIS: 0', 15', 30', 60' E AO TÉRMINO DA TRANSFUSÃO</li>
        <li>OBSERVAR REAÇÕES TRANSFUSIONAIS — SUSPENDER E NOTIFICAR EM CASO DE EVENTO</li>
        <li>HEMOGRAMA + COAGULOGRAMA DE CONTROLE 1H APÓS TÉRMINO</li>
      </ul>

      <div className="mt-2 rounded border-l-4 p-2 text-[7px]" style={{ borderLeftColor: C.red, background: "#fff5f5" }}>
        <p className="font-bold uppercase tracking-wider" style={{ color: C.red }}>
          ⚠ Termo de consentimento informado obrigatório — anexado ao prontuário
        </p>
      </div>
    </DocFrame>
  );
}
