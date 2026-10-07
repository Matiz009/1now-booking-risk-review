import { RiskReviewPage } from '@/features/risk-review/components/RiskReviewPage';

/** Page shell. Layout only; the feature lives in features/risk-review. */
export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-line border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold tracking-tight">Booking Risk Review</h1>
          <p className="text-muted mt-0.5 text-sm">
            Fraud screening for direct bookings. The engine recommends; you decide.
          </p>
          <p className="text-subtle mt-1 text-xs">Prototype built for 1Now</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <RiskReviewPage />
      </main>
    </div>
  );
}
