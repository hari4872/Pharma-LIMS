using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    public partial class Patch_CoaApproval_Decision_Length : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Increase Decision from varchar(10) to varchar(20) to accommodate "Conditional"
            migrationBuilder.Sql(@"
                ALTER TABLE coa_approvals ALTER COLUMN ""Decision"" TYPE character varying(20);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE coa_approvals ALTER COLUMN ""Decision"" TYPE character varying(10);
            ");
        }
    }
}
