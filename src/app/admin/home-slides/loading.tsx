export default function AdminHomeSlidesLoading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="h-8 w-40 bg-black/10 rounded" />
        <div className="h-5 w-96 bg-black/10 rounded" />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="h-5 w-24 bg-black/10 rounded" />
        <div className="h-10 w-28 bg-black/10 rounded" />
      </div>

      <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex items-center justify-between gap-3 p-3 sm:p-4">
            <div className="h-16 w-24 bg-black/10 rounded" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-64 bg-black/10 rounded mb-1" />
              <div className="h-3 w-40 bg-black/10 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-black/10 rounded" />
              <div className="h-8 w-8 bg-black/10 rounded" />
              <div className="h-8 w-16 bg-black/10 rounded" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
