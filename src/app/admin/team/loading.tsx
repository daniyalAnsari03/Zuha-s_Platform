export default function AdminTeamLoading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="h-8 w-48 bg-black/10 rounded" />
        <div className="h-5 w-80 bg-black/10 rounded" />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="h-10 w-24 bg-black/10 rounded" />
        <div className="h-10 w-40 bg-black/10 rounded" />
      </div>

      <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
            <div className="relative aspect-square w-12 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-14">
              <div className="absolute inset-0 bg-black/5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-4 w-32 bg-black/10 rounded mb-1" />
              <div className="h-3 w-24 bg-black/10 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-black/10 rounded" />
              <div className="h-8 w-8 bg-black/10 rounded" />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-center gap-2">
        <div className="h-8 w-8 bg-black/10 rounded" />
        <div className="h-8 w-8 bg-black/10 rounded" />
        <div className="h-8 w-8 bg-black/10 rounded" />
      </div>
    </section>
  );
}