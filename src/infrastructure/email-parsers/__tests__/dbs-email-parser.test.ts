import { DBSEmailParser } from '../dbs-email-parser';
import { Email } from '../../gmail/gmail.adapter';
import { Currency } from '../../../domain/models/types';
import { AccountName } from '../../../domain/models/account';

describe('DBSEmailParser', () => {
  let parser: DBSEmailParser;

  beforeEach(() => {
    parser = new DBSEmailParser();
  });

  describe('canParse', () => {
    it('should return true for DBS transaction alert emails', () => {
      const email: Email = {
        id: 'test-id',
        subject: 'Card Transaction Alert',
        from: 'ibanking.alert@dbs.com',
        body: 'test body'
      };

      expect(parser.canParse(email)).toBe(true);
    });

    it('should return false for non-DBS emails', () => {
      const email: Email = {
        id: 'test-id',
        subject: 'Other Subject',
        from: 'other@example.com',
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
        body: emailBody
      };

      const result = parser.parse(email);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.date).toEqual(new Date(2025, 3, 18, 13, 29)); // April is month 3 (0-based)
        expect(result.description).toBe('GAMMA.APP');
        expect(result.entries).toHaveLength(2);
        
        // Check first entry (DBS account)
        expect(result.entries[0].account).toBe(AccountName.AssetsDBSSGDSaving);
        expect(result.entries[0].amount).toEqual({
          value: 20.00,
          currency: Currency.USD
        });
        expect(result.entries[0].metadata).toEqual({
          merchant: 'GAMMA.APP',
          cardInfo: 'DBS/POSB card ending 8558'
        });

        // Check second entry (Expense)
        expect(result.entries[1].account).toBe(AccountName.ExpensesShoppingOnline);
        expect(result.entries[1].amount).toEqual({
          value: -20.00,
          currency: Currency.USD
        });

        expect(result.metadata).toEqual({
          emailId: 'test-id',
        });
      }
    });

    it('should return null for invalid email format', () => {
      const email: Email = {
        id: 'test-id',
        subject: 'Card Transaction Alert',
        from: 'ibanking.alert@dbs.com',
        body: 'Invalid email body without required fields'
      };

      const result = parser.parse(email);
      expect(result).toBeNull();
    });
  });
}); 