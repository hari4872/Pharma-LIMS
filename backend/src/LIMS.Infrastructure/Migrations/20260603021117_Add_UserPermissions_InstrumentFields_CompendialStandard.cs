using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_UserPermissions_InstrumentFields_CompendialStandard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomPermissionsJson",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompendialStandard",
                table: "specification_templates",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InstrumentName",
                table: "instruments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "LastCalibration",
                table: "instruments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "instruments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Manufacturer",
                table: "instruments",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomPermissionsJson",
                table: "users");

            migrationBuilder.DropColumn(
                name: "CompendialStandard",
                table: "specification_templates");

            migrationBuilder.DropColumn(
                name: "InstrumentName",
                table: "instruments");

            migrationBuilder.DropColumn(
                name: "LastCalibration",
                table: "instruments");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "instruments");

            migrationBuilder.DropColumn(
                name: "Manufacturer",
                table: "instruments");
        }
    }
}
