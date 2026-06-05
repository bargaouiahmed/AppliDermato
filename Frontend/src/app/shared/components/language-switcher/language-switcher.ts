import { Component, inject } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { Lang, SUPPORTED_LANGS } from '../../../core/models/i18n.models';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.css',
})
export class LanguageSwitcher {
  protected readonly i18n = inject(I18nService);
  protected readonly languages = SUPPORTED_LANGS;

  protected selectLanguage(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  protected isLanguageActive(lang: Lang): boolean {
    return this.i18n.lang() === lang;
  }
}
