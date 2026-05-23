using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Fix_UserType_Internal_To_RegularUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Seed data used 'Internal' for UserType; current enum only has 'Admin' and 'RegularUser'.
            // Fix all non-Admin users that have the stale 'Internal' value.
            migrationBuilder.Sql(@"UPDATE users SET ""UserType"" = 'RegularUser' WHERE ""UserType"" = 'Internal';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"UPDATE users SET ""UserType"" = 'Internal' WHERE ""UserType"" = 'RegularUser' AND ""Role"" != 'Admin';");
        }
    }
}
