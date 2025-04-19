export interface PendingCategorization {
  merchantId: string;
  merchant: string;
  timestamp: string;
  chatId?: string;
  email?: {
    id: string;
    subject: string;
    from: string;
    date?: string;
  };
} 