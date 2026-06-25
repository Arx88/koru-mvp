import React from "react";
export function ReviewDocumentCard({ block }: { block: any }) {
  return (
    <article data-ui-block="review_document" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-[#1E1E1E] border border-gray-800 shadow-sm">
      <div className="flex gap-1.5 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
      </div>
      <div className="font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
        {block.content || block.title || "Documento sin contenido."}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#1E1E1E] to-transparent pointer-events-none" />
    </article>
  );
}
