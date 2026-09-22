import { createBrowserClient } from '@supabase/ssr';

// Single browser client shared by every API module (cookie-backed session via
// @supabase/ssr so server route handlers can also read it). Placeholder values
// keep `next build` prerendering from throwing when env vars are absent; real
// requests only happen in the browser where the env vars are set.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
