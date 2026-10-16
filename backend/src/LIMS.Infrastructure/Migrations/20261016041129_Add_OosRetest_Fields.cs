using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_OosRetest_Fields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OosInvestigationId",
                table: "test_executions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RetestOfExecutionId",
                table: "test_executions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaskType",
                table: "test_executions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ResolutionType",
                table: "oos_investigations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RetestExecutionId",
                table: "oos_investigations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SampleId",
                table: "capacity_bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "instrument_import_logs",
                columns: table => new
                {
                    ImportLogId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ExecutionId = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    TotalRows = table.Column<int>(type: "integer", nullable: false),
                    MatchedRows = table.Column<int>(type: "integer", nullable: false),
                    SkippedRows = table.Column<int>(type: "integer", nullable: false),
                    ImportedByUserId = table.Column<int>(type: "integer", nullable: false),
                    ImportedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_instrument_import_logs", x => x.ImportLogId);
                    table.ForeignKey(
                        name: "FK_instrument_import_logs_test_executions_ExecutionId",
                        column: x => x.ExecutionId,
                        principalTable: "test_executions",
                        principalColumn: "ExecutionId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_instrument_import_logs_users_ImportedByUserId",
                        column: x => x.ImportedByUserId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "role_module_visibility",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    NavKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsLockedBySuperAdmin = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_module_visibility", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "super_admin_feature_flags",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_super_admin_feature_flags", x => x.Key);
                });

            migrationBuilder.CreateIndex(
                name: "IX_test_executions_OosInvestigationId",
                table: "test_executions",
                column: "OosInvestigationId");

            migrationBuilder.CreateIndex(
                name: "IX_test_executions_RetestOfExecutionId",
                table: "test_executions",
                column: "RetestOfExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_oos_investigations_RetestExecutionId",
                table: "oos_investigations",
                column: "RetestExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_capacity_bookings_SampleId",
                table: "capacity_bookings",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_instrument_import_logs_ExecutionId",
                table: "instrument_import_logs",
                column: "ExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_instrument_import_logs_ImportedByUserId",
                table: "instrument_import_logs",
                column: "ImportedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_role_module_visibility_Role_NavKey",
                table: "role_module_visibility",
                columns: new[] { "Role", "NavKey" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_capacity_bookings_samples_SampleId",
                table: "capacity_bookings",
                column: "SampleId",
                principalTable: "samples",
                principalColumn: "SampleId");

            migrationBuilder.AddForeignKey(
                name: "FK_oos_investigations_test_executions_RetestExecutionId",
                table: "oos_investigations",
                column: "RetestExecutionId",
                principalTable: "test_executions",
                principalColumn: "ExecutionId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_test_executions_oos_investigations_OosInvestigationId",
                table: "test_executions",
                column: "OosInvestigationId",
                principalTable: "oos_investigations",
                principalColumn: "InvestigationId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_test_executions_test_executions_RetestOfExecutionId",
                table: "test_executions",
                column: "RetestOfExecutionId",
                principalTable: "test_executions",
                principalColumn: "ExecutionId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_capacity_bookings_samples_SampleId",
                table: "capacity_bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_oos_investigations_test_executions_RetestExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropForeignKey(
                name: "FK_test_executions_oos_investigations_OosInvestigationId",
                table: "test_executions");

            migrationBuilder.DropForeignKey(
                name: "FK_test_executions_test_executions_RetestOfExecutionId",
                table: "test_executions");

            migrationBuilder.DropTable(
                name: "instrument_import_logs");

            migrationBuilder.DropTable(
                name: "role_module_visibility");

            migrationBuilder.DropTable(
                name: "super_admin_feature_flags");

            migrationBuilder.DropIndex(
                name: "IX_test_executions_OosInvestigationId",
                table: "test_executions");

            migrationBuilder.DropIndex(
                name: "IX_test_executions_RetestOfExecutionId",
                table: "test_executions");

            migrationBuilder.DropIndex(
                name: "IX_oos_investigations_RetestExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropIndex(
                name: "IX_capacity_bookings_SampleId",
                table: "capacity_bookings");

            migrationBuilder.DropColumn(
                name: "OosInvestigationId",
                table: "test_executions");

            migrationBuilder.DropColumn(
                name: "RetestOfExecutionId",
                table: "test_executions");

            migrationBuilder.DropColumn(
                name: "TaskType",
                table: "test_executions");

            migrationBuilder.DropColumn(
                name: "ResolutionType",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "RetestExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "SampleId",
                table: "capacity_bookings");
        }
    }
}
