ALTER TABLE public.round_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.round_responses REPLICA IDENTITY FULL;
ALTER TABLE public.round_section_goals REPLICA IDENTITY FULL;
ALTER TABLE public.bed_allocation_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.round_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.round_responses; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.round_section_goals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bed_allocation_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;