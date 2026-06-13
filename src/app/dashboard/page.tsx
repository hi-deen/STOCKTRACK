export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Welcome to StockTrack</h1>
        <p className="mt-3 text-sm text-slate-600">Use the navigation to manage shops, products, stock, and payments for your active business.</p>
      </div>
    </div>
  );
}
