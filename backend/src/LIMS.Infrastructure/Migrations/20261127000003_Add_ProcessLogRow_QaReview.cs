using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    public partial class Add_ProcessLogRow_QaReview : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "qa_status",
                table: "process_log_rows",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Pending");

            migrationBuilder.AddColumn<string>(
                name: "qa_reviewed_by",
                table: "process_log_rows",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "qa_reviewed_at",
                table: "process_log_rows",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "qa_signature_id",
                table: "process_log_rows",
                type: "integer",
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "fk_process_log_rows_electronic_signatures_qa_signature_id",
                table: "process_log_rows",
                column: "qa_signature_id",
                principalTable: "electronic_signatures",
                principalColumn: "signature_id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_process_log_rows_electronic_signatures_qa_signature_id",
                table: "process_log_rows");

            migrationBuilder.DropColumn(name: "qa_status",       table: "process_log_rows");
            migrationBuilder.DropColumn(name: "qa_reviewed_by",  table: "process_log_rows");
            migrationBuilder.DropColumn(name: "qa_reviewed_at",  table: "process_log_rows");
            migrationBuilder.DropColumn(name: "qa_signature_id", table: "process_log_rows");
        }
    }
}
