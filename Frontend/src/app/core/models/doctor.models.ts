export interface Clinic {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  googleMapsLink: string;
}

export interface SecretarySummary {
  id: string;
  firstName: string;
  lastName: string;
  index: number;
}

export interface DoctorPersonalization {
  waitingRoomMessage: string;
  dailyNews: string;
  dailyNewsFr: string;
  dailyNewsEn: string;
  dailyNewsAr: string;
  useSuperAdminDailyNews: boolean;
  autoDailyNewsEnabled: boolean;
  showHeader: boolean;
  showFirstName: boolean;
  showLastName: boolean;
  showCodeCnam: boolean;
  showFirstNameArabic: boolean;
  showLastNameArabic: boolean;
  showFooter: boolean;
  showFooterCabinetAddress: boolean;
  showFooterLandline: boolean;
  showFooterMobile: boolean;
  showFooterEmail: boolean;
}

export interface DoctorProfile {
  id: string;
  doctorId: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl: string | null;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  phoneNumber: string;
  landline: string;
  country: string;
  cabinetAddress: string;
  postalCode: string;
  city: string;
  codeCnam: string;
  role: string;
  verified?: boolean;
  isActiveSubscription?: boolean;
  isSecondSecretaryEnabled: boolean;
  clinics: Clinic[] | null;
  personalization: DoctorPersonalization;
  selfCheckinEnabled: boolean;
  selfCheckinKey: string | null;
  selfCheckinTimeoutSeconds: number;
  firstSecretary: SecretarySummary | null;
  secondSecretary: SecretarySummary | null;
  notes: string | null;

  // Optional fields used by profile UI customization blocks.
  firstNameInArabic?: string | null;
  lastNameInArabic?: string | null;
  messageSalleAttente?: string | null;
  actualiteDuJour?: string | null;
}

export interface DoctorProfileApiResponse {
  id: string;
  doctorId?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  profilePictureUrl?: string | null;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  phoneNumber?: string;
  landline?: string;
  role?: string;
  secretaries?: DoctorSecretaryApiResponse[] | null;
  isSecondSecretaryActive?: boolean;
  clinics?: DoctorClinicApiResponse[] | null;
  country?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  codeCnam?: string;
  selfCheckinEnabled?: boolean;
  selfCheckinKey?: string | null;
  selfCheckinTimeoutSeconds?: number;
  firstnameAr?: string;
  lastnameAr?: string;
  personalization?: DoctorPersonalizationApiResponse | null;
}

export interface DoctorPersonalizationApiResponse {
  waitingRoomMessage?: string;
  dailyNews?: string;
  dailyNewsFr?: string;
  dailyNewsEn?: string;
  dailyNewsAr?: string;
  useSuperAdminDailyNews?: boolean;
  autoDailyNewsEnabled?: boolean;
  showHeader?: boolean;
  showFirstName?: boolean;
  showLastName?: boolean;
  showCodeCnam?: boolean;
  showFirstNameArabic?: boolean;
  showLastNameArabic?: boolean;
  showFooter?: boolean;
  showFooterCabinetAddress?: boolean;
  showFooterLandline?: boolean;
  showFooterMobile?: boolean;
  showFooterEmail?: boolean;
}

export interface DoctorSecretaryApiResponse {
  id?: string;
  firstname?: string;
  lastname?: string;
  index?: number;
}

export interface DoctorClinicApiResponse {
  id?: string;
  name?: string;
  address?: string;
  phoneNumber?: string;
  googleMapsLink?: string;
}
