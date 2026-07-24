/**
 * Helper to clean phone numbers and ensure proper international format for WhatsApp links (wa.me)
 * Handles Dominican Republic (809, 829, 849) and international phone formatting.
 */
export function formatWhatsAppPhone(phoneStr?: string): string {
  if (!phoneStr) return '';
  let cleaned = phoneStr.replace(/\D/g, ''); // Remove non-digits
  if (!cleaned) return '';

  // Dominican Republic area codes (809, 829, 849) with 10 digits -> prepend country code '1'
  if (cleaned.length === 10 && /^(809|829|849)/.test(cleaned)) {
    cleaned = '1' + cleaned;
  }

  return cleaned;
}
