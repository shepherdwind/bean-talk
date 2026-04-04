import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';

export interface SessionData {
  // Reserved for future use by conversation handlers
}

type BaseContext = Context & SessionFlavor<SessionData>;
export type BotContext = BaseContext & ConversationFlavor<BaseContext>;

export function createInitialSessionData(): SessionData {
  return {};
}
