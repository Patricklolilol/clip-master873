-- Fix the search_path security issue for the expire_old_clips function
CREATE OR REPLACE FUNCTION public.expire_old_clips()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.clips 
  SET status = 'expired'
  WHERE expires_at < now() 
  AND status != 'expired';
END;
$$;