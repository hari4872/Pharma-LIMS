using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOosGroupC : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FinalDecision",
                table: "oos_investigations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "FinalDecisionAt",
                table: "oos_investigations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalDecisionBy",
                table: "oos_investigations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PostReworkRetestExecutionId",
                table: "oos_investigations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReworkExecutionId",
                table: "oos_investigations",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_oos_investigations_PostReworkRetestExecutionId",
                table: "oos_investigations",
                column: "PostReworkRetestExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_oos_investigations_ReworkExecutionId",
                table: "oos_investigations",
                column: "ReworkExecutionId");

            migrationBuilder.AddForeignKey(
                name: "FK_oos_investigations_test_executions_PostReworkRetestExecutio~",
                table: "oos_investigations",
                column: "PostReworkRetestExecutionId",
                principalTable: "test_executions",
                principalColumn: "ExecutionId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_oos_investigations_test_executions_ReworkExecutionId",
                table: "oos_investigations",
                column: "ReworkExecutionId",
                principalTable: "test_executions",
                principalColumn: "ExecutionId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_oos_investigations_test_executions_PostReworkRetestExecutio~",
                table: "oos_investigations");

            migrationBuilder.DropForeignKey(
                name: "FK_oos_investigations_test_executions_ReworkExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropIndex(
                name: "IX_oos_investigations_PostReworkRetestExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropIndex(
                name: "IX_oos_investigations_ReworkExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "FinalDecision",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "FinalDecisionAt",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "FinalDecisionBy",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "PostReworkRetestExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "ReworkExecutionId",
                table: "oos_investigations");
        }
    }
}
