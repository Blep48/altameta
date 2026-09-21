import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountGate, useAccount } from "../src/components/duel/AccountGate";
import { useState } from "react";
import { accountStorage } from "../src/lib/account/store";
import { newAccount } from "../src/lib/duel/ledger";
import { createDefaultProfile } from "../src/lib/duel/player";
import { bindAccount } from "../src/lib/account/store";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  listener: null as null | ((event: string, session: unknown) => void),
  user: { id: "alice-id", email: "alice@users.altameta.invalid" } as {
    id: string;
    email: string;
  } | null,
}));
vi.mock("../src/lib/account/client", () => ({
  register: mocks.register,
  usernameEmail: (name: string) =>
    `${name.trim().toLowerCase()}@users.altameta.invalid`,
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.read }) }) }),
    rpc: (...args: unknown[]) => ({ setHeader: () => mocks.save(...args) }),
    auth: {
      getSession: async () => ({
        data: { session: mocks.user ? { user: mocks.user } : null },
      }),
      onAuthStateChange: (cb: typeof mocks.listener) => {
        mocks.listener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: mocks.logout,
      signInWithPassword: mocks.login,
    },
  },
}));
vi.mock("../src/lib/duel/audio", () => ({
  stopMusic: vi.fn(),
  setMuted: vi.fn(),
}));
function Probe() {
  const [muted, setMuted] = useState(
    () => accountStorage.getItem("duel:muted") ?? "false",
  );
  const auth = useAccount();
  return (
    <div>
      <output data-testid="muted">{muted}</output>
      <output data-testid="name">{auth?.username}</output>
      <button
        onClick={() => {
          accountStorage.setItem("duel:muted", "true");
          setMuted("true");
        }}
      >
        Mute
      </button>
      <button onClick={() => void auth?.logout()}>Logout</button>
    </div>
  );
}
const mount = () =>
  render(
    <AccountGate>
      <Probe />
    </AccountGate>,
  );
beforeEach(() => {
  mocks.user = { id: "alice-id", email: "alice@users.altameta.invalid" };
  mocks.read.mockReset();
  mocks.save.mockReset();
  mocks.logout.mockReset();
  mocks.login.mockReset();
  mocks.register.mockReset();
  const account = newAccount({
    ...createDefaultProfile(),
    id: "alice-id",
    username: "alice",
    coins: 12345,
  });
  mocks.read.mockResolvedValue({
    data: {
      state: { "duel:muted": "false" },
      revision: 7,
      username: "alice",
    },
    error: null,
  });
  mocks.save.mockResolvedValue({ data: [{ revision: 8 }], error: null });
  mocks.logout.mockImplementation(async () => {
    mocks.listener?.("SIGNED_OUT", null);
    return { error: null };
  });
});
afterEach(() => {
  cleanup();
  bindAccount(null);
  localStorage.clear();
});
it("loads account preferences and flushes them before logout", async () => {
  localStorage.setItem(
    "duel:account:v1",
    JSON.stringify(newAccount(createDefaultProfile())),
  );
  mount();
  await waitFor(() =>
    expect(screen.getByTestId("muted").textContent).toBe("false"),
  );
  expect(screen.getByTestId("name").textContent).toBe("alice");
  let complete!: (result: unknown) => void;
  mocks.save.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  fireEvent.click(screen.getByText("Mute"));
  fireEvent.click(screen.getByText("Logout"));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.logout).not.toHaveBeenCalled();
  const args = mocks.save.mock.calls[0]![1];
  expect(args.expected_revision).toBe(7);
  expect(args.next_state["duel:muted"]).toBe("true");
  await act(async () => complete({ data: [{ revision: 8 }], error: null }));
  await screen.findByText("LOG IN");
  expect(mocks.logout).toHaveBeenCalledOnce();
});
it("shows a preferences save failure and retries without resetting them", async () => {
  mocks.save
    .mockResolvedValueOnce({ data: null, error: new Error("Offline") })
    .mockResolvedValue({ data: [{ revision: 8 }], error: null });
  mount();
  await waitFor(() =>
    expect(screen.getByTestId("muted").textContent).toBe("false"),
  );
  fireEvent.click(screen.getByText("Mute"));
  await screen.findByText("Progress not synced");
  expect(screen.getByTestId("muted").textContent).toBe("true");
  fireEvent.click(screen.getByText("Retry"));
  await waitFor(() =>
    expect(screen.queryByText("Progress not synced")).toBeNull(),
  );
  expect(screen.getByTestId("muted").textContent).toBe("true");
});
it("registers with just username and password and then signs in", async () => {
  mocks.user = null;
  mocks.register.mockResolvedValue(undefined);
  mocks.login.mockResolvedValue({ error: null });
  mount();
  fireEvent.click(await screen.findByText("New here? Create account"));
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "Demo_User" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "demo-password-123" },
  });
  fireEvent.submit(screen.getByText("CREATE ACCOUNT").closest("form")!);
  await waitFor(() =>
    expect(mocks.login).toHaveBeenCalledWith({
      email: "demo_user@users.altameta.invalid",
      password: "demo-password-123",
    }),
  );
  expect(mocks.register).toHaveBeenCalledWith("Demo_User", "demo-password-123");
  expect(screen.queryByLabelText(/email/i)).toBeNull();
});
