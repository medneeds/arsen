-- Add department column to internment_requests table
ALTER TABLE public.internment_requests 
ADD COLUMN department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO';

-- Create index for better query performance
CREATE INDEX idx_internment_requests_department ON public.internment_requests(department);

-- Create index for date filtering performance
CREATE INDEX idx_internment_requests_created_at ON public.internment_requests(created_at);