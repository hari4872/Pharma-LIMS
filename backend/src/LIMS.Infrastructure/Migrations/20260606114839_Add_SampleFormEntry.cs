using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_SampleFormEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sample_form_entries",
                columns: table => new
                {
                    SampleFormEntryId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    FormTemplateId = table.Column<int>(type: "integer", nullable: false),
                    FieldValuesJson = table.Column<string>(type: "text", nullable: false),
                    SubmittedBy = table.Column<string>(type: "text", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sample_form_entries", x => x.SampleFormEntryId);
                    table.ForeignKey(
                        name: "FK_sample_form_entries_form_templates_FormTemplateId",
                        column: x => x.FormTemplateId,
                        principalTable: "form_templates",
                        principalColumn: "FormTemplateId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sample_form_entries_samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sample_form_entries_FormTemplateId",
                table: "sample_form_entries",
                column: "FormTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_sample_form_entries_SampleId",
                table: "sample_form_entries",
                column: "SampleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sample_form_entries");
        }
    }
}
