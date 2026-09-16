import { useState, useEffect, useRef } from "react";
import { parsePriceNumber } from "./money";

export function useLivePrice(basePrice: string | undefined, _intervalMs = 3000) {
  const [direction, setDirection] = useState<"up" | "dn" | null>(null);
  const previous = useRef(basePrice);

  useEffect(() => {
    const before = previous.current == null ? null : parsePriceNumber(previous.current);
    const after = basePrice == null ? null : parsePriceNumber(basePrice);
    previous.current = basePrice;
    setDirection(before != null && after != null && Number.isFinite(before) && Number.isFinite(after)
      ? after > before ? "up" : after < before ? "dn" : null
      : null);
    const timer = setTimeout(() => setDirection(null), 900);
    return () => clearTimeout(timer);
  }, [basePrice]);

  return { displayPrice: basePrice, direction };
}

export function LivePrice({ value, className }: { value: string | undefined; className?: string }) {
  const { displayPrice, direction } = useLivePrice(value);
  const flashClass = direction === "up" ? "up" : direction === "dn" ? "dn" : "";
  return (
    <span className={`koru-live-price ${flashClass} ${className ?? ""}`}>
      <span className="koru-live-dot" aria-hidden="true" />
      {displayPrice}
    </span>
  );
}
