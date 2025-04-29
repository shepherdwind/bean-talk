import { Email } from "../gmail/gmail.adapter";
import { Currency } from "../../domain/models/types";
import { logger } from "../utils/logger";

/**
 * Interface for transaction data extracted from email
 */
export interface TransactionData {
  amount: number;
  date: Date;
  merchant: string;
  cardInfo: string;
  currency: Currency;
}

/**
 * Extracts transaction data from DBS email body
 */
export function extractTransactionData(email: Email): TransactionData | null {
  const amountData = extractAmount(email.body);
  if (!amountData) {
    return null;
  }

  const date = extractDate(email.body);
  if (!date) {
    return null;
  }

  const merchant = extractMerchant(email.body);
  if (!merchant) {
    return null;
  }

  const cardInfo = extractCardInfo(email.body);

  return {
    amount: amountData.amount,
    date,
    merchant,
    cardInfo: cardInfo || '',
    currency: amountData.currency
  };
}

/**
 * Extracts amount and currency from email body
 */
function extractAmount(body: string): { amount: number; currency: Currency } | null {
  // Find the position of "Amount:" and "From:"
  const amountStart = body.indexOf('Amount:');
  const fromStart = body.indexOf('From:');
  
  if (amountStart === -1 || fromStart === -1 || amountStart >= fromStart) {
    logger.warn("Failed to extract amount from DBS transaction email");
    logger.debug("Email body:", body);
    return null;
  }

  // Extract the amount string between "Amount:" and "From:"
  const amountStr = body.substring(amountStart + 'Amount:'.length, fromStart).trim();
  
  // Handle S$ format
  if (amountStr.startsWith('S$')) {
    const cleanAmountStr = amountStr.substring(2).replace(/[^\d.]/g, '');
    const amount = parseAmount(cleanAmountStr);
    if (amount === null) {
      logger.warn("Failed to parse amount:", cleanAmountStr);
      return null;
    }
    return { amount, currency: 'SGD' as Currency };
  }
  
  // Extract currency (first 3 characters after removing whitespace)
  const currency = amountStr.trim().substring(0, 3).toUpperCase() as Currency;
  
  // Remove currency and any non-numeric characters except decimal point
  const cleanAmountStr = amountStr.substring(3).replace(/[^\d.]/g, '');
  
  // Parse amount with proper decimal handling
  const amount = parseAmount(cleanAmountStr);
  if (amount === null) {
    logger.warn("Failed to parse amount:", cleanAmountStr);
    return null;
  }

  logger.debug("Parsed amount:", { amount, currency });
  return { amount, currency };
}

/**
 * Parses a string amount into a number, handling various formats
 */
function parseAmount(amountStr: string): number | null {
  try {
    // Remove any currency symbols and whitespace
    const cleanStr = amountStr.replace(/[^\d.-]/g, '');
    
    // Handle empty string
    if (!cleanStr) {
      return null;
    }

    // Parse the number
    const amount = Number(cleanStr);
    
    // Check if the result is a valid number
    if (isNaN(amount)) {
      return null;
    }

    // Round to 2 decimal places to handle floating point precision issues
    return Math.round(amount * 100) / 100;
  } catch (error) {
    logger.error("Error parsing amount:", error);
    return null;
  }
}

/**
 * Extracts date from email body
 */
function extractDate(body: string): Date | null {
  const dateStr = extractValue(
    body,
    /Date & Time:\s*(\d{2}\s+[A-Za-z]{3}\s*\d{2}:\d{2})\s*(?:\(SGT\)|SGT)/i
  );
  logger.debug("Date string extracted:", dateStr);

  if (!dateStr) {
    logger.warn("Failed to extract date from DBS transaction email");
    return null;
  }

  return parseDate(dateStr);
}

/**
 * Extracts merchant from email body
 */
function extractMerchant(body: string): string | null {
  // Try to extract merchant in the new format
  let merchant = extractValue(body, /To: ([^\n]+)/i);
  if (!merchant) {
    // Try alternative format with tab separators
    const altMerchant = extractValue(body, /Date & Time:.*?To:\s*([^(\n]+)/i);
    if (!altMerchant) {
      logger.warn("Failed to extract merchant from DBS transaction email");
      return null;
    }
    merchant = altMerchant;
  }

  return merchant;
}

/**
 * Extracts card info from email body
 */
function extractCardInfo(body: string): string | null {
  // Try to extract card info in the new format
  let cardInfo = extractValue(body, /From: ([^\n]+)/i);
  if (!cardInfo) {
    // Try alternative format with tab separators
    const altCardInfo = extractValue(body, /Date & Time:.*?From:\s*([^T]+?)(?=\s+To:)/i);
    if (!altCardInfo) {
      logger.warn("Failed to extract card info from DBS transaction email");
      return null;
    }
    cardInfo = altCardInfo;
  }

  // Clean up the card info by removing any trailing "To:" or other merchant information
  cardInfo = cardInfo.replace(/\s+To:.*$/, '').trim();
  
  return cardInfo;
}

function extractValue(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

function parseDate(dateStr: string): Date {
  // Parse date in format "DD MMM HH:mm" or "DD MMMHH:mm" (e.g., "18 Apr 11:26" or "26 Mar21:37")
  // Also handle format with tab separators like "08 APR 05:21 (SGT)"
  logger.debug("Parsing date string:", dateStr);
  const match = dateStr.match(/(\d{2})\s+([A-Za-z]{3})\s*(\d{2}:\d{2})/);
  if (!match) {
    logger.warn("Failed to match date pattern for:", dateStr);
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const [, day, month, time] = match;
  const [hours, minutes] = time.split(":");
  logger.debug("Parsed components:", { day, month, time, hours, minutes });

  // Map month abbreviation to month number (0-11)
  const monthMap: { [key: string]: number } = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  };

  // Create date with current year
  const year = new Date().getFullYear();
  const monthNum = monthMap[month.toUpperCase()];
  if (monthNum === undefined) {
    logger.warn("Invalid month:", month);
    throw new Error(`Invalid month: ${month}`);
  }

  const date = new Date(
    year,
    monthNum,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes)
  );
  logger.debug("Created date:", date);

  return date;
} 