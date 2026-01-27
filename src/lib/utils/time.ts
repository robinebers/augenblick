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
  const deltaSeconds = Math.ceil(deltaMs / 1000);

  if (deltaSeconds <= 0) return "now";
  if (deltaSeconds < 10) return "in a moment";
  if (deltaSeconds < 60) return `in ${deltaSeconds}s`;

  const deltaMinutes = Math.ceil(deltaSeconds / 60);
  if (deltaMinutes < 60) return `in ${deltaMinutes}m`;

  const deltaHours = Math.ceil(deltaMinutes / 60);
  if (deltaHours < 24) return `in ${deltaHours}h`;

  const deltaDays = Math.ceil(deltaHours / 24);
  return `in ${deltaDays}d`;
}
