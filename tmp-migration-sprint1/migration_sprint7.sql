-- Sprint 7: Batch Release tables

CREATE TABLE IF NOT EXISTS batch_releases (
  "BatchReleaseId"       SERIAL PRIMARY KEY,
  "SampleId"             INTEGER NOT NULL REFERENCES samples("SampleId") ON DELETE RESTRICT,
  "Status"               VARCHAR(20) NOT NULL DEFAULT 'PendingReview',
  "Decision"             VARCHAR(20) NULL,
  "DecisionReason"       TEXT NULL,
  "SignatureId"          INTEGER NULL REFERENCES electronic_signatures("SignatureId") ON DELETE RESTRICT,
  "ChecklistJson"        JSONB NULL,
  "InitiatedByUserId"    INTEGER NOT NULL REFERENCES users("UserId") ON DELETE RESTRICT,
  "ReviewedByUserId"     INTEGER NULL REFERENCES users("UserId") ON DELETE RESTRICT,
  "InitiatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "DecidedAt"            TIMESTAMPTZ NULL,
  "CreatedBy"            VARCHAR(100) NOT NULL DEFAULT '',
  "CreatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IX_batch_releases_SampleId" ON batch_releases("SampleId");

CREATE TABLE IF NOT EXISTS batch_release_check_items (
  "CheckItemId"          SERIAL PRIMARY KEY,
  "BatchReleaseId"       INTEGER NOT NULL REFERENCES batch_releases("BatchReleaseId") ON DELETE CASCADE,
  "CheckType"            VARCHAR(50) NOT NULL,
  "Passed"               BOOLEAN NOT NULL DEFAULT FALSE,
  "Detail"               VARCHAR(500) NOT NULL DEFAULT '',
  "EvaluatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IX_batch_release_check_items_BatchReleaseId" ON batch_release_check_items("BatchReleaseId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260523210000_Sprint7_BatchRelease', '8.0.0')
ON CONFLICT DO NOTHING;

SELECT 'Sprint 7 Batch Release migration applied.' AS result;
