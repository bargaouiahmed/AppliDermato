export type ConduiteActionKey =
  | 'ordonnance'
  | 'certificat'
  | 'lettre_confrere'
  | 'cnam'
  | 'paraclinique_chirurgie'
  | 'paraclinique_laser'
  | 'paraclinique_imagerie'
  | 'paraclinique_bilan_sanguin';

export type ConduiteDocumentType =
  | 'ordonnance'
  | 'certificat'
  | 'lettre_confrere'
  | 'cnam'
  | 'paraclinique';

export interface ConduiteCatalogItemResponse {
  actionKey: string;
  label: string;
  category: string;
  isParaclinique: boolean;
}

export interface ConduiteOrdonnanceTypeDrugResponse {
  therapeuticClass: string;
  category: string;
  medicine: string;
  posology: string;
  duration: string;
}

export interface ConduiteOrdonnanceTypeCatalogItemResponse {
  typeKey: string;
  label: string;
  translationKey: string;
  sortOrder: number;
  consigne: string;
  informationAdditionnel: string;
  listDrugs: ConduiteOrdonnanceTypeDrugResponse[];
}

export interface SaveOrdonnanceTypeCatalogItemRequest {
  label: string;
  consigne: string;
  informationAdditionnel: string;
  listDrugs: ConduiteOrdonnanceTypeDrugResponse[];
}

export interface ConsultationConduiteActionResponse {
  id: string;
  actionKey: string;
  sortOrder: number;
  payload: Record<string, unknown>;
}

export interface ConsultationConduiteResponse {
  consultationId: string;
  additionalInformation: string;
  actions: ConsultationConduiteActionResponse[];
}

export interface UpsertConsultationConduiteActionRequest {
  actionKey: string;
  sortOrder: number;
  payload: Record<string, unknown>;
}

export interface UpsertConsultationConduiteRequest {
  additionalInformation: string;
  actions: UpsertConsultationConduiteActionRequest[];
}

export interface PrintableConduiteDocumentResponse {
  consultationId: string;
  documentType: string;
  fileName: string;
  htmlContent: string;
}

export interface CnamMedicationLineResponse {
  code: string;
  designation: string;
  posologie: string;
  dureeTraitement: string;
}

export interface CnamPrintDataResponse {
  consultationId: string;
  selectedFormType: 'ap1' | 'ap2' | 'ap3' | 'ap4' | 'apci';
  templateFileName: string;
  fileName: string;
  codeConventionnel: string;
  ap1MedicationLines: CnamMedicationLineResponse[];
  code: string;
  oeil: string;
  clinique: string;
  diagnostic: string;
  observation: string;
  therapeutique: string;
  natureExamen: string;
  dateExamen: string;
  donneesCliniquesParacliniques: string;
  diagnostics: string;
  pathologieOrigine: string;
  traitement: string;
  etatSante: string;
  bilanFonctionnel: string;
  prolongation: string;
  medecin: string;
  codeCnam: string;
  patient: string;
  patientAge: string;
}

export interface GenerateLettreConfrereAiRequest {
  generalDescription: string;
  medecin?: string;
  contenue?: string;
  formulepolitesse?: string;
}

export interface CorrectLettreConfrereAiRequest {
  contenue: string;
  correctionPrompt?: string;
  medecin?: string;
  formulepolitesse?: string;
}

export interface LettreConfrereAiJobResponse {
  id: string;
  consultationId: string;
  operation: 'generate' | 'correct' | string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | string;
  actionKey: string;
  resultPayload: Record<string, unknown>;
  error: string;
  createdAt: string;
  updatedAt: string;
  completedAtUtc?: string | null;
}
