// Accept pasted punctuation and an optional US country code.
function nationalDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('1') ? digits.slice(1) : digits;
}

export function formatUSPhone(value: string): string {
  const digits = nationalDigits(value);
  if (!digits) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function normalizeUSPhone(value: string): string | null {
  const digits = nationalDigits(value);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : null;
}
