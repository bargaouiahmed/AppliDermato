using System;
using System.Text;
using api.Src.PatientSpace.Dtos.requests;
using api.Src.PatientSpace.Dtos.responses;
using api.Src.PatientSpace.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace api.Src.PatientSpace.Services;

public class PatientService(AppDbContext db) : IPatientService
{
    public async Task AddPatient(AddPatientRequest request, Guid cabinetIdentityId)
    {
        var cabinetIdentity = await db.CabinetIdentities.FirstOrDefaultAsync(ci => ci.Id == cabinetIdentityId) ?? throw new InvalidOperationException("Cabinet identity not found.");
        if (!cabinetIdentity.IsActive) throw new InvalidOperationException("Cabinet identity is not active.");
        if (cabinetIdentity.IsFlaggedForDeletion) throw new InvalidOperationException("Cabinet identity is flagged for deletion.");

        var nextDossierNumber = (await db.Patients
            .Where(p => p.CabinetIdentityId == cabinetIdentityId)
            .Select(p => (int?)p.DossierNumber)
            .MaxAsync() ?? 0) + 1;

        var normalizedEmail = request.Email.Trim();

        var patient = new Patient
        {
            Firstname = request.Firstname.Trim(),
            Lastname = request.Lastname.Trim(),
            Email = normalizedEmail,
            PhoneNumber = request.PhoneNumber.Trim(),
            DateOfBirth = DateTime.SpecifyKind(request.DateOfBirth.Date, DateTimeKind.Utc),
            Country = request.Country.Trim(),
            Profession = request.Profession.Trim(),
            WorkPlace = request.WorkPlace.Trim(),
            Sex = request.Sex.Trim(),
            FamilialStatus = request.FamilialStatus.Trim(),
            City = request.City.Trim(),
            Address = request.Address.Trim(),
            PostalCode = request.PostalCode.Trim(),
            APCI = request.APCI.Trim(),
            InsuranceType = request.InsuranceType.Trim(),
            InsuranceEstablishment = request.InsuranceEstablishment.Trim(),
            DossierNumber = nextDossierNumber,
            CabinetIdentityId = cabinetIdentityId
        };
        db.Patients.Add(patient);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            if (string.Equals(pgEx.ConstraintName, "IX_Patients_Email", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("A patient with the same email already exists.");
            }

            throw new InvalidOperationException("A duplicate value violated a database unique constraint while adding the patient.");
        }
        catch (DbUpdateException ex)
        {
            Console.Error.WriteLine($"Error adding patient: {ex.InnerException?.Message ?? ex.Message}");
            throw new InvalidOperationException("An error occurred while adding the patient. Please try again.", ex);
        }
    }
    public async Task<PatientResponse> GetPatientById(Guid id, Guid cabinetIdentityId)
    {
        var patient = await db.Patients
        .AsNoTracking()
        .Where(p => p.Id == id && p.CabinetIdentityId == cabinetIdentityId)
        .Select(p => new PatientResponse
        {
            Id = p.Id,
            DossierNumber = p.DossierNumber,
            ConsultationCount = p.Consultations.Count,
            Firstname = p.Firstname,
            Lastname = p.Lastname,
            Email = p.Email,
            PhoneNumber = p.PhoneNumber,
            DateOfBirth = p.DateOfBirth,
            Country = p.Country,
            Profession = p.Profession,
            WorkPlace = p.WorkPlace,
            Sex = p.Sex,
            FamilialStatus = p.FamilialStatus,
            City = p.City,
            Address = p.Address,
            PostalCode = p.PostalCode,
            APCI = p.APCI,
            InsuranceType = p.InsuranceType,
            InsuranceEstablishment = p.InsuranceEstablishment
        }).FirstOrDefaultAsync() ?? throw new InvalidOperationException("Patient not found.");
        return patient;
    }
    public async Task UpdatePatient(Guid id, UpdatePateinetRequest request, Guid cabinetIdentityId)
    {
        var patient = await db.Patients.FirstOrDefaultAsync(p => p.Id == id && p.CabinetIdentityId == cabinetIdentityId) ?? throw new InvalidOperationException("Patient not found.");
        if (request.Firstname != null) patient.Firstname = request.Firstname;
        if (request.Lastname != null) patient.Lastname = request.Lastname;
        if (request.Email != null) patient.Email = request.Email;
        if (request.PhoneNumber != null) patient.PhoneNumber = request.PhoneNumber;
        if (request.DateOfBirth != null) patient.DateOfBirth = DateTime.SpecifyKind(request.DateOfBirth.Value.Date, DateTimeKind.Utc);
        if (request.Country != null) patient.Country = request.Country;
        if (request.Profession != null) patient.Profession = request.Profession;
        if (request.WorkPlace != null) patient.WorkPlace = request.WorkPlace;
        if (request.Sex != null) patient.Sex = request.Sex;
        if (request.FamilialStatus != null) patient.FamilialStatus = request.FamilialStatus;
        if (request.City != null) patient.City = request.City;
        if (request.Address != null) patient.Address = request.Address;
        if (request.PostalCode != null) patient.PostalCode = request.PostalCode;
        if (request.APCI != null) patient.APCI = request.APCI;
        if (request.InsuranceType != null) patient.InsuranceType = request.InsuranceType;
        if (request.InsuranceEstablishment != null) patient.InsuranceEstablishment = request.InsuranceEstablishment;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            if (string.Equals(pgEx.ConstraintName, "IX_Patients_Email", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("A patient with the same email already exists.");
            }

            throw new InvalidOperationException("A duplicate value violated a database unique constraint while updating the patient.");
        }
        catch (Exception ex)
        {
            throw new Exception("An error occurred while updating the patient. Please try again.", ex);
        }
    }
    public async Task DeletePatient(Guid id, Guid cabinetIdentityId)
    {
        try
        {
            await db.Patients.Where(p => p.Id == id && p.CabinetIdentityId == cabinetIdentityId).ExecuteDeleteAsync();
        }
        catch (Exception ex)
        {
            throw new Exception("An error occurred while deleting the patient. Please try again.", ex);
        }
    }
    public async Task<ListPatientResponse> GetAllPatientsForCabinet(Guid cabinetIdentityId, int pageNumber, int pageSize, string? searchQuery, string? dateOfBirth, string? sortBy, string? sortDirection, int? dossierNumber = null, string? phoneNumber = null, string? name = null, string? email = null, string? firstname = null, string? lastname = null, int? age = null)
    {
        var query = db.Patients
            .AsNoTracking()
            .Where(p => p.CabinetIdentityId == cabinetIdentityId);

        if (dossierNumber.HasValue)
        {
            query = query.Where(p => p.DossierNumber == dossierNumber.Value);
        }

        if (!string.IsNullOrEmpty(phoneNumber))
        {
            var phone = phoneNumber.Trim().ToLower();
            query = query.Where(p => p.PhoneNumber.ToLower().Contains(phone));
        }

        if (!string.IsNullOrEmpty(email))
        {
            var mail = email.Trim().ToLower();
            query = query.Where(p => p.Email.ToLower().Contains(mail));
        }

        if (!string.IsNullOrEmpty(name))
        {
            var nameSearch = name.Trim().ToLower();
            query = query.Where(p =>
                p.Firstname.ToLower().Contains(nameSearch) ||
                p.Lastname.ToLower().Contains(nameSearch) ||
                (p.Firstname.ToLower() + " " + p.Lastname.ToLower()).Contains(nameSearch) ||
                (p.Lastname.ToLower() + " " + p.Firstname.ToLower()).Contains(nameSearch));
        }

        if (!string.IsNullOrEmpty(lastname))
        {
            var lastnameSearch = lastname.Trim().ToLower();
            query = query.Where(p => p.Lastname.ToLower().Contains(lastnameSearch));
        }

        if (!string.IsNullOrEmpty(firstname))
        {
            var firstnameSearch = firstname.Trim().ToLower();
            query = query.Where(p => p.Firstname.ToLower().Contains(firstnameSearch));
        }

        if (!string.IsNullOrEmpty(dateOfBirth))
        {
            var dobStr = dateOfBirth.Trim();
            if (DateTime.TryParseExact(dobStr, "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out var parsedDate))
            {
                // To account for existing data that might be shifted by a few hours due to UTC conversion
                // we search a wider range to catch patients born on that day regardless of 1-12h shifts.
                var targetUtc = DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc);
                var startDate = targetUtc.AddHours(-14); // Covers previous day's late hours
                var endDate = targetUtc.AddHours(38);   // Covers the target day and some of next
                query = query.Where(p => p.DateOfBirth >= startDate && p.DateOfBirth < endDate);
            }
            else if (int.TryParse(dobStr, out int birthYear) && birthYear > 1850 && birthYear < 2100)
            {
                var yearStart = new DateTime(birthYear, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddHours(-14);
                var yearEnd = new DateTime(birthYear, 12, 31, 23, 59, 59, DateTimeKind.Utc).AddHours(14);
                query = query.Where(p => p.DateOfBirth >= yearStart && p.DateOfBirth < yearEnd);
            }
        }

        query = ApplyAgeFilter(query, age);

        if (!string.IsNullOrEmpty(sortBy))
        {
            bool ascending = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
            query = sortBy.ToLower() switch
            {
                "firstname" => ascending ? query.OrderBy(p => p.Firstname) : query.OrderByDescending(p => p.Firstname),
                "lastname" => ascending ? query.OrderBy(p => p.Lastname) : query.OrderByDescending(p => p.Lastname),
                "email" => ascending ? query.OrderBy(p => p.Email) : query.OrderByDescending(p => p.Email),
                "phonenumber" => ascending ? query.OrderBy(p => p.PhoneNumber) : query.OrderByDescending(p => p.PhoneNumber),
                "createdat" => ascending ? query.OrderBy(p => p.CreatedAt) : query.OrderByDescending(p => p.CreatedAt),
                "dateofbirth" => ascending ? query.OrderBy(p => p.DateOfBirth) : query.OrderByDescending(p => p.DateOfBirth),
                "updatedat" => ascending ? query.OrderBy(p => p.UpdatedAt) : query.OrderByDescending(p => p.UpdatedAt),
                _ => query.OrderBy(p => p.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(p => p.CreatedAt);
        }

        var totalCount = await query.CountAsync();
        var patients = await query.Skip((pageNumber - 1) * pageSize).Take(pageSize).Select(p => new PatientResponse
        {
            Id = p.Id,
            DossierNumber = p.DossierNumber,
            ConsultationCount = p.Consultations.Count,
            Firstname = p.Firstname,
            Lastname = p.Lastname,
            Email = p.Email,
            PhoneNumber = p.PhoneNumber,
            DateOfBirth = p.DateOfBirth,
            Country = p.Country,
            Profession = p.Profession,
            WorkPlace = p.WorkPlace,
            Sex = p.Sex,
            FamilialStatus = p.FamilialStatus,
            City = p.City,
            Address = p.Address,
            PostalCode = p.PostalCode,
            APCI = p.APCI,
            InsuranceType = p.InsuranceType,
            InsuranceEstablishment = p.InsuranceEstablishment
        }).ToListAsync();
        return new ListPatientResponse
        {
            Patients = patients,
            TotalCount = totalCount
        };


    }

    public async Task<ListPatientProfessionsResponse> GetPatientProfessions(Guid cabinetIdentityId, int pageNumber, int pageSize, string? searchQuery)
    {
        if (pageNumber < 1) pageNumber = 1;
        if (pageSize < 1) pageSize = 25;
        if (pageSize > 100) pageSize = 100;

        var query = db.Patients
            .AsNoTracking()
            .Where(p =>
                p.CabinetIdentityId == cabinetIdentityId &&
                p.Profession != string.Empty)
            .Select(p => p.Profession.Trim())
            .Where(p => p != string.Empty);

        if (!string.IsNullOrWhiteSpace(searchQuery))
        {
            var normalizedSearch = searchQuery.Trim().ToLower();
            query = query.Where(p => p.ToLower().Contains(normalizedSearch));
        }

        var distinctQuery = query
            .GroupBy(p => p.ToLower())
            .Select(group => group.Min()!);

        var totalCount = await distinctQuery.CountAsync();
        var professions = await distinctQuery
            .OrderBy(p => p)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new ListPatientProfessionsResponse
        {
            Professions = professions,
            TotalCount = totalCount
        };
    }

    public async Task<ListPatientResponse> GetRecentPatientsForCabinet(Guid cabinetIdentityId, int pageNumber, int pageSize)
    {
        if (pageNumber < 1) pageNumber = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var query = db.Patients
            .AsNoTracking()
            .Where(p => p.CabinetIdentityId == cabinetIdentityId)
            .OrderByDescending(p => p.CreatedAt);

        var totalCount = await query.CountAsync();

        var patients = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PatientResponse
            {
                Id = p.Id,
                DossierNumber = p.DossierNumber,
                ConsultationCount = p.Consultations.Count,
                Firstname = p.Firstname,
                Lastname = p.Lastname,
                Email = p.Email,
                PhoneNumber = p.PhoneNumber,
                DateOfBirth = p.DateOfBirth,
                Country = p.Country,
                Profession = p.Profession,
                WorkPlace = p.WorkPlace,
                Sex = p.Sex,
                FamilialStatus = p.FamilialStatus,
                City = p.City,
                Address = p.Address,
                PostalCode = p.PostalCode,
                APCI = p.APCI,
                InsuranceType = p.InsuranceType,
                InsuranceEstablishment = p.InsuranceEstablishment
            })
            .ToListAsync();

        return new ListPatientResponse
        {
            Patients = patients,
            TotalCount = totalCount
        };
    }

    public async Task<ListPatientConsultationsResponse> GetPatientConsultations(Guid patientId, Guid cabinetIdentityId, int pageNumber, int pageSize)
    {
        if (pageNumber < 1) pageNumber = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var patientExists = await db.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == patientId && p.CabinetIdentityId == cabinetIdentityId);

        if (!patientExists) throw new InvalidOperationException("Patient not found.");

        var baseQuery = db.Consultations
            .AsNoTracking()
            .Where(c => c.PatientId == patientId && c.CabinetIdentityId == cabinetIdentityId);

        var totalCount = await baseQuery.CountAsync();

        var consultationsPage = await baseQuery
            .OrderByDescending(c => c.ConsultationDate)
            .ThenByDescending(c => c.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.ConsultationDate,
                c.DurationSeconds,
                c.IsTimerPaused,
                c.IsDone
            })
            .ToListAsync();

        var consultationIds = consultationsPage.Select(c => c.Id).ToList();

        var motifsByConsultationId = await db.ConsultationMotifs
            .AsNoTracking()
            .Where(m => consultationIds.Contains(m.ConsultationId))
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                m.ConsultationId,
                m.Value
            })
            .ToListAsync();

        var motifsLookup = motifsByConsultationId
            .GroupBy(m => m.ConsultationId)
            .ToDictionary(g => g.Key, g => g.Select(m => m.Value).ToList());

        var diagnosticsLookup = await db.Interrogatoires
            .AsNoTracking()
            .Where(i => consultationIds.Contains(i.ConsultationId))
            .Select(i => new { i.ConsultationId, i.Diagnostics })
            .ToListAsync()
            .ContinueWith(t => t.Result
                .GroupBy(i => i.ConsultationId)
                .ToDictionary(g => g.Key, g => g.First().Diagnostics.ToList()));

        var conduiteActionsLookup = await db.ConsultationConduiteActions
            .AsNoTracking()
            .Where(a => consultationIds.Contains(a.ConsultationId))
            .Select(a => new { a.ConsultationId, a.ActionKey })
            .ToListAsync()
            .ContinueWith(t => t.Result
                .GroupBy(a => a.ConsultationId)
                .ToDictionary(g => g.Key, g => g.Select(a => FormatConduiteActionLabel(a.ActionKey)).Distinct().ToList()));

        var consultations = consultationsPage.Select(c => new PatientConsultationResponse
        {
            Id = c.Id,
            ConsultationDate = c.ConsultationDate,
            Duration = FormatDuration(c.DurationSeconds),
            IsTimerPaused = c.IsTimerPaused,
            IsDone = c.IsDone,
            Motifs = motifsLookup.TryGetValue(c.Id, out var motifs) ? motifs : [],
            Diagnostics = diagnosticsLookup.TryGetValue(c.Id, out var diagnostics) ? diagnostics : [],
            ConduiteActions = conduiteActionsLookup.TryGetValue(c.Id, out var actions) ? actions : []
        }).ToList();

        return new ListPatientConsultationsResponse
        {
            Consultations = consultations,
            TotalCount = totalCount
        };
    }

    public async Task<List<DailyConsultationResponse>> GetConsultationsByDate(Guid cabinetIdentityId, DateTime date)
    {
        var targetDay = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);

        var consultationsRaw = await db.Consultations
            .AsNoTracking()
            .Where(c =>
                c.CabinetIdentityId == cabinetIdentityId &&
                c.ConsultationDate.Date == targetDay)
            .OrderBy(c => c.ConsultationDate)
            .ThenBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.PatientId,
                c.ConsultationDate,
                c.DurationSeconds,
                c.IsTimerPaused,
                c.IsDone,
                PatientDossierNumber = c.Patient.DossierNumber,
                PatientFirstname = c.Patient.Firstname,
                PatientLastname = c.Patient.Lastname,
                PatientProfession = c.Patient.Profession,
                PatientDateOfBirth = c.Patient.DateOfBirth
            })
            .ToListAsync();

        var consultationIds = consultationsRaw.Select(c => c.Id).ToList();
        var patientIds = consultationsRaw.Select(c => c.PatientId).Distinct().ToList();

        var motifsByConsultationId = await db.ConsultationMotifs
            .AsNoTracking()
            .Where(m => consultationIds.Contains(m.ConsultationId))
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                m.ConsultationId,
                m.Value
            })
            .ToListAsync();

        var motifsLookup = motifsByConsultationId
            .GroupBy(m => m.ConsultationId)
            .ToDictionary(g => g.Key, g => g.Select(m => m.Value).ToList());

        var consultationCountsByPatient = await db.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId && patientIds.Contains(c.PatientId))
            .GroupBy(c => c.PatientId)
            .Select(g => new
            {
                PatientId = g.Key,
                Count = g.Count()
            })
            .ToDictionaryAsync(x => x.PatientId, x => x.Count);

        return consultationsRaw.Select(c => new DailyConsultationResponse
        {
            Id = c.Id,
            PatientId = c.PatientId,
            PatientDossierNumber = c.PatientDossierNumber,
            PatientFirstname = c.PatientFirstname,
            PatientLastname = c.PatientLastname,
            PatientProfession = c.PatientProfession,
            PatientAge = CalculateAge(c.PatientDateOfBirth, targetDay),
            PatientConsultationCount = consultationCountsByPatient.TryGetValue(c.PatientId, out var count) ? count : 0,
            ConsultationDate = c.ConsultationDate,
            Duration = FormatDuration(c.DurationSeconds),
            IsTimerPaused = c.IsTimerPaused,
            IsDone = c.IsDone,
            Status = ResolveConsultationStatus(c.IsDone, c.IsTimerPaused, c.DurationSeconds),
            Motifs = motifsLookup.TryGetValue(c.Id, out var motifs) ? motifs : []
        }).ToList();
    }

    public async Task<List<string>> GetConsultationDates(Guid cabinetIdentityId, int year, int month)
    {
        if (month < 1 || month > 12)
        {
            throw new InvalidOperationException("Month must be between 1 and 12.");
        }

        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);

        var dates = await db.Consultations
            .AsNoTracking()
            .Where(c =>
                c.CabinetIdentityId == cabinetIdentityId &&
                c.ConsultationDate >= start &&
                c.ConsultationDate < end)
            .Select(c => c.ConsultationDate.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToListAsync();

        return dates.Select(d => d.ToString("yyyy-MM-dd")).ToList();
    }

    public async Task<NextPatientDossierNumberResponse> GetNextPatientDossierNumber(Guid cabinetIdentityId)
    {
        var nextDossierNumber = await db.Patients
            .Where(p => p.CabinetIdentityId == cabinetIdentityId)
            .Select(p => (int?)p.DossierNumber)
            .MaxAsync() ?? 0;

        return new NextPatientDossierNumberResponse
        {
            NextDossierNumber = nextDossierNumber + 1
        };
    }

    public async Task<VerifyPatientDossierNumberResponse> VerifyPatientDossierNumber(Guid cabinetIdentityId, int dossierNumber)
    {
        if (dossierNumber <= 0)
        {
            return new VerifyPatientDossierNumberResponse
            {
                IsUsed = true,
                Message = "Invalid dossier number."
            };
        }

        var exists = await db.Patients
            .AsNoTracking()
            .AnyAsync(p => p.CabinetIdentityId == cabinetIdentityId && p.DossierNumber == dossierNumber);

        return new VerifyPatientDossierNumberResponse
        {
            IsUsed = exists,
            Message = exists ? "This dossier number is already used." : "Dossier number is available."
        };
    }

    public async Task<byte[]> ExportPatientsCsv(Guid cabinetIdentityId, string? searchQuery, string? dateOfBirth, int? dossierNumber = null, string? phoneNumber = null, string? name = null, string? email = null, string? firstname = null, string? lastname = null, int? age = null)
    {
        var query = db.Patients
            .AsNoTracking()
            .Where(p => p.CabinetIdentityId == cabinetIdentityId);

        if (dossierNumber.HasValue)
        {
            query = query.Where(p => p.DossierNumber == dossierNumber.Value);
        }

        if (!string.IsNullOrEmpty(phoneNumber))
        {
            var phone = phoneNumber.Trim().ToLower();
            query = query.Where(p => p.PhoneNumber.ToLower().Contains(phone));
        }

        if (!string.IsNullOrEmpty(email))
        {
            var mail = email.Trim().ToLower();
            query = query.Where(p => p.Email.ToLower().Contains(mail));
        }

        if (!string.IsNullOrEmpty(name))
        {
            var nameSearch = name.Trim().ToLower();
            query = query.Where(p =>
                p.Firstname.ToLower().Contains(nameSearch) ||
                p.Lastname.ToLower().Contains(nameSearch) ||
                (p.Firstname.ToLower() + " " + p.Lastname.ToLower()).Contains(nameSearch) ||
                (p.Lastname.ToLower() + " " + p.Firstname.ToLower()).Contains(nameSearch));
        }

        if (!string.IsNullOrEmpty(lastname))
        {
            var lastnameSearch = lastname.Trim().ToLower();
            query = query.Where(p => p.Lastname.ToLower().Contains(lastnameSearch));
        }

        if (!string.IsNullOrEmpty(firstname))
        {
            var firstnameSearch = firstname.Trim().ToLower();
            query = query.Where(p => p.Firstname.ToLower().Contains(firstnameSearch));
        }

        if (!string.IsNullOrEmpty(dateOfBirth))
        {
            var dobStr = dateOfBirth.Trim();
            if (DateTime.TryParseExact(dobStr, "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out var parsedDate))
            {
                var targetUtc = DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc);
                var startDate = targetUtc.AddHours(-14);
                var endDate = targetUtc.AddHours(38);
                query = query.Where(p => p.DateOfBirth >= startDate && p.DateOfBirth < endDate);
            }
            else if (int.TryParse(dobStr, out int birthYear) && birthYear > 1850 && birthYear < 2100)
            {
                var yearStart = new DateTime(birthYear, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddHours(-14);
                var yearEnd = new DateTime(birthYear, 12, 31, 23, 59, 59, DateTimeKind.Utc).AddHours(14);
                query = query.Where(p => p.DateOfBirth >= yearStart && p.DateOfBirth < yearEnd);
            }
        }

        query = ApplyAgeFilter(query, age);

        var patients = await query
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.DossierNumber,
                p.Firstname,
                p.Lastname,
                p.DateOfBirth,
                p.PhoneNumber,
                p.Email,
                p.Profession,
                ConsultationCount = p.Consultations.Count,
                p.CreatedAt
            })
            .ToListAsync();

        var csv = new StringBuilder();
        csv.AppendLine("DossierNumber,Firstname,Lastname,DateOfBirth,PhoneNumber,Email,Profession,ConsultationCount,CreatedAt");

        foreach (var patient in patients)
        {
            csv.AppendLine(string.Join(',',
                EscapeCsv(patient.DossierNumber.ToString()),
                EscapeCsv(patient.Firstname),
                EscapeCsv(patient.Lastname),
                EscapeCsv(patient.DateOfBirth.ToString("yyyy-MM-dd")),
                EscapeCsv(patient.PhoneNumber),
                EscapeCsv(patient.Email),
                EscapeCsv(patient.Profession),
                EscapeCsv(patient.ConsultationCount.ToString()),
                EscapeCsv(patient.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"))
            ));
        }

        return Encoding.UTF8.GetBytes(csv.ToString());
    }

    private static string FormatDuration(int durationSeconds)
    {
        var safeDurationSeconds = Math.Max(0, durationSeconds);
        var duration = TimeSpan.FromSeconds(safeDurationSeconds);

        return duration.ToString(@"hh\:mm\:ss");
    }

    private static string FormatConduiteActionLabel(string actionKey)
    {
        return actionKey switch
        {
            "ordonnance" => "Ordonnance",
            "certificat" => "Certificat",
            "lettre_confrere" => "Lettre confrère",
            "paraclinique_chirurgie" => "Chirurgie",
            "paraclinique_imagerie" => "Imagerie",
            "paraclinique_bilan_sanguin" => "Bilan sanguin",
            _ => actionKey
        };
    }

    private static string EscapeCsv(string? value)
    {
        var safeValue = value ?? string.Empty;
        if (safeValue.Contains(',') || safeValue.Contains('"') || safeValue.Contains('\n') || safeValue.Contains('\r'))
        {
            return $"\"{safeValue.Replace("\"", "\"\"")}\"";
        }

        return safeValue;
    }

    private static IQueryable<Patient> ApplyAgeFilter(IQueryable<Patient> query, int? age)
    {
        if (!age.HasValue || age.Value < 0 || age.Value > 130)
        {
            return query;
        }

        var today = DateTime.UtcNow.Date;
        var oldestBirthDate = DateTime
            .SpecifyKind(today.AddYears(-(age.Value + 1)).AddDays(1), DateTimeKind.Utc)
            .AddHours(-14);
        var youngestBirthDateExclusive = DateTime
            .SpecifyKind(today.AddYears(-age.Value).AddDays(1), DateTimeKind.Utc)
            .AddHours(14);

        return query.Where(p => p.DateOfBirth >= oldestBirthDate && p.DateOfBirth < youngestBirthDateExclusive);
    }

    private static int CalculateAge(DateTime birthDate, DateTime onDate)
    {
        var birth = birthDate.Date;
        var reference = onDate.Date;

        var age = reference.Year - birth.Year;
        if (reference < birth.AddYears(age))
        {
            age--;
        }

        return Math.Max(0, age);
    }

    private static string ResolveConsultationStatus(bool isDone, bool isTimerPaused, int durationSeconds)
    {
        if (isDone)
        {
            return "consultation_completed";
        }

        if (durationSeconds <= 0)
        {
            return isTimerPaused ? "consultation_not_started" : "consultation_en_cours";
        }

        if (isTimerPaused)
        {
            return "consultation_paused";
        }

        return "consultation_en_cours";
    }

}
