import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { DuelProvider, useDuel } from "../src/lib/duel/provider";
import {
  initialAccount,
  view,
} from "../supabase/functions/_shared/arena-domain";
const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  listener: null as null | ((v: unknown) => void),
}));
vi.mock("../src/lib/duel/arena-client", () => ({
  arenaCall: mocks.call,
  onArenaView: (fn: typeof mocks.listener) => {
    mocks.listener = fn;
    return () => {
      mocks.listener = null;
    };
  },
}));
vi.mock("../src/lib/duel/audio", () => ({ setMuted: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  mocks.call.mockReset();
  const v = { ...view(initialAccount("alice", "alice"), null, 0), revision: 1 };
  mocks.call.mockImplementation(async () => {
    mocks.listener?.(v);
    return v;
  });
});
afterEach(cleanup);
it("loads server balances and does not accept a client balance patch", async () => {
  localStorage.setItem(
    "duel:account:v1",
    JSON.stringify({ profile: { coins: 999999 } }),
  );
  const { result } = renderHook(() => useDuel(), { wrapper: DuelProvider });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.profile.coins).toBe(10000);
  act(() => result.current.updateProfile({ coins: 999999 }));
  expect(result.current.profile.coins).toBe(10000);
  expect(mocks.call).toHaveBeenCalledTimes(1);
  expect(result.current).not.toHaveProperty("finishSurvivalMatch");
});
it("uses server victories and ignores older replies", async () => {
  const { result } = renderHook(() => useDuel(), { wrapper: DuelProvider });
  await waitFor(() => expect(result.current.ready).toBe(true));
  const a = initialAccount("alice", "alice");
  a.profile.coins = 10090;
  a.profile.wins = 1;
  act(() => mocks.listener?.({ ...view(a, null, 0), revision: 3 }));
  expect(result.current.profile.wins).toBe(1);
  act(() =>
    mocks.listener?.({
      ...view(initialAccount("alice", "alice"), null, 0),
      revision: 2,
    }),
  );
  expect(result.current.profile.coins).toBe(10090);
});
it("cashout waits for a server response instead of crediting locally", async () => {
  const { result } = renderHook(() => useDuel(), { wrapper: DuelProvider });
  await waitFor(() => expect(result.current.ready).toBe(true));
  mocks.call.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await expect(result.current.cashOutLadder()).rejects.toThrow("offline");
  });
  expect(result.current.profile.coins).toBe(10000);
});
it("withdraws demo balance through the server command", async () => {
  const { result } = renderHook(() => useDuel(), { wrapper: DuelProvider });
  await waitFor(() => expect(result.current.ready).toBe(true));
  mocks.call.mockImplementationOnce(async () => {
    const account = initialAccount("alice", "alice");
    account.profile.coins = 7500;
    const serverView = { ...view(account, null, 0), revision: 2 };
    mocks.listener?.(serverView);
    return serverView;
  });
  await act(async () => {
    await result.current.withdrawDemoBalance(2500);
  });
  expect(mocks.call).toHaveBeenLastCalledWith("withdraw", {
    amountUnits: 2500,
  });
  expect(result.current.profile.coins).toBe(7500);
});
