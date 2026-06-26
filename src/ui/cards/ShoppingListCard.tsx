import React, { useState } from "react";
import type { Extract } from "../domain/types";
import type { UiBlock } from "../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

type ShoppingListBlock = Extract<UiBlock, { type: "shopping_list" }>;

export function ShoppingListCard({ block }: { block: ShoppingListBlock }) {
  const items = block.items ?? [];
  const [checked, setChecked] = useState<Set<string>>(new Set(block.checked ?? []));

  const toggle = (item: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  return (
    <div className="flex w-full" data-ui-block="shopping_list">
      <div className="flex flex-col w-full">
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-[#EAE6DF]"
          style={{ borderTopLeftRadius: "4px" }}
        >
          {block.title && (
            <p className="text-[14px] text-gray-800 mb-4 font-medium">{block.title}</p>
          )}
          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => {
                const isChecked = checked.has(item);
                const qty = block.quantities?.[item] ?? 1;
                return (
                  <div
                    key={`${item}-${idx}`}
                    className={[
                      "flex items-center justify-between p-3 rounded-xl transition-colors group",
                      isChecked
                        ? "bg-gray-50 border border-gray-200"
                        : "bg-[#FBF9F5] border border-[#F5F3EF] hover:border-[#A7C497]",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <label className="relative flex items-center justify-center w-5 h-5 cursor-pointer">
                        <input
                          type="checkbox"
                          className="peer appearance-none w-5 h-5 border-2 border-[#EAE6DF] rounded-md checked:bg-[#A7C497] checked:border-[#A7C497] transition-all cursor-pointer"
                          checked={isChecked}
                          onChange={() => toggle(item)}
                        />
                        <span className="material-symbols-outlined absolute text-white text-[16px] opacity-0 peer-checked:opacity-100 pointer-events-none">
                          check
                        </span>
                      </label>
                      <span
                        className={[
                          "text-sm font-medium",
                          isChecked ? "text-gray-400 line-through" : "text-gray-700",
                        ].join(" ")}
                      >
                        {item}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 px-2 py-1 bg-white rounded-lg border border-[#EAE6DF]">
                      <button
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Disminuir"
                        tabIndex={-1}
                      >
                        <Mat className="text-[18px]">remove</Mat>
                      </button>
                      <span className="text-xs font-bold w-4 text-center text-gray-700">
                        {qty}
                      </span>
                      <button
                        className="text-gray-400 hover:text-[#A7C497] transition-colors"
                        aria-label="Aumentar"
                        tabIndex={-1}
                      >
                        <Mat className="text-[18px]">add</Mat>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {block.note && (
            <p className="text-[10.5px] text-gray-400 leading-relaxed mt-3">{block.note}</p>
          )}
          <button className="mt-2 flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-[#EAE6DF] rounded-xl text-gray-400 hover:text-[#A7C497] hover:border-[#A7C497] transition-all bg-transparent hover:bg-white">
            <Mat className="text-[20px]">add_circle</Mat>
            <span className="text-xs font-bold uppercase tracking-widest">Añadir nuevo ítem</span>
          </button>
        </div>
      </div>
    </div>
  );
}

