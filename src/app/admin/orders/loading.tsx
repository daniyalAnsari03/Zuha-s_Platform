export default function AdminOrdersLoading() {
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

      <div className="border border-black/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/5">
                <th className="px-4 py-3 text-left"><div className="h-4 w-24 bg-black/10 rounded" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-32 bg-black/10 rounded" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-24 bg-black/10 rounded" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-20 bg-black/10 rounded" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-16 bg-black/10 rounded" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-black/10 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-black/10 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-black/10 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-black/10 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-6 w-24 bg-black/10 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="h-8 w-8 bg-black/10 rounded" />
        <div className="h-8 w-8 bg-black/10 rounded" />
        <div className="h-8 w-8 bg-black/10 rounded" />
      </div>
    </section>
  );
}