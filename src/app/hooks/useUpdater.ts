import { useCallback, useEffect, useRef, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

type CheckOptions = { silent?: boolean };

export function useUpdater() {
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const updateCheckInFlightRef = useRef(false);
  const updateCheckTimeoutIdRef = useRef<number | null>(null);
  const hasCheckedOnLaunchRef = useRef(false);

  const clearPendingLaunchCheck = useCallback(() => {
    if (updateCheckTimeoutIdRef.current == null) return;
    window.clearTimeout(updateCheckTimeoutIdRef.current);
    updateCheckTimeoutIdRef.current = null;
  }, []);

  const checkForUpdates = useCallback(async (options: CheckOptions = {}) => {
    if (updateCheckInFlightRef.current) return;

    updateCheckInFlightRef.current = true;
    setIsCheckingUpdates(true);

    try {
      const update = await check();
      if (!update) {
        if (!options.silent) {
          toast.success("You're up to date!", {
            description: "You're running the latest version of Augenblick.",
          });
        }
        return;
      }

      await update.downloadAndInstall();

      toast.success("New update available", {
        description: "Restart to use the latest",
        action: {
          label: "Restart",
          onClick: () => {
            relaunch().catch((err) => {
              toast.error("Restart failed", {
                description: "Please restart the app manually to apply the update.",
              });
              console.error("Relaunch failed:", err);
            });
          },
        },
        duration: Infinity,
      });
    } catch (err) {
      if (!options.silent) {
        toast.error("Update failed", { description: String(err) });
      }
    } finally {
      updateCheckInFlightRef.current = false;
      setIsCheckingUpdates(false);
    }
  }, []);

  const handleCheckUpdates = useCallback(() => {
    clearPendingLaunchCheck();
    void checkForUpdates({ silent: false });
  }, [checkForUpdates, clearPendingLaunchCheck]);

  const scheduleLaunchUpdateCheck = useCallback(() => {
    if (hasCheckedOnLaunchRef.current) return;
    hasCheckedOnLaunchRef.current = true;
    updateCheckTimeoutIdRef.current = window.setTimeout(() => {
      updateCheckTimeoutIdRef.current = null;
      void checkForUpdates({ silent: true });
    }, 2000);
  }, [checkForUpdates]);

  useEffect(() => clearPendingLaunchCheck, [clearPendingLaunchCheck]);

  return {
    isCheckingUpdates,
    handleCheckUpdates,
    scheduleLaunchUpdateCheck,
    clearPendingLaunchCheck,
  };
}

