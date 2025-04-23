import { ACCOUNT_TELEGRAM_MAP } from './telegram';
import { ProcessedQueryResult } from '../beancount/beancount-query.service';

export function formatQueryResult(result: ProcessedQueryResult): string {
  let message = '';

  // Format assets section
  message += '💵 <b>Assets</b>\n';
  const userSpending: Record<string, number> = {};
  let totalSpending = 0;

  for (const asset of result.assets) {
    const username = ACCOUNT_TELEGRAM_MAP[asset.account as keyof typeof ACCOUNT_TELEGRAM_MAP];
    if (username) {
      const amount = Math.abs(asset.amount);
      userSpending[username] = (userSpending[username] || 0) + amount;
      totalSpending += amount;
    }
  }

  // Add user spending details
  const USER_COLUMN_WIDTH = 12;
  const AMOUNT_COLUMN_WIDTH = 10;
  
  message += '<code>';
  message += `User${' '.repeat(USER_COLUMN_WIDTH - 4)}Amount\n`;
  message += '─'.repeat(USER_COLUMN_WIDTH) + '\n';
  
  for (const [username, amount] of Object.entries(userSpending)) {
    const userText = `@${username}`;
    const amountText = `${amount.toFixed(2)} SGD`;
    message += `${userText.padEnd(USER_COLUMN_WIDTH)}${amountText.padStart(AMOUNT_COLUMN_WIDTH)}\n`;
  }
  const totalAmountText = `${totalSpending.toFixed(2)} SGD`;
  message += `Total${' '.repeat(USER_COLUMN_WIDTH - 5)}${totalAmountText.padStart(AMOUNT_COLUMN_WIDTH)}\n`;
  message += '</code>\n\n';

  // Format expenses section
  message += '📊 <b>Expenses by Category</b>\n';
  const CATEGORY_COLUMN_WIDTH = 15;
  
  message += '<code>';
  message += `Category${' '.repeat(CATEGORY_COLUMN_WIDTH - 8)}Amount\n`;
  message += '─'.repeat(CATEGORY_COLUMN_WIDTH) + '\n';
  
  for (const expense of result.expenses) {
    const category = expense.category.split(':')[1] || expense.category;
    const amountText = `${expense.amount.toFixed(2)} SGD`;
    message += `${category.padEnd(CATEGORY_COLUMN_WIDTH)}${amountText.padStart(AMOUNT_COLUMN_WIDTH)}\n`;
  }
  message += '</code>';

  return message;
} 