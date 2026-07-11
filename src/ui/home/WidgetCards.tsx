import type { HomeWidget } from "./homeWidgets";

// Koru Home — port PIXEL-PERFECT del diseño Stitch "Koru's Home".
// El markup, las clases, los iconos (Material Symbols), los textos y las
// imágenes salen 1:1 del HTML que generó Stitch. Los DATOS vienen de
// useHomeWidgets (reales donde existen); esto es solo presentación.

// Imágenes exactas del diseño Stitch (album art y avatar de cumpleaños).
const ALBUM_ART =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC-_Jfow3sE3NdGLwSB7cVlFnnBiM37zELZPjzwLDPh3mzCyAjTt75FaMOeQfpAY9WE-U3WX5fU3hh_L3NAAk9nfSAMNU48zuE3LlcI0fWf9JSg38jcfxLfQhGVNfq2KD97YvGAxOSG7GkdxYTtdwXks_KNqrl593G3bLz8kn7TxMhf6L_gBOHzjajgrTJIifGYrOE-tRgwbNdlqHcX74Oxh3iIVF0_M4LOT3EkZOJOBezc3ukm2S6apwnxzlTjtcADeh-n8Q6Ocrg";
const BDAY_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAf83X8Clzvp5NTBc1uy-0CvMWXKFjz10uMkkOqHmG72NUbPPP9ThTsS2cjcJXtawfagHDMqdm1uOHqKYXRsugzgtK2xr75l75UUly3fZxxYdiHQt1v-Jr8xPkaxXsKU7Q7qCAAxFxTg6FwcqAp-nikivmvlT6evW5NNry_UCuE-yScs32iIx3PGwEWVbPJCECZF-R-PCWqFnK6ZdxU7G2mxPa3O4xOcWQm5Vk9XidOwI-ojvKlg72VwdrEQJCtyw1HtDrtwBgUFz8";

const SPAN_KINDS = new Set<HomeWidget["kind"]>(["weather", "now_playing", "birthday", "hydration"]);

export function widgetSpanClass(kind: HomeWidget["kind"]): string {
  return SPAN_KINDS.has(kind) ? "khome-col2" : "";
}

export function HomeWidgetCard({ widget }: { widget: HomeWidget }) {
  const span = widgetSpanClass(widget.kind);

  switch (widget.kind) {
    case "weather":
      return (
        <div
          className={`khome-card ${span} h-48 flex overflow-hidden text-white bg-gradient-to-br from-[#4fa0ff] via-[#85d1ff] to-[#ffe56b]`}
          style={{ border: "none" }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/30 rounded-full khome-blob mix-blend-overlay" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#ffe56b]/50 rounded-full khome-blob mix-blend-overlay" />
          <div className="relative z-10 p-6 flex flex-col justify-between h-full w-full">
            <div className="flex justify-between items-start w-full">
              <div className="flex items-center gap-2 text-[#0b1c30] bg-white/70 px-3 py-1 rounded-full backdrop-blur-md shadow-sm">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
                <span className="text-xs font-bold tracking-wide uppercase">{widget.city}</span>
              </div>
              <span className="material-symbols-outlined text-[#ffcf33] drop-shadow-md" style={{ fontSize: 60, fontVariationSettings: "'FILL' 1" }}>
                light_mode
              </span>
            </div>
            <div className="mt-auto flex justify-between items-end">
              <div className="text-6xl font-extrabold text-white drop-shadow-sm tracking-tighter">{widget.temp}°</div>
              <div className="text-right pb-2 drop-shadow-sm">
                <div className="text-white font-bold text-lg">{widget.condition}</div>
                <div className="text-white/90 text-sm font-medium">H: {widget.hi}° L: {widget.lo}°</div>
              </div>
            </div>
          </div>
        </div>
      );

    case "next_dose":
      return (
        <div className={`khome-card ${span} bg-gradient-to-br from-[#f0dbff] to-[#e1ccff] p-5 flex flex-col justify-between aspect-square`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 rounded-full khome-blob" />
          <div className="z-10 flex justify-between items-start">
            <div className="w-12 h-12 rounded-full flex items-center justify-center relative">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-white/40" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                <path className="text-[#6900b3]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="75, 100" strokeWidth="3" />
              </svg>
              <span className="material-symbols-outlined text-[#6900b3]">pill</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#6900b3] khome-glow-secondary animate-pulse" />
          </div>
          <div className="z-10 mt-auto">
            <h3 className="text-[#6900b3]/70 text-xs font-bold uppercase tracking-wider mb-1">Next Dose</h3>
            <p className="text-[#6900b3] font-extrabold text-2xl">{widget.time}</p>
            <p className="text-[#6900b3]/80 text-sm mt-1 truncate">{widget.name}</p>
          </div>
        </div>
      );

    case "screen_time":
      return (
        <div className={`khome-card ${span} bg-gradient-to-br from-[#e0faf0] to-[#bbf1d8] p-5 flex flex-col justify-between aspect-square`}>
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/40 rounded-full khome-blob" />
          <div className="z-10 flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[#005236]">smartphone</span>
            </div>
            <span className="material-symbols-outlined text-[#005236]" style={{ fontSize: 14 }}>trending_down</span>
          </div>
          <div className="z-10 mt-auto">
            <h3 className="text-[#005236]/70 text-xs font-bold uppercase tracking-wider mb-1">Screen Time</h3>
            <p className="text-[#005236] font-extrabold text-2xl">{widget.value}</p>
            <div className="w-full bg-white/50 h-1.5 rounded-full mt-2">
              <div className="bg-[#005236] h-1.5 rounded-full" style={{ width: "65%" }} />
            </div>
          </div>
        </div>
      );

    case "now_playing":
      return (
        <div className={`khome-card ${span} p-0 flex relative overflow-hidden h-28 bg-gradient-to-r from-[#2a1d45] to-[#4b3570]`}>
          <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm mix-blend-overlay z-0" style={{ backgroundImage: `url('${ALBUM_ART}')` }} />
          <div className="relative z-10 p-4 flex items-center w-full gap-4">
            <div className="w-20 h-20 rounded-2xl flex-shrink-0 shadow-lg border border-white/10 overflow-hidden relative">
              <img alt="Album Art" className="w-full h-full object-cover" src={ALBUM_ART} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-lg truncate drop-shadow-sm">{widget.title}</h3>
              <p className="text-white/70 text-sm truncate">{widget.artist}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-1 bg-white/20 rounded-full flex-1">
                  <div className="h-1 bg-white rounded-full relative" style={{ width: "45%" }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full khome-glow-primary" />
                  </div>
                </div>
                <span className="text-xs text-white/70 font-medium">{widget.elapsed}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 pr-2">
              <span className="material-symbols-outlined text-white cursor-pointer drop-shadow-md" style={{ fontSize: 36 }}>pause_circle</span>
            </div>
          </div>
        </div>
      );

    case "birthday":
      return (
        <div className={`khome-card ${span} bg-gradient-to-br from-[#ffe0e5] to-[#ffd1b3] p-5 flex items-center justify-between relative overflow-hidden`}>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/40 rounded-full khome-blob" />
          <div className="flex items-center gap-4 z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-full blur-md opacity-40 animate-pulse" />
              <img alt="" className="w-14 h-14 rounded-full border-2 border-white shadow-sm relative z-10" src={BDAY_AVATAR} />
              <div className="absolute -bottom-1 -right-1 bg-white text-[#e63946] rounded-full p-1 shadow-sm border border-white/50 z-20">
                <span className="material-symbols-outlined font-bold" style={{ fontSize: 12 }}>featured_seasonal_and_gifts</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-[#e63946]/70 font-bold text-xs tracking-wide uppercase">Birthdays</h3>
                <span className="inline-block px-1.5 py-0.5 bg-white/60 text-[#e63946] rounded-full text-[9px] font-extrabold">TODAY</span>
              </div>
              <p className="text-[#93000a] font-extrabold text-lg tracking-tight">{widget.person}'s {widget.label}</p>
            </div>
          </div>
          <button className="z-10 bg-white/60 hover:bg-white/80 text-[#e63946] px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1 shadow-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>celebration</span> Wish
          </button>
        </div>
      );

    case "crypto":
      return (
        <div className={`khome-card ${span} bg-gradient-to-br from-[#fff4cc] to-[#ffe066] p-5 flex flex-col justify-between aspect-square relative overflow-hidden`}>
          <div className="absolute -right-4 -bottom-4 text-[100px] text-[#7a5c00]/10 rotate-12 select-none z-0">₿</div>
          <div className="z-10 flex justify-between items-start">
            <div className="w-10 h-10 bg-white/60 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-[#7a5c00] font-bold text-xl">₿</span>
            </div>
            <div className="flex items-center gap-1 bg-white/60 text-[#7a5c00] px-2 py-1 rounded-md text-[10px] font-bold shadow-sm">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{widget.up ? "trending_up" : "trending_down"}</span> {widget.change}
            </div>
          </div>
          <div className="z-10 mt-auto">
            <h3 className="text-[#7a5c00]/70 text-xs font-bold uppercase tracking-wider mb-1">{widget.symbol}</h3>
            <p className="text-[#7a5c00] font-extrabold text-xl">{widget.price}</p>
          </div>
        </div>
      );

    case "tasks":
      return (
        <div className={`khome-card ${span} bg-gradient-to-br from-[#e5eeff] to-[#c0c1ff] p-5 flex flex-col aspect-square`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#2f2ebe]" style={{ fontSize: 20 }}>checklist</span>
            <h3 className="text-[#2f2ebe]/70 text-xs font-bold uppercase tracking-wider">Tasks</h3>
          </div>
          <div className="flex-1 flex flex-col gap-3 justify-center">
            {widget.items.map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                    t.done ? "bg-[#2f2ebe] border-[#2f2ebe]" : i % 2 === 0 ? "border-[#2f2ebe] bg-white/50" : "border-[#8127cf] bg-white/50"
                  }`}
                />
                <span className={`text-sm line-clamp-2 leading-tight font-medium ${t.done ? "text-[#07006c]/50 line-through" : "text-[#07006c]"}`}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case "hydration": {
      const pct = Math.min(100, Math.round((widget.current / widget.goal) * 100));
      return (
        <div className={`khome-card ${span} bg-gradient-to-br from-[#ccf0ff] to-[#80dfff] p-5 flex items-center justify-between relative overflow-hidden`}>
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/40 rounded-full khome-blob" />
          <div className="flex items-center gap-4 z-10 w-full">
            <div className="w-12 h-12 bg-white/60 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[#006b99]" style={{ fontSize: 24 }}>water_drop</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-end mb-1">
                <h3 className="text-[#006b99]/70 text-xs font-bold uppercase tracking-wider">Hydration</h3>
                <span className="text-[#006b99] font-bold text-sm">{widget.current}{widget.unit} / {widget.goal}{widget.unit}</span>
              </div>
              <div className="w-full bg-white/50 h-2 rounded-full overflow-hidden">
                <div className="bg-[#006b99] h-full rounded-full relative" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button className="w-10 h-10 bg-white text-[#006b99] rounded-full flex items-center justify-center shadow-sm hover:bg-white/80 transition-colors flex-shrink-0 ml-2">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
            </button>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
