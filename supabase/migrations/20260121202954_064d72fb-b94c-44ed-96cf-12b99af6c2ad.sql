-- Add new column for daily conducts in UTI
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS uti_daily_conducts text;

-- Add comment for documentation
COMMENT ON COLUMN public.patients.uti_daily_conducts IS 'Condutas instituídas do dia na UTI - armazenado como texto separado por delimitador';