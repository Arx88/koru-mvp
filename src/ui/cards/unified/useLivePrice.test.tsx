import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLivePrice } from "./useLivePrice";

afterEach(() => vi.useRealTimers());

it("never invents price changes as time passes", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useLivePrice("USD 100.00"));
  act(() => vi.advanceTimersByTime(60_000));
  expect(result.current).toEqual({ displayPrice: "USD 100.00", direction: null });
});

it("displays source updates and clears missing prices", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ price }: { price: string | undefined }) => useLivePrice(price), { initialProps: { price: "USD 100.00" as string | undefined } });
  rerender({ price: "USD 101.00" });
  expect(result.current).toEqual({ displayPrice: "USD 101.00", direction: "up" });
  act(() => vi.advanceTimersByTime(900));
  expect(result.current.direction).toBeNull();
  rerender({ price: undefined });
  expect(result.current.displayPrice).toBeUndefined();
});
