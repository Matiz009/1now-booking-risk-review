/**
 * Every domain type for the risk-review feature lives here (CLAUDE.md).
 *
 * The split that matters: `Booking`, `Renter` and `Car` are *stored* data —
 * what a real API would return. `RiskSignal`, `RiskResult` and
 * `Recommendation` are *derived* — recomputed from a Booking on every render
 * and never written back to it.
 */

// ---------------------------------------------------------------------------
// Unions. String literals rather than enums (CLAUDE.md): they serialise as
// plain JSON, need no import at the call site, and a typo is a compile error.
// ---------------------------------------------------------------------------

/**
 * needs_review → approved | verification_requested | declined
 * verification_requested → approved | declined
 * approved and declined are final. Enforced by transitions.ts (Phase 2).
 */
export type BookingStatus = 'needs_review' | 'verification_requested' | 'approved' | 'declined';

/** low < 30, medium 30–59, high ≥ 60. `unscored` means the ID check hasn't returned. */
export type RiskLevel = 'low' | 'medium' | 'high' | 'unscored';

export type IdCheckStatus = 'pending' | 'passed' | 'failed';

export type PaymentType = 'credit_card' | 'debit_card' | 'prepaid_card';

export type RiskSignalId =
  | 'id_check_failed'
  | 'name_mismatch'
  | 'prepaid_card'
  | 'new_account'
  | 'first_time_renter'
  | 'short_lead_time'
  | 'high_value_car'
  | 'long_trip';

export type RecommendedAction = 'approve' | 'request_verification' | 'decline' | 'wait_for_id';

// ---------------------------------------------------------------------------
// Stored data
// ---------------------------------------------------------------------------

export type Renter = {
  id: string;
  fullName: string;
  /**
   * The name the ID document was issued to. `null` until the ID check returns —
   * which is why the name-mismatch signal cannot fire while a check is pending.
   */
  nameOnId: string | null;
  /** ISO 8601. Account age is measured against the booking's createdAt, not now. */
  accountCreatedAt: string;
  pastTripCount: number;
};

export type Car = {
  id: string;
  make: string;
  model: string;
  year: number;
  /** Whole dollars per day. Drives the high-value-car signal. */
  dailyRate: number;
};

export type Booking = {
  id: string;
  /** ISO 8601. When the booking was placed — the reference point for every signal. */
  createdAt: string;
  /** ISO 8601. */
  pickupAt: string;
  /** ISO 8601. */
  returnAt: string;
  totalAmount: number;
  status: BookingStatus;
  /** Required when status is `declined`, null otherwise. */
  declineReason: string | null;
  idCheck: IdCheckStatus;
  paymentType: PaymentType;
  renter: Renter;
  car: Car;
};

// ---------------------------------------------------------------------------
// Derived data — computed by lib/, never stored on a Booking
// ---------------------------------------------------------------------------

/** One rule that fired, carrying the evidence the operator reads. */
export type RiskSignal = {
  id: RiskSignalId;
  /** The rule, e.g. "Account under 7 days old". */
  label: string;
  /** From risk.config.ts. Never hard-coded elsewhere. */
  points: number;
  /** The specific evidence for *this* booking, e.g. "Created 2 days before booking". */
  detail: string;
};

export type RiskResult = {
  /** 0–100, capped. Always 0 when level is `unscored`. */
  score: number;
  level: RiskLevel;
  /** Only the signals that fired, highest points first. Empty when `unscored`. */
  signals: RiskSignal[];
};

export type Recommendation = {
  action: RecommendedAction;
  /** Button-length summary, e.g. "Request verification". */
  headline: string;
  /** One sentence explaining why, shown under the headline. */
  rationale: string;
};

/**
 * What `useBookings` memoises and hands to the components: a booking together
 * with everything derived from it, so no component ever scores anything itself.
 */
export type ScoredBooking = {
  booking: Booking;
  risk: RiskResult;
  recommendation: Recommendation;
};
