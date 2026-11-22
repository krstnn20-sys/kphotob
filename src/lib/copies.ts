export const MIN_COPIES = 1;
export const MAX_COPIES = 10;

export function parseCopies(value: string | number): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) return null;
    return clampCopies(value) === value ? value : null;
  }
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < MIN_COPIES || parsed > MAX_COPIES) return null;
  return parsed;
}

export function clampCopies(value: number) {
  if (!Number.isFinite(value)) return MIN_COPIES;
  return Math.min(MAX_COPIES, Math.max(MIN_COPIES, Math.round(value)));
}
