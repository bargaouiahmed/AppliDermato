export type IssuableDoctorRole = 'doctor' | 'admin';

export interface CreateDoctorRequest {
  firstName: string;
  lastName: string;
  email: string;
  nationality: string;
  role: IssuableDoctorRole;
  phoneNumber: string;
  landline: string;
  cabinetCountry: string;
  cabinetCity: string;
  cabinetAddress: string;
  languagePreference: 'fr' | 'en' | 'ar';
  cabinetPostalCode: string;
  notesFromAdmin?: string;
  subscriptionDurationInMonths: number;
}

export interface CreateDoctorApiResponse {
  message?: string;
  Message?: string;
}

export interface CreateDoctorResult {
  message: string;
}

export type DoctorSubscriptionStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'suspended'
  | 'admin'
  | 'deleted';

export type DoctorRoleFilter = 'doctor' | 'admin';

export interface DoctorListItem {
  id: string;
  cabinetIdentityId: string;
  firstName: string;
  lastName: string;
  email: string;
  nationality: string;
  role: IssuableDoctorRole;
  isSuperAdmin: boolean;
  phoneNumber: string;
  landline: string;
  languagePreference: 'fr' | 'en' | 'ar';
  cabinetCountry: string;
  cabinetCity: string;
  cabinetAddress: string;
  cabinetPostalCode: string;
  notesFromAdmin: string;
  profilePictureUrl: string;
  isCabinetActive: boolean;
  isFlaggedForDeletion: boolean;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  subscriptionDurationInMonths: number;
  subscriptionIsActive: boolean;
  subscriptionType: string;
  subscriptionStatus: DoctorSubscriptionStatus;
  subscriptionDaysRemaining: number | null;
  createdAt: string;
}

export interface ListDoctorsResponse {
  doctors: DoctorListItem[];
  totalCount: number;
}

export interface UpdateDoctorByAdminRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  nationality?: string;
  phoneNumber?: string;
  landline?: string;
  cabinetCountry?: string;
  cabinetCity?: string;
  cabinetAddress?: string;
  cabinetPostalCode?: string;
  notesFromAdmin?: string;
  languagePreference?: 'fr' | 'en' | 'ar';
}

export interface ChangeDoctorRoleRequest {
  role: IssuableDoctorRole;
  subscriptionDurationInMonths?: number;
}

export interface ListDoctorsQuery {
  pageNumber?: number;
  pageSize?: number;
  searchQuery?: string;
  sortBy?: 'createdAt' | 'firstname' | 'lastname' | 'email' | 'city' | 'role' | 'subscriptionEndDate';
  sortDirection?: 'asc' | 'desc';
  roleFilter?: DoctorRoleFilter;
  statusFilter?: DoctorSubscriptionStatus | 'not_suspended';
}
