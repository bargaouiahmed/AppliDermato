import { Component, input, output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-password-input',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './password-input.html',
  styles: [
    `
      .password-field {
        position: relative;
      }

      .password-control {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 2.5rem 0.5rem 0.75rem;
        color: #121822;
        font-size: 0.875rem;
        line-height: 1.25rem;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .password-control:focus {
        border-color: #175042;
        box-shadow: 0 0 0 0.06rem #175042;
      }

      .password-toggle {
        position: absolute;
        inset-inline-end: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        border: 0;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      .password-toggle:hover {
        color: #374151;
      }

      .password-icon {
        width: 1.25rem;
        height: 1.25rem;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInput),
      multi: true,
    },
  ],
})
export class PasswordInput implements ControlValueAccessor {
  placeholder = input<string>('login.password');

  protected visible = false;
  protected value = '';
  protected touched = false;

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  toggleVisibility(): void {
    this.visible = !this.visible;
  }

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value = val;
    this.onChange(val);
  }

  onBlur(): void {
    this.touched = true;
    this.onTouched();
  }

  writeValue(val: string): void {
    this.value = val ?? '';
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
