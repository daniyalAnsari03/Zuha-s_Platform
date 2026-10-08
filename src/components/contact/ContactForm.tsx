"use client";

import { useState, useTransition } from "react";

import { sendContactMessage } from "@/lib/contact";
import {
  CONTACT_FIELD_LABELS,
  CONTACT_SUCCESS_MESSAGE,
  CONTACT_MAX_LENGTHS,
  firstInvalidContactField,
  validateContactField,
  validateContactForm,
  type ContactField,
  type ContactFormErrors,
  type ContactValues,
} from "@/lib/contact-types";
import { cn } from "@/lib/utils";

/**
 * The /contact message form.
 *
 * Same look as the rest of the store: white background, black text, square-ish
 * inputs with a plum focus ring and a solid plum action button — the same shape
 * as "Add to Cart" and the sign-in form, so nothing here feels like a different
 * site. Name and Phone sit side by side from tablet up and stack on a phone.
 *
 * Two layers of checking: every field validates as the visitor types (the error
 * clears the moment the value becomes acceptable) and again on submit, then the
 * `sendContactMessage` server action runs exactly the same rules over what it
 * was sent. A honeypot field that no visitor can see is the spam filter; on
 * success the form resets and the thank-you message stays put.
 */

const FIELD_CLASSES =
  "w-full min-h-11 border border-black/20 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-black/30 focus:border-plum focus:outline-none";

const LABEL_CLASSES = "text-xs tracking-[0.16em] text-black/60 uppercase";

/** Restored wholesale on success — a module constant, never a lazy initialiser. */
const EMPTY_VALUES: ContactValues = {
  name: "",
  phone: "",
  email: "",
  message: "",
};

export default function ContactForm() {
  const [values, setValues] = useState<ContactValues>({ ...EMPTY_VALUES });
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [pending, startTransition] = useTransition();

  const change = (field: ContactField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));

    // Re-check just this field, so a message disappears as soon as the value
    // it was about is fixed rather than waiting for the next submit.
    setErrors((current) => {
      const existing = current[field];
      if (!existing) return current;

      const next = { ...current };
      const message = validateContactField(field, value);

      if (message) next[field] = message;
      else delete next[field];

      return next;
    });
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setStatus(null);

    const nextErrors = validateContactForm(values);
    setErrors(nextErrors);

    const firstInvalid = firstInvalidContactField(nextErrors);
    if (firstInvalid) {
      document.getElementById(`contact-${firstInvalid}`)?.focus();
      return;
    }

    startTransition(async () => {
      const result = await sendContactMessage({
        ...values,
        website: honeypot,
      });

      if (result.ok) {
        setValues({ ...EMPTY_VALUES });
        setErrors({});
        setHoneypot("");
        setStatus({ tone: "success", message: CONTACT_SUCCESS_MESSAGE });
        return;
      }

      if (result.errors) setErrors(result.errors);
      setStatus({ tone: "error", message: result.message });
    });
  };

  return (
    <form onSubmit={submit} noValidate className="relative mt-8 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <ContactFieldInput
          field="name"
          value={values.name}
          error={errors.name}
          autoComplete="name"
          placeholder="Your name"
          onChange={(value) => change("name", value)}
        />

        <ContactFieldInput
          field="phone"
          value={values.phone}
          error={errors.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Your phone number"
          onChange={(value) => change("phone", value)}
        />
      </div>

      <ContactFieldInput
        field="email"
        required
        value={values.email}
        error={errors.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="your@email.com"
        onChange={(value) => change("email", value)}
      />

      <ContactFieldInput
        field="message"
        required
        multiline
        value={values.message}
        error={errors.message}
        placeholder="Your comment"
        onChange={(value) => change("message", value)}
      />

      {/*
        The honeypot. Off-screen rather than `display: none`, which autofill and
        bots both skip too easily; hidden from keyboards and screen readers, so
        it is never part of the form a person fills in.
      */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {status ? (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={cn(
            "border-l-2 py-1 pl-3 text-sm",
            status.tone === "error"
              ? "border-plum bg-plum/5 text-plum"
              : "border-black/20 bg-black/[0.02] text-black/70",
          )}
        >
          {status.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full bg-plum px-6 py-3 text-xs font-medium tracking-[0.16em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}

/** One labelled field: an input, or a textarea for the comment. */
function ContactFieldInput({
  field,
  value,
  error,
  required = false,
  multiline = false,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  onChange,
}: {
  field: ContactField;
  value: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  type?: string;
  inputMode?: "text" | "tel" | "email";
  autoComplete?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = `contact-${field}`;
  const label = CONTACT_FIELD_LABELS[field];
  const maxLength = CONTACT_MAX_LENGTHS[field];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL_CLASSES}>
        {label}
        {required ? <span className="text-plum"> *</span> : null}
      </label>

      {multiline ? (
        <textarea
          id={id}
          name={field}
          value={value}
          maxLength={maxLength}
          rows={5}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            FIELD_CLASSES,
            "min-h-32 resize-y leading-relaxed",
            error && "border-plum",
          )}
        />
      ) : (
        <input
          id={id}
          name={field}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(FIELD_CLASSES, error && "border-plum")}
        />
      )}

      {error ? (
        <p role="alert" className="text-xs text-plum">
          {error}
        </p>
      ) : null}
    </div>
  );
}
