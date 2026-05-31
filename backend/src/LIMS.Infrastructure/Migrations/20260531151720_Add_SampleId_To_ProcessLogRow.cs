using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_SampleId_To_ProcessLogRow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SampleId",
                table: "process_log_rows",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_log_rows_SampleId",
                table: "process_log_rows",
                column: "SampleId");

            migrationBuilder.AddForeignKey(
                name: "FK_process_log_rows_samples_SampleId",
                table: "process_log_rows",
                column: "SampleId",
                principalTable: "samples",
                principalColumn: "SampleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_process_log_rows_samples_SampleId",
                table: "process_log_rows");

            migrationBuilder.DropIndex(
                name: "IX_process_log_rows_SampleId",
                table: "process_log_rows");

            migrationBuilder.DropColumn(
                name: "SampleId",
                table: "process_log_rows");
        }
    }
}
