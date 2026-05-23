-- MS-2: Inter-site Sample Transfer
-- Applied: 2026-05-23
-- Migration ID: 20260523230000_MS2_SampleTransfers

CREATE TABLE IF NOT EXISTS sample_transfers (
    "SampleTransferId"     SERIAL PRIMARY KEY,
    "SampleId"             INT NOT NULL REFERENCES samples("SampleId"),
    "FromLabId"            INT NOT NULL REFERENCES laboratories("LabId"),
    "ToLabId"              INT NOT NULL REFERENCES laboratories("LabId"),
    "TransferReason"       VARCHAR(500) NOT NULL,
    "ChainOfCustodyNote"   VARCHAR(1000),
    "Status"               VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "RequestedBy"          VARCHAR(200) NOT NULL,
    "RequestedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "RespondedBy"          VARCHAR(200),
    "RespondedAt"          TIMESTAMPTZ,
    "ResponseNote"         VARCHAR(500),
    "ReceivedBy"           VARCHAR(200),
    "ReceivedAt"           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_sample_transfers_sample_id  ON sample_transfers("SampleId");
CREATE INDEX IF NOT EXISTS ix_sample_transfers_status     ON sample_transfers("Status");
CREATE INDEX IF NOT EXISTS ix_sample_transfers_from_lab   ON sample_transfers("FromLabId");
CREATE INDEX IF NOT EXISTS ix_sample_transfers_to_lab     ON sample_transfers("ToLabId");
CREATE INDEX IF NOT EXISTS ix_sample_transfers_requested  ON sample_transfers("RequestedAt" DESC);

-- Register migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260523230000_MS2_SampleTransfers', '8.0.0')
ON CONFLICT DO NOTHING;
