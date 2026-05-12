using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase1_MasterData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Laboratories",
                columns: table => new
                {
                    LabId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LabName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Location = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    LabType = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Laboratories", x => x.LabId);
                });

            migrationBuilder.CreateTable(
                name: "MasterDataAuditLogs",
                columns: table => new
                {
                    AuditId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EntityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EntityId = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    OldValue = table.Column<string>(type: "jsonb", nullable: true),
                    NewValue = table.Column<string>(type: "jsonb", nullable: true),
                    PerformedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PerformedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MasterDataAuditLogs", x => x.AuditId);
                });

            migrationBuilder.CreateTable(
                name: "Materials",
                columns: table => new
                {
                    MaterialId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MaterialName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MaterialType = table.Column<string>(type: "text", nullable: false),
                    Uom = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ShelfLifeDays = table.Column<int>(type: "integer", nullable: false),
                    ProductType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Materials", x => x.MaterialId);
                });

            migrationBuilder.CreateTable(
                name: "ParameterLookupTables",
                columns: table => new
                {
                    LookupTableId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LookupCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    InputCol1 = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    InputCol2 = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ResultCol = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParameterLookupTables", x => x.LookupTableId);
                });

            migrationBuilder.CreateTable(
                name: "Instruments",
                columns: table => new
                {
                    InstrumentId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LabId = table.Column<int>(type: "integer", nullable: false),
                    InstrumentCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    InstrumentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Model = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    SerialNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CalibrationDue = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Instruments", x => x.InstrumentId);
                    table.ForeignKey(
                        name: "FK_Instruments_Laboratories_LabId",
                        column: x => x.LabId,
                        principalTable: "Laboratories",
                        principalColumn: "LabId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LabConfigs",
                columns: table => new
                {
                    ConfigId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LabId = table.Column<int>(type: "integer", nullable: false),
                    ConfigKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ConfigValue = table.Column<string>(type: "text", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LabConfigs", x => x.ConfigId);
                    table.ForeignKey(
                        name: "FK_LabConfigs_Laboratories_LabId",
                        column: x => x.LabId,
                        principalTable: "Laboratories",
                        principalColumn: "LabId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UserType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Role = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    LabId = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsTenantAdmin = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_Users_Laboratories_LabId",
                        column: x => x.LabId,
                        principalTable: "Laboratories",
                        principalColumn: "LabId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ParameterLookupRows",
                columns: table => new
                {
                    RowId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LookupTableId = table.Column<int>(type: "integer", nullable: false),
                    InputValue1 = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    InputValue2 = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    ResultValue = table.Column<decimal>(type: "numeric(18,6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParameterLookupRows", x => x.RowId);
                    table.ForeignKey(
                        name: "FK_ParameterLookupRows_ParameterLookupTables_LookupTableId",
                        column: x => x.LookupTableId,
                        principalTable: "ParameterLookupTables",
                        principalColumn: "LookupTableId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ElectronicSignatures",
                columns: table => new
                {
                    SignatureId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SignedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    Meaning = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    ActionType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ElectronicSignatures", x => x.SignatureId);
                    table.ForeignKey(
                        name: "FK_ElectronicSignatures_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CalibrationRecords",
                columns: table => new
                {
                    CalibrationId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InstrumentId = table.Column<int>(type: "integer", nullable: false),
                    CalibrationDate = table.Column<DateOnly>(type: "date", nullable: false),
                    NextCalibrationDue = table.Column<DateOnly>(type: "date", nullable: false),
                    CertificateRef = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PerformedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SignatureId = table.Column<int>(type: "integer", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalibrationRecords", x => x.CalibrationId);
                    table.ForeignKey(
                        name: "FK_CalibrationRecords_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CalibrationRecords_Instruments_InstrumentId",
                        column: x => x.InstrumentId,
                        principalTable: "Instruments",
                        principalColumn: "InstrumentId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FormTemplates",
                columns: table => new
                {
                    FormTemplateId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FormCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FormName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LabId = table.Column<int>(type: "integer", nullable: false),
                    FormType = table.Column<string>(type: "text", nullable: false),
                    TriggerType = table.Column<string>(type: "text", nullable: false),
                    TimeSlots = table.Column<string>(type: "jsonb", nullable: true),
                    ShiftIntervalHrs = table.Column<int>(type: "integer", nullable: true),
                    RegulatoryTier = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    EvidenceMandatory = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    SignatureId = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormTemplates", x => x.FormTemplateId);
                    table.ForeignKey(
                        name: "FK_FormTemplates_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FormTemplates_Laboratories_LabId",
                        column: x => x.LabId,
                        principalTable: "Laboratories",
                        principalColumn: "LabId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InstrumentBreakdowns",
                columns: table => new
                {
                    BreakdownId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InstrumentId = table.Column<int>(type: "integer", nullable: false),
                    RaisedBy = table.Column<int>(type: "integer", nullable: false),
                    RaisedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    IssueDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ReturnSignatureId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InstrumentBreakdowns", x => x.BreakdownId);
                    table.ForeignKey(
                        name: "FK_InstrumentBreakdowns_ElectronicSignatures_ReturnSignatureId",
                        column: x => x.ReturnSignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InstrumentBreakdowns_Instruments_InstrumentId",
                        column: x => x.InstrumentId,
                        principalTable: "Instruments",
                        principalColumn: "InstrumentId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InstrumentBreakdowns_Users_RaisedBy",
                        column: x => x.RaisedBy,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TestMethods",
                columns: table => new
                {
                    MethodId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MethodCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MethodName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SopReference = table.Column<string>(type: "text", nullable: true),
                    MethodType = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    SignatureId = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestMethods", x => x.MethodId);
                    table.ForeignKey(
                        name: "FK_TestMethods_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InstrumentRepairs",
                columns: table => new
                {
                    RepairId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BreakdownId = table.Column<int>(type: "integer", nullable: false),
                    Technician = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RepairDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RepairDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    PartsUsed = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RecordedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InstrumentRepairs", x => x.RepairId);
                    table.ForeignKey(
                        name: "FK_InstrumentRepairs_InstrumentBreakdowns_BreakdownId",
                        column: x => x.BreakdownId,
                        principalTable: "InstrumentBreakdowns",
                        principalColumn: "BreakdownId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TestMethodParameters",
                columns: table => new
                {
                    ParameterId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MethodId = table.Column<int>(type: "integer", nullable: false),
                    ParameterName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ParameterCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Uom = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DataType = table.Column<string>(type: "text", nullable: false),
                    FormulaType = table.Column<string>(type: "text", nullable: false),
                    CalcFormula = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    LookupTableId = table.Column<int>(type: "integer", nullable: true),
                    InstrumentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsCritical = table.Column<bool>(type: "boolean", nullable: false),
                    IsMandatory = table.Column<bool>(type: "boolean", nullable: false),
                    ColumnFrequency = table.Column<int>(type: "integer", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestMethodParameters", x => x.ParameterId);
                    table.ForeignKey(
                        name: "FK_TestMethodParameters_ParameterLookupTables_LookupTableId",
                        column: x => x.LookupTableId,
                        principalTable: "ParameterLookupTables",
                        principalColumn: "LookupTableId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TestMethodParameters_TestMethods_MethodId",
                        column: x => x.MethodId,
                        principalTable: "TestMethods",
                        principalColumn: "MethodId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserTrainingRecords",
                columns: table => new
                {
                    TrainingId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    MethodId = table.Column<int>(type: "integer", nullable: false),
                    TrainingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ValidUntil = table.Column<DateOnly>(type: "date", nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTrainingRecords", x => x.TrainingId);
                    table.ForeignKey(
                        name: "FK_UserTrainingRecords_TestMethods_MethodId",
                        column: x => x.MethodId,
                        principalTable: "TestMethods",
                        principalColumn: "MethodId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserTrainingRecords_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FormTemplateParameters",
                columns: table => new
                {
                    FormTemplateId = table.Column<int>(type: "integer", nullable: false),
                    ParameterId = table.Column<int>(type: "integer", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    ColumnFrequency = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormTemplateParameters", x => new { x.FormTemplateId, x.ParameterId });
                    table.ForeignKey(
                        name: "FK_FormTemplateParameters_FormTemplates_FormTemplateId",
                        column: x => x.FormTemplateId,
                        principalTable: "FormTemplates",
                        principalColumn: "FormTemplateId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FormTemplateParameters_TestMethodParameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "TestMethodParameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SpecLimits",
                columns: table => new
                {
                    SpecLimitId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ParameterId = table.Column<int>(type: "integer", nullable: false),
                    MaterialId = table.Column<int>(type: "integer", nullable: true),
                    Stage = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MinValue = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    MaxValue = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    RegulatoryTier = table.Column<int>(type: "integer", nullable: true),
                    RegulatoryMin = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    RegulatoryMax = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    OotMinValue = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    OotMaxValue = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    SignatureId = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpecLimits", x => x.SpecLimitId);
                    table.ForeignKey(
                        name: "FK_SpecLimits_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SpecLimits_Materials_MaterialId",
                        column: x => x.MaterialId,
                        principalTable: "Materials",
                        principalColumn: "MaterialId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SpecLimits_TestMethodParameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "TestMethodParameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FormTemplateLocations",
                columns: table => new
                {
                    LocationId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FormTemplateId = table.Column<int>(type: "integer", nullable: false),
                    ColumnOrder = table.Column<int>(type: "integer", nullable: false),
                    LocationName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SpecLimitId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormTemplateLocations", x => x.LocationId);
                    table.ForeignKey(
                        name: "FK_FormTemplateLocations_FormTemplates_FormTemplateId",
                        column: x => x.FormTemplateId,
                        principalTable: "FormTemplates",
                        principalColumn: "FormTemplateId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FormTemplateLocations_SpecLimits_SpecLimitId",
                        column: x => x.SpecLimitId,
                        principalTable: "SpecLimits",
                        principalColumn: "SpecLimitId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationRecords_InstrumentId",
                table: "CalibrationRecords",
                column: "InstrumentId");

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationRecords_SignatureId",
                table: "CalibrationRecords",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_ElectronicSignatures_UserId",
                table: "ElectronicSignatures",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FormTemplateLocations_FormTemplateId",
                table: "FormTemplateLocations",
                column: "FormTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_FormTemplateLocations_SpecLimitId",
                table: "FormTemplateLocations",
                column: "SpecLimitId");

            migrationBuilder.CreateIndex(
                name: "IX_FormTemplateParameters_ParameterId",
                table: "FormTemplateParameters",
                column: "ParameterId");

            migrationBuilder.CreateIndex(
                name: "IX_FormTemplates_FormCode",
                table: "FormTemplates",
                column: "FormCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormTemplates_LabId",
                table: "FormTemplates",
                column: "LabId");

            migrationBuilder.CreateIndex(
                name: "IX_FormTemplates_SignatureId",
                table: "FormTemplates",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_InstrumentBreakdowns_InstrumentId",
                table: "InstrumentBreakdowns",
                column: "InstrumentId");

            migrationBuilder.CreateIndex(
                name: "IX_InstrumentBreakdowns_RaisedBy",
                table: "InstrumentBreakdowns",
                column: "RaisedBy");

            migrationBuilder.CreateIndex(
                name: "IX_InstrumentBreakdowns_ReturnSignatureId",
                table: "InstrumentBreakdowns",
                column: "ReturnSignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_InstrumentRepairs_BreakdownId",
                table: "InstrumentRepairs",
                column: "BreakdownId");

            migrationBuilder.CreateIndex(
                name: "IX_Instruments_InstrumentCode",
                table: "Instruments",
                column: "InstrumentCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Instruments_LabId",
                table: "Instruments",
                column: "LabId");

            migrationBuilder.CreateIndex(
                name: "IX_LabConfigs_LabId_ConfigKey",
                table: "LabConfigs",
                columns: new[] { "LabId", "ConfigKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParameterLookupRows_LookupTableId",
                table: "ParameterLookupRows",
                column: "LookupTableId");

            migrationBuilder.CreateIndex(
                name: "IX_ParameterLookupTables_LookupCode",
                table: "ParameterLookupTables",
                column: "LookupCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SpecLimits_MaterialId",
                table: "SpecLimits",
                column: "MaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_SpecLimits_ParameterId",
                table: "SpecLimits",
                column: "ParameterId");

            migrationBuilder.CreateIndex(
                name: "IX_SpecLimits_SignatureId",
                table: "SpecLimits",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_TestMethodParameters_LookupTableId",
                table: "TestMethodParameters",
                column: "LookupTableId");

            migrationBuilder.CreateIndex(
                name: "IX_TestMethodParameters_MethodId",
                table: "TestMethodParameters",
                column: "MethodId");

            migrationBuilder.CreateIndex(
                name: "IX_TestMethods_MethodCode",
                table: "TestMethods",
                column: "MethodCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TestMethods_SignatureId",
                table: "TestMethods",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_LabId",
                table: "Users",
                column: "LabId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserTrainingRecords_MethodId",
                table: "UserTrainingRecords",
                column: "MethodId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTrainingRecords_UserId",
                table: "UserTrainingRecords",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CalibrationRecords");

            migrationBuilder.DropTable(
                name: "FormTemplateLocations");

            migrationBuilder.DropTable(
                name: "FormTemplateParameters");

            migrationBuilder.DropTable(
                name: "InstrumentRepairs");

            migrationBuilder.DropTable(
                name: "LabConfigs");

            migrationBuilder.DropTable(
                name: "MasterDataAuditLogs");

            migrationBuilder.DropTable(
                name: "ParameterLookupRows");

            migrationBuilder.DropTable(
                name: "UserTrainingRecords");

            migrationBuilder.DropTable(
                name: "SpecLimits");

            migrationBuilder.DropTable(
                name: "FormTemplates");

            migrationBuilder.DropTable(
                name: "InstrumentBreakdowns");

            migrationBuilder.DropTable(
                name: "Materials");

            migrationBuilder.DropTable(
                name: "TestMethodParameters");

            migrationBuilder.DropTable(
                name: "Instruments");

            migrationBuilder.DropTable(
                name: "ParameterLookupTables");

            migrationBuilder.DropTable(
                name: "TestMethods");

            migrationBuilder.DropTable(
                name: "ElectronicSignatures");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Laboratories");
        }
    }
}
