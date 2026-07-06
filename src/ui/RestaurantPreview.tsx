/**
 * Vista previa aislada del RestaurantSynthesisCard.
 * Usa datos reales generados por restaurant_deep_search con extractor activo.
 * Abrí: http://localhost:5200/restaurant-preview.html
 */

import { createRoot } from "react-dom/client";
import { RestaurantSynthesisCard, type RestaurantSynthesisResult } from "./cards/RestaurantCard";
import "../style.css";

const realData: RestaurantSynthesisResult = {
  type: "restaurant_synthesis",
  query: "parrilla en Palermo Buenos Aires",
  mood: "",
  status: "ok",
  topScore: "4/5",
  matches: [
    {
      name: "Parrilla El Viejo Palermo",
      sourcesMentioning: 4,
      quote: "calificado 4.9 de 5 en Restaurant Guru: 1187 reseñas de visitantes",
    },
    {
      name: "Don Julio",
      sourcesMentioning: 1,
      quote: "Las carnes de novillo del restaurante Don Julio, en Buenos Aires, son de lo mejor que se puede comer en Latinoamérica.",
    },
  ],
  pros: ["Ofrecer una amplia variedad de opciones de parrilla", "Tener un ambiente acogedor y tradicional argentino"],
  cons: ["No hay cons mencionados en las fuentes proporcionadas"],
  synthesis: "Las parrillas en Palermo parecen ser un destino popular, con varias opciones disponibles. Sin embargo, Parrilla El Viejo Palermo destaca por su alta calificación y consenso entre las fuentes.",
  sources: [
    {
      title: "Los 10 mejores Restaurantes de Parrillada de Palermo (Buenos Aires)",
      url: "https://www.tripadvisor.com.ar/Restaurants-g312741-c6-zfn7816466-Buenos_Aires_Capital_Federal_District.html",
      domain: "tripadvisor.com.ar",
      snippet: "Los mejores Restaurantes de Parrillada de Palermo ( Buenos Aires ): ver opiniones de viajeros de Tripadvisor sobre Restaurantes de Parrillada en Palermo , Buenos Aires .",
    },
    {
      title: "Las mejores 5 parrillas en Palermo (2025) - La Guía de Buenos Aires",
      url: "https://www.laguiadebuenosaires.com/las-mejores-5-parrillas-en-palermo-2025/",
      domain: "laguiadebuenosaires.com",
      snippet: "Hay para todos los gustos, pero seguramente las parrillas son de los más buscado, especialmente entre los turistas.",
    },
    {
      title: "Parrilla El Viejo Palermo — Restaurante en Buenos Aires",
      url: "https://restaurantguru.com/Parrilla-El-Viejo-Palermo-Buenos-Aires",
      domain: "restaurantguru.com",
      snippet: "calificado 4.9 de 5 en Restaurant Guru: 1187 reseñas de visitantes",
    },
    {
      title: "Don Julio — La mejor carne de Buenos Aires",
      url: "https://www.donjulio.com.ar",
      domain: "donjulio.com.ar",
      snippet: "Las carnes de novillo del restaurante Don Julio, en Buenos Aires, son de lo mejor que se puede comer en Latinoamérica.",
    },
  ],
  note: "Cruzadas 5 fuentes. Cada coincidencia respaldada por cita.",
};

function Preview() {
  return (
    <div className="min-h-screen bg-[var(--koru-bg)] py-8 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-lg font-extrabold text-[var(--koru-text)]">
            RestaurantSynthesisCard — Vista previa
          </h1>
          <p className="text-xs text-[var(--koru-muted)] mt-1">
            Datos reales generados por restaurant_deep_search con extractor activo.
          </p>
        </header>

        <RestaurantSynthesisCard result={realData} />

        <footer className="mt-8 text-center">
          <p className="text-[10px] text-[var(--koru-muted)]">
            Koru MVP — restaurant_deep_search → deferredDataCard → uiBlock → RestaurantSynthesisCard
          </p>
        </footer>
      </div>
    </div>
  );
}

const root = document.createElement("div");
root.id = "root";
document.body.appendChild(root);
createRoot(root).render(<Preview />);
