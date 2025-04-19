import { AccountName } from '../../domain/models/account';
import * as fs from 'fs';
import * as path from 'path';

// Get configuration file path from environment variable or use default
const configPath = process.env.MERCHANT_CATEGORY_CONFIG_PATH || 
  path.join(process.cwd(), 'config', 'merchant-category-mapping.json');

// Track the last modification time
let lastModifiedTime = 0;

// Define the type for the merchant category mapping
type MerchantCategoryMap = Record<string, string>;

// Function to load configuration from file
function loadConfigFromFile(): MerchantCategoryMap {
  try {
    console.log(`Loading merchant category mapping from: ${configPath}`);
    const configFile = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configFile) as MerchantCategoryMap;
  } catch (error) {
    console.error(`Error loading merchant category mapping from ${configPath}:`, error);
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
    console.error(`Error checking config file modification time for ${configPath}:`, error);
    return false;
  }
}

// Function to update configuration if the file has changed
export function updateMerchantCategoryMappingsIfNeeded(): void {
  if (isConfigUpdated()) {
    merchantCategoryMappings = loadConfigFromFile();
    console.log('Merchant category mappings updated from file');
  }
}

// Load initial configuration
export let merchantCategoryMappings: MerchantCategoryMap = loadConfigFromFile();

// Initialize last modification time
try {
  const stats = fs.statSync(configPath);
  lastModifiedTime = stats.mtimeMs;
} catch (error) {
  console.error(`Error getting initial file modification time for ${configPath}:`, error);
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
    if (merchant.includes(key) || key.includes(merchant)) {
      return value;
    }
  }
  
  return undefined;
}

/**
 * Adds a merchant to the category mapping configuration file
 * @param merchant The merchant name to add
 */
export function addMerchantToMapping(merchant: string): void {
  try {
    // Read the current mapping
    const configFile = fs.readFileSync(configPath, 'utf8');
    const mapping = JSON.parse(configFile);
    
    // Add the new merchant with an empty string as category (to be filled manually)
    mapping[merchant] = '';
    
    // Write the updated mapping back to the file
    fs.writeFileSync(configPath, JSON.stringify(mapping, null, 2), 'utf8');
    
    // Update the in-memory mapping
    merchantCategoryMappings = mapping;
    
    console.log(`Added merchant "${merchant}" to category mapping with empty category for manual completion`);
  } catch (error) {
    console.error(`Error adding merchant to category mapping: ${error}`);
  }
} 