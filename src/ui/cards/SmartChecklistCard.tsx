import { useState } from "react";
import type { UiBlock } from "../../domain/types";

export function SmartChecklistCard({ block }: { block: UiBlock }) {
  const title = (block as any).title ?? "Benchmark";
  const initialItems = (block as any).items ?? [
    { label: "Nespresso: mejor precio", checked: true },
    { label: "Dolce: garantía 3 años", checked: true },
    { label: "Compatibilidad universal", checked: false },
  ];
  const [items, setItems] = useState(initialItems.map((it: any, i: number) => ({ ...it, id: i })));
  const checkedCount = items.filter((it: any) => it.checked).length;
  const progress = items.length ? Math.round((checkedCount / items.length) * 100) : 0;

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-koru-600 uppercase tracking-widest flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">list_alt</span> Smart List
        </span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[16px] font-bold text-gray-900">{title}</h4>
          <div className="w-10 h-10 rounded-full relative flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 absolute" viewBox="0 0 36 36">
              <path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="100, 100" strokeWidth="3" />
              <path className="text-koru-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${progress}, 100`} strokeWidth="3" />
            </svg>
            <span className="text-[10px] font-bold text-koru-600">{progress}%</span>
          </div>
        </div>
        <div className="space-y-1">
          {items.map((item: any, i: number) => (
            <label key={item.id ?? i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer custom-checkbox">
              <input
                checked={item.checked}
                onChange={() => setItems((prev: any[]) => prev.map((it: any) => it.id === item.id ? { ...it, checked: !it.checked } : it))}
                type="checkbox"
                className="peer hidden"
              />
              <div className="w-5 h-5 rounded-md border-2 border-gray-300 flex items-center justify-center transition-colors peer-checked:bg-[#4d6d44] peer-checked:border-[#4d6d44]">
                <svg className="w-3 h-3 text-white hidden peer-checked:block" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className={`text-[14px] font-medium ${item.checked ? "text-gray-400 line-through" : "text-gray-800"}`}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
