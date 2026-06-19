import { cn } from "../lib/utils";

export type KoruMascotState =
  | "idle"
  | "listening"
  | "thinking"
  | "thinking-2"
  | "planning"
  | "working"
  | "product-search"
  | "building"
  | "cooking"
  | "happy"
  | "mistake"
  | "tired"
  | "sleeping"
  | "important"
  | "celebrating"
  | "worried"
  | "affectionate"
  | "curious";

export type MascotState = KoruMascotState;

const SIZES = { sm: 64, md: 120, lg: 168, xl: 220 };
const MASCOT_IMAGE: Record<KoruMascotState, string> = {
  idle: "/images/koru-states/idle.png",
  listening: "/images/koru-states/thinking.png",
  thinking: "/images/koru-states/thinking.png",
  "thinking-2": "/images/koru-states/thinking-2.png",
  planning: "/images/koru-states/planning.png",
  working: "/images/koru-states/working.png",
  "product-search": "/images/koru-states/product-search.png",
  building: "/images/koru-states/building.png",
  cooking: "/images/koru-states/cooking.png",
  happy: "/images/koru-states/happy.png",
  mistake: "/images/koru-states/mistake.png",
  tired: "/images/koru-states/tired.png",
  sleeping: "/images/koru-states/sleeping.png",
  important: "/images/koru-states/planning.png",
  celebrating: "/images/koru-states/happy.png",
  worried: "/images/koru-states/thinking-2.png",
  affectionate: "/images/koru-states/happy.png",
  curious: "/images/koru-states/thinking.png",
};

export function KoruMascot({
  state = "idle",
  size = "lg",
  className,
}: {
  state?: MascotState;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: px * 1.5, height: px * 1.5 }}
      aria-hidden="true"
    >
      <div className={cn("relative", state !== "listening" && "animate-breathe")} style={{ width: px, height: px }}>
        <img
          src={MASCOT_IMAGE[state]}
          alt="Koru, tu asistente"
          width={px}
          height={px}
          style={{
            width: px,
            height: "auto",
          }}
          className={cn(
            "select-none object-contain transition-all duration-500",
            state === "thinking" && "brightness-95",
            state === "happy" && "brightness-110 saturate-105",
          )}
        />
      </div>
    </div>
  );
}
