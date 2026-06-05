import type { AppEnvironment } from './environment.model';
import { buildEnvironment } from './runtime-env';

export const environment: AppEnvironment = buildEnvironment({
  production: false,
  name: 'tunnel',
  appUrl: 'https://generalisto.softsolution.site',
  apiUrl: 'https://gen-api.softsolution.site',
});
