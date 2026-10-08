export default function AdminOrderDetailLoading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="h-4 w-24 bg-black/10 rounded" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-48 bg-black/10 rounded" />
            <div className="flex items-center gap-3">
              <div className="h-5 w-32 bg-black/10 rounded" />
              <div className="h-6 w-24 bg-black/10 rounded" />
            </div>
          </div>

          <div className="h-11 w-40 bg-black/10 rounded" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <div className="h-4 w-32 bg-black/10 rounded" />

          <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
            {[1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-14">
                  <div className="absolute inset-0 bg-black/5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="h-4 w-40 bg-black/10 rounded mb-1" />
                  <div className="h-3 w-28 bg-black/10 rounded" />
                </div>

                <div className="shrink-0 text-right">
                  <div className="h-4 w-20 bg-black/10 rounded ml-auto mb-1" />
                  <div className="h-3 w-24 bg-black/10 rounded ml-auto" />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-4">
            <div className="h-4 w-32 bg-black/10 rounded" />
            <div className="divide-y divide-black/10 border border-black/10">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="grid gap-1 p-3 sm:grid-cols-[7rem_1fr] sm:gap-4 sm:p-4">
                  <div className="h-3 w-16 bg-black/10 rounded" />
                  <div className="h-3 w-40 bg-black/10 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="h-4 w-32 bg-black/10 rounded" />
          <div className="border border-black/10 p-4">
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-baseline justify-between">
                  <div className="h-3 w-20 bg-black/10 rounded" />
                  <div className="h-3 w-16 bg-black/10 rounded" />
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t border-black/10 pt-3">
                <div className="h-3 w-16 bg-black/10 rounded" />
                <div className="h-5 w-20 bg-black/10 rounded" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}