export default function AdminMessagesLoading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="h-8 w-40 bg-black/10 rounded" />
        <div className="h-5 w-72 bg-black/10 rounded" />
      </header>

      <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex items-start justify-between gap-3 p-3 sm:p-4">
            <div className="min-w-0 flex-1">
              <div className="h-4 w-44 bg-black/10 rounded mb-2" />
              <div className="h-3 w-56 bg-black/10 rounded mb-2" />
              <div className="h-3 w-full max-w-md bg-black/10 rounded" />
            </div>
            <div className="h-3 w-20 shrink-0 bg-black/10 rounded" />
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
