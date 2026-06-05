export type InternalMessagingSender = 'medecin' | 'secretaire1' | 'secretaire2';
export type InternalMessagingRoomKey = 'group' | 'sec1' | 'sec2';

export interface InternalMessagingRoom {
  key: InternalMessagingRoomKey;
  roomId: string;
  label: string;
  isGroup: boolean;
  unreadCount: number;
}

export interface InternalMessagingBootstrap {
  cabinetIdentityId: string;
  doctorId: string;
  currentSender: InternalMessagingSender;
  hasSecondSecretary: boolean;
  isSecondSecretaryActive: boolean;
  rooms: InternalMessagingRoom[];
}

export interface InternalMessage {
  id: string;
  cabinetIdentityId: string;
  roomId: string;
  sender: InternalMessagingSender;
  content: string;
  editedAt: string | null;
  deletedAt: string | null;
  seenBy: InternalMessagingSender[];
  isRead: boolean;
  createdAt: string;
}

export interface SendInternalMessageRequest {
  roomId: string;
  sender: InternalMessagingSender;
  content: string;
}

export interface EditInternalMessageRequest {
  sender: InternalMessagingSender;
  content: string;
}

export interface DeleteInternalMessageRequest {
  sender: InternalMessagingSender;
}

export interface MarkInternalRoomSeenRequest {
  viewer: InternalMessagingSender;
}

export interface InternalMessagingTypingPayload {
  roomId: string;
  sender: InternalMessagingSender;
}

export interface InternalMessagingMessageEvent {
  roomId: string;
  message: InternalMessage;
}

export interface InternalMessagingSeenEvent {
  roomId: string;
  viewer: InternalMessagingSender;
}
