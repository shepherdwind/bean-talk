import {
  ACCOUNT_TELEGRAM_MAP,
  TG_ACCOUNTS,
  getCashAccount,
  getCardAccount,
  getAccountByEmail,
} from '../telegram';
import { AccountName } from '../../../domain/models/account';

describe('telegram utils', () => {
  describe('ACCOUNT_TELEGRAM_MAP', () => {
    it('should map wife accounts to LingerZou', () => {
      expect(ACCOUNT_TELEGRAM_MAP[AccountName.AssetsDBSSGDWife]).toBe('LingerZou');
      expect(ACCOUNT_TELEGRAM_MAP[AccountName.AssetsCashWife]).toBe('LingerZou');
    });

    it('should map personal accounts to ewardsong', () => {
      expect(ACCOUNT_TELEGRAM_MAP[AccountName.AssetsDBSSGDSaving]).toBe('ewardsong');
      expect(ACCOUNT_TELEGRAM_MAP[AccountName.AssetsCash]).toBe('ewardsong');
    });
  });

  describe('getCashAccount', () => {
    it('should return CashWife for LingerZou', () => {
      expect(getCashAccount('LingerZou')).toBe(AccountName.AssetsCashWife);
    });

    it('should return Cash for ewardsong', () => {
      expect(getCashAccount('ewardsong')).toBe(AccountName.AssetsCash);
    });

    it('should return null for unknown username', () => {
      expect(getCashAccount('unknown')).toBeNull();
    });
  });

  describe('getCardAccount', () => {
    it('should return DBS saving for iling.fun email', () => {
      expect(getCardAccount('user@iling.fun')).toBe(AccountName.AssetsDBSSGDSaving);
    });

    it('should return DBS wife for other emails', () => {
      expect(getCardAccount('other@gmail.com')).toBe(AccountName.AssetsDBSSGDWife);
    });
  });

  describe('getAccountByEmail', () => {
    it('should return ewardsong for iling.fun email', () => {
      expect(getAccountByEmail('user@iling.fun')).toBe(TG_ACCOUNTS[1]);
    });

    it('should return LingerZou for other emails', () => {
      expect(getAccountByEmail('other@gmail.com')).toBe(TG_ACCOUNTS[0]);
    });

    it('should return null for undefined email', () => {
      expect(getAccountByEmail(undefined)).toBeNull();
    });
  });
});
