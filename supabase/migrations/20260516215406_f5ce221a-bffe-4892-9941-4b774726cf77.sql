CREATE TABLE IF NOT EXISTS public.prescription_draft_deletion_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id UUID NOT NULL,
  prescription_snapshot JSONB NOT NULL,
  patient_name TEXT,
  patient_id UUID,
  version INTEGER,
  deleted_by UUID NOT NULL,
  deleted_by_name TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pddaudit_prescription ON public.prescription_draft_deletion_audit(prescription_id);
CREATE INDEX IF NOT EXISTS idx_pddaudit_deleted_by ON public.prescription_draft_deletion_audit(deleted_by);
CREATE INDEX IF NOT EXISTS idx_pddaudit_created_at ON public.prescription_draft_deletion_audit(created_at DESC);

ALTER TABLE public.prescription_draft_deletion_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own draft deletion audit"
ON public.prescription_draft_deletion_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = deleted_by);

CREATE POLICY "Admin/Coordenador can view draft deletion audit"
ON public.prescription_draft_deletion_audit
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
);

CREATE POLICY "Author or privileged roles can delete draft prescriptions"
ON public.prescriptions
FOR DELETE
TO authenticated
USING (
  status = 'draft'
  AND (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  )
);