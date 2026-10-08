"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

const FIELD_CLASSES =
  "w-full min-h-11 border border-black/20 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-black/30 focus:border-plum focus:outline-none";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Where the shopper lands after a successful sign-in, signup or Google login. */
const ACCOUNT_HREF = "/account";

/**
 * An optional destination passed as `?next=`, so a page that needs a session can
 * send the shopper here and get them back afterwards: the admin guard redirects
 * to `/login?next=%2Fadmin` (see `src/lib/admin/guard.ts`).
 *
 * Only same-origin relative paths are honoured. Anything that does not start with
 * a single "/" — `//evil.example`, `https://evil.example`, `javascript:…` — is
 * ignored and the shopper lands on `/account` as before, so this parameter can
 * never turn the sign-in page into an open redirect.
 *
 * Read from `window` rather than `useSearchParams` so the page needs no Suspense
 * boundary: it is statically rendered, and the destination is only ever used for
 * a redirect, never rendered, so the server and browser renders agree.
 */
function readReturnPath(): string | null {
  if (typeof window === "undefined") return null;

  const next = new URLSearchParams(window.location.search).get("next");

  // Reject URL-encoded control characters before anything parses the string:
  // a URL parser deletes ASCII tabs/newlines when resolving, so `/%09/evil` is
  // just `//evil` to it. Anything with a control char is never a redirect path.
  if (!next || /[\u0000-\u001f\u007f]/.test(next)) return null;

  // Only a same-origin relative path is honoured - the documented rule. The
  // `//` check catches a protocol-relative redirect even before parsing.
  if (!next.startsWith("/") || next.startsWith("//")) return null;

  // One more gate through the resolver: the result must live on this origin.
  try {
    if (new URL(next, window.location.origin).origin !== window.location.origin) {
      return null;
    }
  } catch {
    return null;
  }

  return next;
}

/**
 * Sign in or create an account — both optional.
 *
 * Nothing on the store needs this page: checkout, the cart, the wishlist and
 * search all work as a guest. Signing in only adds "My Orders", so it is offered
 * quietly rather than pushed.
 *
 * Two ways in, both on Supabase Auth: "Continue with Google" and an email and
 * password form. Google leaves the page and comes back, which is why its redirect
 * target is `/account` — the browser client picks the session out of the URL on
 * arrival and the redirect below moves the shopper on.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: checkingSession } = useCurrentUser();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [startingGoogle, setStartingGoogle] = useState(false);
  const [pending, startTransition] = useTransition();

  // Read once, at mount: the query string cannot change underneath this page.
  const [returnPath] = useState(readReturnPath);
  const destination = returnPath ?? ACCOUNT_HREF;

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (user) router.replace(destination);
  }, [user, router, destination]);

  const busy = pending || startingGoogle || checkingSession;

  const validate = (): string | null => {
    const trimmedEmail = email.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return "Please enter a valid email address.";
    }

    if (!password) {
      return "Please enter your password.";
    }

    if (mode === "signup" && password.length < 6) {
      return "Please choose a password of at least 6 characters.";
    }

    return null;
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const problem = validate();
    if (problem) {
      setError(problem);
      setNotice(null);
      return;
    }

    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        if (mode === "signup") {
          const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

          if (signUpError) throw signUpError;

          // With email confirmation switched on there is no session yet, and the
          // shopper has to click the link in their inbox first.
          if (data.session) {
            router.replace(destination);
            router.refresh();
            return;
          }

          setNotice(
            "Your account is almost ready. Check your inbox for the confirmation link, then come back and sign in.",
          );
          setPassword("");
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;

        router.replace(destination);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : "We could not sign you in. Please try again.",
        );
      }
    });
  };

  /**
   * Google sign-in navigates the whole tab away, so it runs outside a transition
   * and carries its own "starting" flag for the case where it fails to leave.
   */
  const continueWithGoogle = () => {
    if (busy) return;

    setError(null);
    setNotice(null);
    setStartingGoogle(true);

    const failed = () => {
      setError("We could not start Google sign-in. Please try again.");
      setStartingGoogle(false);
    };

    void supabase.auth
      .signInWithOAuth({
        provider: "google",
        options: {
          // Supabase requires this exact URL to be allow-listed as a redirect
          // target for the Google provider (see the setup notes in the summary).
          redirectTo: `${window.location.origin}${ACCOUNT_HREF}`,
        },
      })
      // No error means the browser is already on its way to Google, in which
      // case this component is gone before the promise settles.
      .then(({ error: oauthError }) => {
        if (oauthError) failed();
      })
      .catch(failed);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-24">
      <div className="mx-auto flex w-full max-w-md flex-col items-center py-4 lg:py-10">
        <h1 className="text-2xl tracking-[0.1em] uppercase sm:text-3xl">
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-black/60">
          Signing in is optional — you can check out as a guest. An account only
          adds your order history.
        </p>

        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={busy}
          className="mt-8 flex min-h-12 w-full items-center justify-center gap-3 border border-black/20 px-4 py-3 text-xs tracking-[0.16em] uppercase transition-colors hover:border-black hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:opacity-60"
        >
          {startingGoogle ? "Redirecting to Google..." : "Continue with Google"}
        </button>

        <div className="my-6 flex w-full items-center gap-3">
          <span className="h-px flex-1 bg-black/10" />
          <span className="text-xs tracking-[0.16em] text-black/40 uppercase">
            or
          </span>
          <span className="h-px flex-1 bg-black/10" />
        </div>

        <form onSubmit={submit} noValidate className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs tracking-[0.16em] text-black/60 uppercase"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              className={FIELD_CLASSES}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs tracking-[0.16em] text-black/60 uppercase"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : ""}
              className={FIELD_CLASSES}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-plum">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p role="status" className="text-sm text-black/70">
              {notice}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 min-h-12 w-full bg-plum px-6 py-3 text-xs font-medium tracking-[0.16em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:opacity-60"
          >
            {busy
              ? "Please wait..."
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-black/60">
          {mode === "signin" ? "New to ZUHA'S?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="text-plum underline transition-colors hover:text-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="mt-8 text-center text-xs text-black/40">
          <Link
            href="/"
            className="underline transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            Continue shopping
          </Link>
        </p>
      </div>
    </section>
  );
}