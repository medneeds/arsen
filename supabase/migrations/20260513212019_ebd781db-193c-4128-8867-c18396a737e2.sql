-- Remove "leitos" virtuais da UE Vertical e UE Horizontal.
-- UE não possui leitos físicos: o atendimento é por fluxo de consulta,
-- não por internação em leito. Os registros existentes estavam todos vagos.
DELETE FROM public.bed_census
 WHERE sector IN ('ue_vertical', 'ue_horizontal');

DELETE FROM public.patients
 WHERE sector IN ('ue_vertical', 'ue_horizontal')
   AND COALESCE(name, '') = ''
   AND is_vacant = true;