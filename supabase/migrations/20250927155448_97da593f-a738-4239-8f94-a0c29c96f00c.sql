-- Update the stuck job to failed status
UPDATE jobs 
SET 
  status = 'failed',
  error_message = 'Job timeout - reset by system maintenance',
  current_stage = 'Failed - timeout',
  progress_percent = 0,
  updated_at = now()
WHERE id = '83b6af43-3f00-4667-893c-ae8fa8bd9b1c' 
  AND status = 'queued';

-- Also clean up any other jobs older than 10 minutes that are stuck
UPDATE jobs 
SET 
  status = 'failed',
  error_message = 'Job timeout - automatic cleanup',
  current_stage = 'Failed - timeout',  
  progress_percent = 0,
  updated_at = now()
WHERE status = 'queued' 
  AND created_at < now() - interval '10 minutes';