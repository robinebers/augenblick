import { useEffect, useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { expiryProgress, expiryStatus } from "@/lib/utils/expiry";
import { formatRelativeTimeFromNow } from "@/lib/utils/time";

type Props = {
  lastInteraction: number;
  expiryMinutes: number;
};

export function ExpiryRing({ lastInteraction, expiryMinutes }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const r = 8;
  const circumference = 2 * Math.PI * r;
  const progress = expiryProgress(lastInteraction, expiryMinutes, now);
  const dashOffset = circumference * (1 - progress);
  const status = expiryStatus(progress);
  const stroke =
    status === "fresh"
      ? "var(--ring-green)"
      : status === "aging"
        ? "var(--ring-yellow)"
        : status === "warning"
          ? "var(--ring-orange)"
          : "var(--ring-red)";

  const expiryAt = useMemo(
    () => lastInteraction + Math.max(1, expiryMinutes) * 60_000,
    [lastInteraction, expiryMinutes],
  );
  const tooltipText = `Trashed ${formatRelativeTimeFromNow(expiryAt, now)}`;

  return (
    <TooltipProvider delayDuration={550}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="shrink-0 p-0.5"
            aria-label={tooltipText}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" className="block" aria-label="Expiry">
              <circle
                cx="10"
                cy="10"
                r={r}
                fill="none"
                stroke="var(--border-default)"
                strokeWidth="2.5"
              />
              <circle
                cx="10"
                cy="10"
                r={r}
                fill="none"
                stroke={stroke}
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 10 10)"
              />
            </svg>
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          sideOffset={6}
          className="z-50 rounded-md border px-2 py-1 text-[12px] shadow-md"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
          }}
        >
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
