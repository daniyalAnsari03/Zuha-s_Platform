export default function AdminProductsLoading() {
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex flex-col gap-2 border border-black/10">
            <div className="relative aspect-[2/3] w-full overflow-hidden border border-black/10 bg-black/5">
              <div className="absolute inset-0 bg-black/5" />
            </div>
            <div className="px-3 pb-3">
              <div className="h-4 w-32 bg-black/10 rounded mb-1" />
              <div className="h-4 w-20 bg-black/10 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="h-8 w-8 bg-black/10 rounded" />
        <div className="h-8 w-8 bg-black/10 rounded" />
        <div className="h-8 w-8 bg-black/10 rounded" />
      </div>
    </section>
  );
}