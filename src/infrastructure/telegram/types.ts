import { Email } from "../gmail/gmail.adapter";
import { Message } from 'telegraf/typings/core/types/typegram';

export interface PendingCategorization {
  merchantId: string;
  merchant: string;
  timestamp: string;
  chatId?: string;
  email?: Email;
} 

export type TextMessage = Message.TextMessage; 