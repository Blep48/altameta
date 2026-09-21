import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  render,
  fireEvent,
  cleanup,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { ServerArena } from "../src/components/duel/ServerArena";
import { createEngine } from "../supabase/functions/_shared/arena-engine";
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  publish: vi.fn(),
  call: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/account/client", () => ({
  SUPABASE_URL: "https://test.invalid",
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "test-token" } },
      }),
    },
  },
}));
vi.mock("@/lib/duel/provider", () => ({
  useDuel: () => ({
    activeMatch: {
      id: "match-test",
      gameId: "stack",
      opponent: { username: "BOT" },
    },
    profile: { coins: 9900 },
    wagerEur: 1,
    ready: true,
  }),
}));
vi.mock("@/lib/duel/arena-client", () => ({
  publishArenaView: mocks.publish,
  arenaCall: mocks.call,
}));
vi.mock("@/lib/duel/audio", () => ({
  startMusic: () => () => {},
  sfx: { tap: vi.fn(), win: vi.fn(), lose: vi.fn() },
}));
class FakeSocket {
  static OPEN = 1;
  static instance: FakeSocket;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: Record<string, unknown>[] = [];
  constructor() {
    FakeSocket.instance = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: vi.fn(),
  } as never);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 390,
    height: 600,
    left: 0,
    top: 0,
  } as DOMRect);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  mocks.navigate.mockReset();
  mocks.publish.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("sends ordered controls without a score or browser timestamp", async () => {
  render(<ServerArena game="stack" />);
  await waitFor(() => expect(FakeSocket.instance.onopen).toBeTruthy());
  const ws = FakeSocket.instance;
  act(() => ws.onopen?.());
  expect(ws.sent[0]).toEqual({ token: "test-token", matchId: "match-test" });
  act(() =>
    ws.receive({
      matchId: "match-test",
      engine: createEngine("stack", 1, Date.now()),
      seq: 0,
      serverTime: Date.now(),
    }),
  );
  fireEvent.pointerDown(screen.getByRole("application"), {
    clientX: 100,
    clientY: 100,
  });
  expect(ws.sent.at(-1)).toEqual({ seq: 1, input: "tap" });
  expect(mocks.publish).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});
it("opens the result only after the server commits it", async () => {
  render(<ServerArena game="stack" />);
  await waitFor(() => expect(FakeSocket.instance.onopen).toBeTruthy());
  const ws = FakeSocket.instance,
    s = createEngine("stack", 1, 0);
  s.done = true;
  s.score = 10;
  act(() =>
    ws.receive({ matchId: "match-test", engine: s, seq: 1, serverTime: 10 }),
  );
  expect(mocks.navigate).not.toHaveBeenCalled();
  const result = {
    committed: true,
    activeMatch: null,
    lastOutcome: { won: true },
    revision: 3,
  };
  act(() => ws.receive(result));
  expect(mocks.publish).toHaveBeenCalledWith(result);
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/result" });
});
