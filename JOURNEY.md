# JOURNEY.md — my build journal

This is my build journal: why I picked this idea, how I directed Claude Code,
and where it went wrong. Every time Claude Code got something wrong, I logged
what it did, how I noticed, and what I changed.

## Why this idea

Operators who take bookings direct lose the marketplace's fraud screening, and
one bad renter can cost them a car. 1Now listed fraud check as an example
feature, and Carisma's Gatekeeper role matches the recommend-then-approve flow
I built: the engine recommends, the operator always decides.

**How I reviewed:** Claude Code built in phases and stopped after each one. I
reviewed every plan and report, using a second Claude chat as a reviewer, and
used Claude in Chrome for real-browser QA because jsdom tests can't see CSS.
Each entry below says who caught the issue: me/review, Claude Code itself, or
browser QA.

---

## Phase 0 — Scaffold

**Corrections to the plan before any code was written (caught in plan review):**

1. **Rollback was broken for concurrent updates.** Claude proposed a single
   `rollback: Booking | null` slot plus `pendingId: string | null`. But
   `pendingId` only disables *one* booking's buttons, so I can act on booking B
   while A is still in flight — and B's snapshot would overwrite A's, so A's
   failure would restore the wrong booking. I changed it to
   `pendingIds: string[]` and `rollbacks: Record<string, Booking>` keyed by id,
   and asked for a test with two concurrent updates where only the failing one
   rolls back.

2. **Signals were going to be measured against wall-clock `now`.** CLAUDE.md
   says pass `now: Date` in for determinism, and Claude followed that literally.
   But a booking's risk is a fact about the moment it was *placed* — "pickup in
   2 hours" shouldn't quietly stop being true as the booking ages in the queue.
   I moved every signal to be relative to `booking.createdAt`, which makes
   `scoreBooking(booking)` deterministic with no `now` parameter at all.

3. **Two redundant fields.** `Renter.phoneVerified` was never used by any
   signal, and `Recommendation.approveDisabled` duplicated information already
   implied by `action === 'wait_for_id'`. Both removed — derive, don't store.

**During the build:**

4. **Formatter touched my spec files without being asked.** `npm run format`
   reflowed CLAUDE.md and PLAN.md. Content was unchanged, and Claude flagged it
   itself. Kept the reformat and added both files to `.prettierignore`.

**Decision worth defending:** Claude did not take the newest TypeScript, Vite
and ESLint majors because typescript-eslint, the React plugin and jsx-a11y
didn't support them yet. Locked to TS 5.9 / Vite 7 / ESLint 9. Compatible and
stable beats newest for a 3-day build.

---

## Phase 1 — Types + mock data

No errors found. Checked bookings #6 (45), #8 (90) and #10 (all 8 signals,
130 → capped 100) against the plan table.

Accepted: `formatDate` exported beyond the three planned format functions
(the drawer needs a single date). Mock data is seed-driven
(`accountAgeDays: 2`, `leadMinutes: 120`) and built relative to now, with a
test that fails if anyone replaces it with hard-coded dates.

---

## Phase 2 — Risk engine

**Added in review:** the plan tested score thresholds (29/30, 59/60, 84/85)
but not the **signal edges**. I asked for boundary tests on every signal:
lead time 179 min flagged / 180 not; account age just under 7 days flagged /
exactly 7 not; trip 15 days flagged / 14 not; $149 not flagged / $150 flagged.
Also: name matching must ignore case and extra spaces
("Jordan Alcott" vs "jordan alcott " is not a mismatch).

**Claude Code caught itself:** added `minutesBetween` because converting hours
to minutes risked a rounding error exactly at the 179/180 edge.

Tests use literal numbers, not config imports, so changing a weight actually
breaks a test.

---

## Phase 3 — Mock API + `useBookings`

No errors found. Accepted three deviations from the plan:
- `failUpdateIds: string[]` instead of an on/off switch, so the concurrent test
  can fail only one update.
- No `'idle'` load status — the hook starts loading on mount.
- The hook returns `{ ok, message }` instead of showing toasts itself.

**Known limitation (documented, not fixed):** a reload while an update is in
flight could restore an older snapshot over freshly loaded data.

---

## Phase 4 — Queue page

**Caught by real-browser QA, missed by 136 passing tests:**

5. **Keyboard focus was invisible on desktop table rows.** A global
   `:focus-visible` rule set `outline-style: none`, and in Tailwind v4 every
   `outline-*` utility reads that variable — so the row's focus classes did
   nothing. Tests passed because jsdom doesn't apply CSS. Fixed at the source
   in `index.css`, so every component's focus ring works.

6. **Clickable rows weren't announced to screen readers.** Rows were
   `<tr tabIndex={0}>` with no role. The renter name is now a real `<button>`,
   one Tab stop per row.

**Regression caught on re-test:**

7. **The fix for "ID check pending" made it look like "Medium risk".** Same
   amber colours — misleading in a fraud tool. Changed to blue with a clock
   icon so it can't be confused with any risk level.

Also fixed from QA: toasts auto-dismissed while keyboard-focused (now pause on
hover/focus), duplicate toasts stacked, the focus outline overlapped the booking
ID, and the sort hint showed on tabs where it didn't apply.

---

## Phase 5 — Drawer + actions

8. **I overruled a product decision.** Claude closed the drawer when an update
   failed, so the operator lost the decline reason they had typed. I changed it:
   the drawer stays open, the reason is kept, and an inline error explains what
   happened. An operator shouldn't retype a careful reason because of a network
   error.

9. **Claude reported a fix as done; it didn't work in a real browser.** Claude
   noticed that dismissing a toast would close the drawer and added a
   `data-toast-region` guard. Tests passed, but it said it hadn't checked in a
   browser. Browser QA showed clicking the toast's × still closed the drawer and
   lost the reason. Two causes:
   - Radix checks outside clicks on the document `click` event. React's
     `onClick` on × had already removed the toast from the page, so
     `closest('[data-toast-region]')` found nothing.
   - Demo controls sat under the overlay, so clicking them counted as an
     outside click.

   Fix: the drawer only closes with × or Esc; Demo controls and toasts sit
   above the overlay. Claude put the old guard back temporarily to confirm the
   new test fails against it.
   **Lesson: I don't trust a fix until I've seen it work.**

**Product logic fixed from QA:**
- The suggestion for a booking already in "Verification requested" still said
  "Request verification" — that button isn't even offered there. Now: "Waiting
  on the renter".
- A low-risk booking with a +25 name mismatch said "nothing here needs a second
  look". Now it says there's one signal to glance at.
- Signals summing to 130 showed "100" with no explanation. Now: "Signals total
  130 · score capped at 100".
- "Carisma-style suggestion" read like internal jargon. Now: "Suggested action ·
  rule-based".
- Added `aria-modal`, per-button pending labels, and a "Reset demo data" button.

**Not a bug (by design):** the status changes before the save finishes. That's
optimistic UI — instant feedback, with rollback on failure. For irreversible
actions like payments I'd use a pessimistic update instead.

### Targeted re-test and placement fixes

**Re-test result:** 13/15 passed in a real browser. Confirmed fixed: the
drawer staying open on outside clicks, the inline error, the capped-score
note, the status-aware suggestion, Reset demo data, and the pending labels.
The browser QA also found three placement bugs:

10. **Success toast blocked the drawer's buttons.** Caught by browser QA at
    1280px. Cause: toasts sit bottom-right above the drawer (z-50) and pause
    while hovered, so a toast from the last decision covered the next
    booking's action buttons and swallowed clicks. Fix: opening a drawer now
    clears success toasts. Error toasts stay.

11. **Demo controls overlapped the drawer at 768–830px.** Caught by browser
    QA. Cause: the dock is 22rem wide at bottom-left and the drawer is 30rem
    wide on the right, so the two only fit side by side from about 54rem
    (864px). Fix: when a drawer opens on a screen narrower than that, the dock
    collapses to its small title bar, and from md up it can never reach under
    the drawer, even when expanded by hand.

12. **Demo controls hid the action buttons on mobile.** Caught by browser QA.
    Cause: the dock was expanded by default, so on a phone it covered the
    bottom of the full-screen drawer. Fix: below md it starts collapsed. The
    drawer footer's existing bottom padding keeps the collapsed bar clear of
    the buttons.

13. **Claude Code wiped its own uncommitted work during verification.**
    Reported by Claude Code itself. While proving the new tests fail without
    the fix, it ran `git checkout` on `RiskReviewPage.tsx`, which discarded
    the uncommitted changes. It restored them from a copy and re-ran every
    check before committing. Lesson: commit (or `git stash`) before any
    "remove the fix and re-run" experiment.

**Lesson:** demo tooling needs the same layout care as the product, because
it appears in the video.

Final placement QA: 14/15 passed. Only a 4px overlap of the collapsed dock on the mobile Decline button remained; fixed with extra footer padding.

One test run failed with 11 errors and passed on re-run without the errors being captured. I didn't accept 'flaky' as an answer: I made Claude Code run the suite 5 times in a row; all 5 passed (182/182), so I treated it as a one-off environment issue, most likely a parallel run.

---

## Phase 6 — README

README written last, leading with the operator's problem; assumptions and cuts stated explicitly.

---

## Where I got stuck

- **Keyboard focus rings were invisible even though tests passed.** jsdom
  doesn't apply CSS, so only a real browser showed it (entry 5).
- **Clicking a toast closed the drawer and lost the typed reason.** The first
  fix passed its tests but failed in the browser (entry 9).
- **Demo controls overlapped the drawer at tablet widths.** The dock and the
  drawer only fit side by side from about 864px (entry 11).
- **Choosing Vite + React over Next.js.** One screen with mock data doesn't
  need routing or a server, and I wanted to stay within code I could change
  confidently.
