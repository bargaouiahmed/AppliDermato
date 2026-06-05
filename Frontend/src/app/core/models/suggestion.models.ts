export type SuggestionStatus = 'open' | 'answered' | string;

export interface SuggestionReply {
  id: string;
  suggestionId: string;
  responderDoctorId: string;
  responderFirstName: string;
  responderLastName: string;
  responderRole: string;
  message: string;
  readByDoctor: boolean;
  createdAt: string;
}

export interface DoctorSuggestion {
  id: string;
  cabinetIdentityId: string;
  doctorId: string;
  doctorFirstName: string;
  doctorLastName: string;
  doctorEmail: string;
  subject: string;
  message: string;
  status: SuggestionStatus;
  seenByAdmins: boolean;
  lastReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
  replies: SuggestionReply[];
}

export interface CreateSuggestionRequest {
  subject: string;
  message: string;
}

export interface ReplyToSuggestionRequest {
  message: string;
}

export interface SuggestionUnreadCountResponse {
  count: number;
}

export interface SuggestionUnreadCountEvent {
  count: number;
}
