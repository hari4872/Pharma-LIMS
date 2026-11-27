using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    public partial class Add_CheckpointDailyReview : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "checkpoint_daily_reviews",
                columns: table => new
                {
                    checkpoint_daily_review_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    checkpoint_id = table.Column<int>(type: "integer", nullable: false),
                    review_date = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Approved"),
                    comments = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    reviewed_by = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    signature_id = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_checkpoint_daily_reviews", x => x.checkpoint_daily_review_id);
                    table.ForeignKey(
                        name: "fk_checkpoint_daily_reviews_checkpoints_checkpoint_id",
                        column: x => x.checkpoint_id,
                        principalTable: "checkpoints",
                        principalColumn: "checkpoint_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_checkpoint_daily_reviews_electronic_signatures_signature_id",
                        column: x => x.signature_id,
                        principalTable: "electronic_signatures",
                        principalColumn: "signature_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_checkpoint_daily_reviews_checkpoint_id_review_date",
                table: "checkpoint_daily_reviews",
                columns: new[] { "checkpoint_id", "review_date" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "checkpoint_daily_reviews");
        }
    }
}
