-- Enable realtime broadcast for patients & admission_histories
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER TABLE public.admission_histories REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admission_histories;