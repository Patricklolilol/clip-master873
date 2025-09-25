-- Create storage buckets for the Viral Clip Maker
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('raw-videos', 'raw-videos', false, 1073741824, ARRAY['video/mp4', 'video/webm', 'video/quicktime']), -- 1GB limit
  ('processed-clips', 'processed-clips', true, 104857600, ARRAY['video/mp4']), -- 100MB limit, public
  ('thumbnails', 'thumbnails', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']), -- 10MB limit, public
  ('subtitles', 'subtitles', true, 1048576, ARRAY['text/vtt', 'text/srt']), -- 1MB limit, public
  ('transcripts', 'transcripts', false, 10485760, ARRAY['application/json', 'text/plain']), -- 10MB limit
  ('user-uploads', 'user-uploads', false, 52428800, ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3']); -- 50MB limit for user music

-- Storage policies for raw-videos (private)
CREATE POLICY "Users can upload their raw videos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'raw-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their raw videos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'raw-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for processed-clips (public read, user write)
CREATE POLICY "Anyone can view processed clips" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'processed-clips');

CREATE POLICY "System can upload processed clips" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'processed-clips');

CREATE POLICY "Users can delete their processed clips" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'processed-clips' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for thumbnails (public read, system write)
CREATE POLICY "Anyone can view thumbnails" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'thumbnails');

CREATE POLICY "System can upload thumbnails" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'thumbnails');

-- Storage policies for subtitles (public read, system write)
CREATE POLICY "Anyone can view subtitles" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'subtitles');

CREATE POLICY "System can upload subtitles" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'subtitles');

-- Storage policies for transcripts (private)
CREATE POLICY "Users can view their transcripts" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'transcripts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "System can upload transcripts" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'transcripts');

-- Storage policies for user-uploads (private)
CREATE POLICY "Users can upload their music files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their uploaded files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create real-time subscriptions for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clips;

-- Set replica identity for real-time updates
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.clips REPLICA IDENTITY FULL;