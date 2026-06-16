import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AiChatMessage, AiChatSession } from '../../../../core/models/ai-chat.models';
import { AiChatService } from '../../../../core/services/ai-chat.service';
import { SimpleMarkdownPipe } from '../../../../shared/pipes/simple-markdown.pipe';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleMarkdownPipe],
  templateUrl: './ai-chat.component.html',
  styleUrl: './ai-chat.component.css',
})
export class AiChatComponent implements OnDestroy {
  readonly doctorId = input.required<string>();
  readonly consultationId = input<string>('');
  readonly patientId = input<string>('');
  @ViewChild('scrollArea') private scrollArea?: ElementRef<HTMLDivElement>;

  private readonly aiChat = inject(AiChatService);

  protected readonly isOpen = signal(false);
  protected readonly isExpanded = signal(false);
  protected readonly expandedTableHtml = signal('');
  protected readonly showSessions = signal(true);
  protected readonly sessions = signal<AiChatSession[]>([]);
  protected readonly activeSessionId = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly isLoading = signal(false);
  protected readonly pendingSeconds = signal(0);
  private pendingTimerId: ReturnType<typeof setInterval> | null = null;
  private pendingPollTimerId: ReturnType<typeof setInterval> | null = null;
  private pendingPollSessionId: string | null = null;

  protected readonly activeSession = computed(() => {
    const id = this.activeSessionId();
    return this.sessions().find((session) => session.id === id) ?? null;
  });

  protected readonly messages = computed(() => this.activeSession()?.messages ?? []);
  protected readonly hasPendingAssistant = computed(() =>
    this.messages().some((message) => message.role === 'assistant' && message.status === 'sending'),
  );
  protected readonly canSend = computed(() =>
    !this.isLoading() && !this.hasPendingAssistant() && !!this.draft().trim(),
  );
  protected readonly assistantStatusText = computed(() => {
    const seconds = this.pendingSeconds();

    if (seconds >= 35) {
      return "L'assistant verifie encore les donnees...";
    }

    if (seconds >= 12) {
      return "L'assistant consulte le dossier...";
    }

    return "L'assistant ecrit...";
  });

  protected readonly headerTitle = computed(() =>
    this.showSessions() ? 'Assistant IA' : (this.activeSession()?.title || 'Assistant IA'),
  );

  protected toggleChat(): void {
    this.isOpen.update((value) => !value);
    if (this.isOpen()) {
      this.loadSessions();
    }
  }

  protected closeChat(): void {
    this.isOpen.set(false);
    this.isExpanded.set(false);
    this.expandedTableHtml.set('');
  }

  ngOnDestroy(): void {
    this.stopPendingTimer();
    this.stopPendingPolling();
  }

  protected createSession(): void {
    this.isLoading.set(true);
    this.aiChat
      .createSession({
        title: 'Nouvelle discussion',
        context: this.buildContext(),
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (session) => {
          this.sessions.update((sessions) => [session, ...sessions]);
          this.selectSession(session.id);
        },
      });
  }

  protected selectSession(sessionId: string): void {
    this.activeSessionId.set(sessionId);
    this.showSessions.set(false);
    this.aiChat.getSession(sessionId).subscribe({
      next: (session) => {
        this.upsertSession(this.normalizeRecoveredSession(session));
        this.syncPendingState();
        setTimeout(() => this.scrollToBottom(), 0);
      },
      error: () => this.backToSessions(),
    });
  }

  protected backToSessions(): void {
    this.activeSessionId.set(null);
    this.showSessions.set(true);
    this.stopPendingTimer();
    this.stopPendingPolling();
    this.loadSessions();
  }

  protected deleteSession(event: MouseEvent, sessionId: string): void {
    event.stopPropagation();
    this.aiChat.deleteSession(sessionId).subscribe({
      next: () => {
        this.sessions.update((sessions) => sessions.filter((session) => session.id !== sessionId));
        if (this.activeSessionId() === sessionId) {
          this.backToSessions();
        }
      },
    });
  }

  protected deleteMessage(messageId: string): void {
    const session = this.activeSession();
    if (!session || this.isLoading()) {
      return;
    }

    if (!this.isPersistedId(messageId)) {
      this.replaceActiveSession({
        ...session,
        messages: session.messages.filter((message) => message.id !== messageId),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    this.aiChat.deleteMessage(session.id, messageId).subscribe({
      next: () => {
        this.replaceActiveSession({
          ...session,
          messages: session.messages.filter((message) => message.id !== messageId),
          updatedAt: new Date().toISOString(),
        });
      },
      error: () => {
        this.updateMessage(messageId, {
          status: 'error',
          error: 'delete_failed',
          content: 'Impossible de supprimer ce message pour le moment.',
        });
      },
    });
  }

  protected retryMessage(messageId: string): void {
    const session = this.activeSession();
    if (!session || this.isLoading()) {
      return;
    }

    const messageIndex = session.messages.findIndex((message) => message.id === messageId);
    if (messageIndex <= 0) {
      return;
    }

    const previousUser = [...session.messages]
      .slice(0, messageIndex)
      .reverse()
      .find((message) => message.role === 'user');

    if (!previousUser) {
      return;
    }

    this.replaceActiveSession({
      ...session,
      messages: session.messages.filter((message) => message.id !== messageId),
      updatedAt: new Date().toISOString(),
    });
    this.sendToAssistant(previousUser.content, false);
  }

  protected sendMessage(): void {
    const content = this.draft().trim();
    if (!content || !this.canSend()) {
      return;
    }

    this.draft.set('');
    if (!this.activeSession()) {
      this.isLoading.set(true);
      this.aiChat
        .createSession({
          title: this.buildTitle(content),
          context: this.buildContext(),
        })
        .subscribe({
          next: (session) => {
            this.sessions.update((sessions) => [session, ...sessions]);
            this.activeSessionId.set(session.id);
            this.showSessions.set(false);
            this.sendToAssistant(content, true);
          },
          error: (error) => {
            this.isLoading.set(false);
            this.draft.set(content);
            window.alert(this.extractError(error));
          },
        });
      return;
    }

    this.sendToAssistant(content, true);
  }

  protected updateDraft(value: string): void {
    this.draft.set(value);
  }

  protected toggleExpanded(): void {
    this.isExpanded.update((value) => !value);
    setTimeout(() => this.scrollToBottom(), 0);
  }

  protected closeExpandedTable(): void {
    this.expandedTableHtml.set('');
  }

  protected onMarkdownClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const expandButton = target?.closest('.expand-table-btn') as HTMLButtonElement | null;
    if (!expandButton) {
      return;
    }

    const tableShell = expandButton.closest('.markdown-table-shell');
    const tableWrap = tableShell?.querySelector('.markdown-table-wrap');
    if (!tableWrap) {
      return;
    }

    this.expandedTableHtml.set(tableWrap.innerHTML);
  }

  protected trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  private sendToAssistant(content: string, includeUserMessage: boolean): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }

    const now = new Date().toISOString();
    const userMessage: AiChatMessage = {
      id: this.createId(),
      role: 'user',
      content,
      status: 'ready',
      createdAt: now,
      sortOrder: session.messages.length,
    };
    const assistantMessage: AiChatMessage = {
      id: this.createId(),
      role: 'assistant',
      content: '',
      status: 'sending',
      createdAt: now,
      sortOrder: session.messages.length + 1,
    };

    this.replaceActiveSession({
      ...session,
      messages: includeUserMessage
        ? [...session.messages, userMessage, assistantMessage]
        : [...session.messages, assistantMessage],
      updatedAt: now,
    });
    this.isLoading.set(true);
    this.startPendingTimer();
    setTimeout(() => this.scrollToBottom(), 0);

    this.aiChat
      .sendMessage(session.id, { content, context: this.buildContext() })
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.syncPendingState();
        }),
      )
      .subscribe({
        next: (updatedSession) => {
          this.replaceActiveSession(this.normalizeRecoveredSession(updatedSession));
        },
        error: (error) => {
          this.updateMessage(assistantMessage.id, {
            content: this.extractError(error),
            status: 'error',
            error: 'request_failed',
          });
        },
      });
  }

  private updateMessage(messageId: string, patch: Partial<AiChatMessage>): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }

    this.replaceActiveSession({
      ...session,
      messages: session.messages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message,
      ),
      updatedAt: new Date().toISOString(),
    });
    setTimeout(() => this.scrollToBottom(), 0);
  }

  private replaceActiveSession(nextSession: AiChatSession): void {
    this.upsertSession(nextSession);
    this.activeSessionId.set(nextSession.id);
    this.syncPendingState();
  }

  private loadSessions(): void {
    this.aiChat.getSessions().subscribe({
      next: (sessions) => this.sessions.set(sessions.map((session) => this.normalizeRecoveredSession(session))),
      error: () => this.sessions.set([]),
    });
  }

  private upsertSession(nextSession: AiChatSession): void {
    this.sessions.update((sessions) => {
      const exists = sessions.some((session) => session.id === nextSession.id);
      const next = exists
        ? sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
        : [nextSession, ...sessions];

      return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  private syncPendingState(): void {
    const session = this.activeSession();
    if (!session) {
      this.stopPendingTimer();
      this.stopPendingPolling();
      return;
    }

    const hasPending = !!session?.messages.some(
      (message) => message.role === 'assistant' && message.status === 'sending',
    );

    if (!hasPending) {
      this.stopPendingTimer();
      this.stopPendingPolling();
      return;
    }

    if (!this.pendingTimerId) {
      this.startPendingTimer();
    }

    this.startPendingPolling(session.id);
  }

  private startPendingPolling(sessionId: string): void {
    if (this.pendingPollTimerId && this.pendingPollSessionId === sessionId) {
      return;
    }

    this.stopPendingPolling();
    this.pendingPollSessionId = sessionId;
    this.pendingPollTimerId = setInterval(() => {
      if (this.activeSessionId() !== sessionId) {
        this.stopPendingPolling();
        return;
      }

      this.aiChat.getSession(sessionId).subscribe({
        next: (session) => {
          this.upsertSession(this.normalizeRecoveredSession(session));
          this.syncPendingState();
          setTimeout(() => this.scrollToBottom(), 0);
        },
        error: () => {
          this.stopPendingPolling();
        },
      });
    }, 2500);
  }

  private normalizeRecoveredSession(session: AiChatSession): AiChatSession {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    return {
      ...session,
      messages: session.messages.map((message) => {
        if (
          message.role !== 'assistant' ||
          message.status !== 'sending' ||
          Date.parse(message.createdAt) > fiveMinutesAgo
        ) {
          return message;
        }

        return {
          ...message,
          status: 'error',
          error: 'request_timeout',
          content:
            "La reponse precedente n'a pas abouti. Reessayez depuis ce message.",
        };
      }),
    };
  }

  private startPendingTimer(): void {
    this.stopPendingTimer();
    this.pendingSeconds.set(0);
    this.pendingTimerId = setInterval(() => {
      this.pendingSeconds.update((value) => value + 1);
    }, 1000);
  }

  private stopPendingTimer(): void {
    if (this.pendingTimerId) {
      clearInterval(this.pendingTimerId);
      this.pendingTimerId = null;
    }
    this.pendingSeconds.set(0);
  }

  private stopPendingPolling(): void {
    if (this.pendingPollTimerId) {
      clearInterval(this.pendingPollTimerId);
      this.pendingPollTimerId = null;
    }
    this.pendingPollSessionId = null;
  }

  private buildTitle(content: string): string {
    const compact = content.replace(/\s+/g, ' ').trim();
    return compact.length > 42 ? `${compact.slice(0, 42)}...` : compact || 'Nouvelle discussion';
  }

  private buildContext(): string {
    const lines = [
      'Chat flottant dans Dermatologo pour dermatologues.',
      'Si un patientId est fourni, il correspond au patient actuellement ouvert dans la consultation active.',
      'Si un consultationId est fourni, il correspond a la consultation actuellement ouverte.',
    ];

    const patientId = this.patientId().trim();
    const consultationId = this.consultationId().trim();

    if (patientId) {
      lines.push(`patientId: ${patientId}`);
    }

    if (consultationId) {
      lines.push(`consultationId: ${consultationId}`);
    }

    return lines.join('\n');
  }

  private extractError(error: unknown): string {
    const candidate = error as { error?: { message?: string }; message?: string };
    return (
      candidate?.error?.message ||
      candidate?.message ||
      "Impossible de contacter l'assistant IA. Reessayez."
    );
  }

  private scrollToBottom(): void {
    const element = this.scrollArea?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }

  private createId(): string {
    return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  protected isPersistedId(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }
}
