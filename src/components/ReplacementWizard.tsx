import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlaskConical, Sparkles, BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MedicationEntry } from "@/data/medicationsDatabase";

type Disorder = "hipoK" | "hipoMg" | "hipoCa" | "hipoNa" | "hipoP" | "hiperK" | "hiperNa" | "acidose";
type Severity = "leve" | "moderada" | "grave";

const DISORDERS: { key: Disorder; label: string; detail: string }[] = [
  { key: "hipoK", label: "Hipocalemia", detail: "K⁺ < 3,5 mEq/L" },
  { key: "hipoMg", label: "Hipomagnesemia", detail: "Mg < 1,7 mg/dL" },
  { key: "hipoCa", label: "Hipocalcemia", detail: "Ca iônico baixo" },
  { key: "hipoNa", label: "Hiponatremia", detail: "Na < 135 mEq/L" },
  { key: "hipoP", label: "Hipofosfatemia", detail: "P < 2,5 mg/dL" },
  { key: "hiperK", label: "Hipercalemia", detail: "K⁺ > 5,5 mEq/L" },
  { key: "hiperNa", label: "Hipernatremia", detail: "Na > 145 mEq/L" },
  { key: "acidose", label: "Acidose metabólica", detail: "HCO₃⁻ baixo, pH < 7,30" },
];

interface RecipeItem {
  name: string;
  presentation: string;
  dose: string;
  route: string;
  posology: string;
  instructions: string;
}

interface SuggestionOption {
  id: string;
  title: string;        // Ex: "Reposição EV via periférico — esquema padrão"
  rationale: string;    // 1 linha de embasamento
  source: string;       // Ex: "UpToDate 2024 · AMIB"
  items: RecipeItem[];  // 1 ou + itens (ex: combinações)
}

/**
 * Bibliotecas de prescrições sugeridas — baseadas em práticas amplamente aceitas
 * (UpToDate, Surviving Sepsis Campaign 2021, AMIB/SBC, KDIGO, Endocrine Society).
 * Cada distúrbio + gravidade oferece 2-3 opções padronizadas para escolha.
 */
function buildSuggestions(d: Disorder, sev: Severity, value: string): SuggestionOption[] {
  const v = value || "—";

  switch (d) {
    case "hipoK": {
      if (sev === "leve") return [
        {
          id: "hipoK-leve-vo-xpe",
          title: "Reposição oral — xarope KCl 6%",
          rationale: "K 3,0–3,4 sem sintomas: via oral é segura e eficaz; cada 1 mEq/L abaixo de 4,0 ≈ déficit de 200–400 mEq corporal total.",
          source: "UpToDate · AMIB",
          items: [{ name: "Cloreto de Potássio xarope 6%", presentation: "Frasco 150 mL (6 mEq/5 mL)", dose: "15 mL (≈ 18 mEq)", route: "Oral", posology: "8/8h", instructions: `Diluir em suco/água. Reavaliar K em 24h. K atual: ${v}.` }],
        },
        {
          id: "hipoK-leve-vo-slow",
          title: "Reposição oral — Slow-K 600 mg",
          rationale: "Comprimido de liberação lenta: melhor tolerância gástrica, dose equivalente prática.",
          source: "Bulário · prática hospitalar",
          items: [{ name: "Cloreto de Potássio 600 mg (Slow-K)", presentation: "Comprimido revestido (≈ 8 mEq)", dose: "1 comp", route: "Oral", posology: "8/8h", instructions: `Tomar com alimento, água abundante. Reavaliar K em 24h. K atual: ${v}.` }],
        },
        {
          id: "hipoK-leve-ev-perif",
          title: "Reposição EV diluída — periférico",
          rationale: "Alternativa para paciente com intolerância oral; respeita limite de 40 mEq/L em periférico para evitar flebite.",
          source: "UpToDate · ASPEN",
          items: [{ name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10 mL — Ampola (2,5 mEq/mL = 25 mEq/amp)", dose: "10 mL (≈ 25 mEq)", route: "Intravenosa", posology: "Dose única, em 4h", instructions: `Diluir em 500 mL SF 0,9% (concentração 50 mEq/L). NUNCA bolus. Acesso periférico. K atual: ${v}.` }],
        },
      ];
      if (sev === "moderada") return [
        {
          id: "hipoK-mod-perif",
          title: "Reposição EV — periférico (esquema padrão)",
          rationale: "K 2,5–2,9: padrão é 10 mEq/h em periférico, repetir até K ≥ 4,0. Limite seguro fora de monitor: 10 mEq/h.",
          source: "UpToDate · AMIB",
          items: [{ name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10 mL — Ampola (25 mEq)", dose: "8 mL (≈ 20 mEq)", route: "Intravenosa", posology: "8/8h", instructions: `Diluir em 250 mL SF 0,9% (80 mEq/L). Infundir em 2h (10 mEq/h). NUNCA bolus. Reavaliar K antes de nova dose. K atual: ${v}.` }],
        },
        {
          id: "hipoK-mod-cvc",
          title: "Reposição EV — central monitorizado",
          rationale: "CVC + monitor permite até 20 mEq/h, acelerando correção em paciente sintomático ou em UTI.",
          source: "UpToDate · ESICM",
          items: [{ name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10 mL — Ampola (25 mEq)", dose: "16 mL (40 mEq)", route: "Intravenosa", posology: "Em 2h, repetir SOS", instructions: `Diluir em 100 mL SF 0,9% (400 mEq/L) — APENAS via CVC. Monitor cardíaco contínuo. K capilar/sérico 2h após. K atual: ${v}.` }],
        },
        {
          id: "hipoK-mod-combo",
          title: "Combinada — KCl EV + Mg (corrige refratariedade)",
          rationale: "Hipomagnesemia coexiste em até 40% dos casos e impede a correção do K; reposição conjunta de Mg é prática consagrada.",
          source: "UpToDate · NEJM 2015",
          items: [
            { name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10 mL — Ampola (25 mEq)", dose: "8 mL (20 mEq)", route: "Intravenosa", posology: "8/8h", instructions: `Diluir em 250 mL SF 0,9%. Infundir em 2h. K atual: ${v}.` },
            { name: "Sulfato de Magnésio 50%", presentation: "10 mL — Ampola (4 mEq/mL = 2 g/amp)", dose: "1 amp (2 g)", route: "Intravenosa", posology: "Dose única", instructions: "Diluir em 100 mL SF 0,9%. Infundir em 1h." },
          ],
        },
      ];
      // grave
      return [
        {
          id: "hipoK-grave-cvc",
          title: "EV alta dose — CVC monitorizado (urgência)",
          rationale: "K < 2,5 com arritmia/fraqueza: indica CVC, monitor contínuo e até 20 mEq/h. Evitar SG (hiperinsulinemia agrava).",
          source: "UpToDate · AMIB UTI",
          items: [{ name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10 mL — Ampola (25 mEq)", dose: "16 mL (40 mEq)", route: "Intravenosa", posology: "Em 2h, repetir 4/4h até K ≥ 4,0", instructions: `Diluir em 100 mL SF 0,9% — APENAS CVC. Monitor cardíaco contínuo. ECG 12 deriv pré e pós. K sérico 2/2h. K atual: ${v}.` }],
        },
        {
          id: "hipoK-grave-bic",
          title: "BIC contínua — UTI",
          rationale: "Reposição em bomba de infusão contínua minimiza picos plasmáticos; padrão UTI para K refratário.",
          source: "AMIB · ESICM",
          items: [{ name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10 mL — Ampola (25 mEq)", dose: "40 mL (100 mEq)", route: "Intravenosa", posology: "BIC em 10h (10 mEq/h)", instructions: `Diluir em 250 mL SF 0,9% (400 mEq/L) — CVC obrigatório. Monitor contínuo. Suspender se K ≥ 4,5. K atual: ${v}.` }],
        },
        {
          id: "hipoK-grave-combo",
          title: "Combinada — KCl + Mg + reavaliar diuréticos",
          rationale: "Sempre repor Mg na hipocalemia grave; revisar perdas (diurético de alça, vômitos, fístulas).",
          source: "NEJM · UpToDate",
          items: [
            { name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10 mL — Ampola (25 mEq)", dose: "16 mL (40 mEq)", route: "Intravenosa", posology: "Em 2h, repetir 4/4h", instructions: `Diluir em 100 mL SF 0,9%. CVC + monitor. K atual: ${v}.` },
            { name: "Sulfato de Magnésio 50%", presentation: "10 mL — Ampola (2 g)", dose: "2 amp (4 g)", route: "Intravenosa", posology: "Em 4h", instructions: "Diluir em 250 mL SF 0,9%. Reavaliar Mg em 6h." },
          ],
        },
      ];
    }

    case "hipoMg": {
      if (sev === "leve") return [
        {
          id: "hipoMg-leve-vo",
          title: "Reposição oral — Óxido de Magnésio",
          rationale: "Mg 1,5–1,7 assintomático: VO bem tolerado; principal efeito adverso é diarreia.",
          source: "UpToDate",
          items: [{ name: "Óxido de Magnésio 400 mg", presentation: "Comprimido (≈ 240 mg Mg elementar)", dose: "1 comp", route: "Oral", posology: "12/12h", instructions: `Tomar com alimento. Suspender se diarreia. Mg atual: ${v}.` }],
        },
        {
          id: "hipoMg-leve-ev",
          title: "Reposição EV de manutenção",
          rationale: "Pacientes hospitalizados sem VO: EV diluído em infusão lenta é seguro.",
          source: "AMIB",
          items: [{ name: "Sulfato de Magnésio 50%", presentation: "10 mL — Ampola (2 g)", dose: "1 amp (2 g)", route: "Intravenosa", posology: "24/24h", instructions: `Diluir em 100 mL SF 0,9%. Infundir em 2h. Mg atual: ${v}.` }],
        },
      ];
      if (sev === "moderada") return [
        {
          id: "hipoMg-mod-padrao",
          title: "EV — esquema padrão hospitalar",
          rationale: "Mg 1,0–1,4: 4 g em 4h é o regime mais difundido em enfermaria/UTI.",
          source: "UpToDate · AMIB",
          items: [{ name: "Sulfato de Magnésio 50%", presentation: "10 mL — Ampola (2 g)", dose: "2 amp (4 g)", route: "Intravenosa", posology: "Em 4h", instructions: `Diluir em 250 mL SF 0,9%. Reavaliar em 6-12h. Mg atual: ${v}.` }],
        },
        {
          id: "hipoMg-mod-cardio",
          title: "EV — paciente cardiopata (TdP, IAM)",
          rationale: "Em arritmia ventricular polimórfica/IAM, dose de ataque mais rápida demonstra benefício.",
          source: "AHA · ESC",
          items: [{ name: "Sulfato de Magnésio 50%", presentation: "10 mL — Ampola (2 g)", dose: "1 amp (2 g)", route: "Intravenosa", posology: "Em 15 min, depois 4 g em 4h", instructions: `Bolus diluído em 100 mL SG 5%. Manutenção 4 g em 250 mL SF 0,9% em 4h. Monitor cardíaco. Mg atual: ${v}.` }],
        },
      ];
      return [
        {
          id: "hipoMg-grave-padrao",
          title: "EV alta dose — Mg < 1,0 sintomático",
          rationale: "Padrão em UTI: 8 g em 4-6h, com monitorização de reflexos e função renal.",
          source: "UpToDate · ESICM",
          items: [{ name: "Sulfato de Magnésio 50%", presentation: "10 mL — Ampola (2 g)", dose: "4 amp (8 g)", route: "Intravenosa", posology: "Em 4h", instructions: `Diluir em 500 mL SF 0,9%. Monitor cardíaco. Reflexos patelares 1/1h. Suspender se ClCr < 30 e reavaliar dose. Mg atual: ${v}.` }],
        },
        {
          id: "hipoMg-grave-tdp",
          title: "Torsade de pointes — bolus + manutenção",
          rationale: "Em TdP: 2 g bolus rápido seguido de manutenção; protocolo ACLS.",
          source: "AHA ACLS 2020",
          items: [
            { name: "Sulfato de Magnésio 50%", presentation: "10 mL — Ampola (2 g)", dose: "1 amp (2 g)", route: "Intravenosa", posology: "Bolus em 5 min", instructions: "Diluir em 50 mL SG 5%. Repetir em 5-15 min se persistir." },
            { name: "Sulfato de Magnésio 50%", presentation: "10 mL — Ampola (2 g)", dose: "4 g", route: "Intravenosa", posology: "BIC em 8h (0,5 g/h)", instructions: `Diluir em 500 mL SF 0,9%. Mg atual: ${v}.` },
          ],
        },
      ];
    }

    case "hipoCa": {
      const isGrave = sev === "grave";
      return [
        {
          id: "hipoCa-glu-padrao",
          title: "Gluconato de Cálcio EV — padrão",
          rationale: "Gluconato é menos esclerosante que cloreto; primeira escolha em via periférica.",
          source: "UpToDate · AMIB",
          items: [{ name: "Gluconato de Cálcio 10%", presentation: "10 mL — Ampola (≈ 90 mg Ca elementar)", dose: isGrave ? "2 amp (1.000 mg sal)" : "1 amp (1.000 mg sal)", route: "Intravenosa", posology: isGrave ? "Em 30 min, repetir SOS" : "8/8h", instructions: `Diluir em 100 mL SG 5%. Infundir em 30-60 min. INCOMPATÍVEL com bicarbonato/fosfato. Ca iônico: ${v}.` }],
        },
        {
          id: "hipoCa-bic",
          title: "BIC contínua — Ca refratário ou pós-paratireoidectomia",
          rationale: "Manutenção em 0,5–1,5 mg/kg/h de Ca elementar evita oscilações.",
          source: "Endocrine Society",
          items: [{ name: "Gluconato de Cálcio 10%", presentation: "10 mL — Ampola (90 mg Ca elementar)", dose: "11 amp (≈ 1 g Ca elementar)", route: "Intravenosa", posology: "BIC em 10h", instructions: `Diluir em 1000 mL SG 5%. Velocidade 50–100 mg Ca elementar/h. Ca iônico 6/6h. Ca atual: ${v}.` }],
        },
        {
          id: "hipoCa-vo",
          title: "VO — manutenção e quadros leves",
          rationale: "Para hipocalcemia crônica ou após estabilização EV; sempre associar vitamina D ativa se hipoparatireoidismo.",
          source: "Endocrine Society",
          items: [
            { name: "Carbonato de Cálcio 1.250 mg", presentation: "Comprimido (500 mg Ca elementar)", dose: "1 comp", route: "Oral", posology: "8/8h", instructions: `Tomar com alimento (melhora absorção). Ca iônico: ${v}.` },
            { name: "Calcitriol", presentation: "Cápsula 0,25 mcg", dose: "0,25–0,5 mcg", route: "Oral", posology: "12/12h", instructions: "Associar se hipoparatireoidismo. Monitorar Ca e P semanalmente." },
          ],
        },
      ];
    }

    case "hipoNa": {
      if (sev === "grave") return [
        {
          id: "hipoNa-grave-bolus3",
          title: "NaCl 3% — bolus em sintomático grave",
          rationale: "Sintomas neurológicos (convulsão, coma): bolus de 100–150 mL de salina 3%, repetir até elevar Na em 4–6 mEq/L.",
          source: "European HNa Guidelines 2014 · UpToDate",
          items: [{ name: "NaCl 3% (hipertônica)", presentation: "Solução preparada (100–150 mL)", dose: "150 mL", route: "Intravenosa", posology: "Bolus em 10-20 min, repetir até 3x", instructions: `Meta: ↑Na 4-6 mEq/L em 6h, máximo 8 mEq/L em 24h (risco de mielinólise). Na atual: ${v}.` }],
        },
        {
          id: "hipoNa-grave-bic",
          title: "NaCl 3% — BIC após bolus",
          rationale: "Após bolus inicial, manter infusão controlada para evitar correção excessiva.",
          source: "AMIB UTI",
          items: [{ name: "NaCl 3% (hipertônica)", presentation: "Solução preparada", dose: "Calcular: ΔNa desejado × 0,6 × peso ÷ 513", route: "Intravenosa", posology: "BIC", instructions: `Velocidade 15–30 mL/h. Na sérico 2/2h. Reduzir/parar se ↑Na > 8 mEq/24h. Na atual: ${v}.` }],
        },
      ];
      if (sev === "moderada") return [
        {
          id: "hipoNa-mod-restricao",
          title: "Restrição hídrica (SIADH/dilucional)",
          rationale: "Hiponatremia euvolêmica/dilucional: restrição hídrica 800–1000 mL/dia é primeira linha.",
          source: "UpToDate",
          items: [{ name: "Restrição hídrica + dieta normossódica", presentation: "Plano clínico", dose: "≤ 1000 mL/24h", route: "—", posology: "—", instructions: `Investigar SIADH, hipotireoidismo, ICC. Na atual: ${v}.` }],
        },
        {
          id: "hipoNa-mod-sf",
          title: "SF 0,9% — hipovolêmica",
          rationale: "Hiponatremia hipovolêmica responde à reposição de volume com SF 0,9%.",
          source: "UpToDate",
          items: [{ name: "SF 0,9%", presentation: "500 mL — Bolsa", dose: "500–1000 mL", route: "Intravenosa", posology: "Em 2-4h, reavaliar", instructions: `Verificar resposta clínica e Na sérico de 4/4h. Não exceder ↑Na 8 mEq/L em 24h. Na atual: ${v}.` }],
        },
      ];
      return [
        {
          id: "hipoNa-leve-causa",
          title: "Tratar causa base — leve assintomática",
          rationale: "Na 130–134: identificar e tratar causa (medicações, hipotireoidismo, ICC, cirrose).",
          source: "UpToDate",
          items: [{ name: "Investigação etiológica + restrição hídrica leve", presentation: "Plano clínico", dose: "≤ 1500 mL/24h", route: "—", posology: "—", instructions: `Suspender tiazídicos/ISRS se possível. Reavaliar Na em 24-48h. Na atual: ${v}.` }],
        },
      ];
    }

    case "hipoP": {
      const isGrave = sev === "grave";
      if (sev === "leve") return [
        {
          id: "hipoP-leve-vo",
          title: "Reposição oral — Fosfato/leite",
          rationale: "P 2,0–2,4 assintomático: VO suficiente; leite (1 mg P/mL) é alternativa econômica.",
          source: "UpToDate",
          items: [{ name: "Fosfato Monossódico/Bissódico (Joulie)", presentation: "Solução oral", dose: "20 mL", route: "Oral", posology: "8/8h", instructions: `Diluir em água. Pode causar diarreia. P atual: ${v}.` }],
        },
      ];
      return [
        {
          id: "hipoP-fosfK",
          title: "Fosfato de Potássio EV — padrão",
          rationale: `Reposição EV padrão: ${isGrave ? "0,5 mmol/kg" : "0,3 mmol/kg"} em 4-6h. Fornece K coadministrado (atenção).`,
          source: "ASPEN · UpToDate",
          items: [{ name: "Fosfato de Potássio 2 mEq/mL", presentation: "10 mL — Ampola (3 mmol P/mL = 30 mmol/amp)", dose: isGrave ? "30 mmol (1 amp)" : "15 mmol (5 mL)", route: "Intravenosa", posology: isGrave ? "Em 6h" : "12/12h", instructions: `Diluir em 250 mL SF 0,9% (NÃO usar SG se K limítrofe). Infundir em 4-6h. Cada 30 mmol → 44 mEq de K. P atual: ${v}.` }],
        },
        {
          id: "hipoP-fosfNa",
          title: "Fosfato de Sódio — quando K já elevado",
          rationale: "Alternativa quando paciente hipercalêmico ou em IRC; aporte de Na deve ser considerado.",
          source: "ASPEN",
          items: [{ name: "Fosfato de Sódio", presentation: "Ampola (3 mmol P/mL)", dose: isGrave ? "30 mmol" : "15 mmol", route: "Intravenosa", posology: isGrave ? "Em 6h" : "12/12h", instructions: `Diluir em 250 mL SF 0,9% ou SG 5%. Cada 30 mmol → 40 mEq Na. P atual: ${v}.` }],
        },
      ];
    }

    case "hiperK": {
      return [
        {
          id: "hiperK-protec",
          title: "Estabilização de membrana (ECG alterado)",
          rationale: "Cálcio EV não reduz K, mas estabiliza miocárdio em segundos; primeiro passo se ECG alterado.",
          source: "UpToDate · AHA ACLS",
          items: [{ name: "Gluconato de Cálcio 10%", presentation: "10 mL — Ampola", dose: "10–20 mL (1–2 amp)", route: "Intravenosa", posology: "Bolus em 5-10 min", instructions: `Repetir em 5 min se ECG persistir alterado. Monitor cardíaco. K atual: ${v}.` }],
        },
        {
          id: "hiperK-shift",
          title: "Shift intracelular — Insulina + Glicose + β2",
          rationale: "Combinação reduz K em 0,5-1,2 mEq/L em 30 min; padrão de hipercalemia moderada-grave.",
          source: "UpToDate · KDIGO",
          items: [
            { name: "Insulina Regular + Glicose 50%", presentation: "Bolus", dose: "10 UI insulina + 50 mL G50%", route: "Intravenosa", posology: "Dose única, repetir 4/4h SN", instructions: `Glicemia capilar 1/1h × 6h (risco de hipoglicemia tardia). K atual: ${v}.` },
            { name: "Salbutamol (Aerolin) inalatório", presentation: "Solução para nebulização", dose: "10–20 gotas (10–20 mg)", route: "Inalatória", posology: "Dose única, repetir 4/4h SN", instructions: "Nebulizar com 4 mL SF 0,9% por 10 min. Cuidado em coronariopatas." },
          ],
        },
        {
          id: "hiperK-remocao",
          title: "Remoção corporal — Furosemida + Resina",
          rationale: "Estratégia para remover K: diurético se função renal preservada; resina (Sorcal/Kayexalate) age em 4-6h.",
          source: "UpToDate · KDIGO",
          items: [
            { name: "Furosemida", presentation: "20 mg/2 mL — Ampola", dose: "40 mg (2 amp)", route: "Intravenosa", posology: "Dose única, repetir 6/6h SN", instructions: "Hidratar SF 0,9% concomitante se euvolêmico." },
            { name: "Poliestirenossulfonato de Cálcio (Sorcal)", presentation: "Sachê 30 g", dose: "30 g", route: "Oral", posology: "8/8h", instructions: `Diluir em 100 mL água. Início em 4-6h. K atual: ${v}.` },
          ],
        },
        {
          id: "hiperK-bic-acid",
          title: "Bicarbonato — apenas se acidose metabólica",
          rationale: "Bicarbonato isolado tem efeito limitado em K, indicado quando há acidose associada.",
          source: "UpToDate · KDIGO",
          items: [{ name: "Bicarbonato de Sódio 8,4%", presentation: "10 mL — Ampola (1 mEq/mL)", dose: "100 mEq (100 mL)", route: "Intravenosa", posology: "Em 30 min", instructions: `Apenas se HCO₃⁻ < 22 ou pH < 7,2. Diluir em 250 mL SG 5%. K atual: ${v}.` }],
        },
      ];
    }

    case "hiperNa": {
      return [
        {
          id: "hiperNa-h2o-livre",
          title: "Reposição de água livre — SG 5% / VO",
          rationale: "Déficit de água livre = 0,6 × peso × (Na/140 − 1). Reduzir Na máx 0,5 mEq/L/h e 10 mEq/L/24h (risco de edema cerebral).",
          source: "UpToDate · AMIB",
          items: [{ name: "SG 5% (água livre)", presentation: "500 mL — Bolsa", dose: "Calcular pelo déficit", route: "Intravenosa", posology: "BIC contínuo", instructions: `Velocidade conforme déficit/24h × fator de perda em curso. Reavaliar Na 4/4h. Na atual: ${v}.` }],
        },
        {
          id: "hiperNa-hipovol",
          title: "Hipovolêmico — restaurar volume com SF 0,45%",
          rationale: "Em hipernatremia hipovolêmica, prioriza-se volume; após restaurar perfusão, transição para água livre.",
          source: "UpToDate",
          items: [{ name: "NaCl 0,45% (hipotônica)", presentation: "Solução preparada", dose: "1000 mL", route: "Intravenosa", posology: "Em 4h", instructions: `Reavaliar PA, FC, lactato. Não corrigir Na > 10 mEq/L em 24h. Na atual: ${v}.` }],
        },
        {
          id: "hiperNa-vo",
          title: "Via enteral — paciente vigil sem contraindicação",
          rationale: "Água livre pela SNE/VO é eficaz e mais fisiológica; usar em pacientes hospitalizados estáveis.",
          source: "UpToDate",
          items: [{ name: "Água livre via SNE/VO", presentation: "Plano clínico", dose: "Calcular pelo déficit", route: "Oral/SNE", posology: "Fracionado 4/4h", instructions: `Cabeceira ≥ 30°. Lavar SNE após cada administração. Na atual: ${v}.` }],
        },
      ];
    }

    case "acidose": {
      const isGrave = sev === "grave";
      return [
        {
          id: "acid-bic-padrao",
          title: "Bicarbonato 8,4% — apenas se pH < 7,1 ou hipercalemia",
          rationale: "Uso restrito a acidose grave (pH < 7,1) ou associada a hipercalemia; correção indiscriminada não traz benefício e pode piorar hipercapnia.",
          source: "Surviving Sepsis 2021 · KDIGO",
          items: [{ name: "Bicarbonato de Sódio 8,4%", presentation: "10 mL — Ampola (1 mEq/mL)", dose: "1 mEq/kg (estimar 50–100 mEq)", route: "Intravenosa", posology: isGrave ? "Em 30 min" : "Conforme gasometria", instructions: `Diluir em 250 mL SG 5%. Reavaliar gasometria 1h após. HCO₃⁻ atual: ${v}.` }],
        },
        {
          id: "acid-bic-bic",
          title: "BIC contínua — acidose metabólica grave persistente",
          rationale: "Em IRA/CAD com acidose refratária: infusão contínua até pH > 7,2.",
          source: "KDIGO · ADA",
          items: [{ name: "Bicarbonato de Sódio 8,4%", presentation: "10 mL — Ampola (1 mEq/mL)", dose: "150 mEq", route: "Intravenosa", posology: "BIC em 4h", instructions: `Diluir 150 mL bicarbonato 8,4% em 850 mL AD (= solução isotônica). Velocidade 250 mL/h. Monitor K e Ca. HCO₃⁻ atual: ${v}.` }],
        },
        {
          id: "acid-tratar-causa",
          title: "Tratar causa base + suporte",
          rationale: "Pilar do tratamento: corrigir hipoperfusão (sepse), CAD, IRA, intoxicação. Bicarbonato é adjuvante.",
          source: "Surviving Sepsis 2021",
          items: [{ name: "Suporte clínico — corrigir causa base", presentation: "Plano clínico", dose: "—", route: "—", posology: "—", instructions: `Otimizar volemia, ventilação, função renal. Investigar lactato, cetoacidose, intoxicação. HCO₃⁻ atual: ${v}.` }],
        },
      ];
    }
  }
}

export function ReplacementWizard({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (entries: MedicationEntry[]) => void;
}) {
  const [disorder, setDisorder] = useState<Disorder>("hipoK");
  const [severity, setSeverity] = useState<Severity>("moderada");
  const [value, setValue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const suggestions = useMemo(() => buildSuggestions(disorder, severity, value), [disorder, severity, value]);

  // Auto-seleciona a primeira sugestão sempre que muda distúrbio/gravidade
  useEffect(() => {
    if (suggestions.length > 0) setSelectedId(suggestions[0].id);
  }, [disorder, severity]);

  const selected = suggestions.find(s => s.id === selectedId) ?? suggestions[0];

  const entries = useMemo<MedicationEntry[]>(() => {
    if (!selected) return [];
    return selected.items.map((r, i) => ({
      id: `rep-${disorder}-${selected.id}-${Date.now()}-${i}`,
      name: r.name,
      presentation: r.presentation,
      defaultDose: r.dose,
      defaultRoute: r.route,
      defaultPosology: r.posology,
      defaultSchedule: "ACM",
      instructions: [r.instructions, notes].filter(Boolean).join(" · "),
      category: "replacement" as const,
      highAlert: ["hiperK", "hipoNa", "hipoK"].includes(disorder),
    }));
  }, [selected, disorder, notes]);

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} className={cn(
      "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
      active ? "bg-sky-600 text-white border-sky-600" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
    )}>{children}</button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[min(46rem,calc(100vw-2rem))] max-h-[calc(100svh-6rem)] top-4 translate-y-0 z-[80] overflow-y-auto p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
            <FlaskConical className="h-5 w-5" /> Assistente de Reposição / Correção Eletrolítica
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione o distúrbio e a gravidade — o assistente apresenta 2 a 3 prescrições sugeridas com embasamento. Escolha uma e ajuste se necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Distúrbio</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1.5">
              {DISORDERS.map(d => (
                <button key={d.key} type="button" onClick={() => setDisorder(d.key)}
                  className={cn("text-left p-2 rounded-md border transition-all",
                    disorder === d.key ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30" : "border-border bg-background hover:border-sky-300")}>
                  <p className="text-xs font-semibold">{d.label}</p>
                  <p className="text-[10px] text-muted-foreground">{d.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gravidade</Label>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <Chip active={severity === "leve"} onClick={() => setSeverity("leve")}>Leve</Chip>
                <Chip active={severity === "moderada"} onClick={() => setSeverity("moderada")}>Moderada</Chip>
                <Chip active={severity === "grave"} onClick={() => setSeverity("grave")}>Grave</Chip>
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Valor laboratorial atual (opcional)</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-7 text-xs" placeholder="Ex: K 2,8 mEq/L" />
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[40px] text-xs" placeholder="Ex: paciente em VM, função renal..." />
          </div>

          {/* Lista de prescrições sugeridas */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1 mb-1.5">
              <Sparkles className="h-3 w-3" /> Prescrição sugerida — escolha uma opção
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s) => {
                const isActive = selected?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "w-full text-left rounded-md border p-2 transition-all",
                      isActive
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30 ring-1 ring-sky-500/30"
                        : "border-border bg-background hover:border-sky-300 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
                        isActive ? "bg-sky-600 border-sky-600" : "border-muted-foreground/40"
                      )}>
                        {isActive && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground italic leading-snug mt-0.5">{s.rationale}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <BookOpen className="h-2.5 w-2.5" /> <span>Embasamento: {s.source}</span>
                        </p>
                        <div className="mt-1.5 space-y-0.5 border-t border-border/40 pt-1.5">
                          {s.items.map((it, i) => (
                            <div key={i} className="text-[11px]">
                              <span className="font-medium text-foreground">{it.name}</span>
                              <span className="text-muted-foreground"> — {it.dose} · {it.route} · {it.posology}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" disabled={entries.length === 0} onClick={() => { onAdd(entries); onOpenChange(false); }} className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white">
            <Sparkles className="h-3.5 w-3.5" /> Adicionar à prescrição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
