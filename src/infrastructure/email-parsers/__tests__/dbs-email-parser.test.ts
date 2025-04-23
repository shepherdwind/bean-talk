import { DBSEmailParser } from '../dbs-email-parser';
import { Email } from '../../gmail/gmail.adapter';
import { Currency } from '../../../domain/models/types';
import { AccountName } from '../../../domain/models/account';
import { AccountingService } from '../../../domain/services/accounting.service';
import { container } from '../../utils';

jest.mock('../../../domain/services/accounting.service');

describe('DBSEmailParser', () => {
  let parser: DBSEmailParser;
  let mockAccountingService: jest.Mocked<AccountingService>;

  beforeEach(() => {
    parser = new DBSEmailParser();
    mockAccountingService = new AccountingService() as jest.Mocked<AccountingService>;
    mockAccountingService.findCategoryForMerchant = jest.fn().mockReturnValue(AccountName.ExpensesShoppingOnline);
    container.registerClass(AccountingService, mockAccountingService);
  });

  describe('canParse', () => {
    it('should return true for DBS transaction alert emails', () => {
      const email: Email = {
        id: 'test-id',
        subject: 'Card Transaction Alert',
        from: 'ibanking.alert@dbs.com',
        to: 'test@iling.fun',
        body: 'test body'
      };

      expect(parser.canParse(email)).toBe(true);
    });

    it('should return false for non-DBS emails', () => {
      const email: Email = {
        id: 'test-id',
        subject: 'Other Subject',
        from: 'other@example.com',
        to: 'test@iling.fun',
        body: 'test body'
      };

      expect(parser.canParse(email)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should correctly parse a DBS transaction alert email', () => {
      const emailBody = `Card Transaction Alert
Transaction Ref: 510805332088
Dear Sir / Madam,
We refer to your card transaction request dated 18/04/25.
We are pleased to confirm that the transaction was completed.
Date & Time: 18 Apr 13:29 (SGT)
Amount: USD20.00
From: DBS/POSB card ending 8558
To: GAMMA.APP

Please do not reply to this email as it is auto generated`;

      const email: Email = {
        id: 'test-id',
        subject: 'Card Transaction Alert',
        from: 'ibanking.alert@dbs.com',
        to: 'test@iling.fun',
        body: emailBody
      };

      const result = parser.parse(email);

      expect(result).not.toBeNull();
      if (result) {
        const expectedDate = new Date();
        expectedDate.setMonth(3); // April
        expectedDate.setDate(18);
        expectedDate.setHours(13);
        expectedDate.setMinutes(29);
        expectedDate.setSeconds(0);
        expectedDate.setMilliseconds(0);

        expect(result.date.getTime()).toBe(expectedDate.getTime());
        expect(result.description).toBe('GAMMA.APP');
        expect(result.entries).toHaveLength(2);
        
        // Check first entry (DBS account)
        expect(result.entries[0].account).toBe(AccountName.AssetsDBSSGDSaving);
        expect(result.entries[0].amount).toEqual({
          value: -20.00,
          currency: Currency.USD
        });
        expect(result.entries[0].metadata).toEqual({
          merchant: 'GAMMA.APP',
          cardInfo: 'DBS/POSB card ending 8558'
        });

        // Check second entry (Expense)
        expect(result.entries[1].account).toBe(AccountName.ExpensesShoppingOnline);
        expect(result.entries[1].amount).toEqual({
          value: 20,
          currency: Currency.USD
        });

        expect(result.metadata).toHaveProperty('emailId', 'test-id');
      }
    });

    it('should correctly parse a DBS transaction alert email with compact date format', () => {
      const emailBody = `Card Transaction Alert
Transaction Ref: 510805332088
Dear Sir / Madam,
We refer to your card transaction request dated 26/03/25.
We are pleased to confirm that the transaction was completed.
Date & Time: 26 Mar21:37(SGT)
Amount: SGD12,000.00
From: My Account A/C ending 4267
To: GAMMA.APP

Please do not reply to this email as it is auto generated`;

      const email: Email = {
        id: 'test-id',
        subject: 'Card Transaction Alert',
        from: 'ibanking.alert@dbs.com',
        to: 'test@iling.fun',
        body: emailBody
      };

      const result = parser.parse(email);

      expect(result).not.toBeNull();
      if (result) {
        const expectedDate = new Date();
        expectedDate.setMonth(2); // March
        expectedDate.setDate(26);
        expectedDate.setHours(21);
        expectedDate.setMinutes(37);
        expectedDate.setSeconds(0);
        expectedDate.setMilliseconds(0);

        expect(result.date.getTime()).toBe(expectedDate.getTime());
        expect(result.description).toBe('GAMMA.APP');
        expect(result.entries).toHaveLength(2);
        
        // Check first entry (DBS account)
        expect(result.entries[0].account).toBe(AccountName.AssetsDBSSGDSaving);
        expect(result.entries[0].amount).toEqual({
          value: -12000.00,
          currency: Currency.SGD
        });
        expect(result.entries[0].metadata).toEqual({
          merchant: 'GAMMA.APP',
          cardInfo: 'My Account A/C ending 4267'
        });

        // Check second entry (Expense)
        expect(result.entries[1].account).toBe(AccountName.ExpensesShoppingOnline);
        expect(result.entries[1].amount).toEqual({
          value: 12000.00,
          currency: Currency.SGD
        });

        expect(result.metadata).toHaveProperty('emailId', 'test-id');
      }
    });

    it('should correctly parse a DBS transaction alert email with tab-separated date format', () => {
      const emailBody = `Card Transaction Alert
Transaction Ref: 510805332088
Dear Sir / Madam,

Date & Time: 08 APR 05:21 (SGT) Amount: SGD3800.00 From: My Account ending 4267 To: NG CHEE CHUAN (A/C ending 0448)

Please do not reply to this email as it is auto generated`;

      const email: Email = {
        id: 'test-id',
        subject: 'Card Transaction Alert',
        from: 'ibanking.alert@dbs.com',
        to: 'test@iling.fun',
        body: emailBody
      };

      const result = parser.parse(email);

      expect(result).not.toBeNull();
      if (result) {
        const expectedDate = new Date();
        expectedDate.setFullYear(2025);
        expectedDate.setMonth(3); // April
        expectedDate.setDate(8);
        expectedDate.setHours(5);
        expectedDate.setMinutes(21);
        expectedDate.setSeconds(0);
        expectedDate.setMilliseconds(0);

        expect(result.date.getTime()).toBe(expectedDate.getTime());
        expect(result.description).toBe('NG CHEE CHUAN (A/C ending 0448)');
        expect(result.entries).toHaveLength(2);
        
        // Check first entry (DBS account)
        expect(result.entries[0].account).toBe(AccountName.AssetsDBSSGDSaving);
        expect(result.entries[0].amount).toEqual({
          value: -3800.00,
          currency: Currency.SGD
        });
        expect(result.entries[0].metadata).toEqual({
          merchant: 'NG CHEE CHUAN (A/C ending 0448)',
          cardInfo: 'My Account ending 4267'
        });

        // Check second entry (Expense)
        expect(result.entries[1].account).toBe(AccountName.ExpensesShoppingOnline);
        expect(result.entries[1].amount).toEqual({
          value: 3800.00,
          currency: Currency.SGD
        });

        expect(result.metadata).toHaveProperty('emailId', 'test-id');
      }
    });

    it('should return null for invalid email format', () => {
      const email: Email = {
        id: 'test-id',
        subject: 'Card Transaction Alert',
        from: 'ibanking.alert@dbs.com',
        to: 'test@iling.fun',
        body: 'Invalid email body without required fields'
      };

      const result = parser.parse(email);
      expect(result).toBeNull();
    });
  });
}); 