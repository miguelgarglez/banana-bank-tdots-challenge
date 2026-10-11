export function parseAmount(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(parseFloat(normalized) * 100);
  if (cents <= 0 || cents > 100000 * 100) return null;
  return cents;
}

export type TransferPhase = 'draft' | 'review' | 'done' | 'closed';

export function transferPhase(approval: unknown | null, outcome: unknown | null): TransferPhase {
  if (outcome) return 'done';
  if (approval) return 'review';
  return 'draft';
}

export function expiresIn(expiresAt: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function isExpired(expiresAt: string, now = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= now;
}
