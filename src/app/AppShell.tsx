import { useEffect, useState, type ReactNode } from "react";
import "@/lib/tauri/shim";
import { hasRealTauri } from "@/lib/tauri/runtime";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DialogHost } from "@/components/ui/DialogHost";
import { Toaster } from "@/components/ui/sonner";

type Props = {
  children: ReactNode;
};

export function AppShell({ children }: Props) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktop = hasRealTauri();
    setIsDesktop(desktop);
    document.documentElement.style.setProperty("--titlebar-inset", desktop ? "38px" : "0px");
  }, []);

  function onTitlebarMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDesktop) return;
    if (e.buttons !== 1) return;
    if (e.detail === 2) {
      void getCurrentWindow().toggleMaximize();
      return;
    }
    void getCurrentWindow().startDragging();
  }

  return (
    <>
      {isDesktop ? (
        <div
          data-tauri-drag-region
          className="tauri-titlebar-drag-region"
          onMouseDown={onTitlebarMouseDown}
          role="presentation"
          aria-hidden="true"
        />
      ) : null}
      {children}
      <DialogHost />
      <Toaster position="bottom-right" closeButton />
    </>
  );
}
