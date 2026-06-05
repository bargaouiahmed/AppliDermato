using System;
using api.DatabaseRules;

namespace api.Src.Subscription.Entities;

public class FileToDelete : BaseEntity
{
    public Guid Id { get; set; }
    public string FilePath { get; set; } = string.Empty;
}
