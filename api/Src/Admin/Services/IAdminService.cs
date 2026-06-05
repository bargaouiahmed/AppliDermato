using System;
using api.Src.Admin.Dtos.Requests;
using api.Src.Admin.Dtos.Responses;

namespace api.Src.Admin.Services;

public interface IAdminService
{
    public Task AddNewDoctorAsync(AddNewDoctorRequest request);
    public Task<ListDoctorsResponse> GetDoctorsAsync(int pageNumber, int pageSize, string? searchQuery, string? sortBy, string? sortDirection, string? roleFilter, string? statusFilter);
    public Task<DoctorListItemResponse> GetDoctorByIdAsync(Guid doctorId);
    public Task<DoctorListItemResponse> UpdateDoctorByAdminAsync(Guid doctorId, UpdateDoctorByAdminRequest request);
    public Task SuspendDoctorAsync(Guid doctorId, Guid actorCabinetIdentityId);
    public Task ReactivateDoctorAsync(Guid doctorId, Guid actorCabinetIdentityId, int? subscriptionDurationInMonths);
    public Task ChangeDoctorRoleAsync(Guid doctorId, Guid actorCabinetIdentityId, string actorRole, string targetRole, int? subscriptionDurationInMonths);
    public Task RemoveAdminAsync(Guid doctorId, Guid actorCabinetIdentityId, string actorRole);
    public Task DeleteDoctorAsync(Guid doctorId, Guid actorCabinetIdentityId, string actorRole);
}
