import React from "react";
import type { Extract } from "../domain/types";

export type SavedRecordBlock = Extract<UiBlock, { type: "saved_record" }>;
import type { UiBlock } from "../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function recordIcon(kind: string): string {
  const map: Record<string, string> = {
    expense: "receipt_long",
    shopping_item: "shopping_bag",
    medication: "medication",
    meeting_note: "groups",
    person_followup: "person",
    deadline: "event_busy",
    meal_inventory: "kitchen",
    tool_link: "link",
    idea: "lightbulb",
    recommendation: "recommend",
  };
  return map[kind] ?? "bookmark";
}

export function SavedRecordCard({ block }: { block: SavedRecordBlock }) {
  const records = block.records ?? [];
  return (
    <div className="flex w-full" data-ui-block="saved_record">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-lime-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-lime-500">bookmark_added</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Guardado"}</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-lime-400 bg-lime-50">
              {records.length} registro{records.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Records */}
          {records.length > 0 && (
            <div className="space-y-2 mb-5">
              {records.map((record, idx) => (
                <div key={`${record.id}-${idx}`} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${idx === 0 ? "bg-gradient-to-br from-lime-100 to-green-200" : "bg-gray-100"}`}>
                    <Mat className={`text-[20px] ${idx === 0 ? "text-lime-500" : "text-gray-400"}`}>
                      {recordIcon(record.kind)}
                    </Mat>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{record.title}</p>
                    {record.value && <p className="text-[11px] text-gray-500">{record.value}</p>}
                    {record.amount !== undefined && (
                      <p className="text-[11px] text-gray-500">{record.amount} {record.currency ?? ""}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SavedRecordCard;
