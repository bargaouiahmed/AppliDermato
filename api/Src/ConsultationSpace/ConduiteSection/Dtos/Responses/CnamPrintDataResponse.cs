namespace api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

public class CnamPrintDataResponse
{
    public Guid ConsultationId { get; set; }
    public string SelectedFormType { get; set; } = "ap1";
    public string TemplateFileName { get; set; } = "AP1.pdf";
    public string FileName { get; set; } = string.Empty;
    public string CodeConventionnel { get; set; } = string.Empty;
    public List<CnamMedicationLineResponse> Ap1MedicationLines { get; set; } = [];
    public string Code { get; set; } = string.Empty;
    public string Oeil { get; set; } = string.Empty;
    public string Clinique { get; set; } = string.Empty;
    public string Diagnostic { get; set; } = string.Empty;
    public string Observation { get; set; } = string.Empty;
    public string Therapeutique { get; set; } = string.Empty;
    public string NatureExamen { get; set; } = string.Empty;
    public string DateExamen { get; set; } = string.Empty;
    public string DonneesCliniquesParacliniques { get; set; } = string.Empty;
    public string Diagnostics { get; set; } = string.Empty;
    public string PathologieOrigine { get; set; } = string.Empty;
    public string Traitement { get; set; } = string.Empty;
    public string EtatSante { get; set; } = string.Empty;
    public string BilanFonctionnel { get; set; } = string.Empty;
    public string Prolongation { get; set; } = string.Empty;
    public string Medecin { get; set; } = string.Empty;
    public string CodeCnam { get; set; } = string.Empty;
    public string Patient { get; set; } = string.Empty;
    public string PatientAge { get; set; } = string.Empty;
}

public class CnamMedicationLineResponse
{
    public string Code { get; set; } = string.Empty;
    public string Designation { get; set; } = string.Empty;
    public string Posologie { get; set; } = string.Empty;
    public string DureeTraitement { get; set; } = string.Empty;
}
