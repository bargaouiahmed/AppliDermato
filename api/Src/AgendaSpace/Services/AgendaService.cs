using System.Globalization;
using System.Text;
using api.Src.AgendaSpace.Dtos.Requests;
using api.Src.AgendaSpace.Entities;
using api.Src.Realtime;
using Microsoft.EntityFrameworkCore;

namespace api.Src.AgendaSpace.Services;

public class AgendaService(AppDbContext dbContext, IWaitingRoomNotifier waitingRoomNotifier)
{
    private readonly AppDbContext _dbContext = dbContext;

    private static readonly IReadOnlyList<FixedHoliday> TunisiaFixedHolidays = new List<FixedHoliday>
    {
        new("01-01", "Jour de l'An"),
        new("03-20", "Fête de l'Indépendance"),
        new("04-09", "Journée des Martyrs"),
        new("05-01", "Fête du Travail"),
        new("07-25", "Fête de la République"),
        new("08-13", "Fête de la Femme"),
        new("10-15", "Fête de l'Évacuation"),
    };

    public async Task<List<Rdv>> GetRdvsByMonthAsync(Guid cabinetId, string monthPrefix)
    {
        return await _dbContext.Rdvs
            .Include(r => r.Patient)
            .Where(r => r.CabinetIdentityId == cabinetId && r.Date.StartsWith(monthPrefix))
            .OrderBy(r => r.Date)
            .ThenBy(r => r.Time)
            .ToListAsync();
    }

    public async Task<Rdv?> GetRdvByIdAsync(Guid cabinetId, Guid rdvId)
    {
        return await _dbContext.Rdvs
            .Include(r => r.Patient)
            .FirstOrDefaultAsync(r => r.CabinetIdentityId == cabinetId && r.Id == rdvId);
    }

    public async Task<Rdv> CreateRdvAsync(Rdv rdv)
    {
        rdv.CabinetIdentity = null;
        rdv.Patient = null;
        rdv.Date = rdv.Date.Trim();
        rdv.Time = rdv.Time.Trim();
        rdv.Duration = NormalizeDuration(rdv.Duration);
        rdv.PatientId = rdv.IsPersonnel ? null : rdv.PatientId;
        rdv.PersonnelDescription = NormalizeOptionalString(rdv.PersonnelDescription);
        rdv.PersonnelDuration = rdv.IsPersonnel ? (rdv.PersonnelDuration ?? rdv.Duration) : null;
        rdv.Motifs = NormalizeMotifs(rdv.Motifs);

        await ValidateRdvAsync(rdv);

        _dbContext.Rdvs.Add(rdv);
        await _dbContext.SaveChangesAsync();

        await waitingRoomNotifier.NotifyCabinetUpdated(
            rdv.CabinetIdentityId,
            null,
            "rdv-created");

        return await _dbContext.Rdvs
            .Include(r => r.Patient)
            .FirstAsync(r => r.Id == rdv.Id);
    }

    public async Task<Rdv> CreateConsultationRdvAsync(
        Guid cabinetId,
        Guid consultationId,
        CreateConsultationRdvRequest request)
    {
        var consultation = await _dbContext.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetId && c.Id == consultationId)
            .Select(c => new { c.PatientId })
            .FirstOrDefaultAsync();

        if (consultation == null)
        {
            throw new InvalidOperationException("Consultation introuvable.");
        }

        return await CreateRdvAsync(new Rdv
        {
            CabinetIdentityId = cabinetId,
            PatientId = consultation.PatientId,
            Date = request.Date,
            Time = request.Time,
            Duration = request.Duration,
            Motifs = request.Motifs,
            IsPersonnel = false,
            Status = RdvStatus.Confirme,
        });
    }

    public async Task<Rdv> UpdateRdvAsync(Rdv rdv)
    {
        var existing = await _dbContext.Rdvs
            .FirstOrDefaultAsync(r => r.CabinetIdentityId == rdv.CabinetIdentityId && r.Id == rdv.Id);

        if (existing == null)
        {
            throw new InvalidOperationException("Rendez-vous introuvable.");
        }

        existing.PatientId = rdv.IsPersonnel ? null : rdv.PatientId;
        existing.Date = rdv.Date.Trim();
        existing.Time = rdv.Time.Trim();
        existing.Duration = NormalizeDuration(rdv.Duration);
        existing.Motifs = NormalizeMotifs(rdv.Motifs);
        existing.IsPersonnel = rdv.IsPersonnel;
        existing.PersonnelDescription = NormalizeOptionalString(rdv.PersonnelDescription);
        existing.PersonnelDuration = rdv.IsPersonnel ? (rdv.PersonnelDuration ?? existing.Duration) : null;

        await ValidateRdvAsync(existing);
        await _dbContext.SaveChangesAsync();

        await waitingRoomNotifier.NotifyCabinetUpdated(
            existing.CabinetIdentityId,
            null,
            "rdv-updated");

        return await _dbContext.Rdvs
            .Include(r => r.Patient)
            .FirstAsync(r => r.Id == existing.Id);
    }

    public async Task DeleteRdvAsync(Guid cabinetId, Guid rdvId)
    {
        var rdv = await _dbContext.Rdvs
            .FirstOrDefaultAsync(r => r.CabinetIdentityId == cabinetId && r.Id == rdvId);

        if (rdv == null)
        {
            return;
        }

        _dbContext.Rdvs.Remove(rdv);
        await _dbContext.SaveChangesAsync();

        await waitingRoomNotifier.NotifyCabinetUpdated(
            cabinetId,
            null,
            "rdv-deleted");
    }

    public async Task<List<Leave>> GetLeavesByYearAsync(Guid cabinetId, string yearPrefix)
    {
        var requestedYearLeaves = await _dbContext.Leaves
            .Where(l => l.CabinetIdentityId == cabinetId && l.Date.StartsWith(yearPrefix))
            .OrderBy(l => l.Date)
            .ThenBy(l => l.StartTime)
            .ToListAsync();

        if (!int.TryParse(yearPrefix, out var requestedYear))
        {
            return requestedYearLeaves;
        }

        var recurringLeaves = await _dbContext.Leaves
            .Where(l => l.CabinetIdentityId == cabinetId && l.IsRecurring)
            .OrderBy(l => l.Date)
            .ThenBy(l => l.StartTime)
            .ToListAsync();

        var merged = requestedYearLeaves.ToDictionary(leave => leave.Id, leave => leave);

        foreach (var recurringLeave in recurringLeaves)
        {
            var projected = ProjectRecurringLeaveToYear(recurringLeave, requestedYear);
            if (projected == null)
            {
                continue;
            }

            merged[projected.Id] = projected;
        }

        return merged.Values
            .OrderBy(leave => leave.Date)
            .ThenBy(leave => leave.StartTime ?? string.Empty)
            .ToList();
    }

    public async Task<Leave> CreateLeaveAsync(Leave leave)
    {
        leave.CabinetIdentity = null;
        NormalizeLeave(leave);

        _dbContext.Leaves.Add(leave);
        await _dbContext.SaveChangesAsync();

        return leave;
    }

    public async Task<Leave> UpdateLeaveAsync(Leave leave)
    {
        var existing = await _dbContext.Leaves
            .FirstOrDefaultAsync(l => l.CabinetIdentityId == leave.CabinetIdentityId && l.Id == leave.Id);

        if (existing == null)
        {
            throw new InvalidOperationException("Conge introuvable.");
        }

        existing.Date = leave.Date;
        existing.IsFullDay = leave.IsFullDay;
        existing.StartTime = leave.StartTime;
        existing.EndTime = leave.EndTime;
        existing.Type = leave.Type;
        existing.Name = leave.Name;
        existing.Description = leave.Description;
        existing.IsRecurring = leave.IsRecurring;

        NormalizeLeave(existing);
        await _dbContext.SaveChangesAsync();

        return existing;
    }

    public async Task DeleteLeaveAsync(Guid cabinetId, Guid leaveId)
    {
        var leave = await _dbContext.Leaves
            .FirstOrDefaultAsync(l => l.CabinetIdentityId == cabinetId && l.Id == leaveId);

        if (leave == null)
        {
            return;
        }

        _dbContext.Leaves.Remove(leave);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<CalendarSettings> GetSettingsAsync(Guid cabinetId)
    {
        var settings = await _dbContext.CalendarSettings
            .FirstOrDefaultAsync(s => s.CabinetIdentityId == cabinetId);

        if (settings != null)
        {
            return settings;
        }

        settings = new CalendarSettings { CabinetIdentityId = cabinetId };
        _dbContext.CalendarSettings.Add(settings);
        await _dbContext.SaveChangesAsync();

        return settings;
    }

    public async Task<CalendarSettings> UpdateSettingsAsync(CalendarSettings settings)
    {
        ValidateCalendarSettings(settings);

        var existing = await _dbContext.CalendarSettings
            .FirstOrDefaultAsync(s => s.CabinetIdentityId == settings.CabinetIdentityId);

        if (existing == null)
        {
            _dbContext.CalendarSettings.Add(settings);
            await _dbContext.SaveChangesAsync();
            return settings;
        }

        existing.StartHour = settings.StartHour;
        existing.EndHour = settings.EndHour;
        existing.TimeSlotInterval = settings.TimeSlotInterval;

        await _dbContext.SaveChangesAsync();
        return existing;
    }

    public IReadOnlyList<FixedHoliday> GetFixedHolidays()
    {
        return TunisiaFixedHolidays;
    }

    private async Task ValidateRdvAsync(Rdv rdv)
    {
        if (string.IsNullOrWhiteSpace(rdv.Date))
        {
            throw new InvalidOperationException("La date du rendez-vous est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(rdv.Time))
        {
            throw new InvalidOperationException("L'heure du rendez-vous est obligatoire.");
        }

        var startMinutes = ParseTimeToMinutes(rdv.Time);
        var duration = NormalizeDuration(rdv.Duration);
        var endMinutes = startMinutes + duration;

        var settings = await GetSettingsAsync(rdv.CabinetIdentityId);
        var agendaStartMinutes = settings.StartHour * 60;
        var agendaEndMinutes = settings.EndHour * 60;

        if (startMinutes < agendaStartMinutes || endMinutes > agendaEndMinutes)
        {
            throw new InvalidOperationException("Le rendez-vous doit rester dans les heures d'ouverture.");
        }

        var blockingLeaves = await GetBlockingLeavesForDateAsync(rdv.CabinetIdentityId, rdv.Date);
        if (blockingLeaves.Any(leave => LeaveBlocksRange(leave, startMinutes, endMinutes)))
        {
            throw new InvalidOperationException("Ce creneau est bloque par un conge ou un jour ferie.");
        }
    }

    private static void ValidateCalendarSettings(CalendarSettings settings)
    {
        if (settings.TimeSlotInterval <= 0)
        {
            throw new InvalidOperationException("L'intervalle des créneaux doit être supérieur à zéro.");
        }

        if (settings.StartHour < 0 || settings.StartHour > 23)
        {
            throw new InvalidOperationException("L'heure de début doit être comprise entre 0 et 23.");
        }

        if (settings.EndHour < 1 || settings.EndHour > 23)
        {
            throw new InvalidOperationException("L'heure de fin doit être comprise entre 1 et 23.");
        }

        if (settings.StartHour >= settings.EndHour)
        {
            throw new InvalidOperationException("L'heure de début doit être antérieure à l'heure de fin.");
        }
    }

    private async Task<List<Leave>> GetBlockingLeavesForDateAsync(Guid cabinetId, string date)
    {
        if (date.Length < 10)
        {
            return [];
        }

        var monthDay = date.Substring(5, 5);

        return await _dbContext.Leaves
            .Where(leave =>
                leave.CabinetIdentityId == cabinetId
                && (leave.Date == date || (leave.IsRecurring && leave.Date.EndsWith(monthDay))))
            .ToListAsync();
    }

    private static bool LeaveBlocksRange(Leave leave, int startMinutes, int endMinutes)
    {
        if (leave.IsFullDay)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(leave.StartTime) || string.IsNullOrWhiteSpace(leave.EndTime))
        {
            return false;
        }

        var leaveStart = ParseTimeToMinutes(leave.StartTime);
        var leaveEnd = ParseTimeToMinutes(leave.EndTime);

        return startMinutes < leaveEnd && endMinutes > leaveStart;
    }

    private static Leave? ProjectRecurringLeaveToYear(Leave leave, int requestedYear)
    {
        if (!leave.IsRecurring
            || !DateOnly.TryParseExact(leave.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var sourceDate))
        {
            return null;
        }

        var day = Math.Min(sourceDate.Day, DateTime.DaysInMonth(requestedYear, sourceDate.Month));

        return new Leave
        {
            Id = leave.Id,
            CabinetIdentityId = leave.CabinetIdentityId,
            CabinetIdentity = leave.CabinetIdentity,
            Date = $"{requestedYear:D4}-{sourceDate.Month:D2}-{day:D2}",
            IsFullDay = leave.IsFullDay,
            StartTime = leave.StartTime,
            EndTime = leave.EndTime,
            Type = leave.Type,
            Name = leave.Name,
            Description = leave.Description,
            IsRecurring = leave.IsRecurring,
            CreatedAt = leave.CreatedAt,
            UpdatedAt = leave.UpdatedAt,
        };
    }

    private static void NormalizeLeave(Leave leave)
    {
        if (string.IsNullOrWhiteSpace(leave.Date))
        {
            throw new InvalidOperationException("La date du conge est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(leave.Name))
        {
            throw new InvalidOperationException("Le nom du conge est obligatoire.");
        }

        leave.Date = leave.Date.Trim();
        leave.Type = string.IsNullOrWhiteSpace(leave.Type) ? "annual" : leave.Type.Trim();
        leave.Name = leave.Name.Trim();
        leave.Description = NormalizeOptionalString(leave.Description);

        if (leave.IsFullDay)
        {
            leave.StartTime = null;
            leave.EndTime = null;
            return;
        }

        leave.StartTime = NormalizeOptionalString(leave.StartTime);
        leave.EndTime = NormalizeOptionalString(leave.EndTime);

        if (leave.StartTime == null || leave.EndTime == null)
        {
            throw new InvalidOperationException("Les heures du conge sont obligatoires.");
        }

        if (ParseTimeToMinutes(leave.StartTime) >= ParseTimeToMinutes(leave.EndTime))
        {
            throw new InvalidOperationException("La plage horaire du conge est invalide.");
        }
    }

    private static string[]? NormalizeMotifs(string[]? motifs)
    {
        if (motifs == null || motifs.Length == 0)
        {
            return null;
        }

        var normalized = motifs
            .Select(motif => motif?.Trim() ?? string.Empty)
            .Where(motif => motif.Length > 0)
            .GroupBy(NormalizeMotifKey, StringComparer.Ordinal)
            .Select(group => group.First())
            .ToArray();

        return normalized.Length > 0 ? normalized : null;
    }

    private static string NormalizeMotifKey(string value)
    {
        var compact = string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrWhiteSpace(compact))
        {
            return string.Empty;
        }

        var decomposed = compact
            .ToLowerInvariant()
            .Normalize(NormalizationForm.FormD);

        var builder = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (ch is 'œ')
            {
                builder.Append("oe");
                continue;
            }

            builder.Append(char.IsLetterOrDigit(ch) ? ch : ' ');
        }

        return string.Join(
            ' ',
            builder
                .ToString()
                .Normalize(NormalizationForm.FormC)
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static int NormalizeDuration(int duration)
    {
        return duration > 0 ? duration : 15;
    }

    private static string? NormalizeOptionalString(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static int ParseTimeToMinutes(string time)
    {
        if (!TimeOnly.TryParseExact(time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            throw new InvalidOperationException("Format d'heure invalide.");
        }

        return (parsed.Hour * 60) + parsed.Minute;
    }
}

public sealed record FixedHoliday(string Date, string Name);
