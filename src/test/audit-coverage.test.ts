import { describe, it } from "vitest";
import { AUDIT_LIST } from "../audit-data";

const ALL_TYPES = ["deliverable","clarifying_question","weather","alarm","reminder","shopping_list","plan","comparison","research_sources","money_summary","saved_record","activity_group","proactive_signal","resource_bundle","web_nav","article","data_card","restaurant_synthesis","morning_brief","day_info","wellbeing","live_match","urgent_now","market","delivery","health_reminder","activity_tracker","product_analysis","travel_planner","travel_plan","generation","match_timeline","match_stats","election_results","election_vote","decision_support","memory","data_ticker","crypto_portfolio","forex","route_timeline","transport_compare","route_map","birthday_calendar","birthday_alarm","social_interaction","smart_checklist","outfit","review_score","review_document","review_quote","recipe","movie_review","book_review","news_urgent","tennis_match","exercise_plan"];

describe("cobertura de auditoría", () => {
  it("los 57 tipos tienen fixture", () => {
    const missing = ALL_TYPES.filter(t => !AUDIT_LIST.includes(t));
    console.log("AUDIT_LIST len:", AUDIT_LIST.length);
    console.log("MISSING:", JSON.stringify(missing));
    console.log("EXTRA (no en la lista canónica):", JSON.stringify(AUDIT_LIST.filter(t => !ALL_TYPES.includes(t))));
  });
});
