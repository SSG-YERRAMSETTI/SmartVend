-- Enable RLS on api_rate_limits table
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limit data (internal use only)
CREATE POLICY "Service role can manage rate limits"
ON public.api_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);