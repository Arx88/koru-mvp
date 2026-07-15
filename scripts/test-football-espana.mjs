// Test directo del football tool logic — España ayer
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

const ESPN_LEAGUES = [
  { id: "fifa.world", name: "FIFA World Cup" },
  { id: "uefa.euro", name: "UEFA Euro" },
  { id: "arg.1", name: "Argentine Primera" },
  { id: "eng.1", name: "Premier League" },
  { id: "esp.1", name: "La Liga" },
];

const NATIONAL_TEAM_SYNONYMS = [
  { canonical: "Spain", aliases: ["españa", "espana", "spain"] },
  { canonical: "Argentina", aliases: ["argentina"] },
];

function detectNationalTeam(queryLower) {
  for (const team of NATIONAL_TEAM_SYNONYMS) {
    for (const alias of team.aliases) {
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(queryLower)) return team.canonical;
    }
  }
  return null;
}

function detectDatesToQuery(queryLower) {
  const dates = [];
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  if (/\bayer\b|último partido/.test(queryLower)) {
    dates.push(fmt(new Date(now.getTime() - 24*60*60*1000)));
    dates.push(fmt(new Date(now.getTime() - 48*60*60*1000)));
  } else {
    dates.push(fmt(now));
    dates.push(fmt(new Date(now.getTime() - 24*60*60*1000)));
  }
  return [...new Set(dates)];
}

async function test() {
  const query = "España ayer";
  const queryLower = query.toLowerCase();
  const dates = detectDatesToQuery(queryLower);
  const nationalTeam = detectNationalTeam(queryLower);
  const matchTerms = [queryLower];
  if (nationalTeam) matchTerms.push(nationalTeam.toLowerCase());
  
  console.log("Query:", query);
  console.log("National team detected:", nationalTeam);
  console.log("Match terms:", matchTerms);
  console.log("Dates to query:", dates);
  console.log("");
  
  const results = [];
  const promises = [];
  for (const league of ESPN_LEAGUES) {
    for (const date of dates) {
      promises.push((async () => {
        try {
          const url = `${ESPN_BASE}/${league.id}/scoreboard?dates=${date}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) return;
          const data = await res.json();
          const events = data.events ?? [];
          const matching = events.filter(e => {
            const eventName = (e.name ?? "").toLowerCase();
            const comps = e.competitions ?? [];
            const teams = comps.flatMap(c => (c.competitors ?? []).map(comp => comp.team?.displayName?.toLowerCase() ?? ""));
            return matchTerms.some(term => eventName.includes(term) || teams.some(t => t.includes(term)));
          });
          for (const m of matching) {
            m.__league = league.name;
            m.__date = date;
          }
          results.push(...matching);
        } catch (e) { /* skip */ }
      })());
    }
  }
  await Promise.all(promises);
  
  console.log(`Found ${results.length} matching events:`);
  for (const e of results) {
    const comps = e.competitions ?? [];
    const c = comps[0] ?? {};
    const competitors = c.competitors ?? [];
    const home = competitors.find(x => x.homeAway === "home") ?? {};
    const away = competitors.find(x => x.homeAway === "away") ?? {};
    console.log(`  [${e.__league} ${e.__date}] ${home.team?.displayName ?? "?"} ${home.score ?? "?"} - ${away.score ?? "?"} ${away.team?.displayName ?? "?"} | ${e.status?.type?.detail ?? "?"}`);
  }
}

test().catch(console.error);
