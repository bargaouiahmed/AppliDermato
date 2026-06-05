namespace api.Src.AgendaSpace.Dtos.Requests;

public class CreateConsultationRdvRequest
{
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public int Duration { get; set; } = 15;
    public string[]? Motifs { get; set; }
}
