export default function AdminDashboardLoading() {
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="h-8 w-48 bg-black/10 rounded" />
        <div className="h-5 w-80 bg-black/10 rounded" />
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-4 w-32 bg-black/10 rounded" />
          <div className="h-4 w-32 bg-black/10 rounded" />
        </div>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i} className="min-w-0 border border-black/10 p-4">
              <div className="h-3 w-20 bg-black/10 rounded mb-2" />
              <div className="h-10 w-16 bg-black/10 rounded" />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-4 w-32 bg-black/10 rounded" />
          <div className="h-4 w-32 bg-black/10 rounded" />
        </div>
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-32 bg-black/10 rounded mb-1" />
                <div className="h-3 w-48 bg-black/10 rounded" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                <div className="h-5 w-20 bg-black/10 rounded" />
                <div className="h-5 w-24 bg-black/10 rounded" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-4 w-32 bg-black/10 rounded" />
          <div className="h-4 w-32 bg-black/10 rounded" />
        </div>
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {[1, 2, 3].map((i) => (
            <li key={i}>
              <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-12">
                  <div className="absolute inset-0 bg-black/5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-40 bg-black/10 rounded mb-1" />
                  <div className="h-3 w-48 bg-black/10 rounded" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}