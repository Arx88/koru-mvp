import type { UiBlock, LifeRecordKind } from "../../domain/types";

type SavedRecordBlock = Extract<UiBlock, { type: "saved_record" }>;

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function recordIcon(kind: LifeRecordKind): string {
  const map: Record<string, string> = {
    expense: "receipt_long",
    shopping_item: "shopping_bag",
    medication: "medication",
    meeting_note: "groups",
    person_followup: "person",
    deadline: "event_busy",
    meal_inventory: "kitchen",
    tool_link: "magic_button",
    idea: "lightbulb",
    recommendation: "recommend",
    gift: "card_giftcard",
    birthday: "cake",
    home_task: "home",
    medical_info: "stethoscope",
    sleep: "bedtime",
    decision: "gavel",
  };
  return map[kind] ?? "bookmark";
}

function recordCategory(kind: LifeRecordKind): string {
  const map: Record<string, string> = {
    expense: "Gasto",
    shopping_item: "Compras",
    medication: "Salud",
    meeting_note: "Reunión",
    person_followup: "Seguimiento",
    deadline: "Deadline",
    meal_inventory: "Comida",
    tool_link: "Herramienta",
    idea: "Idea",
    recommendation: "Recomendación",
    gift: "Regalo",
    birthday: "Cumpleaños",
    home_task: "Casa",
    medical_info: "Salud",
    sleep: "Descanso",
    decision: "Decisión",
  };
  return map[kind] ?? "Guardado";
}

export function SavedRecordCard({ block }: { block: SavedRecordBlock }) {
  const record = block.records?.[0];
  return (
    <div
      className="bg-white rounded-2xl p-4 shadow-sm border border-[#EAE6DF]"
      style={{ borderTopLeftRadius: "4px" }}
      data-ui-block="saved_record"
    >
      <p className="text-[14px] text-gray-800 mb-3 font-medium">
        {block.title ?? "¡Guardado!"}
      </p>
      {record && (
        <div className="bg-[#FBF9F5] rounded-xl p-3 border border-[#EAE6DF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center border border-purple-100">
              <Mat className="text-purple-500">{recordIcon(record.kind)}</Mat>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{record.title}</p>
              <p className="text-xs text-gray-500">{record.collection ?? recordCategory(record.kind)}</p>
            </div>
          </div>
          <Mat className="text-[#A7C497]">check_circle</Mat>
        </div>
      )}
    </div>
  );
}

