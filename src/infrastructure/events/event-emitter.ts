import { EventEmitter } from 'events';
import { Email } from '../gmail/gmail.adapter';

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
  email?: Email;
}
