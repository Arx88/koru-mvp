type GenerationBlock = {
  type: "generation";
  title?: string;
  prompt?: string;
  resultType?: "text" | "image" | "code" | "document";
  preview?: string;
  actionLabel?: string;
  actionIcon?: string;
  filename?: string;
};

const DEFAULT_CONTENT = `# Propuesta de Valor

Nuestra solución reduce los costos operativos en un 30% durante el primer año de implementación.

## Beneficios Clave
- Automatización de procesos
- Análisis predictivo en tiempo real
- Soporte 24/7 integrado`;

export function GenerationCard({ block }: { block: GenerationBlock }) {
  const filename = block.filename ?? "propuesta_comercial.md";
  const rawContent = block.preview ?? block.title ?? DEFAULT_CONTENT;

  const lines = rawContent.split("\n");

  return (
    <div className="flex w-full" data-ui-block="generation">
      <div className="flex flex-col w-full">
        <div className="bg-[#1E1E1E] rounded-3xl p-5 card-shadow overflow-hidden relative">
          <div className="flex gap-1.5 mb-4">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
            <div className="flex-1 text-center text-[10px] font-mono text-gray-400 -mt-1">
              {filename}
            </div>
          </div>
          <div className="font-mono text-[12px] text-gray-300 leading-relaxed">
            {lines.map((line, idx) => {
              if (line.startsWith("# ")) {
                return (
                  <p key={idx} className="text-sky-400">
                    {line}
                  </p>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <p key={idx} className="text-sky-400">
                    {line}
                  </p>
                );
              }
              if (line.trim() === "") {
                return <br key={idx} />;
              }
              if (line.startsWith("- ")) {
                return (
                  <p key={idx}>
                    <span className="text-yellow-400">-</span>{" "}
                    {line.slice(2)}
                  </p>
                );
              }
              const parts = line.split(/(\d+%)/);
              return (
                <p key={idx}>
                  {parts.map((part, pIdx) => {
                    if (/^\d+%$/.test(part)) {
                      return (
                        <span key={pIdx} className="text-green-400">
                          {part}
                        </span>
                      );
                    }
                    return <span key={pIdx}>{part}</span>;
                  })}
                </p>
              );
            })}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#1E1E1E] to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

