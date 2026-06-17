-- Harden anonymous submission policy for pre_registration_requests with strict validation
DROP POLICY IF EXISTS "Anyone can submit pre-registration" ON public.pre_registration_requests;

CREATE POLICY "Anyone can submit pre-registration"
ON public.pre_registration_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND created_user_id IS NULL
  AND full_name IS NOT NULL AND char_length(full_name) BETWEEN 3 AND 120
  AND email IS NOT NULL AND char_length(email) BETWEEN 5 AND 160 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND cpf IS NOT NULL AND cpf ~ '^[0-9]{11}$'
  AND (phone IS NULL OR char_length(phone) <= 30)
  AND (crm IS NULL OR char_length(crm) <= 40)
  AND (justification IS NULL OR char_length(justification) <= 1000)
  AND (reviewer_notes IS NULL)
);

-- Throttle floods: at most 1 pending pre-registration per (cpf, email)
CREATE UNIQUE INDEX IF NOT EXISTS pre_registration_requests_pending_cpf_email_uniq
ON public.pre_registration_requests (cpf, lower(email))
WHERE status = 'pending';