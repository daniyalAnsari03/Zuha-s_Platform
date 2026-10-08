export default function AdminAnalyticsLoading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="h-8 w-48 bg-black/10 rounded" />
        <div className="h-5 w-80 bg-black/10 rounded" />
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-black/10 p-4">
            <div className="h-4 w-24 bg-black/10 rounded mb-2" />
            <div className="h-8 w-32 bg-black/10 rounded" />
          </div>
        ))}
      </div>

      <div className="border border-black/10 p-3 sm:p-5">
        <div className="h-64 w-full sm:h-72 bg-black/5" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="border border-black/10 p-3 sm:p-5">
          <div className="h-4 w-32 bg-black/10 rounded mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-black/5 rounded" />
            ))}
          </div>
        </div>
        <div className="border border-black/10 p-3 sm:p-5">
          <div className="h-4 w-32 bg-black/10 rounded mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-black/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}