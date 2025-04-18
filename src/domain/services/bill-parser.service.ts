import { Email } from '../../infrastructure/gmail/gmail.adapter';
import { Transaction } from '../models/transaction';
import { Account } from '../models/account';
import { EmailParserFactory } from '../../infrastructure/email-parsers';

export class BillParserService {
  private emailParserFactory: EmailParserFactory;

  constructor() {
    this.emailParserFactory = new EmailParserFactory();
  }

  async parseBillText(email: Email): Promise<Transaction | null> {
    return this.emailParserFactory.parseEmail(email);
  }
} 