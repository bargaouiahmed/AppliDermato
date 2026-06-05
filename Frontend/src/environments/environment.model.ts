export type EnvironmentName = 'development' | 'tunnel' | 'staging' | 'production';

export interface AppEnvironment {
  production: boolean;
  name: EnvironmentName;
  appUrl: string;
  apiUrl: string;
}
