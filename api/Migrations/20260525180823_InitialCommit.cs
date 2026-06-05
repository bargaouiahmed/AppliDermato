using System;
using System.Collections.Generic;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;
using api.Src.ConsultationSpace.ConduiteSection.Entities;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCommit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CabinetIdentities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Country = table.Column<string>(type: "text", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: false),
                    PostalCode = table.Column<string>(type: "text", nullable: false),
                    City = table.Column<string>(type: "text", nullable: false),
                    CodeCnam = table.Column<string>(type: "text", nullable: false),
                    ProfilePictureUrl = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    RefreshToken = table.Column<string>(type: "text", nullable: true),
                    RefreshTokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsSecondSecretaryActive = table.Column<bool>(type: "boolean", nullable: false),
                    PasswordResetToken = table.Column<string>(type: "text", nullable: true),
                    PasswordResetTokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsFlaggedForDeletion = table.Column<bool>(type: "boolean", nullable: false),
                    FlaggedForDeletionAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AdminNotes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CabinetIdentities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConduiteConsigneCatalogItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    LabelNormalized = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConduiteConsigneCatalogItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConduiteOrdonnanceTypeCatalogItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    TypeKey = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    Label = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    LabelNormalized = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Consigne = table.Column<string>(type: "text", nullable: false),
                    InformationAdditionnel = table.Column<string>(type: "text", nullable: false),
                    ListDrugs = table.Column<List<ConduiteOrdonnanceTypeDrugCatalogItem>>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConduiteOrdonnanceTypeCatalogItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExamFindingCatalogItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Section = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SectionNormalized = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Label = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    LabelNormalized = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExamFindingCatalogItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FilesToDelete",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FilePath = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FilesToDelete", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InterrogatoireAnomalyCatalogHiddens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Section = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    LabelNormalized = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterrogatoireAnomalyCatalogHiddens", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TherapeuticClassCatalogItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    LabelNormalized = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TherapeuticClassCatalogItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TreatmentCatalogRelationItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    TherapeuticClass = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    TherapeuticClassNormalized = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Category = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CategoryNormalized = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Medicine = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    MedicineNormalized = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TreatmentCatalogRelationItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TreatmentCategoryCatalogItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    LabelNormalized = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TreatmentCategoryCatalogItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TreatmentMedicineCatalogItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    LabelNormalized = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TreatmentMedicineCatalogItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ActiveSubscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationInMonths = table.Column<int>(type: "integer", nullable: false),
                    HasBeenNotifiedOfExpiration = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SubscriptionType = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActiveSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActiveSubscriptions_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AiChatSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Context = table.Column<string>(type: "text", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiChatSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiChatSessions_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartHour = table.Column<int>(type: "integer", nullable: false),
                    EndHour = table.Column<int>(type: "integer", nullable: false),
                    TimeSlotInterval = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarSettings_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Doctors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Firstname = table.Column<string>(type: "text", nullable: false),
                    Lastname = table.Column<string>(type: "text", nullable: false),
                    FirstnameAr = table.Column<string>(type: "text", nullable: false),
                    LastnameAr = table.Column<string>(type: "text", nullable: false),
                    Gender = table.Column<string>(type: "text", nullable: false),
                    DateOfBirth = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Nationality = table.Column<string>(type: "text", nullable: false),
                    PhoneNumber = table.Column<string>(type: "text", nullable: false),
                    Landline = table.Column<string>(type: "text", nullable: false),
                    LanguagePreference = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "text", nullable: false),
                    SelfCheckinEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    SelfCheckinKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    SelfCheckinTimeoutSeconds = table.Column<int>(type: "integer", nullable: false, defaultValue: 90),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Doctors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Doctors_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DoctorSuggestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorFirstName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DoctorLastName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DoctorEmail = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Subject = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Message = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "open"),
                    SeenByAdmins = table.Column<bool>(type: "boolean", nullable: false),
                    SeenByAdminsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastReplyAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoctorSuggestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DoctorSuggestions_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InternalMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoomId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Sender = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SeenBy = table.Column<string[]>(type: "text[]", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InternalMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InternalMessages_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Leaves",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsFullDay = table.Column<bool>(type: "boolean", nullable: false),
                    StartTime = table.Column<string>(type: "text", nullable: true),
                    EndTime = table.Column<string>(type: "text", nullable: true),
                    Type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsRecurring = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leaves", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Leaves_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Patients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DossierNumber = table.Column<int>(type: "integer", nullable: false),
                    Firstname = table.Column<string>(type: "text", nullable: false),
                    Lastname = table.Column<string>(type: "text", nullable: false),
                    DateOfBirth = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PhoneNumber = table.Column<string>(type: "text", nullable: false),
                    Country = table.Column<string>(type: "text", nullable: false),
                    Profession = table.Column<string>(type: "text", nullable: false),
                    WorkPlace = table.Column<string>(type: "text", nullable: false),
                    Sex = table.Column<string>(type: "text", nullable: false),
                    FamilialStatus = table.Column<string>(type: "text", nullable: false),
                    City = table.Column<string>(type: "text", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: false),
                    PostalCode = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    APCI = table.Column<string>(type: "text", nullable: false),
                    InsuranceType = table.Column<string>(type: "text", nullable: false),
                    InsuranceEstablishment = table.Column<string>(type: "text", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Patients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Patients_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Secretaries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Firstname = table.Column<string>(type: "text", nullable: false),
                    Lastname = table.Column<string>(type: "text", nullable: false),
                    SecretaryIndex = table.Column<int>(type: "integer", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Secretaries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Secretaries_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TechAssistanceTickets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorFirstName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DoctorLastName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DoctorEmail = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Subject = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "open"),
                    SeenByAdmins = table.Column<bool>(type: "boolean", nullable: false),
                    SeenByAdminsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastMessageAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastDoctorMessageAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastAdminMessageAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TechLeadNotifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TechAssistanceTickets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TechAssistanceTickets_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AiChatMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AiChatSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Error = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiChatMessages_AiChatSessions_AiChatSessionId",
                        column: x => x.AiChatSessionId,
                        principalTable: "AiChatSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Clinics",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: false),
                    PhoneNumber = table.Column<string>(type: "text", nullable: false),
                    GoogleMapsLink = table.Column<string>(type: "text", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clinics", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Clinics_Doctors_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Doctors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DoctorPersonalizations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    CylinderScale = table.Column<string>(type: "text", nullable: false),
                    DistanceVisualScale = table.Column<string>(type: "text", nullable: false),
                    WaitingRoomMessage = table.Column<string>(type: "text", nullable: true),
                    DailyNews = table.Column<string>(type: "text", nullable: true),
                    DailyNewsFr = table.Column<string>(type: "text", nullable: true),
                    DailyNewsEn = table.Column<string>(type: "text", nullable: true),
                    DailyNewsAr = table.Column<string>(type: "text", nullable: true),
                    UseSuperAdminDailyNews = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    AutoDailyNewsEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    ShowHeader = table.Column<bool>(type: "boolean", nullable: false),
                    ShowFirstName = table.Column<bool>(type: "boolean", nullable: false),
                    ShowLastName = table.Column<bool>(type: "boolean", nullable: false),
                    ShowCodeCnam = table.Column<bool>(type: "boolean", nullable: false),
                    ShowFirstNameArabic = table.Column<bool>(type: "boolean", nullable: false),
                    ShowLastNameArabic = table.Column<bool>(type: "boolean", nullable: false),
                    ShowFooter = table.Column<bool>(type: "boolean", nullable: false),
                    ShowFooterCabinetAddress = table.Column<bool>(type: "boolean", nullable: false),
                    ShowFooterLandline = table.Column<bool>(type: "boolean", nullable: false),
                    ShowFooterMobile = table.Column<bool>(type: "boolean", nullable: false),
                    ShowFooterEmail = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoctorPersonalizations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DoctorPersonalizations_Doctors_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Doctors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DoctorSuggestionReplies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorSuggestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResponderDoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResponderFirstName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ResponderLastName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ResponderRole = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Message = table.Column<string>(type: "text", nullable: false),
                    ReadByDoctor = table.Column<bool>(type: "boolean", nullable: false),
                    ReadByDoctorAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoctorSuggestionReplies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DoctorSuggestionReplies_DoctorSuggestions_DoctorSuggestionId",
                        column: x => x.DoctorSuggestionId,
                        principalTable: "DoctorSuggestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DoctorSuggestionReplies_Doctors_ResponderDoctorId",
                        column: x => x.ResponderDoctorId,
                        principalTable: "Doctors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Consultations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    ConduiteAdditionalInformation = table.Column<string>(type: "text", nullable: false),
                    IsTimerPaused = table.Column<bool>(type: "boolean", nullable: false),
                    IsDone = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Consultations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Consultations_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Consultations_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Rdvs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Date = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Time = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Duration = table.Column<int>(type: "integer", nullable: false),
                    Motifs = table.Column<string[]>(type: "text[]", nullable: true),
                    IsPersonnel = table.Column<bool>(type: "boolean", nullable: false),
                    PersonnelDescription = table.Column<string>(type: "text", nullable: true),
                    PersonnelDuration = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rdvs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Rdvs_CabinetIdentities_CabinetIdentityId",
                        column: x => x.CabinetIdentityId,
                        principalTable: "CabinetIdentities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Rdvs_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TechAssistanceMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TechAssistanceTicketId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderDoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderCabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderFirstName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SenderLastName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SenderEmail = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    SenderRole = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Message = table.Column<string>(type: "text", nullable: false),
                    ReadByRequester = table.Column<bool>(type: "boolean", nullable: false),
                    ReadByRequesterAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TechAssistanceMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TechAssistanceMessages_TechAssistanceTickets_TechAssistance~",
                        column: x => x.TechAssistanceTicketId,
                        principalTable: "TechAssistanceTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConsultationConduiteActions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActionKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Payload = table.Column<Dictionary<string, JsonElement>>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultationConduiteActions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConsultationConduiteActions_Consultations_ConsultationId",
                        column: x => x.ConsultationId,
                        principalTable: "Consultations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConsultationExams",
                columns: table => new
                {
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Payload = table.Column<Dictionary<string, JsonElement>>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultationExams", x => x.ConsultationId);
                    table.ForeignKey(
                        name: "FK_ConsultationExams_Consultations_ConsultationId",
                        column: x => x.ConsultationId,
                        principalTable: "Consultations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConsultationExplorationDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    TypeLabels = table.Column<string[]>(type: "text[]", nullable: false),
                    Clinic = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Forfait = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Operator = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Precaution = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    AdditionalInformation = table.Column<string>(type: "text", nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    StoredFileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RelativeFilePath = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultationExplorationDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConsultationExplorationDocuments_Consultations_Consultation~",
                        column: x => x.ConsultationId,
                        principalTable: "Consultations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConsultationLettreConfrereAiJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    CabinetIdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Operation = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    LetterName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    GeneralDescription = table.Column<string>(type: "text", nullable: false),
                    CorrectionPrompt = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SourceContent = table.Column<string>(type: "text", nullable: false),
                    Medecin = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Formulepolitesse = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ResultPayload = table.Column<Dictionary<string, JsonElement>>(type: "jsonb", nullable: false),
                    Error = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultationLettreConfrereAiJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConsultationLettreConfrereAiJobs_Consultations_Consultation~",
                        column: x => x.ConsultationId,
                        principalTable: "Consultations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConsultationMotifs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ValueNormalized = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultationMotifs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConsultationMotifs_Consultations_ConsultationId",
                        column: x => x.ConsultationId,
                        principalTable: "Consultations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Interrogatoires",
                columns: table => new
                {
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    HistoireMaladie = table.Column<string>(type: "text", nullable: false),
                    Diagnostics = table.Column<string[]>(type: "text[]", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Interrogatoires", x => x.ConsultationId);
                    table.ForeignKey(
                        name: "FK_Interrogatoires_Consultations_ConsultationId",
                        column: x => x.ConsultationId,
                        principalTable: "Consultations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TechAssistanceAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TechAssistanceMessageId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    StoredFileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RelativeFilePath = table.Column<string>(type: "character varying(420)", maxLength: 420, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TechAssistanceAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TechAssistanceAttachments_TechAssistanceMessages_TechAssist~",
                        column: x => x.TechAssistanceMessageId,
                        principalTable: "TechAssistanceMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InterrogatoireAnomalies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Section = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    IsCustom = table.Column<bool>(type: "boolean", nullable: false),
                    TemplateKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Payload = table.Column<Dictionary<string, JsonElement>>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterrogatoireAnomalies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterrogatoireAnomalies_Interrogatoires_ConsultationId",
                        column: x => x.ConsultationId,
                        principalTable: "Interrogatoires",
                        principalColumn: "ConsultationId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OngoingTreatmentMedicines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Medicine = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    TherapeuticClass = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Category = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Posology = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Duration = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Date = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OngoingTreatmentMedicines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OngoingTreatmentMedicines_Interrogatoires_ConsultationId",
                        column: x => x.ConsultationId,
                        principalTable: "Interrogatoires",
                        principalColumn: "ConsultationId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActiveSubscriptions_CabinetIdentityId",
                table: "ActiveSubscriptions",
                column: "CabinetIdentityId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AiChatMessages_AiChatSessionId_SortOrder",
                table: "AiChatMessages",
                columns: new[] { "AiChatSessionId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_AiChatMessages_DeletedAt",
                table: "AiChatMessages",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AiChatSessions_CabinetIdentityId_UpdatedAt",
                table: "AiChatSessions",
                columns: new[] { "CabinetIdentityId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AiChatSessions_DeletedAt",
                table: "AiChatSessions",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_CabinetIdentities_Email",
                table: "CabinetIdentities",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CabinetIdentities_PasswordResetToken",
                table: "CabinetIdentities",
                column: "PasswordResetToken");

            migrationBuilder.CreateIndex(
                name: "IX_CabinetIdentities_RefreshToken",
                table: "CabinetIdentities",
                column: "RefreshToken");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarSettings_CabinetIdentityId",
                table: "CalendarSettings",
                column: "CabinetIdentityId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clinics_DoctorId",
                table: "Clinics",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_ConduiteConsigneCatalogItems_CabinetIdentityId",
                table: "ConduiteConsigneCatalogItems",
                column: "CabinetIdentityId");

            migrationBuilder.CreateIndex(
                name: "IX_ConduiteConsigneCatalogItems_CabinetIdentityId_LabelNormali~",
                table: "ConduiteConsigneCatalogItems",
                columns: new[] { "CabinetIdentityId", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConduiteOrdonnanceTypeCatalogItems_CabinetIdentityId",
                table: "ConduiteOrdonnanceTypeCatalogItems",
                column: "CabinetIdentityId");

            migrationBuilder.CreateIndex(
                name: "IX_ConduiteOrdonnanceTypeCatalogItems_CabinetIdentityId_LabelN~",
                table: "ConduiteOrdonnanceTypeCatalogItems",
                columns: new[] { "CabinetIdentityId", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConduiteOrdonnanceTypeCatalogItems_CabinetIdentityId_TypeKey",
                table: "ConduiteOrdonnanceTypeCatalogItems",
                columns: new[] { "CabinetIdentityId", "TypeKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationConduiteActions_ConsultationId_ActionKey",
                table: "ConsultationConduiteActions",
                columns: new[] { "ConsultationId", "ActionKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationConduiteActions_ConsultationId_SortOrder",
                table: "ConsultationConduiteActions",
                columns: new[] { "ConsultationId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationConduiteActions_Payload",
                table: "ConsultationConduiteActions",
                column: "Payload")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationExams_Payload",
                table: "ConsultationExams",
                column: "Payload")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationExplorationDocuments_ConsultationId",
                table: "ConsultationExplorationDocuments",
                column: "ConsultationId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationExplorationDocuments_ConsultationId_CreatedAt",
                table: "ConsultationExplorationDocuments",
                columns: new[] { "ConsultationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationLettreConfrereAiJobs_CabinetIdentityId_Status",
                table: "ConsultationLettreConfrereAiJobs",
                columns: new[] { "CabinetIdentityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationLettreConfrereAiJobs_ConsultationId_CreatedAt",
                table: "ConsultationLettreConfrereAiJobs",
                columns: new[] { "ConsultationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationLettreConfrereAiJobs_Status",
                table: "ConsultationLettreConfrereAiJobs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationMotifs_ConsultationId_ValueNormalized",
                table: "ConsultationMotifs",
                columns: new[] { "ConsultationId", "ValueNormalized" });

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_CabinetIdentityId_ConsultationDate",
                table: "Consultations",
                columns: new[] { "CabinetIdentityId", "ConsultationDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_PatientId_CabinetIdentityId_ConsultationDate",
                table: "Consultations",
                columns: new[] { "PatientId", "CabinetIdentityId", "ConsultationDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_PatientId_ConsultationDate",
                table: "Consultations",
                columns: new[] { "PatientId", "ConsultationDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DoctorPersonalizations_DoctorId",
                table: "DoctorPersonalizations",
                column: "DoctorId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Doctors_CabinetIdentityId",
                table: "Doctors",
                column: "CabinetIdentityId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DoctorSuggestionReplies_DoctorSuggestionId_CreatedAt",
                table: "DoctorSuggestionReplies",
                columns: new[] { "DoctorSuggestionId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DoctorSuggestionReplies_ReadByDoctor",
                table: "DoctorSuggestionReplies",
                column: "ReadByDoctor");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorSuggestionReplies_ResponderDoctorId",
                table: "DoctorSuggestionReplies",
                column: "ResponderDoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorSuggestions_CabinetIdentityId_UpdatedAt",
                table: "DoctorSuggestions",
                columns: new[] { "CabinetIdentityId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DoctorSuggestions_SeenByAdmins",
                table: "DoctorSuggestions",
                column: "SeenByAdmins");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorSuggestions_Status",
                table: "DoctorSuggestions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ExamFindingCatalogItems_CabinetIdentityId_SectionNormalized",
                table: "ExamFindingCatalogItems",
                columns: new[] { "CabinetIdentityId", "SectionNormalized" });

            migrationBuilder.CreateIndex(
                name: "IX_ExamFindingCatalogItems_CabinetIdentityId_SectionNormalized~",
                table: "ExamFindingCatalogItems",
                columns: new[] { "CabinetIdentityId", "SectionNormalized", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InternalMessages_CabinetIdentityId_RoomId_CreatedAt",
                table: "InternalMessages",
                columns: new[] { "CabinetIdentityId", "RoomId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_InternalMessages_RoomId",
                table: "InternalMessages",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalies_ConsultationId_Section_SortOrder",
                table: "InterrogatoireAnomalies",
                columns: new[] { "ConsultationId", "Section", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalies_ConsultationId_TemplateKey",
                table: "InterrogatoireAnomalies",
                columns: new[] { "ConsultationId", "TemplateKey" });

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalies_Payload",
                table: "InterrogatoireAnomalies",
                column: "Payload")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalyCatalogHiddens_CabinetIdentityId_Sect~1",
                table: "InterrogatoireAnomalyCatalogHiddens",
                columns: new[] { "CabinetIdentityId", "Section", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InterrogatoireAnomalyCatalogHiddens_CabinetIdentityId_Secti~",
                table: "InterrogatoireAnomalyCatalogHiddens",
                columns: new[] { "CabinetIdentityId", "Section" });

            migrationBuilder.CreateIndex(
                name: "IX_Leaves_CabinetIdentityId_Date",
                table: "Leaves",
                columns: new[] { "CabinetIdentityId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_OngoingTreatmentMedicines_ConsultationId",
                table: "OngoingTreatmentMedicines",
                column: "ConsultationId");

            migrationBuilder.CreateIndex(
                name: "IX_Patients_CabinetIdentityId",
                table: "Patients",
                column: "CabinetIdentityId");

            migrationBuilder.CreateIndex(
                name: "IX_Rdvs_CabinetIdentityId_Date",
                table: "Rdvs",
                columns: new[] { "CabinetIdentityId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_Rdvs_PatientId",
                table: "Rdvs",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_Secretaries_CabinetIdentityId",
                table: "Secretaries",
                column: "CabinetIdentityId");

            migrationBuilder.CreateIndex(
                name: "IX_TechAssistanceAttachments_TechAssistanceMessageId",
                table: "TechAssistanceAttachments",
                column: "TechAssistanceMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_TechAssistanceMessages_ReadByRequester",
                table: "TechAssistanceMessages",
                column: "ReadByRequester");

            migrationBuilder.CreateIndex(
                name: "IX_TechAssistanceMessages_SenderRole",
                table: "TechAssistanceMessages",
                column: "SenderRole");

            migrationBuilder.CreateIndex(
                name: "IX_TechAssistanceMessages_TechAssistanceTicketId_CreatedAt",
                table: "TechAssistanceMessages",
                columns: new[] { "TechAssistanceTicketId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TechAssistanceTickets_CabinetIdentityId_UpdatedAt",
                table: "TechAssistanceTickets",
                columns: new[] { "CabinetIdentityId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TechAssistanceTickets_LastMessageAt",
                table: "TechAssistanceTickets",
                column: "LastMessageAt");

            migrationBuilder.CreateIndex(
                name: "IX_TechAssistanceTickets_SeenByAdmins",
                table: "TechAssistanceTickets",
                column: "SeenByAdmins");

            migrationBuilder.CreateIndex(
                name: "IX_TechAssistanceTickets_Status",
                table: "TechAssistanceTickets",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_TherapeuticClassCatalogItems_CabinetIdentityId_LabelNormali~",
                table: "TherapeuticClassCatalogItems",
                columns: new[] { "CabinetIdentityId", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TreatmentCatalogRelationItems_CabinetIdentityId_CategoryNor~",
                table: "TreatmentCatalogRelationItems",
                columns: new[] { "CabinetIdentityId", "CategoryNormalized", "MedicineNormalized" });

            migrationBuilder.CreateIndex(
                name: "IX_TreatmentCatalogRelationItems_CabinetIdentityId_Therapeuti~1",
                table: "TreatmentCatalogRelationItems",
                columns: new[] { "CabinetIdentityId", "TherapeuticClassNormalized", "CategoryNormalized", "MedicineNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TreatmentCatalogRelationItems_CabinetIdentityId_Therapeutic~",
                table: "TreatmentCatalogRelationItems",
                columns: new[] { "CabinetIdentityId", "TherapeuticClassNormalized", "CategoryNormalized" });

            migrationBuilder.CreateIndex(
                name: "IX_TreatmentCategoryCatalogItems_CabinetIdentityId_LabelNormal~",
                table: "TreatmentCategoryCatalogItems",
                columns: new[] { "CabinetIdentityId", "LabelNormalized" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TreatmentMedicineCatalogItems_CabinetIdentityId_LabelNormal~",
                table: "TreatmentMedicineCatalogItems",
                columns: new[] { "CabinetIdentityId", "LabelNormalized" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActiveSubscriptions");

            migrationBuilder.DropTable(
                name: "AiChatMessages");

            migrationBuilder.DropTable(
                name: "CalendarSettings");

            migrationBuilder.DropTable(
                name: "Clinics");

            migrationBuilder.DropTable(
                name: "ConduiteConsigneCatalogItems");

            migrationBuilder.DropTable(
                name: "ConduiteOrdonnanceTypeCatalogItems");

            migrationBuilder.DropTable(
                name: "ConsultationConduiteActions");

            migrationBuilder.DropTable(
                name: "ConsultationExams");

            migrationBuilder.DropTable(
                name: "ConsultationExplorationDocuments");

            migrationBuilder.DropTable(
                name: "ConsultationLettreConfrereAiJobs");

            migrationBuilder.DropTable(
                name: "ConsultationMotifs");

            migrationBuilder.DropTable(
                name: "DoctorPersonalizations");

            migrationBuilder.DropTable(
                name: "DoctorSuggestionReplies");

            migrationBuilder.DropTable(
                name: "ExamFindingCatalogItems");

            migrationBuilder.DropTable(
                name: "FilesToDelete");

            migrationBuilder.DropTable(
                name: "InternalMessages");

            migrationBuilder.DropTable(
                name: "InterrogatoireAnomalies");

            migrationBuilder.DropTable(
                name: "InterrogatoireAnomalyCatalogHiddens");

            migrationBuilder.DropTable(
                name: "Leaves");

            migrationBuilder.DropTable(
                name: "OngoingTreatmentMedicines");

            migrationBuilder.DropTable(
                name: "Rdvs");

            migrationBuilder.DropTable(
                name: "Secretaries");

            migrationBuilder.DropTable(
                name: "TechAssistanceAttachments");

            migrationBuilder.DropTable(
                name: "TherapeuticClassCatalogItems");

            migrationBuilder.DropTable(
                name: "TreatmentCatalogRelationItems");

            migrationBuilder.DropTable(
                name: "TreatmentCategoryCatalogItems");

            migrationBuilder.DropTable(
                name: "TreatmentMedicineCatalogItems");

            migrationBuilder.DropTable(
                name: "AiChatSessions");

            migrationBuilder.DropTable(
                name: "DoctorSuggestions");

            migrationBuilder.DropTable(
                name: "Doctors");

            migrationBuilder.DropTable(
                name: "Interrogatoires");

            migrationBuilder.DropTable(
                name: "TechAssistanceMessages");

            migrationBuilder.DropTable(
                name: "Consultations");

            migrationBuilder.DropTable(
                name: "TechAssistanceTickets");

            migrationBuilder.DropTable(
                name: "Patients");

            migrationBuilder.DropTable(
                name: "CabinetIdentities");
        }
    }
}
