import { supabaseVerifier } from '../services/supabase.js';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Uses a separate supabase client instance so auth.getUser() does not
 * contaminate the primary service-role client's auth state (which would
 * cause RLS to apply on subsequent DB operations).
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseVerifier.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  req.userId = data.user.id;
  next();
}
