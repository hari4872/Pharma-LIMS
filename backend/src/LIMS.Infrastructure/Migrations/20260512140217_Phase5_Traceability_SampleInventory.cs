using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase5_Traceability_SampleInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "complaints_deviations",
                columns: table => new
                {
                    CdId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    CdType = table.Column<string>(type: "text", nullable: false),
                    CdReference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OpenedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    OpenedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    LinkedOosId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_complaints_deviations", x => x.CdId);
                    table.ForeignKey(
                        name: "FK_complaints_deviations_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_complaints_deviations_oos_investigations_LinkedOosId",
                        column: x => x.LinkedOosId,
                        principalTable: "oos_investigations",
                        principalColumn: "InvestigationId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sampling_events",
                columns: table => new
                {
                    SamplingEventId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    SampledById = table.Column<int>(type: "integer", nullable: false),
                    SampledAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    Location = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    QuantityTaken = table.Column<decimal>(type: "numeric(10,3)", nullable: true),
                    QuantityUom = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ContainerId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sampling_events", x => x.SamplingEventId);
                    table.ForeignKey(
                        name: "FK_sampling_events_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_sampling_events_Users_SampledById",
                        column: x => x.SampledById,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stability_pulls",
                columns: table => new
                {
                    PullId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    TimePoint = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RequiredQty = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    RequiredQtyUom = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ExecutedById = table.Column<int>(type: "integer", nullable: true),
                    PulledAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    ActualQty = table.Column<decimal>(type: "numeric(10,3)", nullable: true),
                    SignatureId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stability_pulls", x => x.PullId);
                    table.ForeignKey(
                        name: "FK_stability_pulls_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stability_pulls_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stability_pulls_Users_ExecutedById",
                        column: x => x.ExecutedById,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "storage_locations",
                columns: table => new
                {
                    LocationId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LabId = table.Column<int>(type: "integer", nullable: false),
                    LocationCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LocationName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LocationType = table.Column<string>(type: "text", nullable: false),
                    TempMinC = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TempMaxC = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    HumidityMinPct = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    HumidityMaxPct = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    LowStockThreshold = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_storage_locations", x => x.LocationId);
                    table.ForeignKey(
                        name: "FK_storage_locations_Laboratories_LabId",
                        column: x => x.LabId,
                        principalTable: "Laboratories",
                        principalColumn: "LabId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "trace_query_logs",
                columns: table => new
                {
                    LogId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    QueriedById = table.Column<int>(type: "integer", nullable: false),
                    QueriedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    FilterParams = table.Column<string>(type: "jsonb", nullable: false),
                    ResultCount = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trace_query_logs", x => x.LogId);
                    table.ForeignKey(
                        name: "FK_trace_query_logs_Users_QueriedById",
                        column: x => x.QueriedById,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "short_pull_deviations",
                columns: table => new
                {
                    DeviationId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PullId = table.Column<int>(type: "integer", nullable: false),
                    RequiredQty = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    ActualQty = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    Shortfall = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    LoggedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LoggedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_short_pull_deviations", x => x.DeviationId);
                    table.ForeignKey(
                        name: "FK_short_pull_deviations_stability_pulls_PullId",
                        column: x => x.PullId,
                        principalTable: "stability_pulls",
                        principalColumn: "PullId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "condition_excursions",
                columns: table => new
                {
                    ExcursionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LocationId = table.Column<int>(type: "integer", nullable: false),
                    ExcursionType = table.Column<string>(type: "text", nullable: false),
                    MeasuredValue = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    LimitExceeded = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ExcursionStart = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ExcursionEnd = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    RecordedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ImpactAssessed = table.Column<bool>(type: "boolean", nullable: false),
                    ImpactOutcome = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_condition_excursions", x => x.ExcursionId);
                    table.ForeignKey(
                        name: "FK_condition_excursions_storage_locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "storage_locations",
                        principalColumn: "LocationId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "retain_samples",
                columns: table => new
                {
                    RetainId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    LocationId = table.Column<int>(type: "integer", nullable: false),
                    LotNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    QuantityUom = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RetainedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    RetentionDueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RetainedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DestroyedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    DestroyedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DestructionSignatureId = table.Column<int>(type: "integer", nullable: true),
                    DestructionReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_retain_samples", x => x.RetainId);
                    table.ForeignKey(
                        name: "FK_retain_samples_ElectronicSignatures_DestructionSignatureId",
                        column: x => x.DestructionSignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_retain_samples_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_retain_samples_storage_locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "storage_locations",
                        principalColumn: "LocationId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "storage_transfer_log",
                columns: table => new
                {
                    TransferId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    FromLocationId = table.Column<int>(type: "integer", nullable: false),
                    ToLocationId = table.Column<int>(type: "integer", nullable: false),
                    TransferredBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TransferredAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_storage_transfer_log", x => x.TransferId);
                    table.ForeignKey(
                        name: "FK_storage_transfer_log_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_storage_transfer_log_storage_locations_FromLocationId",
                        column: x => x.FromLocationId,
                        principalTable: "storage_locations",
                        principalColumn: "LocationId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_storage_transfer_log_storage_locations_ToLocationId",
                        column: x => x.ToLocationId,
                        principalTable: "storage_locations",
                        principalColumn: "LocationId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "excursion_affected_samples",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ExcursionId = table.Column<int>(type: "integer", nullable: false),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    FlaggedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    FlaggedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_excursion_affected_samples", x => x.Id);
                    table.ForeignKey(
                        name: "FK_excursion_affected_samples_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_excursion_affected_samples_condition_excursions_ExcursionId",
                        column: x => x.ExcursionId,
                        principalTable: "condition_excursions",
                        principalColumn: "ExcursionId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_complaints_deviations_CdReference",
                table: "complaints_deviations",
                column: "CdReference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_complaints_deviations_LinkedOosId",
                table: "complaints_deviations",
                column: "LinkedOosId");

            migrationBuilder.CreateIndex(
                name: "IX_complaints_deviations_SampleId",
                table: "complaints_deviations",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_condition_excursions_LocationId",
                table: "condition_excursions",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_excursion_affected_samples_ExcursionId_SampleId",
                table: "excursion_affected_samples",
                columns: new[] { "ExcursionId", "SampleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_excursion_affected_samples_SampleId",
                table: "excursion_affected_samples",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_retain_samples_DestructionSignatureId",
                table: "retain_samples",
                column: "DestructionSignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_retain_samples_LocationId",
                table: "retain_samples",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_retain_samples_SampleId",
                table: "retain_samples",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_sampling_events_SampledById",
                table: "sampling_events",
                column: "SampledById");

            migrationBuilder.CreateIndex(
                name: "IX_sampling_events_SampleId",
                table: "sampling_events",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_short_pull_deviations_PullId",
                table: "short_pull_deviations",
                column: "PullId");

            migrationBuilder.CreateIndex(
                name: "IX_stability_pulls_ExecutedById",
                table: "stability_pulls",
                column: "ExecutedById");

            migrationBuilder.CreateIndex(
                name: "IX_stability_pulls_SampleId_TimePoint",
                table: "stability_pulls",
                columns: new[] { "SampleId", "TimePoint" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stability_pulls_SignatureId",
                table: "stability_pulls",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_storage_locations_LabId",
                table: "storage_locations",
                column: "LabId");

            migrationBuilder.CreateIndex(
                name: "IX_storage_locations_LocationCode",
                table: "storage_locations",
                column: "LocationCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_storage_transfer_log_FromLocationId",
                table: "storage_transfer_log",
                column: "FromLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_storage_transfer_log_SampleId",
                table: "storage_transfer_log",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_storage_transfer_log_ToLocationId",
                table: "storage_transfer_log",
                column: "ToLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_trace_query_logs_QueriedById",
                table: "trace_query_logs",
                column: "QueriedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "complaints_deviations");

            migrationBuilder.DropTable(
                name: "excursion_affected_samples");

            migrationBuilder.DropTable(
                name: "retain_samples");

            migrationBuilder.DropTable(
                name: "sampling_events");

            migrationBuilder.DropTable(
                name: "short_pull_deviations");

            migrationBuilder.DropTable(
                name: "storage_transfer_log");

            migrationBuilder.DropTable(
                name: "trace_query_logs");

            migrationBuilder.DropTable(
                name: "condition_excursions");

            migrationBuilder.DropTable(
                name: "stability_pulls");

            migrationBuilder.DropTable(
                name: "storage_locations");
        }
    }
}
