# PLAN.md: Booking Risk Review (build, test, understand)

**Deadline:** Friday 9 Oct 2026, midnight. **Target submit:** Friday afternoon.

**Your role:** Claude Code builds. You review, test and understand. After every phase you run the checks below yourself and complete the "explain it" items out loud without looking at the code. If you can't, ask Claude Code: _"Explain [file] line by line as if I'll be quizzed on it."_ Don't move on until you can.

**Your log (keep it open the whole time):** `NOTES.md` in the repo root, not committed until Friday. Every time Claude Code gets something wrong, write: what it did, how you noticed, what you changed. That's your interview story and your README section.

---

## Kickoff prompt (paste into Claude Code, plan mode)

```
Read CLAUDE.md and PLAN.md fully. We're starting Phase 0.
Before writing anything, confirm your understanding of the feature in 5 bullets and list the exact files Phase 0 will create. Then wait for my go-ahead.
```

For every next phase: `Phase N. Follow CLAUDE.md. List the files first, then build.`

---

## Phase 0: Scaffold (Wed, ~1 hr)

**Claude builds:** Vite React-TS project, Tailwind v4, Radix Dialog, Vitest + RTL + jsdom, ESLint + Prettier, `@/` alias, npm scripts from CLAUDE.md, folder skeleton, a `.gitignore`.

**You test:**

- [ ] `npm run dev` shows a page
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run` all pass
- [ ] `tsconfig` has `"strict": true`

**Explain it:** what Vite does vs Create React App; what `strict` mode catches; what the `@/` alias is.

## Phase 1: Types + mock data (Wed, ~1 hr)

**Claude builds:** `types.ts`, `bookings.mock.ts` with 12 bookings built relative to `now`, covering: 4 low, 2 medium, 2 high, 1 ID pending, 1 ID failed, 1 already approved, 1 already declined.

**You test:**

- [ ] Every status and risk case from CLAUDE.md has at least one booking
- [ ] Dates are relative (e.g. `addHours(now, 3)`), not fixed strings

**Explain it:** `type` vs `interface`; why statuses are string unions; why mock dates are relative (otherwise "pickup in 3 hours" breaks tomorrow).

## Phase 2: Risk logic + tests (Wed, ~2 hrs) ⭐ most important

**Claude builds:** `risk.config.ts`, `scoreBooking.ts`, `recommendAction.ts`, `transitions.ts`, and tests for each.

**You test:**

- [ ] Tests cover every signal, boundaries 29/30, 59/60, 84/85, cap at 100, `unscored`
- [ ] Change one weight in the config, rerun tests, and see the right ones fail. Then revert.
- [ ] No `Date.now()` inside these files

**Explain it:** why logic is pure and separate from React; why `now` is a parameter; walk through scoring one high-risk booking by hand.

**Live drill:** add a new signal "booking made between 1am and 5am, +10" with a test, without AI. Target: 15 min.

## Phase 3: Mock API + `useBookings` (Wed evening, ~2 hrs)

**Claude builds:** `bookingsApi.ts` (`getBookings`, `updateBookingStatus`, 600 ms delay, failure toggle), `useBookings` with `useReducer`, optimistic update + rollback, derived risk via `useMemo`.

**You test:**

- [ ] Read the reducer: list every action type and what it changes
- [ ] Find the exact lines where rollback happens

**Explain it:** why `useReducer` over several `useState`s; what "optimistic update" means and why it feels faster; why scores aren't stored in state.

## Phase 4: Queue page (Thu morning, ~2 hrs)

**Claude builds:** `RiskReviewPage`, `StatusTabs` with counts, `BookingTable` (cards on mobile), `RiskBadge`, `StatusBadge`, loading skeleton, empty and error states, `DevPanel`.

**You test:**

- [ ] Default sort is highest risk first in "Needs review"
- [ ] Turn on load failure in DevPanel, reload: error state with working Retry
- [ ] Empty tab shows an empty state, not a blank table
- [ ] At 360px width (DevTools), rows become cards, no horizontal scroll
- [ ] Tab through with the keyboard: focus is always visible

**Explain it:** which state lives in the hook vs the page and why; how the table/card switch works.

**Live drill:** add a "Car" filter dropdown, or sort by total. Target: 15 min.

## Phase 5: Drawer + actions (Thu afternoon, ~3 hrs)

**Claude builds:** `ReviewDrawer` (Radix Dialog), `SignalList`, `RecommendationCard`, `ActionBar`, `DeclineReasonForm`, toasts, component tests for the critical flow.

**You test:**

- [ ] Open with click and with Enter; Esc closes; focus returns to the row
- [ ] Decline without a reason is blocked with a clear message
- [ ] Approve is disabled for the ID-pending booking, with a reason shown
- [ ] Turn on update failure: action appears, then rolls back with an error toast
- [ ] Actions only show when `canTransition` allows them
- [ ] Component tests pass

**Explain it:** how the drawer gets its booking; the full path of a click from button → hook → API → state → UI; how rollback restores the old state.

**Live drill:** add a "Hold" status end to end (type, transition, button, tab, test). Target: 20–25 min. This is the most likely kind of interview change.

## Phase 6: Polish + README (Thu evening, ~1.5 hrs)

**Claude builds:** README (outline below), final lint/type cleanup.

**You do:**

- [ ] Add one real host quote from r/turo about fraud or bad renters (by hand)
- [ ] Write the "Where I corrected Claude Code" section from `NOTES.md`, in your own words
- [ ] Review `git log`: small, clear commits

**Stretch (only if everything above is done):** threshold sliders in a rules panel → undo toast → do-not-rent list.

## Phase 7: Ship (Fri)

- [ ] Fresh clone → `npm install` → `npm run dev` works
- [ ] Deploy to Vercel; test the live link on your phone
- [ ] Repo public or shared; link the live demo in the README
- [ ] Record the Loom (script below), 2–3 takes, under 3 min
- [ ] Submit, then reply to the HR email

---

## README outline

1. **The problem:** operators going direct lose marketplace fraud screening; one bad renter can cost a car.
2. **What I built:** one paragraph + screenshot/GIF + live link.
3. **How it works:** signals and weights table; recommend-then-approve, like Carisma.
4. **Run it:** install, dev, test commands; how to use the DevPanel.
5. **Decisions and trade-offs:** Vite + React instead of Next.js (one screen, faster, components port directly); rule-based instead of AI (explainable, testable, no fake "AI"); pure logic + hook + presentational components; optimistic updates.
6. **Left out and why:** auth, backend, Vouched, Stripe, messaging, Carisma integration.
7. **How I used Claude Code:** CLAUDE.md, plan mode, phase-by-phase review, and where I corrected it.
8. **Next steps:** plug in real ID results, operator-tunable rules, maintenance scheduling, payout reconciliation.

## Loom script (≤ 3 min)

- **0:00–0:20:** who you are, one line.
- **0:20–0:45:** the problem + one-sentence pitch.
- **0:45–2:15:** demo: queue → open high-risk booking → signals → recommendation → decline with reason → ID-pending case → failure + rollback via DevPanel → mobile view.
- **2:15–2:45:** what you left out and why; one Claude Code correction.
- **2:45–3:00:** next step you'd build.

## Interview questions to rehearse

- Why Vite and not Next.js? How would you port it?
- Why is the risk logic pure and outside React?
- Walk me through what happens when I click Decline.
- What happens if the API fails mid-update?
- Why are scores derived and not stored?
- How did you make the drawer accessible?
- Where was Claude Code wrong, and how did you catch it?
- What would you change to support 5,000 bookings? (pagination/virtualisation, server-side scoring)
- How would this connect to Carisma and Vouched in production?
