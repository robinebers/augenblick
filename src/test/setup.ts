import { vi } from "vitest";

// jsdom doesn't implement scrollIntoView; cmdk expects it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom doesn't implement pointer capture; radix select expects it.
if (!Element.prototype.hasPointerCapture) {
  (Element.prototype as any).hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  (Element.prototype as any).releasePointerCapture = () => {};
}

// Some deps expect full Web Storage API.
if (
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage?.getItem !== "function"
) {
  const storage = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    key(index: number) {
      return Array.from(storage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value));
    },
  } as unknown as Storage;
}

if (!window.matchMedia) {
  window.matchMedia = () =>
    ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

type TauriEvent<T = unknown> = { payload: T };
type TauriListener<T = unknown> = (event: TauriEvent<T>) => void;

const tauriListeners = new Map<string, Set<TauriListener>>();

(globalThis as unknown as { __TAURI_EMIT__?: (event: string, payload?: unknown) => void }).__TAURI_EMIT__ =
  (event, payload) => {
    const set = tauriListeners.get(event);
    if (!set) return;
    for (const cb of set) cb({ payload });
  };

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, cb: TauriListener) => {
    let set = tauriListeners.get(event);
    if (!set) {
      set = new Set();
      tauriListeners.set(event, set);
    }
    set.add(cb);
    return () => {
      set?.delete(cb);
    };
  }),
}));
