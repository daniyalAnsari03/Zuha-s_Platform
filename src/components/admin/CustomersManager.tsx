"use client";

import { useMemo, useState } from "react";

import { ADMIN_INPUT_CLASS, AdminField } from "@/components/admin/admin-fields";
import { formatOrderDate } from "@/lib/order-types";
import { listAdminCustomers } from "@/lib/admin/queries";
import type { AdminCustomer } from "@/lib/admin/queries";

/**
 * Customers: a read-only list of signed-up accounts.
 *
 * Nothing here can be edited or deleted — the dashboard has no business in
 * someone's account, and Supabase Auth is the only thing that owns one. The
 * search runs in the browser over the list the server returned, matching the
 * name, the email and the phone number, which is all this screen shows.
 */
export default function CustomersManager({ customers, total, totalPages }: {
  customers: AdminCustomer[];
  total: number;
  totalPages: number;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) return customers;

    return customers.filter((customer) =>
      [customer.name ?? "", customer.email, customer.phone ?? ""].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [customers, search]);

  return (
    <div className="flex flex-col gap-4">
      <AdminField
        label="Search"
        htmlFor="customer-search"
        className="w-full max-w-xs"
        hint={
          search.trim()
            ? `${matches.length} of ${customers.length}`
            : `${customers.length} ${
                customers.length === 1 ? "account" : "accounts"
              }`
        }
      >
        <input
          id="customer-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          className={ADMIN_INPUT_CLASS}
        />
      </AdminField>

      {customers.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          No one has signed up yet. Guest checkouts are not listed here — only
          accounts.
        </p>
      ) : matches.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          Nothing matches &quot;{search.trim()}&quot;.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {matches.map((customer) => {
            const c = customers.find((c) => c.id === customer.id);
            return (
              <li
                key={c?.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c?.name ?? c?.email ?? ""}
                  </p>
                  <p className="truncate text-xs text-black/45">
                    {c?.email ?? ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-black/60 sm:justify-end">
                  <span className="min-w-0 truncate">
                    {c?.phone ?? "No phone"}
                  </span>
                  <span className="whitespace-nowrap">
                    Joined {formatOrderDate(c?.signedUpAt ?? "")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-black/60">
            Page {page} of {totalPages} {total > 0 ? `(${total} total)` : ""}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5"
            >
              Prev
            </button>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}