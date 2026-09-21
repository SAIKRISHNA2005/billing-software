/**
 * Master Data Format Validation Utilities (D12)
 */

export function cleanVehicleNumber(input: string): string {
  if (!input) return '';
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidVehicleNumber(input: string): boolean {
  const cleaned = cleanVehicleNumber(input);
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(cleaned);
}

export function cleanDriverPhone(input: string): string {
  if (!input) return '';
  return input.replace(/[\s-]/g, '');
}

export function isValidDriverPhone(input: string): boolean {
  const cleaned = cleanDriverPhone(input);
  return /^[6-9]\d{9}$/.test(cleaned);
}
