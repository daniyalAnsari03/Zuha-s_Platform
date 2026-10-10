"use client";

import { ChevronRightIcon } from "@/components/icons";

/**
 * The footer's newsletter field: one bordered email input with an arrow
 * submit button on the right.
 *
 * Deliberately UI only — there is no endpoint, no Supabase table, no API call
 * and no validation logic anywhere in this component. Submitting only stops
 * the browser from navigating, so nothing happens.
 *
 * `idSuffix` makes the input/label id unique: the footer renders this both in
 * its desktop columns and in its mobile stack (one hidden by CSS), so without
 * it the two copies would share one id.
 */
export default function FooterNewsletterForm({
  idSuffix = "default",
}: {
  idSuffix?: string;
}) {
  const inputId = `footer-newsletter-email-${idSuffix}`;

  return (
    <form
      aria-label="Newsletter sign-up"
      noValidate
      onSubmit={(event) => event.preventDefault()}
      className="w-full"
    >
      <label htmlFor={inputId} className="sr-only">
        Email address
      </label>

      <div className="flex items-stretch border border-black/25 bg-white transition-colors focus-within:border-plum">
        <input
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="EMAIL ADDRESS"
          className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm tracking-[0.08em] text-black placeholder:lowercase placeholder:text-black/40 focus:outline-none lg:text-[15px]"
        />

        <button
          type="submit"
          aria-label="Sign up to the newsletter"
          className="flex w-12 shrink-0 items-center justify-center border-l border-black/25 text-black transition-colors hover:bg-plum hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-plum"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
