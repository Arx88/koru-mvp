import type { UiBlock } from "../../domain/types";

type MoneySummaryBlock = Extract<UiBlock, { type: "money_summary" }>;

function splitText(text?: string): [string, string] {
  if (!text) return ["", ""];
  const match = text.match(/^([^.!?]+[.!?])\s*(.*)$/);
  if (match) return [match[1].trim(), match[2].trim()];
  return [text, ""];
}

export function MoneySummaryCard({ block }: { block: MoneySummaryBlock }) {
  const amount = block.total !== undefined
    ? `${block.total}${block.currency ? ` ${block.currency}` : ""}`
    : (block.summaryItems?.[0]?.value ?? "");

  const label = block.summaryItems?.[0]?.label ?? "Gastado hoy";
  const [rightMain, rightSub] = splitText(block.recommendation);

  return (
    <div
      className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between"
      data-ui-block="money_summary"
    >
      <div>
        <p className="text-xs text-emerald-800/70 font-medium">{label}</p>
        <p className="text-lg font-bold text-emerald-700">{amount}</p>
      </div>
      <div className="text-right max-w-[60%]">
        <p className="text-sm text-emerald-800 font-medium">{rightMain}</p>
        {rightSub && (
          <p className="text-xs text-emerald-700/80 leading-tight mt-0.5">{rightSub}</p>
        )}
      </div>
    </div>
  );
}

