import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { getSupabaseServiceRole } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

export function createAdminClient() {
  const { url, serviceRole } = getSupabaseServiceRole();

  if (!url || !serviceRole) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. Add them to .env.local (server-only).',
    );
  }

  return createClient<Database>(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
