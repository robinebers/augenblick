import { useEffect } from "react";
import type { NoteMeta } from "@/lib/types";
import { noteExpiryTime } from "@/lib/utils/expiry";

type Params = {
  notes: NoteMeta[];
  expiryMinutes: number;
  runExpirySweep: () => Promise<void>;
  runOrAlert: (task: () => void | Promise<void>) => Promise<void>;
};

export function useExpiryScheduler({ notes, expiryMinutes, runExpirySweep, runOrAlert }: Params) {
  useEffect(() => {
    let nextExpiryAt: number | null = null;

    for (const note of notes) {
      if (note.isPinned) continue;
      const noteExpiry = noteExpiryTime(note.lastInteraction, expiryMinutes);
      if (nextExpiryAt === null || noteExpiry < nextExpiryAt) nextExpiryAt = noteExpiry;
    }

    if (nextExpiryAt === null) return;

    const delay = Math.max(0, nextExpiryAt - Date.now());
    const timer = window.setTimeout(() => {
      void runOrAlert(runExpirySweep);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [expiryMinutes, notes, runExpirySweep, runOrAlert]);
}

