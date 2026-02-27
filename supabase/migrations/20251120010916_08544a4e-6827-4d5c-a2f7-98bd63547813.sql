-- Create table for patient movements tracking
CREATE TABLE public.patient_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID,
  patient_name TEXT NOT NULL,
  patient_bed TEXT,
  patient_sector TEXT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('ALTA', 'ÓBITO', 'TRANSFERÊNCIA')),
  destination TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.patient_movements ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all movements
CREATE POLICY "Usuários autenticados podem visualizar movimentações"
ON public.patient_movements
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Authenticated users can create movements
CREATE POLICY "Usuários autenticados podem criar movimentações"
ON public.patient_movements
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Admins can delete movements
CREATE POLICY "Admins podem deletar movimentações"
ON public.patient_movements
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better performance
CREATE INDEX idx_patient_movements_created_at ON public.patient_movements(created_at DESC);
CREATE INDEX idx_patient_movements_type ON public.patient_movements(movement_type);