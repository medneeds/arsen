
ALTER TABLE public.patient_movements 
  ADD COLUMN IF NOT EXISTS release_status TEXT NOT NULL DEFAULT 'pending_release',
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by UUID,
  ADD COLUMN IF NOT EXISTS released_by_name TEXT;

COMMENT ON COLUMN public.patient_movements.release_status IS 'pending_release | released | not_applicable — controla se o leito foi efetivamente liberado pelo setor administrativo';

-- Permitir UPDATE para usuários autenticados (necessário para o setor administrativo liberar o leito)
DROP POLICY IF EXISTS "Setor administrativo pode liberar leitos" ON public.patient_movements;
CREATE POLICY "Setor administrativo pode liberar leitos"
ON public.patient_movements
FOR UPDATE
USING (auth.uid() IS NOT NULL);
