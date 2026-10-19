using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_EM_Fields_To_Checkpoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "checkpoints",
                type: "text",
                nullable: false,
                defaultValue: "Batch");

            migrationBuilder.AddColumn<DateOnly>(
                name: "ScheduledDate",
                table: "checkpoints",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SystemName",
                table: "checkpoints",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Category",
                table: "checkpoints");

            migrationBuilder.DropColumn(
                name: "ScheduledDate",
                table: "checkpoints");

            migrationBuilder.DropColumn(
                name: "SystemName",
                table: "checkpoints");
        }
    }
}
