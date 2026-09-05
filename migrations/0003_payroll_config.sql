-- 0003_payroll_config.sql — salary rules and structures.
-- Owner: Dev C (modules/payroll-config)
--
-- Before contracts, because a contract points at the structure it is paid under.

CREATE TABLE salary_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  -- Formulas reference rules by code ("GROSS - PF - TAX"), so it is unique and
  -- upper-case. This is the identifier the rule engine resolves at run time.
  code             text NOT NULL,
  category         text NOT NULL,
  -- Execution order. Rules run ascending and may only reference codes that ran
  -- before them; the engine raises on a forward reference rather than
  -- substituting zero, which would produce a wrong payslip that looks right.
  sequence         integer NOT NULL,
  computation_type text NOT NULL,
  -- Exactly one of these is meaningful, decided by computation_type. The CHECK
  -- at the bottom enforces that rather than trusting the application.
  amount           numeric(14, 2),
  percentage       numeric(6, 3),
  base_rule_code   text,
  expression       text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT salary_rules_code_key UNIQUE (code),
  CONSTRAINT salary_rules_category_valid
    CHECK (category IN ('basic', 'allowance', 'gross', 'deduction', 'net')),
  CONSTRAINT salary_rules_computation_valid
    CHECK (computation_type IN ('fixed', 'percentage', 'formula')),
  CONSTRAINT salary_rules_percentage_range
    CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),

  -- Each computation type must carry its own parameters. Without this a
  -- percentage rule with a null base_rule_code reaches the engine and fails at
  -- compute time, halfway through a payrun, instead of at save time.
  CONSTRAINT salary_rules_parameters_present CHECK (
    (computation_type = 'fixed'      AND amount IS NOT NULL) OR
    (computation_type = 'percentage' AND percentage IS NOT NULL AND base_rule_code IS NOT NULL) OR
    (computation_type = 'formula'    AND expression IS NOT NULL)
  )
);

CREATE INDEX salary_rules_sequence_idx ON salary_rules (sequence);

CREATE TABLE salary_structures (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  code       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salary_structures_name_key UNIQUE (name),
  CONSTRAINT salary_structures_code_key UNIQUE (code)
);

-- The join table Mongo would have modelled as an array of ids on the structure.
-- Relationally it is its own row, which buys a real foreign key on both sides
-- (a rule cannot be deleted out from under a structure) and a place to hang the
-- per-structure sequence override.
CREATE TABLE salary_structure_rules (
  salary_structure_id uuid NOT NULL REFERENCES salary_structures (id) ON DELETE CASCADE,
  salary_rule_id      uuid NOT NULL REFERENCES salary_rules (id) ON DELETE RESTRICT,
  -- NULL means "use the rule's own sequence". Set it to reorder a rule inside
  -- one structure without affecting every other structure that uses it.
  sequence_override   integer,
  PRIMARY KEY (salary_structure_id, salary_rule_id)
);

CREATE TRIGGER salary_rules_updated_at BEFORE UPDATE ON salary_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salary_structures_updated_at BEFORE UPDATE ON salary_structures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
