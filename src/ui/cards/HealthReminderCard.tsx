import type { UiBlock } from "../../domain/types";

export type HealthReminderBlock = Extract<UiBlock, { type: "health_reminder" }>;

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function HealthReminderCard({ block }: { block: HealthReminderBlock }) {
  return (
    <div
      className="bg-white rounded-3xl p-4 card-shadow flex items-center justify-between"
      data-ui-block="health_reminder"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
          <Mat className="text-[20px]">{block.icon ?? "medication"}</Mat>
        </div>
        <div>
          <p className="text-[14px] font-bold text-gray-900">{block.title ?? "Recordatorio de salud"}</p>
          <p className="text-[12px] text-gray-500 font-medium">{block.reminder}</p>
        </div>
      </div>
      {block.actionLabel && (
        <button
          type="button"
          className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-xl text-[12px] font-bold transition-colors"
        >
          {block.actionLabel}
        </button>
      )}
    </div>
  );
}

export default HealthReminderCard;
