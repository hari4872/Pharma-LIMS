using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase3_LaboratorySite_ReagentStandards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Site",
                table: "laboratories",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "reagent_standards",
                columns: table => new
                {
                    ReagentId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ReagentCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ReagentName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ReagentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LotNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Potency = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    PotencyUom = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Manufacturer = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    OpenedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    LinkedMethodId = table.Column<int>(type: "integer", nullable: true),
                    StorageCondition = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reagent_standards", x => x.ReagentId);
                    table.ForeignKey(
                        name: "FK_reagent_standards_test_methods_LinkedMethodId",
                        column: x => x.LinkedMethodId,
                        principalTable: "test_methods",
                        principalColumn: "MethodId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_reagent_standards_LinkedMethodId",
                table: "reagent_standards",
                column: "LinkedMethodId");

            migrationBuilder.CreateIndex(
                name: "IX_reagent_standards_ReagentCode",
                table: "reagent_standards",
                column: "ReagentCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reagent_standards");

            migrationBuilder.DropColumn(
                name: "Site",
                table: "laboratories");
        }
    }
}
