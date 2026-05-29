using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Fix_LoginAuditLog_InsertOnly : Migration
    {
        // COMP-1: login_audit_logs was omitted from insert-only trigger set — §11.10(d) compliance gap
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'login_audit_logs')
       AND NOT EXISTS (SELECT 1 FROM information_schema.triggers
                       WHERE trigger_name = 'trg_insert_only_login_audit_logs')
    THEN
        CREATE TRIGGER trg_insert_only_login_audit_logs
            BEFORE UPDATE OR DELETE ON login_audit_logs
            FOR EACH ROW EXECUTE FUNCTION enforce_insert_only();
    END IF;
END;
$$;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS trg_insert_only_login_audit_logs ON login_audit_logs;");
        }
    }
}
