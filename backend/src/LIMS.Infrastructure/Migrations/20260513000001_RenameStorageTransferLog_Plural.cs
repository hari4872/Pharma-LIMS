using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameStorageTransferLog_Plural : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fix: storage_transfer_log (singular) → storage_transfer_logs (plural)
            // Aligns with all other log tables: barcode_print_logs, tat_breach_logs, etc.
            migrationBuilder.RenameTable(
                name: "storage_transfer_log",
                newName: "storage_transfer_logs");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "storage_transfer_logs",
                newName: "storage_transfer_log");
        }
    }
}
