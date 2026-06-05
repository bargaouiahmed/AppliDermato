using System.Text.Json;

namespace api.Src.ConsultationSpace.ConduiteSection.Dtos.Requests;

public class UpsertConsultationConduiteRequest
{
    public string? AdditionalInformation { get; set; }
    public List<UpsertConsultationConduiteActionRequest> Actions { get; set; } = [];
}

public class UpsertConsultationConduiteActionRequest
{
    public string ActionKey { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];
}

public class SaveOrdonnanceTypeCatalogItemRequest
{
    public string Label { get; set; } = string.Empty;
    public string? Consigne { get; set; }
    public string? InformationAdditionnel { get; set; }
    public List<SaveOrdonnanceTypeDrugRequest> ListDrugs { get; set; } = [];
}

public class SaveOrdonnanceTypeDrugRequest
{
    public string? TherapeuticClass { get; set; }
    public string? Category { get; set; }
    public string? Medicine { get; set; }
    public string? Posology { get; set; }
    public string? Duration { get; set; }
}
