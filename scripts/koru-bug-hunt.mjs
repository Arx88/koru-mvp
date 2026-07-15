// Test more variants to find bugs
const URL = "https://koru-mvp.onrender.com";

async function callKoru(input) {
  const res = await fetch(`${URL}/api/koru/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      history: [],
      state: { userName: "Tester", records: [], commitments: [], memories: [] },
      model: "nvidia/nemotron-3-ultra-550b-a55b",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const objs = [];
  for (const line of lines) {
    try { objs.push(JSON.parse(line)); } catch (e) { /* skip */ }
  }
  return objs[objs.length - 1];
}

const tests = [
  // Knowledge variants
  { input: "que es la teoria de la relatividad", expect: "einstein|relatividad" },
  { input: "quien fue napoleon", expect: "napoleón|francia|emperador" },
  { input: "que son los agujeros negros", expect: "agujero|negro|espacio" },
  { input: "explicame la fotosintesis", expect: "fotosíntesis|planta|luz" },
  { input: "como funciona el internet", expect: "internet|red|protocolo" },
  // Crypto variants
  { input: "a cuanto esta el ethereum", expect: "eth|ethereum" },
  { input: "precio del BTC", expect: "btc|bitcoin" },
  // Reminder variants
  { input: "mañana a las 9 recordame llamar a juan", expect: "llamar|juan" },
  { input: "no me olvides comprar leche", expect: "comprar|leche" },
  // Game variants
  { input: "info del juego minecraft", expect: "minecraft|mojang" },
  { input: "como es elden ring", expect: "elden|ring|fromsoftware" },
  // Restaurant variants
  { input: "donde como sushi en barcelona", expect: "sushi|barcelona" },
  { input: "mejor parrilla de buenos aires", expect: "parrilla|buenos aires" },
  // Movie/book variants
  { input: "de que trata el libro 1984", expect: "1984|orwell" },
  { input: "quien actua en la pelicula joker", expect: "joker|phoenix" },
];

console.log(`▶ Bug hunt: ${tests.length} variantes\n`);
const results = [];
for (const t of tests) {
  process.stdout.write(`▶ ${t.input.padEnd(50)} `);
  try {
    const r = await callKoru(t.input);
    const reply = (r.reply || "").toLowerCase();
    const expected = t.expect.toLowerCase();
    const ok = expected.split("|").some(e => reply.includes(e));
    const hasError = r.error || r.reply?.includes("No pude");
    const mark = hasError ? "✗" : ok ? "✓" : "?";
    console.log(`${mark} ${(r.reply || "").slice(0, 80)}`);
    results.push({ input: t.input, ok, reply: r.reply, error: r.error });
  } catch (err) {
    console.log(`✗ ${err.message}`);
    results.push({ input: t.input, ok: false, error: err.message });
  }
  await new Promise(r => setTimeout(r, 800));
}

const passed = results.filter(r => r.ok).length;
console.log(`\n✓ ${passed}/${results.length} pasaron`);
