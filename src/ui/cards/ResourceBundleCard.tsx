import React from "react";
import type { Extract } from "../domain/types";
import type { UiBlock } from "../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export type ResourceBundleBlock = Extract<UiBlock, { type: "resource_bundle" }>;

function fileIcon(kind: string): string {
  const map: Record<string, string> = {
    document: "description",
    spreadsheet: "table",
    presentation: "slideshow",
    text: "article",
    markdown: "markdown",
    csv: "table_chart",
  };
  return map[kind] ?? "insert_drive_file";
}

function fileColor(kind: string): { bg: string; border: string; icon: string } {
  switch (kind) {
    case "document":
      return { bg: "bg-blue-50", border: "border-blue-100", icon: "text-blue-500" };
    case "spreadsheet":
    case "csv":
      return { bg: "bg-green-50", border: "border-green-100", icon: "text-green-500" };
    case "presentation":
      return { bg: "bg-orange-50", border: "border-orange-100", icon: "text-orange-500" };
    default:
      return { bg: "bg-purple-50", border: "border-purple-100", icon: "text-purple-500" };
  }
}

function downloadArtifact(file: { name: string; mimeType: string; content?: string }) {
  const blob = new Blob([file.content ?? ""], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ResourceBundleCard({ block }: { block: ResourceBundleBlock }) {
  const files = block.files ?? [];
  return (
    <div className="flex w-full" data-ui-block="resource_bundle">
      <div className="flex flex-col w-full">
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-[#EAE6DF]"
          style={{ borderTopLeftRadius: "4px" }}
        >
          {block.title && (
            <p className="text-[14px] text-gray-800 mb-3 font-medium">{block.title}</p>
          )}
          {block.summary && (
            <p className="text-[14px] text-gray-800 mb-3 font-medium">{block.summary}</p>
          )}
          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              {files.slice(0, 6).map((file, idx) => {
                const colors = fileColor(file.kind);
                return (
                  <button
                    key={`${file.name}-${idx}`}
                    type="button"
                    onClick={() => downloadArtifact(file)}
                    className="bg-[#FBF9F5] rounded-xl p-3 border border-[#EAE6DF] flex items-center justify-between hover:border-[#A7C497] transition-colors text-left"
                    aria-label={`Descargar ${file.name}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          colors.bg,
                          "border",
                          colors.border,
                        ].join(" ")}
                      >
                        <Mat className={["text-[20px]", colors.icon].join(" ")}>
                          {fileIcon(file.kind)}
                        </Mat>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {file.kind} — {file.sizeLabel}
                        </p>
                      </div>
                    </div>
                    <Mat className="text-[#A7C497] text-[20px]">check_circle</Mat>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResourceBundleCard;
