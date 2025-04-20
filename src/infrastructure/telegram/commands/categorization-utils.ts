import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { PendingCategorization } from '../types';

// 生成随机短ID
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

// 生成商家ID的短哈希
export function getShortId(merchantId: string): string {
  // Generate a short hash of the merchantId
  let hash = 0;
  for (let i = 0; i < merchantId.length; i++) {
    const char = merchantId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to base36 and take first 8 characters
  return Math.abs(hash).toString(36).slice(0, 8);
}

// 创建分类选择键盘
export function createCategoryKeyboard(
  shortId: string, 
  categories: { primary: string; alternative: string; suggested: string }
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: `📁 ${categories.primary}`, callback_data: `sc:${shortId}:primary` }
      ],
      [
        { text: `📁 ${categories.alternative}`, callback_data: `sc:${shortId}:alternative` }
      ],
      [
        { text: `📁 ${categories.suggested}`, callback_data: `sc:${shortId}:suggested` }
      ],
      [
        { text: '❌ Cancel', callback_data: `cc:${shortId}` }
      ]
    ]
  };
}

// 创建分类结果消息
export function createCategoryResultMessage(
  merchant: string,
  categories: { primary: string; alternative: string; suggested: string }
): string {
  return `I've analyzed "${merchant}" and found these possible categories:\n\n` +
    `1. ${categories.primary}\n` +
    `2. ${categories.alternative}\n` +
    `3. ${categories.suggested}\n\n` +
    `Please select the most appropriate category:`;
}

// 查找待分类项
export function findPendingCategorization(
  pendingCategorizations: Map<string, PendingCategorization>,
  chatId: string
): PendingCategorization | undefined {
  return Array.from(pendingCategorizations.entries())
    .find(([_, cat]) => cat.chatId === chatId)?.[1];
} 