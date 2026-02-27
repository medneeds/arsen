
-- Insert state Maranhão
INSERT INTO public.states (name, abbreviation) VALUES ('Maranhão', 'MA');

-- Insert hospital
INSERT INTO public.hospital_units (name, state_id, address)
SELECT 'Hospital Municipal Djalma Marques (Socorrão I)', s.id, 'São Luís - MA'
FROM public.states s WHERE s.abbreviation = 'MA';
