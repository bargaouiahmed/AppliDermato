import { Injectable, signal, computed } from '@angular/core';
import { Lang, Direction, SUPPORTED_LANGS, DEFAULT_LANG } from '../models/i18n.models';
import { CookieService } from './cookie.service';
import { fr } from '../i18n/fr';
import { en } from '../i18n/en';
import { ar } from '../i18n/ar';

const TRANSLATIONS: Record<Lang, Record<string, string>> = { fr, en, ar };
const LANG_COOKIE = 'app_lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly cookie = new CookieService();

  /** Current language signal */
  readonly lang = signal<Lang>(this.loadLang());

  /** Current direction (computed from lang) */
  readonly dir = computed<Direction>(() => {
    const cfg = SUPPORTED_LANGS.find((l) => l.code === this.lang());
    return cfg?.dir ?? 'ltr';
  });

  /** All supported languages */
  readonly languages = SUPPORTED_LANGS;

  constructor() {
    // Apply initial direction to the document
    this.applyDir(this.dir());
  }

  /** Switch language, persist in cookie, update document dir */
  setLang(lang: Lang): void {
    this.lang.set(lang);
    this.cookie.set(LANG_COOKIE, lang, 365);
    this.applyDir(this.dir());
  }

  /** Translate a key. Returns the key itself if not found. */
  t(key: string): string {
    return TRANSLATIONS[this.lang()]?.[key] ?? key;
  }

  /** Reactive translation (returns a computed signal) */
  t$(key: string) {
    return computed(() => this.t(key));
  }

  private loadLang(): Lang {
    const saved = this.cookie.get(LANG_COOKIE) as Lang | null;
    if (saved && SUPPORTED_LANGS.some((l) => l.code === saved)) {
      return saved;
    }
    return DEFAULT_LANG;
  }

  private applyDir(dir: Direction): void {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', this.lang());
  }
}
