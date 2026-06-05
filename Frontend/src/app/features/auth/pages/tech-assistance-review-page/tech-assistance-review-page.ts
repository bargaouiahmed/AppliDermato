import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  TechAssistanceAttachment,
  TechAssistanceMessage,
  TechAssistanceTicket,
} from '../../../../core/models/tech-assistance.models';
import { TechAssistanceService } from '../../../../core/services/tech-assistance.service';

@Component({
  selector: 'app-tech-assistance-review-page',
  imports: [DatePipe, FormsModule],
  templateUrl: './tech-assistance-review-page.html',
  styleUrl: './tech-assistance-review-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechAssistanceReviewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly techAssistanceService = inject(TechAssistanceService);
  private readonly apiBaseUrl = environment.apiUrl.replace(/\/+$/, '');
  private readonly ticketId = this.route.snapshot.paramMap.get('ticketId') ?? '';

  protected readonly password = signal('');
  protected readonly ticket = signal<TechAssistanceTicket | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly unlocked = computed(() => this.ticket() !== null);

  protected unlock(): void {
    const password = this.password().trim();
    if (!password || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.techAssistanceService.getPublicReviewTicket(this.ticketId, { password }).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        this.password.set('');
      },
      error: () => {
        this.ticket.set(null);
        this.error.set('Unable to open this review. Check the password or the link.');
      },
      complete: () => this.loading.set(false),
    });
  }

  protected roleLabel(role: string): string {
    switch (role) {
      case 'super_admin':
        return 'Super admin';
      case 'admin':
        return 'Admin';
      case 'requester':
        return 'Requester';
      default:
        return 'Doctor';
    }
  }

  protected isAdminMessage(message: TechAssistanceMessage): boolean {
    return message.senderRole === 'admin' || message.senderRole === 'super_admin';
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

  protected isImageAttachment(attachment: TechAssistanceAttachment): boolean {
    return attachment.contentType.startsWith('image/');
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
}
