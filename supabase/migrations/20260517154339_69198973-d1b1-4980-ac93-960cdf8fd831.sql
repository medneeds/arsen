with candidates as (
  select p.id as prescription_id, pr.id as registry_id
  from public.prescriptions p
  join public.patient_registry pr
    on pr.hospital_unit_id = p.hospital_unit_id
   and upper(btrim(pr.full_name)) = upper(btrim(p.patient_name))
  where p.patient_registry_id is null
    and pr.merged_into_registry_id is null
),
unambiguous as (
  select prescription_id, (array_agg(distinct registry_id))[1] as registry_id
  from candidates
  group by prescription_id
  having count(distinct registry_id) = 1
)
update public.prescriptions p
set patient_registry_id = u.registry_id
from unambiguous u
where p.id = u.prescription_id;

with candidates as (
  select e.id as encounter_id, pr.id as registry_id
  from public.patient_encounters e
  join public.patient_registry pr
    on pr.hospital_unit_id = e.hospital_unit_id
   and upper(btrim(pr.full_name)) = upper(btrim(e.patient_name))
  where e.registry_id is null
    and pr.merged_into_registry_id is null
),
unambiguous as (
  select encounter_id, (array_agg(distinct registry_id))[1] as registry_id
  from candidates
  group by encounter_id
  having count(distinct registry_id) = 1
)
update public.patient_encounters e
set registry_id = u.registry_id
from unambiguous u
where e.id = u.encounter_id;

create index if not exists idx_prescriptions_unit_name_created
  on public.prescriptions (hospital_unit_id, patient_name, created_at desc);

create index if not exists idx_encounters_unit_name_status
  on public.patient_encounters (hospital_unit_id, patient_name, status);
