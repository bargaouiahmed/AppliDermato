export type AppRole = 'doctor' | 'admin' | 'super_admin' | 'secretary' | 'secretary1' | 'secretary2';

export interface UserContext {
  role: AppRole;
  userId: string;
  doctorId: string;
  firstName: string;
  lastName: string;
}
