using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_LabVantage_Parity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FailedLoginCount",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastLoginAt",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastLoginIp",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LockedUntil",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AmendmentReason",
                table: "digital_logbook_entries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AmendmentSignatureId",
                table: "digital_logbook_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LoginAuditLogs",
                columns: table => new
                {
                    LoginAuditLogId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    IpAddress = table.Column<string>(type: "text", nullable: false),
                    UserAgent = table.Column<string>(type: "text", nullable: true),
                    Outcome = table.Column<string>(type: "text", nullable: false),
                    AttemptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginAuditLogs", x => x.LoginAuditLogId);
                    table.ForeignKey(
                        name: "FK_LoginAuditLogs_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "SampleContainers",
                columns: table => new
                {
                    SampleContainerId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    ParentSampleContainerId = table.Column<int>(type: "integer", nullable: true),
                    ParentContainerSampleContainerId = table.Column<int>(type: "integer", nullable: true),
                    ContainerLabel = table.Column<string>(type: "text", nullable: false),
                    ContainerType = table.Column<string>(type: "text", nullable: false),
                    Volume = table.Column<decimal>(type: "numeric", nullable: true),
                    VolumeUom = table.Column<string>(type: "text", nullable: true),
                    StorageLocationId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DestroyedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DestroyedBy = table.Column<string>(type: "text", nullable: true),
                    DestructionSignatureId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SampleContainers", x => x.SampleContainerId);
                    table.ForeignKey(
                        name: "FK_SampleContainers_SampleContainers_ParentContainerSampleCont~",
                        column: x => x.ParentContainerSampleContainerId,
                        principalTable: "SampleContainers",
                        principalColumn: "SampleContainerId");
                    table.ForeignKey(
                        name: "FK_SampleContainers_electronic_signatures_DestructionSignature~",
                        column: x => x.DestructionSignatureId,
                        principalTable: "electronic_signatures",
                        principalColumn: "SignatureId");
                    table.ForeignKey(
                        name: "FK_SampleContainers_samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SampleContainers_storage_locations_StorageLocationId",
                        column: x => x.StorageLocationId,
                        principalTable: "storage_locations",
                        principalColumn: "LocationId");
                });

            migrationBuilder.CreateTable(
                name: "StabilityTrendPoints",
                columns: table => new
                {
                    StabilityTrendPointId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProtocolId = table.Column<int>(type: "integer", nullable: false),
                    ParameterId = table.Column<int>(type: "integer", nullable: false),
                    StorageCondition = table.Column<string>(type: "text", nullable: false),
                    TimePointMonths = table.Column<int>(type: "integer", nullable: false),
                    MeasuredValue = table.Column<decimal>(type: "numeric", nullable: false),
                    PullId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StabilityTrendPoints", x => x.StabilityTrendPointId);
                    table.ForeignKey(
                        name: "FK_StabilityTrendPoints_stability_protocols_ProtocolId",
                        column: x => x.ProtocolId,
                        principalTable: "stability_protocols",
                        principalColumn: "StabilityProtocolId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StabilityTrendPoints_stability_pulls_PullId",
                        column: x => x.PullId,
                        principalTable: "stability_pulls",
                        principalColumn: "PullId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StabilityTrendPoints_test_method_parameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "test_method_parameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_digital_logbook_entries_AmendmentSignatureId",
                table: "digital_logbook_entries",
                column: "AmendmentSignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_LoginAuditLogs_UserId",
                table: "LoginAuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SampleContainers_DestructionSignatureId",
                table: "SampleContainers",
                column: "DestructionSignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_SampleContainers_ParentContainerSampleContainerId",
                table: "SampleContainers",
                column: "ParentContainerSampleContainerId");

            migrationBuilder.CreateIndex(
                name: "IX_SampleContainers_SampleId",
                table: "SampleContainers",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_SampleContainers_StorageLocationId",
                table: "SampleContainers",
                column: "StorageLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_StabilityTrendPoints_ParameterId",
                table: "StabilityTrendPoints",
                column: "ParameterId");

            migrationBuilder.CreateIndex(
                name: "IX_StabilityTrendPoints_ProtocolId",
                table: "StabilityTrendPoints",
                column: "ProtocolId");

            migrationBuilder.CreateIndex(
                name: "IX_StabilityTrendPoints_PullId",
                table: "StabilityTrendPoints",
                column: "PullId");

            migrationBuilder.AddForeignKey(
                name: "FK_digital_logbook_entries_electronic_signatures_AmendmentSign~",
                table: "digital_logbook_entries",
                column: "AmendmentSignatureId",
                principalTable: "electronic_signatures",
                principalColumn: "SignatureId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_digital_logbook_entries_electronic_signatures_AmendmentSign~",
                table: "digital_logbook_entries");

            migrationBuilder.DropTable(
                name: "LoginAuditLogs");

            migrationBuilder.DropTable(
                name: "SampleContainers");

            migrationBuilder.DropTable(
                name: "StabilityTrendPoints");

            migrationBuilder.DropIndex(
                name: "IX_digital_logbook_entries_AmendmentSignatureId",
                table: "digital_logbook_entries");

            migrationBuilder.DropColumn(
                name: "FailedLoginCount",
                table: "users");

            migrationBuilder.DropColumn(
                name: "LastLoginAt",
                table: "users");

            migrationBuilder.DropColumn(
                name: "LastLoginIp",
                table: "users");

            migrationBuilder.DropColumn(
                name: "LockedUntil",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AmendmentReason",
                table: "digital_logbook_entries");

            migrationBuilder.DropColumn(
                name: "AmendmentSignatureId",
                table: "digital_logbook_entries");
        }
    }
}
