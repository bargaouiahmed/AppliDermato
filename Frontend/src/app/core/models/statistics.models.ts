export interface StatisticsOverviewQuery {
  period?: string;
  startDate?: string;
  endDate?: string;
  diagnosis?: string;
  diagnostics?: string[];
  sex?: string;
  cnamStatus?: string;
  minAge?: number | null;
  maxAge?: number | null;
  ageGroup?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface StatisticsBucket {
  label: string;
  count: number;
  percentage?: number;
}

export interface StatisticsConsultationSection {
  period: string;
  chartGranularity: 'day' | 'week' | 'month' | 'year' | string;
  startDate?: string;
  endDate?: string;
  timeline: StatisticsBucket[];
  totalConsultations: number;
  completedConsultations: number;
  notCompletedConsultations: number;
  averageDurationSeconds: number;
  averageDuration: string;
  diagnosticFrequency: StatisticsBucket[];
  cnamForms: StatisticsBucket[];
}

export interface StatisticsCnamCoverage {
  withCnam: number;
  withoutCnam: number;
  withCnamPercentage: number;
  withoutCnamPercentage: number;
}

export interface StatisticsPagination {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface StatisticsPatientSection {
  totalPatients: number;
  patientsWithDiagnostics: number;
  cnamCoverage: StatisticsCnamCoverage;
  sexDistribution: StatisticsBucket[];
  ageGroupDistribution: StatisticsBucket[];
  pagination: StatisticsPagination;
  patients: StatisticsPatient[];
}

export interface StatisticsOverview {
  consultationStatistics: StatisticsConsultationSection;
  patientStatistics: StatisticsPatientSection;
}

export interface StatisticsPatient {
  id: string;
  dossierNumber: number;
  firstname: string;
  lastname: string;
  sex: string;
  age: number;
  insuranceType: string;
  insuranceEstablishment: string;
  hasCnam: boolean;
  matchingConsultationCount: number;
  consultations: StatisticsPatientConsultation[];
}

export interface StatisticsPatientConsultation {
  id: string;
  consultationDate: string;
  duration: string;
  isTimerPaused: boolean;
  isDone: boolean;
  motifs: string[];
  diagnostics: string[];
  conduiteActions: string[];
}
