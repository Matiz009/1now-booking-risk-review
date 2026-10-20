import { AllBookingsPage } from '@/features/risk-review/components/AllBookingsPage';
import { RiskReviewPage } from '@/features/risk-review/components/RiskReviewPage';
import { cn } from '@/lib/cn';
import { useHashRoute } from '@/lib/useHashRoute';

const NAV_LINKS = [
  { href: '#/', path: '/', label: 'Review queue' },
  { href: '#/bookings', path: '/bookings', label: 'All bookings' },
];

/** Page shell. Layout and routing only; the feature lives in features/risk-review. */
export function App() {
  const { path } = useHashRoute();
  // Anything that isn't a known page falls back to the review queue.
  const activePath = path === '/bookings' ? '/bookings' : '/';

  return (
    <div className="min-h-screen">
      <header className="border-line border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold tracking-tight">Booking Risk Review</h1>
          <p className="text-muted mt-0.5 text-sm">
            Fraud screening for direct bookings. The engine recommends; you decide.
          </p>
          <p className="text-subtle mt-1 text-xs">Prototype built for 1Now</p>
          <nav aria-label="Main" className="mt-3">
            <ul className="flex gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = link.path === activePath;
                return (
                  <li key={link.path}>
                    <a
                      href={link.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'inline-block rounded-md px-3 py-1.5 text-sm font-medium',
                        isActive ? 'bg-primary text-ink' : 'text-muted hover:text-ink',
                      )}
                    >
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {activePath === '/bookings' ? <AllBookingsPage /> : <RiskReviewPage />}
      </main>
    </div>
  );
}
