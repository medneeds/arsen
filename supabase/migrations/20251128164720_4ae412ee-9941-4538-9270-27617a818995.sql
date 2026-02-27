-- Drop the existing restrictive policy that requires authentication
DROP POLICY IF EXISTS "Authenticated users can view states" ON public.states;

-- Create a new policy allowing public read access to states
CREATE POLICY "Public users can view states"
ON public.states
FOR SELECT
USING (true);

-- Drop the existing restrictive policy for hospital_units if it exists
DROP POLICY IF EXISTS "Authenticated users can view hospital units" ON public.hospital_units;

-- Create a new policy allowing public read access to hospital_units
CREATE POLICY "Public users can view hospital units"
ON public.hospital_units
FOR SELECT
USING (true);