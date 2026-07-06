import fs from "fs";

const results = JSON.parse(fs.readFileSync("./smoke-all-results.json", "utf8"));

const highUtil = new Set([
  "currency_convert","crypto_price","restaurant_deep_search","restaurant_review_aggregate","menu_extract",
  "recipe_by_ingredients","flight_search","flight_track","hotel_search","visa_check","travel_itinerary",
  "news_urgent","news_topic","deep_research","world_signal","book_info","app_recommend","game_recommend",
  "game_deals","app_deals","wikipedia_lookup","dictionary_define"
]);
const medUtil = new Set([
  "recipe_find","recipe_save","recipe_show","wine_pairing","match_live","league_standings","match_schedule",
  "golf_leaderboard","trending_youtube","trending_github","person_info","air_quality_advice","expense_track",
  "expense_summary","expense_alert","budget_set","budget_check","expense_by_category","tax_estimate",
  "subscription_reminder","price_history","team_follow","news_radar_topic","rss_subscribe","rss_digest"
]);

let md = "# Resultados individuales de 121 Tools\n\n";

for (const r of results) {
  let util = "x Ninguna";
  if (highUtil.has(r.name)) util = "*** Alta";
  else if (medUtil.has(r.name)) util = "** Media";
  else if (r.ok) util = "* Basica";
  else util = "x No sirve";

  let resp = "F";
  if (!r.ok) resp = "F";
  else if (r.status === "ok" && r.hasData && r.ms > 100) resp = "A";
  else if (r.status === "ok" && r.hasData) resp = "B";
  else resp = "C";

  const detail = String(r.ok ? (r.detail || "OK") : r.detail).substring(0, 250);

  md += `---
**Tool:** ${r.name}
**Estado:** ${r.ok ? "FUNCIONA" : "FALLÓ"}
**Tiempo:** ${r.ms}ms
**Calif. respuesta:** ${resp} (${r.ok ? (r.hasData ? "Con datos reales" : "Sin datos") : detail})
**Utilidad:** ${util}
**Respuesta:** ${detail}

`;
}

fs.writeFileSync("./TOOLS-RESULTADOS.md", md);
console.log("Guardado en TOOLS-RESULTADOS.md");
