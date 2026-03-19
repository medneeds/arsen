
ALTER TABLE public.patients DROP CONSTRAINT patients_sector_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_sector_check 
  CHECK (sector = ANY (ARRAY['red', 'yellow', 'blue', 'outside', 'UTI 1', 'UTI 2', 'UCI 1', 'UCI 2']));
