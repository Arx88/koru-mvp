import { useEffect, useState } from "react";
import { Sparkles, Cloud, CheckCircle2, Lightbulb, Heart } from "lucide-react";

type MorningBrief = {
  greeting: string;
  weather?: string;
  tasks?: string[];
  memoryHighlight?: string;
  suggestion?: string;
};

export function MorningBriefCard({ brief, onStart }: { brief: MorningBrief; onStart: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`koru-morning-brief ${visible ? "is-visible" : ""}`}
      role="region"
      aria-label="Brief matutino"
    >
      <div className="koru-morning-brief-glow" aria-hidden="true" />
      <div className="koru-morning-brief-content">
        {/* Greeting */}
        <div className="koru-morning-brief-header">
          <Sparkles className="h-5 w-5 text-[#6ee7b7]" />
          <h2 className="koru-morning-brief-greeting">{brief.greeting}</h2>
        </div>

        <div className="koru-morning-brief-sections">
          {/* Weather */}
          {brief.weather && (
            <div className="koru-morning-brief-section">
              <Cloud className="h-4 w-4 text-[#a99be0]" />
              <p>{brief.weather}</p>
            </div>
          )}

          {/* Tasks */}
          {brief.tasks && brief.tasks.length > 0 && (
            <div className="koru-morning-brief-section">
              <CheckCircle2 className="h-4 w-4 text-[#6ee7b7]" />
              <div>
                <p className="koru-morning-brief-label">Pendientes de hoy</p>
                <ul>
                  {brief.tasks.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Memory highlight */}
          {brief.memoryHighlight && (
            <div className="koru-morning-brief-section">
              <Heart className="h-4 w-4 text-[#f0d9ee]" />
              <p>{brief.memoryHighlight}</p>
            </div>
          )}

          {/* Suggestion */}
          {brief.suggestion && (
            <div className="koru-morning-brief-section koru-morning-brief-suggestion">
              <Lightbulb className="h-4 w-4 text-[#fbbf24]" />
              <p>{brief.suggestion}</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onStart}
          className="koru-morning-brief-cta"
        >
          Empezar el día
        </button>
      </div>
    </div>
  );
}
