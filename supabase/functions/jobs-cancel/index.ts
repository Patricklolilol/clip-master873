import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobsCancelRequest {
  jobId: string;
}

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

    const body: JobsCancelRequest = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return new Response(JSON.stringify({
        error: '❌ jobId required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get job from Supabase
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

    // Call FFmpeg cancel endpoint if job has FFmpeg ID
    if (job.ffmpeg_job_id && ffmpegServiceUrl) {
      try {
        const ffmpegApiKey = Deno.env.get('FFMPEG_API_KEY');
        const ffmpegHeaders: Record<string, string> = {};
        
        if (ffmpegApiKey) {
          ffmpegHeaders['X-API-Key'] = ffmpegApiKey;
        }

        await fetch(`${ffmpegServiceUrl}/jobs/${job.ffmpeg_job_id}/cancel`, {
          method: 'POST',
          headers: ffmpegHeaders
        });
        console.log('Job cancelled in FFmpeg service:', job.ffmpeg_job_id);
      } catch (ffmpegError) {
        console.error('Error cancelling FFmpeg job:', ffmpegError);
        // Continue with local cancellation even if remote cancel fails
      }
    }

    // Update Supabase job status
    const { data: updatedJob, error: updateError } = await supabase
      .from('jobs')
      .update({ 
        status: 'cancelled',
        stage: 'Cancelled by user',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating job status:', updateError);
      return new Response(JSON.stringify({
        error: '❌ Error cancelling job'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Job cancelled successfully:', jobId);

    return new Response(JSON.stringify({
      jobId: updatedJob.id,
      status: 'cancelled'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in jobs-cancel:', error);
    return new Response(JSON.stringify({
      error: '❌ Error cancelling job'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});