import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

// Step 8.1: Fail closed if the service-role key is missing.
//
// Previously this file silently fell back to the anon key when
// SUPABASE_SERVICE_ROLE_KEY was unset. That worked invisibly while RLS was
// disabled on every public-schema table, but it would cause supabaseAdmin
// callers (~40 routes) to silently lose their RLS bypass the moment any
// table has RLS enabled. Now we throw at module load instead.
if (!supabaseServiceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. supabaseAdmin requires the service-role key to bypass RLS; refusing to silently downgrade to anon."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
