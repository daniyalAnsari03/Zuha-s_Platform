"use client";

import { useState, useTransition } from "react";
/* Admin list thumbnails are plain <img>, not next/image — see ImageUpload.tsx. */
/* eslint-disable @next/next/no-img-element */

import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import AdminDialog, { AdminDialogCancel } from "@/components/admin/AdminDialog";
import {
  ADMIN_INPUT_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  AdminFeedback,
  AdminField,
  AdminUploadBusyNotice,
  useUploadBusy,
} from "@/components/admin/admin-fields";
import { ImageUpload } from "@/components/admin/ImageUpload";
import {
  deleteCategory,
  deleteSubCategory,
  saveCategory,
  saveSubCategory,
} from "@/lib/admin/categories";
import type { AdminCategory, AdminSubCategory } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

/**
 * Categories, and the sub-categories inside them.
 *
 * One list, one dialog per form: adding or editing a category opens the category
 * form, and every category row can open its own sub-category form. Deleting asks
 * first, and a category that still has sub-categories or products explains why
 * instead of disappearing.
 *
 * Each dialog is mounted only while it is open and keyed by what it is editing, so
 * its fields always start from that item without any "reset the form" bookkeeping.
 *
 * Client-side because every change is a server action: the page re-renders
 * straight from the action's response, so the list is always what the server
 * holds. The server still decides what is allowed — see `lib/admin/categories.ts`.
 */

type CategoryDraft = {
  id: string | null;
  name: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
};

type SubCategoryDraft = {
  id: string | null;
  categoryId: string;
  categoryName: string;
  name: string;
  imageUrl: string | null;
};

const EMPTY_CATEGORY: CategoryDraft = {
  id: null,
  name: "",
  imageUrl: null,
  mobileImageUrl: null,
};

export default function CategoriesManager({
  categories,
}: {
  categories: AdminCategory[];
}) {
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [subDraft, setSubDraft] = useState<SubCategoryDraft | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-black/60">
          {categories.length === 0
            ? "No categories yet."
            : `${categories.length} ${categories.length === 1 ? "category" : "categories"}`}
        </p>

        <button
          type="button"
          onClick={() => setCategoryDraft({ ...EMPTY_CATEGORY })}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          Add category
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          Add a category to give the storefront its first slide.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {categories.map((category) => (
            <li key={category.id} className="border border-black/10 p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-4">
                <Thumbnails category={category} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-base font-semibold">{category.name}</h2>
                    <p className="text-xs text-black/45">/{category.slug}</p>
                  </div>

                  <p className="mt-1 text-xs text-black/50">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "product" : "products"}
                    {category.subCategories.length > 0
                      ? ` · ${category.subCategories.length} sub-${
                          category.subCategories.length === 1
                            ? "category"
                            : "categories"
                        }`
                      : ""}
                    {category.isActive ? "" : " · hidden"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryDraft({
                          id: category.id,
                          name: category.name,
                          imageUrl: category.imageUrl,
                          mobileImageUrl: category.mobileImageUrl,
                        })
                      }
                      className={ADMIN_SECONDARY_BUTTON_CLASS}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSubDraft({
                          id: null,
                          categoryId: category.id,
                          categoryName: category.name,
                          name: "",
                          imageUrl: null,
                        })
                      }
                      className={ADMIN_SECONDARY_BUTTON_CLASS}
                    >
                      Add sub-category
                    </button>

                    <AdminDeleteButton
                      label="Delete"
                      itemName={category.name}
                      warning={`This also deletes ${category.name}'s image files. A category that still has sub-categories or products cannot be deleted.`}
                      onConfirm={() => deleteCategory({ id: category.id })}
                    />
                  </div>
                </div>
              </div>

              <SubCategoryList
                category={category}
                onEdit={(subCategory) =>
                  setSubDraft({
                    id: subCategory.id,
                    categoryId: category.id,
                    categoryName: category.name,
                    name: subCategory.name,
                    imageUrl: subCategory.imageUrl,
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      {categoryDraft ? (
        <CategoryForm
          key={categoryDraft.id ?? "new"}
          draft={categoryDraft}
          onClose={() => setCategoryDraft(null)}
        />
      ) : null}

      {subDraft ? (
        <SubCategoryForm
          key={subDraft.id ?? `new-${subDraft.categoryId}`}
          draft={subDraft}
          onClose={() => setSubDraft(null)}
        />
      ) : null}
    </div>
  );
}

/** The desktop thumbnail, with the mobile one beside it when it is set. */
function Thumbnails({ category }: { category: AdminCategory }) {
  return (
    <div className="flex shrink-0 gap-2">
      <Thumbnail
        url={category.imageUrl}
        label={`${category.name} desktop image`}
        className="w-16 sm:w-24"
      />

      {category.mobileImageUrl ? (
        <Thumbnail
          url={category.mobileImageUrl}
          label={`${category.name} mobile image`}
          className="w-10 sm:w-16"
        />
      ) : null}
    </div>
  );
}

function SubCategoryList({
  category,
  onEdit,
}: {
  category: AdminCategory;
  onEdit: (subCategory: AdminSubCategory) => void;
}) {
  return (
    <div className="mt-4 border-t border-black/10 pt-4">
      {category.subCategories.length === 0 ? (
        <p className="text-xs text-black/45">
          No sub-categories. Products in this category appear straight on its
          listing page.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {category.subCategories.map((subCategory) => (
            <li
              key={subCategory.id}
              className="flex items-center gap-3 border border-black/10 p-2"
            >
              <Thumbnail
                url={subCategory.imageUrl}
                label={`${subCategory.name} image`}
                className="w-10"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{subCategory.name}</p>
                <p className="text-xs text-black/45">
                  {subCategory.productCount}{" "}
                  {subCategory.productCount === 1 ? "product" : "products"}
                </p>
              </div>

              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onEdit(subCategory)}
                  className="min-h-11 px-3 text-xs tracking-[0.16em] text-black/60 uppercase transition-colors hover:text-plum"
                >
                  Edit
                </button>

                <AdminDeleteButton
                  label="Delete"
                  itemName={subCategory.name}
                  warning={`This also deletes ${subCategory.name}'s image file. A sub-category with products cannot be deleted.`}
                  onConfirm={() => deleteSubCategory({ id: subCategory.id })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryForm({
  draft,
  onClose,
}: {
  draft: CategoryDraft;
  onClose: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [imageUrl, setImageUrl] = useState<string | null>(draft.imageUrl);
  const [mobileImageUrl, setMobileImageUrl] = useState<string | null>(
    draft.mobileImageUrl,
  );
  const [status, setStatus] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const { uploadsBusy, reportUploadBusy } = useUploadBusy();

  const editing = draft.id !== null;

  const save = () => {
    setStatus(null);

    startTransition(async () => {
      const result = await saveCategory({
        id: draft.id,
        name,
        imageUrl,
        mobileImageUrl,
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
      title={editing ? "Edit category" : "Add category"}
      description="The name and the desktop image are used on the homepage slide."
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
            {pending ? "Saving..." : "Save category"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <AdminField label="Name" htmlFor="category-name" required>
          <input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className={ADMIN_INPUT_CLASS}
            placeholder="Women's"
          />
        </AdminField>

        <div className="grid gap-5 sm:grid-cols-2">
          <ImageUpload
            label="Desktop Image"
            required
            value={imageUrl}
            onChange={setImageUrl}
            folder="categories"
            hint="Shown on desktop and tablet."
            onBusyChange={reportUploadBusy}
          />

          <ImageUpload
            label="Mobile Image (optional)"
            value={mobileImageUrl}
            onChange={setMobileImageUrl}
            folder="categories"
            hint="Shown on phones. Falls back to the desktop image."
            onBusyChange={reportUploadBusy}
          />
        </div>

        <AdminFeedback status={status} />
      </div>
    </AdminDialog>
  );
}

function SubCategoryForm({
  draft,
  onClose,
}: {
  draft: SubCategoryDraft;
  onClose: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [imageUrl, setImageUrl] = useState<string | null>(draft.imageUrl);
  const [status, setStatus] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const { uploadsBusy, reportUploadBusy } = useUploadBusy();

  const save = () => {
    setStatus(null);

    startTransition(async () => {
      const result = await saveSubCategory({
        id: draft.id,
        categoryId: draft.categoryId,
        name,
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
      title={
        draft.id ? "Edit sub-category" : `Add a sub-category to ${draft.categoryName}`
      }
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
            {pending ? "Saving..." : "Save sub-category"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <AdminField
          label="Name"
          htmlFor="sub-category-name"
          required
          hint="This name is the circle on the category's sub-category page."
        >
          <input
            id="sub-category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className={ADMIN_INPUT_CLASS}
            placeholder="Casual"
          />
        </AdminField>

        <ImageUpload
          label="Image"
          required
          value={imageUrl}
          onChange={setImageUrl}
          folder="categories"
          onBusyChange={reportUploadBusy}
        />

        <AdminFeedback status={status} />
      </div>
    </AdminDialog>
  );
}

/** A square preview that never breaks the layout when there is no image yet. */
function Thumbnail({
  url,
  label,
  className,
}: {
  url: string | null;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full shrink-0 overflow-hidden border border-black/10 bg-black/5",
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={label}
          width={160}
          height={160}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-[10px] tracking-[0.1em] text-black/30 uppercase">
          None
        </span>
      )}
    </div>
  );
}

type Feedback = { tone: "success" | "error"; message: string } | null;