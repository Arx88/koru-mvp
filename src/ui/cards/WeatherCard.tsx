import React from "react";
import type { Extract } from "../../domain/types";
import type { UiBlock } from "../../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

type WeatherBlock = Extract<UiBlock, { type: "weather" }>;

export function WeatherCard({ block }: { block: WeatherBlock }) {
  const metrics = [
    block.rain
      ? { label: "Lluvia", value: block.rain, icon: "water_drop" }
      : undefined,
    block.wind
      ? { label: "Viento", value: block.wind, icon: "air" }
      : undefined,
    block.uv !== undefined
      ? { label: "Índice UV", value: block.uv, icon: "light_mode" }
      : undefined,
    block.humidity !== undefined
      ? { label: "Humedad", value: block.humidity, icon: "water_drop" }
      : undefined,
  ].filter((m): m is { label: string; value: string; icon: string } => Boolean(m));

  return (
    <div className="flex w-full" data-ui-block="weather">
      <div className="flex flex-col w-full">
        <div
          className="bg-white rounded-[24px] p-5 border border-gray-100"
          style={{ borderTopLeftRadius: "4px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Mat className="text-[20px] text-blue-500">cloud_queue</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">
                {block.title ?? "Reporte Ambiental"}
              </h2>
            </div>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
              Actualizado
            </span>
          </div>

          {/* Grid 2 cols */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Temperatura
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-gray-800">
                  {block.now ?? "--"}
                </span>
                {block.feel && (
                  <span className="text-xs text-gray-400 font-medium">
                    Sensación {block.feel}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Estado
              </span>
              <span className="text-sm font-medium text-gray-700">
                {block.condition ?? block.advice ?? "--"}
              </span>
            </div>
          </div>

          {/* Metrics grid 3 cols */}
          {metrics.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-50 grid grid-cols-3 gap-2">
              {metrics.map((m) => (
                <div key={m.label} className="text-center p-2 rounded-xl bg-gray-50/50">
                  <Mat className="text-[18px] text-gray-400 block mb-1">{m.icon}</Mat>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">{m.label}</p>
                  <p className="text-sm font-bold text-gray-800">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

