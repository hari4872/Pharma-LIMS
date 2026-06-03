START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN
    DROP VIEW IF EXISTS vw_active_spec_limits;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN
    ALTER TABLE test_method_parameters ALTER COLUMN "ColumnFrequency" TYPE text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN
    ALTER TABLE test_method_parameters ADD "DecimalPlaces" integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN
    ALTER TABLE spec_limits ALTER COLUMN "RegulatoryTier" TYPE text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN
    ALTER TABLE samples ADD "RetestOfSampleId" integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN
    ALTER TABLE samples ADD "RetestReason" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN
    ALTER TABLE form_template_parameters ALTER COLUMN "ColumnFrequency" TYPE text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN

    CREATE OR REPLACE VIEW vw_active_spec_limits AS
    SELECT
        s."SpecLimitId",
        s."ParameterId",
        p."ParameterName",
        p."ParameterCode",
        p."Uom",
        s."MaterialId",
        m."MaterialName",
        s."Stage",
        s."MinValue",
        s."MaxValue",
        s."OotMinValue",
        s."OotMaxValue",
        s."RegulatoryTier",
        s."RegulatoryMin",
        s."RegulatoryMax",
        s."Version",
        s."ApprovedAt",
        s."ApprovedBy"
    FROM spec_limits s
    JOIN test_method_parameters p ON s."ParameterId" = p."ParameterId"
    JOIN materials m              ON s."MaterialId"  = m."MaterialId"
    WHERE s."Status" = 'Approved'
      AND s."IsActive" = TRUE;

    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531132157_Add_DecimalPlaces_And_Retest') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260531132157_Add_DecimalPlaces_And_Retest', '8.0.15');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531145259_Add_AdHoc_Fields_To_TestExecution') THEN
    ALTER TABLE test_executions ADD "AdHocReason" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531145259_Add_AdHoc_Fields_To_TestExecution') THEN
    ALTER TABLE test_executions ADD "IsAdHoc" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531145259_Add_AdHoc_Fields_To_TestExecution') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260531145259_Add_AdHoc_Fields_To_TestExecution', '8.0.15');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531151720_Add_SampleId_To_ProcessLogRow') THEN
    ALTER TABLE process_log_rows ADD "SampleId" integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531151720_Add_SampleId_To_ProcessLogRow') THEN
    CREATE INDEX "IX_process_log_rows_SampleId" ON process_log_rows ("SampleId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531151720_Add_SampleId_To_ProcessLogRow') THEN
    ALTER TABLE process_log_rows ADD CONSTRAINT "FK_process_log_rows_samples_SampleId" FOREIGN KEY ("SampleId") REFERENCES samples ("SampleId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260531151720_Add_SampleId_To_ProcessLogRow') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260531151720_Add_SampleId_To_ProcessLogRow', '8.0.15');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260602000001_Add_CustomPermissionsJson_To_User') THEN
    ALTER TABLE "users" ADD "CustomPermissionsJson" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260602000001_Add_CustomPermissionsJson_To_User') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260602000001_Add_CustomPermissionsJson_To_User', '8.0.15');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260602000002_Add_Instrument_Fields') THEN
    ALTER TABLE instruments ADD "InstrumentName" text;
    ALTER TABLE instruments ADD "Manufacturer" text;
    ALTER TABLE instruments ADD "Location" text;
    ALTER TABLE instruments ADD "LastCalibration" date;
    ALTER TABLE specification_templates ADD "CompendialStandard" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260602000002_Add_Instrument_Fields') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260602000002_Add_Instrument_Fields', '8.0.15');
    END IF;
END $EF$;
COMMIT;

