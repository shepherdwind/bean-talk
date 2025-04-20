import { EventEmitter } from 'events';

export class ApplicationEventEmitter extends EventEmitter {
  constructor() {
    super();
  }
} 
export interface MerchantCategorizationEvent {
  merchant: string;
  merchantId: string;
  timestamp: string;
  amount?: {
    value: number;
    currency: string;
  };
  email?: {
    id: string;
    subject: string;
    from: string;
    body?: string;
    date?: string;
  };
}
