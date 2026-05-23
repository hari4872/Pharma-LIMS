-- MS-2: Inter-site Sample Transfer
-- Applied: 2026-05-23
-- Migration ID: 20260523230000_MS2_SampleTransfers

CREATE TABLE IF NOT EXISTS sample_transfers (
    sample_transfer_id   SERIAL PRIMARY KEY,
    sample_id            INTEGER NOT NULL REFERENCES samples(sample_id),
    from_lab_id          INTEGER NOT NULL REFERENCES laboratories(lab_id),
    to_lab_id            INTEGER NOT NULL REFERENCES laboratories(lab_id),
    transfer_reason      VARCHAR(500) NOT NULL,
    chain_of_custody_note VARCHAR(1000),
    status               VARCHAR(20) NOT NULL DEFAULT 'Pending',
    requested_by         VARCHAR(200) NOT NULL,
    requested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_by         VARCHAR(200),
    responded_at         TIMESTAMPTZ,
    response_note        VARCHAR(500),
    received_by          VARCHAR(200),
    received_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sample_transfers_sample_id  ON sample_transfers(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_transfers_status     ON sample_transfers(status);
CREATE INDEX IF NOT EXISTS idx_sample_transfers_from_lab   ON sample_transfers(from_lab_id);
CREATE INDEX IF NOT EXISTS idx_sample_transfers_to_lab     ON sample_transfers(to_lab_id);
CREATE INDEX IF NOT EXISTS idx_sample_transfers_requested  ON sample_transfers(requested_at DESC);

-- Register migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260523230000_MS2_SampleTransfers', '8.0.0')
ON CONFLICT DO NOTHING;
