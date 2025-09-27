-- Fix security vulnerability: Restrict learning_weights table access to service role only
-- Remove the overly permissive policy that allows all authenticated users to read AI algorithm secrets
DROP POLICY IF EXISTS "Authenticated users can view learning weights" ON public.learning_weights;

-- Create a new restrictive policy that only allows service role access
-- This prevents competitors from stealing AI algorithm weights and parameters
CREATE POLICY "Service role can access learning weights" 
ON public.learning_weights 
FOR ALL 
USING (auth.role() = 'service_role'::text);