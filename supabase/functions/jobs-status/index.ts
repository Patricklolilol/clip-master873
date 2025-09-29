import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function makeAbsoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function callFfmpegInfo(ffmpegJobId: string, ffmpegUrl: string, ffmpegKey?: string) {
  const headers: any = { "Content-Type": "application/json" };
  if (ffmpegKey) headers["X-API-Key"] = ffmpegKey;

  const resp = await fetch(`${ffmpegUrl}/info`, {
    method: "POST",
    headers,
    body: JSON.stringify({ job_id: ffmpegJobId })
  });

  const text = await resp.text();
  try {
    return { status: resp.status, body: JSON.parse(text) };
  } catch {
    return { status: resp.status, body: text };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ffmpegServiceUrl = Deno.env.get('FFMPEG_SERVICE_URL') || 'https://ffmpeg-service-production-79e5.up.railway.app';
    const ffmpegApiKey = Deno.env.get('FFMPEG_API_KEY');

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

    // Parse request parameters
    const body = req.method === "GET" 
      ? Object.fromEntries(new URLSearchParams(new URL(req.url).search)) 
      : await req.json();
    const jobId = body.jobId || body.job_id;

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch job from database
    const { data: jobRow, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !jobRow) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If job is already in final state, return as-is
    if (['completed', 'failed', 'cancelled'].includes(jobRow.status)) {
      return new Response(JSON.stringify(jobRow), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If remote job id exists, poll ffmpeg /info
    if (jobRow.ffmpeg_job_id) {
      const ff = await callFfmpegInfo(jobRow.ffmpeg_job_id, ffmpegServiceUrl, ffmpegApiKey);
      console.log("FFmpeg /info returned:", ff);

      // If ffmpeg returned code===0 with data -> completed
      if (ff.status === 200 && ff.body && ff.body.code === 0 && ff.body.data) {
        const data = ff.body.data;
        const processedClips = [];

        // Handle screenshots
        if (data.screenshots && Array.isArray(data.screenshots)) {
          data.screenshots.forEach((screenshot: any, index: number) => {
            const absoluteUrl = makeAbsoluteUrl(screenshot.url || screenshot, ffmpegServiceUrl);
            processedClips.push({
              name: `Screenshot ${index + 1}`,
              url: absoluteUrl,
              type: 'screenshot',
              timestamp: screenshot.timestamp || index * 10
            });
          });
        }
        
        // Handle converted video
        if (data.conversion && data.conversion.url) {
          const absoluteUrl = makeAbsoluteUrl(data.conversion.url, ffmpegServiceUrl);
          processedClips.push({
            name: 'Converted Video',
            url: absoluteUrl,
            type: 'video',
            size: data.conversion.size || null
          });
        }

        // Update DB to completed
        const { data: updatedJob, error: updateError } = await supabase
          .from('jobs')
          .update({
            status: 'completed',
            stage: 'Completed',
            progress: 100,
            clips: processedClips
          })
          .eq('id', jobId)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update job to completed:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update job status' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify(updatedJob), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If ffmpeg returned a queued/processing shape
      if (ff.status === 200 && ff.body && (ff.body.status === "queued" || ff.body.status === "processing")) {
        // Update DB with latest status/progress
        const { data: updatedJob, error: updateError } = await supabase
          .from('jobs')
          .update({
            status: 'processing',
            stage: ff.body.status === 'queued' ? 'Queued' : 'Processing',
            progress: ff.body.progress || jobRow.progress || 0
          })
          .eq('id', jobId)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update job progress:', updateError);
          return new Response(JSON.stringify(jobRow), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify(updatedJob), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if job has been queued too long (60 seconds)
      const jobAge = Date.now() - new Date(jobRow.created_at).getTime();
      if (jobAge > 60000) {
        // Mark job as failed due to timeout
        const { data: failedJob, error: updateError } = await supabase
          .from('jobs')
          .update({
            status: 'failed',
            stage: 'Failed',
            progress: 0
          })
          .eq('id', jobId)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update job to failed:', updateError);
        }

        return new Response(JSON.stringify(failedJob || jobRow), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Unexpected remote response: return error with debugging info
      return new Response(JSON.stringify({ 
        error: "Unexpected FFmpeg /info response", 
        debug: ff,
        job: jobRow 
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // No ffmpeg_job_id (maybe synchronous job): just return DB row
    return new Response(JSON.stringify(jobRow), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("jobs-status error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});