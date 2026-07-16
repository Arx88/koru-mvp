import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MouseEvent } from "react";
import { useTapRipple } from "./useTapRipple";

// useTapRipple — verifies the hook creates a <span.koru-tap-ripple>, fires
// navigator.vibrate, and removes the ripple after 400ms (using fake timers).

function TapButton() {
  const onTap = useTapRipple();
  return (
    <button
      type="button"
      onClick={(e: MouseEvent<HTMLElement>) => onTap(e)}
      style={{ position: "relative", overflow: "hidden" }}
    >
      tap me
    </button>
  );
}

describe("useTapRipple", () => {
  let vibrateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom does not implement navigator.vibrate — install a configurable mock
    // so both the `"vibrate" in navigator` check and the call succeed.
    vibrateSpy = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateSpy,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates a span.koru-tap-ripple on click", () => {
    render(<TapButton />);
    const btn = screen.getByText("tap me");
    fireEvent.click(btn);
    const ripple = btn.querySelector("span.koru-tap-ripple");
    expect(ripple).not.toBeNull();
  });

  it("calls navigator.vibrate(15) on click", () => {
    render(<TapButton />);
    fireEvent.click(screen.getByText("tap me"));
    expect(vibrateSpy).toHaveBeenCalledWith(15);
  });

  it("removes the ripple span after 400ms", () => {
    render(<TapButton />);
    const btn = screen.getByText("tap me");
    fireEvent.click(btn);
    // Right after click, ripple is present.
    expect(btn.querySelector("span.koru-tap-ripple")).not.toBeNull();
    // Advance fake timers past the 400ms cleanup window.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(btn.querySelector("span.koru-tap-ripple")).toBeNull();
  });
});
