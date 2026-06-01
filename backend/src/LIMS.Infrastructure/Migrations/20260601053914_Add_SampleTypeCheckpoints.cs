using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_SampleTypeCheckpoints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SampleTypeCheckpoints",
                columns: table => new
                {
                    SampleTypeCheckpointId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleTypeId = table.Column<int>(type: "integer", nullable: false),
                    CheckpointId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SampleTypeCheckpoints", x => x.SampleTypeCheckpointId);
                    table.ForeignKey(
                        name: "FK_SampleTypeCheckpoints_checkpoints_CheckpointId",
                        column: x => x.CheckpointId,
                        principalTable: "checkpoints",
                        principalColumn: "CheckpointId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SampleTypeCheckpoints_sample_types_SampleTypeId",
                        column: x => x.SampleTypeId,
                        principalTable: "sample_types",
                        principalColumn: "SampleTypeId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SampleTypeCheckpoints_CheckpointId",
                table: "SampleTypeCheckpoints",
                column: "CheckpointId");

            migrationBuilder.CreateIndex(
                name: "IX_SampleTypeCheckpoints_SampleTypeId",
                table: "SampleTypeCheckpoints",
                column: "SampleTypeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SampleTypeCheckpoints");
        }
    }
}
