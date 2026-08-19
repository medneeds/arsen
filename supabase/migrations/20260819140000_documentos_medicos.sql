-- ════════════════════════════════════════════════════════════════════════
-- Tabela: documentos_medicos (atestado / relatório / termo)
-- ════════════════════════════════════════════════════════════════════════
-- Mesmo padrão de receituarios: hoje esses 3 tipos, emitidos via
-- MedicalDocumentDialog, só geram HTML e mandam pra impressão — não gravam
-- em lugar nenhum. Um atestado de afastamento, um relatório médico ou um
-- termo de consentimento assinado simplesmente não existem no sistema
-- depois de impressos. Esta tabela fecha esse furo de rastreabilidade,
-- igual já foi feito para receituário/hemocomponente/SAT/procedimento.
--
-- Estrutura mais simples que receituarios: são documentos de texto livre
-- (sem itens estruturados de medicamento), então não têm coluna `items`.

CREATE TABLE IF NOT EXISTS public.documentos_medicos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  hospital_unit_id    uuid NOT NULL REFERENCES public.hospital_units(id) ON DELETE CASCADE,

  -- Vínculo com o paciente — mesmo modelo de receituarios: patient_id
  -- (linha-leito) + patient_registry_id (vínculo estável, segue entre
  -- leitos) + encounter_id (evita vazamento entre internações).
  patient_id          uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_registry_id uuid REFERENCES public.patient_registry(id) ON DELETE SET NULL,
  encounter_id        uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL,
  patient_name        text NOT NULL,
  patient_bed         text,
  patient_sector      text,

  -- Tipo: 'atestado' | 'relatorio' | 'termo'
  type                text NOT NULL CHECK (type IN ('atestado', 'relatorio', 'termo')),

  -- Corpo do texto (o que o médico digitou/editou no formulário)
  body                text NOT NULL,

  -- Campos específicos de atestado (nulos para os demais tipos)
  days                integer,
  cid                 text,

  -- Assinatura do médico
  signed_by_name      text,
  signed_by_crm       text,

  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_documentos_medicos_patient_id ON public.documentos_medicos(patient_id);
CREATE INDEX IF NOT EXISTS idx_documentos_medicos_patient_registry_id ON public.documentos_medicos(patient_registry_id);
CREATE INDEX IF NOT EXISTS idx_documentos_medicos_patient_name ON public.documentos_medicos(patient_name);
CREATE INDEX IF NOT EXISTS idx_documentos_medicos_hospital_unit_id ON public.documentos_medicos(hospital_unit_id);
CREATE INDEX IF NOT EXISTS idx_documentos_medicos_created_at ON public.documentos_medicos(created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_documentos_medicos_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_medicos_updated_at ON public.documentos_medicos;
CREATE TRIGGER trg_documentos_medicos_updated_at
BEFORE UPDATE ON public.documentos_medicos
FOR EACH ROW EXECUTE FUNCTION public.touch_documentos_medicos_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_medicos TO authenticated;
GRANT ALL ON public.documentos_medicos TO service_role;

ALTER TABLE public.documentos_medicos ENABLE ROW LEVEL SECURITY;

-- Mesma política de receituarios: leitura por quem acessa a unidade
-- hospitalar (ou admin/dev/gestor); gravação restrita a quem criou; exclusão
-- ao próprio autor ou admin.
CREATE POLICY "tenant_select_documentos_medicos"
ON public.documentos_medicos FOR SELECT TO authenticated
USING (
  (hospital_unit_id IS NOT NULL AND public.can_access_hospital(hospital_unit_id))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'dev'::app_role)
  OR is_gestor(auth.uid())
);

CREATE POLICY "tenant_insert_documentos_medicos"
ON public.documentos_medicos FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND hospital_unit_id IS NOT NULL
  AND public.can_access_hospital(hospital_unit_id)
);

CREATE POLICY "tenant_update_own_documentos_medicos"
ON public.documentos_medicos FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "tenant_delete_own_documentos_medicos"
ON public.documentos_medicos FOR DELETE TO authenticated
USING (
  auth.uid() = created_by
  OR has_role(auth.uid(), 'admin'::app_role)
);

COMMENT ON TABLE public.documentos_medicos IS
  'Atestados, relatórios e termos/declarações emitidos via MedicalDocumentDialog. Antes desta tabela, esses documentos só existiam como HTML impresso — sem nenhum rastro no sistema.';
