import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { SuggestionRealtimeService } from '../../../../core/services/suggestion-realtime.service';
import { SuggestionService } from '../../../../core/services/suggestion.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DoctorSuggestion } from '../../../../core/models/suggestion.models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-suggestions-page',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './suggestions-page.html',
  styleUrl: './suggestions-page.css',
})
export class SuggestionsPage implements OnInit, OnDestroy {
  private readonly suggestionService = inject(SuggestionService);
  private readonly realtime = inject(SuggestionRealtimeService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly subscriptions = new Subscription();

  protected readonly suggestions = signal<DoctorSuggestion[]>([]);
  protected readonly selectedId = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly subject = signal('');
  protected readonly message = signal('');
  protected readonly replyDraft = signal<Record<string, string>>({});
  protected readonly isAdmin = computed(() => this.auth.hasAnyRole(['admin', 'super_admin']));
  protected readonly isRtl = computed(() => this.i18n.lang() === 'ar');
  protected readonly selectedSuggestion = computed(() =>
    this.suggestions().find((item) => item.id === this.selectedId()) ?? this.suggestions()[0] ?? null,
  );

  ngOnInit(): void {
    this.loadSuggestions();
    void this.realtime.connect();

    this.subscriptions.add(
      this.realtime.suggestionCreated$.subscribe((suggestion) => {
        if (!this.isAdmin()) {
          return;
        }

        this.upsertSuggestion(suggestion, true);
        this.toast.info(this.t('suggestions.toast.new'));
      }),
    );

    this.subscriptions.add(
      this.realtime.suggestionUpdated$.subscribe((suggestion) => {
        if (this.isAdmin()) {
          this.upsertSuggestion(suggestion);
        }
      }),
    );

    this.subscriptions.add(
      this.realtime.suggestionReplied$.subscribe((suggestion) => {
        if (this.isAdmin()) {
          return;
        }

        this.upsertSuggestion(suggestion);
        this.toast.info(this.t('suggestions.toast.reply'));
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  protected loadSuggestions(): void {
    this.loading.set(true);
    this.suggestionService.getSuggestions().subscribe({
      next: (items) => {
        this.suggestions.set(items ?? []);
        if (!this.selectedId() && items?.length) {
          this.selectedId.set(items[0].id);
        }
      },
      error: () => this.toast.error(this.t('suggestions.toast.loadError')),
      complete: () => this.loading.set(false),
    });
  }

  protected selectSuggestion(suggestion: DoctorSuggestion): void {
    this.selectedId.set(suggestion.id);
  }

  protected createSuggestion(): void {
    const subject = this.subject().trim();
    const message = this.message().trim();
    if (!subject || !message || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.suggestionService.createSuggestion({ subject, message }).subscribe({
      next: (suggestion) => {
        this.subject.set('');
        this.message.set('');
        this.upsertSuggestion(suggestion, true);
        this.selectedId.set(suggestion.id);
        this.toast.success(this.t('suggestions.toast.sent'));
      },
      error: () => this.toast.error(this.t('suggestions.toast.saveError')),
      complete: () => this.saving.set(false),
    });
  }

  protected replyToSuggestion(suggestion: DoctorSuggestion): void {
    const message = (this.replyDraft()[suggestion.id] ?? '').trim();
    if (!message || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.suggestionService.reply(suggestion.id, { message }).subscribe({
      next: (updated) => {
        this.replyDraft.update((drafts) => ({ ...drafts, [suggestion.id]: '' }));
        this.upsertSuggestion(updated);
        this.toast.success(this.t('suggestions.toast.replied'));
      },
      error: () => this.toast.error(this.t('suggestions.toast.replyError')),
      complete: () => this.saving.set(false),
    });
  }

  protected setReplyDraft(suggestionId: string, value: string): void {
    this.replyDraft.update((drafts) => ({ ...drafts, [suggestionId]: value }));
  }

  protected getReplyDraft(suggestionId: string): string {
    return this.replyDraft()[suggestionId] ?? '';
  }

  protected doctorName(suggestion: DoctorSuggestion): string {
    return `Dr ${suggestion.doctorFirstName} ${suggestion.doctorLastName}`.trim();
  }

  protected responderName(reply: { responderFirstName: string; responderLastName: string }): string {
    return `Dr ${reply.responderFirstName} ${reply.responderLastName}`.trim();
  }

  private upsertSuggestion(suggestion: DoctorSuggestion, prepend = false): void {
    this.suggestions.update((items) => {
      const index = items.findIndex((item) => item.id === suggestion.id);
      if (index >= 0) {
        const next = [...items];
        next[index] = suggestion;
        return next.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      }

      return prepend ? [suggestion, ...items] : [...items, suggestion];
    });
  }

  private t(key: string): string {
    return this.i18n.t(key);
  }
}
