export type GiftSuggestion = {
  emoji: string;
  name: string;
  deliveryTime: string;
  price: number;
  bgColor?: string;
};

export type SocialInteractionBlock = {
  type: "social_interaction";
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: string;
  emoji?: string;
  body?: string;
  gifts?: GiftSuggestion[];
};

const DEFAULT_GIFTS: GiftSuggestion[] = [
  {
    emoji: "💐",
    name: "Ramo Primaveral",
    deliveryTime: "Llega en 2 horas",
    price: 35,
    bgColor: "bg-pink-100/50",
  },
  {
    emoji: "🍫",
    name: "Caja Chocolates",
    deliveryTime: "Llega en 1 hora",
    price: 25,
    bgColor: "bg-purple-100/50",
  },
];

export function SocialInteractionCard({ block }: { block: SocialInteractionBlock }) {
  const gifts = block.gifts?.length ? block.gifts : DEFAULT_GIFTS;
  const emoji = block.emoji ?? "🎂";
  const body =
    block.body ??
    "No olvides llamarla hoy. Basado en sus gustos anteriores, encontré estas opciones para envío rápido:";

  return (
    <div className="flex w-full" data-ui-block="social_interaction">
      <div className="flex flex-col w-full">
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-5 card-shadow border border-pink-100/50">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-pink-500 shadow-sm text-2xl">
              {emoji}
            </div>
            <div className="flex-1">
              <h4 className="text-[16px] font-bold text-gray-900 mb-1">
                {block.title}
              </h4>
              <p className="text-[13px] text-gray-600 font-medium leading-relaxed">
                {block.subtitle ?? body}
              </p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {gifts.map((gift, idx) => (
              <div
                key={idx}
                className="snap-start shrink-0 w-[140px] bg-white/80 backdrop-blur rounded-2xl p-2.5 border border-white/50 shadow-sm relative group"
              >
                <div
                  className={`h-24 ${gift.bgColor ?? "bg-pink-100/50"} rounded-xl mb-2 flex items-center justify-center text-3xl`}
                >
                  {gift.emoji}
                </div>
                <p className="text-[12px] font-bold text-gray-900 truncate">
                  {gift.name}
                </p>
                <p className="text-[10px] text-gray-500 mb-2">
                  {gift.deliveryTime}
                </p>
                <button className="w-full py-1.5 bg-pink-100 text-pink-600 rounded-lg text-[11px] font-bold hover:bg-pink-200 transition-colors">
                  Enviar (${gift.price})
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SocialInteractionCard;
