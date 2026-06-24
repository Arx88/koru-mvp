import React from "react";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export type ProductAnalysisBlock = {
  type: "product_analysis";
  product?: {
    name?: string;
    image?: string;
    icon?: string;
    rating?: number;
    reviewCount?: string;
    description?: string;
  };
  specs?: Array<{ label: string; value: string }>;
  actionLabel?: string;
  actionIcon?: string;
};

export function ProductAnalysisCard({ block }: { block: ProductAnalysisBlock }) {
  const p = block.product ?? {};
  const specs = block.specs ?? [];
  const fullStars = Math.floor(p.rating ?? 0);
  const hasHalf = (p.rating ?? 0) - fullStars >= 0.5;
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < fullStars) return "★";
    if (i === fullStars && hasHalf) return "★";
    return "★";
  });
  return (
    <div className="flex w-full" data-ui-block="product_analysis">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
          <div className="flex gap-4 mb-4">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 flex-shrink-0">
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Mat className="text-[32px]">{p.icon ?? "photo_camera"}</Mat>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-bold text-gray-900 truncate">{p.name ?? "Producto"}</h4>
              {p.rating !== undefined && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-orange-400 text-[14px]">
                    {stars.map((s, i) => (
                      <span key={i} className={i < fullStars ? "text-orange-400" : i === fullStars && hasHalf ? "text-orange-400" : "text-gray-300"}>
                        {s}
                      </span>
                    ))}
                  </span>
                  {p.reviewCount && (
                    <span className="text-[11px] text-gray-500 ml-1">({p.reviewCount})</span>
                  )}
                </div>
              )}
              {p.description && (
                <p className="text-[12px] text-gray-600 font-medium line-clamp-2">{p.description}</p>
              )}
            </div>
          </div>
          {specs.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {specs.map((spec, idx) => (
                <div key={idx} className="bg-gray-50 p-2 rounded-xl">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">{spec.label}</p>
                  <p className="text-[12px] font-semibold text-gray-900">{spec.value}</p>
                </div>
              ))}
            </div>
          )}
          {block.actionLabel && (
            <button className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              {block.actionIcon && <Mat className="text-[16px]">{block.actionIcon}</Mat>}
              {block.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductAnalysisCard;
