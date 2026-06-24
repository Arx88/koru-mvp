import React from "react";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export type GenerationBlock = {
  type: "generation";
  title?: string;
  prompt?: string;
  resultType?: "text" | "image" | "code" | "document";
  preview?: string;
  actionLabel?: string;
  actionIcon?: string;
};

export function GenerationCard({ block }: { block: GenerationBlock }) {
  const typeIcon: Record<string, string> = {
    text: "auto_fix_high",
    image: "image",
    code: "code",
    document: "description",
  };
  const typeLabel: Record<string, string> = {
    text: "Texto generado",
    image: "Imagen generada",
    code: "Código generado",
    document: "Documento generado",
  };
  const typeColor: Record<string, { bg: string; text: string }> = {
    text: { bg: "bg-purple-50", text: "text-purple-600" },
    image: { bg: "bg-pink-50", text: "text-pink-600" },
    code: { bg: "bg-slate-50", text: "text-slate-600" },
    document: { bg: "bg-blue-50", text: "text-blue-600" },
  };
  const t = block.resultType ?? "text";
  const colors = typeColor[t] ?? typeColor.text;
  return (
    <div className="flex w-full" data-ui-block="generation">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#EAE6DF]" style={{ borderTopLeftRadius: "4px" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded ${colors.bg} flex items-center justify-center`}>
              <Mat className={`text-[16px] ${colors.text}`}>{typeIcon[t]}</Mat>
            </div>
            <span className="text-[15px] font-medium text-gray-800">
              {block.title ?? typeLabel[t]}
            </span>
          </div>
          {block.prompt && (
            <p className="text-[11px] text-gray-400 font-medium mb-3 truncate">
              Prompt: {block.prompt}
            </p>
          )}
          {block.preview && (
            <div className="bg-[#FBF9F5] rounded-xl p-3 border border-[#F5F3EF] mb-3">
              {t === "image" ? (
                <img
                  src={block.preview}
                  alt="Generated"
                  className="w-full h-32 object-cover rounded-lg"
                  loading="lazy"
                />
              ) : (
                <p className="text-sm text-gray-700 font-medium line-clamp-4 whitespace-pre-line">
                  {block.preview}
                </p>
              )}
            </div>
          )}
          {block.actionLabel && (
            <button className="w-full py-2.5 bg-[#121411] text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              {block.actionIcon && <Mat className="text-[16px]">{block.actionIcon}</Mat>}
              {block.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GenerationCard;
