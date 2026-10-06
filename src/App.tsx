/**
 * Page shell. Layout only — the feature itself is rendered from
 * features/risk-review and arrives in Phase 4.
 */
export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight">Booking Risk Review</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Fraud screening for direct bookings. The engine recommends; you decide.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-500">Scaffold is up. The review queue lands in Phase 4.</p>
      </main>
    </div>
  );
}
