import { ADD_BILL_CONVERSATION_ID, addBillConversation } from '../add-bill';

describe('addBillConversation', () => {
  it('should export conversation function and ID', () => {
    expect(ADD_BILL_CONVERSATION_ID).toBe('addBill');
    expect(typeof addBillConversation).toBe('function');
  });

  it('should have correct function signature (conversation, ctx)', () => {
    // Conversation builders take (conversation, ctx) — verify arity
    expect(addBillConversation.length).toBe(2);
  });
});
