import { Email } from "../gmail/gmail.adapter";

export interface PendingCategorization {
  merchantId: string;
  merchant: string;
  timestamp: string;
  chatId?: string;
  email?: Email;
} 