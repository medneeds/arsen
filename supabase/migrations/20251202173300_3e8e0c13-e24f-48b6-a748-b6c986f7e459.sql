-- Add display_order column to patients table for persisting drag-and-drop order
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_patients_display_order 
ON public.patients (hospital_unit_id, department, sector, display_order);

-- Initialize display_order for existing records based on bed_number
UPDATE public.patients 
SET display_order = COALESCE(
  CASE 
    WHEN bed_number ~ '^[0-9]+$' THEN bed_number::integer
    ELSE 0
  END, 0
)
WHERE display_order = 0 OR display_order IS NULL;