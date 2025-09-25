import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Job {
  id: string;
  user_id: string;
  youtube_url: string;
  video_id: string;
  max_clips: number;
  min_duration: number;
  max_duration: number;
  captions_style: string;
  music_enabled: boolean;
  sfx_enabled: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { job_id } = await req.json();
    if (!job_id) {
      throw new Error('Job ID is required');
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    console.log(`Processing job ${job_id} for video ${job.video_id}`);

    // Update job status to downloading
    await updateJobStatus(supabase, job_id, 'downloading', 10, 'Downloading video from YouTube');

    // Step 1: Download video metadata and basic info
    const videoMetadata = await downloadVideoMetadata(job.video_id, youtubeApiKey);
    
    // Update job with video metadata
    await supabase
      .from('jobs')
      .update({ 
        title: videoMetadata.title,
        download_url: videoMetadata.download_url 
      })
      .eq('id', job_id);

    // Step 2: Transcribe audio
    await updateJobStatus(supabase, job_id, 'transcribing', 25, 'Transcribing audio content');
    
    // For demo purposes, we'll create mock transcript data
    const transcriptData = await createMockTranscript(videoMetadata.duration);
    
    await supabase
      .from('jobs')
      .update({ transcript_data: transcriptData })
      .eq('id', job_id);

    // Step 3: Detect highlights
    await updateJobStatus(supabase, job_id, 'detecting_highlights', 50, 'Analyzing content for viral moments');
    
    const highlights = await detectHighlights(transcriptData, job);

    await supabase
      .from('jobs')
      .update({ segments_data: highlights })
      .eq('id', job_id);

    // Step 4: Create clips
    await updateJobStatus(supabase, job_id, 'creating_clips', 75, 'Generating video clips');
    
    const clips = await createClips(supabase, job, highlights);

    // Step 5: Complete processing
    await updateJobStatus(supabase, job_id, 'completed', 100, 'Processing complete');

    await supabase
      .from('jobs')
      .update({ 
        completed_at: new Date().toISOString()
      })
      .eq('id', job_id);

    console.log(`Job ${job_id} completed successfully. Generated ${clips.length} clips.`);

    return new Response(JSON.stringify({
      success: true,
      job_id,
      clips_generated: clips.length,
      message: 'Video processing completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-video:', error);
    
    // Try to update job status to failed
    try {
      const { job_id } = await req.json();
      if (job_id) {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateJobStatus(supabase, job_id, 'failed', 0, `Processing failed: ${errorMessage}`);
      }
    } catch {}

    const errorMessage = error instanceof Error ? error.message : 'Video processing failed';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function updateJobStatus(supabase: any, jobId: string, status: string, progress: number, stage: string) {
  await supabase
    .from('jobs')
    .update({
      status,
      progress_percent: progress,
      current_stage: stage,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

async function downloadVideoMetadata(videoId: string, apiKey: string) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch video metadata from YouTube API');
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found or not accessible');
    }
    
    const video = data.items[0];
    const duration = parseDuration(video.contentDetails.duration);
    
    return {
      title: video.snippet.title,
      duration,
      download_url: `https://youtube.com/watch?v=${videoId}`, // Placeholder
      channel: video.snippet.channelTitle,
      views: parseInt(video.statistics.viewCount || '0')
    };
  } catch (error) {
    console.error('Error downloading video metadata:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download video: ${message}`);
  }
}

function parseDuration(duration: string): number {
  // Parse ISO 8601 duration (PT4M13S -> 253 seconds)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 300; // Default 5 minutes
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

async function createMockTranscript(duration: number) {
  // Create realistic mock transcript for demo
  const segments = [];
  const wordsPerSecond = 2.5;
  const totalWords = duration * wordsPerSecond;
  
  const samplePhrases = [
    "Welcome back to another exciting episode",
    "Today we're going to explore something amazing",
    "This is absolutely incredible",
    "You won't believe what happens next",
    "Let me show you this fantastic technique",
    "This changes everything we thought we knew",
    "The results are simply mind-blowing",
    "I can't wait to share this discovery with you"
  ];
  
  let currentTime = 0;
  
  for (let i = 0; i < Math.min(50, totalWords / 5); i++) {
    const phrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];
    const segmentDuration = phrase.split(' ').length / wordsPerSecond;
    
    segments.push({
      start: currentTime,
      end: currentTime + segmentDuration,
      text: phrase,
      confidence: 0.85 + Math.random() * 0.15
    });
    
    currentTime += segmentDuration + Math.random() * 2; // Add pause
  }
  
  return { segments, language: 'en', total_duration: duration };
}

async function detectHighlights(transcriptData: any, job: Job) {
  const segments = transcriptData.segments;
  const highlights = [];
  
  // Mock highlight detection algorithm
  for (let i = 0; i < segments.length - 2; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const text = segment.text.toLowerCase();
    
    // Simple keyword-based scoring
    let score = 0.3; // Base score
    
    // Boost for excitement keywords
    const excitementWords = ['amazing', 'incredible', 'unbelievable', 'fantastic', 'mind-blowing'];
    excitementWords.forEach(word => {
      if (text.includes(word)) score += 0.2;
    });
    
    // Boost for question words (engagement)
    if (text.includes('?') || text.includes('what') || text.includes('how')) {
      score += 0.15;
    }
    
    // Random variation to simulate other factors
    score += Math.random() * 0.3 - 0.15;
    
    if (score > 0.6) {
      const duration = Math.min(
        Math.max(job.min_duration, 20 + Math.random() * 25),
        job.max_duration
      );
      
      highlights.push({
        start_time: Math.max(0, segment.start - 2),
        end_time: Math.min(transcriptData.total_duration, segment.start + duration),
        score: Math.min(score, 1.0),
        reason: 'High engagement keywords detected',
        transcript_segment: `${segment.text} ${nextSegment?.text || ''}`.slice(0, 100)
      });
    }
  }
  
  // Sort by score and take top clips
  highlights.sort((a, b) => b.score - a.score);
  return highlights.slice(0, job.max_clips);
}

async function createClips(supabase: any, job: Job, highlights: any[]) {
  const clips = [];
  
  for (const [index, highlight] of highlights.entries()) {
    const duration = highlight.end_time - highlight.start_time;
    
    // Create clip record
    const { data: clip, error } = await supabase
      .from('clips')
      .insert({
        job_id: job.id,
        user_id: job.user_id,
        title: `Viral Clip ${index + 1}`,
        duration_seconds: duration,
        start_time: highlight.start_time,
        end_time: highlight.end_time,
        predicted_engagement: highlight.score,
        status: 'ready',
        segment_scores: highlight,
        // Mock file URLs - in production these would be real processed video files
        video_url: `https://example.com/clips/${job.id}_${index}.mp4`,
        thumbnail_urls: [
          `https://example.com/thumbnails/${job.id}_${index}_1.jpg`,
          `https://example.com/thumbnails/${job.id}_${index}_2.jpg`,
          `https://example.com/thumbnails/${job.id}_${index}_3.jpg`
        ],
        subtitle_urls: [
          `https://example.com/subtitles/${job.id}_${index}.vtt`,
          `https://example.com/subtitles/${job.id}_${index}.srt`
        ],
        file_size_bytes: Math.floor(duration * 1000000 + Math.random() * 2000000), // ~1MB per second
        checksum: `sha256:${Math.random().toString(36).substring(7)}`
      })
      .select()
      .single();
    
    if (!error && clip) {
      clips.push(clip);
    }
  }
  
  return clips;
}