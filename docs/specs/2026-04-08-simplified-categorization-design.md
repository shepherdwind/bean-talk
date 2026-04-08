# Simplified Merchant Categorization Flow

## Problem

Current flow requires 4 interactions: click button → provide info → AI analyzes → pick category. Too many steps.

## New Flow

### When AI is uncertain (confidence < 0.8):

1. Call AI to get **2 candidate categories** (even with low confidence)
2. Send notification with **3 inline buttons**:
   - `📁 Candidate A`
   - `📁 Candidate B`  
   - `💬 Provide more info`
3. User clicks a category → save to `merchant-category-mapping.json`, done
4. User clicks "Provide more info" → enter conversation:
   - User types description (e.g. "this is apple subscription")
   - AI re-categorizes with the additional info, returns 2 new candidates
   - Show 2 category buttons → user picks one → save, done

### What changes:

- **`NLPService.autoCategorizeMerchant`**: Return 2 candidates instead of 1, always (even low confidence)
- **Notification message**: Replace single "Categorize with AI" button with 3 buttons (2 categories + provide info)
- **`categorizationConversation`**: Simplify — only handles "provide info" path, one round only
- **`event-listener.service.ts`**: Pass AI candidates through event so notification can display them
- **`telegram.adapter.ts`**: `sendNotification` accepts category candidates for button rendering

### What stays:

- Mapping file lookup (step 1) and high-confidence auto-categorize (step 2) unchanged
- `MERCHANT_CATEGORY_SELECTED` event and JSON persistence unchanged
- `pendingMerchantRegistry` mechanism for Telegram callback data unchanged
