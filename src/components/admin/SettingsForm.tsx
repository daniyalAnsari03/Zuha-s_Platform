"use client";

import { useState, useTransition } from "react";

import {
  ADMIN_INPUT_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  AdminFeedback,
  AdminField,
  AdminSectionTitle,
} from "@/components/admin/admin-fields";
import { saveStoreDetails, type StoreDetailsInput } from "@/lib/admin/settings";
import type { AdminStoreDetails } from "@/lib/admin/queries";
import { MAX_LINE_LENGTH, MAX_USD_RATE } from "@/lib/admin/validation";

/**
 * Settings: the store's public contact details and social links.
 *
 * One plain form, not a dialog — there is nothing to pick from a list — with
 * every field optional. Saving writes the single `store_details` row and
 * revalidates the homepage and `/contact`, which are the two places the footer
 * and the contact page read these values from.
 *
 * Blank fields are stored blank on purpose: the storefront then falls back to
 * `src/lib/site-config.ts`, so clearing a field returns the site to its default
 * rather than showing an empty gap.
 */
export default function SettingsForm({ initial }: { initial: AdminStoreDetails }) {
  const [values, setValues] = useState<StoreDetailsInput>({ ...initial });
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (field: keyof StoreDetailsInput) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setStatus(null);
    };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    setStatus(null);

    startTransition(async () => {
      const result = await saveStoreDetails(values);

      setStatus(
        result.ok
          ? { tone: "success", message: result.message }
          : { tone: "error", message: result.error },
      );
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-5 border border-black/10 p-4 sm:p-5">
        <AdminSectionTitle>Store</AdminSectionTitle>

        <AdminField
          label="Store name"
          htmlFor="store-name"
          hint="Shown to customers where the site names itself. Leave blank to use the site's default."
        >
          <input
            id="store-name"
            value={values.storeName}
            onChange={set("storeName")}
            maxLength={MAX_LINE_LENGTH}
            className={ADMIN_INPUT_CLASS}
            placeholder="ZUHA'S"
          />
        </AdminField>
      </section>

      <section className="flex flex-col gap-5 border border-black/10 p-4 sm:p-5">
        <AdminSectionTitle>Currency</AdminSectionTitle>

        <AdminField
          label="USD rate (1 USD = ___ PKR)"
          htmlFor="store-usd-rate"
          hint="Used for the USD option on the storefront. Leave empty to hide USD."
        >
          <input
            id="store-usd-rate"
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_USD_RATE}
            step="0.01"
            value={values.usdRate}
            onChange={set("usdRate")}
            className={ADMIN_INPUT_CLASS}
            placeholder="e.g. 280"
          />
        </AdminField>
      </section>

      <section className="flex flex-col gap-5 border border-black/10 p-4 sm:p-5">
        <AdminSectionTitle>Contact</AdminSectionTitle>

        <div className="grid gap-5 sm:grid-cols-2">
          <AdminField
            label="Contact email"
            htmlFor="store-email"
            hint="Shown in the footer and on the contact page."
          >
            <input
              id="store-email"
              type="email"
              value={values.contactEmail}
              onChange={set("contactEmail")}
              maxLength={MAX_LINE_LENGTH}
              className={ADMIN_INPUT_CLASS}
              placeholder="hello@zuhas.com"
            />
          </AdminField>

          <AdminField label="Phone" htmlFor="store-phone">
            <input
              id="store-phone"
              type="tel"
              value={values.phone}
              onChange={set("phone")}
              maxLength={MAX_LINE_LENGTH}
              className={ADMIN_INPUT_CLASS}
              placeholder="+92 300 0000000"
            />
          </AdminField>
        </div>

        <AdminField
          label="Address"
          htmlFor="store-address"
          hint="Leave blank to keep the site's default address."
        >
          <input
            id="store-address"
            value={values.address}
            onChange={set("address")}
            maxLength={MAX_LINE_LENGTH}
            className={ADMIN_INPUT_CLASS}
            placeholder="Studio 4, Lahore, Pakistan"
          />
        </AdminField>
      </section>

      <section className="flex flex-col gap-5 border border-black/10 p-4 sm:p-5">
        <AdminSectionTitle>Social links</AdminSectionTitle>

        <p className="text-xs text-black/45">
          Each link must start with https://. A link left blank is not shown on
          the site.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <AdminField label="Instagram" htmlFor="store-instagram">
            <input
              id="store-instagram"
              type="url"
              inputMode="url"
              value={values.instagram}
              onChange={set("instagram")}
              maxLength={MAX_LINE_LENGTH}
              className={ADMIN_INPUT_CLASS}
              placeholder="https://instagram.com/zuhas"
            />
          </AdminField>

          <AdminField label="Facebook" htmlFor="store-facebook">
            <input
              id="store-facebook"
              type="url"
              inputMode="url"
              value={values.facebook}
              onChange={set("facebook")}
              maxLength={MAX_LINE_LENGTH}
              className={ADMIN_INPUT_CLASS}
              placeholder="https://facebook.com/zuhas"
            />
          </AdminField>

          <AdminField label="TikTok" htmlFor="store-tiktok">
            <input
              id="store-tiktok"
              type="url"
              inputMode="url"
              value={values.tiktok}
              onChange={set("tiktok")}
              maxLength={MAX_LINE_LENGTH}
              className={ADMIN_INPUT_CLASS}
              placeholder="https://tiktok.com/@zuhas"
            />
          </AdminField>

          <AdminField
            label="WhatsApp"
            htmlFor="store-whatsapp"
            hint="A wa.me link, e.g. https://wa.me/923000000000"
          >
            <input
              id="store-whatsapp"
              type="url"
              inputMode="url"
              value={values.whatsapp}
              onChange={set("whatsapp")}
              maxLength={MAX_LINE_LENGTH}
              className={ADMIN_INPUT_CLASS}
              placeholder="https://wa.me/923000000000"
            />
          </AdminField>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          {pending ? "Saving..." : "Save settings"}
        </button>

        <div className="min-w-0 flex-1">
          <AdminFeedback status={status} />
        </div>
      </div>
    </form>
  );
}
