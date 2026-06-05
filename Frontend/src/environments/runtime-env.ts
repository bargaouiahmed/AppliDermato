import type { AppEnvironment } from './environment.model';

type RuntimeConfig = {
  appUrl?: string;
  apiUrl?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

export function buildEnvironment(
  base: AppEnvironment,
  runtimeConfig: RuntimeConfig | undefined = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined,
): AppEnvironment {
  return {
    ...base,
    appUrl: runtimeConfig?.appUrl?.trim() || base.appUrl,
    apiUrl: runtimeConfig?.apiUrl?.trim() || base.apiUrl,
  };
}
