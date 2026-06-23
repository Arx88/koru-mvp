import { useEffect, useState } from "react";
import { useKoru } from "./KoruProvider";
import { cn } from "../lib/utils";
import { Cpu, Check } from "lucide-react";

export function SettingsScreen() {
  const { selectedModel, setSelectedModel } = useKoru();
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/koru/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models || []);
        setLoading(false);
      })
      .catch(() => {
        setModels(["koru-qwen-32k", "qwen3.6:27b", "koru-gemma-16k", "llama3.1:8b", "deepseek-r1:32b"]);
        setLoading(false);
      });
  }, []);

  function handleChange(model: string) {
    setSelectedModel(model);
    localStorage.setItem("koru.selected-model", model);
  }

  return (
    <div className="flex min-h-full flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-3">
        <Cpu className="h-6 w-6 text-forest" />
        <h1 className="text-xl font-semibold text-earth">Modelo de IA</h1>
      </header>

      <p className="text-sm text-stone">
        Seleccioná el modelo que Koru usará para procesar tus mensajes. Los modelos más grandes son más inteligentes pero tardan más.
      </p>

      {loading ? (
        <div className="rounded-2xl border border-sand bg-cream p-4 text-sm text-stone">Cargando modelos...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {models.map((model) => {
            const active = selectedModel === model;
            return (
              <button
                key={model}
                type="button"
                onClick={() => handleChange(model)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                  active
                    ? "border-forest bg-forest/5 text-forest"
                    : "border-sand bg-cream text-earth hover:border-forest/40",
                )}
              >
                <span>{model}</span>
                {active && <Check className="h-4 w-4 text-forest" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-auto rounded-2xl border border-sand bg-cream p-4 text-xs text-stone">
        <p className="font-medium text-earth">Consejo</p>
        <p className="mt-1">
          <strong>koru-qwen-32k</strong> es el modelo recomendado: 27B params, 32k contexto, JSON confiable.
        </p>
      </div>
    </div>
  );
}
