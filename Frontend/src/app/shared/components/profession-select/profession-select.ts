import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  forwardRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { finalize } from 'rxjs';
import { PatientService } from '../../../core/services/patient.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-profession-select',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent, TranslatePipe],
  templateUrl: './profession-select.html',
  styleUrl: './profession-select.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ProfessionSelectComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionSelectComponent implements ControlValueAccessor, OnInit {
  private readonly patientService = inject(PatientService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() placeholderKey = 'patients.create.fields.profession';
  @Input() notFoundTextKey = 'consultation.conduite.noResults';
  @Input() options: string[] | null = null;
  @Output() blurField = new EventEmitter<void>();

  protected professions: string[] = [];
  protected selectedValue = '';
  protected loading = false;
  protected disabled = false;

  private searchTerm = '';
  private pageNumber = 1;
  private readonly pageSize = 25;
  private totalCount = 0;
  private requestToken = 0;
  private hasLoadedOnce = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    if (this.hasStaticOptions()) {
      this.professions = this.uniqueValues(this.options ?? []);
      this.mergeSelectedValue();
      this.hasLoadedOnce = true;
      this.totalCount = this.professions.length;
      this.cdr.markForCheck();
      return;
    }

    this.loadProfessions(true);
  }

  writeValue(value: string | null): void {
    this.selectedValue = value?.trim() ?? '';
    this.mergeSelectedValue();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  protected onOpen(): void {
    if (this.hasStaticOptions()) {
      return;
    }

    if (!this.hasLoadedOnce && !this.loading) {
      this.loadProfessions(true);
    }
  }

  protected onSearch(event: { term: string }): void {
    if (this.hasStaticOptions()) {
      const searchTerm = event.term?.trim().toLocaleLowerCase() ?? '';
      const source = this.options ?? [];
      const filtered = searchTerm
        ? source.filter((item) => item.toLocaleLowerCase().includes(searchTerm))
        : source;
      this.professions = this.uniqueValues(filtered);
      this.mergeSelectedValue();
      this.cdr.markForCheck();
      return;
    }

    this.searchTerm = event.term?.trim() ?? '';
    this.loadProfessions(true);
  }

  protected onScrollToEnd(): void {
    if (this.hasStaticOptions()) {
      return;
    }

    if (this.loading || this.professions.length >= this.totalCount) {
      return;
    }

    this.pageNumber += 1;
    this.loadProfessions(false);
  }

  protected onValueChange(value: string | null): void {
    this.selectedValue = value?.trim() ?? '';
    this.mergeSelectedValue();
    this.onChange(this.selectedValue);
    this.cdr.markForCheck();
  }

  protected readonly addTag = (term: string): string => {
    const value = term.trim();
    this.selectedValue = value;
    this.mergeSelectedValue();
    this.onChange(value);
    this.cdr.markForCheck();
    return value;
  };

  protected handleBlur(): void {
    this.onTouched();
    this.blurField.emit();
  }

  private loadProfessions(reset: boolean): void {
    if (reset) {
      this.pageNumber = 1;
      this.professions = this.selectedValue ? [this.selectedValue] : [];
    }

    const token = ++this.requestToken;
    this.loading = true;
    this.cdr.markForCheck();

    this.patientService
      .getPatientProfessions({
        pageNumber: this.pageNumber,
        pageSize: this.pageSize,
        searchQuery: this.searchTerm || undefined,
      })
      .pipe(
        finalize(() => {
          if (token === this.requestToken) {
            this.loading = false;
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (token !== this.requestToken) {
            return;
          }

          this.hasLoadedOnce = true;
          this.totalCount = response.totalCount;
          this.professions = this.uniqueValues(reset ? response.professions : [...this.professions, ...response.professions]);
          this.mergeSelectedValue();
          this.cdr.markForCheck();
        },
        error: () => {
          if (token !== this.requestToken) {
            return;
          }

          this.hasLoadedOnce = true;
          this.totalCount = this.professions.length;
          this.cdr.markForCheck();
        },
      });
  }

  private mergeSelectedValue(): void {
    if (!this.selectedValue) {
      return;
    }

    this.professions = this.uniqueValues([this.selectedValue, ...this.professions]);
  }

  private uniqueValues(values: string[]): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      const key = trimmed.toLocaleLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(trimmed);
    }

    return result;
  }

  private hasStaticOptions(): boolean {
    return Array.isArray(this.options);
  }
}
