-- Enable REPLICA IDENTITY FULL for the patients table to capture complete row data during updates
ALTER TABLE public.patients REPLICA IDENTITY FULL;