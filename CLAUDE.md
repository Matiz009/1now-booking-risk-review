# CLAUDE.md: Booking Risk Review (1Now take-home)

## What this project is

A small, working feature for 1Now, a car rental SaaS for Turo hosts and operators who take bookings directly.

**Booking Risk Review queue:** new direct bookings are scored for fraud risk by a rule-based engine. Each score comes with the reasons behind it and a recommended action. The operator makes the final decision (Approve / Request verification / Decline). This mirrors 1Now's Carisma "Gatekeeper" approach: recommend first, act only after the operator approves.

This is a standalone prototype using mock data. There is no login, no backend and no real ID or payment integration.

## Who maintains this

The developer must be able to explain and modify every line live in an interview. Therefore:

- Prefer simple, readable code over clever abstractions.
- No new dependency without asking first and stating why.
- Explain any non-obvious TypeScript or React pattern in 1–2 sentences when you introduce it.

## Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS v4 (`@tailwindcss/vite` plugin, `@import "tailwindcss";` in `src/index.css`)
- `@radix-ui/react-dialog` for the accessible drawer (focus trap, Esc to close)
- Vitest + React Testing Library + jsdom for tests
- ESLint + Prettier
- Path alias: `@/` → `src/`

Not used, on purpose: Next.js, Redux, React Query, a router, a UI kit. One screen doesn't need them.

## Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # type-check + production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest (watch)
npm run test:run     # vitest single run (use before committing)
```

## Folder structure

```
src/
  main.tsx                      # React entry
  App.tsx                       # page layout; renders the feature
  index.css                     # Tailwind import + base styles
  components/ui/                # generic, feature-agnostic UI
    Badge.tsx  Button.tsx  EmptyState.tsx  ErrorState.tsx  Skeleton.tsx  Toast.tsx
  lib/
    format.ts                   # formatCurrency, formatDateRange, formatRelative
  features/risk-review/
    types.ts                    # all domain types for this feature
    data/bookings.mock.ts       # mock bookings, dates relative to "now"
    api/bookingsApi.ts          # mock async API (delay + simulated failures)
    lib/
      risk.config.ts            # weights and thresholds (single source of truth)
      scoreBooking.ts           # pure: booking → risk result
      recommendAction.ts        # pure: risk result → recommended action
      transitions.ts            # pure: which status changes are allowed
      *.test.ts                 # unit tests next to each file
    hooks/
      useBookings.ts            # load, select, optimistic update + rollback
    components/
      RiskReviewPage.tsx        # composes everything for the feature
      StatusTabs.tsx
      BookingTable.tsx          # table on desktop, cards on mobile
      RiskBadge.tsx  StatusBadge.tsx
      ReviewDrawer.tsx          # Radix Dialog side panel
      SignalList.tsx
      RecommendationCard.tsx
      ActionBar.tsx
      DeclineReasonForm.tsx
      DevPanel.tsx              # demo-only: toggle simulated API failures
  test/setup.ts                 # RTL + jest-dom setup
```

## Architecture rules

1. **Data flows one way:** `bookingsApi` → `useBookings` → `RiskReviewPage` → presentational components via props.
2. **Business logic lives in `features/risk-review/lib/` as pure functions.** No React, no side effects, no `Date.now()` inside them. Pass `now: Date` in as a parameter so tests are deterministic.
3. **Components don't call the API directly.** Only `useBookings` does.
4. **Risk scores are derived, never stored.** Compute them from booking data (memoised with `useMemo` in the hook).
5. **All weights and thresholds come from `risk.config.ts`.** Never hard-code a number in a component or function.
6. **Status changes go through `transitions.ts`.** The UI asks `canTransition(from, to)` before showing an action.

## Domain rules

- Booking status: `needs_review` → `approved` | `verification_requested` | `declined`.
  `verification_requested` → `approved` | `declined`. `approved` and `declined` are final.
- Risk level: `low` (< 30), `medium` (30–59), `high` (≥ 60), `unscored` (ID check pending).
- Signals and default weights (score capped at 100):
  | Signal                             | Points |
  | ---------------------------------- | ------ |
  | ID check failed                    | 40     |
  | Name on ID ≠ driver name           | 25     |
  | Prepaid card                       | 15     |
  | Account under 7 days old           | 15     |
  | First-time renter (0 past trips)   | 10     |
  | Pickup under 3 hours after booking | 10     |
  | High-value car (daily rate ≥ $150) | 10     |
  | Trip longer than 14 days           | 5      |
- Recommendation:
  - `unscored` → wait for ID check; **Approve is disabled**
  - ID check failed, or score ≥ 85 → recommend **decline**
  - score ≥ 30 → recommend **request verification** (mention a higher deposit when high)
  - otherwise → recommend **approve**
- Decline always requires a reason (min 10 characters).
- The operator can override the recommendation. The recommendation is advice, not an action.

## TypeScript conventions

- `strict: true`. Never use `any`; use `unknown` and narrow if needed.
- Use `type` for data shapes and string-literal unions for statuses (no `enum`).
- Export domain types from `features/risk-review/types.ts` only.
- Type component props as `type XProps = { ... }` directly above the component.
- Function components as `function Name(props: Props)`, not `React.FC`.

## React conventions

- One component per file, named export, file name = component name.
- State for the bookings list lives in `useBookings` with `useReducer`. UI-only state (open drawer, active tab) lives in `RiskReviewPage` with `useState`.
- Every async operation handles **loading, success, empty and error**.
- Optimistic updates: update state immediately, call the API, and on failure roll back to the previous state and show an error toast.
- No `useEffect` for derived data; use `useMemo` or compute during render.

## UI and accessibility

- Responsive down to 360px: the table becomes stacked cards below `md`.
- Every input has a visible label. Every icon-only button has `aria-label`.
- Visible focus styles on all interactive elements (`focus-visible:ring`).
- Risk is shown with text + colour, never colour alone.
- Drawer: opens on row click or Enter, closes on Esc, returns focus to the row.
- Money as `$1,234` via `Intl.NumberFormat`; dates via `Intl.DateTimeFormat`.

## Testing

- Unit tests for every function in `lib/`: each signal, each threshold boundary (29/30, 59/60, 84/85), the capped score, `unscored`, and every allowed and blocked transition.
- Component tests (RTL) for the critical flow: open a booking → decline without a reason is blocked → decline with a reason moves it to the Declined tab → simulated API failure rolls it back.
- Test user-visible behaviour (roles, labels, text), not implementation details.

## Workflow for Claude

1. Read `PLAN.md` and work only on the current phase.
2. Before coding a phase, state the files you'll touch in 3–5 lines.
3. After each phase: run `npm run typecheck`, `npm run lint` and `npm run test:run`, and fix failures before reporting.
4. Report: files changed, any new TypeScript/React pattern explained briefly, and **one thing the developer should verify by hand**.
5. Commit with a Conventional Commit message (`feat:`, `test:`, `fix:`, `docs:`, `chore:`), one logical change per commit.
6. Stop and wait for "next" before starting the following phase.

## Out of scope (explain in README, don't build)

Login/auth, a real database or backend, real ID verification (Vouched), payments/deposits (Stripe), sending SMS/email, Next.js routing, Carisma/LLM integration.
