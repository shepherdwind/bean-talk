import * as fs from 'fs';
import * as path from 'path';
import { AccountName } from './account';
import { logger } from '../../infrastructure/utils/logger';

// Get configuration file path from environment variable or use default
const configPath = process.env.MERCHANT_CATEGORY_CONFIG_PATH || 
  path.join(process.cwd(), 'config', 'merchant-category-mapping.json');

// Track the last modification time
let lastModifiedTime = 0;

// Define the type for the merchant category mapping
export type MerchantCategoryMap = Record<string, string>;

// Function to load configuration from file
function loadConfigFromFile(): MerchantCategoryMap {
  try {
    logger.info(`Loading merchant category mapping from: ${configPath}`);
    const configFile = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configFile) as MerchantCategoryMap;
  } catch (error) {
    logger.error(`Error loading merchant category mapping from ${configPath}:`, error);
    return {};
  }
}

// Function to check if the configuration file has been updated
function isConfigUpdated(): boolean {
  try {
    const stats = fs.statSync(configPath);
    const currentModifiedTime = stats.mtimeMs;
    
    if (currentModifiedTime > lastModifiedTime) {
      lastModifiedTime = currentModifiedTime;
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Error checking config file modification time for ${configPath}:`, error);
    return false;
  }
}

// Function to update configuration if the file has changed
export function updateMerchantCategoryMappingsIfNeeded(): void {
  if (isConfigUpdated()) {
    merchantCategoryMappings = loadConfigFromFile();
    logger.info('Merchant category mappings updated from file');
  }
}

// Load initial configuration
export let merchantCategoryMappings: MerchantCategoryMap = loadConfigFromFile();

// Initialize last modification time
try {
  const stats = fs.statSync(configPath);
  lastModifiedTime = stats.mtimeMs;
} catch (error) {
  logger.error(`Error getting initial file modification time for ${configPath}:`, error);
}

/**
 * Helper function to find the category for a merchant
 */
export function findCategoryForMerchant(merchant: string): string | undefined {
  // Check if the configuration has been updated
  updateMerchantCategoryMappingsIfNeeded();
  
  // First try exact match
  if (merchantCategoryMappings[merchant]) {
    return merchantCategoryMappings[merchant];
  }
  
  // Then try partial match
  for (const [key, value] of Object.entries(merchantCategoryMappings)) {
    if (merchant.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(merchant.toLowerCase())) {
      return value;
    }
  }
  
  return undefined;
}

/**
 * Adds a merchant to the category mapping configuration file
 * @param merchant The merchant name to add
 * @param category Optional category to set for the merchant
 */
export function addMerchantToMapping(merchant: string, category?: string): void {
  try {
    // Read the current mapping
    const mapping = loadConfigFromFile();
    
    // Add the new merchant with the provided category or empty string
    mapping[merchant] = category || '';
    
    // Write the updated mapping back to the file
    fs.writeFileSync(configPath, JSON.stringify(mapping, null, 2), 'utf8');
    
    // Update the in-memory mapping
    merchantCategoryMappings = mapping;
    
    logger.info(`Added merchant "${merchant}" to category mapping${category ? ` with category "${category}"` : ' with empty category for manual completion'}`);
  } catch (error: unknown) {
    logger.error(`Error adding merchant to category mapping: ${error instanceof Error ? error.message : String(error)}`);
  }
}