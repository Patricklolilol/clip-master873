-- Update jobs table structure for new system
DROP TABLE IF EXISTS jobs CASCADE;

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ffmpeg_job_id TEXT UNIQUE,
  video_id TEXT,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT DEFAULT 'Queued',
  progress INTEGER DEFAULT 0,
  metadata JSONB,
  options JSONB,
  clips JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own jobs" ON public.jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" ON public.jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all jobs" ON public.jobs
  FOR ALL USING (auth.role() = 'service_role');

-- Update trigger
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_jobs_ffmpeg_job_id ON public.jobs(ffmpeg_job_id);
CREATE INDEX idx_jobs_expires_at ON public.jobs(expires_at);