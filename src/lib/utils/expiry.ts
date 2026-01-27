export type ExpiryStatus = "fresh" | "aging" | "warning" | "danger";

export function expiryProgress(
  lastInteractionMs: number,
  expiryMinutes: number,
  nowMs = Date.now(),
): number {
  const totalMs = Math.max(1, expiryMinutes) * 60_000;
  const elapsed = Math.max(0, nowMs - lastInteractionMs);
  return clamp01(1 - elapsed / totalMs);
}

export function expiryStatus(progress: number): ExpiryStatus {
  const pct = clamp01(progress) * 100;
  if (pct >= 50) return "fresh";
  if (pct >= 25) return "aging";
  if (pct >= 10) return "warning";
  return "danger";
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
