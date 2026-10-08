export default function AdminCategoriesLoading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="h-8 w-48 bg-black/10 rounded" />
        <div className="h-5 w-80 bg-black/10 rounded" />
      </header>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-black/10 rounded-lg overflow-hidden">
            <div className="bg-black/5 px-4 py-3 border-b border-black/10">
              <div className="flex items-center justify-between gap-3">
                <div className="h-5 w-40 bg-black/10 rounded" />
                <div className="h-8 w-20 bg-black/10 rounded" />
              </div>
            </div>
            <div className="p-4 space-y-3">
              {[1, 2].map((j) => (
                <div key={j} className="flex items-center gap-3 p-2 border border-black/10 rounded">
                  <div className="relative aspect-square w-12 shrink-0 overflow-hidden border border-black/10 bg-black/5">
                    <div className="absolute inset-0 bg-black/5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-32 bg-black/10 rounded mb-1" />
                    <div className="h-3 w-24 bg-black/10 rounded" />
                  </div>
                  <div className="h-8 w-20 bg-black/10 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}