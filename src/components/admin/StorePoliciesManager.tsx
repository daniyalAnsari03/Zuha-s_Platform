"use client";

import { useState, useTransition } from "react";

import {
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminFeedback,
  AdminField,
  AdminSectionTitle,
} from "@/components/admin/admin-fields";
import { saveStorePolicy } from "@/lib/admin/policies";
import type { AdminStorePolicy } from "@/lib/admin/queries";
import { MAX_POLICY_LENGTH } from "@/lib/admin/validation";
import { cn } from "@/lib/utils";

/**
 * Settings: the four public policy pages (Privacy Policy, Refund Policy, Terms
 * of Service, Shipping Policy).
 *
 * Four tabs, one plain textarea and a Save button — no rich editor. Edits are
 * held per slug, so switching tabs never loses an unsaved draft; only Save
 * writes. The server action re-validates the slug and the body and expires the
 * policies cache tag, which is what the storefront pages read.
 */
export default function StorePoliciesManager({
  policies,
}: {
  policies: AdminStorePolicy[];
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(policies.map((policy) => [policy.slug, policy.content])),
  );
  const [selected, setSelected] = useState<string>(policies[0]?.slug ?? "");
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const current = policies.find((policy) => policy.slug === selected);

  const select = (slug: string) => {
    setSelected(slug);
    setStatus(null);
  };

  const edit = (value: string) => {
    setDrafts((current) => ({ ...current, [selected]: value }));
    setStatus(null);
  };

  const save = () => {
    if (!current || pending) return;

    setStatus(null);

    startTransition(async () => {
      const result = await saveStorePolicy(current.slug, drafts[selected] ?? "");

      setStatus(
        result.ok
          ? { tone: "success", message: result.message }
          : { tone: "error", message: result.error },
      );
    });
  };

  return (
    <section className="flex flex-col gap-5 border border-black/10 p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <AdminSectionTitle>Store policies</AdminSectionTitle>

        <p className="text-sm leading-relaxed text-black/60">
          The text shown on each policy page. Plain text only — leave a blank
          line between paragraphs.
        </p>
      </div>

      <div role="tablist" aria-label="Store policies" className="flex flex-wrap gap-2">
        {policies.map((policy) => {
          const isActive = policy.slug === selected;

          return (
            <button
              key={policy.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(policy.slug)}
              className={cn(
                "min-h-11 border px-4 text-xs tracking-[0.16em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
                isActive
                  ? "border-plum bg-plum text-white"
                  : "border-black/15 text-black/70 hover:border-black hover:text-black",
              )}
            >
              {policy.title}
            </button>
          );
        })}
      </div>

      {current ? (
        <>
          <AdminField
            label={`${current.title} content`}
            htmlFor="policy-content"
            hint={`${(drafts[selected] ?? "").length} / ${MAX_POLICY_LENGTH} characters`}
          >
            <textarea
              id="policy-content"
              value={drafts[selected] ?? ""}
              onChange={(event) => edit(event.target.value)}
              maxLength={MAX_POLICY_LENGTH}
              rows={16}
              className={cn(ADMIN_TEXTAREA_CLASS, "min-h-[22rem] resize-y font-sans text-sm")}
              placeholder="Write the policy here. Use a blank line to start a new paragraph."
            />
          </AdminField>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {pending ? "Saving..." : "Save policy"}
            </button>

            <div className="min-w-0 flex-1">
              <AdminFeedback status={status} />
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-black/60">No policy pages are available.</p>
      )}
    </section>
  );
}
