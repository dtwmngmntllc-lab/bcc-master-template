import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. Check your .env file or Vercel environment settings.')
}

// Null guard — supabase will be null if env vars are missing
// All modules must guard against null supabase before calling .from()
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Agency ID — set this to your Supabase agency row ID after running migration 004
// Find it with: SELECT id FROM agency LIMIT 1;
export const AGENCY_ID = import.meta.env.VITE_AGENCY_ID || null
