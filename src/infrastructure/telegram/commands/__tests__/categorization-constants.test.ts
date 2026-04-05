import { CALLBACK_PREFIXES, MESSAGES, CATEGORY_TYPES } from '../categorization-constants';

describe('categorization-constants', () => {
  describe('CALLBACK_PREFIXES', () => {
    it('should have all required prefixes', () => {
      expect(CALLBACK_PREFIXES.SELECT_CATEGORY).toBeDefined();
      expect(CALLBACK_PREFIXES.CANCEL_CATEGORIZATION).toBeDefined();
      expect(CALLBACK_PREFIXES.CATEGORIZE_MERCHANT).toBeDefined();
    });

    it('should have non-empty string values', () => {
      expect(typeof CALLBACK_PREFIXES.SELECT_CATEGORY).toBe('string');
      expect(CALLBACK_PREFIXES.SELECT_CATEGORY.length).toBeGreaterThan(0);
    });
  });

  describe('MESSAGES', () => {
    it('should have all required message templates', () => {
      expect(MESSAGES.CATEGORIZATION_PROMPT).toBeDefined();
      expect(MESSAGES.CATEGORIZATION_CANCELLED).toBeDefined();
      expect(MESSAGES.CATEGORIZATION_ERROR).toBeDefined();
      expect(MESSAGES.ANALYZING).toBeDefined();
      expect(MESSAGES.ERROR_MERCHANT_ID_NOT_FOUND).toBeDefined();
    });

    it('CATEGORIZATION_PROMPT should be a function', () => {
      expect(typeof MESSAGES.CATEGORIZATION_PROMPT).toBe('function');
      const result = MESSAGES.CATEGORIZATION_PROMPT('GRAB');
      expect(result).toContain('GRAB');
    });

    it('CATEGORY_SELECTED should be a function', () => {
      expect(typeof MESSAGES.CATEGORY_SELECTED).toBe('function');
      const result = MESSAGES.CATEGORY_SELECTED('GRAB', 'Expenses:Food');
      expect(result).toContain('GRAB');
      expect(result).toContain('Expenses:Food');
    });
  });

  describe('CATEGORY_TYPES', () => {
    it('should have all required types', () => {
      expect(CATEGORY_TYPES.PRIMARY).toBeDefined();
      expect(CATEGORY_TYPES.ALTERNATIVE).toBeDefined();
      expect(CATEGORY_TYPES.SUGGESTED).toBeDefined();
    });
  });
});
