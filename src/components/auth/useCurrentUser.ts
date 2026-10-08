"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type CurrentUser = {
  /** Null while signed out. */
  user: User | null;
  /** True until the first answer arrives, so callers can avoid a wrong link. */
  loading: boolean;
};

/**
 * Who is signed in, in the browser.
 *
 * The Supabase client is created inside the effect rather than during render:
 * `createClient` reaches for `document.cookie`, which does not exist while this
 * tree is being rendered on the server.
 *
 * The first `getUser()` validates the stored session, and `onAuthStateChange`
 * keeps the answer current afterwards, so signing in or out anywhere on the site
 * moves the navbar icon and the hamburger's Account link without a reload.
 */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const settle = (next: User | null) => {
      if (!active) return;
      setUser(next);
      setLoading(false);
    };

    void supabase.auth.getUser().then(({ data }) => {
      settle(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      settle(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}