import { Component, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { OtpInput } from '../../../../shared/components/otp-input/otp-input';

@Component({
  selector: 'app-reset-code-step',
  standalone: true,
  imports: [TranslatePipe, OtpInput],
  templateUrl: './reset-code-step.html',
})
export class ResetCodeStep {
  /** Emits the full OTP code */
  codeSubmit = output<string>();

  /** Emits when user wants to resend code */
  resendCode = output<void>();

  /** Emits when user clicks back */
  back = output<void>();

  protected code = signal('');
  protected loading = signal(false);
  protected serverError = signal('');
  protected otpRef = viewChild<OtpInput>('otpRef');

  setLoading(val: boolean): void {
    this.loading.set(val);
  }

  setServerError(msg: string): void {
    this.serverError.set(msg);
  }

  resetInput(): void {
    this.code.set('');
    this.otpRef()?.reset();
  }

  onCodeComplete(code: string): void {
    this.code.set(code);
  }

  onCodeChange(code: string): void {
    this.code.set(code);
  }

  onSubmit(): void {
    this.serverError.set('');
    if (this.code().length !== 6) return;
    this.codeSubmit.emit(this.code());
  }
}
