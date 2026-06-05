using System;
using api.DatabaseRules;
using api.Src.Auth.Entities;
using api.Src.ConsultationSpace.ConduiteSection.Entities;
using api.Src.ConsultationSpace.DocumentsSection.Entities;
using api.Src.ConsultationSpace.ExamSection.Entities;
using api.Src.ConsultationSpace.InterrogationSection.Entities;
using api.Src.PatientSpace.Entities;

namespace api.Src.ConsultationSpace.Entities;

public class Consultation : BaseEntity
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public DateTime ConsultationDate { get; set; }
    public int DurationSeconds { get; set; }
    public string ConduiteAdditionalInformation { get; set; } = string.Empty;
    public bool IsTimerPaused { get; set; }
    public bool IsDone { get; set; }
    public CabinetIdentity CabinetIdentity { get; set; } = null!;
    public Patient Patient { get; set; } = null!;

    public ICollection<ConsultationMotif> Motifs { get; set; } = [];
    public Interrogatoire Interrogatoire { get; set; } = null!;
    public ConsultationExam? Exam { get; set; }
    public ICollection<ConsultationConduiteAction> ConduiteActions { get; set; } = [];
    public ICollection<ConsultationExplorationDocument> ExplorationDocuments { get; set; } = [];
}
