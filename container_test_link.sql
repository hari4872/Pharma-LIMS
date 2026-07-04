ROLLBACK;
START TRANSACTION;

ALTER TABLE test_executions
    ADD COLUMN IF NOT EXISTS "SampleContainerId" integer
    REFERENCES sample_containers("SampleContainerId") ON DELETE RESTRICT;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260704000000_ContainerTestLink', '8.0.15')
ON CONFLICT ("MigrationId") DO NOTHING;

COMMIT;
