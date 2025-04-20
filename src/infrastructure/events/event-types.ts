export enum EventTypes {
  // Merchant categorization events
  MERCHANT_NEEDS_CATEGORIZATION = 'merchantNeedsCategorization',
  MERCHANT_CATEGORY_SELECTED = 'merchantCategorySelected'
}

export const QUEUE_PREFIX = 'queue:';

export const getQueueEventName = (eventName: string): string => `${QUEUE_PREFIX}${eventName}`; 