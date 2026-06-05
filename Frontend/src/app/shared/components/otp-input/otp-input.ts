import {
  Component,
  input,
  output,
  signal,
  viewChildren,
  ElementRef,
  AfterViewInit,
} from '@angular/core';

@Component({
  selector: 'app-otp-input',
  standalone: true,
  templateUrl: './otp-input.html',
})
export class OtpInput implements AfterViewInit {
  /** Number of digits */
  length = input<number>(5);

  /** Emits the full code when all digits are filled */
  codeComplete = output<string>();

  /** Emits partial code on every change */
  codeChange = output<string>();

  protected digits = signal<string[]>([]);
  protected boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  ngAfterViewInit(): void {
    this.reset();
  }

  reset(): void {
    this.digits.set(new Array(this.length()).fill(''));
    // Focus first box after reset
    setTimeout(() => this.focusBox(0), 0);
  }

  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1); // Only last digit

    const updated = [...this.digits()];
    updated[index] = val;
    this.digits.set(updated);

    this.codeChange.emit(updated.join(''));

    if (val && index < this.length() - 1) {
      this.focusBox(index + 1);
    }

    const code = updated.join('');
    if (code.length === this.length() && updated.every((d) => d !== '')) {
      this.codeComplete.emit(code);
    }
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      this.focusBox(index - 1);
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    const chars = pasted.split('').slice(0, this.length());
    const updated = new Array(this.length()).fill('');
    chars.forEach((c, i) => (updated[i] = c));
    this.digits.set(updated);
    this.codeChange.emit(updated.join(''));

    const focusIdx = Math.min(chars.length, this.length() - 1);
    this.focusBox(focusIdx);

    if (chars.length === this.length()) {
      this.codeComplete.emit(updated.join(''));
    }
  }

  private focusBox(index: number): void {
    const allBoxes = this.boxes();
    if (allBoxes[index]) {
      allBoxes[index].nativeElement.focus();
    }
  }
}
