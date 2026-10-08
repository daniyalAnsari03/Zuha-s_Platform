"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Signs the shopper out and sends them back to the storefront (or, on the admin
 * side, to `/login`).
 *
 * The session lives in a cookie the browser Supabase client owns, so the sign-out
 * has to happen here — a server action could not clear it. The redirect then
 * re-renders the navbar, so the icon flips back to the logged-out state.
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const signOut = () => {
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError("We could not sign you out. Please try again.");
        return;
      }

      router.replace(redirectTo);
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