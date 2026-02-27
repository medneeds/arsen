-- Inserir estado Maranhão
INSERT INTO public.states (name, abbreviation) VALUES ('Maranhão', 'MA');

-- Inserir Hospital Municipal Djalma Marques (Socorrão I)
INSERT INTO public.hospital_units (name, address, state_id)
SELECT 'Hospital Municipal Djalma Marques (Socorrão I)', 'São Luís - MA', s.id
FROM public.states s WHERE s.abbreviation = 'MA';