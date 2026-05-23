-- Sprint 10: Workflow Engine + Stability Expansion
-- workflow_templates
CREATE TABLE IF NOT EXISTS workflow_templates (
    "WorkflowTemplateId" SERIAL PRIMARY KEY,
    "Name"               VARCHAR(200) NOT NULL,
    "Description"        VARCHAR(1000),
    "MaterialId"         INT REFERENCES materials("MaterialId") ON DELETE SET NULL,
    "SampleTypeId"       INT REFERENCES sample_types("SampleTypeId") ON DELETE SET NULL,
    "IsDefault"          BOOLEAN NOT NULL DEFAULT FALSE,
    "IsActive"           BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedBy"          VARCHAR(100) NOT NULL,
    "CreatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedBy"          VARCHAR(100),
    "UpdatedAt"          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_workflow_templates_material_sampletype
    ON workflow_templates("MaterialId", "SampleTypeId");

-- workflow_steps
CREATE TABLE IF NOT EXISTS workflow_steps (
    "WorkflowStepId"        SERIAL PRIMARY KEY,
    "WorkflowTemplateId"    INT NOT NULL REFERENCES workflow_templates("WorkflowTemplateId") ON DELETE CASCADE,
    "StepOrder"             INT NOT NULL,
    "StepName"              VARCHAR(200) NOT NULL,
    "RequiredRole"          VARCHAR(50) NOT NULL DEFAULT 'Analyst',
    "RequiresESignature"    BOOLEAN NOT NULL DEFAULT FALSE,
    "MinTestsRequired"      INT,
    "GateCondition"         VARCHAR(100),
    "IsOptional"            BOOLEAN NOT NULL DEFAULT FALSE,
    "Notes"                 VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS ix_workflow_steps_template
    ON workflow_steps("WorkflowTemplateId");

-- Stability expansion: intended shelf life
ALTER TABLE stability_protocols
    ADD COLUMN IF NOT EXISTS "IntendedShelfLifeMonths" INT;

-- Record migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260523220000_Sprint10_WorkflowEngine_StabilityExpansion', '8.0.0')
ON CONFLICT DO NOTHING;
