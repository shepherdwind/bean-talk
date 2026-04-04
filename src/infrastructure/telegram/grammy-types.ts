import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';

export interface PendingMerchant {
  merchantId: string;
  merchant: string;
}

export interface SessionData {
  pendingMerchants?: Record<string, PendingMerchant>;
}

type BaseContext = Context & SessionFlavor<SessionData>;
export type BotContext = BaseContext & ConversationFlavor<BaseContext>;

export function createInitialSessionData(): SessionData {
  return {};
}
