import type { Visualizer } from "../types";
import type { WeatherData } from "../../schemas/weather";

export const WeatherVisualizer: Visualizer = {
  id: "weather",
  render(data) {
    const w = data as WeatherData;
    return {
      type: "weather",
      city: w.city,
      now: w.now,
      range: w.range,
      rain: w.rain,
      wind: w.wind,
      advice: w.advice,
    };
  },
};
