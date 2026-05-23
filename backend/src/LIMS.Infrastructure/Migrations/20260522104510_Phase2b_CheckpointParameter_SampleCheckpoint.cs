using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase2b_CheckpointParameter_SampleCheckpoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "checkpoint_parameters",
                columns: table => new
                {
                    CheckpointParameterId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CheckpointId = table.Column<int>(type: "integer", nullable: false),
                    ParameterId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_checkpoint_parameters", x => x.CheckpointParameterId);
                    table.ForeignKey(
                        name: "FK_checkpoint_parameters_checkpoints_CheckpointId",
                        column: x => x.CheckpointId,
                        principalTable: "checkpoints",
                        principalColumn: "CheckpointId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_checkpoint_parameters_test_method_parameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "test_method_parameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sample_checkpoints",
                columns: table => new
                {
                    SampleCheckpointId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    CheckpointId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sample_checkpoints", x => x.SampleCheckpointId);
                    table.ForeignKey(
                        name: "FK_sample_checkpoints_checkpoints_CheckpointId",
                        column: x => x.CheckpointId,
                        principalTable: "checkpoints",
                        principalColumn: "CheckpointId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_sample_checkpoints_samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_checkpoint_parameters_CheckpointId_ParameterId",
                table: "checkpoint_parameters",
                columns: new[] { "CheckpointId", "ParameterId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_checkpoint_parameters_ParameterId",
                table: "checkpoint_parameters",
                column: "ParameterId");

            migrationBuilder.CreateIndex(
                name: "IX_sample_checkpoints_CheckpointId",
                table: "sample_checkpoints",
                column: "CheckpointId");

            migrationBuilder.CreateIndex(
                name: "IX_sample_checkpoints_SampleId_CheckpointId",
                table: "sample_checkpoints",
                columns: new[] { "SampleId", "CheckpointId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "checkpoint_parameters");

            migrationBuilder.DropTable(
                name: "sample_checkpoints");
        }
    }
}
