"use client";

/**
 * The footer's newsletter field: a transparent email input with a 0.5px white
 * underline and an arrow submit at the right end of the same line.
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

      <div className="flex items-center border-b-[0.5px] border-white/70">
        <input
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="email address"
          className="min-w-0 flex-1 bg-transparent py-2 text-[11px] tracking-[0.08em] text-white placeholder:lowercase placeholder:text-white/70 focus:outline-none"
        />

        <button
          type="submit"
          aria-label="Sign up to the newsletter"
          className="flex h-9 w-8 shrink-0 items-center justify-center text-white transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
