// Persistence adapter. Swap this implementation for a database-backed one
// later without touching UI or game logic.

export interface StorageAdapter {
  read<T>(key: string): T | null;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
}

const PREFIX = "duel:";

export const localStorageAdapter: StorageAdapter = {
  read<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  write<T>(key: string, value: T) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota or private mode — ignore */
    }
  },
  remove(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(PREFIX + key);
  },
};

export const STORAGE_KEYS = {
  profile: "profile",
  history: "history",
  muted: "muted",
} as const;

export const storage: StorageAdapter = localStorageAdapter;
