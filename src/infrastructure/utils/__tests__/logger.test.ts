import { Logger, LogLevel, createLogger } from '../logger';

describe('Logger', () => {
  let loggerInstance: Logger;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create a fresh instance for each test (bypass singleton)
    loggerInstance = new Logger();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const a = Logger.getInstance();
      const b = Logger.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('setLogLevel', () => {
    it('should suppress messages below the set level', () => {
      loggerInstance.setLogLevel(LogLevel.WARN);

      loggerInstance.debug('debug msg');
      loggerInstance.info('info msg');
      expect(stdoutSpy).not.toHaveBeenCalled();

      loggerInstance.warn('warn msg');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should show all messages at DEBUG level', () => {
      loggerInstance.setLogLevel(LogLevel.DEBUG);

      loggerInstance.debug('debug msg');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should suppress all messages at NONE level', () => {
      loggerInstance.setLogLevel(LogLevel.NONE);

      loggerInstance.debug('d');
      loggerInstance.info('i');
      loggerInstance.warn('w');
      loggerInstance.error('e');

      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe('log methods', () => {
    beforeEach(() => {
      loggerInstance.setLogLevel(LogLevel.DEBUG);
    });

    it('debug should write to stdout', () => {
      loggerInstance.debug('test debug');
      expect(stdoutSpy).toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('info should write to stdout', () => {
      loggerInstance.info('test info');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('warn should write to stdout (only error goes to stderr)', () => {
      loggerInstance.warn('test warn');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('error should write to stderr', () => {
      loggerInstance.error('test error');
      expect(stderrSpy).toHaveBeenCalled();
    });

    it('error should log Error stack trace', () => {
      loggerInstance.error('oops', new Error('boom'));
      // Should have at least 2 calls: error message + stack
      expect(stderrSpy).toHaveBeenCalledTimes(2);
      const stackOutput = stderrSpy.mock.calls[1][0];
      expect(stackOutput).toContain('Stack:');
    });

    it('error should log non-Error details', () => {
      stderrSpy.mockClear();
      loggerInstance.error('oops', { code: 500 });
      // error message + error details line
      expect(stderrSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should pretty-print object args', () => {
      loggerInstance.info('data', { key: 'value' });
      // Should write the JSON-stringified object
      const allWrites = stdoutSpy.mock.calls.map((c: [string]) => c[0]).join('');
      expect(allWrites).toContain('"key"');
      expect(allWrites).toContain('"value"');
    });

    it('should handle non-object args', () => {
      loggerInstance.info('count', 42);
      const allWrites = stdoutSpy.mock.calls.map((c: [string]) => c[0]).join('');
      expect(allWrites).toContain('42');
    });
  });

  describe('createLogger', () => {
    it('should return the singleton instance', () => {
      const l = createLogger();
      expect(l).toBe(Logger.getInstance());
    });

    it('should set log level when provided', () => {
      const l = createLogger(LogLevel.ERROR);
      // The singleton's level is now ERROR
      stdoutSpy.mockClear();
      (l as Logger).info('should not show');
      expect(stdoutSpy).not.toHaveBeenCalled();
    });
  });
});
