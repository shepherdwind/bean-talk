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