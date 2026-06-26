import React from "react";
import type { Extract } from "../domain/types";

type ClarifyingQuestionBlock = Extract<UiBlock, { type: "clarifying_question" }>;
import type { UiBlock } from "../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function ClarifyingQuestionCard({ block }: { block: ClarifyingQuestionBlock }) {
  const options = block.options ?? [];
  return (
    <div className="flex w-full" data-ui-block="clarifying_question">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-violet-500">help</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Necesito un dato"}</h2>
            </div>
          </div>

          {/* Question */}
          {block.question && (
            <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100 mb-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                  <Mat className="text-[18px] text-violet-500">question_mark</Mat>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{block.question}</p>
              </div>
            </div>
          )}

          {/* Options */}
          {options.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt, idx) => (
                <button
                  key={`${opt}-${idx}`}
                  type="button"
                  className="p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-violet-50 hover:border-violet-100 transition-colors text-left"
                >
                  <p className="text-xs font-bold text-gray-700">{opt}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

