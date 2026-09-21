import { it, expect, vi } from "vitest";
import { submitFriendScore } from "../src/lib/duel/friend-challenges";
it("never transmits a browser-supplied score", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  await expect(submitFriendScore("TEST", "token", 999999)).rejects.toThrow(
    "Score uploads are disabled",
  );
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});
