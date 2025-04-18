import { Transaction } from '../models/transaction';
import { promises as fs } from 'fs';

/**
 * Service for handling Beancount file operations and conversions
 */
export class BeancountService {
  constructor(private readonly filePath: string) {}

  /**
   * Converts a Transaction object to Beancount text format
   */
  transactionToBeancount(transaction: Transaction): string {
    const date = transaction.date.toISOString().split('T')[0];
    const lines: string[] = [];

    // Add transaction header
    lines.push(`${date} * "${transaction.description}"`);

    // Add entries
    for (const entry of transaction.entries) {
      const amount = entry.amount.value.toFixed(2);
      const currency = entry.amount.currency;
      lines.push(`  ${entry.account}  ${amount} ${currency}`);
    }

    // Add metadata if any
    if (transaction.metadata) {
      for (const [key, value] of Object.entries(transaction.metadata)) {
        lines.push(`  ; ${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Ensures the beancount file exists, creates it if it doesn't
   */
  private async ensureFileExists(): Promise<void> {
    try {
      await fs.access(this.filePath);
    } catch (error) {
      // File doesn't exist, create it with an empty content
      await fs.writeFile(this.filePath, '', 'utf-8');
    }
  }

  /**
   * Appends a transaction to the Beancount file
   */
  async appendTransaction(transaction: Transaction): Promise<void> {
    // Ensure the file exists before appending
    await this.ensureFileExists();
    
    const beancountText = this.transactionToBeancount(transaction);
    
    // Read the current content (might be empty if file was just created)
    let content = '';
    try {
      content = await fs.readFile(this.filePath, 'utf-8');
    } catch (error) {
      // If there's an error reading the file, start with empty content
      content = '';
    }
    
    // Add a newline between transactions if the file is not empty
    const newContent = content.trim() 
      ? content + '\n\n' + beancountText 
      : beancountText;
    
    await fs.writeFile(this.filePath, newContent, 'utf-8');
  }
} 