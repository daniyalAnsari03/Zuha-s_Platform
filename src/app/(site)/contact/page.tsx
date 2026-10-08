import type { Metadata } from "next";

import ContactForm from "@/components/contact/ContactForm";
import Breadcrumb from "@/components/layout/Breadcrumb";
import SocialLinks from "@/components/layout/SocialLinks";
import { getStoreDetails } from "@/lib/store-details";
import { mailtoHref, telHref } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact — ZUHA'S",
  description: "How to reach ZUHA'S.",
};

/**
 * The contact page, reachable from the footer's Contact link (the only place
 * that link appears - the hamburger menu has never listed it).
 *
 * The details are read from the same Settings row (with `site-config.ts` as the
 * fallback) the footer uses, and the form on this page writes to
 * `contact_messages` (migration 013) through the `sendContactMessage` server
 * action, where the dashboard's Messages section picks it up. Nothing is emailed
 * and nothing is shown publicly.
 */
export default async function ContactPage() {
  const details = await getStoreDetails();

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-24">
      <h1 className="sr-only">Contact</h1>

      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />

      <div className="mt-6 lg:mt-8">
        <div className="max-w-2xl">
          <h2 className="font-serif text-2xl tracking-[0.1em] sm:text-3xl">
            Contact
          </h2>

          <p className="mt-4 text-sm leading-relaxed text-black/70 sm:text-base">
            Have a question or comment? Use the form below to send us a message
            or contact us by mail at:{" "}
            <a
              href={mailtoHref(details.contact.email)}
              className="underline-offset-4 transition-colors hover:text-plum hover:underline"
            >
              {details.contact.email}
            </a>
          </p>
        </div>

        {/*
          Below lg the wrapper keeps the old max-w-2xl stack (form, then the
          details under it); from lg up the two sit side by side as equal
          columns - the details' lg:mt-8 matches the form's built-in mt-8 so
          both columns start on the same line, and lg:self-start keeps the
          details' bottom divider hugging its own content instead of stretching
          to the taller form.
        */}
        <div className="max-w-2xl lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-16 xl:gap-24">
          <ContactForm />

          <dl className="mt-10 divide-y divide-black/10 border-y border-black/10 lg:mt-8 lg:self-start">
            <ContactRow label="Email">
              <a
                href={mailtoHref(details.contact.email)}
                className="underline-offset-4 transition-colors hover:text-plum hover:underline"
              >
                {details.contact.email}
              </a>
            </ContactRow>

            <ContactRow label="Phone">
              <a
                href={telHref(details.contact.phone)}
                className="underline-offset-4 transition-colors hover:text-plum hover:underline"
              >
                {details.contact.phone}
              </a>
            </ContactRow>

            <ContactRow label="Address">
              <span className="leading-relaxed">{details.contact.address}</span>
            </ContactRow>

            <ContactRow label="Social">
              <SocialLinks links={details.socials} />
            </ContactRow>
          </dl>
        </div>
      </div>
    </section>
  );
}

type ContactRowProps = {
  label: string;
  children: React.ReactNode;
};

/** One label / value line of the contact details. */
function ContactRow({ label, children }: ContactRowProps) {
  return (
    <div className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold tracking-[0.2em] text-black/50 uppercase">
        {label}
      </dt>
      <dd className="text-sm text-black sm:text-base">{children}</dd>
    </div>
  );
}
