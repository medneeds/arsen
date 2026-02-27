
-- Add doctor name and office number fields to bed_allocation_requests
ALTER TABLE public.bed_allocation_requests
ADD COLUMN IF NOT EXISTS requesting_doctor_name text,
ADD COLUMN IF NOT EXISTS requesting_office_number text;
