"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useOptimistic, useTransition } from "react";

import SignOutButton from "@/components/auth/SignOutButton";
import MenuMorphIcon from "@/components/ui/MenuMorphIcon";
import { CloseIcon } from "@/components/icons";
import { ADMIN_NAV_ITEMS, isActiveAdminPath } from "@/lib/admin/nav";
import {
  backdropVariant,
  drawerLeftVariant,
  fadeUpVariant,
  staggerContainer,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The admin shell: a fixed sidebar on desktop, a drawer behind a menu button on
 * tablet and mobile.
 *
 * The server (`src/app/admin/layout.tsx`) has already confirmed this request is a
 * signed-in admin before it gets here, so the shell only handles navigation and
 * presentation — it never decides who may see it.
 *
 * It is a Client Component because of the drawer (open state, Escape, scroll lock)
 * and the active-item highlight, which needs the current path. The guard, the
 * email and the nav list all arrive as props or from a plain module, so nothing
 * about authorisation ships to the browser.
 *
 * No navbar, no footer, no announcement bar: the dashboard is a separate shell,
 * not the storefront with a different header.
 */
export default function AdminShell({
  email,
  unreadMessages = 0,
  children,
}: {
  email: string;
  /** Unread contact messages, for the badge beside "Messages". */
  unreadMessages?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // The drawer remembers the path it was opened on, so navigating anywhere —
  // a sidebar link or the browser's back button — closes it on its own, without
  // an effect that would re-render the shell after every navigation.
  const [drawerOpenedAt, setDrawerOpenedAt] = useState<string | null>(null);
  const drawerOpen = drawerOpenedAt === pathname;

  // Escape closes the drawer, and the page behind it cannot be scrolled away
  // while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpenedAt(null);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh bg-white text-black">
      {/* Desktop sidebar. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-black/10 bg-white lg:flex">
        <Sidebar
          email={email}
          pathname={pathname}
          unreadMessages={unreadMessages}
        />
      </aside>

      {/* Tablet and mobile bar. */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpenedAt(pathname)}
          aria-expanded={drawerOpen}
          aria-label="Open admin menu"
          className="-ml-2 flex size-11 items-center justify-center text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          <MenuMorphIcon open={drawerOpen} />
        </button>

        <Link
          href="/admin"
          className="font-serif text-sm tracking-[0.3em] text-plum"
        >
          ZUHA&apos;S
        </Link>
      </header>

      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close admin menu"
              onClick={() => setDrawerOpenedAt(null)}
              variants={backdropVariant}
              initial="hidden"
              animate="show"
              exit="exit"
              className="fixed inset-0 z-40 cursor-default bg-black/40 lg:hidden"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Admin menu"
              variants={drawerLeftVariant}
              initial="hidden"
              animate="show"
              exit="exit"
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-white shadow-lg lg:hidden"
            >
              <button
                type="button"
                onClick={() => setDrawerOpenedAt(null)}
                aria-label="Close admin menu"
                className="absolute top-3 right-2 flex size-11 items-center justify-center text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
              >
                <CloseIcon />
              </button>

              <Sidebar
                email={email}
                pathname={pathname}
                unreadMessages={unreadMessages}
                animate
              />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:pl-72 lg:pr-10">
        {children}
      </main>
    </div>
  );
}

/**
 * The sidebar itself, shared verbatim by the desktop rail and the drawer so the
 * two cannot drift. `pt-14` on the drawer leaves room for the close button, and
 * `onNavigate` closes it as soon as a section is chosen.
 */
function Sidebar({
  email,
  pathname,
  unreadMessages = 0,
  animate = false,
}: {
  email: string;
  pathname: string;
  /** Unread contact messages, shown as a badge beside "Messages". */
  unreadMessages?: number;
  /** Stagger the nav items in; only the mobile/tablet drawer sets this. */
  animate?: boolean;
}) {
  const router = useRouter();

  // Optimistic path: clicking a section lights it up immediately, while the
  // transition (and the navigation it carries) is still in flight. It reverts
  // to the real `pathname` on its own once the transition completes.
  const [optimisticPath, setOptimisticPath] = useOptimistic(pathname);
  const [, startTransition] = useTransition();

  return (
    <div className="flex h-full flex-col pt-14 lg:pt-0">
      <div className="hidden border-b border-black/10 px-6 py-6 lg:block">
        <Link
          href="/admin"
          className="font-serif text-base tracking-[0.3em] text-plum transition-colors hover:text-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          ZUHA&apos;S
        </Link>
        <p className="mt-1 text-[0.6875rem] tracking-[0.2em] text-black/40 uppercase">
          Admin
        </p>
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
        <motion.ul
          className="flex flex-col gap-0.5"
          variants={animate ? staggerContainer(0.03, 0.06) : undefined}
          initial={animate ? "hidden" : false}
          animate={animate ? "show" : undefined}
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActiveAdminPath(optimisticPath, item.href);

            return (
              <motion.li key={item.href} variants={animate ? fadeUpVariant : undefined}>
                <Link
                  href={item.href}
                  prefetch={true}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => {
                    // Let modifier clicks and non-left clicks behave like a
                    // normal link (new tab, etc.); only plain left clicks get
                    // the optimistic pre-highlight plus `router.push`.
                    if (
                      event.defaultPrevented ||
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    startTransition(() => {
                      setOptimisticPath(item.href);
                      router.push(item.href);
                    });
                  }}
                  className={cn(
                    "flex min-h-11 items-center border-l-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-plum",
                    active
                      ? "border-plum bg-plum/5 font-medium text-plum"
                      : "border-transparent text-black/70 hover:border-black/20 hover:text-black"
                  )}
                >
                  {item.label}

                  {item.href === "/admin/messages" && unreadMessages > 0 ? (
                    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-plum px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-white">
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                      <span className="sr-only"> unread messages</span>
                    </span>
                  ) : null}
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      </nav>

      <div className="border-t border-black/10 px-6 py-5">
        <p className="truncate text-xs text-black/50" title={email}>
          {email}
        </p>
        <SignOutButton
          className="mt-3 [&>button]:w-full"
          redirectTo="/login"
          pendingLabel="Logging out..."
        />
      </div>
    </div>
  );
}