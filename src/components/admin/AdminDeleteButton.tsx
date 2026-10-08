"use client";

import { useState, useTransition } from "react";

import AdminDialog, { AdminDialogCancel } from "@/components/admin/AdminDialog";
import {
  ADMIN_DANGER_BUTTON_CLASS,
  ADMIN_QUIET_BUTTON_CLASS,
  AdminFeedback,
} from "@/components/admin/admin-fields";

/**
 * "Delete" with a confirmation, used by every list in the dashboard.
 *
 * The button opens a dialog that states exactly what is about to happen, and only
 * the dialog's own confirm button calls the action — so a stray click never
 * deletes anything. The action's own refusal (a category that still has products,
 * a product a foreign key protects) is shown inside the dialog, which is where the
 * admin is already looking. A successful action re-renders the list from the
 * action's response, so the dialog just closes.
 */
export default function AdminDeleteButton({
  label,
  itemName,
  /** Shown above the confirm button, e.g. what will be lost. */
  warning,
  onConfirm,
}: {
  /** The trigger's text, e.g. "Delete". */
  label: string;
  /** The row's name, quoted in the question. */
  itemName: string;
  warning?: string;
  /** The delete action. Resolves with its own success or failure message. */
  onConfirm: () => Promise<
    { ok: true; message: string } | { ok: false; error: string }
  >;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setStatus(null);
  };

  const confirm = () => {
    setStatus(null);

    startTransition(async () => {
      const result = await onConfirm();

      if (result.ok) {
        // The row is gone, so there is nothing left to confirm against.
        close();
        return;
      }

      setStatus({ tone: "error", message: result.error });
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={ADMIN_QUIET_BUTTON_CLASS}
      >
        {label}
      </button>

      <AdminDialog
        open={open}
        onClose={close}
        title={`Delete ${itemName}?`}
        description="This cannot be undone."
        footer={
          <>
            <AdminDialogCancel onClose={close} />
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className={ADMIN_DANGER_BUTTON_CLASS}
            >
              {pending ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {warning ? (
            <p className="text-sm leading-relaxed text-black/70">{warning}</p>
          ) : null}

          <AdminFeedback status={status} />
        </div>
      </AdminDialog>
    </>
  );
}
