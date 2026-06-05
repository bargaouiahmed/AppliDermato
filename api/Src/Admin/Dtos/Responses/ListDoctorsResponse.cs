using System;

namespace api.Src.Admin.Dtos.Responses;

public class ListDoctorsResponse
{
    public List<DoctorListItemResponse> Doctors { get; set; } = [];
    public int TotalCount { get; set; }
}