using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Patch_ESignConfig_TestResultMarkComplete : Migration
    {
        // The original ESignConfig seed set TestResult.MarkComplete = 'None'.
        // The intended default is 'PasswordOnly' (analysts must enter password before marking complete).
        // This patch corrects existing DB rows so the runtime default matches the frontend DEFAULTS constant.
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE esign_configs
SET ""Method"" = 'PasswordOnly', ""UpdatedBy"" = 'system', ""UpdatedAt"" = NOW()
WHERE ""ActionKey"" = 'TestResult.MarkComplete' AND ""Method"" = 'None';
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE esign_configs
SET ""Method"" = 'None', ""UpdatedBy"" = 'system', ""UpdatedAt"" = NOW()
WHERE ""ActionKey"" = 'TestResult.MarkComplete' AND ""Method"" = 'PasswordOnly';
");
        }
    }
}
