-- ────────────────────────────────────────────────────────────────────────────
-- Migration: módulo de receituário (alta + ambulatorial)
--
-- Armazena receituários emitidos pelo médico, tanto de alta hospitalar quanto
-- ambulatorial. Cada registro contém os itens estruturados (JSONB) e um campo
-- de texto livre para orientações gerais.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS receituarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Vínculo com o paciente internado (nullable para ambulatorial sem leito)
  patient_id      uuid REFERENCES patients(id) ON DELETE SET NULL,
  patient_name    text NOT NULL,
  patient_bed     text,
  patient_sector  text,

  -- Tipo: 'alta' | 'ambulatorial'
  type            text NOT NULL CHECK (type IN ('alta', 'ambulatorial')),

  -- Itens estruturados: [{id, name, dose, route, frequency, duration}]
  items           jsonb NOT NULL DEFAULT '[]',

  -- Texto livre ao final (orientações gerais)
  free_text       text,

  -- Assinatura do médico
  signed_by_name  text,
  signed_by_crm   text,

  -- Referência opcional ao sumário de alta (quando type = 'alta')
  discharge_doc_id uuid,

  -- Quem criou
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para as consultas mais comuns
CREATE INDEX IF NOT EXISTS receituarios_patient_name_idx
  ON receituarios (patient_name);

CREATE INDEX IF NOT EXISTS receituarios_patient_id_idx
  ON receituarios (patient_id);

CREATE INDEX IF NOT EXISTS receituarios_created_at_idx
  ON receituarios (created_at DESC);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION set_receituarios_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receituarios_updated_at ON receituarios;
CREATE TRIGGER receituarios_updated_at
  BEFORE UPDATE ON receituarios
  FOR EACH ROW EXECUTE FUNCTION set_receituarios_updated_at();

-- RLS
ALTER TABLE receituarios ENABLE ROW LEVEL SECURITY;

-- Médicos, admins, gestores e coordenadores podem ler e gravar
CREATE POLICY "receituarios_select"
  ON receituarios FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'medico') OR
    has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "receituarios_insert"
  ON receituarios FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'medico') OR
    has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "receituarios_update"
  ON receituarios FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'medico') OR
    has_role(auth.uid(), 'coordenador')
  );
