import { Transaction } from '../models/transaction';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Service for handling Beancount file operations and conversions
 */
export class BeancountService {
  constructor(private readonly baseDir: string) {}

  /**
   * Generates the file path for a given transaction date
   * Format: YYYY/MM.bean
   */
  private getFilePathForDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const relativePath = `${year}/${month}.bean`;
    return path.join(this.baseDir, relativePath);
  }

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
   * Ensures the directory structure exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      // Directory doesn't exist, create it with all parent directories
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Ensures the beancount file exists, creates it if it doesn't
   */
  private async ensureFileExists(filePath: string): Promise<void> {
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    await this.ensureDirectoryExists(dir);

    // Get the relative path for include statement
    const relativePath = path.relative(this.baseDir, filePath);
    const includePath = relativePath.replace(/\\/g, '/'); // Convert Windows path to Unix style

    // Ensure the file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      // File doesn't exist, create it with an empty content
      await fs.writeFile(filePath, '', 'utf-8');

      // Add include statement to main.bean
      const mainBeanPath = path.join(this.baseDir, 'main.bean');
      try {
        await fs.access(mainBeanPath);
      } catch (error) {
        // If main.bean doesn't exist, create it
        await fs.writeFile(mainBeanPath, '', 'utf-8');
      }

      // Read the current content of main.bean
      const mainBeanContent = await fs.readFile(mainBeanPath, 'utf-8');
      
      // Check if the include statement already exists
      const includeStatement = `include "${includePath}"`;
      if (!mainBeanContent.includes(includeStatement)) {
        // Add the include statement with a newline
        const newContent = mainBeanContent.trim() + '\n' + includeStatement + '\n';
        await fs.writeFile(mainBeanPath, newContent, 'utf-8');
      }
    }
  }

  /**
   * Appends a transaction to the Beancount file
   */
  async appendTransaction(transaction: Transaction): Promise<void> {
    const filePath = this.getFilePathForDate(transaction.date);
    
    // Ensure the file exists before appending
    await this.ensureFileExists(filePath);
    
    const beancountText = this.transactionToBeancount(transaction);
    
    // Check if the file is empty to determine if we need to add a newline
    let fileStats;
    try {
      fileStats = await fs.stat(filePath);
    } catch (error) {
      // If there's an error getting stats, assume the file is empty
      fileStats = { size: 0 };
    }
    
    // Prepare the text to append
    let textToAppend = beancountText;
    
    // If the file is not empty, add a newline before the new transaction
    if (fileStats.size > 0) {
      textToAppend = '\n\n' + textToAppend;
    }
    
    // Append the transaction to the file
    await fs.appendFile(filePath, textToAppend, 'utf-8');
  }
} 