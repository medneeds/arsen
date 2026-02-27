-- Add PSM status field to patients table
-- PSM (Parecer de Solicitação Médica) indicates if the admission request was approved
-- 'favoravel' = approved, 'desfavoravel' = not approved/pending clinical improvement
ALTER TABLE public.patients
ADD COLUMN psm_status text DEFAULT NULL;

COMMENT ON COLUMN public.patients.psm_status IS 'PSM status: favoravel (approved) or desfavoravel (not approved by audit)';