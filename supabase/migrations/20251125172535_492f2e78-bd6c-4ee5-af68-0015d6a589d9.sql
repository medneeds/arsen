-- Rename title column to destination in internment_requests table
ALTER TABLE public.internment_requests 
RENAME COLUMN title TO destination;