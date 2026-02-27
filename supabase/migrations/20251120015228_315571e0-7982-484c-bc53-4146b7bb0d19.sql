-- Add responsible doctor field to patient_movements table
ALTER TABLE patient_movements 
ADD COLUMN responsible_doctor TEXT DEFAULT NULL;