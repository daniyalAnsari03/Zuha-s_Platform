"use client";

import Link from "next/link";

import { UserIcon } from "@/components/icons";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { cn } from "@/lib/utils";

type AuthNavLinkProps = {
  /**
   * The icon-button styling, handed down by the navbar: white glyphs over the
   * homepage slides, black on every white page.
   */
  className?: string;
};

/**
 * The navbar's person icon: `/login` while signed out, `/account` once there is
 * a session.
 *
 * A link rather than a click handler, so it is a real destination — middle-click
 * and open-in-new-tab work like any other navbar link. Until the session has been
 * checked it points at `/login`, which is the safe default: the account page
 * redirects anyone without a session straight back there anyway.
 */
export default function AuthNavLink({ className }: AuthNavLinkProps) {
  const { user } = useCurrentUser();
  const signedIn = Boolean(user);

  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      aria-label={signedIn ? "My account" : "Login"}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      <UserIcon />
    </Link>
  );
}