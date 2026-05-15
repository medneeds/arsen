ALTER TABLE public.clinical_evolutions
  ADD COLUMN IF NOT EXISTS diagnostic_hypotheses TEXT;

COMMENT ON COLUMN public.clinical_evolutions.diagnostic_hypotheses IS
  'Texto livre de hipóteses diagnósticas registradas na evolução. Cada linha vira um item de patients.diagnoses (sincronização unidirecional Evolução → Mapa de Leitos).';