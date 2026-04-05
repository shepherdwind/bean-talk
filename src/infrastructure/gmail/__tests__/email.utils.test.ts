import { extractEmailHeaders, extractEmailBody, htmlToPlainText, processEmailContent } from '../email.utils';

describe('email.utils', () => {
  describe('extractEmailHeaders', () => {
    it('should extract all headers', () => {
      const headers = [
        { name: 'Subject', value: 'Test Subject' },
        { name: 'From', value: 'sender@test.com' },
        { name: 'To', value: 'recipient@test.com' },
        { name: 'Date', value: '2024-03-15T10:00:00Z' },
      ];

      const result = extractEmailHeaders(headers);
      expect(result).toEqual({
        subject: 'Test Subject',
        from: 'sender@test.com',
        to: 'recipient@test.com',
        date: '2024-03-15T10:00:00Z',
      });
    });

    it('should return empty strings for missing headers', () => {
      const result = extractEmailHeaders([]);
      expect(result).toEqual({
        subject: '',
        from: '',
        to: '',
        date: '',
      });
    });
  });

  describe('extractEmailBody', () => {
    it('should decode base64 body from direct payload', () => {
      const payload = {
        body: {
          data: Buffer.from('Hello World').toString('base64'),
        },
      };

      const result = extractEmailBody(payload);
      expect(result).toBe('Hello World');
    });

    it('should prefer text/plain from multipart', () => {
      const payload = {
        parts: [
          {
            mimeType: 'text/html',
            body: { data: Buffer.from('<b>HTML</b>').toString('base64') },
          },
          {
            mimeType: 'text/plain',
            body: { data: Buffer.from('Plain text').toString('base64') },
          },
        ],
      };

      const result = extractEmailBody(payload);
      expect(result).toBe('Plain text');
    });

    it('should fall back to text/html when no text/plain', () => {
      const payload = {
        parts: [
          {
            mimeType: 'text/html',
            body: { data: Buffer.from('<p>Hello</p>').toString('base64') },
          },
        ],
      };

      const result = extractEmailBody(payload);
      // Should be converted from HTML to plain text
      expect(result).toContain('Hello');
    });

    it('should return empty string for empty payload', () => {
      const result = extractEmailBody({});
      expect(result).toBe('');
    });
  });

  describe('htmlToPlainText', () => {
    it('should convert HTML to plain text', () => {
      const result = htmlToPlainText('<p>Hello <b>World</b></p>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should return empty string for empty input', () => {
      expect(htmlToPlainText('')).toBe('');
    });
  });

  describe('processEmailContent', () => {
    it('should return plain text as-is', () => {
      expect(processEmailContent('Hello World')).toBe('Hello World');
    });

    it('should convert HTML to plain text', () => {
      const result = processEmailContent('<p>Hello</p>');
      expect(result).toContain('Hello');
    });

    it('should return empty string for empty input', () => {
      expect(processEmailContent('')).toBe('');
    });
  });
});
