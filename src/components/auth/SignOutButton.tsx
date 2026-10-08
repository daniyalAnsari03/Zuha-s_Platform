"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Signs the shopper out and sends them back to the storefront (or, on the admin
 * side, to `/login`).
 *
 * The session lives in a cookie the browser Supabase client owns, so the sign-out
 * has to happen here — a server action could not clear it. Landing on the target
 * with `window.location.assign` (a hard navigation) instead of a client-side
 * `router.replace` also guarantees no cached logged-in state survives: the Next.js
 * router cache is discarded and the destination re-renders as a fresh signed-out
 * request, which is how the navbar icon flips back everywhere.
 */
export default function SignOutButton({
  className,
  redirectTo = "/",
  pendingLabel = "Signing out...",
}: {
  className?: string;
  /** Where to land after signing out — the admin goes to `/login`. */
  redirectTo?: string;
  /** The words under the button while the sign-out is in flight. */
  pendingLabel?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = () => {
    setError(null);
    setPending(true);

    const supabase = createClient();

    void supabase.auth.signOut().then(({ error: signOutError }) => {
      if (signOutError) {
        setError("We could not sign you out. Please try again.");
        setPending(false);
        return;
      }

      // `signOut()` above already cleared the browser's session; this hard
      // navigation drops the router-cache copy of the signed-in pages, so the
      // landing route cannot serve cached logged-in content.
      window.location.assign(redirectTo);
    });
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center border border-plum px-6 py-2.5 text-xs tracking-[0.16em] text-plum uppercase transition-colors hover:bg-plum hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:opacity-60"
      >
        {pending ? pendingLabel : "Log out"}
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-plum">
          {error}
        </p>
      ) : null}
    </div>
  );
}