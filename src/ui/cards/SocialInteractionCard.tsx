import type { UiBlock } from "../../domain/types";

export function SocialInteractionCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const name = data.name ?? "Ana";
  const date = data.date ?? "12 jul";
  const age = data.age ?? "35 años";
  const remaining = data.remaining ?? "Faltan 8 días";
  const gifts = data.gifts ?? [
    { emoji: "💐", title: "Ramo Primaveral", detail: "Llega en 2h" },
    { emoji: "🎁", title: "Caja regalo", detail: "Llega en 1h" },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-pink-500 uppercase tracking-widest flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">cake</span> Social
        </span>
      </div>
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-3xl p-5 card-shadow border border-pink-100/50">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-pink-500 shadow-sm text-lg">🎂</div>
          <div className="flex-1">
            <h4 className="text-[15px] font-bold text-gray-900 mb-1">Cumpleaños de {name}</h4>
            <p className="text-[13px] text-gray-600 font-medium mb-3">{date} · {age} · {remaining}</p>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x">
          {gifts.map((gift: any, i: number) => (
            <div
              key={i}
              className="snap-start shrink-0 w-[140px] bg-white/80 backdrop-blur rounded-2xl p-2.5 border border-white/50 shadow-sm relative"
            >
              <div className="h-20 bg-pink-100/50 rounded-xl mb-2 flex items-center justify-center text-2xl">{gift.emoji}</div>
              <p className="text-[12px] font-bold text-gray-900 truncate">{gift.title}</p>
              <p className="text-[10px] text-gray-500 mb-2">{gift.detail}</p>
              <button className="w-full py-1.5 bg-pink-100 text-pink-600 rounded-lg text-[11px] font-bold">Enviar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
