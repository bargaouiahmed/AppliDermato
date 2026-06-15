using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddInterrogatoireAnomalyCatalogCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InterrogatoireAnomalyCatalogHiddens_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogHiddens");

            migrationBuilder.DropIndex(
                name: "IX_InterrogatoireAnomalyCatalogCustoms_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogCustoms");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "InterrogatoireAnomalyCatalogHiddens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CategoryNormalized",
                table: "InterrogatoireAnomalyCatalogHiddens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "InterrogatoireAnomalyCatalogCustoms",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CategoryNormalized",
                table: "InterrogatoireAnomalyCatalogCustoms",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalyCatalogHiddens_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogHiddens",
                columns: new[] { "CabinetIdentityId", "Section", "CategoryNormalized", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalyCatalogCustoms_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogCustoms",
                columns: new[] { "CabinetIdentityId", "Section", "CategoryNormalized", "LabelNormalized" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InterrogatoireAnomalyCatalogHiddens_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogHiddens");

            migrationBuilder.DropIndex(
                name: "IX_InterrogatoireAnomalyCatalogCustoms_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogCustoms");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "InterrogatoireAnomalyCatalogHiddens");

            migrationBuilder.DropColumn(
                name: "CategoryNormalized",
                table: "InterrogatoireAnomalyCatalogHiddens");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "InterrogatoireAnomalyCatalogCustoms");

            migrationBuilder.DropColumn(
                name: "CategoryNormalized",
                table: "InterrogatoireAnomalyCatalogCustoms");

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalyCatalogHiddens_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogHiddens",
                columns: new[] { "CabinetIdentityId", "Section", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalyCatalogCustoms_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogCustoms",
                columns: new[] { "CabinetIdentityId", "Section", "LabelNormalized" },
                unique: true);
        }
    }
}
