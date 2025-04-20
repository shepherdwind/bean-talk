// 分类命令相关的常量

// 回调数据前缀
export const CALLBACK_PREFIXES = {
  SELECT_CATEGORY: 'sc',
  CANCEL_CATEGORIZATION: 'cc',
  CATEGORIZE_MERCHANT: 'categorize_merchant_'
};

// 消息模板
export const MESSAGES = {
  WELCOME: 'Welcome to BeanTalk! Your personal finance assistant.',
  CATEGORIZATION_EXPIRED: '❌ Sorry, this categorization request has expired or is invalid.',
  CATEGORIZATION_PROMPT: (merchant: string) => 
    `🤖 I'll help you categorize "${merchant}".\n\n` +
    `Please provide any additional information about this merchant that might help with categorization.\n` +
    `For example:\n` +
    `- What type of business is it?\n` +
    `- What did you purchase?\n` +
    `- Any specific details about the transaction?\n\n` +
    `Just type your response and I'll analyze it.`,
  ANALYZING: '🤖 Analyzing the information...',
  CATEGORIZATION_ERROR: '❌ Sorry, there was an error processing the categorization.',
  CATEGORIZATION_REQUEST_ERROR: '❌ Sorry, there was an error processing your request.',
  CATEGORY_SELECTED: (merchant: string, category: string) => 
    `✅ Selected category for "${merchant}":\n` +
    `📁 ${category}\n\n` +
    `The category has been saved and will be used for future transactions from this merchant.`,
  CATEGORIZATION_CANCELLED: '❌ Categorization cancelled.',
  ERROR_CHAT_ID_NOT_FOUND: 'Error: Chat ID not found',
  ERROR_CATEGORIZATION_NOT_FOUND: 'Error: Categorization request not found',
  ERROR_INVALID_CATEGORY_TYPE: 'Error: Invalid category type',
  ERROR_MERCHANT_ID_NOT_FOUND: 'Error: Merchant ID not found',
  ERROR_NO_MAPPING_FOUND: (truncatedId: string) => `No mapping found for truncated ID: ${truncatedId}`
};

// 分类类型
export const CATEGORY_TYPES = {
  PRIMARY: 'primary',
  ALTERNATIVE: 'alternative',
  SUGGESTED: 'suggested'
}; 