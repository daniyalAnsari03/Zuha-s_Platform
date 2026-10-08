export default function AdminSettingsLoading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="h-8 w-48 bg-black/10 rounded" />
        <div className="h-5 w-80 bg-black/10 rounded" />
      </header>

      <div className="space-y-4 max-w-2xl">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-4 w-32 bg-black/10 rounded" />
            <div className="h-10 w-full bg-black/5 border border-black/10 rounded" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-4 border-t border-black/10">
        <div className="h-8 w-24 bg-black/10 rounded" />
        <div className="h-10 w-24 bg-black/10 rounded" />
      </div>
    </section>
  );
}