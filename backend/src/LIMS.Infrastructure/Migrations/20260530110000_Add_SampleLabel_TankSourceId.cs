using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    public partial class Add_SampleLabel_TankSourceId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
ALTER TABLE samples
    ADD COLUMN IF NOT EXISTS ""SampleLabel""  text NULL,
    ADD COLUMN IF NOT EXISTS ""TankSourceId"" text NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
ALTER TABLE samples
    DROP COLUMN IF EXISTS ""SampleLabel"",
    DROP COLUMN IF EXISTS ""TankSourceId"";
");
        }
    }
}
