/**
 * Format a date string to UTC+8 (Asia/Shanghai) timezone
 * @param date - The date string to format
 * @returns Formatted date string in UTC+8 timezone
 */
export function formatDateToUTC8(date: string | undefined): string {
  if (!date) return '';
  const utcDate = new Date(date);
  const month = (utcDate.getMonth() + 1).toString().padStart(2, '0');
  const day = utcDate.getDate().toString().padStart(2, '0');
  const time = utcDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Shanghai' });
  const weekday = utcDate.toLocaleDateString('en-US', { 
    timeZone: 'Asia/Shanghai',
    weekday: 'long'
  });
  return `${month}/${day} ${time} ${weekday}`;
} 

export const formatTimeToUTC8 = (date: string | undefined): string => {
  if (!date) return '';
  const utcDate = new Date(date);
  return utcDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Shanghai' });
}

/**
 * Format a date to YYYY-MM-DD format
 * @param date - The date to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a date to MM-DD format
 * @param date - The date to format
 * @returns Formatted date string in MM-DD format
 */
export function formatDateToMMDD(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}