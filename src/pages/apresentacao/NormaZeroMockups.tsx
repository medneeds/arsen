import { whitelabel } from "@/config/whitelabel";
import socorraoCross from "@/assets/socorrao-cross-logo.png";

const C = whitelabel.theme.institutionalColors;

/* ============================================================
 * Mockups de PDF Norma Zero — para a apresentação institucional
 * Renderizados em escala dentro dos slides 16:9.
 * Replicam fielmente a estrutura visual de printNormaZero.ts
 * (header com 5 cores, doc-bar, h2 azul #0054A6, tabelas .nz,
 * bloco de assinaturas e rodapé MAN.05-001).
 * Tipografia ampliada — foco em visibilidade durante a defesa.
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
      className="mx-auto flex h-full w-full flex-col overflow-hidden rounded-lg bg-white text-slate-900 shadow-2xl ring-1 ring-slate-300"
      style={{ aspectRatio: "1 / 1.414" }}
    >
      {/* HEADER */}
      <div className="flex items-stretch gap-4 px-6 pt-5">
        <img src={socorraoCross} alt="HMDM" className="h-16 w-16 flex-none object-contain" />
        <div className="flex-1 text-center leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            {whitelabel.print.institutionalHeader.line1}
          </p>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
            {whitelabel.print.institutionalHeader.line2}
          </p>
          <p className="mt-0.5 text-[14px] font-black uppercase tracking-tight text-slate-900">
            {whitelabel.print.institutionalHeader.line3}
          </p>
        </div>
        <div className="h-16 w-4" />
      </div>

      {/* CRUZ COLORIDA — 5 cores institucionais */}
      <div className="mt-3 flex h-2 w-full">
        <span className="flex-1" style={{ background: C.red }} />
        <span className="flex-1" style={{ background: C.orange }} />
        <span className="flex-1" style={{ background: C.yellow }} />
        <span className="flex-1" style={{ background: C.green }} />
        <span className="flex-1" style={{ background: C.blue }} />
      </div>

      {/* DOC-BAR */}
      <div className="flex items-center justify-between bg-slate-100 px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        <span>Doc.: {docCode}</span>
        <span>{sector}</span>
        <span>Emissão {dt}</span>
      </div>

      {/* TÍTULO */}
      <div className="border-b border-slate-200 px-6 py-4 text-center">
        <h1 className="text-[20px] font-black uppercase tracking-tight text-slate-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {/* CORPO */}
      <div className="nz-body flex-1 overflow-hidden px-6 py-4 text-[11px] leading-relaxed text-slate-800">
        {children}
      </div>

      {/* ASSINATURAS */}
      <div className="grid gap-4 px-6 pb-3 pt-2" style={{ gridTemplateColumns: `repeat(${signatures.length}, minmax(0, 1fr))` }}>
        {signatures.map((s) => (
          <div key={s} className="text-center">
            <div className="mx-auto h-px w-full bg-slate-400" />
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">{s}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-400">CRM • Carimbo</p>
          </div>
        ))}
      </div>

      {/* RODAPÉ */}
      <div
        className="flex items-center justify-between border-t border-slate-200 px-6 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500"
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
      className="mb-2 mt-3 rounded-sm px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white"
      style={{ background: "#0054A6" }}
    >
      {children}
    </h2>
  );
}

function KV({ k, v, full = false }: { k: string; v: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-3" : ""}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{k}</p>
      <p className="text-[11px] font-semibold text-slate-900">{v}</p>
    </div>
  );
}

function PatientHeader({ extra }: { extra?: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-md border border-slate-200 p-3" style={{ background: "#f8fafc" }}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        <KV k="Paciente" v="MARIA DAS GRAÇAS PEREIRA SOUSA" full />
        <KV k="Prontuário" v="26-HMDM-000142-7" />
        <KV k="Atendimento" v="000000000823" />
        <KV k="DN / Idade / Sexo" v="14/03/1958 • 67a • F" />
        <KV k="Setor / Leito" v="UTI 2 • L14" />
        <KV k="Peso" v="62 kg" />
        <KV k="CID-10 principal" v="A41.9 — SEPSE NÃO ESPECIFICADA" full />
        {extra}
      </div>
    </div>
  );
}

/* ===== Tabelas reutilizáveis ============================== */

function NzTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-[10.5px]">
      <thead className="bg-slate-100 text-slate-700">
        <tr>
          {head.map((h, i) => (
            <th key={i} className="border border-slate-200 p-1.5 text-left font-bold uppercase tracking-wider">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i % 2 ? "bg-slate-50/60" : ""}>
            {r.map((c, j) => (
              <td key={j} className="border border-slate-200 p-1.5 align-top">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ===== Mockups individuais ================================ */

export function PrescriptionMockup() {
  return (
    <DocFrame
      docCode="PRESC-20260505-0830"
      sector="UTI 2 • Leito L14"
      title="Prescrição Médica"
      subtitle="Hospital Municipal Djalma Marques – Socorrão I"
      signatures={["Médico Assistente", "Farmácia Clínica", "Enfermagem"]}
    >
      <PatientHeader />

      <Section>1. Dieta e Cuidados</Section>
      <p>DIETA ENTERAL POR SNE 1.500 KCAL/DIA • CABECEIRA 30° • HIGIENE ORAL COM CLOREXIDINA 0,12% 12/12H.</p>

      <Section>2. Hidratação</Section>
      <NzTable
        head={["Solução", "Diluição", "Via / Velocidade", "Aprazamento"]}
        rows={[["SF 0,9% 1000 ML", "+ KCl 19,1% 10 ML", "EV BIC • 80 ML/H", "CONTÍNUO 24H"]]}
      />

      <Section>3. Medicamentos</Section>
      <NzTable
        head={["Princípio Ativo", "Dose", "Via", "Frequência", "Diluição / Tempo"]}
        rows={[
          ["CEFTRIAXONA", "2 g", "EV", "12/12h", "SF 0,9% 100 mL — 30 min"],
          ["AZITROMICINA", "500 mg", "EV", "1×/dia", "SG 5% 250 mL — 60 min"],
          ["NORADRENALINA", "16 mg", "EV BIC", "Contínuo", "+ SG 5% 250 mL — 0,3 mcg/kg/min"],
          ["OMEPRAZOL", "40 mg", "EV", "1×/dia", "Bolus lento 5 min"],
          ["ENOXAPARINA", "40 mg", "SC", "1×/dia", "—"],
        ]}
      />

      <Section>4. Profilaxias</Section>
      <p>TEV: ENOXAPARINA 40 MG SC • TGI: OMEPRAZOL 40 MG EV • SINAIS VITAIS 2/2H • DIURESE HORÁRIA • LACTATO 6/6H.</p>
    </DocFrame>
  );
}

export function EvolutionMockup() {
  // Reflete o formato REAL atual da plataforma:
  // Sinais Vitais → Evolução (subjetivo + avaliação unificados) →
  // Exame Físico → Exames Complementares → Plano
  return (
    <DocFrame
      docCode="EVOL-20260505-0915"
      sector="UTI 2 • Leito L14"
      title="Evolução Clínica"
      subtitle="Registro de evolução — 3º DIH em UTI"
      signatures={["Médico Plantonista", "Coordenação UTI"]}
    >
      <PatientHeader />

      <Section>Sinais Vitais</Section>
      <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px]">
        PA 118/74 mmHg • FC 88 bpm • FR 16 irpm • SpO₂ 96% • T 36,8°C • Glasgow 11T • Diurese 1.450 mL/24h
      </div>

      <Section>Evolução</Section>
      <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2 leading-relaxed">
        Paciente em VM, sedada (RASS −2), sem queixas da equipe. <strong>Sepse pulmonar em D3 de ATB com
        evolução favorável</strong> — PCR 142 → 98 e procalcitonina 2,1 → 1,4. Choque séptico em resolução,
        em desmame de noradrenalina. IRA AKI 1 com diurese preservada. Estável hemodinamicamente.
      </div>

      <Section>Exame Físico</Section>
      <table className="w-full border-collapse text-[10.5px]">
        <tbody>
          <tr>
            <th className="w-[120px] border border-slate-200 bg-slate-100 p-1.5 text-left">Cardiovascular</th>
            <td className="border border-slate-200 p-1.5">RCR 2T BNF, sem sopros</td>
          </tr>
          <tr>
            <th className="border border-slate-200 bg-slate-100 p-1.5 text-left">Respiratório</th>
            <td className="border border-slate-200 p-1.5">MV+ bilateral, estertores em base direita</td>
          </tr>
          <tr>
            <th className="border border-slate-200 bg-slate-100 p-1.5 text-left">Neurológico</th>
            <td className="border border-slate-200 p-1.5">Sedada, RASS −2, pupilas isocóricas fotorreagentes</td>
          </tr>
        </tbody>
      </table>

      <Section>Exames Complementares</Section>
      <p>Hb 9,8 • Leu 14.200 (8% bast.) • Plaq 165k • Cr 1,1 • U 58 • Na 138 • K 4,2 • Lac 1,8 • PCR 98 • Procalcitonina 1,4.</p>

      <Section>Plano</Section>
      <ul className="ml-4 list-disc space-y-1">
        <li>MANTER CEFTRIAXONA + AZITROMICINA — REAVALIAR EM D5</li>
        <li>REDUZIR NORADRENALINA 0,3 → 0,2 MCG/KG/MIN CONFORME PA</li>
        <li>INICIAR DESPERTAR DIÁRIO — PROTOCOLO ABCDEF</li>
        <li>RX TÓRAX CONTROLE • GASOMETRIA EM 6H • SAPS 3: 52 • NEWS2: 4</li>
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
      subtitle="Solicitação ao Laboratório"
      signatures={["Médico Solicitante", "Coleta — Enfermagem", "Laboratório"]}
    >
      <PatientHeader />

      <Section>Indicação Clínica</Section>
      <p>CONTROLE EVOLUTIVO DE SEPSE PULMONAR EM D3 DE ANTIBIOTICOTERAPIA. AVALIAÇÃO DE FUNÇÃO RENAL, ELETRÓLITOS E RESPOSTA INFLAMATÓRIA.</p>

      <Section>Exames Solicitados</Section>
      <NzTable
        head={["Categoria", "Exame", "Urgência"]}
        rows={[
          ["HEMATOLOGIA", "HEMOGRAMA COMPLETO COM PLAQUETAS", "URGENTE"],
          ["BIOQUÍMICA", "UREIA, CREATININA, NA, K, MG", "ROTINA"],
          ["INFLAMATÓRIO", "PCR + PROCALCITONINA", "URGENTE"],
          ["GASOMETRIA", "GASOMETRIA ARTERIAL + LACTATO", "URGENTE"],
          ["HEPÁTICO", "TGO, TGP, BILIRRUBINAS, FA, GGT", "ROTINA"],
          ["COAGULAÇÃO", "TAP/INR, TTPA", "ROTINA"],
        ]}
      />

      <Section>Prazo / Observações</Section>
      <p>COLETA IMEDIATA • RESULTADO DOS URGENTES EM ATÉ 2H • DEMAIS NA ROTINA DA MANHÃ • CIÊNCIA MÉDICA OBRIGATÓRIA NO PAINEL CLÍNICO.</p>
    </DocFrame>
  );
}

export function CultureMockup() {
  return (
    <DocFrame
      docCode="CULT-20260505-1000"
      sector="UTI 2 • Leito L14"
      title="Solicitação de Cultura Microbiológica"
      subtitle="Notificação automática à CCIH"
      signatures={["Médico Solicitante", "Coleta — Enfermagem", "Microbiologia"]}
    >
      <PatientHeader />

      <Section>Sítio e Material</Section>
      <div className="grid grid-cols-2 gap-3">
        <KV k="Material" v="HEMOCULTURA — 2 PARES (PERIFÉRICA + CVC)" />
        <KV k="Sítio" v="ANTECUBITAL D + CVC SUBCLÁVIA D" />
        <KV k="Hipótese" v="BACTEREMIA / SEPSE PULMONAR" />
        <KV k="ATB em uso" v="CEFTRIAXONA + AZITROMICINA (D3)" />
      </div>

      <Section>Culturas Solicitadas</Section>
      <NzTable
        head={["Tipo", "Frasco / Volume", "Antibiograma"]}
        rows={[
          ["HEMOCULTURA AERÓBICA", "FRASCO AZUL × 2 — 10 mL", "SIM"],
          ["HEMOCULTURA ANAERÓBICA", "FRASCO ROXO × 2 — 10 mL", "SIM"],
          ["UROCULTURA (SVD)", "FRASCO ESTÉRIL — 10 mL", "SIM"],
          ["ASPIRADO TRAQUEAL", "FRASCO ESTÉRIL — 2 mL", "SIM"],
        ]}
      />

      <Section>Procedimento e CCIH</Section>
      <ul className="ml-4 list-disc space-y-1">
        <li>HIGIENIZAÇÃO COM CLOREXIDINA ALCOÓLICA 0,5% • TÉCNICA ASSÉPTICA</li>
        <li>COLETA ANTES DA PRÓXIMA DOSE DE ANTIBIÓTICO</li>
        <li>NOTIFICAÇÃO AUTOMÁTICA AO PAINEL CCIH (CFM 1.821/2007 • LGPD)</li>
        <li>RESULTADO PRELIMINAR EM 48H — IDENTIFICAÇÃO + ANTIBIOGRAMA EM 72H</li>
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
      <PatientHeader extra={<KV k="Cultura prévia" v="HEMOCULTURA EM ANDAMENTO (D2)" full />} />

      <Section>Antimicrobiano Solicitado</Section>
      <NzTable
        head={["Princípio", "Dose / Via", "Posologia", "Duração", "Classe"]}
        rows={[
          ["PIPERACILINA-TAZOBACTAM", "4,5 g EV", "6/6h — infusão estendida 4h", "7 dias", "RESTRITO"],
          ["VANCOMICINA", "1 g EV", "12/12h — infusão 60 min", "7 dias", "RESTRITO"],
        ]}
      />

      <Section>Justificativa Clínica</Section>
      <p>SEPSE GRAVE COM FOCO PULMONAR, FALHA TERAPÊUTICA APÓS 72H DE CEFTRIAXONA + AZITROMICINA. SUSPEITA DE PNEUMONIA HOSPITALAR POR GERMES MULTIRRESISTENTES (PSEUDOMONAS / MRSA). DESCALONAMENTO CONFORME RESULTADO DE CULTURA.</p>

      <Section>Critérios de Reavaliação</Section>
      <ul className="ml-4 list-disc space-y-1">
        <li>REAVALIAÇÃO OBRIGATÓRIA EM 48-72H COM RESULTADO DE CULTURA</li>
        <li>VANCOCINEMIA ANTES DA 4ª DOSE — META VALE 15-20 MCG/ML</li>
        <li>FUNÇÃO RENAL DIÁRIA • TRILHA DE AUDITORIA À CCIH</li>
      </ul>

      <div className="mt-3 rounded border-l-4 p-2.5 text-[10.5px] font-bold uppercase tracking-wider"
        style={{ borderLeftColor: C.red, background: "#fff5f5", color: C.red }}>
        ⚠ Antibiótico de uso restrito — requer aval da CCIH
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
      subtitle="Profilaxia pós-exposição (Min. Saúde)"
      signatures={["Médico Solicitante", "Sala de Imunização", "Enfermagem"]}
    >
      <div className="mb-3 rounded-md border border-slate-200 p-3" style={{ background: "#f8fafc" }}>
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          <KV k="Paciente" v="JOÃO PEDRO LIMA SILVA" full />
          <KV k="Prontuário" v="26-HMDM-000389-3" />
          <KV k="DN / Idade / Sexo" v="08/11/1985 • 40a • M" />
          <KV k="Setor" v="UE VERTICAL • C2-12" />
          <KV k="Tipo de ferimento" v="LACERANTE • PROFUNDO • CONTAMINADO" />
          <KV k="Local" v="MMII D — REGIÃO PRÉ-TIBIAL" />
          <KV k="Tempo de evolução" v="6 HORAS" />
          <KV k="Vacinação prévia" v="DESCONHECIDA" />
          <KV k="Mecanismo" v="PREGO ENFERRUJADO" />
        </div>
      </div>

      <Section>Indicação</Section>
      <p>FERIMENTO DE ALTO RISCO (PROFUNDO, CONTAMINADO, COM CORPO ESTRANHO METÁLICO) EM PACIENTE COM HISTÓRIA VACINAL DESCONHECIDA → INDICADO IMUNIZAÇÃO PASSIVA + ATIVA.</p>

      <Section>Esquema Solicitado</Section>
      <NzTable
        head={["Produto", "Dose", "Via", "Local", "Observação"]}
        rows={[
          ["SAT — EQUINO", "5.000 UI", "IM PROFUNDO", "GLÚTEO E", "Teste de sensibilidade prévio"],
          ["VACINA dT (DUPLA ADULTO)", "0,5 mL", "IM", "DELTÓIDE D", "Esquema: 0 - 30 - 60 dias"],
        ]}
      />

      <Section>Cuidados Pós-Aplicação</Section>
      <ul className="ml-4 list-disc space-y-1">
        <li>LIMPEZA ABUNDANTE COM SF 0,9% E DESBRIDAMENTO DA FERIDA</li>
        <li>OBSERVAÇÃO POR 30 MIN APÓS SAT — RISCO DE ANAFILAXIA</li>
        <li>ADRENALINA E HIDROCORTISONA À BEIRA-LEITO</li>
        <li>ORIENTAR RETORNO PARA COMPLETAR ESQUEMA EM 30 E 60 DIAS</li>
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
      signatures={["Médico Solicitante", "Hemoterapeuta", "Enf. Transfusional"]}
    >
      <PatientHeader
        extra={
          <>
            <KV k="Tipagem ABO/Rh" v="O POSITIVO" />
            <KV k="Anticorpos irregulares" v="NEGATIVOS" />
            <KV k="Histórico" v="2 CHs em 2024 — sem reação" />
          </>
        }
      />

      <Section>Componente Solicitado</Section>
      <NzTable
        head={["Componente", "Unidades", "Modalidade", "Especificações"]}
        rows={[
          ["CONCENTRADO DE HEMÁCIAS (CH)", "02", "URGENTE", "FILTRADO • IRRADIADO"],
          ["PLASMA FRESCO CONGELADO (PFC)", "02", "URGENTE", "15 mL/kg"],
        ]}
      />

      <Section>Indicação Clínica</Section>
      <p>HEMOGLOBINA 6,8 G/DL EM PACIENTE SÉPTICA, INSTÁVEL HEMODINAMICAMENTE, COM SINAIS DE HIPOPERFUSÃO TECIDUAL (LACTATO 4,2). META PÓS-TRANSFUSÃO: HB &gt; 8,0 G/DL. INR 2,4 — INDICADO PFC PARA CORREÇÃO ANTES DE PROCEDIMENTO.</p>

      <Section>Critérios e Monitorização</Section>
      <ul className="ml-4 list-disc space-y-1">
        <li>PROVA CRUZADA E IDENTIFICAÇÃO DUPLA À BEIRA-LEITO</li>
        <li>SINAIS VITAIS: 0', 15', 30', 60' E AO TÉRMINO</li>
        <li>SUSPENDER E NOTIFICAR EM CASO DE REAÇÃO TRANSFUSIONAL</li>
        <li>HEMOGRAMA + COAGULOGRAMA DE CONTROLE 1H APÓS TÉRMINO</li>
      </ul>

      <div className="mt-3 rounded border-l-4 p-2.5 text-[10.5px] font-bold uppercase tracking-wider"
        style={{ borderLeftColor: C.red, background: "#fff5f5", color: C.red }}>
        ⚠ Termo de consentimento informado obrigatório — anexado ao prontuário
      </div>
    </DocFrame>
  );
}
