export type InterrogatoireSection = 'medical' | 'family' | 'surgical';

export interface InitializeConsultationRequest {
  patientId: string;
  consultationDate: string;
  motifs: string[];
}

export interface ConsultationInterrogatoireResponse {
  consultationId: string;
  patientId: string;
  cabinetIdentityId: string;
  consultationDate: string;
  duration: string;
  isTimerPaused: boolean;
  isDone: boolean;
  motifs: string[];
  histoireMaladie: string;
  diagnostics: string[];
  copiedFromPreviousConsultation: boolean;
  sourceConsultationId: string | null;
  anomalies: InterrogatoireAnomalyResponse[];
  ongoingTreatments: OngoingTreatmentMedicineResponse[];
}

export interface UpdateConsultationTimerRequest {
  durationSeconds: number;
  isTimerPaused: boolean;
  isDone: boolean;
}

export interface UpdateConsultationDataRequest {
  motifs: string[];
  histoireMaladie: string;
  diagnostics: string[];
  anomalies: UpdateInterrogatoireAnomalyRequest[];
  ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[];
}

export interface UpdateOngoingTreatmentMedicineRequest {
  medicine: string;
  therapeuticClass: string;
  category: string;
  posology: string;
  duration: string;
  date: string;
}

export interface UpdateInterrogatoireAnomalyRequest {
  section: InterrogatoireSection;
  isCustom: boolean;
  templateKey: string | null;
  sortOrder: number;
  payload: Record<string, unknown>;
}

export interface InterrogatoireAnomalyResponse {
  id: string;
  section: InterrogatoireSection;
  isCustom: boolean;
  templateKey: string | null;
  sortOrder: number;
  payload: Record<string, unknown>;
}

export interface InterrogatoireAnomalyCatalogItem {
  section: InterrogatoireSection;
  isCustom: boolean;
  templateKey: string | null;
  category?: string | null;
  label: string;
}

export interface OngoingTreatmentMedicineResponse {
  id: string;
  medicine: string;
  therapeuticClass: string;
  category: string;
  posology: string;
  duration: string;
  date: string;
}

export interface InterrogatoireOrdonnanceHistoryResponse {
  consultationId: string;
  consultationDate: string;
  payload: Record<string, unknown>;
}

export interface TreatmentCatalogItem {
  id: string;
  label: string;
}

export interface TreatmentCatalogRelation {
  therapeuticClass: string;
  category: string;
  medicine: string;
}

export interface UpsertTreatmentCatalogItemRequest {
  label: string;
  therapeuticClass?: string;
  category?: string;
}
