/**
 * Extrae los schemas de tools y UiBlocks de Koru a JSON.
 * Uso: npx tsx finetune/extract-koru-schema.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { ALL_TOOL_DEFINITIONS } from "../src/tools/toolbox";
import { TOOL_REGISTRY } from "../src/domain/toolRegistry";

const outDir = "finetune";
mkdirSync(outDir, { recursive: true });

// Tool definitions visibles por el LLM
const tools = ALL_TOOL_DEFINITIONS.map((def) => ({
  type: def.type,
  function: {
    name: def.function.name,
    description: def.function.description,
    parameters: def.function.parameters,
  },
}));

writeFileSync(`${outDir}/koru-tools.json`, JSON.stringify(tools, null, 2));
console.log(`✓ Escrito ${outDir}/koru-tools.json (${tools.length} tools)`);

// Builtin tools del motor (con metadata de política)
const builtinTools = Object.entries(TOOL_REGISTRY).map(([name, def]) => ({
  name,
  actionKind: def.actionKind,
  policy: def.policy,
  webMode: def.webMode ?? null,
}));

writeFileSync(`${outDir}/koru-builtin-tools.json`, JSON.stringify(builtinTools, null, 2));
console.log(`✓ Escrito ${outDir}/koru-builtin-tools.json (${builtinTools.length} builtins)`);

// Lista de tipos de UiBlock (se completa manualmente o desde types.ts)
const uiBlockTypes = [
  "weather",
  "research_sources",
  "comparison",
  "reminder",
  "alarm",
  "money_summary",
  "saved_record",
  "resource_bundle",
  "clarifying_question",
  "decision_support",
  "proactive_signal",
  "activity_group",
  "activity_tracker",
  "plan",
  "plan_timeline",
  "generation",
  "morning_brief",
  "wellbeing",
  "delivery",
  "shopping_list",
  "restaurant_synthesis",
  "live_match",
  "match_timeline",
  "match_stats",
  "election_results",
  "election_vote",
  "data_ticker",
  "crypto_portfolio",
  "market",
  "forex",
  "route_timeline",
  "transport_compare",
  "route_map",
  "birthday_calendar",
  "birthday_alarm",
  "social_interaction",
  "product_analysis",
  "smart_checklist",
  "outfit",
  "review_score",
  "review_document",
  "review_quote",
  "web_nav",
  "data_card",
];

writeFileSync(`${outDir}/koru-uiblock-types.json`, JSON.stringify(uiBlockTypes, null, 2));
console.log(`✓ Escrito ${outDir}/koru-uiblock-types.json (${uiBlockTypes.length} tipos)`);
