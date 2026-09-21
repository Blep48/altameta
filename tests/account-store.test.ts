import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountStorage,
  bindAccount,
  SaveQueue,
} from "../src/lib/account/store";

afterEach(() => {
  bindAccount(null);
  localStorage.clear();
});
describe("account isolation and synchronization", () => {
  it("does not expose another account or the old guest balance", () => {
    localStorage.setItem("duel:account:v1", "guest");
    const changed = vi.fn();
    bindAccount({ id: "a", username: "alice", data: {}, changed });
    expect(accountStorage.getItem("duel:account:v1")).toBeNull();
    accountStorage.setItem("duel:account:v1", "alice");
    expect(changed).toHaveBeenCalledOnce();
    bindAccount({ id: "b", username: "bob", data: {}, changed });
    expect(accountStorage.getItem("duel:account:v1")).toBeNull();
    expect(localStorage.getItem("duel:account:v1")).toBe("guest");
  });
  it("serializes changes made while a save is in flight", async () => {
    let release!: (revision: number) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce(2);
    const queue = new SaveQueue(0, save);
    queue.enqueue({ balance: "99" });
    const flush = queue.flush();
    queue.enqueue({ balance: "100.90" });
    release(1);
    await flush;
    expect(save.mock.calls).toEqual([
      [{ balance: "99" }, 0],
      [{ balance: "100.90" }, 1],
    ]);
    expect(queue.dirty).toBe(false);
  });
  it("retains failed saves for retry without advancing the revision", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(5);
    const queue = new SaveQueue(4, save);
    queue.enqueue({ score: "42" });
    await expect(queue.flush()).rejects.toThrow("offline");
    expect(queue.dirty).toBe(true);
    expect(queue.revision).toBe(4);
    await queue.flush();
    expect(queue.revision).toBe(5);
    expect(queue.dirty).toBe(false);
  });
});
