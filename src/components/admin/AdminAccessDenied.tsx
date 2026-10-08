import Link from "next/link";

/**
 * What a signed-in visitor who is not on the admin allowlist sees at `/admin`.
 *
 * Deliberately the whole page: no sidebar, no nav list, no data and no hint about
 * what the dashboard contains. It says the account cannot open the admin area and
 * offers the shop instead, because the alternative — showing the shell to
 * someone who may not use it — is what the guard exists to prevent.
 */
export default function AdminAccessDenied() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4 py-16 text-black">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl tracking-[0.1em] uppercase sm:text-3xl">
          Access denied
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-black/60">
          This account does not have access to the admin area.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center bg-plum px-6 py-2.5 text-xs tracking-[0.16em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          Back to the shop
        </Link>
      </div>
    </main>
  );
}