using System;
using Microsoft.AspNetCore.Http.HttpResults;

namespace api.DatabaseRules;

public class BaseEntity
{
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

}
