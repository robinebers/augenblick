import { isTauri } from "@tauri-apps/api/core";

export function isWebTauriShim(): boolean {
  if (typeof window === "undefined") return false;
  const internals = (window as Window & { __TAURI_INTERNALS__?: { __augenblick_web?: boolean } })
    .__TAURI_INTERNALS__;
  return internals?.__augenblick_web === true;
}

export function hasRealTauri(): boolean {
  if (typeof window === "undefined") return false;
  return isTauri() && !isWebTauriShim();
}
