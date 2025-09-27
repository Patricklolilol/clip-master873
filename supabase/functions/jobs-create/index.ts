import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobsCreateRequest {
  videoUrl: string;
  options: {
    captions: string;
    music: boolean;
    sfx: boolean;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    const ffmpegServiceUrl = Deno.env.get('FFMPEG_SERVICE_URL');

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

    // Create job in Supabase
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        source_url: videoUrl,
        video_id: videoId,
        status: 'queued',
        stage: 'Queued',
        progress: 0,
        metadata,
        options,
        clips: null
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job creation error:', jobError);
      return new Response(JSON.stringify({
        error: '❌ Clip creation failed. Please check FFmpeg service'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send job to FFmpeg service
    if (ffmpegServiceUrl) {
      try {
        const ffmpegResponse = await fetch(`${ffmpegServiceUrl}/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoUrl,
            options,
            metadata,
            callbackJobId: job.id
          })
        });

        if (ffmpegResponse.ok) {
          const ffmpegData = await ffmpegResponse.json();
          
          // Update job with FFmpeg job ID
          await supabase
            .from('jobs')
            .update({ 
              ffmpeg_job_id: ffmpegData.jobId,
              status: ffmpegData.status || 'processing',
              stage: 'Processing'
            })
            .eq('id', job.id);

          console.log('Job sent to FFmpeg service successfully:', ffmpegData.jobId);
        } else {
          console.error('FFmpeg service error:', await ffmpegResponse.text());
        }
      } catch (ffmpegError) {
        console.error('Error sending to FFmpeg service:', ffmpegError);
      }
    }

    return new Response(JSON.stringify({
      jobId: job.id,
      status: job.status,
      metadata
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in jobs-create:', error);
    return new Response(JSON.stringify({
      error: '❌ Clip creation failed. Please check FFmpeg service'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});