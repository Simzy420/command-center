import type { ChatAdapter } from './types';
import { mockChatAdapter } from './mock';

/** Default adapter. Replace with a real provider that implements ChatAdapter. */
export const chatAdapter: ChatAdapter = mockChatAdapter;

export type { ChatAdapter, ChatMessage, ChatStreamInput } from './types';
