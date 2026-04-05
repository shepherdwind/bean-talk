import {
  formatDateToUTC8,
  formatTimeToUTC8,
  formatDateToYYYYMMDD,
  formatDateToMMDD,
} from '../date.utils';

describe('date.utils', () => {
  describe('formatDateToUTC8', () => {
    it('should format a date string with month, day, time, and weekday', () => {
      const result = formatDateToUTC8('2024-03-15T10:00:00Z');
      // Should contain month/day
      expect(result).toMatch(/03\/15/);
      // Should contain time component
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
      // Should contain weekday
      expect(result).toMatch(/Friday/);
    });

    it('should return empty string for undefined', () => {
      expect(formatDateToUTC8(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(formatDateToUTC8('')).toBe('');
    });
  });

  describe('formatTimeToUTC8', () => {
    it('should return time in Asia/Shanghai timezone', () => {
      const result = formatTimeToUTC8('2024-03-15T10:00:00Z');
      // Should contain time only
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('should return empty string for undefined', () => {
      expect(formatTimeToUTC8(undefined)).toBe('');
    });
  });

  describe('formatDateToYYYYMMDD', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date(2024, 2, 15); // March 15, 2024
      expect(formatDateToYYYYMMDD(date)).toBe('2024-03-15');
    });

    it('should zero-pad month and day', () => {
      const date = new Date(2024, 0, 5); // Jan 5, 2024
      expect(formatDateToYYYYMMDD(date)).toBe('2024-01-05');
    });
  });

  describe('formatDateToMMDD', () => {
    it('should format date as MM-DD', () => {
      const date = new Date(2024, 2, 15); // March 15, 2024
      expect(formatDateToMMDD(date)).toBe('03-15');
    });

    it('should zero-pad month and day', () => {
      const date = new Date(2024, 0, 5); // Jan 5, 2024
      expect(formatDateToMMDD(date)).toBe('01-05');
    });
  });
});
