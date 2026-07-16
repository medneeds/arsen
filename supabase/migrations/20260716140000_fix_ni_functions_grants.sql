-- Fix: funções do fluxo de paciente Não Identificado (NI) foram criadas em
-- 20260417040950_7c510673-607a-42c0-89a8-584e436a4e87.sql sem GRANT EXECUTE,
-- causando "permission denied" ao chamar supabase.rpc() a partir do client
-- autenticado. Isso quebrava o salvamento do cadastro NI (generate_ni_code)
-- e deixava a checagem de CPF duplicado falhando silenciosamente
-- (check_patient_duplicate).

REVOKE ALL ON FUNCTION public.generate_ni_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_ni_code() TO authenticated;

REVOKE ALL ON FUNCTION public.check_patient_duplicate(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_patient_duplicate(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.promote_unidentified_patient(uuid, text, date, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_unidentified_patient(uuid, text, date, text, text, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.merge_unidentified_patient(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_unidentified_patient(uuid, uuid) TO authenticated;
