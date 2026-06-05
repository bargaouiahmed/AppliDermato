using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class IntroduceCustomlAnomalyCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InterrogatoireAnomalyCatalogCustoms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Section = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    IsCustom = table.Column<bool>(type: "boolean", nullable: false),
                    TemplateKey = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: true),
                    Label = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    LabelNormalized = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterrogatoireAnomalyCatalogCustoms", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalyCatalogCustoms_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogCustoms",
                columns: new[] { "CabinetIdentityId", "Section", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalyCatalogCustoms_CabinetIdentityId_Secti~",
                table: "InterrogatoireAnomalyCatalogCustoms",
                columns: new[] { "CabinetIdentityId", "Section" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InterrogatoireAnomalyCatalogCustoms");
        }
    }
}
