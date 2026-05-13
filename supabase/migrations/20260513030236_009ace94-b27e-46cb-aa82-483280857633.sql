ALTER TABLE public.pre_admissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_admissions;