import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

// Rate limiting function
async function checkRateLimit(supabase: any, apiKeyId: string, endpoint: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  // Get current request count in window
  const { data: rateLimitData, error } = await supabase
    .from('api_rate_limits')
    .select('request_count, window_start')
    .eq('api_key_id', apiKeyId)
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS };
  }

  if (!rateLimitData) {
    // First request in window
    await supabase
      .from('api_rate_limits')
      .insert({
        api_key_id: apiKeyId,
        endpoint,
        request_count: 1,
        window_start: new Date().toISOString(),
      });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  const currentCount = rateLimitData.request_count;
  
  if (currentCount >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  // Increment counter
  await supabase
    .from('api_rate_limits')
    .update({ request_count: currentCount + 1 })
    .eq('api_key_id', apiKeyId)
    .eq('endpoint', endpoint)
    .eq('window_start', rateLimitData.window_start);

  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - currentCount - 1 };
}

interface QueryParams {
  page?: string;
  limit?: string;
  start_date?: string;
  end_date?: string;
  location_id?: string;
  machine_id?: string;
  product_id?: string;
  status?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for API key validation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate API key (stubbed - in production, hash and compare)
    const { data: apiKeyData, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('key_prefix', apiKey.split('_')[0] + '_' + apiKey.split('_')[1])
      .single();

    if (keyError || !apiKeyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    await supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    // Parse URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1];

    // Check rate limit
    const rateLimit = await checkRateLimit(supabaseAdmin, apiKeyData.id, endpoint);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retry_after: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
          } 
        }
      );
    }

    // Parse query parameters
    const params: QueryParams = {};
    url.searchParams.forEach((value, key) => {
      params[key as keyof QueryParams] = value;
    });

    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '50');
    const offset = (page - 1) * limit;

    // Check scopes
    const method = req.method;
    const requiredScope = method === 'GET' ? 'read' : 'write';
    if (!apiKeyData.scopes.includes(requiredScope) && !apiKeyData.scopes.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different endpoints
    let query = supabaseAdmin.from(endpoint).select('*', { count: 'exact' });

    // Apply filters
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }
    if (params.location_id) {
      query = query.eq('location_id', params.location_id);
    }
    if (params.machine_id) {
      query = query.eq('machine_id', params.machine_id);
    }
    if (params.product_id) {
      query = query.eq('product_id', params.product_id);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('API error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = {
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
