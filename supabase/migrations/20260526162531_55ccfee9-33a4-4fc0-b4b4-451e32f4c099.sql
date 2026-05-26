DELETE FROM public.patients
WHERE id = '44cab9bf-0a63-4c24-85f0-47bcbc3e5788'
  AND bed_number = 'EXTRA1'
  AND sector = 'yellow'
  AND COALESCE(name, '') = ''
  AND patient_registry_id IS NULL
  AND COALESCE(medical_record, '') = '';