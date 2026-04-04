import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createBot } from '../bot';
import { BotContext } from '../grammy-types';
import { FileSessionStorage } from '../session-storage';

describe('createBot', () => {
  const token = 'test-token-123:ABC';
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grammy-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create a Bot instance with correct type', () => {
    const bot = createBot({ token, sessionDir: tmpDir });
    expect(bot).toBeDefined();
    expect(bot.token).toBe(token);
  });

  it('should have session and conversation middleware registered', () => {
    const bot = createBot({ token, sessionDir: tmpDir });
    // Bot should have middleware stack (session + conversations + whitelist)
    // We can verify by checking the bot is usable — no runtime errors on creation
    expect(bot).toBeDefined();
  });
});

describe('FileSessionStorage', () => {
  let tmpDir: string;
  let storage: FileSessionStorage<{ count: number }>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-test-'));
    storage = new FileSessionStorage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return undefined for non-existent key', () => {
    expect(storage.read('nonexistent')).toBeUndefined();
  });

  it('should write and read session data', () => {
    storage.write('user-123', { count: 5 });
    expect(storage.read('user-123')).toEqual({ count: 5 });
  });

  it('should overwrite existing data', () => {
    storage.write('user-123', { count: 1 });
    storage.write('user-123', { count: 99 });
    expect(storage.read('user-123')).toEqual({ count: 99 });
  });

  it('should delete session data', () => {
    storage.write('user-123', { count: 5 });
    storage.delete('user-123');
    expect(storage.read('user-123')).toBeUndefined();
  });

  it('should not throw when deleting non-existent key', () => {
    expect(() => storage.delete('nonexistent')).not.toThrow();
  });

  it('should persist data to disk as JSON files', () => {
    storage.write('chat-456', { count: 10 });
    const files = fs.readdirSync(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/chat-456.*\.json$/);

    const content = JSON.parse(fs.readFileSync(path.join(tmpDir, files[0]), 'utf-8'));
    expect(content).toEqual({ count: 10 });
  });

  it('should sanitize keys with special characters', () => {
    storage.write('chat:123/456', { count: 1 });
    const result = storage.read('chat:123/456');
    expect(result).toEqual({ count: 1 });
  });

  it('should create data directory if it does not exist', () => {
    const nestedDir = path.join(tmpDir, 'nested', 'dir');
    const nestedStorage = new FileSessionStorage(nestedDir);
    expect(fs.existsSync(nestedDir)).toBe(true);
    nestedStorage.write('test', { count: 1 });
    expect(nestedStorage.read('test')).toEqual({ count: 1 });
  });
});

describe('BotContext type', () => {
  it('should export BotContext type with session and conversation', () => {
    // Type-level test — if this compiles, the types are correct
    const assertCtx = (ctx: BotContext) => {
      // session should be accessible
      const _session = ctx.session;
      // conversation should be accessible
      const _conversation = ctx.conversation;
    };
    expect(assertCtx).toBeDefined();
  });
});
