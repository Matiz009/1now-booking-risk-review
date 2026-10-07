import { RiskReviewPage } from '@/features/risk-review/components/RiskReviewPage';

/** Page shell. Layout only; the feature lives in features/risk-review. */
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
        <RiskReviewPage />
      </main>
    </div>
  );
}
