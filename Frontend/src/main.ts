import { registerLocaleData } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import localeAr from '@angular/common/locales/ar';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr);
registerLocaleData(localeAr);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
