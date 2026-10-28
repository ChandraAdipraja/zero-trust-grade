import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabase: SupabaseClient = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
