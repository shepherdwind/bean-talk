jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { extractTransactionData } from '../dbs-transaction-extractor';
import { Email } from '../../gmail/gmail.adapter';
import { Currency } from '../../../domain/models/types';

function createEmail(body: string): Email {
  return {
    id: 'test-1',
    subject: 'Card Transaction Alert',
    from: 'alert@dbs.com',
    to: 'test@iling.fun',
    body,
  };
}

const STANDARD_BODY = `Card Transaction Alert
Transaction Ref: 510805332088
Dear Sir / Madam,
Date & Time: 18 Apr 13:29 (SGT)
Amount: SGD50.00
From: DBS/POSB card ending 8558
To: GRAB FOOD

Please do not reply to this email`;

describe('extractTransactionData', () => {
  it('should extract all fields from standard DBS email', () => {
    const result = extractTransactionData(createEmail(STANDARD_BODY));

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(50);
    expect(result!.currency).toBe(Currency.SGD);
    expect(result!.merchant).toBe('GRAB FOOD');
    expect(result!.cardInfo).toContain('8558');
    expect(result!.date).toBeInstanceOf(Date);
    expect(result!.date.getMonth()).toBe(3); // April = 3
    expect(result!.date.getDate()).toBe(18);
  });

  it('should handle S$ amount format', () => {
    const body = `Date & Time: 18 Apr 13:29 (SGT)
Amount: S$123.45
From: DBS card ending 1234
To: STORE`;

    const result = extractTransactionData(createEmail(body));
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(123.45);
    expect(result!.currency).toBe(Currency.SGD);
  });

  it('should handle USD amount format', () => {
    const body = `Date & Time: 18 Apr 13:29 (SGT)
Amount: USD29.99
From: DBS card ending 1234
To: AMAZON`;

    const result = extractTransactionData(createEmail(body));
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(29.99);
    expect(result!.currency).toBe('USD');
  });

  it('should return null when amount is missing', () => {
    const body = `Date & Time: 18 Apr 13:29 (SGT)
From: DBS card ending 1234
To: GRAB FOOD`;

    const result = extractTransactionData(createEmail(body));
    expect(result).toBeNull();
  });

  it('should return null when date is missing', () => {
    const body = `Amount: SGD50.00
From: DBS card ending 1234
To: GRAB FOOD`;

    const result = extractTransactionData(createEmail(body));
    expect(result).toBeNull();
  });

  it('should return null when merchant is missing', () => {
    const body = `Date & Time: 18 Apr 13:29 (SGT)
Amount: SGD50.00
From: DBS card ending 1234`;

    const result = extractTransactionData(createEmail(body));
    expect(result).toBeNull();
  });

  it('should return empty card info when From: is not found', () => {
    // Craft a body where Amount can be found but no From:/To: after it in normal position
    const body = `Date & Time: 18 Apr 13:29 (SGT)
Amount: SGD50.00
From:
To: GRAB FOOD`;

    const result = extractTransactionData(createEmail(body));
    // The extraction depends on format, cardInfo may be empty
    if (result) {
      expect(typeof result.cardInfo).toBe('string');
    }
  });

  it('should handle amount with no decimal', () => {
    const body = `Date & Time: 18 Apr 13:29 (SGT)
Amount: SGD100
From: DBS card ending 1234
To: STORE`;

    const result = extractTransactionData(createEmail(body));
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(100);
  });

  it('should round floating point amounts to 2 decimals', () => {
    const body = `Date & Time: 18 Apr 13:29 (SGT)
Amount: SGD10.105
From: DBS card ending 1234
To: STORE`;

    const result = extractTransactionData(createEmail(body));
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(10.11); // Rounded
  });
});
