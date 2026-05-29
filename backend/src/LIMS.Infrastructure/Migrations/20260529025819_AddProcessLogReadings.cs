using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProcessLogReadings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProcessLogReadings",
                columns: table => new
                {
                    ReadingId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RowId = table.Column<int>(type: "integer", nullable: false),
                    ParameterId = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessLogReadings", x => x.ReadingId);
                    table.ForeignKey(
                        name: "FK_ProcessLogReadings_process_log_rows_RowId",
                        column: x => x.RowId,
                        principalTable: "process_log_rows",
                        principalColumn: "RowId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProcessLogReadings_test_method_parameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "test_method_parameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProcessLogReadings_ParameterId",
                table: "ProcessLogReadings",
                column: "ParameterId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessLogReadings_RowId",
                table: "ProcessLogReadings",
                column: "RowId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProcessLogReadings");
        }
    }
}
