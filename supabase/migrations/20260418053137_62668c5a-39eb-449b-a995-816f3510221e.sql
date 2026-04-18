ALTER TABLE public.prescriptions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prescriptions;