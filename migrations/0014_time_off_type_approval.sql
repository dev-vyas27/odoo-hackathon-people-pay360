-- 0014_time_off_type_approval.sql — per-type approval workflow.
-- Owner: Dev A (modules/timeoff)
--
-- Spec A4 lists "approval workflows" as one of the four things a Time Off
-- Type configures, alongside units, allocation requirements and payroll
-- integration. Until now the approval workflow was the same for every type —
-- always manual. This adds the fourth flag: a type can be configured to skip
-- manual approval and land a submitted request straight in `approved`.
--
-- Backfilling `false` for every existing row preserves today's behaviour
-- exactly: nothing that used to require a manual decision starts
-- auto-approving itself just because the column now exists.

ALTER TABLE timeoff_types
  ADD COLUMN auto_approve boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN timeoff_types.auto_approve IS
  'Skip manual approval: a submitted request of this type is approved immediately, consuming its allocation the same way a manual approval would.';
