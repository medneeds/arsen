-- Add highlighted_pendencies column to store indices of highlighted pendency items
ALTER TABLE public.patients 
ADD COLUMN highlighted_pendencies integer[] DEFAULT ARRAY[]::integer[];