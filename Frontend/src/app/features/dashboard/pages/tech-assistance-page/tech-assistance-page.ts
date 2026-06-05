import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  TechAssistanceAttachment,
  TechAssistanceMessage,
  TechAssistanceTicket,
} from '../../../../core/models/tech-assistance.models';
import { AuthService } from '../../../../core/services/auth.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { TechAssistanceRealtimeService } from '../../../../core/services/tech-assistance-realtime.service';
import { TechAssistanceService } from '../../../../core/services/tech-assistance.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-tech-assistance-page',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './tech-assistance-page.html',
  styleUrl: './tech-assistance-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechAssistancePage implements OnInit, OnDestroy {
  private readonly techAssistanceService = inject(TechAssistanceService);
  private readonly realtime = inject(TechAssistanceRealtimeService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly subscriptions = new Subscription();
  private readonly apiBaseUrl = environment.apiUrl.replace(/\/+$/, '');

  protected readonly tickets = signal<TechAssistanceTicket[]>([]);
  protected readonly selectedId = signal('');
  protected readonly loading = signal(false);
  protected readonly creating = signal(false);
  protected readonly sendingTicketId = signal('');
  protected readonly escalatingTicketId = signal('');
  protected readonly closingTicketId = signal('');
  protected readonly subject = signal('');
  protected readonly message = signal('');
  protected readonly attachments = signal<File[]>([]);
  protected readonly replyDraft = signal<Record<string, string>>({});
  protected readonly replyAttachments = signal<Record<string, File[]>>({});
  protected readonly isAdmin = computed(() => this.auth.hasAnyRole(['admin', 'super_admin']));
  protected readonly isSuperAdmin = computed(() => this.auth.hasAnyRole(['super_admin']));
  protected readonly isRtl = computed(() => this.i18n.lang() === 'ar');
  protected readonly selectedTicket = computed(() =>
    this.tickets().find((item) => item.id === this.selectedId()) ?? this.tickets()[0] ?? null,
  );
  protected readonly canCreate = computed(
    () => this.subject().trim().length > 0 && this.canSend(this.message(), this.attachments()),
  );

  ngOnInit(): void {
    this.loadTickets();
    void this.realtime.connect();

    this.subscriptions.add(
      this.realtime.ticketCreated$.subscribe((ticket) => {
        if (!this.isAdmin()) {
          return;
        }

        this.upsertTicket(ticket, true);
        this.toast.info(this.t('techAssist.toast.new'));
      }),
    );

    this.subscriptions.add(
      this.realtime.ticketUpdated$.subscribe((ticket) => {
        this.upsertTicket(ticket);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  protected loadTickets(): void {
    this.loading.set(true);
    this.techAssistanceService.getTickets().subscribe({
      next: (items) => {
        const tickets = items ?? [];
        this.tickets.set(tickets);
        if (!this.selectedId() && tickets.length) {
          this.selectedId.set(tickets[0].id);
        }
      },
      error: () => this.toast.error(this.t('techAssist.toast.loadError')),
      complete: () => this.loading.set(false),
    });
  }

  protected selectTicket(ticket: TechAssistanceTicket): void {
    this.selectedId.set(ticket.id);
  }

  protected createTicket(fileInput: HTMLInputElement): void {
    const subject = this.subject().trim();
    const message = this.message().trim();
    const attachments = this.attachments();
    if (!subject || !this.canSend(message, attachments) || this.creating()) {
      return;
    }

    this.creating.set(true);
    this.techAssistanceService.createTicket({ subject, message, attachments }).subscribe({
      next: (ticket) => {
        this.subject.set('');
        this.message.set('');
        this.attachments.set([]);
        fileInput.value = '';
        this.upsertTicket(ticket, true);
        this.selectedId.set(ticket.id);
        this.toast.success(this.t('techAssist.toast.sent'));
      },
      error: (error) =>
        this.toast.error(this.extractApiErrorMessage(error) || this.t('techAssist.toast.saveError')),
      complete: () => this.creating.set(false),
    });
  }

  protected sendMessage(ticket: TechAssistanceTicket, fileInput: HTMLInputElement): void {
    const message = this.getReplyDraft(ticket.id).trim();
    const attachments = this.getReplyAttachments(ticket.id);
    if (!this.canSend(message, attachments) || this.sendingTicketId()) {
      return;
    }

    this.sendingTicketId.set(ticket.id);
    this.techAssistanceService.addMessage(ticket.id, { message, attachments }).subscribe({
      next: (updated) => {
        this.replyDraft.update((drafts) => ({ ...drafts, [ticket.id]: '' }));
        this.replyAttachments.update((items) => ({ ...items, [ticket.id]: [] }));
        fileInput.value = '';
        this.upsertTicket(updated);
        this.toast.success(this.t('techAssist.toast.messageSent'));
      },
      error: (error) =>
        this.toast.error(
          this.extractApiErrorMessage(error) || this.t('techAssist.toast.messageError'),
        ),
      complete: () => this.sendingTicketId.set(''),
    });
  }

  protected notifyTechLead(ticket: TechAssistanceTicket): void {
    if (!this.isSuperAdmin() || this.escalatingTicketId()) {
      return;
    }

    this.escalatingTicketId.set(ticket.id);
    this.techAssistanceService.notifyTechLead(ticket.id).subscribe({
      next: (updated) => {
        this.upsertTicket(updated);
        this.toast.success(this.t('techAssist.toast.techLeadNotified'));
      },
      error: (error) =>
        this.toast.error(
          this.extractApiErrorMessage(error) || this.t('techAssist.toast.techLeadError'),
        ),
      complete: () => this.escalatingTicketId.set(''),
    });
  }

  protected closeTicket(ticket: TechAssistanceTicket): void {
    if (!this.isAdmin() || this.closingTicketId() || ticket.status === 'closed') {
      return;
    }

    this.closingTicketId.set(ticket.id);
    this.techAssistanceService.closeTicket(ticket.id).subscribe({
      next: (updated) => {
        this.upsertTicket(updated);
        this.toast.success(this.t('techAssist.toast.closed'));
      },
      error: (error) =>
        this.toast.error(
          this.extractApiErrorMessage(error) || this.t('techAssist.toast.closeError'),
        ),
      complete: () => this.closingTicketId.set(''),
    });
  }

  protected setReplyDraft(ticketId: string, value: string): void {
    this.replyDraft.update((drafts) => ({ ...drafts, [ticketId]: value }));
  }

  protected getReplyDraft(ticketId: string): string {
    return this.replyDraft()[ticketId] ?? '';
  }

  protected onCreateFilesSelected(event: Event): void {
    this.attachments.set(this.readFiles(event));
  }

  protected onReplyFilesSelected(ticketId: string, event: Event): void {
    const files = this.readFiles(event);
    this.replyAttachments.update((items) => ({ ...items, [ticketId]: files }));
  }

  protected getReplyAttachments(ticketId: string): File[] {
    return this.replyAttachments()[ticketId] ?? [];
  }

  protected removeCreateAttachment(file: File, fileInput: HTMLInputElement): void {
    this.attachments.update((files) => files.filter((item) => item !== file));
    if (this.attachments().length === 0) {
      fileInput.value = '';
    }
  }

  protected removeReplyAttachment(
    ticketId: string,
    file: File,
    fileInput: HTMLInputElement,
  ): void {
    this.replyAttachments.update((items) => {
      const nextFiles = this.getReplyAttachments(ticketId).filter((item) => item !== file);
      return { ...items, [ticketId]: nextFiles };
    });
    if (this.getReplyAttachments(ticketId).length === 0) {
      fileInput.value = '';
    }
  }

  protected isMine(message: TechAssistanceMessage): boolean {
    const senderIsAdmin = this.isAdminRole(message.senderRole);
    return this.isAdmin() ? senderIsAdmin : !senderIsAdmin;
  }

  protected statusKey(ticket: TechAssistanceTicket): string {
    if (ticket.status === 'answered') {
      return 'techAssist.status.answered';
    }

    if (ticket.status === 'escalated') {
      return 'techAssist.status.escalated';
    }

    if (ticket.status === 'closed') {
      return 'techAssist.status.closed';
    }

    return 'techAssist.status.open';
  }

  protected roleKey(role: string): string {
    if (role === 'super_admin') {
      return 'techAssist.role.superAdmin';
    }

    if (role === 'admin') {
      return 'techAssist.role.admin';
    }

    if (role === 'requester') {
      return 'techAssist.role.requester';
    }

    return 'techAssist.role.doctor';
  }

  protected attachmentUrl(attachment: TechAssistanceAttachment): string {
    if (
      attachment.fileUrl.startsWith('http://') ||
      attachment.fileUrl.startsWith('https://')
    ) {
      return attachment.fileUrl;
    }

    return `${this.apiBaseUrl}/${attachment.fileUrl.replace(/^\/+/, '')}`;
  }

  protected fileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 KB';
    }

    if (bytes < 1024 * 1024) {
      return `${Math.ceil(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected isImageAttachment(attachment: TechAssistanceAttachment): boolean {
    return attachment.contentType.startsWith('image/');
  }

  protected displayName(firstName: string, lastName: string): string {
    return `Dr ${firstName} ${lastName}`.trim();
  }

  protected isSending(ticket: TechAssistanceTicket): boolean {
    return this.sendingTicketId() === ticket.id;
  }

  protected isEscalating(ticket: TechAssistanceTicket): boolean {
    return this.escalatingTicketId() === ticket.id;
  }

  protected isClosing(ticket: TechAssistanceTicket): boolean {
    return this.closingTicketId() === ticket.id;
  }

  protected canReply(ticket: TechAssistanceTicket): boolean {
    return ticket.status !== 'closed';
  }

  protected replyActionKey(ticket: TechAssistanceTicket): string {
    if (ticket.status === 'closed') {
      return 'techAssist.closed';
    }

    return this.isAdmin() ? 'techAssist.reply' : 'techAssist.followUp';
  }

  protected replyKickerKey(): string {
    return this.isAdmin() ? 'techAssist.reply.adminKicker' : 'techAssist.reply.followUpKicker';
  }

  private upsertTicket(ticket: TechAssistanceTicket, prepend = false): void {
    this.tickets.update((items) => {
      const index = items.findIndex((item) => item.id === ticket.id);
      if (index >= 0) {
        const next = [...items];
        next[index] = ticket;
        return next.sort((a, b) => this.sortTime(b) - this.sortTime(a));
      }

      return prepend ? [ticket, ...items] : [...items, ticket].sort((a, b) => this.sortTime(b) - this.sortTime(a));
    });
  }

  private sortTime(ticket: TechAssistanceTicket): number {
    return +new Date(ticket.lastMessageAt ?? ticket.updatedAt ?? ticket.createdAt);
  }

  protected canSend(message: string, attachments: File[]): boolean {
    return message.trim().length > 0 || attachments.length > 0;
  }

  private readFiles(event: Event): File[] {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files) {
      return [];
    }

    return Array.from(input.files).slice(0, 5);
  }

  private isAdminRole(role: string): boolean {
    return role === 'admin' || role === 'super_admin';
  }

  private extractApiErrorMessage(error: unknown): string {
    const unknownError = error as {
      error?: { message?: string; Message?: string } | string;
      message?: string;
    };

    if (typeof unknownError?.error === 'string' && unknownError.error.trim()) {
      return unknownError.error.trim();
    }

    const nestedMessage =
      unknownError?.error && typeof unknownError.error === 'object'
        ? unknownError.error.message ?? unknownError.error.Message
        : '';

    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage.trim();
    }

    if (typeof unknownError?.message === 'string' && unknownError.message.trim()) {
      return unknownError.message.trim();
    }

    return '';
  }

  private t(key: string): string {
    return this.i18n.t(key);
  }
}
