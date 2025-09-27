import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ffmpegServiceUrl = Deno.env.get('FFMPEG_SERVICE_URL');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get jobId from query params
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return new Response(JSON.stringify({
        error: '❌ Job not found'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'No authorization header'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify JWT and get user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Read job from Supabase
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({
        error: '❌ Job not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If job is not in final state and has FFmpeg job ID, check FFmpeg service
    const finalStates = ['completed', 'failed', 'cancelled'];
    if (!finalStates.includes(job.status) && job.ffmpeg_job_id && ffmpegServiceUrl) {
      try {
        const ffmpegResponse = await fetch(`${ffmpegServiceUrl}/jobs/${job.ffmpeg_job_id}/status`);
        
        if (ffmpegResponse.ok) {
          const ffmpegData = await ffmpegResponse.json();
          
          // Update Supabase job with latest progress
          const updateData: any = {
            updated_at: new Date().toISOString()
          };

          if (ffmpegData.status) updateData.status = ffmpegData.status;
          if (ffmpegData.stage) updateData.stage = ffmpegData.stage;
          if (ffmpegData.progress !== undefined) updateData.progress = ffmpegData.progress;
          if (ffmpegData.clips) updateData.clips = ffmpegData.clips;

          const { data: updatedJob } = await supabase
            .from('jobs')
            .update(updateData)
            .eq('id', jobId)
            .select()
            .single();

          if (updatedJob) {
            return new Response(JSON.stringify({
              jobId: updatedJob.id,
              status: updatedJob.status,
              stage: updatedJob.stage,
              progress: updatedJob.progress,
              clips: updatedJob.clips,
              metadata: updatedJob.metadata
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (ffmpegError) {
        console.error('Error checking FFmpeg status:', ffmpegError);
      }
    }

    // Return current job status from Supabase
    return new Response(JSON.stringify({
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      clips: job.clips,
      metadata: job.metadata
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in jobs-status:', error);
    return new Response(JSON.stringify({
      error: '❌ Could not read job status'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});