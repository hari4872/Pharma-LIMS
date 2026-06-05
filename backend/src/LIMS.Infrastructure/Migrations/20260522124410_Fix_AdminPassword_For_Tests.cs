using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Fix_AdminPassword_For_Tests : Migration
    {
        // BCrypt hash of "Admin@123" (work factor 11) — matches Playwright test credentials
        // ⚠️ PRODUCTION ACTION REQUIRED: Change admin password immediately after first deployment
        //    via Settings → Users → Edit → Reset Password, or POST /api/v1/auth/reset-password
        //    Default credential Admin@123 must NOT remain active in production.
        private const string AdminHash = "$2a$11$Vkjo80P9i//53kaOa0X9V..L7fkVCw4/4wl8MHuoPyYZJK8MEDAPK";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ensure the seeded admin user exists with the expected test credentials.
            // UPSERT: if 'admin' already exists, update the hash; otherwise insert it.
            migrationBuilder.Sql($@"
INSERT INTO users
    (""Username"", ""FullName"", ""Email"", ""PasswordHash"", ""Role"", ""UserType"",
     ""LabId"", ""IsActive"", ""IsTenantAdmin"", ""CreatedBy"", ""CreatedAt"")
VALUES
    ('admin', 'System Administrator', 'admin@apexpharma.sg',
     '{AdminHash}',
     'Admin', 'Admin', 1, true, true, 'system', '2026-01-01 00:00:00+00')
ON CONFLICT (""Username"") DO UPDATE SET
    ""PasswordHash""    = EXCLUDED.""PasswordHash"",
    ""UserType""        = EXCLUDED.""UserType"",
    ""Role""            = EXCLUDED.""Role"",
    ""IsTenantAdmin""   = EXCLUDED.""IsTenantAdmin"",
    ""IsActive""        = EXCLUDED.""IsActive"";
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No rollback needed for credential fix
        }
    }
}
