using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    public partial class Add_SampleId_To_CapacityBooking : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SampleId",
                table: "capacity_bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_capacity_bookings_SampleId",
                table: "capacity_bookings",
                column: "SampleId");

            migrationBuilder.AddForeignKey(
                name: "FK_capacity_bookings_samples_SampleId",
                table: "capacity_bookings",
                column: "SampleId",
                principalTable: "samples",
                principalColumn: "SampleId",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_capacity_bookings_samples_SampleId",
                table: "capacity_bookings");

            migrationBuilder.DropIndex(
                name: "IX_capacity_bookings_SampleId",
                table: "capacity_bookings");

            migrationBuilder.DropColumn(
                name: "SampleId",
                table: "capacity_bookings");
        }
    }
}
