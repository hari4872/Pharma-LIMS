using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    public partial class Add_SuperAdmin_Tables : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "super_admin_feature_flags",
                columns: table => new
                {
                    Key       = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsEnabled = table.Column<bool>(nullable: false, defaultValue: true),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false, defaultValue: "system"),
                    UpdatedAt = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_super_admin_feature_flags", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "role_module_visibility",
                columns: table => new
                {
                    Id                   = table.Column<int>(nullable: false)
                                               .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Role                 = table.Column<string>(type: "character varying(50)",  maxLength: 50,  nullable: false),
                    NavKey               = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsEnabled            = table.Column<bool>(nullable: false, defaultValue: true),
                    IsLockedBySuperAdmin = table.Column<bool>(nullable: false, defaultValue: false),
                    UpdatedBy            = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false, defaultValue: "system"),
                    UpdatedAt            = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_module_visibility", x => x.Id);
                    table.UniqueConstraint("UQ_role_module_visibility_Role_NavKey", x => new { x.Role, x.NavKey });
                });

            // Seed default feature flags
            migrationBuilder.InsertData(
                table: "super_admin_feature_flags",
                columns: new[] { "Key", "IsEnabled", "UpdatedBy" },
                values: new object[,]
                {
                    { "ff.srf",       true,  "system" },
                    { "ff.esign",     true,  "system" },
                    { "ff.coa",       true,  "system" },
                    { "ff.oos",       true,  "system" },
                    { "ff.stability", false, "system" },
                    { "ff.multisite", false, "system" },
                    { "ff.capacity",  true,  "system" },
                    { "ff.logbook",   true,  "system" },
                });

            // Seed SuperAdmin platform user
            // Initial password: Admin@123 (BCrypt work factor 11)
            // ⚠️ CHANGE THIS PASSWORD immediately after first login
            migrationBuilder.Sql(@"
INSERT INTO users
    (""Username"", ""FullName"", ""Email"", ""PasswordHash"", ""Role"", ""UserType"",
     ""LabId"", ""IsActive"", ""IsTenantAdmin"", ""CreatedBy"", ""CreatedAt"")
VALUES
    ('superadmin', 'WebSynergies SuperAdmin', 'superadmin@websynergies.com',
     '$2a$11$Vkjo80P9i//53kaOa0X9V..L7fkVCw4/4wl8MHuoPyYZJK8MEDAPK',
     'SuperAdmin', 'Admin', NULL, true, false, 'system', NOW())
ON CONFLICT (""Username"") DO UPDATE SET
    ""Role""      = EXCLUDED.""Role"",
    ""IsActive""  = EXCLUDED.""IsActive"";
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "role_module_visibility");
            migrationBuilder.DropTable(name: "super_admin_feature_flags");
        }
    }
}
