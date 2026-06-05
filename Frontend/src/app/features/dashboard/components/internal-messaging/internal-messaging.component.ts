import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  InternalMessage,
  InternalMessagingBootstrap,
  InternalMessagingRoom,
  InternalMessagingRoomKey,
  InternalMessagingSender,
} from '../../../../core/models/internal-messaging.models';
import { InternalMessagingNotificationService } from '../../../../core/services/internal-messaging-notification.service';
import { InternalMessagingRealtimeService } from '../../../../core/services/internal-messaging-realtime.service';
import { InternalMessagingService } from '../../../../core/services/internal-messaging.service';

@Component({
  selector: 'app-internal-messaging',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './internal-messaging.component.html',
  styleUrl: './internal-messaging.component.css',
})
export class InternalMessagingComponent implements OnInit, OnDestroy {
  private readonly messagingService = inject(InternalMessagingService);
  private readonly realtimeService = inject(InternalMessagingRealtimeService);
  private readonly notificationService = inject(InternalMessagingNotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subscriptions = new Subscription();
  private allowedRoomIds = new Set<string>();
  private roomUnreadCounts = new Map<string, number>();
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly seenTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly unlockAudio = (): void => {
    this.notificationService.initAudio();
    document.removeEventListener('click', this.unlockAudio);
  };

  protected bootstrap: InternalMessagingBootstrap | null = null;
  protected rooms: InternalMessagingRoom[] = [];
  protected activeRoomId = '';
  protected selectedRoomKey: InternalMessagingRoomKey = 'group';
  protected messages: InternalMessage[] = [];
  protected newMessage = '';
  protected isOpen = false;
  protected isBootstrapLoading = true;
  protected isMessagesLoading = false;
  protected loadError = '';
  protected unreadCount = this.readUnreadCount();
  protected isTypingByOther = false;
  protected typingLabel = '';
  protected editingMessageId: string | null = null;
  protected editingContent = '';

  ngOnInit(): void {
    void this.notificationService.requestPermission();
    document.addEventListener('click', this.unlockAudio);
    this.registerRealtimeHandlers();
    this.loadBootstrap();
  }

  ngOnDestroy(): void {
    this.stopTyping();
    this.seenTimers.forEach((timer) => clearTimeout(timer));
    this.seenTimers.clear();
    this.subscriptions.unsubscribe();
    document.removeEventListener('click', this.unlockAudio);
    void this.realtimeService.disconnect();
  }

  protected toggleChat(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      if (this.activeRoomId) {
        this.loadMessages();
      }
    }
  }

  protected selectRoom(room: InternalMessagingRoom): void {
    if (room.roomId === this.activeRoomId) {
      return;
    }

    this.activeRoomId = room.roomId;
    this.selectedRoomKey = room.key;
    this.cancelEdit();
    this.stopTyping();
    void this.realtimeService.join(room.roomId);
    this.loadMessages();
  }

  protected envoyer(): void {
    const content = this.newMessage.trim();
    if (!content || !this.activeRoomId || !this.bootstrap) {
      return;
    }

    this.messagingService
      .sendMessage({
        roomId: this.activeRoomId,
        sender: this.currentSender,
        content,
      })
      .subscribe({
        next: (savedMessage) => {
          this.upsertMessage(savedMessage);
          this.newMessage = '';
          this.stopTyping();
          this.scrollToBottom();
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadError = "Le message n'a pas pu etre envoye.";
          this.cdr.detectChanges();
        },
      });
  }

  protected onInputChange(): void {
    if (!this.activeRoomId || !this.newMessage.trim()) {
      this.stopTyping();
      return;
    }

    this.realtimeService.emitTyping({
      roomId: this.activeRoomId,
      sender: this.currentSender,
    });

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => this.stopTyping(), 1200);
  }

  protected stopTyping(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    if (!this.activeRoomId || !this.bootstrap) {
      return;
    }

    this.realtimeService.emitStopTyping({
      roomId: this.activeRoomId,
      sender: this.currentSender,
    });
  }

  protected isMine(message: InternalMessage): boolean {
    return message.sender === this.currentSender;
  }

  protected displaySender(messageOrSender: InternalMessage | InternalMessagingSender): string {
    const sender = typeof messageOrSender === 'string' ? messageOrSender : messageOrSender.sender;
    switch (sender) {
      case 'medecin':
        return 'MEDECIN';
      case 'secretaire1':
        return 'SECRETAIRE 1';
      case 'secretaire2':
        return 'SECRETAIRE 2';
      default:
        return String(sender).toUpperCase();
    }
  }

  protected activeRoomLabel(): string {
    return this.rooms.find((room) => room.roomId === this.activeRoomId)?.label ?? 'Messagerie';
  }

  protected canEdit(message: InternalMessage): boolean {
    return this.isMine(message) && !message.deletedAt;
  }

  protected startEdit(message: InternalMessage): void {
    if (!this.canEdit(message)) {
      return;
    }

    this.editingMessageId = message.id;
    this.editingContent = message.content;
  }

  protected cancelEdit(): void {
    this.editingMessageId = null;
    this.editingContent = '';
  }

  protected saveEdit(message: InternalMessage): void {
    const content = this.editingContent.trim();
    if (!content || !this.canEdit(message)) {
      return;
    }

    this.messagingService
      .editMessage(message.id, {
        sender: this.currentSender,
        content,
      })
      .subscribe({
        next: (updatedMessage) => {
          this.upsertMessage(updatedMessage);
          this.cancelEdit();
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadError = "Le message n'a pas pu etre modifie.";
          this.cdr.detectChanges();
        },
      });
  }

  protected deleteMessage(message: InternalMessage): void {
    if (!this.canEdit(message)) {
      return;
    }

    this.messagingService
      .deleteMessage(message.id, {
        sender: this.currentSender,
      })
      .subscribe({
        next: (deletedMessage) => {
          this.upsertMessage(deletedMessage);
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadError = "Le message n'a pas pu etre supprime.";
          this.cdr.detectChanges();
        },
      });
  }

  protected wasSeenByOther(message: InternalMessage): boolean {
    if (!this.isMine(message)) {
      return false;
    }

    return message.seenBy.some((viewer) => viewer !== this.currentSender);
  }

  protected scrollToBottom(): void {
    setTimeout(() => {
      const messageList = document.querySelector('.internal-messaging .messages-list');
      if (messageList instanceof HTMLElement) {
        messageList.scrollTop = messageList.scrollHeight;
      }
    }, 50);
  }

  private get currentSender(): InternalMessagingSender {
    return this.bootstrap?.currentSender ?? 'medecin';
  }

  private loadBootstrap(): void {
    this.isBootstrapLoading = true;
    this.messagingService.getBootstrap().subscribe({
      next: (bootstrap) => {
        this.bootstrap = bootstrap;
        this.rooms = bootstrap.rooms ?? [];
        this.allowedRoomIds = new Set(this.rooms.map((room) => room.roomId));
        this.setUnreadCountsFromRooms(this.rooms);
        const defaultRoom = this.rooms.find((room) => room.key === 'group') ?? this.rooms[0];

        if (defaultRoom) {
          this.activeRoomId = defaultRoom.roomId;
          this.selectedRoomKey = defaultRoom.key;
        }

        this.isBootstrapLoading = false;
        this.loadError = '';
        void this.connectAndJoinRooms();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isBootstrapLoading = false;
        this.loadError = 'Messagerie indisponible.';
        this.cdr.detectChanges();
      },
    });
  }

  private async connectAndJoinRooms(): Promise<void> {
    await this.realtimeService.connect();
    await Promise.all(this.rooms.map((room) => this.realtimeService.join(room.roomId)));
  }

  private loadMessages(): void {
    const roomId = this.activeRoomId;
    if (!roomId) {
      return;
    }

    this.isMessagesLoading = true;
    this.messagingService.getMessagesByRoom(roomId).subscribe({
      next: (messages) => {
        if (this.activeRoomId !== roomId) {
          return;
        }

        this.messages = messages;
        this.isMessagesLoading = false;
        this.loadError = '';
        this.scrollToBottom();
        this.cdr.detectChanges();
        this.scheduleMarkSeenIfVisible(roomId);
      },
      error: () => {
        if (this.activeRoomId !== roomId) {
          return;
        }

        this.messages = [];
        this.isMessagesLoading = false;
        this.loadError = 'Impossible de charger la conversation.';
        this.cdr.detectChanges();
      },
    });
  }

  private registerRealtimeHandlers(): void {
    this.subscriptions.add(
      this.realtimeService.message$.subscribe((message) => {
        if (!this.allowedRoomIds.has(message.roomId)) {
          return;
        }

        const isActiveRoom = message.roomId === this.activeRoomId;
        const wasInserted = isActiveRoom ? this.upsertMessage(message) : true;

        if (isActiveRoom) {
          this.scrollToBottom();
          if (this.isOpen && message.sender !== this.currentSender) {
            this.scheduleMarkSeenIfVisible(message.roomId);
          }
        }

        if (message.sender !== this.currentSender && wasInserted) {
          this.notificationService.notify(this.displaySender(message), message.content);
          if (!this.isOpen || !isActiveRoom) {
            this.incrementRoomUnread(message.roomId);
          }
        }

        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.realtimeService.typing$.subscribe((payload) => {
        if (payload.roomId !== this.activeRoomId || payload.sender === this.currentSender) {
          return;
        }

        this.isTypingByOther = true;
        this.typingLabel = this.displaySender(payload.sender);
        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.realtimeService.stopTyping$.subscribe((payload) => {
        if (payload.roomId !== this.activeRoomId || payload.sender === this.currentSender) {
          return;
        }

        this.isTypingByOther = false;
        this.typingLabel = '';
        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.realtimeService.messagesSeen$.subscribe((payload) => {
        if (payload.roomId !== this.activeRoomId || payload.viewer === this.currentSender) {
          return;
        }

        this.messages = this.messages.map((message) => {
          if (message.sender !== this.currentSender || message.seenBy.includes(payload.viewer)) {
            return message;
          }

          return {
            ...message,
            seenBy: [...message.seenBy, payload.viewer],
            isRead: true,
          };
        });
        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.realtimeService.messageUpdated$.subscribe((payload) => {
        if (payload.roomId !== this.activeRoomId) {
          return;
        }

        this.upsertMessage(payload.message);
        this.cdr.detectChanges();
      }),
    );

    this.subscriptions.add(
      this.realtimeService.messageDeleted$.subscribe((payload) => {
        if (payload.roomId !== this.activeRoomId) {
          return;
        }

        this.upsertMessage(payload.message);
        this.cdr.detectChanges();
      }),
    );
  }

  private scheduleMarkSeenIfVisible(roomId: string): void {
    if (!roomId || !this.isOpen) {
      return;
    }

    const existingTimer = this.seenTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.seenTimers.delete(roomId);

      if (!this.isOpen || this.activeRoomId !== roomId) {
        return;
      }

      const messageList = document.querySelector('.internal-messaging .messages-list');
      if (!(messageList instanceof HTMLElement) || messageList.getClientRects().length === 0) {
        return;
      }

      this.markSeen(roomId);
    }, 120);

    this.seenTimers.set(roomId, timer);
  }

  private markSeen(roomId: string): void {
    if (!roomId || !this.bootstrap || !this.isOpen || this.activeRoomId !== roomId) {
      return;
    }

    this.messagingService
      .markRoomSeen(roomId, { viewer: this.currentSender })
      .subscribe({
        next: (messages) => {
          if (this.activeRoomId === roomId) {
            this.messages = messages;
            this.setRoomUnread(roomId, 0);
            this.cdr.detectChanges();
          }
        },
      });
  }

  private upsertMessage(message: InternalMessage): boolean {
    const index = this.messages.findIndex((existing) => existing.id === message.id);
    if (index >= 0) {
      this.messages = [
        ...this.messages.slice(0, index),
        message,
        ...this.messages.slice(index + 1),
      ];
      return false;
    }

    this.messages = [...this.messages, message];
    return true;
  }

  private readUnreadCount(): number {
    const value = Number(localStorage.getItem('chat_unread_count') ?? '0');
    return Number.isFinite(value) ? value : 0;
  }

  private persistUnreadCount(): void {
    localStorage.setItem('chat_unread_count', String(this.unreadCount));
  }

  private setUnreadCountsFromRooms(rooms: InternalMessagingRoom[]): void {
    this.roomUnreadCounts = new Map(
      rooms.map((room) => [room.roomId, Math.max(0, Number(room.unreadCount) || 0)]),
    );
    this.syncTotalUnreadCount();
  }

  private incrementRoomUnread(roomId: string): void {
    this.setRoomUnread(roomId, (this.roomUnreadCounts.get(roomId) ?? 0) + 1);
  }

  private setRoomUnread(roomId: string, count: number): void {
    this.roomUnreadCounts.set(roomId, Math.max(0, count));
    this.syncTotalUnreadCount();
  }

  private syncTotalUnreadCount(): void {
    this.unreadCount = Array.from(this.roomUnreadCounts.values()).reduce(
      (total, count) => total + count,
      0,
    );
    this.persistUnreadCount();
  }
}
