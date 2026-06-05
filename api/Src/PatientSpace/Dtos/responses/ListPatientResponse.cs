using System;

namespace api.Src.PatientSpace.Dtos.responses;

public class ListPatientResponse
{
    public List<PatientResponse> Patients { get; set; } = [];
    public int TotalCount { get; set; }

}
