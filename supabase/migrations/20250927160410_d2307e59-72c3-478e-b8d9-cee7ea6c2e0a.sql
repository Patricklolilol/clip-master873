-- Timeout stuck queued jobs (older than 5 minutes per user specifications)
UPDATE jobs 
SET 
  status = 'failed',
  error_message = 'Video processing timed out. Please try a different video.',
  current_stage = 'Failed - timeout',
  progress_percent = 0,
  updated_at = now()
WHERE status = 'queued' 
  AND created_at < now() - interval '5 minutes';