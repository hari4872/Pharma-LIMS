using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_CheckpointParameter_TwoTierLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AlertMin",
                table: "checkpoint_parameters",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AlertMax",
                table: "checkpoint_parameters",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ActionMin",
                table: "checkpoint_parameters",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ActionMax",
                table: "checkpoint_parameters",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "AlertMin",  table: "checkpoint_parameters");
            migrationBuilder.DropColumn(name: "AlertMax",  table: "checkpoint_parameters");
            migrationBuilder.DropColumn(name: "ActionMin", table: "checkpoint_parameters");
            migrationBuilder.DropColumn(name: "ActionMax", table: "checkpoint_parameters");
        }
    }
}
