jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock merchant-category-mapping to avoid file I/O
jest.mock('../../../domain/models/merchant-category-mapping', () => ({
  get merchantCategoryMappings() { return {}; },
  findCategoryForMerchant: jest.fn(),
  addMerchantToMapping: jest.fn(),
  updateMerchantCategoryMappingsIfNeeded: jest.fn(),
}));

import { EmailParserFactory } from '../email-parser-factory';
import { EmailParser } from '../email-parser.interface';
import { Email } from '../../gmail/gmail.adapter';
import { Transaction } from '../../../domain/models/transaction';

describe('EmailParserFactory', () => {
  let factory: EmailParserFactory;

  beforeEach(() => {
    factory = new EmailParserFactory();
  });

  describe('findParser', () => {
    it('should find DBS parser for DBS emails', () => {
      const email: Email = {
        id: '1',
        subject: 'Card Transaction Alert',
        from: 'ibanking.alert@dbs.com',
        to: 'test@test.com',
        body: 'test',
      };

      const parser = factory.findParser(email);
      expect(parser).not.toBeNull();
    });

    it('should return null for unknown email source', () => {
      const email: Email = {
        id: '1',
        subject: 'Random Email',
        from: 'noreply@unknown.com',
        to: 'test@test.com',
        body: 'test',
      };

      expect(factory.findParser(email)).toBeNull();
    });
  });

  describe('registerParser', () => {
    it('should register and use custom parser', () => {
      const mockParser: EmailParser = {
        canParse: (email: Email) => email.from.includes('custom.com'),
        parse: jest.fn().mockResolvedValue(null),
      };

      factory.registerParser(mockParser);

      const email: Email = {
        id: '1',
        subject: 'Custom',
        from: 'noreply@custom.com',
        to: 'test@test.com',
        body: 'test',
      };

      expect(factory.findParser(email)).toBe(mockParser);
    });
  });

  describe('parseEmail', () => {
    it('should delegate to found parser', async () => {
      const mockTransaction = {
        date: new Date(),
        description: 'test',
        entries: [],
      } as Transaction;

      const mockParser: EmailParser = {
        canParse: () => true,
        parse: jest.fn().mockResolvedValue(mockTransaction),
      };

      factory.registerParser(mockParser);

      const email: Email = {
        id: '1',
        subject: 'Test',
        from: 'test@test.com',
        to: 'test@test.com',
        body: 'test',
      };

      const result = await factory.parseEmail(email);
      expect(result).toBe(mockTransaction);
    });

    it('should return null when no parser matches', async () => {
      const email: Email = {
        id: '1',
        subject: 'Random',
        from: 'unknown@unknown.com',
        to: 'test@test.com',
        body: 'test',
      };

      const result = await factory.parseEmail(email);
      expect(result).toBeNull();
    });
  });
});
