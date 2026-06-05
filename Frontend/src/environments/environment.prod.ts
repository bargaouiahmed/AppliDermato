import type { AppEnvironment } from './environment.model';
import { buildEnvironment } from './runtime-env';

export const environment: AppEnvironment = buildEnvironment({
  production: true,
  name: 'production',
  appUrl: 'https://mydoctor.hanibot.org',
  apiUrl: 'https://apigen.hanibot.org',
});
