import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
}

const clientOpts = { auth: { autoRefreshToken: false, persistSession: false } };

// Primary DB client — service role, bypasses RLS. Never call auth.getUser() on this.
const supabase = createClient(supabaseUrl, supabaseServiceKey, clientOpts);

// Separate instance used ONLY for token verification in middleware.
// Keeping it separate prevents auth.getUser(userJwt) from contaminating
// the primary client's auth state and breaking RLS bypass.
export const supabaseVerifier = createClient(supabaseUrl, supabaseServiceKey, clientOpts);

export default supabase;
