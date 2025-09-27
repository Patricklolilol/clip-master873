-- Mark stuck jobs as failed to clear the processing queue
UPDATE jobs 
SET status = 'failed', 
    error_message = 'Job was stuck and reset by system maintenance',
    updated_at = now()
WHERE status IN ('queued', 'downloading', 'transcribing', 'detecting_highlights', 'creating_clips', 'uploading')
  AND created_at < now() - interval '1 hour';