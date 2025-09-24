-- Create enum types for job and clip statuses
CREATE TYPE job_status AS ENUM (
  'queued',
  'downloading', 
  'transcribing',
  'detecting_highlights',
  'creating_clips',
  'uploading',
  'completed',
  'failed'
);

CREATE TYPE clip_status AS ENUM (
  'processing',
  'ready',
  'expired',
  'failed'
);

CREATE TYPE caption_style AS ENUM (
  'modern',
  'bold', 
  'neon',
  'classic'
);

-- Jobs table for tracking video processing jobs
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  youtube_url TEXT NOT NULL,
  video_id TEXT,
  title TEXT,
  status job_status NOT NULL DEFAULT 'queued',
  progress_percent INTEGER DEFAULT 0,
  current_stage TEXT,
  
  -- Job options
  max_clips INTEGER DEFAULT 3,
  min_duration INTEGER DEFAULT 15,
  max_duration INTEGER DEFAULT 45,
  captions_style caption_style DEFAULT 'modern',
  music_enabled BOOLEAN DEFAULT true,
  sfx_enabled BOOLEAN DEFAULT true,
  
  -- Processing metadata
  download_url TEXT,
  transcript_data JSONB,
  segments_data JSONB,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Clips table for individual generated clips
CREATE TABLE public.clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Clip metadata
  title TEXT NOT NULL,
  duration_seconds REAL NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  predicted_engagement REAL,
  
  -- File URLs and artifacts
  video_url TEXT,
  thumbnail_urls TEXT[],
  subtitle_urls TEXT[],
  download_count INTEGER DEFAULT 0,
  
  -- Processing metadata
  status clip_status NOT NULL DEFAULT 'processing',
  segment_scores JSONB,
  processing_logs JSONB,
  checksum TEXT,
  file_size_bytes BIGINT,
  
  -- Expiry (24 hours from creation)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Analytics table for real YouTube metrics
CREATE TABLE public.analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id UUID NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  
  -- YouTube metrics
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  avg_watch_time REAL DEFAULT 0,
  
  -- Calculated engagement metrics
  actual_engagement REAL,
  normalized_views REAL,
  like_ratio REAL,
  comment_rate REAL,
  
  -- Metadata
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User profiles for additional user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  
  -- Usage tracking
  total_jobs INTEGER DEFAULT 0,
  total_clips INTEGER DEFAULT 0,
  storage_used_bytes BIGINT DEFAULT 0,
  
  -- Settings
  default_captions_style caption_style DEFAULT 'modern',
  default_music_enabled BOOLEAN DEFAULT true,
  default_sfx_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Learning weights table for algorithm improvement
CREATE TABLE public.learning_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version INTEGER NOT NULL,
  
  -- Scoring weights (should sum to 1.0)
  laughter_weight REAL DEFAULT 0.35,
  keyword_weight REAL DEFAULT 0.25,
  volume_spike_weight REAL DEFAULT 0.20,
  visual_change_weight REAL DEFAULT 0.20,
  
  -- Learning parameters
  learning_rate REAL DEFAULT 0.05,
  is_active BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default learning weights
INSERT INTO public.learning_weights (version, is_active) 
VALUES (1, true);

-- Enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_weights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jobs
CREATE POLICY "Users can view their own jobs" 
ON public.jobs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs" 
ON public.jobs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" 
ON public.jobs FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for clips
CREATE POLICY "Users can view their own clips" 
ON public.clips FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own clips" 
ON public.clips FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for analytics
CREATE POLICY "Users can view analytics for their clips" 
ON public.analytics FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.clips 
  WHERE clips.id = analytics.clip_id 
  AND clips.user_id = auth.uid()
));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Learning weights are read-only for all authenticated users
CREATE POLICY "Authenticated users can view learning weights" 
ON public.learning_weights FOR SELECT 
TO authenticated 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);

CREATE INDEX idx_clips_user_id ON public.clips(user_id);
CREATE INDEX idx_clips_job_id ON public.clips(job_id);
CREATE INDEX idx_clips_expires_at ON public.clips(expires_at);
CREATE INDEX idx_clips_status ON public.clips(status);

CREATE INDEX idx_analytics_clip_id ON public.analytics(clip_id);
CREATE INDEX idx_analytics_video_id ON public.analytics(video_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clips_updated_at
  BEFORE UPDATE ON public.clips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to automatically expire clips
CREATE OR REPLACE FUNCTION public.expire_old_clips()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.clips 
  SET status = 'expired'
  WHERE expires_at < now() 
  AND status != 'expired';
END;
$$;