using System;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace api.Converters;

public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter() : base(
        v => v.ToUniversalTime(),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
    {
    }

}
