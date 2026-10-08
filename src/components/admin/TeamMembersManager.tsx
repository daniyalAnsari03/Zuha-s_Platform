"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
/* Admin list thumbnails are plain <img>, not next/image — see ImageUpload.tsx. */
/* eslint-disable @next/next/no-img-element */

import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import AdminDialog, { AdminDialogCancel } from "@/components/admin/AdminDialog";
import {
  ADMIN_INPUT_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminFeedback,
  AdminField,
  AdminUploadBusyNotice,
  useUploadBusy,
} from "@/components/admin/admin-fields";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { deleteTeamMember, saveTeamMember } from "@/lib/admin/team";
import type { AdminTeamMember } from "@/lib/admin/queries";
import {
  MAX_LINE_LENGTH,
  MAX_TEAM_BIO_LENGTH,
  MAX_TEAM_ROLE_LENGTH,
} from "@/lib/admin/validation";

type TeamDraft = {
  id: string | null;
  name: string;
  role: string;
  bio: string;
  imageUrl: string | null;
};

const EMPTY_DRAFT: TeamDraft = {
  id: null,
  name: "",
  role: "",
  bio: "",
  imageUrl: null,
};

/**
 * Team Members: add, edit and delete for the footer's Team page.
 *
 * Same shape as the Categories screen — a list of rows, one dialog form that is
 * remounted per member so every field starts clean, and a delete that asks
 * first. The portrait goes through the shared `ImageUpload` into the
 * `store-images` bucket under `team/`, and the action removes the old file when
 * an image is replaced or a member is deleted.
 *
 * Saving revalidates `/team`, so the circular carousel on the storefront
 * reflects the change on the next load.
 */
export default function TeamMembersManager({
  members,
  total,
  totalPages,
  currentPage,
}: {
  members: AdminTeamMember[];
  total: number;
  totalPages: number;
  currentPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<TeamDraft | null>(null);

  const [paging, startPageTransition] = useTransition();

  const setPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    startPageTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-black/60">
          {members.length === 0
            ? "No team members yet."
            : `${members.length} ${members.length === 1 ? "member" : "members"}`}
        </p>

        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          Add member
        </button>
      </div>

      {members.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          Add a member to give the Team carousel its first circle.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
            >
              <div className="relative aspect-square w-14 shrink-0 overflow-hidden rounded-full border border-black/10 bg-black/5 sm:w-16">
                {member.imageUrl ? (
                  <img
                    src={member.imageUrl}
                    alt={member.name}
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-black/50">{member.role}</p>
                {member.bio ? (
                  <p className="mt-1 line-clamp-2 text-xs text-black/45">
                    {member.bio}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      id: member.id,
                      name: member.name,
                      role: member.role,
                      bio: member.bio ?? "",
                      imageUrl: member.imageUrl,
                    })
                  }
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  Edit
                </button>

                <AdminDeleteButton
                  label="Delete"
                  itemName={member.name}
                  warning="This also deletes the member's portrait."
                  onConfirm={() => deleteTeamMember({ id: member.id })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-black/60">
            Page {currentPage} of {totalPages} {total > 0 ? `(${total} total)` : ""}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1 || paging}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paging ? "Loading..." : "Prev"}
            </button>

            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages || paging}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paging ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
      )}

      {draft ? (
        <TeamMemberForm
          key={draft.id ?? "new"}
          draft={draft}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </div>
  );
}

function TeamMemberForm({
  draft,
  onClose,
}: {
  draft: TeamDraft;
  onClose: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [role, setRole] = useState(draft.role);
  const [bio, setBio] = useState(draft.bio);
  const [imageUrl, setImageUrl] = useState<string | null>(draft.imageUrl);
  const [status, setStatus] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const { uploadsBusy, reportUploadBusy } = useUploadBusy();

  const editing = draft.id !== null;

  const save = () => {
    setStatus(null);

    startTransition(async () => {
      const result = await saveTeamMember({
        id: draft.id,
        name,
        role,
        bio: bio.trim() ? bio : null,
        imageUrl,
      });

      if (!result.ok) {
        setStatus({ tone: "error", message: result.error });
        return;
      }

      onClose();
    });
  };

  return (
    <AdminDialog
      open
      onClose={onClose}
      title={editing ? "Edit team member" : "Add team member"}
      description="The circle on the Team page: image, name underneath, and the role as its short line."
      footer={
        <>
          <AdminUploadBusyNotice busy={uploadsBusy} />
          <AdminDialogCancel onClose={onClose} />
          <button
            type="button"
            onClick={save}
            disabled={pending || uploadsBusy}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            {pending ? "Saving..." : "Save member"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <AdminField label="Name" htmlFor="team-name" required>
          <input
            id="team-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_LINE_LENGTH}
            className={ADMIN_INPUT_CLASS}
            placeholder="Ayesha Khan"
          />
        </AdminField>

        <AdminField
          label="Description/role"
          htmlFor="team-role"
          required
          hint="The short line under the name on the circle."
        >
          <input
            id="team-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            maxLength={MAX_TEAM_ROLE_LENGTH}
            className={ADMIN_INPUT_CLASS}
            placeholder="Founder & Designer"
          />
        </AdminField>

        <AdminField
          label="Description"
          htmlFor="team-bio"
          hint="Shown in full when the member's circle is opened."
        >
          <textarea
            id="team-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={MAX_TEAM_BIO_LENGTH}
            className={ADMIN_TEXTAREA_CLASS}
            placeholder="A short paragraph about the member."
          />
        </AdminField>

        <ImageUpload
          label="Image"
          required
          value={imageUrl}
          onChange={setImageUrl}
          folder="team"
          hint="A square photo works best — the Team page shows it as a circle."
          onBusyChange={reportUploadBusy}
        />

        <AdminFeedback status={status} />
      </div>
    </AdminDialog>
  );
}

type Feedback = { tone: "success" | "error"; message: string } | null;
