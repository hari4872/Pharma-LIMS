using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RestrictSampleContainerDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_process_log_rows_samples_SampleId",
                table: "process_log_rows");

            migrationBuilder.DropForeignKey(
                name: "FK_SampleContainers_SampleContainers_ParentContainerSampleCont~",
                table: "SampleContainers");

            migrationBuilder.DropForeignKey(
                name: "FK_SampleContainers_electronic_signatures_DestructionSignature~",
                table: "SampleContainers");

            migrationBuilder.DropForeignKey(
                name: "FK_SampleContainers_samples_SampleId",
                table: "SampleContainers");

            migrationBuilder.DropForeignKey(
                name: "FK_SampleContainers_storage_locations_StorageLocationId",
                table: "SampleContainers");

            migrationBuilder.DropForeignKey(
                name: "FK_SampleTypeCheckpoints_checkpoints_CheckpointId",
                table: "SampleTypeCheckpoints");

            migrationBuilder.DropForeignKey(
                name: "FK_SampleTypeCheckpoints_sample_types_SampleTypeId",
                table: "SampleTypeCheckpoints");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SampleTypeCheckpoints",
                table: "SampleTypeCheckpoints");

            migrationBuilder.DropIndex(
                name: "IX_SampleTypeCheckpoints_SampleTypeId",
                table: "SampleTypeCheckpoints");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SampleContainers",
                table: "SampleContainers");

            migrationBuilder.DropIndex(
                name: "IX_SampleContainers_ParentContainerSampleContainerId",
                table: "SampleContainers");

            migrationBuilder.DropColumn(
                name: "ParentContainerSampleContainerId",
                table: "SampleContainers");

            migrationBuilder.RenameTable(
                name: "SampleTypeCheckpoints",
                newName: "sample_type_checkpoints");

            migrationBuilder.RenameTable(
                name: "SampleContainers",
                newName: "sample_containers");

            migrationBuilder.RenameIndex(
                name: "IX_SampleTypeCheckpoints_CheckpointId",
                table: "sample_type_checkpoints",
                newName: "IX_sample_type_checkpoints_CheckpointId");

            migrationBuilder.RenameIndex(
                name: "IX_SampleContainers_StorageLocationId",
                table: "sample_containers",
                newName: "IX_sample_containers_StorageLocationId");

            migrationBuilder.RenameIndex(
                name: "IX_SampleContainers_SampleId",
                table: "sample_containers",
                newName: "IX_sample_containers_SampleId");

            migrationBuilder.RenameIndex(
                name: "IX_SampleContainers_DestructionSignatureId",
                table: "sample_containers",
                newName: "IX_sample_containers_DestructionSignatureId");

            migrationBuilder.AlterColumn<string>(
                name: "Decision",
                table: "coa_approvals",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10);

            migrationBuilder.AlterColumn<string>(
                name: "ContainerLabel",
                table: "sample_containers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddPrimaryKey(
                name: "PK_sample_type_checkpoints",
                table: "sample_type_checkpoints",
                column: "SampleTypeCheckpointId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_sample_containers",
                table: "sample_containers",
                column: "SampleContainerId");

            migrationBuilder.CreateIndex(
                name: "IX_sample_type_checkpoints_SampleTypeId_CheckpointId",
                table: "sample_type_checkpoints",
                columns: new[] { "SampleTypeId", "CheckpointId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sample_containers_ParentSampleContainerId",
                table: "sample_containers",
                column: "ParentSampleContainerId");

            migrationBuilder.AddForeignKey(
                name: "FK_process_log_rows_samples_SampleId",
                table: "process_log_rows",
                column: "SampleId",
                principalTable: "samples",
                principalColumn: "SampleId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_sample_containers_electronic_signatures_DestructionSignatur~",
                table: "sample_containers",
                column: "DestructionSignatureId",
                principalTable: "electronic_signatures",
                principalColumn: "SignatureId");

            migrationBuilder.AddForeignKey(
                name: "FK_sample_containers_sample_containers_ParentSampleContainerId",
                table: "sample_containers",
                column: "ParentSampleContainerId",
                principalTable: "sample_containers",
                principalColumn: "SampleContainerId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_sample_containers_samples_SampleId",
                table: "sample_containers",
                column: "SampleId",
                principalTable: "samples",
                principalColumn: "SampleId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_sample_containers_storage_locations_StorageLocationId",
                table: "sample_containers",
                column: "StorageLocationId",
                principalTable: "storage_locations",
                principalColumn: "LocationId");

            migrationBuilder.AddForeignKey(
                name: "FK_sample_type_checkpoints_checkpoints_CheckpointId",
                table: "sample_type_checkpoints",
                column: "CheckpointId",
                principalTable: "checkpoints",
                principalColumn: "CheckpointId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_sample_type_checkpoints_sample_types_SampleTypeId",
                table: "sample_type_checkpoints",
                column: "SampleTypeId",
                principalTable: "sample_types",
                principalColumn: "SampleTypeId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_process_log_rows_samples_SampleId",
                table: "process_log_rows");

            migrationBuilder.DropForeignKey(
                name: "FK_sample_containers_electronic_signatures_DestructionSignatur~",
                table: "sample_containers");

            migrationBuilder.DropForeignKey(
                name: "FK_sample_containers_sample_containers_ParentSampleContainerId",
                table: "sample_containers");

            migrationBuilder.DropForeignKey(
                name: "FK_sample_containers_samples_SampleId",
                table: "sample_containers");

            migrationBuilder.DropForeignKey(
                name: "FK_sample_containers_storage_locations_StorageLocationId",
                table: "sample_containers");

            migrationBuilder.DropForeignKey(
                name: "FK_sample_type_checkpoints_checkpoints_CheckpointId",
                table: "sample_type_checkpoints");

            migrationBuilder.DropForeignKey(
                name: "FK_sample_type_checkpoints_sample_types_SampleTypeId",
                table: "sample_type_checkpoints");

            migrationBuilder.DropPrimaryKey(
                name: "PK_sample_type_checkpoints",
                table: "sample_type_checkpoints");

            migrationBuilder.DropIndex(
                name: "IX_sample_type_checkpoints_SampleTypeId_CheckpointId",
                table: "sample_type_checkpoints");

            migrationBuilder.DropPrimaryKey(
                name: "PK_sample_containers",
                table: "sample_containers");

            migrationBuilder.DropIndex(
                name: "IX_sample_containers_ParentSampleContainerId",
                table: "sample_containers");

            migrationBuilder.RenameTable(
                name: "sample_type_checkpoints",
                newName: "SampleTypeCheckpoints");

            migrationBuilder.RenameTable(
                name: "sample_containers",
                newName: "SampleContainers");

            migrationBuilder.RenameIndex(
                name: "IX_sample_type_checkpoints_CheckpointId",
                table: "SampleTypeCheckpoints",
                newName: "IX_SampleTypeCheckpoints_CheckpointId");

            migrationBuilder.RenameIndex(
                name: "IX_sample_containers_StorageLocationId",
                table: "SampleContainers",
                newName: "IX_SampleContainers_StorageLocationId");

            migrationBuilder.RenameIndex(
                name: "IX_sample_containers_SampleId",
                table: "SampleContainers",
                newName: "IX_SampleContainers_SampleId");

            migrationBuilder.RenameIndex(
                name: "IX_sample_containers_DestructionSignatureId",
                table: "SampleContainers",
                newName: "IX_SampleContainers_DestructionSignatureId");

            migrationBuilder.AlterColumn<string>(
                name: "Decision",
                table: "coa_approvals",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "ContainerLabel",
                table: "SampleContainers",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AddColumn<int>(
                name: "ParentContainerSampleContainerId",
                table: "SampleContainers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_SampleTypeCheckpoints",
                table: "SampleTypeCheckpoints",
                column: "SampleTypeCheckpointId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_SampleContainers",
                table: "SampleContainers",
                column: "SampleContainerId");

            migrationBuilder.CreateIndex(
                name: "IX_SampleTypeCheckpoints_SampleTypeId",
                table: "SampleTypeCheckpoints",
                column: "SampleTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_SampleContainers_ParentContainerSampleContainerId",
                table: "SampleContainers",
                column: "ParentContainerSampleContainerId");

            migrationBuilder.AddForeignKey(
                name: "FK_process_log_rows_samples_SampleId",
                table: "process_log_rows",
                column: "SampleId",
                principalTable: "samples",
                principalColumn: "SampleId");

            migrationBuilder.AddForeignKey(
                name: "FK_SampleContainers_SampleContainers_ParentContainerSampleCont~",
                table: "SampleContainers",
                column: "ParentContainerSampleContainerId",
                principalTable: "SampleContainers",
                principalColumn: "SampleContainerId");

            migrationBuilder.AddForeignKey(
                name: "FK_SampleContainers_electronic_signatures_DestructionSignature~",
                table: "SampleContainers",
                column: "DestructionSignatureId",
                principalTable: "electronic_signatures",
                principalColumn: "SignatureId");

            migrationBuilder.AddForeignKey(
                name: "FK_SampleContainers_samples_SampleId",
                table: "SampleContainers",
                column: "SampleId",
                principalTable: "samples",
                principalColumn: "SampleId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SampleContainers_storage_locations_StorageLocationId",
                table: "SampleContainers",
                column: "StorageLocationId",
                principalTable: "storage_locations",
                principalColumn: "LocationId");

            migrationBuilder.AddForeignKey(
                name: "FK_SampleTypeCheckpoints_checkpoints_CheckpointId",
                table: "SampleTypeCheckpoints",
                column: "CheckpointId",
                principalTable: "checkpoints",
                principalColumn: "CheckpointId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SampleTypeCheckpoints_sample_types_SampleTypeId",
                table: "SampleTypeCheckpoints",
                column: "SampleTypeId",
                principalTable: "sample_types",
                principalColumn: "SampleTypeId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
