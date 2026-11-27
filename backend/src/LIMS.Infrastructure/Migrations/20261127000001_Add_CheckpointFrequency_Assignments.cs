using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_CheckpointFrequency_Assignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add FrequencyType and FrequencyConfig columns to checkpoints
            migrationBuilder.AddColumn<string>(
                name: "frequency_type",
                table: "checkpoints",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Daily");

            migrationBuilder.AddColumn<string>(
                name: "frequency_config",
                table: "checkpoints",
                type: "text",
                nullable: true);

            // Create checkpoint_assignments table
            migrationBuilder.CreateTable(
                name: "checkpoint_assignments",
                columns: table => new
                {
                    checkpoint_assignment_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    checkpoint_id = table.Column<int>(type: "integer", nullable: false),
                    username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    full_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_checkpoint_assignments", x => x.checkpoint_assignment_id);
                    table.ForeignKey(
                        name: "fk_checkpoint_assignments_checkpoints_checkpoint_id",
                        column: x => x.checkpoint_id,
                        principalTable: "checkpoints",
                        principalColumn: "checkpoint_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_checkpoint_assignments_checkpoint_id_username",
                table: "checkpoint_assignments",
                columns: new[] { "checkpoint_id", "username" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "checkpoint_assignments");
            migrationBuilder.DropColumn(name: "frequency_config", table: "checkpoints");
            migrationBuilder.DropColumn(name: "frequency_type", table: "checkpoints");
        }
    }
}
