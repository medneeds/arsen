-- Add patient snapshot column to patient_movements table
ALTER TABLE patient_movements 
ADD COLUMN patient_snapshot JSONB DEFAULT NULL;