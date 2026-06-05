import type { AppEnvironment } from './environment.model';
import { buildEnvironment } from './runtime-env';

export const environment: AppEnvironment = buildEnvironment({
  production: false,
  name: 'development',
  appUrl: 'http://localhost:4200',
  apiUrl: 'http://localhost:5087',
});
