import { CATEGORIZATION_CONVERSATION_ID, categorizationConversation } from '../categorization';

describe('categorizationConversation', () => {
  it('should export conversation function and ID', () => {
    expect(CATEGORIZATION_CONVERSATION_ID).toBe('categorization');
    expect(typeof categorizationConversation).toBe('function');
  });

  it('should have correct function signature (conversation, ctx)', () => {
    expect(categorizationConversation.length).toBe(2);
  });
});
