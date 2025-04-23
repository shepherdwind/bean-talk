import { AccountName } from "../../domain/models/account";

export const TG_ACCOUNTS = ["LingerZou", "ewardsong"];

export const ACCOUNT_TELEGRAM_MAP: Partial<Record<AccountName, string>> = {
  [AccountName.AssetsDBSSGDWife]: TG_ACCOUNTS[0],
  [AccountName.AssetsDBSSGDSaving]: TG_ACCOUNTS[1],
  [AccountName.AssetsCashWife]: TG_ACCOUNTS[0],
  [AccountName.AssetsCash]: TG_ACCOUNTS[1],
};

export const getCashAccount = (username: string) => {
  let account: AccountName;
  if (username === ACCOUNT_TELEGRAM_MAP[AccountName.AssetsCashWife]) {
    return AccountName.AssetsCashWife;
  } else if (username === ACCOUNT_TELEGRAM_MAP[AccountName.AssetsCash]) {
    return AccountName.AssetsCash;
  }
  return null;
};

export const getCardAccount = (email: string): AccountName => {
  //a@iling.fun
  if (email.includes("@iling.fun")) {
    return AccountName.AssetsDBSSGDSaving;
  }

  return AccountName.AssetsDBSSGDWife;
};

export const getAccountByEmail = (email?: string) => {
  if (!email) return null;

  if (email.includes("@iling.fun")) {
    return TG_ACCOUNTS[1];
  }
  return TG_ACCOUNTS[0];
};
