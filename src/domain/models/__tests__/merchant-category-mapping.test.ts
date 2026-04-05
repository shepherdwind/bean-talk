// Mock logger
jest.mock('../../../infrastructure/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// We use jest.resetModules() + require() to get fresh module state.
// The fs mock must be set up via jest.mock at the top level,
// but we configure return values before each require().

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockStatSync = jest.fn();

jest.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  statSync: mockStatSync,
}));

const defaultMapping = {
  'GRAB FOOD': 'Expenses:Food:Dining',
  'AMAZON': 'Expenses:Shopping:Online',
  'NTUC': 'Expenses:Shopping:Supermarket',
};

function setupFsMocks(mapping = defaultMapping, mtime = 1000) {
  mockReadFileSync.mockReturnValue(JSON.stringify(mapping));
  mockStatSync.mockReturnValue({ mtimeMs: mtime });
}

function loadFreshModule() {
  jest.resetModules();
  // Re-mock logger after resetModules
  jest.doMock('../../../infrastructure/utils/logger', () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }));
  return require('../merchant-category-mapping');
}

describe('merchant-category-mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFsMocks();
  });

  describe('module initialization', () => {
    it('should load mappings from config file on module load', () => {
      const mod = loadFreshModule();
      expect(mod.merchantCategoryMappings).toEqual(defaultMapping);
      expect(mockReadFileSync).toHaveBeenCalled();
    });

    it('should return empty object when config file is missing', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      const mod = loadFreshModule();
      expect(mod.merchantCategoryMappings).toEqual({});
    });

    it('should handle statSync error during initialization', () => {
      mockStatSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const mod = loadFreshModule();
      // Should still load mappings, just fail to set lastModifiedTime
      expect(mod.merchantCategoryMappings).toEqual(defaultMapping);
    });
  });

  describe('findCategoryForMerchant', () => {
    it('should find category by exact match', () => {
      const mod = loadFreshModule();
      expect(mod.findCategoryForMerchant('GRAB FOOD')).toBe('Expenses:Food:Dining');
    });

    it('should find category by partial match (merchant contains key)', () => {
      const mod = loadFreshModule();
      expect(mod.findCategoryForMerchant('GRAB FOOD SG')).toBe('Expenses:Food:Dining');
    });

    it('should find category by partial match (key contains merchant)', () => {
      const mod = loadFreshModule();
      expect(mod.findCategoryForMerchant('GRAB')).toBe('Expenses:Food:Dining');
    });

    it('should return undefined when no match found', () => {
      const mod = loadFreshModule();
      expect(mod.findCategoryForMerchant('UNKNOWN MERCHANT')).toBeUndefined();
    });

    it('should be case-insensitive for partial matching', () => {
      const mod = loadFreshModule();
      expect(mod.findCategoryForMerchant('grab food')).toBe('Expenses:Food:Dining');
    });
  });

  describe('updateMerchantCategoryMappingsIfNeeded', () => {
    it('should reload config when file modification time changes', () => {
      const mod = loadFreshModule();

      // Clear call counts from initialization
      mockReadFileSync.mockClear();

      // Simulate file update: mtime increases
      mockStatSync.mockReturnValue({ mtimeMs: 2000 });
      const updatedMapping = { 'NEW MERCHANT': 'Expenses:Food' };
      mockReadFileSync.mockReturnValue(JSON.stringify(updatedMapping));

      mod.updateMerchantCategoryMappingsIfNeeded();
      expect(mod.merchantCategoryMappings).toEqual(updatedMapping);
    });

    it('should not reload when file modification time is unchanged', () => {
      const mod = loadFreshModule();
      mockReadFileSync.mockClear();

      // statSync returns same mtime (1000)
      mod.updateMerchantCategoryMappingsIfNeeded();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should handle statSync error during update check', () => {
      const mod = loadFreshModule();
      mockReadFileSync.mockClear();
      mockStatSync.mockImplementation(() => {
        throw new Error('EACCES');
      });

      // Should not throw, should not reload
      mod.updateMerchantCategoryMappingsIfNeeded();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  describe('addMerchantToMapping', () => {
    it('should add merchant with category and persist to file', () => {
      const mod = loadFreshModule();
      mod.addMerchantToMapping('NEW STORE', 'Expenses:Shopping:Misc');

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent['NEW STORE']).toBe('Expenses:Shopping:Misc');
    });

    it('should add merchant with empty category when no category provided', () => {
      const mod = loadFreshModule();
      mod.addMerchantToMapping('NEW STORE');

      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(writtenContent['NEW STORE']).toBe('');
    });

    it('should update in-memory mapping after adding', () => {
      const mod = loadFreshModule();
      mod.addMerchantToMapping('NEW STORE', 'Expenses:Food');
      expect(mod.merchantCategoryMappings['NEW STORE']).toBe('Expenses:Food');
    });

    it('should handle write error gracefully', () => {
      const mod = loadFreshModule();
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      // Should not throw
      expect(() => mod.addMerchantToMapping('STORE', 'Expenses:Food')).not.toThrow();
    });
  });
});
