
-- Create storage bucket for exam result files (images and PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-results', 'exam-results', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to exam-results bucket
CREATE POLICY "Authenticated users can upload exam results"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exam-results');

-- Allow authenticated users to view exam result files
CREATE POLICY "Authenticated users can view exam results"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'exam-results');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete exam results"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'exam-results');

-- Allow public read access for viewing results
CREATE POLICY "Public can view exam results"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'exam-results');
