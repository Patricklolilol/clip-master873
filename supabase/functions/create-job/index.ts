import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateJobRequest {
  youtube_url: string;
  max_clips: number;
  min_duration: number;
  max_duration: number;
  captions_style: 'modern' | 'bold' | 'neon' | 'classic';
  music_enabled: boolean;
  sfx_enabled: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify JWT and get user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    const body: CreateJobRequest = await req.json();
    
    // Validate YouTube URL
    const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeUrlPattern.test(body.youtube_url)) {
      throw new Error('Invalid YouTube URL format');
    }

    // Extract video ID
    let videoId = '';
    try {
      const url = new URL(body.youtube_url.startsWith('http') ? body.youtube_url : `https://${body.youtube_url}`);
      if (url.hostname === 'youtu.be') {
        videoId = url.pathname.substring(1);
      } else if (url.hostname.includes('youtube.com')) {
        videoId = url.searchParams.get('v') || '';
      }
    } catch {
      throw new Error('Failed to parse YouTube URL');
    }

    if (!videoId) {
      throw new Error('Could not extract video ID from URL');
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        youtube_url: body.youtube_url,
        video_id: videoId,
        max_clips: body.max_clips,
        min_duration: body.min_duration,
        max_duration: body.max_duration,
        captions_style: body.captions_style,
        music_enabled: body.music_enabled,
        sfx_enabled: body.sfx_enabled,
        status: 'queued',
        current_stage: 'Queued for processing'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job creation error:', jobError);
      throw new Error('Failed to create job');
    }

    // Trigger the video processing pipeline using direct function invocation
    try {
      const processResponse = await supabase.functions.invoke('process-video', {
        body: { job_id: job.id }
      });

      if (processResponse.error) {
        console.error('Failed to trigger video processing:', processResponse.error);
        // Don't throw error here - job is created, processing will be retried
      } else {
        console.log('Video processing triggered successfully for job:', job.id);
      }
    } catch (processError) {
      console.error('Error invoking process-video:', processError);
      // Continue - job is created, user can retry
    }

    return new Response(JSON.stringify({
      job_id: job.id,
      status: job.status,
      message: 'Job created successfully and processing started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in create-job:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({
      error: message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});