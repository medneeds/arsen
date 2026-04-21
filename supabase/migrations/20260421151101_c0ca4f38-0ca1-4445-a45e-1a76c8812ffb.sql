-- Add palliative care flag and isolation/precautions text to patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS is_palliative boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS isolation_precautions text;

COMMENT ON COLUMN public.patients.is_palliative IS 'Indica se o paciente está em cuidados paliativos exclusivos/conforto';
COMMENT ON COLUMN public.patients.isolation_precautions IS 'Tipo de precaução/isolamento (ex: Contato, Gotículas, Aerossóis, Reverso) — texto livre';