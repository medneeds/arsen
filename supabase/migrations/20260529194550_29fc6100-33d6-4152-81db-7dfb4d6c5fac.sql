ALTER TABLE clinical_evolutions
  ADD COLUMN IF NOT EXISTS cid_primary text,
  ADD COLUMN IF NOT EXISTS cid_secondary text[];