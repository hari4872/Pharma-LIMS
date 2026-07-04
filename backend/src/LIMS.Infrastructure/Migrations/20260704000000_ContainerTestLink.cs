using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ContainerTestLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SampleContainerId",
                table: "test_executions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_test_executions_SampleContainerId",
                table: "test_executions",
                column: "SampleContainerId");

            migrationBuilder.AddForeignKey(
                name: "FK_test_executions_sample_containers_SampleContainerId",
                table: "test_executions",
                column: "SampleContainerId",
                principalTable: "sample_containers",
                principalColumn: "SampleContainerId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_test_executions_sample_containers_SampleContainerId",
                table: "test_executions");

            migrationBuilder.DropIndex(
                name: "IX_test_executions_SampleContainerId",
                table: "test_executions");

            migrationBuilder.DropColumn(
                name: "SampleContainerId",
                table: "test_executions");
        }
    }
}
