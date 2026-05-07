INSERT INTO public.module_ip_settings (module_key, enforce, bypass_for_admin, description) VALUES
  ('medico', false, true, 'Médico Assistente'),
  ('ccih', false, true, 'CCIH — Controle de Infecção'),
  ('imagem', false, true, 'Setor de Imagem'),
  ('laboratorio', false, true, 'Setor Laboratorial'),
  ('administrativo', false, true, 'Administrativo / Recepção'),
  ('multi', false, true, 'Equipe Multiprofissional'),
  ('classificacao_risco', false, true, 'Classificação de Risco'),
  ('coord_medico', false, true, 'Coordenador Médico'),
  ('coord_enfermagem', false, true, 'Coordenador de Enfermagem'),
  ('coord_multi', false, true, 'Coordenador Multiprofissional'),
  ('desenvolvedor', false, true, 'Desenvolvedor')
ON CONFLICT (module_key) DO NOTHING;