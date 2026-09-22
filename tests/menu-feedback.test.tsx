import { it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { MenuFeedback } from "../src/components/duel/MenuFeedback";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("flashes menu choices on pointer and keyboard without highlighting disabled or game controls", () => {
  vi.useFakeTimers();
  const { container, getByText } = render(
    <>
      <MenuFeedback />
      <button>Play</button>
      <button disabled>Disabled</button>
      <section role="application">
        <button>Game tap</button>
      </section>
    </>,
  );
  fireEvent.pointerDown(getByText("Disabled"));
  expect(container.querySelector(".menu-press-flash")).toBeNull();
  fireEvent.pointerDown(getByText("Game tap"));
  expect(container.querySelector(".menu-press-flash")).toBeNull();
  fireEvent.pointerDown(getByText("Play"));
  expect(container.querySelector(".menu-press-flash")).not.toBeNull();
  act(() => vi.advanceTimersByTime(350));
  expect(container.querySelector(".menu-press-flash")).toBeNull();
  fireEvent.click(getByText("Play"), { detail: 0 });
  expect(container.querySelector(".menu-press-flash")).not.toBeNull();
});
