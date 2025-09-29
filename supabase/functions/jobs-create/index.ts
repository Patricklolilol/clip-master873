import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JobsCreateRequest {
  videoUrl: string;
  options?: {
    captions?: string;
    music?: boolean;
    sfx?: boolean;
  };
}

function makeAbsoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function fetchWithRetries(url: string, opts: any, retries = 2) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, opts);
      return res;
    } catch (err) {
      lastErr = err;
      const delay = 200 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    const ffmpegServiceUrl = Deno.env.get('FFMPEG_SERVICE_URL') || 'https://ffmpeg-service-production-79e5.up.railway.app';
    const ffmpegApiKey = Deno.env.get('FFMPEG_API_KEY');

    if (!youtubeApiKey) {
      return new Response(JSON.stringify({
        error: '⚠️ Missing API key'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    const body: JobsCreateRequest = await req.json();
    const { videoUrl, options } = body;

    // Validate YouTube URL
    const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeUrlPattern.test(videoUrl)) {
      return new Response(JSON.stringify({
        error: '❌ Invalid YouTube URL'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract video ID
    let videoId = '';
    try {
      const urlObj = new URL(videoUrl.startsWith('http') ? videoUrl : `https://${videoUrl}`);
      if (urlObj.hostname === 'youtu.be') {
        videoId = urlObj.pathname.substring(1);
      } else if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v') || '';
      }
    } catch {
      return new Response(JSON.stringify({
        error: '❌ Invalid YouTube URL'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch metadata from YouTube API
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,statistics&key=${youtubeApiKey}`;
    const response = await fetch(youtubeApiUrl);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return new Response(JSON.stringify({
        error: '❌ Invalid/Private/Deleted video'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const video = data.items[0];
    const metadata = {
      videoId,
      title: video.snippet.title,
      description: video.snippet.description,
      duration: video.contentDetails.duration,
      thumbnails: video.snippet.thumbnails,
      statistics: video.statistics
    };

    console.log(`Processing video: ${metadata.title}`);
    console.log(`FFmpeg service URL: ${ffmpegServiceUrl}`);

    // Build FFmpeg payload
    const ffmpegPayload = {
      media_url: videoUrl,
      extract_info: true,
      take_screenshots: true,
      screenshot_count: 3,
      convert_format: "mp4",
      // Include user options if provided
      ...(options?.captions && { captions: options.captions }),
      ...(options?.music !== undefined && { music: options.music }),
      ...(options?.sfx !== undefined && { sfx: options.sfx })
    };

    console.log('FFmpeg payload:', JSON.stringify(ffmpegPayload, null, 2));

    // Call FFmpeg service
    try {
      const ffmpegHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (ffmpegApiKey) {
        ffmpegHeaders['X-API-Key'] = ffmpegApiKey;
      }

      console.log('Calling FFmpeg service at:', `${ffmpegServiceUrl}/process`);
      
      const ffmpegResponse = await fetchWithRetries(`${ffmpegServiceUrl}/process`, {
        method: 'POST',
        headers: ffmpegHeaders,
        body: JSON.stringify(ffmpegPayload)
      }, 2);

      console.log('FFmpeg response status:', ffmpegResponse.status);
      const responseText = await ffmpegResponse.text();
      console.log('FFmpeg response body:', responseText);

      // Handle different response scenarios
      if (ffmpegResponse.status === 401 || ffmpegResponse.status === 403) {
        return new Response(JSON.stringify({
          error: ffmpegApiKey ? '❌ Invalid FFmpeg API key' : '⚠️ Missing API key'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!ffmpegResponse.ok) {
        console.error('FFmpeg service error:', responseText);
        
        // Create failed job record
        const { data: failedJob } = await supabase
          .from('jobs')
          .insert({
            user_id: user.id,
            source_url: videoUrl,
            video_id: videoId,
            status: 'failed',
            stage: 'Failed',
            progress: 0,
            metadata,
            options,
            clips: null
          })
          .select()
          .single();

        return new Response(JSON.stringify({
          error: responseText.includes('Invalid URL') ? '❌ Invalid YouTube URL' : 
                 responseText.includes('API key') ? '⚠️ Missing or invalid API key' :
                 '❌ Clip creation failed. Please try another video',
          jobId: failedJob?.id || null,
          status: 'failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let ffmpegData;
      try {
        ffmpegData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse FFmpeg response:', parseError);
        throw new Error('Invalid JSON response from FFmpeg service');
      }

      console.log('Parsed FFmpeg data:', JSON.stringify(ffmpegData, null, 2));

      // Check if response indicates success with synchronous completion
      if (ffmpegData.code === 0 && ffmpegData.data) {
        const data = ffmpegData.data;
        
        // Process clips from FFmpeg response
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

        console.log('Processed clips:', processedClips);

        // Create completed job record
        const { data: completedJob, error: jobError } = await supabase
          .from('jobs')
          .insert({
            user_id: user.id,
            source_url: videoUrl,
            video_id: videoId,
            status: 'completed',
            stage: 'Completed',
            progress: 100,
            metadata,
            options,
            clips: processedClips,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();

        if (jobError) {
          console.error('Failed to create completed job:', jobError);
          throw new Error('Failed to save job results');
        }

        console.log('Job completed successfully:', completedJob.id);

        return new Response(JSON.stringify({
          jobId: null, // null for synchronous completion
          status: 'completed',
          clips: processedClips,
          metadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Handle async response - accept both jobId and job_id
      const ffmpegJobId = ffmpegData.jobId || ffmpegData.job_id;
      const ffmpegStatus = ffmpegData.status;
      
      if (ffmpegResponse.status === 202 || (ffmpegJobId && ffmpegStatus)) {
        console.log('Async job created:', ffmpegJobId);
        
        const { data: asyncJob, error: jobError } = await supabase
          .from('jobs')
          .insert({
            user_id: user.id,
            source_url: videoUrl,
            video_id: videoId,
            ffmpeg_job_id: ffmpegJobId,
            status: ffmpegStatus || 'queued',
            stage: 'Queued',
            progress: 0,
            metadata,
            options,
            clips: null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();

        if (jobError) {
          console.error('Failed to create async job:', jobError);
          throw new Error('Failed to create job record');
        }

        return new Response(JSON.stringify({
          jobId: asyncJob.id,
          status: ffmpegStatus || 'queued',
          metadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Unexpected response format
      else {
        console.error('Unexpected FFmpeg response format:', ffmpegData);
        throw new Error('Unexpected response format from FFmpeg service');
      }

    } catch (ffmpegError) {
      console.error('Error calling FFmpeg service:', ffmpegError);
      
      // Create failed job record
      const { data: failedJob } = await supabase
        .from('jobs')
        .insert({
          user_id: user.id,
          source_url: videoUrl,
          video_id: videoId,
          status: 'failed',
          stage: 'Failed',
          progress: 0,
          metadata,
          options,
          clips: null
        })
        .select()
        .single();

      return new Response(JSON.stringify({
        error: '❌ Clip creation failed. Please try another video',
        jobId: failedJob?.id || null,
        status: 'failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error in jobs-create:', error);
    return new Response(JSON.stringify({
      error: '❌ Clip creation failed. Please try another video'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});