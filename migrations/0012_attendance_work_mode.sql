-- 0012_attendance_work_mode.sql — where the employee worked that shift.
-- Owner: Dev B (modules/attendance)
--
-- Self-service check-in asks "Working from?" before it opens a shift, because
-- the answer is only knowable at the moment somebody clocks in. Reconstructing
-- it afterwards from an IP address or a rota is guesswork, and HR reporting on
-- office attendance needs it to be a fact.
--
-- NULLABLE, and the nullability carries meaning: every record seeded or created
-- before this column existed genuinely has no answer, and inventing 'office'
-- for them would make a fabricated number look like a measured one.

ALTER TABLE attendances
  ADD COLUMN work_mode text;

ALTER TABLE attendances
  ADD CONSTRAINT attendances_work_mode_valid
  CHECK (work_mode IS NULL OR work_mode IN ('office', 'home', 'other'));

COMMENT ON COLUMN attendances.work_mode IS
  'Where the employee worked this shift. NULL for records created before self-service check-in.';
