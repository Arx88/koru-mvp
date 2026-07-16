import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KoruCountUp } from "./KoruCountUp";

// KoruCountUp — tests for numeric extraction + IntersectionObserver-driven animation.
//
// Strategy:
//  - Mock IntersectionObserver with a class whose observe() invokes the callback
//    immediately with `isIntersecting: true` (so the animation kicks off during
//    render).
//  - Use vi.useFakeTimers() to control requestAnimationFrame + performance.now()
//    (both are intercepted by vitest's fake timers).
//  - "initial" = right after render, before any rAF fires → display is the
//    zeroed-out value (e.g. "0°").
//  - "after callback" = after advancing fake timers past `duration` → display
//    is the target value (e.g. "23°").

class MockIntersectionObserver {
  private cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    // Fire synchronously so the component starts the rAF chain immediately.
    this.cb(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

describe("KoruCountUp", () => {
  const OriginalIO = globalThis.IntersectionObserver;

  beforeEach(() => {
    vi.useFakeTimers();
    // @ts-expect-error test stub — jsdom may not expose IntersectionObserver.
    globalThis.IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.IntersectionObserver = OriginalIO;
  });

  it("renders value as-is when no numeric match (e.g. hello)", () => {
    render(<KoruCountUp value="hello" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("renders 0° initially when value is 23° (before IntersectionObserver animation runs)", () => {
    render(<KoruCountUp value="23°" duration={600} />);
    // The reset effect sets display to "0°" and the observer fires synchronously
    // during render, scheduling rAF — but with fake timers no frame has fired yet.
    expect(screen.getByText("0°")).toBeInTheDocument();
  });

  it("renders 23° after IntersectionObserver callback completes the animation", () => {
    render(<KoruCountUp value="23°" duration={600} />);
    // Advance fake time past the duration so the rAF chain reaches t=1.
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText("23°")).toBeInTheDocument();
  });
});
