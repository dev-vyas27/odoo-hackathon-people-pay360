-- 0008_timeoff.sql — leave types, allocations and requests.
-- Owner: Dev A (modules/timeoff)

CREATE TABLE timeoff_types (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  -- What humans type and what the seed keys off: PL / SL / UL.
  code                text NOT NULL,
  unit                text NOT NULL DEFAULT 'day',
  -- false for unpaid leave: no balance to draw down, so it can never overdraw.
  requires_allocation boolean NOT NULL DEFAULT true,
  -- Read by payroll when prorating.
  is_paid             boolean NOT NULL DEFAULT true,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT timeoff_types_code_key UNIQUE (code),
  CONSTRAINT timeoff_types_unit_valid CHECK (unit IN ('day', 'hour'))
);

CREATE TABLE timeoff_allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  timeoff_type_id uuid NOT NULL REFERENCES timeoff_types (id) ON DELETE RESTRICT,
  unit            text NOT NULL DEFAULT 'day',
  allocated       numeric(8, 2) NOT NULL,
  /*
   * Consumed by approved requests. STORED, not derived.
   *
   * Deriving it would mean summing every approved request on every balance
   * read, and — the real reason — it would make the approval deduction
   * non-atomic. Two approvals racing on one allocation would both read the same
   * "before" total and both succeed. A stored counter mutated inside the same
   * transaction as the status change cannot do that.
   */
  taken           numeric(8, 2) NOT NULL DEFAULT 0,
  -- The window must span a request ENTIRELY, not merely overlap it. A 5-day
  -- leave straddling the year boundary is not half-funded by last year.
  valid_from      date NOT NULL,
  valid_to        date NOT NULL,
  status          text NOT NULL DEFAULT 'draft',
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT allocations_unit_valid CHECK (unit IN ('day', 'hour')),
  CONSTRAINT allocations_status_valid
    CHECK (status IN ('draft', 'to_approve', 'approved', 'refused')),
  CONSTRAINT allocations_allocated_non_negative CHECK (allocated >= 0),
  CONSTRAINT allocations_valid_range CHECK (valid_to >= valid_from),
  -- The invariant Allocation.consume() enforces in the domain, restated where
  -- it cannot be bypassed. If application code ever writes `taken` directly
  -- and gets it wrong, the transaction fails instead of the balance going
  -- quietly negative.
  CONSTRAINT allocations_taken_within_allocated CHECK (taken >= 0 AND taken <= allocated)
);

-- Serves the balance screen, the request-time check and the approval check:
-- "this employee, this type, valid around this date".
CREATE INDEX allocations_lookup_idx
  ON timeoff_allocations (employee_id, timeoff_type_id, valid_from, valid_to);

CREATE TABLE timeoff_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  timeoff_type_id uuid NOT NULL REFERENCES timeoff_types (id) ON DELETE RESTRICT,
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  unit            text NOT NULL DEFAULT 'day',
  -- Stored rather than derived from the dates: half-days and hour-unit leave
  -- exist, and two dates cannot express "Friday afternoon".
  duration        numeric(8, 2) NOT NULL,
  reason          text,
  status          text NOT NULL DEFAULT 'draft',
  /*
   * WHICH allocation funded the approval.
   *
   * Refusing a previously approved request has to put the days back. With two
   * overlapping allocations, guessing which one to credit is wrong half the
   * time. RESTRICT because deleting an allocation that is funding approved
   * leave would strand the balance.
   */
  allocation_id     uuid REFERENCES timeoff_allocations (id) ON DELETE RESTRICT,
  decided_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT requests_unit_valid CHECK (unit IN ('day', 'hour')),
  CONSTRAINT requests_status_valid
    CHECK (status IN ('draft', 'to_approve', 'approved', 'refused')),
  CONSTRAINT requests_duration_positive CHECK (duration > 0),
  CONSTRAINT requests_ends_after_starts CHECK (ends_on >= starts_on),
  -- An approved request that consumed a balance must record where from.
  CONSTRAINT requests_approved_has_decision
    CHECK (status <> 'approved' OR decided_at IS NOT NULL)
);

-- Overlap detection loads one employee's requests by date.
CREATE INDEX requests_employee_period_idx ON timeoff_requests (employee_id, starts_on, ends_on);
-- The dashboard's approved-leave-in-period aggregation.
CREATE INDEX requests_status_period_idx ON timeoff_requests (status, starts_on, ends_on);

CREATE TRIGGER timeoff_types_updated_at BEFORE UPDATE ON timeoff_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER timeoff_allocations_updated_at BEFORE UPDATE ON timeoff_allocations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER timeoff_requests_updated_at BEFORE UPDATE ON timeoff_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
