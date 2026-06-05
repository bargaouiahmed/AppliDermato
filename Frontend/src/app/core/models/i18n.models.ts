export type Lang = 'fr' | 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

export interface LangConfig {
  code: Lang;
  label: string;
  dir: Direction;
}

export const SUPPORTED_LANGS: LangConfig[] = [
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

export const DEFAULT_LANG: Lang = 'fr';
