import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Matches the backend's VerifyPasswordConditions:
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 symbol (non-alphanumeric)
 *
 * Each failing rule is reported as a separate error key so the UI can show
 * individual messages.
 */
export function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null; // Let `Validators.required` handle empty

  const errors: ValidationErrors = {};

  if (!/[A-Z]/.test(value)) errors['missingUppercase'] = true;
  if (!/[a-z]/.test(value)) errors['missingLowercase'] = true;
  if (!/[0-9]/.test(value)) errors['missingDigit'] = true;
  if (!/[^A-Za-z0-9]/.test(value)) errors['missingSymbol'] = true;

  return Object.keys(errors).length ? errors : null;
}
