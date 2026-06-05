export type TechAssistanceStatus = 'open' | 'answered' | 'escalated' | 'closed' | string;

export interface TechAssistanceAttachment {
  id: string;
  messageId: string;
  originalFileName: string;
  fileUrl: string;
  contentType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface TechAssistanceParticipant {
  doctorId: string;
  cabinetIdentityId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  displayName: string;
}

export interface TechAssistanceMessage {
  id: string;
  ticketId: string;
  senderDoctorId: string;
  senderCabinetIdentityId: string;
  senderFirstName: string;
  senderLastName: string;
  senderEmail: string;
  senderRole: string;
  senderDisplayName: string;
  message: string;
  readByRequester: boolean;
  createdAt: string;
  attachments: TechAssistanceAttachment[];
}

export interface TechAssistanceTicket {
  id: string;
  cabinetIdentityId: string;
  doctorId: string;
  doctorFirstName: string;
  doctorLastName: string;
  doctorEmail: string;
  doctorDisplayName: string;
  subject: string;
  status: TechAssistanceStatus;
  seenByAdmins: boolean;
  lastMessageAt: string | null;
  lastDoctorMessageAt: string | null;
  lastAdminMessageAt: string | null;
  techLeadNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: TechAssistanceParticipant[];
  messages: TechAssistanceMessage[];
}

export interface CreateTechAssistanceTicketPayload {
  subject: string;
  message: string;
  attachments: File[];
}

export interface CreateTechAssistanceMessagePayload {
  message: string;
  attachments: File[];
}

export interface TechLeadReviewRequest {
  password: string;
}

export interface TechAssistanceUnreadCountResponse {
  count: number;
}

export interface TechAssistanceUnreadCountEvent {
  count: number;
}
