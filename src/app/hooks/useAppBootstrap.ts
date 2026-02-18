import { useEffect, useState } from "react";
import { useNotesStore } from "@/stores/notesStore";
import { useSettingsStore } from "@/stores/settingsStore";

type Params = {
  runOrAlert: (task: () => void | Promise<void>) => Promise<void>;
  syncMacActivationPolicy: (visible?: boolean) => Promise<void>;
  scheduleLaunchUpdateCheck: () => void;
};

export function useAppBootstrap({
  runOrAlert,
  syncMacActivationPolicy,
  scheduleLaunchUpdateCheck,
}: Params) {
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  useEffect(() => {
    let disposed = false;

    void runOrAlert(async () => {
      await syncMacActivationPolicy();
      if (disposed) return;
      await useSettingsStore.getState().init();
      if (disposed) return;
      await useNotesStore.getState().init();
      if (disposed) return;
      scheduleLaunchUpdateCheck();
      setIsBootstrapped(true);
    });

    return () => {
      disposed = true;
    };
  }, [runOrAlert, scheduleLaunchUpdateCheck, syncMacActivationPolicy]);

  return isBootstrapped;
}

