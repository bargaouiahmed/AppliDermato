using System;
using api.DatabaseRules;

namespace api.Src.ConsultationSpace.Entities;

public class ConsultationMotif : BaseEntity
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    public string Value { get; set; } = string.Empty;
    public string ValueNormalized { get; set; } = string.Empty;

    public Consultation Consultation { get; set; } = null!;
}
