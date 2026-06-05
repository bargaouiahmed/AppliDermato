using api.Converters;
using api.DatabaseRules;
using api.Src.AiChat.Entities;
using api.Src.Auth.Entities;
using api.Src.ConsultationSpace.ConduiteSection.Entities;
using api.Src.ConsultationSpace.DocumentsSection.Entities;
using api.Src.ConsultationSpace.ExamSection.Entities;
using api.Src.ConsultationSpace.Entities;
using api.Src.ConsultationSpace.InterrogationSection.Entities;
using api.Src.Messaging.Entities;
using api.Src.PatientSpace.Entities;
using api.Src.Subscription.Entities;
using api.Src.AgendaSpace.Entities;
using api.Src.Suggestions.Entities;
using api.Src.TechAssistance.Entities;
using Microsoft.EntityFrameworkCore;

namespace api;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Doctor> Doctors { get; set; }
    public DbSet<Secretary> Secretaries { get; set; }
    public DbSet<CabinetIdentity> CabinetIdentities { get; set; }
    public DbSet<Clinic> Clinics { get; set; }
    public DbSet<DoctorPersonalization> DoctorPersonalizations { get; set; }
    public DbSet<FileToDelete> FilesToDelete { get; set; }
    public DbSet<ActiveSubscription> ActiveSubscriptions { get; set; }
    public DbSet<Patient> Patients { get; set; }
    public DbSet<Consultation> Consultations { get; set; }
    public DbSet<ConsultationMotif> ConsultationMotifs { get; set; }
    public DbSet<ConsultationExam> ConsultationExams { get; set; }
    public DbSet<ConsultationConduiteAction> ConsultationConduiteActions { get; set; }
    public DbSet<ConsultationLettreConfrereAiJob> ConsultationLettreConfrereAiJobs { get; set; }
    public DbSet<ConsultationExplorationDocument> ConsultationExplorationDocuments { get; set; }
    public DbSet<ConduiteConsigneCatalogItem> ConduiteConsigneCatalogItems { get; set; }
    public DbSet<ConduiteOrdonnanceTypeCatalogItem> ConduiteOrdonnanceTypeCatalogItems { get; set; }
    public DbSet<ExamFindingCatalogItem> ExamFindingCatalogItems { get; set; }
    public DbSet<Interrogatoire> Interrogatoires { get; set; }
    public DbSet<InterrogatoireAnomaly> InterrogatoireAnomalies { get; set; }
    public DbSet<InterrogatoireAnomalyCatalogCustom> InterrogatoireAnomalyCatalogCustoms { get; set; }
    public DbSet<InterrogatoireAnomalyCatalogHidden> InterrogatoireAnomalyCatalogHiddens { get; set; }
    public DbSet<OngoingTreatmentMedicine> OngoingTreatmentMedicines { get; set; }
    public DbSet<TreatmentMedicineCatalogItem> TreatmentMedicineCatalogItems { get; set; }
    public DbSet<TherapeuticClassCatalogItem> TherapeuticClassCatalogItems { get; set; }
    public DbSet<TreatmentCategoryCatalogItem> TreatmentCategoryCatalogItems { get; set; }
    public DbSet<TreatmentCatalogRelationItem> TreatmentCatalogRelationItems { get; set; }
    public DbSet<InternalMessage> InternalMessages { get; set; }
    public DbSet<AiChatSession> AiChatSessions { get; set; }
    public DbSet<AiChatMessage> AiChatMessages { get; set; }
    public DbSet<DoctorSuggestion> DoctorSuggestions { get; set; }
    public DbSet<DoctorSuggestionReply> DoctorSuggestionReplies { get; set; }
    public DbSet<TechAssistanceTicket> TechAssistanceTickets { get; set; }
    public DbSet<TechAssistanceMessage> TechAssistanceMessages { get; set; }
    public DbSet<TechAssistanceAttachment> TechAssistanceAttachments { get; set; }

    public DbSet<Rdv> Rdvs { get; set; }
    public DbSet<Leave> Leaves { get; set; }
    public DbSet<CalendarSettings> CalendarSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Doctor>(d =>
        {
            d.Property(item => item.SelfCheckinEnabled).HasDefaultValue(true);
            d.Property(item => item.SelfCheckinTimeoutSeconds).HasDefaultValue(90);
            d.Property(item => item.SelfCheckinKey).HasMaxLength(128);

            d.HasOne(d => d.CabinetIdentity)
            .WithOne(c => c.Doctor)
            .HasForeignKey<Doctor>(d => d.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Secretary>(sec =>
        {
            sec.HasOne(sec => sec.CabinetIdentity)
            .WithMany(c => c.Secretaries)
            .HasForeignKey(sec => sec.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CabinetIdentity>(ci =>
        {
            ci.HasIndex(c => c.Email).IsUnique();
            ci.HasIndex(c => c.RefreshToken);
            ci.HasIndex(c => c.PasswordResetToken);
        });

        modelBuilder.Entity<Patient>(p =>
        {
            p.HasOne(p => p.CabinetIdentity)
            .WithMany(c => c.Patients)
            .HasForeignKey(p => p.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Clinic>(c =>
        {
            c.HasOne(cl => cl.Doctor)
            .WithMany(d => d.Clinics)
            .HasForeignKey(cl => cl.DoctorId)
            .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DoctorPersonalization>(p =>
        {
            p.HasOne(pp => pp.Doctor)
            .WithOne(d => d.Personalization)
            .HasForeignKey<DoctorPersonalization>(pp => pp.DoctorId)
            .OnDelete(DeleteBehavior.Cascade);

            p.Property(pp => pp.UseSuperAdminDailyNews).HasDefaultValue(true);
            p.Property(pp => pp.AutoDailyNewsEnabled).HasDefaultValue(false);
            p.HasIndex(pp => pp.DoctorId).IsUnique();
        });

        modelBuilder.Entity<ActiveSubscription>(s =>
        {
            s.HasOne(a => a.CabinetIdentity)
            .WithOne(c => c.ActiveSubscriptions)
            .HasForeignKey<ActiveSubscription>(a => a.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Consultation>(c =>
        {
            c.HasOne(c => c.Patient)
            .WithMany(p => p.Consultations)
            .HasForeignKey(c => c.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

            c.HasOne(c => c.CabinetIdentity)
            .WithMany(ci => ci.Consultations)
            .HasForeignKey(c => c.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);

            c.HasMany(c => c.Motifs)
            .WithOne(m => m.Consultation)
            .HasForeignKey(m => m.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);

            c.HasOne(c => c.Interrogatoire)
            .WithOne(i => i.Consultation)
            .HasForeignKey<Interrogatoire>(i => i.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);
            c.Navigation(c => c.Interrogatoire).IsRequired();

            c.HasOne(c => c.Exam)
            .WithOne(e => e.Consultation)
            .HasForeignKey<ConsultationExam>(e => e.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);

            c.HasMany(c => c.ConduiteActions)
            .WithOne(a => a.Consultation)
            .HasForeignKey(a => a.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);

            c.HasMany<ConsultationLettreConfrereAiJob>()
            .WithOne(a => a.Consultation)
            .HasForeignKey(a => a.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);

            c.HasMany(c => c.ExplorationDocuments)
            .WithOne(d => d.Consultation)
            .HasForeignKey(d => d.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);

            c.Property(c => c.ConduiteAdditionalInformation).HasColumnType("text");

            c.HasIndex(c => new { c.PatientId, c.ConsultationDate }).IsUnique();
            c.HasIndex(c => new { c.CabinetIdentityId, c.ConsultationDate });
            c.HasIndex(c => new { c.PatientId, c.CabinetIdentityId, c.ConsultationDate });
        });

        modelBuilder.Entity<ConsultationMotif>(m =>
        {
            m.Property(m => m.Value).HasMaxLength(120);
            m.Property(m => m.ValueNormalized).HasMaxLength(120);

            m.HasIndex(m => new { m.ConsultationId, m.ValueNormalized });
        });

        modelBuilder.Entity<Interrogatoire>(i =>
        {
            i.HasKey(i => i.ConsultationId);
            i.Property(i => i.ConsultationId).ValueGeneratedNever();
            i.Property(i => i.HistoireMaladie).HasColumnType("text");
            i.Property(i => i.Diagnostics).HasColumnType("text[]");

            i.HasMany(i => i.Anomalies)
            .WithOne(a => a.Interrogatoire)
            .HasForeignKey(a => a.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);

            i.HasMany(i => i.OngoingTreatments)
            .WithOne(t => t.Interrogatoire)
            .HasForeignKey(t => t.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ConsultationExam>(e =>
        {
            e.HasKey(e => e.ConsultationId);
            e.Property(e => e.ConsultationId).ValueGeneratedNever();
            e.Property(e => e.Payload).HasColumnType("jsonb");
            e.HasIndex(e => e.Payload).HasMethod("gin");
        });

        modelBuilder.Entity<ConsultationConduiteAction>(a =>
        {
            a.Property(a => a.ActionKey).HasMaxLength(64);
            a.Property(a => a.SortOrder).HasDefaultValue(0);
            a.Property(a => a.Payload).HasColumnType("jsonb");

            a.HasIndex(a => new { a.ConsultationId, a.ActionKey }).IsUnique();
            a.HasIndex(a => new { a.ConsultationId, a.SortOrder });
            a.HasIndex(a => a.Payload).HasMethod("gin");
        });

        modelBuilder.Entity<ConsultationLettreConfrereAiJob>(job =>
        {
            job.HasOne(item => item.Consultation)
            .WithMany()
            .HasForeignKey(item => item.ConsultationId)
            .OnDelete(DeleteBehavior.Cascade);

            job.Property(item => item.Operation).HasMaxLength(24);
            job.Property(item => item.Status).HasMaxLength(24);
            job.Property(item => item.LetterName).HasMaxLength(180);
            job.Property(item => item.GeneralDescription).HasColumnType("text");
            job.Property(item => item.CorrectionPrompt).HasMaxLength(500);
            job.Property(item => item.SourceContent).HasColumnType("text");
            job.Property(item => item.Medecin).HasMaxLength(180);
            job.Property(item => item.Formulepolitesse).HasMaxLength(80);
            job.Property(item => item.ResultPayload).HasColumnType("jsonb");
            job.Property(item => item.Error).HasMaxLength(500);

            job.HasIndex(item => new { item.ConsultationId, item.CreatedAt });
            job.HasIndex(item => new { item.CabinetIdentityId, item.Status });
            job.HasIndex(item => item.Status);
        });

        modelBuilder.Entity<ConsultationExplorationDocument>(item =>
        {
            item.Property(i => i.TypeLabels).HasColumnType("text[]");
            item.Property(i => i.Clinic).HasMaxLength(160);
            item.Property(i => i.Forfait).HasMaxLength(160);
            item.Property(i => i.Operator).HasMaxLength(160);
            item.Property(i => i.Precaution).HasMaxLength(240);
            item.Property(i => i.AdditionalInformation).HasColumnType("text");
            item.Property(i => i.OriginalFileName).HasMaxLength(260);
            item.Property(i => i.StoredFileName).HasMaxLength(200);
            item.Property(i => i.RelativeFilePath).HasMaxLength(320);
            item.Property(i => i.ContentType).HasMaxLength(120);

            item.HasIndex(i => i.ConsultationId);
            item.HasIndex(i => new { i.ConsultationId, i.CreatedAt });
        });

        modelBuilder.Entity<ConduiteConsigneCatalogItem>(item =>
        {
            item.Property(i => i.Label).HasMaxLength(500);
            item.Property(i => i.LabelNormalized).HasMaxLength(500);

            item.HasIndex(i => new { i.CabinetIdentityId, i.LabelNormalized }).IsUnique();
            item.HasIndex(i => i.CabinetIdentityId);
        });

        modelBuilder.Entity<ConduiteOrdonnanceTypeCatalogItem>(item =>
        {
            item.Property(i => i.TypeKey).HasMaxLength(140);
            item.Property(i => i.Label).HasMaxLength(180);
            item.Property(i => i.LabelNormalized).HasMaxLength(180);
            item.Property(i => i.Consigne).HasColumnType("text");
            item.Property(i => i.InformationAdditionnel).HasColumnType("text");
            item.Property(i => i.ListDrugs).HasColumnType("jsonb");

            item.HasIndex(i => new { i.CabinetIdentityId, i.TypeKey }).IsUnique();
            item.HasIndex(i => new { i.CabinetIdentityId, i.LabelNormalized }).IsUnique();
            item.HasIndex(i => i.CabinetIdentityId);
        });

        modelBuilder.Entity<ExamFindingCatalogItem>(item =>
        {
            item.Property(i => i.Section).HasMaxLength(80);
            item.Property(i => i.SectionNormalized).HasMaxLength(80);
            item.Property(i => i.Label).HasMaxLength(180);
            item.Property(i => i.LabelNormalized).HasMaxLength(180);

            item.HasIndex(i => new { i.CabinetIdentityId, i.SectionNormalized, i.LabelNormalized }).IsUnique();
            item.HasIndex(i => new { i.CabinetIdentityId, i.SectionNormalized });
        });

        modelBuilder.Entity<InterrogatoireAnomaly>(a =>
        {
            a.Property(a => a.Section)
            .HasConversion<string>()
            .HasMaxLength(32);

            a.Property(a => a.TemplateKey).HasMaxLength(100);
            a.Property(a => a.SortOrder).HasDefaultValue(0);
            a.Property(a => a.Payload).HasColumnType("jsonb");

            a.HasIndex(a => new { a.ConsultationId, a.Section, a.SortOrder });
            a.HasIndex(a => new { a.ConsultationId, a.TemplateKey });
            a.HasIndex(a => a.Payload).HasMethod("gin");
        });

        modelBuilder.Entity<InterrogatoireAnomalyCatalogHidden>(h =>
        {
            h.Property(h => h.Section)
            .HasConversion<string>()
            .HasMaxLength(32);

            h.Property(h => h.Label).HasMaxLength(120);
            h.Property(h => h.LabelNormalized).HasMaxLength(120);

            h.HasIndex(h => new { h.CabinetIdentityId, h.Section, h.LabelNormalized }).IsUnique();
            h.HasIndex(h => new { h.CabinetIdentityId, h.Section });
        });

        modelBuilder.Entity<InterrogatoireAnomalyCatalogCustom>(c =>
        {
            c.Property(c => c.Section)
            .HasConversion<string>()
            .HasMaxLength(32);

            c.Property(c => c.TemplateKey).HasMaxLength(140);
            c.Property(c => c.Label).HasMaxLength(140);
            c.Property(c => c.LabelNormalized).HasMaxLength(140);

            c.HasIndex(c => new { c.CabinetIdentityId, c.Section, c.LabelNormalized }).IsUnique();
            c.HasIndex(c => new { c.CabinetIdentityId, c.Section });
        });

        modelBuilder.Entity<OngoingTreatmentMedicine>(t =>
        {
            t.Property(t => t.Medicine).HasMaxLength(180);
            t.Property(t => t.TherapeuticClass).HasMaxLength(120);
            t.Property(t => t.Category).HasMaxLength(120);
            t.Property(t => t.Posology).HasMaxLength(400);
            t.Property(t => t.Duration).HasMaxLength(80);
            t.Property(t => t.Date).HasMaxLength(20);
            t.HasIndex(t => t.ConsultationId);
        });

        modelBuilder.Entity<TreatmentMedicineCatalogItem>(item =>
        {
            item.Property(i => i.Label).HasMaxLength(180);
            item.Property(i => i.LabelNormalized).HasMaxLength(180);
            item.HasIndex(i => new { i.CabinetIdentityId, i.LabelNormalized }).IsUnique();
        });

        modelBuilder.Entity<TherapeuticClassCatalogItem>(item =>
        {
            item.Property(i => i.Label).HasMaxLength(120);
            item.Property(i => i.LabelNormalized).HasMaxLength(120);
            item.HasIndex(i => new { i.CabinetIdentityId, i.LabelNormalized }).IsUnique();
        });

        modelBuilder.Entity<TreatmentCategoryCatalogItem>(item =>
        {
            item.Property(i => i.Label).HasMaxLength(120);
            item.Property(i => i.LabelNormalized).HasMaxLength(120);
            item.HasIndex(i => new { i.CabinetIdentityId, i.LabelNormalized }).IsUnique();
        });

        modelBuilder.Entity<TreatmentCatalogRelationItem>(item =>
        {
            item.Property(i => i.TherapeuticClass).HasMaxLength(120);
            item.Property(i => i.TherapeuticClassNormalized).HasMaxLength(120);
            item.Property(i => i.Category).HasMaxLength(120);
            item.Property(i => i.CategoryNormalized).HasMaxLength(120);
            item.Property(i => i.Medicine).HasMaxLength(180);
            item.Property(i => i.MedicineNormalized).HasMaxLength(180);

            item.HasIndex(i => new
            {
                i.CabinetIdentityId,
                i.TherapeuticClassNormalized,
                i.CategoryNormalized,
                i.MedicineNormalized,
            }).IsUnique();

            item.HasIndex(i => new { i.CabinetIdentityId, i.TherapeuticClassNormalized, i.CategoryNormalized });
            item.HasIndex(i => new { i.CabinetIdentityId, i.CategoryNormalized, i.MedicineNormalized });
        });

        modelBuilder.Entity<Rdv>(r =>
        {
            r.HasOne(r => r.CabinetIdentity)
            .WithMany()
            .HasForeignKey(r => r.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);

            r.HasOne(r => r.Patient)
            .WithMany()
            .HasForeignKey(r => r.PatientId)
            .OnDelete(DeleteBehavior.SetNull);

            r.Property(r => r.Status)
            .HasConversion<string>()
            .HasMaxLength(32);

            r.Property(r => r.Date).HasMaxLength(20);
            r.Property(r => r.Time).HasMaxLength(20);
            r.Property(r => r.Motifs).HasColumnType("text[]");

            r.HasIndex(r => new { r.CabinetIdentityId, r.Date });
        });

        modelBuilder.Entity<Leave>(l =>
        {
            l.HasOne(l => l.CabinetIdentity)
            .WithMany()
            .HasForeignKey(l => l.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);

            l.Property(l => l.Date).HasMaxLength(20);
            l.Property(l => l.Type).HasMaxLength(64);

            l.HasIndex(l => new { l.CabinetIdentityId, l.Date });
        });

        modelBuilder.Entity<CalendarSettings>(cs =>
        {
            cs.HasOne(cs => cs.CabinetIdentity)
            .WithMany()
            .HasForeignKey(cs => cs.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);

            cs.HasIndex(cs => cs.CabinetIdentityId).IsUnique();
        });

        modelBuilder.Entity<InternalMessage>(message =>
        {
            message.HasOne(m => m.CabinetIdentity)
            .WithMany()
            .HasForeignKey(m => m.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);

            message.Property(m => m.RoomId).HasMaxLength(120);
            message.Property(m => m.Sender).HasMaxLength(32);
            message.Property(m => m.Content).HasColumnType("text");
            message.Property(m => m.SeenBy).HasColumnType("text[]");

            message.HasIndex(m => new { m.CabinetIdentityId, m.RoomId, m.CreatedAt });
            message.HasIndex(m => m.RoomId);
        });

        modelBuilder.Entity<AiChatSession>(session =>
        {
            session.HasOne(s => s.CabinetIdentity)
            .WithMany()
            .HasForeignKey(s => s.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);

            session.HasMany(s => s.Messages)
            .WithOne(m => m.Session)
            .HasForeignKey(m => m.AiChatSessionId)
            .OnDelete(DeleteBehavior.Cascade);

            session.Property(s => s.Title).HasMaxLength(180);
            session.Property(s => s.Context).HasColumnType("text");

            session.HasIndex(s => new { s.CabinetIdentityId, s.UpdatedAt });
            session.HasIndex(s => s.DeletedAt);
        });

        modelBuilder.Entity<AiChatMessage>(message =>
        {
            message.Property(m => m.Role).HasMaxLength(24);
            message.Property(m => m.Status).HasMaxLength(24);
            message.Property(m => m.Error).HasMaxLength(240);
            message.Property(m => m.Content).HasColumnType("text");

            message.HasIndex(m => new { m.AiChatSessionId, m.SortOrder });
            message.HasIndex(m => m.DeletedAt);
        });

        modelBuilder.Entity<DoctorSuggestion>(suggestion =>
        {
            suggestion.HasOne(item => item.CabinetIdentity)
            .WithMany()
            .HasForeignKey(item => item.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);

            suggestion.HasMany(item => item.Replies)
            .WithOne(reply => reply.Suggestion)
            .HasForeignKey(reply => reply.DoctorSuggestionId)
            .OnDelete(DeleteBehavior.Cascade);

            suggestion.Property(item => item.DoctorFirstName).HasMaxLength(80);
            suggestion.Property(item => item.DoctorLastName).HasMaxLength(80);
            suggestion.Property(item => item.DoctorEmail).HasMaxLength(160);
            suggestion.Property(item => item.Subject).HasMaxLength(180);
            suggestion.Property(item => item.Message).HasColumnType("text");
            suggestion.Property(item => item.Status).HasMaxLength(32).HasDefaultValue(SuggestionStatuses.Open);

            suggestion.HasIndex(item => new { item.CabinetIdentityId, item.UpdatedAt });
            suggestion.HasIndex(item => item.SeenByAdmins);
            suggestion.HasIndex(item => item.Status);
        });

        modelBuilder.Entity<DoctorSuggestionReply>(reply =>
        {
            reply.HasOne(item => item.ResponderDoctor)
            .WithMany()
            .HasForeignKey(item => item.ResponderDoctorId)
            .OnDelete(DeleteBehavior.Restrict);

            reply.Property(item => item.ResponderFirstName).HasMaxLength(80);
            reply.Property(item => item.ResponderLastName).HasMaxLength(80);
            reply.Property(item => item.ResponderRole).HasMaxLength(32);
            reply.Property(item => item.Message).HasColumnType("text");

            reply.HasIndex(item => new { item.DoctorSuggestionId, item.CreatedAt });
            reply.HasIndex(item => item.ReadByDoctor);
        });

        modelBuilder.Entity<TechAssistanceTicket>(ticket =>
        {
            ticket.HasOne(item => item.CabinetIdentity)
            .WithMany()
            .HasForeignKey(item => item.CabinetIdentityId)
            .OnDelete(DeleteBehavior.Cascade);

            ticket.HasMany(item => item.Messages)
            .WithOne(message => message.Ticket)
            .HasForeignKey(message => message.TechAssistanceTicketId)
            .OnDelete(DeleteBehavior.Cascade);

            ticket.Property(item => item.DoctorFirstName).HasMaxLength(80);
            ticket.Property(item => item.DoctorLastName).HasMaxLength(80);
            ticket.Property(item => item.DoctorEmail).HasMaxLength(160);
            ticket.Property(item => item.Subject).HasMaxLength(180);
            ticket.Property(item => item.Status).HasMaxLength(32).HasDefaultValue(TechAssistanceStatuses.Open);

            ticket.HasIndex(item => new { item.CabinetIdentityId, item.UpdatedAt });
            ticket.HasIndex(item => item.SeenByAdmins);
            ticket.HasIndex(item => item.Status);
            ticket.HasIndex(item => item.LastMessageAt);
        });

        modelBuilder.Entity<TechAssistanceMessage>(message =>
        {
            message.HasMany(item => item.Attachments)
            .WithOne(attachment => attachment.Message)
            .HasForeignKey(attachment => attachment.TechAssistanceMessageId)
            .OnDelete(DeleteBehavior.Cascade);

            message.Property(item => item.SenderFirstName).HasMaxLength(80);
            message.Property(item => item.SenderLastName).HasMaxLength(80);
            message.Property(item => item.SenderEmail).HasMaxLength(160);
            message.Property(item => item.SenderRole).HasMaxLength(32);
            message.Property(item => item.Message).HasColumnType("text");

            message.HasIndex(item => new { item.TechAssistanceTicketId, item.CreatedAt });
            message.HasIndex(item => item.ReadByRequester);
            message.HasIndex(item => item.SenderRole);
        });

        modelBuilder.Entity<TechAssistanceAttachment>(attachment =>
        {
            attachment.Property(item => item.OriginalFileName).HasMaxLength(260);
            attachment.Property(item => item.StoredFileName).HasMaxLength(200);
            attachment.Property(item => item.RelativeFilePath).HasMaxLength(420);
            attachment.Property(item => item.ContentType).HasMaxLength(120);

            attachment.HasIndex(item => item.TechAssistanceMessageId);
        });
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<DateTime>()
               .HaveConversion<UtcDateTimeConverter>();
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries<BaseEntity>();
        var utcNow = DateTime.UtcNow;

        foreach (var entry in entries)
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = utcNow;
                    entry.Entity.UpdatedAt = utcNow;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = utcNow;
                    break;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
