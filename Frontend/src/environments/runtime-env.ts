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

function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

function pickRuntimeUrl(
  base: AppEnvironment,
  runtimeValue: string | undefined,
  fallbackValue: string,
): string {
  const normalizedRuntimeValue = runtimeValue?.trim();
  if (!normalizedRuntimeValue) {
    return fallbackValue;
  }

  // Keep localhost overrides for local development only.
  if (base.name !== 'development' && isLoopbackUrl(normalizedRuntimeValue)) {
    return fallbackValue;
  }

  return normalizedRuntimeValue;
}

export function buildEnvironment(
  base: AppEnvironment,
  runtimeConfig: RuntimeConfig | undefined = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined,
): AppEnvironment {
  return {
    ...base,
    appUrl: pickRuntimeUrl(base, runtimeConfig?.appUrl, base.appUrl),
    apiUrl: pickRuntimeUrl(base, runtimeConfig?.apiUrl, base.apiUrl),
  };
}
