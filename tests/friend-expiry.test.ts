import { afterEach, expect, it, vi } from "vitest";
import {
  getFriendSessions,
  isSessionCurrent,
  refreshFriendExpirations,
  setFriendSession,
} from "../src/lib/duel/friend-challenges";
import { bindAccount } from "../src/lib/account/store";
const session = {
  code: "DEMO",
  seed: 1,
  token: "token",
  role: "creator" as const,
};
afterEach(() => {
  bindAccount(null);
  localStorage.clear();
  vi.unstubAllGlobals();
});
it("hides a challenge at its exact expiration time", () => {
  expect(
    isSessionCurrent(
      { ...session, expiresAt: "2026-09-21T12:00:00Z" },
      Date.parse("2026-09-21T12:00:00Z"),
    ),
  ).toBe(false);
  expect(
    isSessionCurrent(
      { ...session, expiresAt: "2026-09-21T12:00:00Z" },
      Date.parse("2026-09-21T11:59:59Z"),
    ),
  ).toBe(true);
});
it("marks legacy 404 challenges expired but keeps sessions for history", async () => {
  setFriendSession(session);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "expired_or_missing" }),
      }),
  );
  await refreshFriendExpirations();
  expect(getFriendSessions()["DEMO"]?.expiresAt).toBe(
    "1970-01-01T00:00:00.000Z",
  );
});
it("does not mark a temporary network error as expiration", async () => {
  setFriendSession(session);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await refreshFriendExpirations();
  expect(getFriendSessions()["DEMO"]?.expiresAt).toBeUndefined();
});
it("does not save an old account's async response into the next account", async () => {
  bindAccount({ id: "a", username: "alice", data: {}, changed: () => {} });
  setFriendSession(session);
  let release!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ),
  );
  const loading = refreshFriendExpirations();
  bindAccount({ id: "b", username: "bob", data: {}, changed: () => {} });
  release({
    ok: true,
    json: async () => ({ challenge: { expires_at: "2027-01-01T00:00:00Z" } }),
  });
  await loading;
  expect(getFriendSessions()).toEqual({});
});
