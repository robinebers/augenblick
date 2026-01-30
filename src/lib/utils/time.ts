export function formatRelativeTime(fromMs: number, toMs = Date.now()): string {
  const deltaMs = Math.max(0, toMs - fromMs);
  const deltaSeconds = Math.floor(deltaMs / 1000);

  if (deltaSeconds < 10) return "just now";
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;

  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

export function formatRelativeTimeFromNow(targetMs: number, nowMs = Date.now()): string {
  const deltaMs = targetMs - nowMs;
  if (deltaMs <= 0) return "now";

  const totalSeconds = Math.floor(deltaMs / 1000);
  if (totalSeconds < 10) return "in a moment";

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? `in ${days}d ${hours}h` : `in ${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `in ${minutes}m ${seconds}s` : `in ${minutes}m`;
  }
  return `in ${seconds}s`;
}
