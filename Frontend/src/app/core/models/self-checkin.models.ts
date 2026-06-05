import { ConsultationInterrogatoireResponse } from './interrogatoire.models';

export type SelfCheckinLanguage = 'fr' | 'en' | 'ar';

export type ReturningSearchType = 'phone' | 'name' | 'numFiche' | 'email';

export interface SelfCheckinBootstrapResponse {
  doctor: {
    id: string;
    displayName: string;
    speciality: string;
  };
  enabled: boolean;
  timeoutSeconds: number;
  motifs: string[];
  professionOptions: string[];
  treatmentOptions: string[];
}

export interface SelfCheckinFindPatientRequest {
  searchType?: ReturningSearchType | '';
  nom?: string;
  prenom?: string;
  tel?: string;
  email?: string;
  numFiche?: string;
  dateAnniversaire?: string;
}

export interface SelfCheckinPatientSummary {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phoneNumber: string;
  dossierNumber: number;
  dateOfBirth: string;
}

export interface SelfCheckinCreatePatientRequest {
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  sex: string;
  phoneNumber?: string;
  email?: string;
  profession?: string;
  workPlace?: string;
  familialStatus?: string;
  country?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  apci?: string;
  insuranceType?: string;
  insuranceEstablishment?: string;
}

export interface SelfCheckinCreateConsultationRequest {
  patientId: string;
  consultationDate?: string | Date;
  motifs: string[];
}

export interface SelfCheckinCreateConsultationResponse {
  consultationId: string;
  reused: boolean;
  code: string;
  message: string;
  consultation: ConsultationInterrogatoireResponse;
}

export interface SelfCheckinPatchMotifRequest {
  motifs: string[];
}

export interface SelfCheckinAnomalyRequest {
  section: 'medical' | 'family' | 'surgical';
  isCustom: boolean;
  templateKey: string | null;
  sortOrder: number;
  payload: Record<string, unknown>;
}

export interface SelfCheckinOngoingTreatmentRequest {
  medicine: string;
  therapeuticClass: string;
  category: string;
  posology: string;
  duration: string;
  date: string;
}

export interface SelfCheckinPatchInterrogatoireRequest {
  histoireMaladie: string;
  diagnostics: string[];
  anomalies: SelfCheckinAnomalyRequest[];
  ongoingTreatments: SelfCheckinOngoingTreatmentRequest[];
}

export interface SelfCheckinApiError {
  code: string;
  message: string;
}
