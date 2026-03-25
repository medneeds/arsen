import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Comprehensive CID-10 codes commonly used in emergency/ICU settings
const CID10_DATA = [
  // Chapter I - Infectious diseases (A00-B99)
  { code: "A09", description: "Diarreia e gastroenterite de origem infecciosa presumível", category: "Doenças infecciosas", chapter: "I" },
  { code: "A15", description: "Tuberculose respiratória, com confirmação bacteriológica e histológica", category: "Doenças infecciosas", chapter: "I" },
  { code: "A39", description: "Infecção meningocócica", category: "Doenças infecciosas", chapter: "I" },
  { code: "A40", description: "Septicemia estreptocócica", category: "Doenças infecciosas", chapter: "I" },
  { code: "A41", description: "Outras septicemias", category: "Doenças infecciosas", chapter: "I" },
  { code: "A41.0", description: "Septicemia por Staphylococcus aureus", category: "Doenças infecciosas", chapter: "I" },
  { code: "A41.1", description: "Septicemia por outro estafilococo especificado", category: "Doenças infecciosas", chapter: "I" },
  { code: "A41.5", description: "Septicemia por outros organismos Gram-negativos", category: "Doenças infecciosas", chapter: "I" },
  { code: "A41.9", description: "Septicemia não especificada", category: "Doenças infecciosas", chapter: "I" },
  { code: "A46", description: "Erisipela", category: "Doenças infecciosas", chapter: "I" },
  { code: "A49.9", description: "Infecção bacteriana não especificada", category: "Doenças infecciosas", chapter: "I" },
  { code: "B15", description: "Hepatite aguda A", category: "Doenças infecciosas", chapter: "I" },
  { code: "B16", description: "Hepatite aguda B", category: "Doenças infecciosas", chapter: "I" },
  { code: "B17.1", description: "Hepatite aguda C", category: "Doenças infecciosas", chapter: "I" },
  { code: "B20", description: "Doença pelo vírus da imunodeficiência humana (HIV)", category: "Doenças infecciosas", chapter: "I" },
  { code: "B34.9", description: "Infecção viral não especificada", category: "Doenças infecciosas", chapter: "I" },
  { code: "B54", description: "Malária não especificada", category: "Doenças infecciosas", chapter: "I" },
  { code: "B57", description: "Doença de Chagas", category: "Doenças infecciosas", chapter: "I" },

  // Chapter II - Neoplasms (C00-D48)
  { code: "C16", description: "Neoplasia maligna do estômago", category: "Neoplasias", chapter: "II" },
  { code: "C18", description: "Neoplasia maligna do cólon", category: "Neoplasias", chapter: "II" },
  { code: "C20", description: "Neoplasia maligna do reto", category: "Neoplasias", chapter: "II" },
  { code: "C22", description: "Neoplasia maligna do fígado e das vias biliares intra-hepáticas", category: "Neoplasias", chapter: "II" },
  { code: "C34", description: "Neoplasia maligna dos brônquios e dos pulmões", category: "Neoplasias", chapter: "II" },
  { code: "C50", description: "Neoplasia maligna da mama", category: "Neoplasias", chapter: "II" },
  { code: "C61", description: "Neoplasia maligna da próstata", category: "Neoplasias", chapter: "II" },
  { code: "C71", description: "Neoplasia maligna do encéfalo", category: "Neoplasias", chapter: "II" },
  { code: "C80", description: "Neoplasia maligna sem especificação de localização", category: "Neoplasias", chapter: "II" },
  { code: "D50", description: "Anemia por deficiência de ferro", category: "Neoplasias", chapter: "II" },
  { code: "D64.9", description: "Anemia não especificada", category: "Neoplasias", chapter: "II" },
  { code: "D65", description: "Coagulação intravascular disseminada (CID)", category: "Neoplasias", chapter: "II" },
  { code: "D69.6", description: "Trombocitopenia não especificada", category: "Neoplasias", chapter: "II" },

  // Chapter III - Blood diseases (D50-D89)
  { code: "D57", description: "Transtornos falciformes", category: "Doenças do sangue", chapter: "III" },

  // Chapter IV - Endocrine (E00-E90)
  { code: "E10", description: "Diabetes mellitus insulino-dependente", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E10.0", description: "Diabetes mellitus insulino-dependente com coma", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E10.1", description: "Diabetes mellitus insulino-dependente com cetoacidose", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E11", description: "Diabetes mellitus não insulino-dependente", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E11.0", description: "Diabetes mellitus não insulino-dependente com coma", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E11.1", description: "Diabetes mellitus não insulino-dependente com cetoacidose", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E13", description: "Outros tipos especificados de diabetes mellitus", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E14", description: "Diabetes mellitus não especificado", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E16.2", description: "Hipoglicemia não especificada", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E46", description: "Desnutrição proteico-calórica não especificada", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E66", description: "Obesidade", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E86", description: "Depleção de volume", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E87.0", description: "Hiperosmolaridade e hipernatremia", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E87.1", description: "Hiposmolaridade e hiponatremia", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E87.5", description: "Hipercalemia", category: "Doenças endócrinas", chapter: "IV" },
  { code: "E87.6", description: "Hipocalemia", category: "Doenças endócrinas", chapter: "IV" },

  // Chapter V - Mental disorders (F00-F99)
  { code: "F03", description: "Demência não especificada", category: "Transtornos mentais", chapter: "V" },
  { code: "F10", description: "Transtornos mentais e comportamentais devidos ao uso de álcool", category: "Transtornos mentais", chapter: "V" },
  { code: "F10.0", description: "Transtornos mentais devidos ao uso de álcool - intoxicação aguda", category: "Transtornos mentais", chapter: "V" },
  { code: "F10.3", description: "Transtornos mentais devidos ao uso de álcool - estado de abstinência", category: "Transtornos mentais", chapter: "V" },
  { code: "F20", description: "Esquizofrenia", category: "Transtornos mentais", chapter: "V" },
  { code: "F32", description: "Episódio depressivo", category: "Transtornos mentais", chapter: "V" },
  { code: "F41", description: "Outros transtornos ansiosos", category: "Transtornos mentais", chapter: "V" },

  // Chapter VI - Nervous system (G00-G99)
  { code: "G00", description: "Meningite bacteriana não classificada em outra parte", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G03.9", description: "Meningite não especificada", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G04", description: "Encefalite, mielite e encefalomielite", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G20", description: "Doença de Parkinson", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G30", description: "Doença de Alzheimer", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G40", description: "Epilepsia", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G40.9", description: "Epilepsia não especificada", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G41", description: "Estado de mal epiléptico", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G45", description: "Acidentes vasculares cerebrais isquêmicos transitórios", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G61", description: "Polineuropatia inflamatória (Guillain-Barré)", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G93.1", description: "Lesão cerebral anóxica não classificada em outra parte", category: "Doenças do sistema nervoso", chapter: "VI" },
  { code: "G93.4", description: "Encefalopatia não especificada", category: "Doenças do sistema nervoso", chapter: "VI" },

  // Chapter IX - Circulatory system (I00-I99)
  { code: "I10", description: "Hipertensão essencial (primária)", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I11", description: "Doença cardíaca hipertensiva", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I13", description: "Doença cardíaca e renal hipertensiva", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I20", description: "Angina pectoris", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I20.0", description: "Angina instável", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I21", description: "Infarto agudo do miocárdio", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I21.0", description: "Infarto agudo transmural da parede anterior do miocárdio", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I21.9", description: "Infarto agudo do miocárdio não especificado", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I25", description: "Doença isquêmica crônica do coração", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I26", description: "Embolia pulmonar", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I26.0", description: "Embolia pulmonar com menção de cor pulmonale agudo", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I26.9", description: "Embolia pulmonar sem menção de cor pulmonale agudo", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I42", description: "Cardiomiopatia", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I44", description: "Bloqueio atrioventricular e do ramo esquerdo", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I46", description: "Parada cardíaca", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I46.0", description: "Parada cardíaca com ressuscitação bem sucedida", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I46.9", description: "Parada cardíaca não especificada", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I47", description: "Taquicardia paroxística", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I48", description: "Flutter e fibrilação atrial", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I49", description: "Outras arritmias cardíacas", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I50", description: "Insuficiência cardíaca", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I50.0", description: "Insuficiência cardíaca congestiva", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I50.1", description: "Insuficiência ventricular esquerda", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I50.9", description: "Insuficiência cardíaca não especificada", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I51.9", description: "Doença cardíaca não especificada", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I60", description: "Hemorragia subaracnóidea", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I61", description: "Hemorragia intracerebral", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I62", description: "Outras hemorragias intracranianas não-traumáticas", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I63", description: "Infarto cerebral", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I63.9", description: "Infarto cerebral não especificado", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I64", description: "Acidente vascular cerebral não especificado como hemorrágico ou isquêmico", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I67.4", description: "Encefalopatia hipertensiva", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I69", description: "Sequelas de doenças cerebrovasculares", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I70", description: "Aterosclerose", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I71", description: "Aneurisma e dissecção da aorta", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I74", description: "Embolia e trombose arteriais", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I80", description: "Flebite e tromboflebite", category: "Doenças do aparelho circulatório", chapter: "IX" },
  { code: "I80.2", description: "Flebite e tromboflebite de outros vasos profundos dos membros inferiores (TVP)", category: "Doenças do aparelho circulatório", chapter: "IX" },

  // Chapter X - Respiratory system (J00-J99)
  { code: "J06.9", description: "Infecção aguda das vias aéreas superiores não especificada", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J09", description: "Influenza devida a vírus identificado da gripe aviária", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J10", description: "Influenza devida a outro vírus da influenza identificado", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J11", description: "Influenza devida a vírus não identificado", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J12", description: "Pneumonia viral não classificada em outra parte", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J13", description: "Pneumonia devida a Streptococcus pneumoniae", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J15", description: "Pneumonia bacteriana não classificada em outra parte", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J15.9", description: "Pneumonia bacteriana não especificada", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J18", description: "Pneumonia por micro-organismo não especificado", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J18.0", description: "Broncopneumonia não especificada", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J18.9", description: "Pneumonia não especificada", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J22", description: "Infecção aguda não especificada das vias aéreas inferiores", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J44", description: "Outras doenças pulmonares obstrutivas crônicas (DPOC)", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J44.1", description: "DPOC com exacerbação aguda", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J45", description: "Asma", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J45.1", description: "Asma não-alérgica", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J46", description: "Estado de mal asmático", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J69.0", description: "Pneumonite devida a alimento ou vômito (broncoaspiração)", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J80", description: "Síndrome do desconforto respiratório do adulto (SDRA)", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J81", description: "Edema pulmonar", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J84.1", description: "Outras doenças pulmonares intersticiais com fibrose", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J85", description: "Abscesso do pulmão e do mediastino", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J86", description: "Piotórax (empiema)", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J90", description: "Derrame pleural não classificado em outra parte", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J93", description: "Pneumotórax", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J96", description: "Insuficiência respiratória não classificada em outra parte", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J96.0", description: "Insuficiência respiratória aguda", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J96.1", description: "Insuficiência respiratória crônica", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J96.9", description: "Insuficiência respiratória não especificada", category: "Doenças do aparelho respiratório", chapter: "X" },
  { code: "J98.4", description: "Outros transtornos pulmonares", category: "Doenças do aparelho respiratório", chapter: "X" },

  // Chapter XI - Digestive system (K00-K93)
  { code: "K25", description: "Úlcera gástrica", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K26", description: "Úlcera duodenal", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K29", description: "Gastrite e duodenite", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K35", description: "Apendicite aguda", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K40", description: "Hérnia inguinal", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K56", description: "Íleo paralítico e obstrução intestinal sem hérnia", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K57", description: "Doença diverticular do intestino", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K65", description: "Peritonite", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K70", description: "Doença alcoólica do fígado", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K72", description: "Insuficiência hepática não classificada em outra parte", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K74", description: "Fibrose e cirrose hepáticas", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K76.6", description: "Hipertensão portal", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K80", description: "Colelitíase", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K81", description: "Colecistite", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K83.0", description: "Colangite", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K85", description: "Pancreatite aguda", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K86.1", description: "Outras pancreatites crônicas", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K92.0", description: "Hematêmese", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K92.1", description: "Melena", category: "Doenças do aparelho digestivo", chapter: "XI" },
  { code: "K92.2", description: "Hemorragia gastrointestinal não especificada", category: "Doenças do aparelho digestivo", chapter: "XI" },

  // Chapter XII - Skin (L00-L99)
  { code: "L02", description: "Abscesso cutâneo, furúnculo e antraz", category: "Doenças da pele", chapter: "XII" },
  { code: "L03", description: "Celulite", category: "Doenças da pele", chapter: "XII" },
  { code: "L89", description: "Úlcera de decúbito", category: "Doenças da pele", chapter: "XII" },
  { code: "L97", description: "Úlcera dos membros inferiores não classificada em outra parte", category: "Doenças da pele", chapter: "XII" },

  // Chapter XIII - Musculoskeletal (M00-M99)
  { code: "M13.9", description: "Artrite não especificada", category: "Doenças do sistema osteomuscular", chapter: "XIII" },
  { code: "M54.5", description: "Dor lombar baixa (lombalgia)", category: "Doenças do sistema osteomuscular", chapter: "XIII" },
  { code: "M79.3", description: "Paniculite não especificada", category: "Doenças do sistema osteomuscular", chapter: "XIII" },
  { code: "M86", description: "Osteomielite", category: "Doenças do sistema osteomuscular", chapter: "XIII" },

  // Chapter XIV - Genitourinary (N00-N99)
  { code: "N10", description: "Nefrite túbulo-intersticial aguda (pielonefrite aguda)", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N12", description: "Nefrite túbulo-intersticial não especificada como aguda ou crônica", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N17", description: "Insuficiência renal aguda", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N17.0", description: "Insuficiência renal aguda com necrose tubular", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N17.9", description: "Insuficiência renal aguda não especificada", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N18", description: "Insuficiência renal crônica", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N18.5", description: "Doença renal crônica, estágio 5", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N18.9", description: "Insuficiência renal crônica não especificada", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N19", description: "Insuficiência renal não especificada", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N20", description: "Calculose do rim e do ureter", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N30", description: "Cistite", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N39.0", description: "Infecção do trato urinário de localização não especificada", category: "Doenças do aparelho geniturinário", chapter: "XIV" },
  { code: "N40", description: "Hiperplasia da próstata", category: "Doenças do aparelho geniturinário", chapter: "XIV" },

  // Chapter XV - Pregnancy/Childbirth (O00-O99)
  { code: "O00", description: "Gravidez ectópica", category: "Gravidez, parto e puerpério", chapter: "XV" },
  { code: "O03", description: "Aborto espontâneo", category: "Gravidez, parto e puerpério", chapter: "XV" },
  { code: "O14", description: "Pré-eclâmpsia", category: "Gravidez, parto e puerpério", chapter: "XV" },
  { code: "O15", description: "Eclâmpsia", category: "Gravidez, parto e puerpério", chapter: "XV" },
  { code: "O46", description: "Hemorragia anteparto não classificada em outra parte", category: "Gravidez, parto e puerpério", chapter: "XV" },
  { code: "O72", description: "Hemorragia pós-parto", category: "Gravidez, parto e puerpério", chapter: "XV" },
  { code: "O80", description: "Parto único espontâneo", category: "Gravidez, parto e puerpério", chapter: "XV" },
  { code: "O85", description: "Infecção puerperal", category: "Gravidez, parto e puerpério", chapter: "XV" },

  // Chapter XVIII - Symptoms (R00-R99)
  { code: "R00.0", description: "Taquicardia não especificada", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R04.0", description: "Epistaxe", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R04.2", description: "Hemoptise", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R06.0", description: "Dispneia", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R07.4", description: "Dor torácica não especificada", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R10.0", description: "Abdome agudo", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R10.4", description: "Outras dores abdominais e as não especificadas", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R11", description: "Náusea e vômitos", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R40.2", description: "Coma não especificado", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R42", description: "Tontura e instabilidade", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R50", description: "Febre de origem desconhecida", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R51", description: "Cefaleia", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R55", description: "Síncope e colapso", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R56", description: "Convulsões não classificadas em outra parte", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R57", description: "Choque não classificado em outra parte", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R57.0", description: "Choque cardiogênico", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R57.1", description: "Choque hipovolêmico", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R57.2", description: "Choque séptico", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R57.8", description: "Outras formas de choque", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R58", description: "Hemorragia não classificada em outra parte", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R65", description: "Síndrome de resposta inflamatória sistêmica (SIRS)", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R65.1", description: "SIRS de origem infecciosa com disfunção orgânica (sepse grave)", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R68.8", description: "Outros sinais e sintomas gerais especificados", category: "Sinais e sintomas", chapter: "XVIII" },
  { code: "R99", description: "Outras causas mal definidas e as não especificadas de mortalidade", category: "Sinais e sintomas", chapter: "XVIII" },

  // Chapter XIX - Injuries/External causes (S00-T98)
  { code: "S00", description: "Traumatismo superficial da cabeça", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S01", description: "Ferimento da cabeça", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S02", description: "Fratura do crânio e dos ossos da face", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S06", description: "Traumatismo intracraniano", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S06.0", description: "Concussão cerebral", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S06.2", description: "Traumatismo cerebral difuso", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S06.4", description: "Hemorragia epidural", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S06.5", description: "Hemorragia subdural traumática", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S06.6", description: "Hemorragia subaracnóidea traumática", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S09", description: "Outros traumatismos da cabeça e os não especificados", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S12", description: "Fratura do pescoço", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S22", description: "Fratura de costela(s), esterno e coluna torácica", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S27", description: "Traumatismo de outros órgãos intratorácicos e dos não especificados", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S32", description: "Fratura da coluna lombar e da pelve", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S36", description: "Traumatismo de órgãos intra-abdominais", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S42", description: "Fratura do ombro e do braço", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S52", description: "Fratura do antebraço", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S72", description: "Fratura do fêmur", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "S82", description: "Fratura da perna, incluindo tornozelo", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T14", description: "Traumatismo de região não especificada do corpo", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T30", description: "Queimadura e corrosão de região não especificada do corpo", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T36", description: "Intoxicação por antibióticos sistêmicos", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T40", description: "Intoxicação por narcóticos e psicodislépticos", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T42", description: "Intoxicação por antiepilépticos, sedativo-hipnóticos e antiparkinsonianos", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T50.9", description: "Intoxicação por outras drogas, medicamentos e substâncias biológicas e as não especificadas", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T58", description: "Efeito tóxico do monóxido de carbono", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T63", description: "Efeito tóxico de contato com animais venenosos", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T63.0", description: "Efeito tóxico de veneno de serpente", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T68", description: "Hipotermia", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T71", description: "Asfixia", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T75.1", description: "Afogamento e submersão não-fatais", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T78.2", description: "Choque anafilático não especificado", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T79.4", description: "Embolia gordurosa traumática", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T81.0", description: "Hemorragia e hematoma complicando procedimento não classificado em outra parte", category: "Lesões e causas externas", chapter: "XIX" },
  { code: "T81.4", description: "Infecção subsequente a procedimento não classificada em outra parte", category: "Lesões e causas externas", chapter: "XIX" },

  // Chapter XX - External causes (V01-Y98)
  { code: "W19", description: "Queda sem especificação", category: "Causas externas", chapter: "XX" },
  { code: "X59", description: "Exposição a fatores não especificados", category: "Causas externas", chapter: "XX" },
  { code: "X85", description: "Agressão por meio de drogas, medicamentos e substâncias biológicas", category: "Causas externas", chapter: "XX" },
  { code: "X95", description: "Agressão por meio de disparo de arma de fogo", category: "Causas externas", chapter: "XX" },
  { code: "X99", description: "Agressão por meio de objeto cortante ou penetrante", category: "Causas externas", chapter: "XX" },
  { code: "Y34", description: "Fatos ou eventos não especificados e intenção não determinada", category: "Causas externas", chapter: "XX" },

  // Chapter XXI - Factors influencing health (Z00-Z99)
  { code: "Z03", description: "Observação e avaliação médica por suspeita de doenças e afecções", category: "Fatores que influenciam o estado de saúde", chapter: "XXI" },
  { code: "Z20", description: "Contato com e exposição a doenças transmissíveis", category: "Fatores que influenciam o estado de saúde", chapter: "XXI" },
  { code: "Z51.5", description: "Cuidados paliativos", category: "Fatores que influenciam o estado de saúde", chapter: "XXI" },
  { code: "Z87", description: "História pessoal de outras doenças e afecções", category: "Fatores que influenciam o estado de saúde", chapter: "XXI" },
  { code: "Z99.1", description: "Dependência de respirador", category: "Fatores que influenciam o estado de saúde", chapter: "XXI" },
  { code: "Z99.2", description: "Dependência de diálise renal", category: "Fatores que influenciam o estado de saúde", chapter: "XXI" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check existing count
    const { count } = await supabase
      .from("cid10_codes")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      return new Response(
        JSON.stringify({ message: `CID-10 já populado com ${count} registros.`, count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < CID10_DATA.length; i += 50) {
      const batch = CID10_DATA.slice(i, i + 50);
      const { error } = await supabase.from("cid10_codes").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({ message: `${inserted} códigos CID-10 inseridos com sucesso.`, count: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
