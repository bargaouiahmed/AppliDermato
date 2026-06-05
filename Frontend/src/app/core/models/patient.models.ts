export interface Patient {
  id: string;
  dossierNumber: number;
  consultationCount: number;
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  phoneNumber: string;
  country: string;
  profession: string;
  workPlace: string;
  sex: string;
  familialStatus: string;
  city: string;
  address: string;
  postalCode: string;
  email: string;
  apci: string;
  insuranceType: string;
  insuranceEstablishment: string;
}

export interface AddPatientRequest {
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  phoneNumber: string;
  country: string;
  profession: string;
  workPlace: string;
  sex: string;
  familialStatus: string;
  city: string;
  address: string;
  postalCode: string;
  email: string;
  apci: string;
  insuranceType: string;
  insuranceEstablishment: string;
}

export interface UpdatePatientRequest {
  firstname?: string;
  lastname?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  country?: string;
  profession?: string;
  workPlace?: string;
  sex?: string;
  familialStatus?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  email?: string;
  apci?: string;
  insuranceType?: string;
  insuranceEstablishment?: string;
}

export interface PatientListResponse {
  patients: Patient[];
  totalCount: number;
}

export interface PatientProfessionListResponse {
  professions: string[];
  totalCount: number;
}

export interface NextPatientDossierNumberResponse {
  nextDossierNumber: number;
}

export interface VerifyPatientDossierNumberResponse {
  isUsed: boolean;
  message: string;
}

export interface GetPatientsQuery {
  pageNumber?: number;
  pageSize?: number;
  searchQuery?: string;
  dateOfBirth?: string;
  name?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phoneNumber?: string;
  dossierNumber?: number;
  age?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface GetPatientProfessionsQuery {
  pageNumber?: number;
  pageSize?: number;
  searchQuery?: string;
}

export interface PatientConsultation {
  id: string;
  consultationDate: string;
  duration: string;
  isTimerPaused: boolean;
  isDone: boolean;
  motifs: string[];
  diagnostics: string[];
  conduiteActions: string[];
}

export interface PatientConsultationListResponse {
  consultations: PatientConsultation[];
  totalCount: number;
}

export interface DailyConsultation {
  id: string;
  patientId: string;
  patientDossierNumber: number;
  patientFirstname: string;
  patientLastname: string;
  patientProfession: string;
  patientAge: number;
  patientConsultationCount: number;
  consultationDate: string;
  duration: string;
  isTimerPaused: boolean;
  isDone: boolean;
  status: 'consultation_not_started' | 'consultation_paused' | 'created' | 'consultation_completed' | 'consultation_en_cours' | string;
  motifs: string[];
}

export interface DailyConsultationListResponse {
  date: string;
  consultations: DailyConsultation[];
  totalCount: number;
}

export interface ConsultationDatesResponse {
  year: number;
  month: number;
  dates: string[];
  totalCount: number;
}
