import { CanDeactivateFn } from '@angular/router';

export interface PhoneModeExitAware {
  preparePhoneModeExit(): void;
}

export const phoneModeExitGuard: CanDeactivateFn<PhoneModeExitAware> = (component) => {
  component.preparePhoneModeExit();
  return true;
};
