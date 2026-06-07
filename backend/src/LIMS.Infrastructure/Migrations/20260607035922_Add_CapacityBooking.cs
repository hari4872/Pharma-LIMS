using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_CapacityBooking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "capacity_bookings",
                columns: table => new
                {
                    CapacityBookingId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InstrumentId = table.Column<int>(type: "integer", nullable: false),
                    BookedByUserId = table.Column<int>(type: "integer", nullable: false),
                    ExecutionId = table.Column<int>(type: "integer", nullable: true),
                    StartTime = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndTime = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_capacity_bookings", x => x.CapacityBookingId);
                    table.ForeignKey(
                        name: "FK_capacity_bookings_instruments_InstrumentId",
                        column: x => x.InstrumentId,
                        principalTable: "instruments",
                        principalColumn: "InstrumentId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_capacity_bookings_test_executions_ExecutionId",
                        column: x => x.ExecutionId,
                        principalTable: "test_executions",
                        principalColumn: "ExecutionId");
                    table.ForeignKey(
                        name: "FK_capacity_bookings_users_BookedByUserId",
                        column: x => x.BookedByUserId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_capacity_bookings_BookedByUserId",
                table: "capacity_bookings",
                column: "BookedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_capacity_bookings_ExecutionId",
                table: "capacity_bookings",
                column: "ExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_capacity_bookings_InstrumentId",
                table: "capacity_bookings",
                column: "InstrumentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "capacity_bookings");
        }
    }
}
