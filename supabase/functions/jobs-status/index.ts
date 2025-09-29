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

      // Accept both 200 and 202 responses
      if ((ff.status === 200 || ff.status === 202) && ff.body && ff.body.code === 0) {
        // Read from body.data with fallback to top-level
        const responseData = ff.body.data || ff.body;
        const actualStatus = responseData.status || ff.body.status;
        const actualProgress = responseData.progress || ff.body.progress || 0;
        
        console.log("Parsed response data:", { actualStatus, actualProgress, hasConversion: !!responseData.conversion, hasScreenshots: !!responseData.screenshots });

        // Check if this is final completion (has conversion url or screenshots)
        const isFinalCompletion = responseData.conversion?.url || 
                                 (responseData.screenshots && Array.isArray(responseData.screenshots) && responseData.screenshots.length > 0) ||
                                 actualStatus === 'completed';

        if (isFinalCompletion) {
          const processedClips = [];

          // Handle screenshots
          if (responseData.screenshots && Array.isArray(responseData.screenshots)) {
            responseData.screenshots.forEach((screenshot: any, index: number) => {
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
          if (responseData.conversion && responseData.conversion.url) {
            const absoluteUrl = makeAbsoluteUrl(responseData.conversion.url, ffmpegServiceUrl);
            processedClips.push({
              name: 'Converted Video',
              url: absoluteUrl,
              type: 'video',
              size: responseData.conversion.size || null
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

          console.log(`Job ${jobId} completed with ${processedClips.length} clips`);
          return new Response(JSON.stringify(updatedJob), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

          // If it's in progress (queued/processing status)
          // Derive an effective status: if FFmpeg stage says 'queued', treat as queued
          const effectiveStatus = (responseData.stage === 'queued') 
            ? 'queued' 
            : (actualStatus || jobRow.status);

          if (effectiveStatus === "queued" || effectiveStatus === "processing") {
            // Map stages consistently based on progress or explicit stage
            let stage = 'Processing';

            if (effectiveStatus === 'queued') {
              // Respect queued stage explicitly when FFmpeg reports it
              stage = 'Queued';
            } else if (responseData.stage && responseData.stage !== 'queued') {
              // Use explicit stage from FFmpeg if available and meaningful
              stage = responseData.stage;
            } else if (actualProgress !== undefined) {
              // Map progress to stages
              if (actualProgress < 20) stage = 'Downloading';
              else if (actualProgress < 40) stage = 'Transcribing';
              else if (actualProgress < 60) stage = 'Detecting';
              else if (actualProgress < 80) stage = 'Creating Clips';
              else stage = 'Uploading';
            }

            // Improved stuck detection with relaxed timeouts
            const jobAge = Date.now() - new Date(jobRow.created_at).getTime();
            console.log(`Job ${jobId} status check: jobAge=${jobAge}ms, effectiveStatus=${effectiveStatus}, actualStatus=${actualStatus}, actualProgress=${actualProgress}, stage=${responseData.stage}`);
            
            // Check for specific timeout conditions using effectiveStatus
            let shouldFail = false;
            let failureMessage = '';
            
            if (effectiveStatus === 'queued' && jobAge > 180000) { // 3 minutes
              shouldFail = true;
              failureMessage = '❌ Queued too long. Please try again later or another video.';
              console.warn(`Job ${jobId} queued too long: ${jobAge}ms > 3 minutes`);
            } else if (effectiveStatus === 'processing' && (!actualProgress || actualProgress === 0) && jobAge > 600000) { // 10 minutes
              shouldFail = true;
              failureMessage = '❌ Taking longer than expected to start. Please try another video.';
              console.warn(`Job ${jobId} processing at 0% too long: ${jobAge}ms > 10 minutes`);
            }
            
            if (shouldFail) {
              const { data: failedJob, error: failUpdateError } = await supabase
                .from('jobs')
                .update({
                  status: 'failed',
                  stage: failureMessage,
                  progress: 0,
                })
                .eq('id', jobId)
                .select()
                .single();

              if (failUpdateError) {
                console.error('Failed to update stuck job to failed:', failUpdateError);
                return new Response(JSON.stringify(jobRow), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              return new Response(JSON.stringify(failedJob), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            // Update DB with latest status/progress
            const { data: updatedJob, error: updateError } = await supabase
              .from('jobs')
              .update({
                status: effectiveStatus === 'queued' ? 'queued' : 'processing',
                stage: stage,
                progress: actualProgress
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

            console.log(`Job ${jobId} in progress: ${stage} (${actualProgress}%)`);
            return new Response(JSON.stringify(updatedJob), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
      }

      // Check fallback timeout for jobs without FFmpeg response (also use relaxed timeouts)
      const jobAge = Date.now() - new Date(jobRow.created_at).getTime();
      console.log(`Job ${jobId} fallback timeout check: jobAge=${jobAge}ms, status=${jobRow.status}`);
      
      if (jobAge > 180000 && jobRow.status === 'queued') { // 3 minutes for queued jobs
        // Mark job as failed due to timeout
        const { data: failedJob, error: updateError } = await supabase
          .from('jobs')
          .update({
            status: 'failed',
            stage: '❌ Queued too long. Please try again later or another video.',
            progress: 0
          })
          .eq('id', jobId)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update job to failed:', updateError);
        }

        console.log(`Job ${jobId} queued timeout after ${jobAge}ms`);
        return new Response(JSON.stringify(failedJob || jobRow), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Unexpected remote response: return error with debugging info
      console.error("Unexpected FFmpeg response format:", JSON.stringify(ff, null, 2));
      return new Response(JSON.stringify({ 
        error: "Unexpected FFmpeg /info response", 
        debug: {
          status: ff.status,
          hasBody: !!ff.body,
          hasCode: ff.body?.code !== undefined,
          hasData: !!ff.body?.data,
          actualResponse: ff.body
        },
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