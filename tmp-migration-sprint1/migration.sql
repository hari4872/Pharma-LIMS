-- Sprint 1 Migration: Quality Events enhanced + OOS Phase 2

-- Check if column Title already exists; only add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='Title'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "Title" character varying(300) NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='Priority'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "Priority" character varying(20) NOT NULL DEFAULT 'Medium';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='RootCause'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "RootCause" text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='CorrectiveAction'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "CorrectiveAction" text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='PreventiveAction'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "PreventiveAction" text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='AssignedToUserId'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "AssignedToUserId" integer NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='LabId'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "LabId" integer NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='DueDate'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "DueDate" date NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='ResolvedBy'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "ResolvedBy" character varying(100) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='UpdatedBy'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "UpdatedBy" character varying(100) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='complaints_deviations' AND column_name='UpdatedAt'
  ) THEN
    ALTER TABLE complaints_deviations ADD COLUMN "UpdatedAt" timestamptz NULL;
  END IF;

END $$;

-- Make SampleId nullable (if it isn't already)
ALTER TABLE complaints_deviations ALTER COLUMN "SampleId" DROP NOT NULL;

-- Add FK indexes if not present
CREATE INDEX IF NOT EXISTS "IX_complaints_deviations_AssignedToUserId"
  ON complaints_deviations("AssignedToUserId");
CREATE INDEX IF NOT EXISTS "IX_complaints_deviations_LabId"
  ON complaints_deviations("LabId");

-- Add FK constraints if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='FK_complaints_deviations_users_AssignedToUserId'
  ) THEN
    ALTER TABLE complaints_deviations
      ADD CONSTRAINT "FK_complaints_deviations_users_AssignedToUserId"
      FOREIGN KEY ("AssignedToUserId") REFERENCES users("UserId") ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='FK_complaints_deviations_laboratories_LabId'
  ) THEN
    ALTER TABLE complaints_deviations
      ADD CONSTRAINT "FK_complaints_deviations_laboratories_LabId"
      FOREIGN KEY ("LabId") REFERENCES laboratories("LabId") ON DELETE RESTRICT;
  END IF;
END $$;

-- Insert the migration history entry
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260523200000_Sprint1_QualityEvents_OosPhase2', '8.0.0')
ON CONFLICT DO NOTHING;

SELECT 'Sprint 1 Migration applied successfully.' AS result;
