/**
 * Quick Attendance Presets for UE Vertical / Horizontal
 * Editable checklists with prescription, exam, and consult packages
 */

export interface PresetItem {
  id: string;
  label: string;
  category: 'prescricao' | 'exame_lab' | 'exame_imagem' | 'parecer' | 'cuidado';
  defaultChecked: boolean;
  details?: string;
}

export interface AttendancePreset {
  id: string;
  label: string;
  icon: string; // emoji
  color: string; // tailwind bg class
  description: string;
  items: PresetItem[];
  defaultDestination?: string;
}

export const QUICK_PRESETS: AttendancePreset[] = [
  {
    id: 'neurocritico',
    label: 'Neurocrítico',
    icon: '🧠',
    color: 'bg-purple-600',
    description: 'Rebaixamento de consciência, convulsão, déficit focal',
    defaultDestination: 'sala_vermelha',
    items: [
      { id: 'n1', label: 'SF 0,9% 500ml EV', category: 'prescricao', defaultChecked: true },
      { id: 'n2', label: 'Fenitoína 250mg EV (ataque)', category: 'prescricao', defaultChecked: true, details: 'Diluir em 250ml SF, correr em 30min' },
      { id: 'n3', label: 'Manitol 20% 250ml EV', category: 'prescricao', defaultChecked: false, details: 'Se sinais de HIC' },
      { id: 'n4', label: 'Diazepam 10mg EV', category: 'prescricao', defaultChecked: false, details: 'Se crise ativa' },
      { id: 'n5', label: 'Cabeceira elevada 30°', category: 'cuidado', defaultChecked: true },
      { id: 'n6', label: 'Monitorização contínua', category: 'cuidado', defaultChecked: true },
      { id: 'n7', label: 'Glasgow seriado 1/1h', category: 'cuidado', defaultChecked: true },
      { id: 'n8', label: 'Hemograma + Coagulograma', category: 'exame_lab', defaultChecked: true },
      { id: 'n9', label: 'Glicemia + Na/K + Ureia/Cr', category: 'exame_lab', defaultChecked: true },
      { id: 'n10', label: 'Gasometria arterial', category: 'exame_lab', defaultChecked: true },
      { id: 'n11', label: 'TC Crânio sem contraste', category: 'exame_imagem', defaultChecked: true, details: 'URGENTE' },
      { id: 'n12', label: 'Parecer Neurologia', category: 'parecer', defaultChecked: true },
      { id: 'n13', label: 'Parecer Neurocirurgia', category: 'parecer', defaultChecked: false },
    ],
  },
  {
    id: 'choque',
    label: 'Choque',
    icon: '⚡',
    color: 'bg-red-600',
    description: 'Hipotensão, taquicardia, má perfusão periférica',
    defaultDestination: 'sala_vermelha',
    items: [
      { id: 'c1', label: 'SF 0,9% 1000ml EV rápido (30min)', category: 'prescricao', defaultChecked: true },
      { id: 'c2', label: 'Noradrenalina 8mg/50ml BIC', category: 'prescricao', defaultChecked: false, details: 'Se refratário a volume' },
      { id: 'c3', label: 'Hidrocortisona 100mg EV', category: 'prescricao', defaultChecked: false, details: 'Se suspeita adrenal' },
      { id: 'c4', label: 'Acesso venoso central', category: 'cuidado', defaultChecked: true },
      { id: 'c5', label: 'SVD + controle diurese', category: 'cuidado', defaultChecked: true },
      { id: 'c6', label: 'Monitorização contínua + PAI', category: 'cuidado', defaultChecked: true },
      { id: 'c7', label: 'Hemograma + Coagulograma', category: 'exame_lab', defaultChecked: true },
      { id: 'c8', label: 'Lactato + Gasometria arterial', category: 'exame_lab', defaultChecked: true },
      { id: 'c9', label: 'Função renal + Eletrólitos', category: 'exame_lab', defaultChecked: true },
      { id: 'c10', label: 'Hemoculturas (2 sítios)', category: 'exame_lab', defaultChecked: true },
      { id: 'c11', label: 'Rx Tórax AP no leito', category: 'exame_imagem', defaultChecked: true },
      { id: 'c12', label: 'ECG 12 derivações', category: 'exame_imagem', defaultChecked: true },
      { id: 'c13', label: 'POCUS / FAST', category: 'exame_imagem', defaultChecked: false },
      { id: 'c14', label: 'Parecer Cardiologia', category: 'parecer', defaultChecked: false },
    ],
  },
  {
    id: 'insuf_resp',
    label: 'Insuf. Respiratória',
    icon: '🫁',
    color: 'bg-blue-600',
    description: 'Dispneia, hipoxemia, desconforto respiratório',
    defaultDestination: 'sala_vermelha',
    items: [
      { id: 'ir1', label: 'O₂ suplementar (cateter/máscara)', category: 'prescricao', defaultChecked: true },
      { id: 'ir2', label: 'VNI (CPAP/BiPAP)', category: 'prescricao', defaultChecked: false, details: 'Se SpO2 < 90% com O2' },
      { id: 'ir3', label: 'Salbutamol + Ipratrópio NBZ', category: 'prescricao', defaultChecked: true },
      { id: 'ir4', label: 'Metilprednisolona 40mg EV', category: 'prescricao', defaultChecked: false },
      { id: 'ir5', label: 'Furosemida 40mg EV', category: 'prescricao', defaultChecked: false, details: 'Se EAP' },
      { id: 'ir6', label: 'Cabeceira elevada 45°', category: 'cuidado', defaultChecked: true },
      { id: 'ir7', label: 'Monitorização SpO₂ contínua', category: 'cuidado', defaultChecked: true },
      { id: 'ir8', label: 'Gasometria arterial', category: 'exame_lab', defaultChecked: true },
      { id: 'ir9', label: 'Hemograma + PCR', category: 'exame_lab', defaultChecked: true },
      { id: 'ir10', label: 'BNP / NT-proBNP', category: 'exame_lab', defaultChecked: false },
      { id: 'ir11', label: 'Rx Tórax PA + Perfil', category: 'exame_imagem', defaultChecked: true },
      { id: 'ir12', label: 'TC Tórax', category: 'exame_imagem', defaultChecked: false, details: 'Se suspeita TEP/pneumonia complicada' },
      { id: 'ir13', label: 'Parecer Pneumologia', category: 'parecer', defaultChecked: false },
    ],
  },
  {
    id: 'dor_toracica',
    label: 'Dor Torácica / SCA',
    icon: '❤️',
    color: 'bg-rose-600',
    description: 'Dor torácica típica, suspeita de SCA',
    defaultDestination: 'sala_vermelha',
    items: [
      { id: 'dt1', label: 'AAS 300mg VO (mastigar)', category: 'prescricao', defaultChecked: true },
      { id: 'dt2', label: 'Clopidogrel 300mg VO', category: 'prescricao', defaultChecked: true },
      { id: 'dt3', label: 'Enoxaparina 1mg/kg SC', category: 'prescricao', defaultChecked: true },
      { id: 'dt4', label: 'Morfina 2mg EV', category: 'prescricao', defaultChecked: false, details: 'Se dor refratária' },
      { id: 'dt5', label: 'Nitroglicerina SL 5mg', category: 'prescricao', defaultChecked: false },
      { id: 'dt6', label: 'Atenolol 25mg VO', category: 'prescricao', defaultChecked: false, details: 'Se FC > 100 e sem CI' },
      { id: 'dt7', label: 'Monitorização contínua', category: 'cuidado', defaultChecked: true },
      { id: 'dt8', label: 'Repouso absoluto no leito', category: 'cuidado', defaultChecked: true },
      { id: 'dt9', label: 'Troponina ultrassensível', category: 'exame_lab', defaultChecked: true },
      { id: 'dt10', label: 'CK-MB', category: 'exame_lab', defaultChecked: true },
      { id: 'dt11', label: 'Hemograma + Coagulograma', category: 'exame_lab', defaultChecked: true },
      { id: 'dt12', label: 'ECG 12 derivações', category: 'exame_imagem', defaultChecked: true, details: 'URGENTE — em até 10min' },
      { id: 'dt13', label: 'Rx Tórax AP', category: 'exame_imagem', defaultChecked: true },
      { id: 'dt14', label: 'Parecer Cardiologia', category: 'parecer', defaultChecked: true },
      { id: 'dt15', label: 'Parecer Hemodinâmica', category: 'parecer', defaultChecked: false },
    ],
  },
  {
    id: 'avc',
    label: 'AVC / Stroke',
    icon: '🧠',
    color: 'bg-amber-600',
    description: 'Déficit neurológico agudo, suspeita de AVC',
    defaultDestination: 'sala_vermelha',
    items: [
      { id: 'a1', label: 'SF 0,9% 500ml EV', category: 'prescricao', defaultChecked: true },
      { id: 'a2', label: 'Alteplase (rt-PA)', category: 'prescricao', defaultChecked: false, details: 'Se < 4,5h e sem CI — PROTOCOLO' },
      { id: 'a3', label: 'Captopril 25mg VO', category: 'prescricao', defaultChecked: false, details: 'Se PA > 220/120 (AVC isquêmico)' },
      { id: 'a4', label: 'Dipirona 1g EV', category: 'prescricao', defaultChecked: true, details: 'Se Tax > 37,5°C' },
      { id: 'a5', label: 'Aplicar escala NIHSS', category: 'cuidado', defaultChecked: true },
      { id: 'a6', label: 'Registrar hora do ictus', category: 'cuidado', defaultChecked: true },
      { id: 'a7', label: 'Cabeceira 0° (isquêmico) ou 30° (hemorrágico)', category: 'cuidado', defaultChecked: true },
      { id: 'a8', label: 'Glicemia capilar', category: 'exame_lab', defaultChecked: true },
      { id: 'a9', label: 'Hemograma + Coagulograma + Plaquetas', category: 'exame_lab', defaultChecked: true },
      { id: 'a10', label: 'Função renal + Eletrólitos', category: 'exame_lab', defaultChecked: true },
      { id: 'a11', label: 'TC Crânio sem contraste', category: 'exame_imagem', defaultChecked: true, details: 'URGENTE — em até 25min da chegada' },
      { id: 'a12', label: 'AngioTC cerebral', category: 'exame_imagem', defaultChecked: false, details: 'Se trombectomia mecânica' },
      { id: 'a13', label: 'ECG 12 derivações', category: 'exame_imagem', defaultChecked: true },
      { id: 'a14', label: 'Parecer Neurologia', category: 'parecer', defaultChecked: true, details: 'URGENTE' },
      { id: 'a15', label: 'Parecer Neurocirurgia', category: 'parecer', defaultChecked: false },
    ],
  },
  {
    id: 'sepse',
    label: 'Sepse',
    icon: '🦠',
    color: 'bg-orange-600',
    description: 'Infecção + disfunção orgânica (qSOFA ≥ 2)',
    defaultDestination: 'sala_vermelha',
    items: [
      { id: 's1', label: 'SF 0,9% 30ml/kg EV (1ª hora)', category: 'prescricao', defaultChecked: true },
      { id: 's2', label: 'Ceftriaxona 2g EV', category: 'prescricao', defaultChecked: true, details: 'ATB empírico — ajustar conforme foco' },
      { id: 's3', label: 'Noradrenalina BIC', category: 'prescricao', defaultChecked: false, details: 'Se PAM < 65 após volume' },
      { id: 's4', label: 'Dipirona 1g EV 6/6h', category: 'prescricao', defaultChecked: true },
      { id: 's5', label: 'SVD + controle diurese horária', category: 'cuidado', defaultChecked: true },
      { id: 's6', label: 'Acesso venoso calibroso (2 acessos)', category: 'cuidado', defaultChecked: true },
      { id: 's7', label: 'Monitorização contínua', category: 'cuidado', defaultChecked: true },
      { id: 's8', label: 'Hemoculturas (2 sítios)', category: 'exame_lab', defaultChecked: true, details: 'ANTES do ATB' },
      { id: 's9', label: 'Lactato sérico', category: 'exame_lab', defaultChecked: true },
      { id: 's10', label: 'Hemograma + PCR + Procalcitonina', category: 'exame_lab', defaultChecked: true },
      { id: 's11', label: 'Função renal + Eletrólitos + TGO/TGP', category: 'exame_lab', defaultChecked: true },
      { id: 's12', label: 'Gasometria arterial', category: 'exame_lab', defaultChecked: true },
      { id: 's13', label: 'Urocultura', category: 'exame_lab', defaultChecked: false },
      { id: 's14', label: 'Rx Tórax AP', category: 'exame_imagem', defaultChecked: true },
      { id: 's15', label: 'Parecer Infectologia', category: 'parecer', defaultChecked: false },
    ],
  },
  {
    id: 'trauma',
    label: 'Trauma',
    icon: '🚑',
    color: 'bg-emerald-700',
    description: 'Politrauma, queda, acidente automobilístico',
    defaultDestination: 'sala_vermelha',
    items: [
      { id: 't1', label: 'SF 0,9% 1000ml EV rápido', category: 'prescricao', defaultChecked: true },
      { id: 't2', label: 'Ácido tranexâmico 1g EV', category: 'prescricao', defaultChecked: true, details: '< 3h do trauma' },
      { id: 't3', label: 'Dipirona 1g EV', category: 'prescricao', defaultChecked: true },
      { id: 't4', label: 'Tramadol 100mg EV', category: 'prescricao', defaultChecked: false },
      { id: 't5', label: 'Profilaxia antitetânica', category: 'prescricao', defaultChecked: false },
      { id: 't6', label: 'Imobilização cervical', category: 'cuidado', defaultChecked: true },
      { id: 't7', label: 'ABCDE primário', category: 'cuidado', defaultChecked: true },
      { id: 't8', label: 'Acesso venoso calibroso (2 acessos)', category: 'cuidado', defaultChecked: true },
      { id: 't9', label: 'Hemograma + Tipagem sanguínea', category: 'exame_lab', defaultChecked: true },
      { id: 't10', label: 'Coagulograma', category: 'exame_lab', defaultChecked: true },
      { id: 't11', label: 'Gasometria + Lactato', category: 'exame_lab', defaultChecked: true },
      { id: 't12', label: 'Função renal + Eletrólitos', category: 'exame_lab', defaultChecked: true },
      { id: 't13', label: 'FAST (USG à beira-leito)', category: 'exame_imagem', defaultChecked: true },
      { id: 't14', label: 'Rx Tórax + Rx Pelve', category: 'exame_imagem', defaultChecked: true },
      { id: 't15', label: 'TC corpo inteiro', category: 'exame_imagem', defaultChecked: false, details: 'Se mecanismo de alta energia' },
      { id: 't16', label: 'Parecer Cirurgia Geral', category: 'parecer', defaultChecked: true },
      { id: 't17', label: 'Parecer Ortopedia', category: 'parecer', defaultChecked: false },
      { id: 't18', label: 'Parecer Neurocirurgia', category: 'parecer', defaultChecked: false },
    ],
  },
];

export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  prescricao: { label: 'Prescrição', icon: '💊' },
  cuidado: { label: 'Cuidados', icon: '🩺' },
  exame_lab: { label: 'Laboratório', icon: '🧪' },
  exame_imagem: { label: 'Imagem', icon: '📷' },
  parecer: { label: 'Parecer', icon: '📋' },
};

export const DESTINATION_OPTIONS = [
  { value: 'sala_vermelha', label: 'Sala Vermelha' },
  { value: 'sala_laranja', label: 'Sala Laranja' },
  { value: 'enfermaria', label: 'Enfermaria' },
  { value: 'uti', label: 'UTI (solicitar vaga)' },
  { value: 'centro_cirurgico', label: 'Centro Cirúrgico' },
  { value: 'alta', label: 'Alta / Liberação' },
  { value: 'transferencia', label: 'Transferência externa' },
];
