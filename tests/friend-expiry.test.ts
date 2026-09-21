import { afterEach, expect, it, vi } from "vitest";
import {
  getFriendSessions,
  isSessionCurrent,
  refreshFriendExpirations,
  setFriendSession,
} from "../src/lib/duel/friend-challenges";
import { bindAccount } from "../src/lib/account/store";
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../src/lib/duel/arena-client", () => ({ arenaCall: mocks.call }));
const session = {
  code: "DEMO",
  seed: 1,
  token: "account",
  role: "creator" as const,
};
afterEach(() => {
  bindAccount(null);
  localStorage.clear();
  mocks.call.mockReset();
});
it("hides a challenge at its exact expiration", () => {
  expect(
    isSessionCurrent(
      { ...session, expiresAt: "2026-09-21T12:00:00Z" },
      Date.parse("2026-09-21T12:00:00Z"),
    ),
  ).toBe(false);
});
it("marks missing challenges expired without deleting historical session data", async () => {
  setFriendSession(session);
  mocks.call.mockRejectedValue(
    Object.assign(new Error("Not found"), { status: 404 }),
  );
  await refreshFriendExpirations();
  expect(getFriendSessions()["DEMO"]?.expiresAt).toBe(
    "1970-01-01T00:00:00.000Z",
  );
});
it("does not hide a challenge just because the network is down", async () => {
  setFriendSession(session);
  mocks.call.mockRejectedValue(new Error("offline"));
  await refreshFriendExpirations();
  expect(getFriendSessions()["DEMO"]?.expiresAt).toBeUndefined();
});
it("archives legacy token challenges instead of treating them as verified games", () => {
  setFriendSession({ ...session, token: "legacy-token" });
  expect(getFriendSessions()).toEqual({});
});
