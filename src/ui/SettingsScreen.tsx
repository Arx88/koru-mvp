import { useEffect, useMemo, useState } from "react";
import { useKoru } from "./KoruProvider";
import { Cpu, Check, ChevronDown } from "lucide-react";

type ModelOption = {
  id: string;
  provider: string;
  label: string;
};

export function SettingsScreen() {
  const { selectedModel, setSelectedModel } = useKoru();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/koru/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models || []);
        setLoading(false);
      })
      .catch(() => {
        setModels([
          { id: "koru-qwen-32k:latest", provider: "ollama", label: "Koru Qwen 32k" },
          { id: "qwen3.6:27b", provider: "ollama", label: "Qwen 3.6 27B" },
          { id: "koru-gemma-16k:latest", provider: "ollama", label: "Koru Gemma 16k" },
        ]);
        setLoading(false);
      });
  }, []);

  function handleChange(modelId: string) {
    setSelectedModel(modelId ?? "");
    if (modelId) {
      localStorage.setItem("koru.selected-model.v2", modelId);
    } else {
      localStorage.removeItem("koru.selected-model.v2");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    for (const m of models) {
      const list = map.get(m.provider) || [];
      list.push(m);
      map.set(m.provider, list);
    }
    return Array.from(map.entries());
  }, [models]);

  const selectedLabel = useMemo(() => {
    if (!selectedModel) return "Automático (predeterminado)";
    return models.find((m) => m.id === selectedModel)?.label ?? selectedModel;
  }, [selectedModel, models]);

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
        <div className="relative">
          <select
            value={selectedModel ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-sand bg-cream px-4 py-3 pr-10 text-sm font-medium text-earth outline-none focus:border-forest transition-colors cursor-pointer"
          >
            <option value="">Automático (predeterminado)</option>
            {grouped.map(([provider, items]) => (
              <optgroup key={provider} label={provider.toUpperCase()}>
                {items.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth" />
          {selectedModel && (
            <div className="mt-2 flex items-center gap-2 text-xs text-forest">
              <Check className="h-3.5 w-3.5" />
              <span>Seleccionado: {selectedLabel}</span>
            </div>
          )}
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
