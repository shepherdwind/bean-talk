import { Email } from '../../infrastructure/gmail/gmail.adapter';
import { Transaction } from '../models/transaction';
import { EmailParserFactory } from '../../infrastructure/email-parsers';
import { container } from '../../infrastructure/utils';

export class BillParserService {
  private emailParserFactory: EmailParserFactory;

  constructor() {
    // 直接通过类名从容器获取依赖
    this.emailParserFactory = container.getByClass(EmailParserFactory);
  }

  async parseBillText(email: Email): Promise<Transaction | null> {
    return this.emailParserFactory.parseEmail(email);
  }
}