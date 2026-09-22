export function callPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits || typeof window === 'undefined') return;
  window.location.href = `tel:${digits}`;
}
