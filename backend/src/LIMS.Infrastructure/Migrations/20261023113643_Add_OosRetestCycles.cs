using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_OosRetestCycles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "oos_retest_cycles",
                columns: table => new
                {
                    CycleId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InvestigationId = table.Column<int>(type: "integer", nullable: false),
                    CycleNumber = table.Column<int>(type: "integer", nullable: false),
                    ExecutionId = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_oos_retest_cycles", x => x.CycleId);
                    table.ForeignKey(
                        name: "FK_oos_retest_cycles_oos_investigations_InvestigationId",
                        column: x => x.InvestigationId,
                        principalTable: "oos_investigations",
                        principalColumn: "InvestigationId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_oos_retest_cycles_test_executions_ExecutionId",
                        column: x => x.ExecutionId,
                        principalTable: "test_executions",
                        principalColumn: "ExecutionId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_oos_retest_cycles_ExecutionId",
                table: "oos_retest_cycles",
                column: "ExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_oos_retest_cycles_InvestigationId",
                table: "oos_retest_cycles",
                column: "InvestigationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "oos_retest_cycles");
        }
    }
}
