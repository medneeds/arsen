import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RENAME/FTN — Relação Nacional de Medicamentos Essenciais (Brasil)
// Organized by therapeutic class with ATC codes
const RENAME_MEDICATIONS = [
  // === ANALGÉSICOS E ANTIPIRÉTICOS ===
  { generic_name: "Paracetamol", therapeutic_class: "Analgésico/Antipirético", atc_code: "N02BE01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Derivados do para-aminofenol" },
  { generic_name: "Dipirona Sódica", therapeutic_class: "Analgésico/Antipirético", atc_code: "N02BB02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Pirazolonas" },
  { generic_name: "Ácido Acetilsalicílico", therapeutic_class: "Analgésico/Antipirético", atc_code: "N02BA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Salicilatos" },

  // === ANTI-INFLAMATÓRIOS NÃO ESTEROIDAIS ===
  { generic_name: "Ibuprofeno", therapeutic_class: "Anti-inflamatório", atc_code: "M01AE01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Derivados do ácido propiônico" },
  { generic_name: "Diclofenaco Sódico", therapeutic_class: "Anti-inflamatório", atc_code: "M01AB05", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Derivados do ácido acético" },
  { generic_name: "Cetoprofeno", therapeutic_class: "Anti-inflamatório", atc_code: "M01AE03", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Derivados do ácido propiônico" },
  { generic_name: "Tenoxicam", therapeutic_class: "Anti-inflamatório", atc_code: "M01AC02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Oxicans" },
  { generic_name: "Naproxeno", therapeutic_class: "Anti-inflamatório", atc_code: "M01AE02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Derivados do ácido propiônico" },

  // === OPIOIDES ===
  { generic_name: "Morfina", therapeutic_class: "Opioide", atc_code: "N02AA01", high_alert: true, controlled: true, requires_dilution: true, pharmacological_group: "Alcaloides naturais do ópio" },
  { generic_name: "Tramadol", therapeutic_class: "Opioide", atc_code: "N02AX02", high_alert: true, controlled: true, requires_dilution: true, pharmacological_group: "Outros opioides" },
  { generic_name: "Codeína", therapeutic_class: "Opioide", atc_code: "N02AA59", high_alert: true, controlled: true, requires_dilution: false, pharmacological_group: "Alcaloides naturais do ópio" },
  { generic_name: "Fentanila", therapeutic_class: "Opioide", atc_code: "N02AB03", high_alert: true, controlled: true, requires_dilution: true, pharmacological_group: "Derivados da fenilpiperidina" },
  { generic_name: "Metadona", therapeutic_class: "Opioide", atc_code: "N07BC02", high_alert: true, controlled: true, requires_dilution: false, pharmacological_group: "Difenilpropilaminas" },
  { generic_name: "Naloxona", therapeutic_class: "Opioide", atc_code: "V03AB15", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Antagonista opioide", notes: "Antídoto para intoxicação por opioides" },

  // === ANTIBIÓTICOS — PENICILINAS ===
  { generic_name: "Amoxicilina", therapeutic_class: "Antibiótico", atc_code: "J01CA04", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Penicilinas de amplo espectro" },
  { generic_name: "Amoxicilina + Clavulanato", therapeutic_class: "Antibiótico", atc_code: "J01CR02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Penicilinas + Inibidor de betalactamase" },
  { generic_name: "Ampicilina", therapeutic_class: "Antibiótico", atc_code: "J01CA01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Penicilinas de amplo espectro" },
  { generic_name: "Ampicilina + Sulbactam", therapeutic_class: "Antibiótico", atc_code: "J01CR01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Penicilinas + Inibidor de betalactamase" },
  { generic_name: "Oxacilina", therapeutic_class: "Antibiótico", atc_code: "J01CF04", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Penicilinas resistentes a betalactamase" },
  { generic_name: "Penicilina G Cristalina", therapeutic_class: "Antibiótico", atc_code: "J01CE01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Penicilinas sensíveis a betalactamase" },
  { generic_name: "Penicilina G Benzatina", therapeutic_class: "Antibiótico", atc_code: "J01CE08", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Penicilinas sensíveis a betalactamase" },
  { generic_name: "Piperacilina + Tazobactam", therapeutic_class: "Antibiótico", atc_code: "J01CR05", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Penicilinas + Inibidor de betalactamase" },

  // === ANTIBIÓTICOS — CEFALOSPORINAS ===
  { generic_name: "Cefalexina", therapeutic_class: "Antibiótico", atc_code: "J01DB01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Cefalosporinas 1ª geração" },
  { generic_name: "Cefazolina", therapeutic_class: "Antibiótico", atc_code: "J01DB04", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Cefalosporinas 1ª geração" },
  { generic_name: "Ceftriaxona", therapeutic_class: "Antibiótico", atc_code: "J01DD04", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Cefalosporinas 3ª geração" },
  { generic_name: "Ceftazidima", therapeutic_class: "Antibiótico", atc_code: "J01DD02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Cefalosporinas 3ª geração" },
  { generic_name: "Cefepima", therapeutic_class: "Antibiótico", atc_code: "J01DE01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Cefalosporinas 4ª geração" },
  { generic_name: "Cefuroxima", therapeutic_class: "Antibiótico", atc_code: "J01DC02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Cefalosporinas 2ª geração" },

  // === ANTIBIÓTICOS — CARBAPENÊMICOS ===
  { generic_name: "Meropenem", therapeutic_class: "Antibiótico", atc_code: "J01DH02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Carbapenêmicos" },
  { generic_name: "Imipenem + Cilastatina", therapeutic_class: "Antibiótico", atc_code: "J01DH51", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Carbapenêmicos" },
  { generic_name: "Ertapenem", therapeutic_class: "Antibiótico", atc_code: "J01DH03", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Carbapenêmicos" },

  // === ANTIBIÓTICOS — OUTROS ===
  { generic_name: "Azitromicina", therapeutic_class: "Antibiótico", atc_code: "J01FA10", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Macrolídeos" },
  { generic_name: "Claritromicina", therapeutic_class: "Antibiótico", atc_code: "J01FA09", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Macrolídeos" },
  { generic_name: "Ciprofloxacino", therapeutic_class: "Antibiótico", atc_code: "J01MA02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Fluoroquinolonas" },
  { generic_name: "Levofloxacino", therapeutic_class: "Antibiótico", atc_code: "J01MA12", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Fluoroquinolonas" },
  { generic_name: "Metronidazol", therapeutic_class: "Antibiótico", atc_code: "J01XD01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Imidazólicos" },
  { generic_name: "Clindamicina", therapeutic_class: "Antibiótico", atc_code: "J01FF01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Lincosamidas" },
  { generic_name: "Vancomicina", therapeutic_class: "Antibiótico", atc_code: "J01XA01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Glicopeptídeos", notes: "Monitorar nível sérico (vale)" },
  { generic_name: "Teicoplanina", therapeutic_class: "Antibiótico", atc_code: "J01XA02", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Glicopeptídeos" },
  { generic_name: "Linezolida", therapeutic_class: "Antibiótico", atc_code: "J01XX08", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Oxazolidinonas" },
  { generic_name: "Gentamicina", therapeutic_class: "Antibiótico", atc_code: "J01GB03", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Aminoglicosídeos", notes: "Nefrotóxico e ototóxico. Monitorar função renal" },
  { generic_name: "Amicacina", therapeutic_class: "Antibiótico", atc_code: "J01GB06", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Aminoglicosídeos", notes: "Nefrotóxico. Monitorar função renal" },
  { generic_name: "Sulfametoxazol + Trimetoprima", therapeutic_class: "Antibiótico", atc_code: "J01EE01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Sulfonamidas + Trimetoprima" },
  { generic_name: "Doxiciclina", therapeutic_class: "Antibiótico", atc_code: "J01AA02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Tetraciclinas" },
  { generic_name: "Polimixina B", therapeutic_class: "Antibiótico", atc_code: "J01XB02", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Polimixinas", notes: "Último recurso para Gram-negativos multirresistentes" },
  { generic_name: "Colistimetato de Sódio", therapeutic_class: "Antibiótico", atc_code: "J01XB01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Polimixinas" },
  { generic_name: "Nitrofurantoína", therapeutic_class: "Antibiótico", atc_code: "J01XE01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Nitrofuranos" },

  // === ANTIFÚNGICOS ===
  { generic_name: "Fluconazol", therapeutic_class: "Antifúngico", atc_code: "J02AC01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Triazólicos" },
  { generic_name: "Anfotericina B", therapeutic_class: "Antifúngico", atc_code: "J02AA01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Poliênicos", notes: "Alto risco de nefrotoxicidade. Pré-medicação obrigatória" },
  { generic_name: "Anfotericina B Lipossomal", therapeutic_class: "Antifúngico", atc_code: "J02AA01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Poliênicos", notes: "Menor nefrotoxicidade que formulação convencional" },
  { generic_name: "Micafungina", therapeutic_class: "Antifúngico", atc_code: "J02AX05", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Equinocandinas" },
  { generic_name: "Caspofungina", therapeutic_class: "Antifúngico", atc_code: "J02AX04", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Equinocandinas" },
  { generic_name: "Voriconazol", therapeutic_class: "Antifúngico", atc_code: "J02AC03", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Triazólicos" },
  { generic_name: "Itraconazol", therapeutic_class: "Antifúngico", atc_code: "J02AC02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Triazólicos" },
  { generic_name: "Nistatina", therapeutic_class: "Antifúngico", atc_code: "A07AA02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Poliênicos" },

  // === ANTIVIRAIS ===
  { generic_name: "Aciclovir", therapeutic_class: "Antiviral", atc_code: "J05AB01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Nucleosídeos" },
  { generic_name: "Oseltamivir", therapeutic_class: "Antiviral", atc_code: "J05AH02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Inibidores da neuraminidase" },
  { generic_name: "Ganciclovir", therapeutic_class: "Antiviral", atc_code: "J05AB06", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Nucleosídeos" },

  // === ANTI-HIPERTENSIVOS ===
  { generic_name: "Enalapril", therapeutic_class: "Anti-hipertensivo", atc_code: "C09AA02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "IECA" },
  { generic_name: "Captopril", therapeutic_class: "Anti-hipertensivo", atc_code: "C09AA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "IECA" },
  { generic_name: "Losartana", therapeutic_class: "Anti-hipertensivo", atc_code: "C09CA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "BRA" },
  { generic_name: "Valsartana", therapeutic_class: "Anti-hipertensivo", atc_code: "C09CA03", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "BRA" },
  { generic_name: "Anlodipino", therapeutic_class: "Anti-hipertensivo", atc_code: "C08CA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Bloqueador de canal de cálcio" },
  { generic_name: "Nifedipino", therapeutic_class: "Anti-hipertensivo", atc_code: "C08CA05", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Bloqueador de canal de cálcio" },
  { generic_name: "Hidralazina", therapeutic_class: "Anti-hipertensivo", atc_code: "C02DB02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Vasodilatador direto" },
  { generic_name: "Nitroprussiato de Sódio", therapeutic_class: "Anti-hipertensivo", atc_code: "C02DD01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Vasodilatador direto", notes: "Fotossensível. Proteger da luz. Monitorar toxicidade por cianeto" },

  // === BETABLOQUEADORES ===
  { generic_name: "Atenolol", therapeutic_class: "Betabloqueador", atc_code: "C07AB03", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Betabloqueador seletivo" },
  { generic_name: "Propranolol", therapeutic_class: "Betabloqueador", atc_code: "C07AA05", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Betabloqueador não seletivo" },
  { generic_name: "Carvedilol", therapeutic_class: "Betabloqueador", atc_code: "C07AG02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Alfa e betabloqueador" },
  { generic_name: "Metoprolol", therapeutic_class: "Betabloqueador", atc_code: "C07AB02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Betabloqueador seletivo" },
  { generic_name: "Esmolol", therapeutic_class: "Betabloqueador", atc_code: "C07AB09", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Betabloqueador seletivo", notes: "Ultra-curta duração. Uso em bomba de infusão" },

  // === DIURÉTICOS ===
  { generic_name: "Furosemida", therapeutic_class: "Diurético", atc_code: "C03CA01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Diurético de alça" },
  { generic_name: "Hidroclorotiazida", therapeutic_class: "Diurético", atc_code: "C03AA03", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Tiazídicos" },
  { generic_name: "Espironolactona", therapeutic_class: "Diurético", atc_code: "C03DA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Poupador de potássio" },
  { generic_name: "Manitol", therapeutic_class: "Diurético", atc_code: "B05BC01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Diurético osmótico" },

  // === VASOPRESSORES / INOTRÓPICOS ===
  { generic_name: "Norepinefrina", therapeutic_class: "Vasopressor", atc_code: "C01CA03", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Catecolaminas", notes: "USO EXCLUSIVO EM BIC. Diluir em SG5%" },
  { generic_name: "Dobutamina", therapeutic_class: "Inotrópico", atc_code: "C01CA07", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Catecolaminas", notes: "USO EXCLUSIVO EM BIC" },
  { generic_name: "Dopamina", therapeutic_class: "Vasopressor", atc_code: "C01CA04", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Catecolaminas", notes: "Dose-dependente: renal / cardíaco / vasopressor" },
  { generic_name: "Vasopressina", therapeutic_class: "Vasopressor", atc_code: "H01BA01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Hormônio antidiurético" },
  { generic_name: "Epinefrina (Adrenalina)", therapeutic_class: "Vasopressor", atc_code: "C01CA24", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Catecolaminas" },
  { generic_name: "Milrinona", therapeutic_class: "Inotrópico", atc_code: "C01CE02", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Inibidor da fosfodiesterase III" },

  // === ANTICOAGULANTES ===
  { generic_name: "Heparina Sódica", therapeutic_class: "Anticoagulante", atc_code: "B01AB01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Heparinas", notes: "Monitorar TTPa. Antídoto: Protamina" },
  { generic_name: "Enoxaparina", therapeutic_class: "Anticoagulante", atc_code: "B01AB05", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Heparinas de baixo peso molecular" },
  { generic_name: "Varfarina", therapeutic_class: "Anticoagulante", atc_code: "B01AA03", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Antagonistas da vitamina K", notes: "Monitorar INR. Múltiplas interações" },
  { generic_name: "Rivaroxabana", therapeutic_class: "Anticoagulante", atc_code: "B01AF01", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Inibidores diretos do Fator Xa" },
  { generic_name: "Protamina", therapeutic_class: "Anticoagulante", atc_code: "V03AB14", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Antídoto", notes: "Antídoto para heparina" },

  // === ANTIPLAQUETÁRIOS ===
  { generic_name: "Clopidogrel", therapeutic_class: "Antiplaquetário", atc_code: "B01AC04", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Inibidores de ADP" },

  // === CORTICOSTEROIDES ===
  { generic_name: "Dexametasona", therapeutic_class: "Corticosteroide", atc_code: "H02AB02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Glicocorticoide" },
  { generic_name: "Hidrocortisona", therapeutic_class: "Corticosteroide", atc_code: "H02AB09", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Glicocorticoide" },
  { generic_name: "Metilprednisolona", therapeutic_class: "Corticosteroide", atc_code: "H02AB04", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Glicocorticoide" },
  { generic_name: "Prednisona", therapeutic_class: "Corticosteroide", atc_code: "H02AB07", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Glicocorticoide" },
  { generic_name: "Prednisolona", therapeutic_class: "Corticosteroide", atc_code: "H02AB06", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Glicocorticoide" },

  // === SEDATIVOS / HIPNÓTICOS ===
  { generic_name: "Midazolam", therapeutic_class: "Sedativo", atc_code: "N05CD08", high_alert: true, controlled: true, requires_dilution: true, pharmacological_group: "Benzodiazepínico" },
  { generic_name: "Diazepam", therapeutic_class: "Sedativo", atc_code: "N05BA01", high_alert: true, controlled: true, requires_dilution: false, pharmacological_group: "Benzodiazepínico" },
  { generic_name: "Lorazepam", therapeutic_class: "Sedativo", atc_code: "N05BA06", high_alert: true, controlled: true, requires_dilution: false, pharmacological_group: "Benzodiazepínico" },
  { generic_name: "Propofol", therapeutic_class: "Sedativo", atc_code: "N01AX10", high_alert: true, controlled: true, requires_dilution: false, pharmacological_group: "Anestésico geral", notes: "Não diluir. Uso em BIC" },
  { generic_name: "Dexmedetomidina", therapeutic_class: "Sedativo", atc_code: "N05CM18", high_alert: true, controlled: true, requires_dilution: true, pharmacological_group: "Agonista alfa-2 adrenérgico" },
  { generic_name: "Cetamina", therapeutic_class: "Sedativo", atc_code: "N01AX03", high_alert: true, controlled: true, requires_dilution: true, pharmacological_group: "Anestésico dissociativo" },
  { generic_name: "Flumazenil", therapeutic_class: "Sedativo", atc_code: "V03AB25", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Antagonista benzodiazepínico", notes: "Antídoto para benzodiazepínicos" },

  // === BLOQUEADORES NEUROMUSCULARES ===
  { generic_name: "Rocurônio", therapeutic_class: "Bloqueador Neuromuscular", atc_code: "M03AC09", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Agentes curarizantes" },
  { generic_name: "Succinilcolina", therapeutic_class: "Bloqueador Neuromuscular", atc_code: "M03AB01", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Agentes despolarizantes" },
  { generic_name: "Atracúrio", therapeutic_class: "Bloqueador Neuromuscular", atc_code: "M03AC04", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Agentes curarizantes" },
  { generic_name: "Cisatracúrio", therapeutic_class: "Bloqueador Neuromuscular", atc_code: "M03AC11", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Agentes curarizantes" },
  { generic_name: "Sugamadex", therapeutic_class: "Bloqueador Neuromuscular", atc_code: "V03AB35", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Agente de reversão", notes: "Reversor de rocurônio e vecurônio" },

  // === INSULINAS ===
  { generic_name: "Insulina Regular", therapeutic_class: "Insulina", atc_code: "A10AB01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Insulina de ação rápida" },
  { generic_name: "Insulina NPH", therapeutic_class: "Insulina", atc_code: "A10AC01", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Insulina de ação intermediária" },
  { generic_name: "Insulina Glargina", therapeutic_class: "Insulina", atc_code: "A10AE04", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Insulina de ação prolongada" },

  // === ANTIDIABÉTICOS ORAIS ===
  { generic_name: "Metformina", therapeutic_class: "Antidiabético", atc_code: "A10BA02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Biguanidas" },
  { generic_name: "Glibenclamida", therapeutic_class: "Antidiabético", atc_code: "A10BB01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Sulfonilureias" },
  { generic_name: "Gliclazida", therapeutic_class: "Antidiabético", atc_code: "A10BB09", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Sulfonilureias" },

  // === ANTICONVULSIVANTES ===
  { generic_name: "Fenitoína", therapeutic_class: "Anticonvulsivante", atc_code: "N03AB02", high_alert: true, controlled: true, requires_dilution: true, pharmacological_group: "Hidantoínas", notes: "Diluir apenas em SF 0,9%. Incompatível com SG5%" },
  { generic_name: "Fenobarbital", therapeutic_class: "Anticonvulsivante", atc_code: "N03AA02", high_alert: true, controlled: true, requires_dilution: true, pharmacological_group: "Barbitúricos" },
  { generic_name: "Carbamazepina", therapeutic_class: "Anticonvulsivante", atc_code: "N03AF01", high_alert: false, controlled: true, requires_dilution: false, pharmacological_group: "Carboxamidas" },
  { generic_name: "Ácido Valproico", therapeutic_class: "Anticonvulsivante", atc_code: "N03AG01", high_alert: false, controlled: true, requires_dilution: true, pharmacological_group: "Derivados de ácidos graxos" },
  { generic_name: "Levetiracetam", therapeutic_class: "Anticonvulsivante", atc_code: "N03AX14", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Outros antiepilépticos" },
  { generic_name: "Lacosamida", therapeutic_class: "Anticonvulsivante", atc_code: "N03AX18", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Outros antiepilépticos" },

  // === ANTIEMÉTICOS ===
  { generic_name: "Ondansetrona", therapeutic_class: "Antiemético", atc_code: "A04AA01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Antagonistas 5-HT3" },
  { generic_name: "Metoclopramida", therapeutic_class: "Antiemético", atc_code: "A03FA01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Procinético" },
  { generic_name: "Bromoprida", therapeutic_class: "Antiemético", atc_code: "A03FA04", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Procinético" },
  { generic_name: "Dimenidrinato", therapeutic_class: "Antiemético", atc_code: "A04AD", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Anti-histamínico" },

  // === PROTETOR GÁSTRICO / IBP ===
  { generic_name: "Omeprazol", therapeutic_class: "Protetor Gástrico", atc_code: "A02BC01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Inibidor de bomba de prótons" },
  { generic_name: "Pantoprazol", therapeutic_class: "Protetor Gástrico", atc_code: "A02BC02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Inibidor de bomba de prótons" },
  { generic_name: "Lansoprazol", therapeutic_class: "Protetor Gástrico", atc_code: "A02BC03", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Inibidor de bomba de prótons" },
  { generic_name: "Ranitidina", therapeutic_class: "Protetor Gástrico", atc_code: "A02BA02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Antagonista H2" },
  { generic_name: "Sucralfato", therapeutic_class: "Protetor Gástrico", atc_code: "A02BX02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Protetor de mucosa" },

  // === LAXANTES ===
  { generic_name: "Lactulose", therapeutic_class: "Laxante", atc_code: "A06AD11", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Laxante osmótico" },
  { generic_name: "Bisacodil", therapeutic_class: "Laxante", atc_code: "A06AB02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Laxante de contato" },
  { generic_name: "Glicerina (Supositório)", therapeutic_class: "Laxante", atc_code: "A06AX01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Laxante osmótico" },

  // === ANTI-HISTAMÍNICOS ===
  { generic_name: "Prometazina", therapeutic_class: "Anti-histamínico", atc_code: "R06AD02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Fenotiazinas" },
  { generic_name: "Dexclorfeniramina", therapeutic_class: "Anti-histamínico", atc_code: "R06AB02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Alquilaminas" },
  { generic_name: "Loratadina", therapeutic_class: "Anti-histamínico", atc_code: "R06AX13", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Piperidinas" },

  // === BRONCODILATADORES ===
  { generic_name: "Salbutamol", therapeutic_class: "Broncodilatador", atc_code: "R03AC02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Beta-2 agonista de curta ação" },
  { generic_name: "Fenoterol", therapeutic_class: "Broncodilatador", atc_code: "R03AC04", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Beta-2 agonista de curta ação" },
  { generic_name: "Brometo de Ipratrópio", therapeutic_class: "Broncodilatador", atc_code: "R03BB01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Anticolinérgico" },
  { generic_name: "Aminofilina", therapeutic_class: "Broncodilatador", atc_code: "R03DA05", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Xantinas", notes: "Janela terapêutica estreita" },

  // === ANTIPSICÓTICOS ===
  { generic_name: "Haloperidol", therapeutic_class: "Antipsicótico", atc_code: "N05AD01", high_alert: false, controlled: true, requires_dilution: true, pharmacological_group: "Butirofenonas" },
  { generic_name: "Clorpromazina", therapeutic_class: "Antipsicótico", atc_code: "N05AA01", high_alert: false, controlled: true, requires_dilution: true, pharmacological_group: "Fenotiazinas" },
  { generic_name: "Risperidona", therapeutic_class: "Antipsicótico", atc_code: "N05AX08", high_alert: false, controlled: true, requires_dilution: false, pharmacological_group: "Benzisoxazóis" },
  { generic_name: "Quetiapina", therapeutic_class: "Antipsicótico", atc_code: "N05AH04", high_alert: false, controlled: true, requires_dilution: false, pharmacological_group: "Dibenzodiazepinas" },
  { generic_name: "Olanzapina", therapeutic_class: "Antipsicótico", atc_code: "N05AH03", high_alert: false, controlled: true, requires_dilution: false, pharmacological_group: "Tienobenzodiazepinas" },

  // === ANTIDEPRESSIVOS ===
  { generic_name: "Fluoxetina", therapeutic_class: "Antidepressivo", atc_code: "N06AB03", high_alert: false, controlled: true, requires_dilution: false, pharmacological_group: "ISRS" },
  { generic_name: "Sertralina", therapeutic_class: "Antidepressivo", atc_code: "N06AB06", high_alert: false, controlled: true, requires_dilution: false, pharmacological_group: "ISRS" },
  { generic_name: "Amitriptilina", therapeutic_class: "Antidepressivo", atc_code: "N06AA09", high_alert: false, controlled: true, requires_dilution: false, pharmacological_group: "Tricíclicos" },
  { generic_name: "Nortriptilina", therapeutic_class: "Antidepressivo", atc_code: "N06AA10", high_alert: false, controlled: true, requires_dilution: false, pharmacological_group: "Tricíclicos" },

  // === ELETRÓLITOS / SOLUÇÕES ===
  { generic_name: "Cloreto de Potássio (KCl)", therapeutic_class: "Eletrólito", atc_code: "A12BA01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Reposição eletrolítica", notes: "NUNCA administrar em bolus. Sempre diluir" },
  { generic_name: "Gluconato de Cálcio", therapeutic_class: "Eletrólito", atc_code: "A12AA03", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Reposição eletrolítica" },
  { generic_name: "Sulfato de Magnésio", therapeutic_class: "Eletrólito", atc_code: "A12CC02", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Reposição eletrolítica" },
  { generic_name: "Cloreto de Sódio 0,9% (SF)", therapeutic_class: "Solução", atc_code: "B05BB01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Solução cristaloide" },
  { generic_name: "Ringer Lactato", therapeutic_class: "Solução", atc_code: "B05BB01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Solução cristaloide" },
  { generic_name: "Soro Glicosado 5%", therapeutic_class: "Solução", atc_code: "B05BA03", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Solução glicosada" },
  { generic_name: "Bicarbonato de Sódio 8,4%", therapeutic_class: "Eletrólito", atc_code: "B05XA02", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Alcalinizante", notes: "Diluir antes de usar. Monitorar gasometria" },
  { generic_name: "Fosfato de Potássio", therapeutic_class: "Eletrólito", atc_code: "A12BA", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Reposição eletrolítica" },
  { generic_name: "Albumina Humana 20%", therapeutic_class: "Hemoderivado", atc_code: "B05AA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Expansor plasmático" },

  // === ANTIPARASITÁRIOS ===
  { generic_name: "Ivermectina", therapeutic_class: "Antiparasitário", atc_code: "P02CF01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Anti-helmíntico" },
  { generic_name: "Albendazol", therapeutic_class: "Antiparasitário", atc_code: "P02CA03", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Anti-helmíntico" },
  { generic_name: "Mebendazol", therapeutic_class: "Antiparasitário", atc_code: "P02CA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Anti-helmíntico" },
  { generic_name: "Benznidazol", therapeutic_class: "Antiparasitário", atc_code: "P01CA02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Tripanocida", notes: "Tratamento de Doença de Chagas" },

  // === ESTATINAS / HIPOLIPEMIANTES ===
  { generic_name: "Sinvastatina", therapeutic_class: "Hipolipemiante", atc_code: "C10AA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Estatinas" },
  { generic_name: "Atorvastatina", therapeutic_class: "Hipolipemiante", atc_code: "C10AA05", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Estatinas" },
  { generic_name: "Rosuvastatina", therapeutic_class: "Hipolipemiante", atc_code: "C10AA07", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Estatinas" },

  // === ANTIARRÍTMICOS ===
  { generic_name: "Amiodarona", therapeutic_class: "Antiarrítmico", atc_code: "C01BD01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Classe III", notes: "Fotossensível. Múltiplas interações" },
  { generic_name: "Adenosina", therapeutic_class: "Antiarrítmico", atc_code: "C01EB10", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Outros antiarrítmicos", notes: "Bolus rápido seguido de flush" },
  { generic_name: "Lidocaína", therapeutic_class: "Antiarrítmico", atc_code: "C01BB01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Classe IB" },
  { generic_name: "Atropina", therapeutic_class: "Antiarrítmico", atc_code: "A03BA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Anticolinérgico" },
  { generic_name: "Digoxina", therapeutic_class: "Cardiotônico", atc_code: "C01AA05", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Glicosídeo cardíaco", notes: "Janela terapêutica estreita. Monitorar nível sérico" },

  // === TROMBOLÍTICOS ===
  { generic_name: "Alteplase (rt-PA)", therapeutic_class: "Trombolítico", atc_code: "B01AD02", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Ativador do plasminogênio", notes: "Protocolo de AVC ou IAM. Monitoração intensiva" },
  { generic_name: "Tenecteplase", therapeutic_class: "Trombolítico", atc_code: "B01AD11", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Ativador do plasminogênio" },

  // === VITAMINAS / SUPLEMENTOS ===
  { generic_name: "Vitamina K (Fitomenadiona)", therapeutic_class: "Vitamina", atc_code: "B02BA01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Vitamina lipossolúvel", notes: "Reversor de varfarina" },
  { generic_name: "Tiamina (Vitamina B1)", therapeutic_class: "Vitamina", atc_code: "A11DA01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Complexo B" },
  { generic_name: "Ácido Fólico", therapeutic_class: "Vitamina", atc_code: "B03BB01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Vitamina B9" },
  { generic_name: "Sulfato Ferroso", therapeutic_class: "Suplemento", atc_code: "B03AA07", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Ferro" },
  { generic_name: "Sacarato de Hidróxido Férrico", therapeutic_class: "Suplemento", atc_code: "B03AC02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Ferro parenteral" },
  { generic_name: "Complexo B", therapeutic_class: "Vitamina", atc_code: "A11EA", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Vitaminas do complexo B" },

  // === HORMÔNIOS ===
  { generic_name: "Levotiroxina", therapeutic_class: "Hormônio", atc_code: "H03AA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Hormônio tireoidiano" },
  { generic_name: "Ocitocina", therapeutic_class: "Hormônio", atc_code: "H01BB02", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Ocitócico" },
  { generic_name: "Terlipressina", therapeutic_class: "Hormônio", atc_code: "H01BA04", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Análogo da vasopressina", notes: "Hemorragia varicosa / Síndrome hepatorrenal" },

  // === ANTIAGREGANTES / FIBRINOLÍTICOS ===
  { generic_name: "Ácido Tranexâmico", therapeutic_class: "Antifibrinolítico", atc_code: "B02AA02", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Antifibrinolítico" },

  // === IMUNOSSUPRESSORES ===
  { generic_name: "Ciclofosfamida", therapeutic_class: "Imunossupressor", atc_code: "L01AA01", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Alquilante", notes: "Hidratação vigorosa. Mesna para proteção vesical" },
  { generic_name: "Azatioprina", therapeutic_class: "Imunossupressor", atc_code: "L04AX01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Análogo de purina" },
  { generic_name: "Micofenolato de Mofetila", therapeutic_class: "Imunossupressor", atc_code: "L04AA06", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Inibidor de síntese de purinas" },

  // === IMUNOBIOLÓGICOS / FATORES DE CRESCIMENTO ===
  { generic_name: "Filgrastim (G-CSF)", therapeutic_class: "Fator de Crescimento", atc_code: "L03AA02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Fator estimulador de colônias" },
  { generic_name: "Imunoglobulina Humana IV", therapeutic_class: "Hemoderivado", atc_code: "J06BA02", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Imunoglobulinas", notes: "Pré-medicação recomendada. Infundir lentamente" },

  // === ANTITUBERCULOSOS ===
  { generic_name: "Rifampicina", therapeutic_class: "Antituberculoso", atc_code: "J04AB02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Rifamicinas" },
  { generic_name: "Isoniazida", therapeutic_class: "Antituberculoso", atc_code: "J04AC01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Hidrazidas" },
  { generic_name: "Pirazinamida", therapeutic_class: "Antituberculoso", atc_code: "J04AK01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Outros antituberculosos" },
  { generic_name: "Etambutol", therapeutic_class: "Antituberculoso", atc_code: "J04AK02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Outros antituberculosos" },

  // === ANTICOLINÉRGICOS / ANTIESPASMÓDICOS ===
  { generic_name: "Escopolamina (Hioscina)", therapeutic_class: "Antiespasmódico", atc_code: "A03BB01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Anticolinérgico" },
  { generic_name: "N-Butilescopolamina", therapeutic_class: "Antiespasmódico", atc_code: "A03BB01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Anticolinérgico" },

  // === ANESTÉSICOS LOCAIS ===
  { generic_name: "Lidocaína (Tópica/Local)", therapeutic_class: "Anestésico Local", atc_code: "N01BB02", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Amidas" },
  { generic_name: "Bupivacaína", therapeutic_class: "Anestésico Local", atc_code: "N01BB01", high_alert: true, controlled: false, requires_dilution: false, pharmacological_group: "Amidas" },

  // === OUTROS ===
  { generic_name: "N-Acetilcisteína", therapeutic_class: "Mucolítico/Antídoto", atc_code: "R05CB01", high_alert: false, controlled: false, requires_dilution: true, pharmacological_group: "Mucolítico", notes: "Antídoto para intoxicação por paracetamol" },
  { generic_name: "Carvão Ativado", therapeutic_class: "Antídoto", atc_code: "A07BA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Adsorvente" },
  { generic_name: "Alopurinol", therapeutic_class: "Antigotoso", atc_code: "M04AA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Inibidor da xantina oxidase" },
  { generic_name: "Colchicina", therapeutic_class: "Antigotoso", atc_code: "M04AC01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Alcaloide" },
  { generic_name: "Eritropoetina (EPO)", therapeutic_class: "Fator de Crescimento", atc_code: "B03XA01", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Estimulante da eritropoese" },
  { generic_name: "Desmopressina (DDAVP)", therapeutic_class: "Hormônio", atc_code: "H01BA02", high_alert: true, controlled: false, requires_dilution: true, pharmacological_group: "Análogo da vasopressina" },
  { generic_name: "Eltrombopague (Revolade)", therapeutic_class: "Estimulante de Plaquetas", atc_code: "B02BX05", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Agonista de receptor de trombopoetina" },
  { generic_name: "Ácido Acetilsalicílico (AAS) 100mg", therapeutic_class: "Antiplaquetário", atc_code: "B01AC06", high_alert: false, controlled: false, requires_dilution: false, pharmacological_group: "Inibidor da COX" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get existing medications to avoid duplicates
    const { data: existing } = await supabase
      .from("medication_catalog")
      .select("generic_name");

    const existingNames = new Set(
      (existing || []).map((e: any) => e.generic_name.toLowerCase())
    );

    const toInsert = RENAME_MEDICATIONS.filter(
      (m) => !existingNames.has(m.generic_name.toLowerCase())
    );

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, skipped: RENAME_MEDICATIONS.length, message: "Todos os medicamentos já existem no catálogo." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert in batches of 50
    let inserted = 0;
    const batchSize = 50;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { error } = await supabase.from("medication_catalog").insert(batch);
      if (error) {
        console.error("Batch insert error:", error);
        throw error;
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        inserted,
        skipped: RENAME_MEDICATIONS.length - toInsert.length,
        total: RENAME_MEDICATIONS.length,
        message: `${inserted} medicamentos importados com sucesso da base RENAME/FTN.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error seeding RENAME catalog:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
