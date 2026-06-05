export type AiChatRole = 'user' | 'assistant';
export type AiChatMessageStatus = 'ready' | 'sending' | 'error';

export interface AiChatMessage {
  id: string;
  role: AiChatRole;
  content: string;
  status: AiChatMessageStatus;
  createdAt: string;
  sortOrder: number;
  error?: string;
}

export interface AiChatSession {
  id: string;
  title: string;
  context: string;
  messages: AiChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiChatCompletionRequest {
  messages: Array<Pick<AiChatMessage, 'role' | 'content'>>;
  context?: string;
}

export interface AiChatCompletionResponse {
  content: string;
  model: string;
  finishReason: string;
}

export interface CreateAiChatSessionRequest {
  title?: string;
  context?: string;
}

export interface SendAiChatMessageRequest {
  content: string;
  context?: string;
}
