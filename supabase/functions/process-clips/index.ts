import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessClipRequest {
  clip_id: string;
  edits?: {
    captions_style?: 'modern' | 'bold' | 'neon' | 'classic';
    music_enabled?: boolean;
    sfx_enabled?: boolean;
    custom_captions?: string;
    music_track?: string;
    sfx_effects?: string[];
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ProcessClipRequest = await req.json();
    const { clip_id, edits } = body;

    if (!clip_id) {
      throw new Error('Clip ID is required');
    }

    // Get clip details
    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select(`
        *,
        jobs!inner(*)
      `)
      .eq('id', clip_id)
      .single();

    if (clipError || !clip) {
      throw new Error('Clip not found');
    }

    console.log(`Processing clip ${clip_id}: ${clip.title}`);

    // Update clip status to processing
    await supabase
      .from('clips')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', clip_id);

    // In a real system, this would call an external video processing service
    // For now, we'll simulate the processing and create placeholder URLs
    const processedClip = await processClipWithExternalService(clip, edits);

    // Update clip with processed URLs and metadata
    const { error: updateError } = await supabase
      .from('clips')
      .update({
        status: 'ready',
        video_url: processedClip.video_url,
        thumbnail_urls: processedClip.thumbnail_urls,
        subtitle_urls: processedClip.subtitle_urls,
        file_size_bytes: processedClip.file_size_bytes,
        checksum: processedClip.checksum,
        processing_logs: {
          ...clip.processing_logs,
          processed_at: new Date().toISOString(),
          edits_applied: edits,
          processing_time_ms: processedClip.processing_time_ms
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', clip_id);

    if (updateError) {
      throw new Error('Failed to update clip status');
    }

    console.log(`Clip ${clip_id} processed successfully`);

    return new Response(JSON.stringify({
      success: true,
      clip_id,
      video_url: processedClip.video_url,
      thumbnail_urls: processedClip.thumbnail_urls,
      processing_time_ms: processedClip.processing_time_ms,
      message: 'Clip processed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-clips:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(JSON.stringify({
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processClipWithExternalService(clip: any, edits: any) {
  const processingStartTime = Date.now();
  const ffmpegServiceUrl = Deno.env.get('FFMPEG_SERVICE_URL') || 'http://localhost:8081';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    console.log(`Re-processing clip ${clip.id} with new edits: ${JSON.stringify(edits)}`);
    
    // Get the original video file from storage or re-download if needed
    let sourceVideoPath = `original_${clip.job_id}.mp4`;
    
    // Check if we have the original video cached, otherwise re-download
    const checkVideoResponse = await fetch(`${ffmpegServiceUrl}/check-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: sourceVideoPath })
    });

    if (!checkVideoResponse.ok) {
      // Re-download the original video
      const job = clip.jobs;
      const downloadResponse = await fetch(`${ffmpegServiceUrl}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `https://youtube.com/watch?v=${job.video_id}`,
          format: 'mp4[height<=720]',
          output_template: sourceVideoPath
        })
      });

      if (!downloadResponse.ok) {
        throw new Error(`Video re-download failed: ${downloadResponse.statusText}`);
      }
    }

    // Process clip with new edits
    const processResponse = await fetch(`${ffmpegServiceUrl}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_file: sourceVideoPath,
        start_time: clip.start_time,
        duration: clip.duration_seconds,
        output_file: `edited_clip_${clip.id}_${Date.now()}.mp4`,
        operations: [
          {
            type: 'subtitle',
            style: edits?.captions_style || 'modern',
            text: edits?.custom_captions || clip.title,
            font_size: getStyleFontSize(edits?.captions_style),
            font_color: getStyleColor(edits?.captions_style),
            background_color: getStyleBackground(edits?.captions_style),
            position: 'bottom_center',
            animation: edits?.captions_style === 'neon' ? 'glow' : 'fade_in'
          },
          ...(edits?.music_enabled ? [{
            type: 'audio_overlay',
            audio_file: getMusicFile(edits?.music_track || 'upbeat'),
            volume: 0.3,
            fade_in: 1.0,
            fade_out: 1.0
          }] : []),
          ...(edits?.sfx_enabled && edits?.sfx_effects?.length > 0 ? 
            edits.sfx_effects.map((effect: string, index: number) => ({
              type: 'sound_effect',
              effect_file: getSFXFile(effect),
              timing: (clip.duration_seconds / edits.sfx_effects.length) * (index + 1),
              volume: 0.5
            })) : [])
        ]
      })
    });

    if (!processResponse.ok) {
      throw new Error(`Clip re-processing failed: ${processResponse.statusText}`);
    }

    const processResult = await processResponse.json();
    console.log(`Re-processed clip: ${processResult.output_file}`);

    // Generate new thumbnails for the edited clip
    const thumbnailResponse = await fetch(`${ffmpegServiceUrl}/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_file: processResult.output_file,
        timestamps: ['00:00:01', '25%', '50%'],
        output_pattern: `edited_thumb_${clip.id}_%d.jpg`,
        size: '640x360'
      })
    });

    const thumbnailResult = await thumbnailResponse.json();

    // Upload edited files to Supabase Storage (overwrite existing)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Upload edited video
    const videoBuffer = await fetch(`${ffmpegServiceUrl}/download-file/${processResult.output_file}`).then(r => r.arrayBuffer());
    const { data: videoUpload, error: videoError } = await supabase.storage
      .from('processed-clips')
      .upload(`${clip.job_id}/${clip.id}.mp4`, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true // Overwrite existing file
      });

    if (videoError) throw videoError;

    // Upload new thumbnails
    const thumbnailUrls = [];
    for (let i = 0; i < (thumbnailResult.thumbnails?.length || 0); i++) {
      const thumbBuffer = await fetch(`${ffmpegServiceUrl}/download-file/${thumbnailResult.thumbnails[i]}`).then(r => r.arrayBuffer());
      const { data: thumbUpload } = await supabase.storage
        .from('thumbnails')
        .upload(`${clip.job_id}/${clip.id}_thumb_${i + 1}.jpg`, thumbBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      if (thumbUpload) {
        thumbnailUrls.push(`${supabaseUrl}/storage/v1/object/public/thumbnails/${thumbUpload.path}`);
      }
    }

    // Generate updated subtitle files
    const subtitleContent = edits?.custom_captions || clip.title;
    const subtitles = generateSubtitleFiles(subtitleContent, 0, clip.duration_seconds);
    const subtitleUrls = [];
    
    for (const [format, content] of Object.entries(subtitles)) {
      const { data: subUpload } = await supabase.storage
        .from('subtitles')
        .upload(`${clip.job_id}/${clip.id}.${format}`, content, {
          contentType: format === 'vtt' ? 'text/vtt' : 'text/plain',
          upsert: true
        });
      
      if (subUpload) {
        subtitleUrls.push(`${supabaseUrl}/storage/v1/object/public/subtitles/${subUpload.path}`);
      }
    }

    // Cleanup temporary files
    await fetch(`${ffmpegServiceUrl}/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [processResult.output_file, ...(thumbnailResult.thumbnails || [])]
      })
    }).catch(() => {/* Ignore cleanup errors */});

    return {
      video_url: `${supabaseUrl}/storage/v1/object/public/processed-clips/${videoUpload.path}`,
      thumbnail_urls: thumbnailUrls,
      subtitle_urls: subtitleUrls,
      file_size_bytes: videoBuffer.byteLength,
      checksum: `sha256:${await generateChecksum(new Uint8Array(videoBuffer))}`,
      processing_time_ms: Date.now() - processingStartTime
    };

  } catch (error) {
    console.error('FFmpeg re-processing error:', error);
    throw new Error(`Clip editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getStyleFontSize(style: string): number {
  switch (style) {
    case 'bold': return 28;
    case 'neon': return 26;
    case 'classic': return 22;
    default: return 24;
  }
}

function getStyleColor(style: string): string {
  switch (style) {
    case 'bold': return '#FFFFFF';
    case 'neon': return '#00FFFF';
    case 'classic': return '#000000';
    default: return '#FFFFFF';
  }
}

function getStyleBackground(style: string): string {
  switch (style) {
    case 'bold': return '#000000CC';
    case 'neon': return '#FF00FFAA';
    case 'classic': return '#FFFFFF99';
    default: return '#000000AA';
  }
}

function getMusicFile(track: string): string {
  const musicFiles = {
    'upbeat': 'assets/music/upbeat_energy.mp3',
    'chill': 'assets/music/chill_vibe.mp3',
    'dramatic': 'assets/music/dramatic_tension.mp3',
    'funny': 'assets/music/comedy_bounce.mp3'
  };
  return musicFiles[track as keyof typeof musicFiles] || musicFiles.upbeat;
}

function getSFXFile(effect: string): string {
  const sfxFiles = {
    'whoosh': 'assets/sfx/whoosh.wav',
    'pop': 'assets/sfx/pop.wav',
    'ding': 'assets/sfx/ding.wav',
    'boom': 'assets/sfx/boom.wav',
    'zap': 'assets/sfx/zap.wav',
    'swoosh': 'assets/sfx/swoosh.wav',
    'transition': 'assets/sfx/transition.wav'
  };
  return sfxFiles[effect.toLowerCase() as keyof typeof sfxFiles] || sfxFiles.whoosh;
}

function generateSubtitleFiles(text: string, startTime: number, duration: number): { vtt: string; srt: string } {
  const endTime = startTime + duration;
  const startTimeStr = formatTimestamp(startTime);
  const endTimeStr = formatTimestamp(endTime);
  
  const vttContent = `WEBVTT\n\n${startTimeStr} --> ${endTimeStr}\n${text}\n\n`;
  const srtContent = `1\n${startTimeStr.replace('.', ',')} --> ${endTimeStr.replace('.', ',')}\n${text}\n\n`;
  
  return { vtt: vttContent, srt: srtContent };
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

async function generateChecksum(data: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(data.byteLength);
  const view = new Uint8Array(buffer);
  view.set(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}