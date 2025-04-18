/**
 * Utility functions for processing email content
 */

import { gmail_v1 } from 'googleapis';
import { convert } from 'html-to-text';

export interface EmailHeaders {
  subject: string;
  from: string;
  date: string;
}

/**
 * Extracts email headers from Gmail API response
 * @param headers Array of email headers from Gmail API
 * @returns Processed email headers
 */
export function extractEmailHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): EmailHeaders {
  return {
    subject: headers.find(h => h.name === 'Subject')?.value || '',
    from: headers.find(h => h.name === 'From')?.value || '',
    date: headers.find(h => h.name === 'Date')?.value || ''
  };
}

/**
 * Extracts email body from Gmail API response
 * @param payload Email payload from Gmail API
 * @returns Processed email body as plain text
 */
export function extractEmailBody(payload: gmail_v1.Schema$MessagePart): string {
  let body = '';
  
  if (payload.body?.data) {
    // If the message has a direct body with data
    body = Buffer.from(payload.body.data, 'base64').toString();
  } else if (payload.parts) {
    // First try to find text/plain
    const plainTextPart = payload.parts.find(part => part.mimeType === 'text/plain');
    if (plainTextPart?.body?.data) {
      body = Buffer.from(plainTextPart.body.data, 'base64').toString();
    } else {
      // If no plain text, try to find text/html
      const htmlPart = payload.parts.find(part => part.mimeType === 'text/html');
      if (htmlPart?.body?.data) {
        body = Buffer.from(htmlPart.body.data, 'base64').toString();
      }
    }
  }

  return processEmailContent(body);
}

/**
 * Converts HTML content to plain text using html-to-text library
 * @param html HTML content to convert
 * @returns Plain text content
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  
  return convert(html, {
    wordwrap: 130,
    selectors: [
      { selector: 'img', format: 'skip' }
    ]
  });
}

/**
 * Processes email body content, converting HTML to plain text if necessary
 * @param content Email content that might be HTML
 * @returns Plain text content
 */
export function processEmailContent(content: string): string {
  if (!content) return '';
  
  // If the content looks like HTML (contains HTML tags)
  if (content.includes('<') && content.includes('>')) {
    return htmlToPlainText(content);
  }
  
  return content;
} 