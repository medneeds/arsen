
-- Seed: Medicamentos essenciais com apresentações e aliases
INSERT INTO public.medication_catalog (id, generic_name, therapeutic_class, pharmacological_group, atc_code, controlled, requires_dilution, high_alert, notes) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Dipirona Sódica', 'Analgésico/Antipirético', 'Pirazolonas', 'N02BB02', false, false, false, 'Analgésico e antipirético de uso amplo. Evitar em pacientes com discrasias sanguíneas.'),
  ('a0000001-0000-0000-0000-000000000002', 'Ceftriaxona', 'Antibiótico', 'Cefalosporinas 3ª geração', 'J01DD04', false, true, false, 'Antibiótico de amplo espectro. Reconstituir com água para injeção. Não misturar com soluções contendo cálcio.'),
  ('a0000001-0000-0000-0000-000000000003', 'Enoxaparina', 'Anticoagulante', 'Heparinas de baixo peso molecular', 'B01AB05', false, false, true, 'Alto alerta: risco de sangramento. Monitorar plaquetas. Ajustar dose em insuficiência renal.'),
  ('a0000001-0000-0000-0000-000000000004', 'Norepinefrina', 'Vasopressor', 'Catecolaminas', 'C01CA03', false, true, true, 'Alto alerta: uso exclusivo em bomba de infusão contínua. Acesso venoso central preferencial.'),
  ('a0000001-0000-0000-0000-000000000005', 'Omeprazol', 'Inibidor de Bomba de Prótons', 'Benzimidazóis', 'A02BC01', false, true, false, 'Reconstituir com SF 0,9% ou SG 5%. Infundir em 20-30 min quando IV.'),
  ('a0000001-0000-0000-0000-000000000006', 'Tramadol', 'Analgésico Opioide', 'Opioides', 'N02AX02', true, false, true, 'Controlado (lista A2). Alto alerta. Monitorar sedação e frequência respiratória.'),
  ('a0000001-0000-0000-0000-000000000007', 'Amoxicilina', 'Antibiótico', 'Penicilinas', 'J01CA04', false, false, false, 'Verificar alergia a penicilinas. Ajustar dose em insuficiência renal.'),
  ('a0000001-0000-0000-0000-000000000008', 'Insulina Regular', 'Hipoglicemiante', 'Insulinas', 'A10AB01', false, false, true, 'Alto alerta: verificar glicemia capilar antes da administração. Armazenar refrigerado.'),
  ('a0000001-0000-0000-0000-000000000009', 'Furosemida', 'Diurético', 'Diuréticos de alça', 'C03CA01', false, false, false, 'Monitorar eletrólitos (K+, Na+, Mg2+). Pode causar ototoxicidade em doses altas.'),
  ('a0000001-0000-0000-0000-000000000010', 'Metoclopramida', 'Antiemético', 'Benzamidas', 'A03FA01', false, false, false, 'Risco de reações extrapiramidais. Evitar uso prolongado. Contraindicada em obstrução mecânica GI.');

-- Apresentações
INSERT INTO public.medication_presentations (medication_id, form, concentration, unit, route, standard_dilution, max_daily_dose, infusion_time) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Ampola', '500mg/mL', 'mg', 'IV', 'Diluir em 100mL SF 0,9%', '4g/dia', '15-30 min'),
  ('a0000001-0000-0000-0000-000000000001', 'Comprimido', '500mg', 'mg', 'VO', NULL, '4g/dia', NULL),
  ('a0000001-0000-0000-0000-000000000001', 'Gotas', '500mg/mL', 'mg', 'VO', NULL, '4g/dia', NULL),
  ('a0000001-0000-0000-0000-000000000002', 'Frasco-ampola', '1g', 'g', 'IV', 'Reconstituir com 10mL AD, diluir em 100mL SF', '4g/dia', '30 min'),
  ('a0000001-0000-0000-0000-000000000002', 'Frasco-ampola', '1g', 'g', 'IM', 'Reconstituir com 3,5mL lidocaína 1%', '4g/dia', NULL),
  ('a0000001-0000-0000-0000-000000000003', 'Seringa preenchida', '40mg/0,4mL', 'mg', 'SC', NULL, '1,5mg/kg/dia', NULL),
  ('a0000001-0000-0000-0000-000000000003', 'Seringa preenchida', '60mg/0,6mL', 'mg', 'SC', NULL, '1,5mg/kg/dia', NULL),
  ('a0000001-0000-0000-0000-000000000004', 'Ampola', '2mg/mL (4mL)', 'mcg', 'IV', 'Diluir 4 amp em 234mL SG5% (concentração: 32mcg/mL)', NULL, 'Infusão contínua BIC'),
  ('a0000001-0000-0000-0000-000000000005', 'Frasco-ampola', '40mg', 'mg', 'IV', 'Reconstituir com 10mL AD', '40mg/dia', '20-30 min'),
  ('a0000001-0000-0000-0000-000000000005', 'Cápsula', '20mg', 'mg', 'VO', NULL, '40mg/dia', NULL),
  ('a0000001-0000-0000-0000-000000000006', 'Ampola', '100mg/2mL', 'mg', 'IV', 'Diluir em 100mL SF 0,9%', '400mg/dia', '15-30 min'),
  ('a0000001-0000-0000-0000-000000000006', 'Cápsula', '50mg', 'mg', 'VO', NULL, '400mg/dia', NULL),
  ('a0000001-0000-0000-0000-000000000007', 'Cápsula', '500mg', 'mg', 'VO', NULL, '3g/dia', NULL),
  ('a0000001-0000-0000-0000-000000000007', 'Suspensão', '250mg/5mL', 'mg', 'VO', NULL, '3g/dia', NULL),
  ('a0000001-0000-0000-0000-000000000008', 'Frasco', '100UI/mL', 'UI', 'SC', NULL, 'Conforme protocolo', NULL),
  ('a0000001-0000-0000-0000-000000000008', 'Frasco', '100UI/mL', 'UI', 'IV', 'Diluir em SF 0,9%', 'Conforme protocolo', 'Infusão contínua BIC'),
  ('a0000001-0000-0000-0000-000000000009', 'Ampola', '20mg/2mL', 'mg', 'IV', 'Pode ser em bolus ou diluir em SF', '600mg/dia', '1-2 min (bolus)'),
  ('a0000001-0000-0000-0000-000000000009', 'Comprimido', '40mg', 'mg', 'VO', NULL, '600mg/dia', NULL),
  ('a0000001-0000-0000-0000-000000000010', 'Ampola', '10mg/2mL', 'mg', 'IV', NULL, '30mg/dia', '1-2 min'),
  ('a0000001-0000-0000-0000-000000000010', 'Comprimido', '10mg', 'mg', 'VO', NULL, '30mg/dia', NULL);

-- Aliases (nomes comerciais)
INSERT INTO public.medication_aliases (medication_id, alias_name, alias_type) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Novalgina', 'commercial'),
  ('a0000001-0000-0000-0000-000000000001', 'Anador', 'commercial'),
  ('a0000001-0000-0000-0000-000000000002', 'Rocefin', 'commercial'),
  ('a0000001-0000-0000-0000-000000000002', 'Triaxon', 'commercial'),
  ('a0000001-0000-0000-0000-000000000003', 'Clexane', 'commercial'),
  ('a0000001-0000-0000-0000-000000000004', 'Levophed', 'commercial'),
  ('a0000001-0000-0000-0000-000000000004', 'Nora', 'abbreviation'),
  ('a0000001-0000-0000-0000-000000000005', 'Losec', 'commercial'),
  ('a0000001-0000-0000-0000-000000000005', 'Peprazol', 'commercial'),
  ('a0000001-0000-0000-0000-000000000006', 'Tramal', 'commercial'),
  ('a0000001-0000-0000-0000-000000000007', 'Amoxil', 'commercial'),
  ('a0000001-0000-0000-0000-000000000008', 'Humulin R', 'commercial'),
  ('a0000001-0000-0000-0000-000000000008', 'IR', 'abbreviation'),
  ('a0000001-0000-0000-0000-000000000009', 'Lasix', 'commercial'),
  ('a0000001-0000-0000-0000-000000000010', 'Plasil', 'commercial');
