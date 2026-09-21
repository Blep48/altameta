export type SavedData = Record<string, string>;
type Binding = {
  id: string;
  username: string;
  data: SavedData;
  changed: () => void;
};
let binding: Binding | null = null;
export function bindAccount(value: Binding | null) {
  binding = value;
}
export function accountScope() {
  return binding?.id ?? "guest";
}
export function accountUsername() {
  return binding?.username;
}
export function accountKeys(): string[] {
  return binding
    ? Object.keys(binding.data)
    : typeof localStorage === "undefined"
      ? []
      : Object.keys(localStorage);
}
export const accountStorage = {
  getItem(key: string): string | null {
    return binding ? (binding.data[key] ?? null) : localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (!binding) {
      localStorage.setItem(key, value);
      return;
    }
    if (binding.data[key] === value) return;
    binding.data[key] = value;
    binding.changed();
  },
  removeItem(key: string) {
    if (!binding) {
      localStorage.removeItem(key);
      return;
    }
    if (!(key in binding.data)) return;
    delete binding.data[key];
    binding.changed();
  },
};

/** Serial CAS writes: failures retain pending data; concurrent devices never silently overwrite. */
export class SaveQueue {
  private pending: SavedData | null = null;
  private running: Promise<void> | null = null;
  constructor(
    public revision: number,
    private save: (data: SavedData, revision: number) => Promise<number>,
  ) {}
  enqueue(data: SavedData) {
    this.pending = { ...data };
  }
  get dirty() {
    return this.pending !== null || this.running !== null;
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    this.running = (async () => {
      while (this.pending) {
        const next = this.pending;
        this.revision = await this.save(next, this.revision);
        if (this.pending === next) this.pending = null;
      }
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }
}
